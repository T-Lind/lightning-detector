#pragma once
#include <stdint.h>

enum class SensorInterrupt : uint8_t { RangeUpdate, Noise, Disturber, Lightning, Unknown };

// Only these four codes are documented by the AS3935. A reserved/invalid code
// must not fall through to a plausible-looking range update or lightning event.
constexpr SensorInterrupt classifyInterrupt(uint8_t reason) {
  return reason == 0 ? SensorInterrupt::RangeUpdate
    : reason == 1 ? SensorInterrupt::Noise
    : reason == 4 ? SensorInterrupt::Disturber
    : reason == 8 ? SensorInterrupt::Lightning : SensorInterrupt::Unknown;
}
