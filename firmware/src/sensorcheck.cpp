// USB commissioning only. No cloud writes, NVS writes, or queue access.
// Temporarily routes the real antenna oscillator onto INT to test the harness
// and RTC wake path. Always restore the normal feather firmware afterward.
#include <Arduino.h>
#include <SPI.h>
#include <SparkFun_AS3935.h>
#include <driver/pcnt.h>
#include <driver/rtc_io.h>
#include <esp_sleep.h>
#include <esp_timer.h>
#include <math.h>
#include "config.h"

SparkFun_AS3935 sensor;
RTC_DATA_ATTR uint32_t checkMagic = 0;
RTC_DATA_ATTR bool awaitingWake = false;
RTC_DATA_ATTR bool checksPassed = false;

bool check(const char* label, bool passed) {
  Serial.printf("%s: %s\n", passed ? "PASS" : "FAIL", label);
  return passed;
}

bool configure() {
  sensor.setIndoorOutdoor(OUTDOOR);
  sensor.setNoiseLevel(cfg::NOISE);
  sensor.watchdogThreshold(cfg::WATCHDOG);
  sensor.spikeRejection(cfg::SPIKE);
  sensor.lightningThreshold(1);
  sensor.maskDisturber(cfg::MASK_DISTURBERS);
  sensor.tuneCap(cfg::TUNING_PF);
  bool ok = sensor.calibrateOsc();
  const auto outdoor = sensor.readIndoorOutdoor(), noise = sensor.readNoiseLevel();
  const auto watchdog = sensor.readWatchdogThreshold(), spike = sensor.readSpikeRejection();
  const auto threshold = sensor.readLightningThreshold(), mask = sensor.readMaskDisturber();
  const auto capacitance = sensor.readTuneCap();
  Serial.printf("Readback: outdoor=%u noise=%u watchdog=%u spike=%u lightning=%u mask=%u capacitance=%upF\n",
    outdoor, noise, watchdog, spike, threshold, mask, capacitance);
  return ok && outdoor == OUTDOOR && noise == cfg::NOISE && watchdog == cfg::WATCHDOG &&
    spike == cfg::SPIKE && threshold == 1 && !!mask == cfg::MASK_DISTURBERS && capacitance == cfg::TUNING_PF;
}

double antennaHz() {
  // Hardware pulse counting avoids the polling approximation in the tune build.
  // 250 ms gates remain below the signed 16-bit counter limit at LCO/16.
  int64_t totalTime = 0; int32_t totalEdges = 0;
  for (int gate = 0; gate < 4; ++gate) {
    if (pcnt_counter_clear(PCNT_UNIT_0) != ESP_OK) return 0;
    const int64_t start = esp_timer_get_time();
    if (pcnt_counter_resume(PCNT_UNIT_0) != ESP_OK) return 0;
    delay(250);
    if (pcnt_counter_pause(PCNT_UNIT_0) != ESP_OK) return 0;
    const int64_t elapsed = esp_timer_get_time() - start;
    int16_t edges = 0;
    if (pcnt_get_counter_value(PCNT_UNIT_0, &edges) != ESP_OK || edges <= 0 || edges >= 30000) return 0;
    totalEdges += edges; totalTime += elapsed;
  }
  return totalEdges * 16000000.0 / totalTime;
}

void setup() {
  const auto wake = esp_sleep_get_wakeup_cause();
  rtc_gpio_deinit(GPIO_NUM_33); pinMode(cfg::IRQ, INPUT_PULLDOWN);
  pinMode(NEOPIXEL_I2C_POWER, OUTPUT); digitalWrite(NEOPIXEL_I2C_POWER, LOW);
  pinMode(LED_BUILTIN, OUTPUT); digitalWrite(LED_BUILTIN, LOW);
  Serial.begin(115200); delay(300);
  SPI.begin(SCK, MISO, MOSI, cfg::CS);
  sensor.beginSPI(cfg::CS, cfg::SPI_HZ, SPI);

  if (checkMagic == 0x53434B31 && awaitingWake && wake != ESP_SLEEP_WAKEUP_UNDEFINED) {
    // Turn oscillator display off before any detector interrupt handling.
    sensor.displayOscillator(false, 3);
    awaitingWake = false;
    Serial.printf("Sensorcheck resumed: wake=%d\n", wake);
    checksPassed = check("Sensor INT -> GPIO33 deep-sleep wake (oscillator stimulus, not a lightning event)", wake == ESP_SLEEP_WAKEUP_EXT0) && checksPassed;
    checksPassed = check("Normal detector settings and RC calibration restored", configure()) && checksPassed;
    delay(10);
    if (digitalRead(cfg::IRQ) == HIGH) { delay(3); sensor.readInterruptReg(); delay(10); }
    checksPassed = check("INT not stuck high after oscillator display disabled", digitalRead(cfg::IRQ) == LOW) && checksPassed;
    Serial.printf("SENSORCHECK %s. Restore normal feather firmware. No test records uploaded.\n", checksPassed ? "PASS" : "FAIL");
    return;
  }

  checkMagic = 0x53434B31; awaitingWake = false;
  Serial.println("SENSORCHECK: settings, hardware pulse count, RTC interrupt wake. No network/storage writes.");
  checksPassed = check("SPI register readback and internal RC oscillator calibration", configure());
  if (!checksPassed) { Serial.println("SENSORCHECK FAIL: cannot verify sensor. Restore normal firmware."); return; }

  pcnt_config_t counter{};
  counter.pulse_gpio_num = cfg::IRQ; counter.ctrl_gpio_num = PCNT_PIN_NOT_USED;
  counter.lctrl_mode = PCNT_MODE_KEEP; counter.hctrl_mode = PCNT_MODE_KEEP;
  counter.pos_mode = PCNT_COUNT_INC; counter.neg_mode = PCNT_COUNT_DIS;
  counter.counter_h_lim = 32767; counter.counter_l_lim = -32768;
  counter.unit = PCNT_UNIT_0; counter.channel = PCNT_CHANNEL_0;
  bool counterOK = pcnt_unit_config(&counter) == ESP_OK;
  if (counterOK) counterOK = pcnt_filter_disable(PCNT_UNIT_0) == ESP_OK && pcnt_counter_pause(PCNT_UNIT_0) == ESP_OK;
  if (!check("ESP32 hardware pulse counter ready", counterOK)) return;
  sensor.changeDivRatio(16);
  checksPassed = check("LCO divider readback /16", sensor.readDivRatio() == 16) && checksPassed;

  double bestHz = 0, bestError = 1e9, configuredHz = 0;
  uint8_t bestCap = 0;
  for (uint8_t cap = 0; cap <= 120; cap += 8) {
    sensor.tuneCap(cap);
    checksPassed = (sensor.readTuneCap() == cap) && checksPassed;
    sensor.displayOscillator(true, 3); delay(20);
    const double hz = antennaHz();
    sensor.displayOscillator(false, 3);
    Serial.printf("LCO cap=%upF frequency=%.0fHz error=%+.3f%%\n", cap, hz, (hz - 500000) / 5000);
    if (cap == cfg::TUNING_PF) configuredHz = hz;
    if (hz > 0 && fabs(hz - 500000) < bestError) { bestError = fabs(hz - 500000); bestHz = hz; bestCap = cap; }
  }
  Serial.printf("Best bench candidate: %upF %.0fHz; current %upF %.0fHz\n", bestCap, bestHz, cfg::TUNING_PF, configuredHz);
  checksPassed = check("Sensor oscillator reaches GPIO33 through INT harness", bestHz > 0) && checksPassed;
  checksPassed = check("Configured antenna frequency within 500kHz +/-3.5%", configuredHz >= 482500 && configuredHz <= 517500) && checksPassed;
  checksPassed = check("At least one available tuning setting within tolerance", bestHz >= 482500 && bestHz <= 517500) && checksPassed;
  sensor.tuneCap(cfg::TUNING_PF);
  if (bestHz <= 0) { Serial.println("SENSORCHECK FAIL: no INT pulse train. Restore normal firmware."); return; }

  // A genuine sensor-generated digital signal exercises the existing interrupt
  // harness and MCU sleep input. It does not validate lightning classification.
  pcnt_counter_pause(PCNT_UNIT_0);
  sensor.displayOscillator(true, 3); delay(20);
  awaitingWake = true;
  esp_sleep_disable_wakeup_source(ESP_SLEEP_WAKEUP_ALL);
  esp_sleep_enable_timer_wakeup(2000000ULL); // Timeout is a failed IRQ test.
  rtc_gpio_pullup_dis(GPIO_NUM_33); rtc_gpio_pulldown_en(GPIO_NUM_33);
  esp_sleep_enable_ext0_wakeup(GPIO_NUM_33, 1);
  Serial.println("Entering deep sleep with sensor LCO on INT; expect EXT0 wake.");
  Serial.flush(); esp_deep_sleep_start();
}

void loop() { delay(1000); }
