#include <cassert>
#include "interrupt_reason.h"

int main() {
  assert(classifyInterrupt(0) == SensorInterrupt::RangeUpdate);
  assert(classifyInterrupt(1) == SensorInterrupt::Noise);
  assert(classifyInterrupt(4) == SensorInterrupt::Disturber);
  assert(classifyInterrupt(8) == SensorInterrupt::Lightning);
  // Exhaustive invalid/reserved-code check: none may become an observation.
  for (unsigned reason = 0; reason < 256; ++reason) {
    if (reason == 0 || reason == 1 || reason == 4 || reason == 8) continue;
    assert(classifyInterrupt(static_cast<uint8_t>(reason)) == SensorInterrupt::Unknown);
  }
}
