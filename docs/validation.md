# Validation and remaining physical work

Public source snapshot: 2026-10-10, firmware version 1.0.3. Tests describe the development prototype; replicas require their own commissioning. Private raw device/network logs and deployment records are intentionally excluded.

## Observed on the prototype

- ESP32 V2 board-resource/USB checks, normal flash/storage startup and timer deep-sleep wake.
- Connected AS3935 SPI register readback and oscillator/RC calibration.
- Antenna resonance sweep using hardware pulse counting; one sensor met the target at a measured setting. That per-unit setting is not distributed as a universal default.
- Sensor oscillator output exercised the INT harness and ESP32 EXT0 wake path; this is a **wake-path test, not a lightning-classifier test**.
- Normal firmware associated with Wi-Fi, obtained NTP time, validated HTTPS and received acknowledgment for health reports. Battery-powered operation also produced health reports.
- Dashboard local fixture checks covered narrow-screen layout, range semantics, persistent/tab-only login and rejected tokens. Synthetic fixture observations are not real sensor events.

## Reproducible software checks

```powershell
npm.cmd test --prefix cloudflare
python tools/check_links.py
python tools/check_fit.py
python tools/check_board_fasteners.py
python -m platformio run -d firmware -e feather -e bench -e tune -e boardcheck -e sensorcheck
```

The backend/dashboard suite currently has 21 tests covering time/range semantics, conservative health/activity state, battery estimate presentation, distance plot data and access-storage/request behavior. PlatformIO builds use example headers when credentials are absent. Local ingestion/deduplication/auth checks can be run with `scripts/integration.js` under the isolated procedure in [cloud setup](cloud-setup.md).

The public snapshot passed all 21 tests, all five firmware builds, 66 relative guide links and the nominal layout/pad checks. Its Worker template bundles successfully with Wrangler 4.149.0, whose locked dependency audit reported no known vulnerabilities at publication. The local Worker/D1 integration checks exercised accepted ingestion, duplicate retry, conflicting sequence reuse, bad signatures, expired send times, unauthorized reads and old/untimed/future-capture semantics. The enclosure download helper fetched and verified the pinned manufacturer reference; the reference itself is excluded from publication. These are dated results, not a guarantee about future dependencies or hardware performance.

## Still to measure

Actual sleep current/transaction charge and discharge lifetime; voltage calibration against a meter; supplied hardware/pouch/lead/fastener fit; final enclosure tuning and thermal/moisture behavior; real lightning detection sensitivity, range accuracy, false positives and event-capture completeness. Complete the [commissioning checklist](commissioning.md) and keep a local measurement log.

A passed build or heartbeat does not establish these properties. Runtime calculations use assumed currents and capacity allowances. No notification service or guaranteed delivery path has been commissioned. OTA updates are not implemented.
