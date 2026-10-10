# Firmware provisioning and behavior

## Build dependencies

Use Python 3.10+ and PlatformIO. The tested project pins Espressif32 platform 6.10.0 (Arduino ESP32 core 2.0.17), SparkFun AS3935 library 1.4.9 and ArduinoJson 6.21.5. The explicit Feather V2 board target supplies the correct SPI pin aliases.

```powershell
python -m pip install platformio==6.1.19
python -m platformio run -d firmware -e feather -e bench -e tune
```

Compilation with example secrets proves compatibility only. It doesn't connect to your network and is not a configured deployment image.

## Optional diagnostics

The `boardcheck` environment is a temporary bare-board diagnostic image. It tests usable PSRAM/internal RAM, heap integrity, NVS, a temporary LittleFS file, nearby Wi-Fi, configured association and a three-second timer wake. It does not publish simulated lightning. Its LittleFS test refuses to overwrite an existing `/boardcheck.tmp`. Replace it with `feather` after testing. Actual sensing, GPIO33 sensor wake and battery measurements still require the assembled hardware.

The `sensorcheck` environment is a temporary connected-sensor diagnostic. It verifies register readback and RC calibration, sweeps LCO capacitance using ESP32 hardware pulse counting on GPIO33, and uses the sensor's oscillator output to exercise EXT0 deep-sleep wake. It makes no queue/NVS writes or network requests. This verifies the interrupt harness and MCU wake path, **not lightning classification**. Preserve the installed application before testing and restore `feather` afterward; never leave `sensorcheck` running as the detector. A pass is a USB bench result, not a battery-current or final-enclosure acceptance test.

## Start with `bench`

After wiring, connect a USB **data** cable. List ports:

```powershell
python -m platformio device list
python -m platformio run -d firmware -e bench -t upload --upload-port COM5
python -m platformio device monitor --port COM5 --baud 115200
```

Replace COM5 with your port. Close the serial monitor before uploading. Feather V2 revisions use either a CH9102F USB interface or the older CP2102N; match any needed driver to the chip on your delivered board. Use the [Adafruit board setup guide](https://learn.adafruit.com/adafruit-esp32-feather-v2/arduino-ide-setup) for your revision. Do not install random driver packages. If needed, use the Feather reset/boot upload procedure described there.

The bench build disables Wi-Fi, flash queue and sleep and unmasks disturbers. Expect `Sensor OK`, then readable event lines. Failure of register readback or oscillator calibration reports a fault. There is no manual upload/web page on the sleeping outdoor board.

## Antenna tuning build

```powershell
python -m platformio run -d firmware -e tune -t upload --upload-port COM5
python -m platformio device monitor --port COM5 --baud 115200
```

See [the build guide](build.md) for measurement and allowed frequency tolerance. Set `TUNING_PF` to the measured best value. The tune environment emits oscillator signals on IRQ and must be replaced before deployment.

## First-time filesystem initialization

Normal firmware uses `LittleFS.begin(false)` and deliberately refuses to autoformat failed storage. **On a new device with no event history only**:

```powershell
python tools/format_littlefs.py
python -m platformio run -d firmware -e feather -t uploadfs --upload-port COM5
```

This creates and uploads an empty filesystem image using this project's partition table. It erases any existing event queue in that filesystem. Do not rerun `uploadfs` as a routine firmware upgrade. Do not use `erase` on a deployed board; erasing NVS also resets sequence reservations and requires changing DEVICE_ID on both sides.

## Production settings

```powershell
Copy-Item firmware/include/secrets.example.h firmware/include/secrets.h
```

Set WIFI_SSID, WIFI_PASSWORD, API_BASE_URL, DEVICE_ID and DEVICE_SECRET. Use your **HTTPS Worker base URL with no trailing slash**. The secret must be the same 64-character text as the Cloudflare ingestion secret. Keep the dashboard READ_TOKEN separate and never copy it into firmware. Follow [TLS root setup](cloud-setup.md) to create `tls_ca.h`. Both real headers are ignored by Git.

For the actual sensor adjust only measured/intentional settings in `config.h`:

| Setting | Initial value | Effect |
| --- | ---: | --- |
| TUNING_PF | 0 placeholder | Set from your measured sweep, 0–120 by 8pF |
| NOISE | 2 | Higher values tolerate more background noise with sensitivity tradeoffs |
| WATCHDOG | 2 | Event screening threshold; change one step at a time |
| SPIKE | 2 | Shape rejection threshold; aggressive filtering can lose real detections |
| MASK_DISTURBERS | true | Outdoor build suppresses disturber wakes; bench build overrides false |
| HEARTBEAT_S | 21600 | Six-hour health interval |
| MIN_UPLOAD_S | 30 | Upload spacing during repeated events |
| RETRY_S | 900 | Retry queued upload after failed connection |
| NOISE_BACKOFF_S | 60 | Timer-only recovery from repeated/high IRQ noise |
| BATTERY_CAL | 1.0 | Meter-derived adjustment for onboard voltage divider |
| NTP_TIMEOUT_MS | 8000 | Covers lwIP's randomized startup delay of up to 5s plus the time request |
| LOW_BATTERY_MV | 3400 | Skip radio; bring in to recharge |

Do not blindly tune away persistent noise. First correct the location, loose connections, cable routing, nearby power electronics and antenna calibration.

Flash and verify:

```powershell
python -m platformio run -d firmware -e feather -t upload --upload-port COM5
python -m platformio device monitor --port COM5 --baud 115200
```

An initial heartbeat appears in the cloud. It can have null detection time before the first NTP sync; the device health send time is valid after sync. Verify upload acknowledgment, then remove USB and measure true battery sleep behavior.

## Storage and protocol

The 8MB flash partition table reserves two 3MB app slots, 1.875MiB for LittleFS and 64KiB for crash dumps, with NVS in its normal location. App slots permit a future OTA implementation, but **OTA is not implemented**: upgrades are USB only. Firmware is well within the selected flash/RAM limits. This partition layout supersedes the original full-size LittleFS layout; migrate any existing queue before changing a previously commissioned device.

Each captured event carries sequence, type, raw range, raw energy, battery voltage and detection timestamp (nullable). Transport metadata includes current RSSI, firmware version, sensor/queue health and cumulative drop counts. Batches contain at most 16 records; queue capacity is 128. The backend returns exactly accepted IDs; the firmware removes a batch only when all its IDs are acknowledged over verified HTTPS.

Checksummed alternating files retain an older committed snapshot if the next write is torn. A failed ACK deletion can retransmit duplicates safely. Events captured during flash/network work are not guaranteed complete, and a write failure or sudden power loss may lose an observation. The raw queue struct is a V1 format; migrate/export queued data before changes to its layout or partition table.

## Wake and recovery

GPIO33 wakes on HIGH while a timer provides health/retry recovery. Only the AS3935 stays fully listening. With USB connected, the Feather V2's USB-to-UART bridge can remain enumerated while the ESP32 sleeps; the console becomes quiet, then boot logs resume on wake. Never turn off EN/main 3V, or call `sensor.powerDown()` in normal operation.

Persistent IRQ HIGH or repeated immediate noise wakes disable IRQ wake for a 60-second timer interval. Register/configuration errors trigger the same recovery path. This is a reduced-detection state, not a healthy sensor. A disconnected sensor needs physical repair even if the rest of the firmware keeps sending health reports.

Network attempts have bounded association/HTTP/TLS timeouts and a soft 25-second cycle budget. The budget is checked between batches; one in-progress network request can run beyond it, so it is not a hard real-time deadline. Each network attempt waits up to 8 seconds for a fresh NTP sample, even when the RTC clock looks plausible. The SDK randomizes SNTP startup by up to 5 seconds, so the original 3-second wait could expire before a request was sent. Events captured before sync retain their recorded time; the cloud stores an implausible future capture time as untimed. If NTP, Wi-Fi or TLS fails, the node keeps its queue and sleeps before retry. No cloud command or remote web request can wake it.
