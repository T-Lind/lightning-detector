# Commissioning / acceptance record

Record the actual delivered part revisions and measurements here or in a separate build log. Unchecked items remain unverified. Passing software tests is not proof of RF sensitivity, sealing, battery life or electrical assembly.

## Bench electrical acceptance

- [ ] Correct Feather V2, SEN-15441 SPI board, 1554R2GY box and vent with nut received.
- [ ] Battery dimensions and current supplier temperature/use limits obtained. Pack polarity matches Feather.
- [ ] GND/3V continuity correct; no shorts or pad bridges; input resistors verified.
- [ ] USB-only power produces about 3.3V at sensor; sensor remains powered with switched rail disabled.
- [ ] Bench firmware reports correct settings and successful oscillator calibration.
- [ ] IRQ captures a classified result before slow operations; reason zero is recorded as range change.
- [ ] LED jumper cut only after initial tests; sensor still works afterward.

## Antenna / mechanical acceptance

- [ ] Actual board holes fit carrier without force, bending or component contact.
- [ ] Sensor ferrite axis horizontal in final vertical mounting; its antenna area clear.
- [ ] LCO frequency measured in final arrangement: ______ Hz, divided by 16: ______ Hz.
- [ ] Selected capacitance: ______ pF; resonance within 482.5–517.5kHz.
- [ ] Battery and cable fit within reserved volume, no sharp screw beneath pouch.
- [ ] Strap releases easily and does not compress battery; protection board/lead not strained.
- [ ] USB cable insertion/removal works with lid off; antenna zones have no wire/metal overlay.
- [ ] Floor supports do not sit on molded ribs; carrier remains secure with light movement.
- [ ] Component-to-lid clearance at least 5mm; measured minimum: ______ mm.
- [ ] Vent wall thickness ______ mm is within 2.0–3.5mm; hole is 12.2 ±0.1mm; seal/nut fitted correctly.
- [ ] Vent nut/body and harness have clearance; gasket stays clean and unpinched.
- [ ] Empty-box spray/temperature-cycle check shows no internal moisture; electronics assembled fully dry.

## Firmware / network acceptance

- [ ] LittleFS initialized once; normal firmware mounts without formatting.
- [ ] Real device and read secrets differ from each other and from dummy test keys.
- [ ] Correct Worker URL / ID / TLS root installed; malformed CA makes upload fail, never insecure fallback.
- [ ] Initial heartbeat accepted; private dashboard rejects unauthenticated reads.
- [ ] IRQ wake works from battery-powered deep sleep.
- [ ] **Wake-only test:** with sensor INT disconnected from D33, connect D33 to 3V through a 10k test resistor briefly while asleep. Confirm wake; remove this test wiring and restore INT. Never drive a connected sensor output against 3V.
- [ ] Real sensor/classifier test completed independently; the wake-only test above does not validate AS3935 detection.
- [ ] After a captured event, repeated boot/upload is not caused by an uncleared IRQ.
- [ ] Continuous/noisy IRQ condition enters timer backoff and later recovers. Document any lost capture interval.
- [ ] Disconnect access point/Internet, capture observations, reconnect; queued events return without duplicates.
- [ ] Old queued events keep old detection times and do not activate a new storm.
- [ ] Power-cycle with a pending queue: previous committed records remain; sequence values do not repeat.
- [ ] Push/browser notifications checked if enabled. Synthetic tests isolated from actual history.

## Battery / field acceptance

- [ ] ADC compared with meter: meter ______ V; dashboard ______ V; BATTERY_CAL ______.
- [ ] Sleep measured **without USB**, full node listening/wake enabled: ______ mA.
- [ ] Sleep ≤0.25mA target; >0.5mA investigated. Actual differs from nominal datasheet floor.
- [ ] Successful wake/upload charge measured across 20 cycles: mean ______ mAh, worst ______ mAh.
- [ ] Failed-network wake charge measured: mean ______ mAh; 15-minute retry spacing confirmed.
- [ ] Field RSSI ______ dBm; reliable association in final case (aim better than ~−75dBm).
- [ ] 24-hour quiet baseline logged away from noisy electronics; spurious events evaluated.
- [ ] At least one real storm compared with independent weather/lightning observations, from safe shelter.
- [ ] First week outside: no moisture, loose wiring, pouch damage or excessive enclosure temperature.
- [ ] Recalculate actual service interval using [power.md](power.md), then set a conservative recharge inspection schedule.

## Release decision

Bench prototype accepted by: ______ date: ______.

Inspected mild-weather outdoor trial accepted by: ______ date: ______.

Permanent/year-round unattended deployment remains a separate qualification: temperature-rated battery selection, field thermal tests, charging controls if solar is added, environmental validation and an appropriate maintenance policy. No checked box here turns this into a certified lightning warning system.
