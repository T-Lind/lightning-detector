# Third-party notices

The project license does not replace the licenses or ownership of dependencies and manufacturer references.

| Material | Source / version | License and treatment |
| --- | --- | --- |
| Unmodified Feather V2 board CAD and notices | [Adafruit ESP32 Feather V2 PCB](https://github.com/adafruit/Adafruit-ESP32-Feather-V2-PCB), commit `cbde2c6658acb3c788616ceb13423b5d36305ef0`; designed by Limor Fried/Ladyada for Adafruit Industries | [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/); original [license](hardware/reference/feather-license.txt) and [README](hardware/reference/feather-README.md) retained |
| Unmodified AS3935 v20 board CAD and notices | [SparkFun AS3935 Lightning Detector](https://github.com/sparkfun/SparkFun_AS3935_Lightning_Detector), commit `e5c68988694d06dc4b19c65a573f02f4260eb706` | Hardware CC BY-SA 4.0; original [license](hardware/reference/sensor-LICENSE.md) and [README](hardware/reference/sensor-README.md) retained |
| Sensor Arduino library | SparkFun AS3935 library 1.4.9, fetched by PlatformIO | MIT; upstream notices remain in the installed package |
| ArduinoJson | ArduinoJson 6.21.5, fetched by PlatformIO | MIT; upstream notices remain in the installed package |
| ESP32 framework/toolchain | Espressif32 platform 6.10.0 / Arduino ESP32 2.0.17 | Upstream components retain their individual licenses; not vendored here |
| Worker tooling | Wrangler 4.149.0 and locked transitive dependencies | Upstream package licenses; installed with `npm ci`, not vendored here |
| Optional 3D viewer | Three.js and esbuild, versions locked in `tools/viewer/package-lock.json` | Upstream licenses; build copies Three.js's MIT notice into locally generated output |
| Enclosure geometry / drawings | [Hammond 1554R2GY](https://www.hammfg.com/part/1554R2GY) | Manufacturer-owned reference; source and assemblies incorporating it are downloaded/generated locally and excluded from Git |
| Manufacturer datasheets | Links in [sources](docs/sources.md) | Consult originals; no datasheet PDF is redistributed here |

Board CAD is included only as an unmodified dimensional/electrical reference. Custom carriers and schematic illustrations are project work, not modifications to vendor PCB layouts. Do not imply manufacturer endorsement. Check the relevant upstream license before redistributing locally generated assets containing third-party geometry or code.
