#include <Arduino.h>
#include <WiFi.h>
#include <LittleFS.h>
#include <Preferences.h>
#include <esp_sleep.h>
#include <esp_heap_caps.h>
#include <initializer_list>
#if __has_include("secrets.h")
#include "secrets.h"
#endif

// Temporary bare-board checks. This image never publishes synthetic observations.
RTC_DATA_ATTR uint32_t checkMagic = 0;
RTC_DATA_ATTR uint32_t failures = 0;
void result(const char* name, bool ok) {
  Serial.printf("CHECK %s: %s\n", name, ok ? "PASS" : "FAIL");
  if (!ok) ++failures;
}
bool memoryTest(uint32_t caps, size_t bytes) {
  auto p = static_cast<uint32_t*>(heap_caps_malloc(bytes, caps));
  if (!p) return false;
  bool ok = true;
  for (uint32_t pattern : {0xAAAAAAAAu, 0x55555555u, 0x12345678u}) {
    for (size_t i = 0; i < bytes / 4; ++i) p[i] = pattern ^ i;
    for (size_t i = 0; i < bytes / 4; ++i) if (p[i] != (pattern ^ i)) { ok = false; break; }
  }
  heap_caps_free(p);
  return ok;
}
void setup() {
  Serial.begin(115200); delay(500);
  pinMode(LED_BUILTIN, OUTPUT); digitalWrite(LED_BUILTIN, LOW);
  pinMode(NEOPIXEL_I2C_POWER, OUTPUT); digitalWrite(NEOPIXEL_I2C_POWER, LOW);
  if (checkMagic == 0xB04DC0DE && esp_sleep_get_wakeup_cause() == ESP_SLEEP_WAKEUP_TIMER) {
    result("deep_sleep_timer_wake", true);
    Preferences probe;
    bool ok = probe.begin("boardcheck", false);
    if (ok) { ok = probe.getUInt("probe") == 0x13579BDF; probe.remove("probe"); probe.end(); }
    result("NVS_survives_sleep", ok);
    checkMagic = 0;
    Serial.printf("BOARD_CHECK_COMPLETE failures=%u\n", failures);
    return;
  }
  failures = 0;
  Serial.printf("BOARD_CHECK_BEGIN chip=%s revision=%u cores=%u cpu=%uMHz flash=%u psram=%u heap=%u\n",
    ESP.getChipModel(), ESP.getChipRevision(), ESP.getChipCores(), ESP.getCpuFreqMHz(),
    ESP.getFlashChipSize(), ESP.getPsramSize(), ESP.getFreeHeap());
  result("Feather_V2_flash_8MiB", ESP.getFlashChipSize() == 8 * 1024 * 1024);
  // Arduino reports usable heap size; allocator metadata reserves a few KiB.
  result("PSRAM_2MiB_usable", ESP.getPsramSize() >= 2 * 1024 * 1024 - 8192);
  result("PSRAM_1MiB_three_patterns", memoryTest(MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT, 1024 * 1024));
  result("internal_RAM_64KiB_three_patterns", memoryTest(MALLOC_CAP_INTERNAL | MALLOC_CAP_8BIT, 64 * 1024));
  result("heap_integrity", heap_caps_check_integrity_all(true));
  Preferences probe;
  bool ok = probe.begin("boardcheck", false);
  if (ok) { ok = probe.putUInt("probe", 0x13579BDF) == 4 && probe.getUInt("probe") == 0x13579BDF; probe.end(); }
  result("NVS_write_read", ok);
  ok = LittleFS.begin(false);
  result("LittleFS_mount", ok);
  if (ok) {
    const char* path = "/boardcheck.tmp";
    bool fileOK = !LittleFS.exists(path);
    if (fileOK) {
      File f = LittleFS.open(path, "w");
      fileOK = bool(f);
      for (uint16_t i = 0; i < 1024 && fileOK; ++i) fileOK = f.write(uint8_t(i ^ 0xA5)) == 1;
      f.flush(); f.close();
      f = LittleFS.open(path, "r"); fileOK = fileOK && f && f.size() == 1024;
      for (uint16_t i = 0; i < 1024 && fileOK; ++i) fileOK = f.read() == uint8_t(i ^ 0xA5);
      f.close(); fileOK = LittleFS.remove(path) && fileOK;
    }
    result("LittleFS_write_read_delete_1KiB", fileOK);
    LittleFS.end();
  }
  WiFi.persistent(false); WiFi.mode(WIFI_STA);
  int networks = WiFi.scanNetworks();
  result("WiFi_radio_scan", networks > 0);
  Serial.printf("WiFi scan: %d nearby 2.4GHz networks\n", networks);
  for (int i = 0; i < networks; ++i) Serial.printf("  SSID=%s channel=%d RSSI=%ddBm auth=%d\n",
    WiFi.SSID(i).c_str(), WiFi.channel(i), WiFi.RSSI(i), WiFi.encryptionType(i));
  WiFi.scanDelete();
#ifdef WIFI_SSID
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  uint32_t start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 20000) delay(100);
  result("saved_WiFi_association", WiFi.status() == WL_CONNECTED);
  Serial.printf("WiFi status=%d\n", WiFi.status());
  if (WiFi.status() == WL_CONNECTED) Serial.printf("WiFi connected: IP=%s RSSI=%ddBm\n", WiFi.localIP().toString().c_str(), WiFi.RSSI());
#endif
  WiFi.disconnect(true); WiFi.mode(WIFI_OFF);
  checkMagic = 0xB04DC0DE;
  Serial.println("Entering 3-second timer sleep..."); Serial.flush();
  esp_sleep_enable_timer_wakeup(3000000ULL); esp_deep_sleep_start();
}
void loop() {
  digitalWrite(LED_BUILTIN, HIGH); delay(100); digitalWrite(LED_BUILTIN, LOW); delay(1900);
  static uint32_t previous = 0;
  if (millis() - previous >= 10000) {
    previous = millis(); Serial.printf("BOARD_CHECK_ALIVE uptime=%us heap=%u failures=%u\n", millis() / 1000, ESP.getFreeHeap(), failures);
  }
}
