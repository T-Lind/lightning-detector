#pragma once
#include <Arduino.h>

namespace cfg {
constexpr int CS = 27, IRQ = 33;
constexpr uint32_t SPI_HZ = 1000000;
constexpr uint8_t NOISE = 2, WATCHDOG = 2, SPIKE = 2;
constexpr bool MASK_DISTURBERS = true; // Bench build overrides this for diagnosis.
constexpr uint8_t TUNING_PF = 0; // Placeholder: measure your sensor; 0..120 pF in 8 pF steps.
constexpr uint32_t HEARTBEAT_S = 6 * 3600;
constexpr uint32_t RETRY_S = 15 * 60;
constexpr uint32_t NOISE_BACKOFF_S = 60;
constexpr uint32_t MIN_UPLOAD_S = 30; // Limit storm Wi-Fi energy.
constexpr uint32_t WIFI_TIMEOUT_MS = 8000, HTTP_TIMEOUT_MS = 5000;
constexpr uint32_t NTP_TIMEOUT_MS = 8000; // lwIP randomizes startup by up to 5s.
constexpr uint32_t MAX_AWAKE_MS = 25000;
constexpr uint16_t QUEUE_CAPACITY = 128, BATCH_SIZE = 16;
constexpr uint16_t LOW_BATTERY_MV = 3400;
constexpr float BATTERY_CAL = 1.0f; // Adjust against a multimeter.
constexpr char VERSION[] = "1.0.3";
}
