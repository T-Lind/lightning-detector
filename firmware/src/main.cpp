#include <Arduino.h>
#include <SPI.h>
#include <SparkFun_AS3935.h>
#include <ArduinoJson.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <LittleFS.h>
#include <Preferences.h>
#include <esp_sleep.h>
#include <esp_sntp.h>
#include <driver/rtc_io.h>
#include <mbedtls/md.h>
#include <time.h>
#include <algorithm>
#include "config.h"
#if __has_include("secrets.h")
#include "secrets.h"
#else
#include "secrets.example.h"
#endif
#if __has_include("tls_ca.h")
#include "tls_ca.h"
#else
#include "tls_ca.example.h"
#endif

// RTC RAM survives deep sleep, not removal of power. Flash queue survives both.
struct Event {
  uint32_t seq;
  int64_t timestamp;
  uint32_t energy;
  uint16_t battery;
  uint8_t kind, distance;
};
enum Kind : uint8_t { HEARTBEAT, LIGHTNING_EVENT, NOISE_EVENT, DISTURBER, RANGE_CHANGE, SENSOR_FAULT };
const char* names[] = {"heartbeat", "lightning", "noise", "disturber", "range_change", "sensor_fault"};
RTC_DATA_ATTR uint32_t magic = 0;
RTC_DATA_ATTR int64_t nextHeartbeat = 0, nextUpload = 0;
RTC_DATA_ATTR uint32_t rejected = 0;
RTC_DATA_ATTR uint8_t fastNoiseWakes = 0;
RTC_DATA_ATTR int64_t lastNoiseWake = 0;
RTC_DATA_ATTR bool configured = false;
SparkFun_AS3935 sensor;
Preferences prefs;
Event events[cfg::QUEUE_CAPACITY];
uint16_t count = 0;
uint32_t generation = 0, dropped = 0;
RTC_DATA_ATTR uint32_t seqEnd = 0, nextSeq = 0;
int activeSlot = -1;
bool storageOK = false, sensorOK = false;
uint32_t started;
const char* queuePath[] = {"/queue0.bin", "/queue1.bin"};

int64_t epoch() { return static_cast<int64_t>(time(nullptr)); }
bool validClock() { return epoch() >= 1767225600; }
uint16_t batteryMV() {
  analogReadResolution(12);
  analogSetPinAttenuation(35, ADC_11db);
  uint32_t sum = 0;
  analogReadMilliVolts(35);
  for (int i=0; i<16; ++i) { sum += analogReadMilliVolts(35); delay(1); }
  return static_cast<uint16_t>((sum / 16.0f) * 2.0f * cfg::BATTERY_CAL);
}
uint32_t crc32(const uint8_t* p, size_t len) {
  uint32_t crc = ~0u;
  while (len--) { crc ^= *p++; for (int i=0;i<8;++i) crc = (crc >> 1) ^ (0xEDB88320u & -(crc & 1)); }
  return ~crc;
}
struct Header { uint32_t magic, generation, count, dropped, crc; };
bool loadSlot(int slot, Header &h, Event* target) {
  File f=LittleFS.open(queuePath[slot], "r");
  if (!f || f.read(reinterpret_cast<uint8_t*>(&h),sizeof h)!=sizeof h ||
      h.magic!=0x4C445131 || h.count>cfg::QUEUE_CAPACITY ||
      f.size()!=sizeof h+h.count*sizeof(Event)) return false;
  size_t n=h.count*sizeof(Event);
  if (f.read(reinterpret_cast<uint8_t*>(target),n)!=n) return false;
  return crc32(reinterpret_cast<uint8_t*>(target),n)==h.crc;
}
void loadQueue() {
  Header a{}, b{};
  static Event other[cfg::QUEUE_CAPACITY];
  bool okA=loadSlot(0,a,events), okB=loadSlot(1,b,other);
  if (okB && (!okA || static_cast<int32_t>(b.generation-a.generation)>0)) {
    memcpy(events,other,b.count*sizeof(Event)); activeSlot=1; a=b;
  } else if(okA) activeSlot=0;
  if(activeSlot>=0) { count=a.count; generation=a.generation; dropped=a.dropped; }
  else if(LittleFS.exists(queuePath[0]) || LittleFS.exists(queuePath[1])) {
    storageOK=false; Serial.println("Both queue slots invalid; preserve flash and investigate.");
  }
}
bool saveQueue() {
  if(!storageOK) return false;
  int slot=activeSlot==0?1:0;
  Header h{0x4C445131,generation+1,count,dropped,
    crc32(reinterpret_cast<uint8_t*>(events),count*sizeof(Event))};
  File f=LittleFS.open(queuePath[slot],"w");
  if(!f) return false;
  bool ok=f.write(reinterpret_cast<uint8_t*>(&h),sizeof h)==sizeof h &&
    f.write(reinterpret_cast<uint8_t*>(events),count*sizeof(Event))==count*sizeof(Event);
  f.flush(); f.close();
  Header check{}; static Event verify[cfg::QUEUE_CAPACITY];
  if(!ok || !loadSlot(slot,check,verify) || check.generation!=h.generation) return false;
  generation=h.generation; activeSlot=slot; return true;
}
uint32_t reserveSequence() {
  // Reserve 256 IDs at once. Power loss skips unused IDs; it cannot reuse them.
  if(nextSeq>=seqEnd) {
    uint32_t end=prefs.getUInt("seq_end",1);
    if(end>0xFFFFFF00u) { Serial.println("Sequence exhausted; provision a new device ID."); return 0; }
    if(prefs.putUInt("seq_end",end+256)!=sizeof(uint32_t)) return 0;
    nextSeq=end; seqEnd=end+256;
  }
  return nextSeq++;
}
Event capture(Kind kind) {
  Event e{}; e.kind=kind; e.distance=255;
  e.timestamp=validClock()?epoch():0;
  return e;
}
void append(Event e) {
  e.seq=reserveSequence(); if(!e.seq) { ++rejected; return; }
  e.battery=batteryMV();
  if(count==cfg::QUEUE_CAPACITY) {
    memmove(events,events+1,(--count)*sizeof(Event)); ++dropped;
  }
  events[count++]=e;
  if(!saveQueue()) { storageOK=false; Serial.println("QUEUE WRITE FAILED; data is not durable."); }
}
// This is the only routine reading register 0x03 during normal operation.
// Read BEFORE LittleFS, Preferences, NTP, Wi-Fi, or diagnostics.
bool readPending(Event &e) {
  if(digitalRead(cfg::IRQ)!=HIGH) return false;
  delay(3); // >=2ms after observed IRQ; also covers awake-time interrupts.
  uint8_t reason=sensor.readInterruptReg();
  e=capture(reason&8?LIGHTNING_EVENT:reason&1?NOISE_EVENT:reason&4?DISTURBER:RANGE_CHANGE);
  if(reason==0 || reason&8) {
    uint8_t raw=sensor.distanceToStorm();
    const uint8_t valid[]={1,5,6,8,10,12,14,17,20,24,27,31,34,37,40,63};
    for(auto distance:valid) if(raw==distance) e.distance=raw;
  }
  if(reason&8) e.energy=sensor.lightningEnergy(); // 21-bit register field, unitless.
  return true;
}
bool configureSensor() {
  // beginSPI() returns true without probing hardware. Verify actual register readback.
  sensor.setIndoorOutdoor(OUTDOOR);
  sensor.setNoiseLevel(cfg::NOISE);
  sensor.watchdogThreshold(cfg::WATCHDOG);
  sensor.spikeRejection(cfg::SPIKE);
  sensor.lightningThreshold(1);
#ifdef BENCH_MODE
  sensor.maskDisturber(false);
#else
  sensor.maskDisturber(cfg::MASK_DISTURBERS);
#endif
  sensor.tuneCap(cfg::TUNING_PF);
  bool calibrated=sensor.calibrateOsc();
  return calibrated && sensor.readIndoorOutdoor()==OUTDOOR &&
    sensor.readNoiseLevel()==cfg::NOISE && sensor.readWatchdogThreshold()==cfg::WATCHDOG &&
    sensor.readSpikeRejection()==cfg::SPIKE && sensor.readTuneCap()==cfg::TUNING_PF;
}
String sign(const String &body) {
  uint8_t hash[32]; char hex[65];
  mbedtls_md_hmac(mbedtls_md_info_from_type(MBEDTLS_MD_SHA256),
    reinterpret_cast<const uint8_t*>(DEVICE_SECRET),strlen(DEVICE_SECRET),
    reinterpret_cast<const uint8_t*>(body.c_str()),body.length(),hash);
  for(int i=0;i<32;++i) snprintf(hex+2*i,3,"%02x",hash[i]);
  return String(hex);
}
bool configuredNetwork() {
  return strcmp(WIFI_SSID,"CHANGE_ME")!=0 && strlen(DEVICE_SECRET)==64 &&
    strncmp(API_BASE_URL,"https://",8)==0 && strlen(TLS_CA_CERT)>100;
}
bool connectNetwork() {
  if(!configuredNetwork()) { Serial.println("Network disabled: configure secrets and TLS root."); return false; }
  WiFi.persistent(false); WiFi.mode(WIFI_STA); WiFi.begin(WIFI_SSID,WIFI_PASSWORD);
  uint32_t t=millis();
  while(WiFi.status()!=WL_CONNECTED && millis()-t<cfg::WIFI_TIMEOUT_MS) delay(20);
  if(WiFi.status()!=WL_CONNECTED) { Serial.printf("Wi-Fi association failed: status=%d\n",WiFi.status()); return false; }
  Serial.printf("Wi-Fi connected: IP=%s RSSI=%ddBm\n",WiFi.localIP().toString().c_str(),WiFi.RSSI());
  // Wait for a fresh sample: a plausible RTC clock can still have drifted by minutes.
  int64_t beforeSync=epoch();
  sntp_set_sync_status(SNTP_SYNC_STATUS_RESET);
  configTime(0,0,"time.cloudflare.com","pool.ntp.org");
  t=millis(); bool synced=false;
  while(millis()-t<cfg::NTP_TIMEOUT_MS) {
    if(sntp_get_sync_status()==SNTP_SYNC_STATUS_COMPLETED) { synced=true; break; }
    delay(20);
  }
  if(synced && llabs(epoch()-beforeSync)>60) nextHeartbeat=epoch()+cfg::HEARTBEAT_S;
  Serial.printf("NTP %s; clock %s\n",synced?"synced":"FAILED",validClock()?"valid":"invalid");
  return synced && validClock(); // Certificate validity and signed send time need current time.
}
bool uploadOneBatch() {
  uint16_t n=std::min(count,cfg::BATCH_SIZE);
  DynamicJsonDocument doc(8192);
  doc["v"]=1; doc["device_id"]=DEVICE_ID; doc["firmware"]=cfg::VERSION;
  doc["sent_at"]=epoch(); doc["rssi"]=WiFi.RSSI();
  doc["dropped_total"]=dropped; doc["storage_ok"]=storageOK;
  doc["sensor_ok"]=sensorOK; doc["rejected_total"]=rejected;
  JsonArray arr=doc.createNestedArray("events");
  for(int i=0;i<n;++i) {
    JsonObject o=arr.createNestedObject(); Event &e=events[i];
    o["seq"]=e.seq; o["type"]=names[e.kind];
    if(e.timestamp) o["timestamp"]=e.timestamp; else o["timestamp"]=nullptr;
    if(e.distance!=255) o["distance_raw"]=e.distance; else o["distance_raw"]=nullptr;
    if(e.kind==LIGHTNING_EVENT) o["energy"]=e.energy; else o["energy"]=nullptr;
    o["battery_mv"]=e.battery;
  }
  if(doc.overflowed()) return false;
  String body; serializeJson(doc,body);
  WiFiClientSecure client; client.setCACert(TLS_CA_CERT); client.setHandshakeTimeout(5);
  HTTPClient http; http.setConnectTimeout(cfg::HTTP_TIMEOUT_MS); http.setTimeout(cfg::HTTP_TIMEOUT_MS);
  if(!http.begin(client,String(API_BASE_URL)+"/api/events")) return false;
  http.addHeader("Content-Type","application/json"); http.addHeader("X-Device-Id",DEVICE_ID);
  http.addHeader("X-Signature",sign(body));
  int status=http.POST(body);
  String response=status==200?http.getString():"";
  http.end();
  StaticJsonDocument<2048> ack;
  if(status!=200 || deserializeJson(ack,response)) { Serial.printf("Upload failed: %d\n",status); return false; }
  JsonArray accepted=ack["accepted"].as<JsonArray>();
  // Only remove the exact IDs acknowledged by the authenticated HTTPS endpoint.
  for(int i=0;i<n;++i) {
    bool found=false;
    for(JsonVariant id:accepted) if(id.as<uint32_t>()==events[i].seq) found=true;
    if(!found) return false;
  }
  memmove(events,events+n,(count-n)*sizeof(Event)); count-=n;
  if(!saveQueue()) { storageOK=false; return false; }
  Serial.printf("Upload OK: %u records acknowledged; queue %u\n",n,count);
  return true;
}
void sleepNow(uint32_t seconds, bool allowIRQ) {
  WiFi.disconnect(true); WiFi.mode(WIFI_OFF);
  digitalWrite(LED_BUILTIN,LOW);
  digitalWrite(NEOPIXEL_I2C_POWER,LOW);
  // SparkFun onboard R8 (10k) holds CS inactive; external 100k pulls SCK/MOSI low.
  SPI.end(); pinMode(cfg::CS,INPUT); pinMode(SCK,INPUT); pinMode(MOSI,INPUT); pinMode(MISO,INPUT);
  esp_sleep_disable_wakeup_source(ESP_SLEEP_WAKEUP_ALL);
  esp_sleep_enable_timer_wakeup(static_cast<uint64_t>(seconds)*1000000ULL);
  if(allowIRQ) {
    rtc_gpio_pullup_dis(GPIO_NUM_33); rtc_gpio_pulldown_en(GPIO_NUM_33);
    esp_sleep_enable_ext0_wakeup(GPIO_NUM_33,1);
  }
  Serial.printf("Sleep %us, IRQ %s, queue %u, dropped %u\n",seconds,allowIRQ?"enabled":"disabled",count,dropped);
  Serial.flush(); esp_deep_sleep_start();
}
#ifdef TUNE_MODE
void tuneAntenna() {
  Serial.println("TUNING ONLY: no detection/sleep/network; sweep 0..120pF.");
  sensor.changeDivRatio(16);
  for(uint8_t pf=0;pf<=120;pf+=8) {
    sensor.tuneCap(pf); sensor.displayOscillator(true,3); delay(20);
    uint32_t t=micros(), edges=0; int prev=digitalRead(cfg::IRQ);
    while(micros()-t<200000) { int cur=digitalRead(cfg::IRQ); if(cur && !prev) ++edges; prev=cur; }
    sensor.displayOscillator(false,3);
    Serial.printf("%3u pF: approximate LCO %lu Hz (confirm with frequency counter)\n",pf,edges*80UL);
  }
  Serial.println("Set config.h TUNING_PF; rebuild feather. Target 500kHz +/-3.5%.");
}
#endif
void setup() {
  started=millis();
  rtc_gpio_deinit(GPIO_NUM_33); pinMode(cfg::IRQ,INPUT_PULLDOWN);
  pinMode(NEOPIXEL_I2C_POWER,OUTPUT); digitalWrite(NEOPIXEL_I2C_POWER,LOW);
  pinMode(LED_BUILTIN,OUTPUT); digitalWrite(LED_BUILTIN,LOW);
  SPI.begin(SCK,MISO,MOSI,cfg::CS); sensor.beginSPI(cfg::CS,cfg::SPI_HZ,SPI);
  // Only capture before configuration when a previous successful setup survived sleep.
  // An absent sensor's floating SPI input must never manufacture observations.
  Event early{}; bool hadEarly=configured && readPending(early);
  Serial.begin(115200);
  bool cold=magic!=0x4C445231 || esp_sleep_get_wakeup_cause()==ESP_SLEEP_WAKEUP_UNDEFINED;
  if(cold) { magic=0x4C445231; configured=false; nextHeartbeat=nextUpload=0; rejected=0; fastNoiseWakes=0; nextSeq=seqEnd=0; }
  sensorOK=configured;
  if(!configured) { sensorOK=configureSensor(); configured=sensorOK; }
  else { sensorOK=sensor.readIndoorOutdoor()==OUTDOOR; if(!sensorOK) { sensorOK=configureSensor(); configured=sensorOK; } }
  Serial.printf("Lightning detector %s; Sensor %s; wake=%d; heap=%u\n",cfg::VERSION,sensorOK?"OK":"FAULT (check sensor wiring)",esp_sleep_get_wakeup_cause(),ESP.getFreeHeap());
#ifdef TUNE_MODE
  tuneAntenna(); return;
#endif
#ifdef BENCH_MODE
  Serial.printf("Sensor %s. Listening; IRQ events printed, Wi-Fi/sleep/queue disabled.\n",sensorOK?"OK":"FAULT");
  if(hadEarly) Serial.printf("%s raw=%u energy=%lu\n",names[early.kind],early.distance,early.energy);
  return;
#endif
  storageOK=LittleFS.begin(false); // NEVER silently format a failed queue.
  if(!storageOK) Serial.println("LittleFS mount failed. See commissioning guide for initial format.");
  else Serial.println("LittleFS mounted OK.");
  if(!prefs.begin("lightning",false)) storageOK=false;
  if(storageOK) loadQueue();
  if(hadEarly && sensorOK && storageOK) append(early);
  if((cold || epoch()>=nextHeartbeat || !sensorOK) && storageOK) {
    append(capture(sensorOK?HEARTBEAT:SENSOR_FAULT));
    nextHeartbeat=epoch()+cfg::HEARTBEAT_S;
  }
  // Drain a bounded number of events. Persistent noise is not a lightning count.
  for(int i=0;i<3 && sensorOK;++i) { Event e{}; if(!readPending(e)) break; if(storageOK) append(e); }
  bool noisy=hadEarly && sensorOK && early.kind==NOISE_EVENT;
  if(noisy) {
    if(lastNoiseWake && epoch()-lastNoiseWake<10) ++fastNoiseWakes; else fastNoiseWakes=1;
    lastNoiseWake=epoch();
  } else fastNoiseWakes=0;
  uint16_t battery=batteryMV();
  Serial.printf("Battery ADC=%umV; storage=%s; queue=%u\n",battery,storageOK?"OK":"FAULT",count);
  if(count && battery>cfg::LOW_BATTERY_MV && epoch()>=nextUpload) {
    bool success=false;
    if(connectNetwork()) {
      // First NTP sync cannot turn previously untimed records into precise detections.
      if(!validClock() || nextHeartbeat<1767225600) nextHeartbeat=epoch()+cfg::HEARTBEAT_S;
      while(count && millis()-started<cfg::MAX_AWAKE_MS) {
        if(!uploadOneBatch()) { success=false; break; } success=true;
        Event e{}; if(sensorOK && readPending(e) && storageOK) append(e);
      }
    }
    nextUpload=epoch()+(success?cfg::MIN_UPLOAD_S:cfg::RETRY_S);
  }
  WiFi.disconnect(true); WiFi.mode(WIFI_OFF); delay(20);
  Event late{}; if(sensorOK && readPending(late) && storageOK) append(late);
  bool backoff=digitalRead(cfg::IRQ)==HIGH || fastNoiseWakes>=3 || !sensorOK;
  uint32_t wait=cfg::HEARTBEAT_S;
  int64_t now=epoch();
  if(nextHeartbeat>now) wait=std::min(wait,static_cast<uint32_t>(nextHeartbeat-now));
  else wait=1;
  if(count) wait=std::min(wait,static_cast<uint32_t>(std::max<int64_t>(1,nextUpload-now)));
  if(battery<=cfg::LOW_BATTERY_MV) wait=cfg::HEARTBEAT_S;
  if(backoff) wait=cfg::NOISE_BACKOFF_S;
  sleepNow(wait,!backoff);
}
void loop() {
#ifdef BENCH_MODE
  Event e{};
  if(sensorOK && readPending(e)) Serial.printf("%lld %s raw=%u energy=%lu battery=%umV\n",epoch(),names[e.kind],e.distance,e.energy,batteryMV());
  delay(2);
#else
  delay(1000);
#endif
}
