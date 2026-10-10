# Power budget and outdoor battery constraints

Start with measured **battery-side charge**, not a lifetime quoted from nominal mAh divided by a chip datasheet current. The Feather regulator, battery divider, USB interface, RTC wake mode, breakout resistors, battery protection, temperature and self-discharge all matter.

Adafruit reports about 70 µA for the Feather in its tested deep-sleep configuration; the AS3935 chip's typical listening current is about 60–70 µA depending on its regulator mode. This project's EXT0 wake and complete breakout may differ. A reasonable initial acceptance target is **≤0.25 mA at the battery, LED jumper cut, USB disconnected**, with both sensor and wake enabled. Investigate >0.5 mA; do not assume the 0.13 mA chip-plus-board sum is the finished product's current.

## Calculation

```text
usable capacity (2500 mAh example) = 2500 mAh × 0.70 planning allowance = 1750 mAh
charge/day = sleep_current_mA × 24 + uploads/day × charge_per_upload_mAh
life_days = usable capacity / charge_per_day
```

The 70% allowance is a planning assumption for aging, cold, reserve and imperfect discharge use; it is not a battery guarantee. A 150 mA average, 5-second transaction is `150 × 5 / 3600 = 0.208 mAh`. Failed connections and a full 15–25 second upload cycle can be much more expensive.

| Scenario | Sleep | Transactions/day | Charge/transaction | Charge/day | Arithmetic life |
| --- | ---: | ---: | ---: | ---: | ---: |
| Quiet, strong Wi-Fi | 0.20 mA | 4 | 0.21 mAh | 5.64 mAh | 310 days |
| Moderate detections | 0.20 mA | 24 | 0.21 mAh | 9.84 mAh | 178 days |
| Storm-heavy average | 0.20 mA | 104 | 0.42 mAh | 48.48 mAh | 36 days |
| Persistent Internet outage | 0.20 mA | 96 | 0.42 mAh | 45.12 mAh | 39 days |

For a 3700 mAh pack under the same 70% allowance, multiply these arithmetic lifetimes by 1.48. These are scenarios, not forecasts; the table assumes the sensor LED is off. Long periods of noise, weak Wi-Fi or an uncut sensor LED can dominate. On a storm day, 30-second upload spacing can still mean 120 uploads/hour. The node sleeps between captured events while delaying uploads; queued data generally waits at most that 30-second batching window when online. A failed upload waits 15 minutes before the next network attempt. A 6-hour heartbeat continues during quiet weather.

At an indicated battery voltage ≤3.40 V, firmware skips Wi-Fi and uses 6-hour timer wakes while preserving sensor IRQ wake unless noise/fault backoff applies. Lightning events can still wake it, so this is an early recharge policy, not a hard battery cutoff. Pack protection remains the final electrical cutoff. In the regulator's dropout region, nominal `3V` can fall and detection may become unreliable. Recharge promptly rather than operating at the protection threshold.

## Measure correctly

1. Charge indoors, then disconnect USB completely.
2. Use a current profiler or a meter with a low-burden µA range for sleep. A high-burden series meter can cause brownouts during Wi-Fi bursts. Do not bridge battery contacts with the current input.
3. Confirm the AS3935 still has power and GPIO33 can wake the MCU while measuring sleep. Measure for several minutes, not only the first quiet instant.
4. Capture battery-side current versus time over 20 successful uploads and 20 failed network attempts. Integrate charge per wake including boot, flash, TLS and shutdown.
5. Repeat at the actual installation site with the finished enclosure. Record results in the commissioning sheet and replace the example budget with those numbers.

The dashboard reports volts alongside an explicitly **estimated** charge percentage, rounded to 5% steps. This is a generic 1S LiPo voltage lookup, not a characterized EEMB LP103395 curve or a fuel-gauge measurement. Battery chemistry, temperature, load, USB charging and ADC calibration can shift it substantially; USB without a battery can still produce a voltage reading. The software cannot determine battery presence or charging status. Compare GPIO35 readings against a multimeter and adjust `BATTERY_CAL`. The 3.40V radio/recharge threshold remains separate from the percentage scale.

The lookup interpolates these millivolt/percent anchors: 3300/0, 3500/5, 3600/10, 3700/20, 3750/40, 3800/50, 3850/60, 3900/70, 4000/80, 4100/90, 4200/100. Missing readings and readings outside 2500–4300mV show an unavailable estimate; valid readings below 3300 clamp to 0%, and above 4200 clamp to 100%. These anchors are a software approximation, not manufacturer test data. [Adafruit's voltage overview](https://learn.adafruit.com/li-ion-and-lipoly-batteries/voltages) explains the broad 4.2V/full and long nominal-voltage plateau, but does not establish these percentages. Do not use the estimate as proof of charge completion or remaining runtime.

## Temperature and charging

The current retailer-linked [785060 specification sheet](https://cdn-shop.adafruit.com/datasheets/785060-2500mAh_specification_sheet.pdf) was readable on 2026-10-05 using a PDF text reader, although the Chrome PDF view did not render its text during the product check. Edition 1.0 lists 0–40 °C charging, a standard 500mA charge rate with 4.2V CC/CV, and a preferred 0–60 °C discharge range. Temperature-abuse tests in that document are not operating permissions. Confirm the supplied pack's model/revision against this sheet; its stated pack dimensions differ from the retailer's 50 × 65 × 8mm listing, so retain the larger 60 × 70 × 10mm reserve and measure the delivered pack.

Use the prototype only in a **shaded, mild-weather, inspected installation** and bring it indoors for charging. The project's narrower charging policy remains **10–35 °C after acclimation**. No outdoor solar/USB charging is designed here. Keep the pack within its confirmed operating limits; enclosure temperature qualification is still required for permanent service.

Adafruit's battery listing advises against unattended use/charging; consequently the chosen pack is a development battery and cannot be represented as approved for permanent unattended field service. For a finished permanent installation, qualify a temperature-rated protected cell and enclosure temperature extremes, or redesign around a suitable industrial power source. Do not swap to LiFePO4 on the Feather's existing LiPo charger.

The empty box's ingress rating says nothing about solar heat gain. Keep it shaded, off a metal roof, and away from heaters/inverters. Inspect the pack at every recharge, after the first week outside, and after a hot/cold spell. Do not clamp, glue permanently, fold or compress a pouch. Stop using a swollen or damaged pack.
