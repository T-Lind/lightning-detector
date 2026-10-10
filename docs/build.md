# Assembly and setup

Prove the electronics indoors before modifying an enclosure. Disconnect USB and battery for wiring, soldering and drilling. Match silkscreen pad names; diagrams are logical connections rather than a guaranteed header order.

## 1. Select a mechanical variant

For a USB bench build, no enclosure is required. For an outdoor prototype choose one complete layout in the [mechanical guide](../hardware/3d/README.md):

- Original 138 × 138 mm notched carrier, adhesive floor blocks and a maximum 60 × 70 × 10 mm battery envelope (2500 mAh example).
- 110 × 150 mm unnotched, screw-mounted carrier for an EEMB LP103395 / 3700 mAh pack, with a separate foam template and two straps.

Both use Hammond **1554R2GY**, not the shallower RL variant. Confirm delivered board holes, actual pouch/protection/lead dimensions and lid clearance. Do not put the longer battery into the original layout. Templates are nominal design geometry; dry-fit before machining or fastening.

## 2. Make and inspect the harness

Use about 220 mm of eight-conductor 28 AWG stranded ribbon, shortening only after dry-fit. Label both ends, leave gentle service slack and route away from the ferrite and Wi-Fi antenna.

| Conductor | Feather V2 | SparkFun sensor | Function |
| --- | --- | --- | --- |
| 1 | GND | GND | Common ground |
| 2 | 3V | 3V3 | Always-powered 3.3 V |
| 3 | 33 | INT | Active-high IRQ / RTC wake |
| 4 | GND | GND | Second ground return beside logic |
| 5 | 27 | CS | Chip select |
| 6 | SCK | SCK | GPIO5 clock |
| 7 | MI | MISO | GPIO21, sensor → MCU |
| 8 | MO | MOSI | GPIO19, MCU → sensor |

Add **100 kΩ SCK→GND** and **100 kΩ MOSI→GND** at the sensor end; insulate all leads/junctions. Its R8 already pulls CS up through 10 kΩ. Preserve factory SPI selection and keep optional `I2C PU` bridges open. Use strain relief so wires cannot pull solder pads. Combine ground returns without forcing wire into plated holes.

Check continuity and shorts without power. With battery disconnected, power by USB and measure about 3.3 V at the sensor. Do not use BAT, USB or the switched STEMMA power rail for the AS3935. Inspect the ferrite for damage; software tuning cannot repair a cracked antenna. See [wiring.svg](../hardware/drawings/wiring.svg).

## 3. Bench-test

Follow [firmware setup](firmware.md) to upload `bench`; expect `Sensor OK`, which includes register readback and oscillator calibration. A missing/faulty sensor must be resolved before field use. Noise/disturber events near electrical equipment can be expected; a clicking lighter is not a calibrated lightning test.

Optional `boardcheck` and `sensorcheck` diagnostics exercise board resources and oscillator/interrupt wake, respectively. They do not validate lightning classification and must be replaced by normal firmware afterward.

## 4. Tune in the intended arrangement

Fit the sensor, battery and Feather in their intended positions. Keep wires and metal clear of antennas. The ferrite's long axis is horizontal in the project's vertical enclosure layout; this is a repeatable placement, not a compass bearing or equal-sensitivity guarantee.

Flash `tune`: it sweeps 0–120 pF in 8 pF steps and drives the divided oscillator on INT. Target antenna resonance is **500 kHz ±3.5%**; with division 16 this is **31.25 kHz**, acceptable about 30.156–32.344 kHz. The tune build's serial measurement is an approximation; confirm with a frequency counter/scope where possible. Set `TUNING_PF` in `firmware/include/config.h` to your measured value and rebuild.

The committed 0 pF is a placeholder. If no setting meets tolerance, check arrangement and hardware. Recheck after changing the enclosure contents. **Never leave tuning firmware deployed:** INT is an oscillator output during tuning.

## 5. Prepare the empty enclosure

Remove all electronics, battery and carrier. For the with-nut Amphenol **VENT-PS1YBK-N8001**, select a bottom-facing smooth wall region; the original plan uses center **80 mm from the outside left edge and 34 mm from the outside back**. Confirm ribs, nut/tool access and **2.0–3.5 mm wall thickness** against your case.

Support/clamp the empty wall, pilot-drill, finish/deburr and measure **12.2 ±0.1 mm**. A nominal 12 mm drill or M12 label is insufficient. Keep the sealing surface flat and clear of the gasket groove. Clean debris and dry thoroughly. Fit the O-ring outside and supplied nut inside; follow the delivered drawing. The referenced torque is 6–8 kgf·cm (about 0.59–0.78 N·m). Reserve a 24 mm nut/tool diameter and about 10 mm axial access. Leave the membrane unobstructed and facing down where practical.

Spray-test the closed **empty** box using dry tissue to reveal ingress; avoid immersion/pressure washing. Check after temperature changes and dry completely. This is a workmanship check, not certification of the modified assembly. The vent equalizes pressure; it is not required for lightning sensing and does not eliminate humidity.

## 6. Configure cloud and normal firmware

Follow [cloud setup](cloud-setup.md), then [firmware provisioning](firmware.md): deploy your own Worker/database, set distinct ingestion/read secrets, verify the HTTPS root and provision Wi-Fi/URL/device identity. Use a 2.4 GHz network and keep the dashboard token out of firmware.

Initialize LittleFS only on a **new device with no history**. Normal firmware refuses to autoformat failures. Routine application upgrades must preserve LittleFS and NVS. Flash `feather`, confirm sensor/storage health and upload acknowledgment, then verify the initial heartbeat in the dashboard. Use [commissioning](commissioning.md) for battery-powered wake, queue recovery, voltage calibration and current measurements.

## 7. Final fit and power checks

After initial tests, optionally open only the SparkFun **LED** jumper trace with both USB and battery disconnected. Its supply-wired red LED cannot be controlled by software. Verify the jumper is open and the sensor still operates; repeat sleep-current measurement on battery alone. Leave interface/address traces intact.

Mount boards on insulating standoffs without bending them or touching components/ferrite. For the original M2.5 hardware, washers go **beneath the carrier nuts**, not on PCB tops. Check ≥5 mm male-stud projection and full engagement through carrier/washer; measure screw heads, with a maximum 4.5 mm envelope in this plan. Verify actual female-thread depth to avoid bottoming. Nominal pad clearance is tight, so actual solder and heads matter.

Secure the battery using nonconductive closed-cell foam and a soft, releasable strap without compressing the pouch. Keep protection board/lead free and all screw ends away from the battery. Add wire strain relief, a sealed 1 g indicating desiccant packet clear of antennas/leads, and at least 5 mm component-to-lid clearance. Confirm the USB plug can be inserted with the lid removed. Charge indoors with the pack acclimated, dry and within its supplier limits.

For the original adhesive carrier, four 8 mm blocks plus two full 1.1 mm VHB layers lift it 10.2 mm above the inside floor. Locate supports clear of molded ribs and underside nuts; follow adhesive preparation/cure guidance. The screw-mounted variant uses the documented internal M3 inserts instead. Do not drill the case back for either carrier.

Inspect the gasket and close the cover evenly, following Hammond's delivered instructions (referenced cover torque 0.30–0.40 N·m). External mounting wells are outside the gasketed cavity. Select site fasteners for the substrate and use the [operation guide](operation.md) to choose a shaded, accessible, electrically quiet location with reliable Wi-Fi.

Complete the commissioning record before an inspected mild-weather trial. Battery life, weather sealing and lightning performance require measurements; the drawings alone do not qualify permanent unattended service.
