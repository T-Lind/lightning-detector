# Installation, maintenance and troubleshooting

## Choosing a site

Use an accessible shaded wood/PVC-backed mount, around 1–2m above ground. Keep the case vertical with vent facing down and the ferrite axis horizontal. The antenna placement is an engineering starting point; a single magnetic antenna's reception can vary with direction, so the detector does not have a validated equal-sensitivity circle around it. Keep a record of the mounting orientation when comparing sites.

Start a few metres away from the house where practical, then test. There is no universal minimum separation that guarantees freedom from interference. Avoid HVAC motors, inverters, LED power supplies, routers, metal gutters and mains cable routes. A good site balances quiet RF background with reliable Wi-Fi; it does not need to be at roof height or have an optical view of clouds.

Use the bench firmware temporarily to log a site's noise/disturber behavior, with a battery and no USB supply nearby. Return to the normal firmware afterward. Check the actual enclosure's RSSI and transaction charge; aiming better than −75dBm is a practical target, not a radio-range guarantee.

## Reading the dashboard

- **Activity detected / nearby activity:** recent timed lightning observations. “Nearby” is triggered by an overhead or ≤10km estimate within the past hour. This threshold is a display choice, not a lightning safety radius.
- **No detections in last hour:** the node is reporting health and has no captured, timed lightning in that interval. Storms can still be present.
- **Unknown:** not commissioned, report overdue by >12h, a reported sensor/storage fault, or the browser cannot fetch current data.
- **Overhead / out of range / unavailable:** preserved sensor semantics; these are not 1km / 63km / zero distance.
- **Range decreasing/increasing:** at least three estimates in each of two 10-minute windows, median change ≥5km. It is a trend in one sensor's output, not a meteorological forecast.
- **Energy:** raw unitless 21-bit value, not joules or current.
- **Battery:** divider-based volts and a rough voltage-derived percentage, not a measured state of charge. USB charging/load/temperature affect it. At ≤3.40V firmware defers radio; recharge promptly.
- **Queue overflow:** oldest observations discarded when the 128-record queue filled. Counts after an outage can be incomplete.
- **Time unavailable:** captured before a usable clock or with a capture time over five minutes in the future at arrival; retained in history but excluded from current activity/alerts.

The range ring is centered on the detector and has no azimuth. Never infer a storm is located at one point on the ring. The range is storm-front estimation, not a geolocated flash.

## Routine maintenance

After the first week and first wet/hot/cold cycle, inspect the dry case, vent, gasket, screw tightness, harness and battery. Check dashboard freshness daily during the trial. Recharge before voltage reaches the low-battery setting; choose the inspection/recharge interval from measured charge use, initially conservatively monthly rather than trusting a long theoretical lifetime.

For charging/programming, bring the whole unit inside in safe weather. Let a cold pack acclimate, keep condensation off electronics, open the lid, inspect, and use USB in a dry room-temperature setting. Never attach an outdoor charging cable for V1. Reassemble dry and make a new gasket inspection. Replace a saturated desiccant packet; inspect the membrane without touching/puncturing it. A vent cannot repair a poor seal.

Obtain the purchased battery revision's current temperature/use limits. The selected development pack is not approved here for permanent unattended outdoor duty. Qualify a suitable pack/power system before a year-round installation. Disconnect and replace a swollen/damaged pouch through an appropriate battery recycling route.

Do not retrieve, adjust, charge or unplug the outdoor instrument during a storm. The [National Weather Service](https://www.weather.gov/safety/lightning-tips) says audible thunder is a reason to seek safe shelter and remain there at least 30 minutes after the last thunder. The dashboard's one-hour activity window is not a clearance signal.

## Troubleshooting

| Symptom | Checks / action |
| --- | --- |
| `Sensor FAULT` | Verify 3V/GND, CS27, exact SCK5/MO19/MI21 pins, SPI interface jumper and solder bridges. `beginSPI` alone always returns true; readback/calibration must pass. |
| No upload, queue grows | Check 2.4GHz Wi-Fi credentials, password quoting, Worker URL without trailing slash, API/device ID, HMAC text secret and reachable NTP. Inspect serial upload status; firmware waits 15m after failures. |
| Network configuration incomplete | Install real `secrets.h` and a valid PEM `tls_ca.h`; examples intentionally prevent networking. Rebuild and flash `feather`. |
| HTTP 401 ingestion | HMAC/device ID mismatch; secrets must be identical literal 64-character text, not hex-decoded on one side. |
| HTTP 400 ingestion | Invalid clock or event fields. Check NTP, firmware version and actual request; fix invalid data before retrying a blocked batch. |
| HTTP 409 ingestion | Sequence reused for different data, usually erased NVS or test simulator collision. Preserve queue and reprovision with a new DEVICE_ID on both ends; do not delete history to hide the problem. |
| HTTPS error | Validate hostname, full certificate chain, correct root and current clock. Never disable validation. |
| D1 503 | Confirm remote schema and binding UUID, Cloudflare logs, quotas and service availability. Queue remains local. |
| LittleFS mount or both-slot failure | Preserve flash for diagnosis; do not autoformat an established device. On a genuinely new device, run the documented one-time `uploadfs` initialization. |
| Immediate wakes / many noise events | Check IRQ level, tuning firmware accidentally left installed, background interference, rail supply and cable routing. Firmware should enter 60s timer backoff. Repair source before increasing thresholds. |
| Few/no detections in a real storm | Check oscillator tuning in final case, antenna orientation and intact ferrite, noise masking/backoff, sensor power during sleep and too-aggressive screening settings. Compare from shelter with an independent lightning source. |
| Deep sleep current is high | Disconnect USB; cut sensor LED jumper; switched rail off; inspect I2C pull-up bridges and continuous IRQ wakes. Measure battery-side current with an instrument that tolerates Wi-Fi bursts. |
| Restarts during radio activity | Recharge battery; verify JST, short/strained harness, regulator supply and meter burden. A series µA meter can cause a brownout. |
| Battery voltage seems wrong | GPIO35 is already divided by 2; compare millivolts-based ADC average with a meter and adjust BATTERY_CAL. Don't add a second divider or show battery percent. |
| No tab notifications | Permission, secure origin, open visible browser, newly received timed detection and initial-load suppression. For closed-tab/mobile alerts configure an external webhook. |
| Water/condensation | Disconnect battery indoors when safe. Dry/inspect; check gasket, vent O-ring, wall hole finish and humidity during assembly. Retest the empty box before redeployment. |

Keep an incident record: UTC time, firmware/config, sensor tuning, RSSI, battery, noise events, mounting/photo and observed weather. Change one setting/location at a time so field results remain interpretable.
