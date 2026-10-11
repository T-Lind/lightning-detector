# Low power sensor expansion

Planning note reviewed **11 October 2026** for the Feather ESP32 V2 / SparkFun AS3935 station. These additions are **proposed, not implemented or physically validated**. The deployed lightning firmware and dashboard do not yet support them.

[Download the printable three-page overview](sensor-expansion.pdf).

## Recommended starting point

Start with an **SHT40 inside the enclosure** for temperature and humidity that help assess enclosure conditions. Add a **MAX17048 battery gauge** if a better charge estimate is the priority. A **BMP390 pressure sensor** is a reasonable next weather measurement, provided the existing pressure vent can equalize the case adequately. None of these needs a new external opening for the sensing element.

For actual outdoor air temperature and humidity, use a separate protected probe with airflow and a radiation shield. The sealed electronics box is the wrong measurement environment. Keep this as a later mechanical and electrical design step rather than drilling casual ventilation holes.

## Candidate sensors

| Addition | Useful reading | Enclosure and power approach |
| --- | --- | --- |
| **SHT40 temperature/humidity** | Internal temperature and relative humidity; trends that may suggest dampness or enclosure heating. It cannot certify that the box is dry or detect every leak. | Mount inside, away from the Feather, regulator, battery and desiccant. Take a single measurement before Wi-Fi starts; use the switched I2C supply or the chip's low-current idle mode. Label readings **inside enclosure**. |
| **MAX17048 fuel gauge** | Battery voltage and model-based state of charge, generally more useful than a generic voltage-to-percent lookup. It is still an estimate, not guaranteed runtime or a charger safety controller. | Battery-connected gauge plus I2C communication; no case hole. Keep the gauge supplied from the battery between reads. Review the exact breakout's LED, pull-ups and bus power behavior. |
| **BMP390 pressure** | Station pressure and slow trends. Sea-level pressure needs a documented altitude correction; pressure alone is not a storm warning. | Can stay inside if the pressure vent is unobstructed and equalization is verified. Use forced single measurements and sleep or switched power. Its internal temperature is primarily for pressure compensation. |
| **External temperature/humidity probe** | Ambient weather measurements rather than conditions in the box. | Protected sensor head with airflow and a radiation shield; correctly sized sealed cable gland, strain relief and a drip loop. Short cable or a suitable external interface; do not assume long outdoor I2C wiring will work. |
| **Optional internal leak contact** | Water that reaches a particular point on the case floor. | Intermittent sensing can limit consumption and electrode corrosion. Requires a defined contact design and wet/dry tests. Humidity and leak contacts complement each other; neither guarantees protection. |

SHT40, BMP390 and MAX17048 characteristics are supported by their manufacturer datasheets [1-3]. Mounting, priorities and sampling schedules here are project recommendations, not validated add-on schematics.

An ambient-light/UV sensor needs a suitable sealed optical window or an external head; the opaque case blocks the measurement. Wind and tipping-bucket rain instruments can use low-current contacts, but need outdoor hardware, protected cable entries and reliable event counting during sleep. Frequent contact wakes can dominate their power cost. Heated gas sensors, fan-based particulate sensing, continuously active positioning and always-lit displays deserve a separate power budget rather than assuming they fit this station's low-power design.

## What the seal and vent change

The box is weather-sealed but its hydrophobic pressure vent passes air [5]. That makes internal barometric sensing plausible; it does **not** turn the box into a well-ventilated weather screen. Verify response against a nearby reference: an obstructed or wet vent can delay equalization, and a completely airtight case can report pressure changes caused by its own temperature.

Internal humidity is influenced by desiccant, trapped air, case temperature and slow exchange. A dry reading near the silica packet can conceal dampness elsewhere. Put the sensor in representative internal air and watch trends. Internal dew point can be calculated, but condensation on colder surfaces can still occur without the sensor seeing those surface temperatures. Sensirion's design guide emphasizes airflow and separation from heat sources for ambient measurements [6].

Keep the vent unobstructed. Do not repurpose its opening for a cable, clamp wires under the lid gasket or rely on glue alone as a cable seal. New penetrations need suitable gland dimensions, a smooth sealing surface and empty-box leak testing. A rated gland or vent does not certify the modified assembly waterproof. Keep probe cables short, away from the AS3935 ferrite and away from long exposed runs; outdoor conductors add surge/ESD and interference concerns that require design review.

## Electrical integration

The current AS3935 uses **SPI**, with CS on **27** and interrupt wake on **33**. Preserve those signals and the existing sensor's **main 3V supply**, which stays on in deep sleep. Additional I2C sensors can use the Feather V2's **SDA/SCL labels or Arduino board constants**, independent of that SPI harness. Do not substitute pin numbers from another ESP32 Feather model.

The Feather V2 has a switched STEMMA QT supply controlled by `NEOPIXEL_I2C_POWER` [4]. The current firmware holds it **LOW**, including at startup, so plugging in a QT sensor alone will not make it work. A future driver must enable it, wait for each device's specified startup time, configure and read the sensors, then disable it before sleeping. This supply also powers the NeoPixel; keep it dark.

| Circuit | Power policy |
| --- | --- |
| AS3935 lightning sensor | Main 3V, continuously powered; interrupt still wakes the ESP32. |
| SHT40 / BMP390 telemetry | Switched QT supply is a candidate; alternatively use verified low-current sleep on main 3V. Compare complete-board energy. |
| MAX17048 gauge | Gauge chip stays connected to the battery. Its I2C logic supply/pull-ups need a compatible plan with any switched peripherals. |
| I2C bus | Short wires, common ground, correct 3.3 V logic, compatible addresses and reviewed pull-ups. |

For the Adafruit MAX17048 board specifically, the two JST ports connect battery and load/charger in parallel; one can take the battery and the other a correctly polarized lead to the Feather. The gauge is powered by that battery, **not** its QT/VIN connection. I2C still needs to be connected. This board also has a green power LED and an LED jumper [7]. These details are not a universal wiring diagram for other vendors' gauge boards.

Audit pull-ups and level shifters before mixing always-powered and switched devices. An always-high SDA/SCL line can feed an unpowered sensor through its protection structures; for BMP390, Bosch explicitly warns against high interface levels when its interface supply is off [2]. Use a coherent bus power domain or suitable isolation, release ESP32 pins before power-down and verify leakage. Parallel breakout pull-ups also change the bus resistance. Check exact sensor addresses; two identical fixed-address boards may need another bus or multiplexer. Test missing-sensor and stuck-bus recovery with bounded timeouts.

## Keep the radio schedule inexpensive

**First version:** sample at the existing six-hour check-ins and, if useful, an already-required upload wake. Include telemetry in that upload. Avoid adding separate network connections for each sensor. A six-hour internal reading is useful for slow enclosure trends, but cannot provide prompt leak or temperature alarms.

**Optional weather logging:** a proposed 15-60 minute sampling interval can collect local history with Wi-Fi off, then upload it in a batch at the normal heartbeat. Each timer wake still costs ESP32 boot and measurement energy. Increasing uploads to every 15 minutes changes quiet traffic from **4 to 96 sessions/day**, a 24-fold increase in session count, not necessarily a 24-fold increase in total energy. Current firmware does not implement independent telemetry sampling or batching.

Do not read all add-ons on every noise interrupt or delay the existing lightning capture path with long sensor conversions. Capture pending lightning first; schedule optional readings deliberately. Keep heater functions off for routine humidity measurements, use single measurements instead of continuous acquisition and avoid unnecessary flash writes. On optional sensor failure, record the fault and continue lightning operation. A new always-on leak alert would require an explicit wake policy and electrical design.

### Chip figures and illustrative system costs

| Item | Manufacturer figure or explicit example | Interpretation |
| --- | --- | --- |
| SHT4x, heater off [1] | SHT40 idle about **0.08 uA typical at 25 C**; about **320 uA during measurement**. | Brief conversions can be cheap. This excludes the breakout and ESP32 wake. |
| BMP390 [2] | Sleep about **1.4 uA typical at 1.8 V** / **1.5 uA at 3.6 V**; forced mode returns to sleep. | Do not confuse sleep, conversion peaks and continuously sampled averages. |
| MAX17048 [3] | About **3-4 uA in hibernate**, depending on reset-comparator configuration; **23 uA active typical**. | A battery-powered gauge adds persistent load. The breakout may add more; do not assume it always hibernates. |
| Added 10 uA at the battery | **0.24 mAh/day**. | Example arithmetic, not a predicted add-on current. |
| Added 0.2 mA at the battery | **4.8 mAh/day**. | A small-looking persistent load can matter substantially. |
| Extra upload at 150 mA for 5 s | **0.208 mAh/session**. | An illustrative radio transaction, not a measurement of this station. |

Use `extra mAh/day = added sleep mA x 24 + sample wakes/day x added mAh/sample + extra network sessions/day x mAh/session`. Terms must not double-count energy; use battery-side measurements that include regulators, pull-ups, LEDs, startup, conversions and shutdown. For the extra-upload example, 92 additional sessions consume about **19.2 mAh/day**. A chip's 3.3 V current is not automatically the same as current from the LiPo. Neither these examples nor nominal 3700 mAh capacity establish a new battery lifetime; see the [power measurement guide](power.md).

## Firmware cloud and dashboard work

The change spans the whole data path, not just a sensor library:

1. Add optional, bounded sensor drivers and a power/sampling schedule. Take temperature readings before radio heating and preserve the AS3935 wake behavior and low-voltage policy.
2. Define versioned telemetry records with units, sensor identity, **measurement time**, validity/fault flags and location labels such as `inside_enclosure` or `ambient_air`. Distinguish missing data from zero and last-known values from fresh values.
3. Extend the queue safely and give any stored-record format change an explicit migration. Keep lightning buffering capacity and sequence identity intact. Frequent telemetry must not crowd lightning observations out of the current 128-record queue; use an appropriate bounded buffer or reserved capacity. Do not run `uploadfs` as an ordinary upgrade.
4. Update signed ingestion validation, D1 migrations, API reads and dashboard plotting together. Batch readings, retain offline timestamps honestly and apply the existing TLS/authentication rules. Extend exports as well as the visible page.
5. Show internal temperature/humidity separately from ambient weather. Label the gauge's estimated state of charge by source; retain voltage. Show each measurement's age independently from the station's last report. No new notification system is included in this proposal.

Keep a firmware rollback path and migrate the backend compatibly before flashing a revised station. Exact parts, mounting space, probe cable/interface and weather limits remain to be selected and checked.

## Acceptance checks before outdoor use

- Measure complete-device sleep current with USB disconnected, before and after each addition. Include the always-connected gauge and examine every breakout LED.
- Integrate charge for sensor-only wakes, successful uploads and failed retries. Compare the chosen cadence with the actual battery budget rather than chip specifications alone.
- Confirm lightning interrupt wake, capture and normal reporting still work while telemetry conversions and bus faults occur. Test absent devices, I2C timeouts and brownouts.
- Compare temperature/humidity and pressure with references at the final mounting position. Measure vent pressure response; use consistent altitude correction if reporting sea-level pressure.
- Recheck AS3935 oscillator tuning and noise with add-ons powered both on and off, in the final enclosure. New wiring, boards and switching supplies may alter reception or resonance.
- Check physical clearances, battery protection, gasket/vent access and strain relief. Spray-test the empty modified case, dry it, then repeat field commissioning in safe weather. No outdoor adjustment during thunderstorms.

Recommended order: **internal SHT40 -> optional MAX17048 -> pressure -> external weather probe**. Measure after each step; none of these additions makes the hobby detector a certified warning system.

## Primary references

Sources reviewed 11 October 2026. Datasheet currents describe the specified chip and conditions, not the assembled station.

1. [Sensirion SHT4x datasheet](https://sensirion.com/resource/datasheet/sht4x) - electrical specifications, heater and measurement timings.
2. [Bosch BMP390 datasheet](https://www.bosch-sensortec.com/media/boschsensortec/downloads/datasheets/bst-bmp390-ds002.pdf) - forced/sleep modes, currents and interface power restrictions.
3. [Analog Devices MAX17048/MAX17049 datasheet](https://www.analog.com/media/en/technical-documentation/data-sheets/MAX17048-MAX17049.pdf) - gauge behavior and active/hibernate currents.
4. [Adafruit Feather ESP32 V2 pinouts](https://learn.adafruit.com/adafruit-esp32-feather-v2/pinouts) - I2C and switched QT power.
5. [Amphenol VENT-PS1YBK-N8001](https://amphenolltw.com/product-info/Vent/Vent.M12Plastic/VENT-PS1YBK-N8001.html) - specified pressure-relief vent and air permeability.
6. [Sensirion humidity/temperature design guide](https://sensirion.com/en/media/documents/FC5BED84/662B494D/Sensirion_Humidity_Temperature_Design_Guide.pdf) - airflow, thermal separation and housing effects.
7. [Adafruit MAX17048 board pinouts](https://learn.adafruit.com/adafruit-max17048-lipoly-liion-fuel-gauge-and-battery-monitor/pinouts) - battery connection, I2C supply and LED jumper.

Related project guides: [power](power.md), [operation](operation.md), [commissioning](commissioning.md), and [other upgrade paths](upgrades.md).
