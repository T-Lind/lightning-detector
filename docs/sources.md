# Engineering sources

Use the original supplier/manufacturer references for delivered revisions. Nominal drawings and calculations do not replace physical measurements.

| Source | Purpose |
| --- | --- |
| [Adafruit Feather ESP32 V2 guide](https://learn.adafruit.com/adafruit-esp32-feather-v2) | Board power, pinout, programming and USB revision details |
| [SparkFun AS3935 guide](https://learn.sparkfun.com/tutorials/sparkfun-as3935-lightning-detector-hookup-guide) | SPI breakout, ferrite antenna and LED/interface jumpers |
| [AS3935 original datasheet](https://cdn.sparkfun.com/assets/learn_tutorials/9/2/1/AS3935_Datasheet_EN_v2.pdf) | Registers, range/energy codes, timing and antenna calibration |
| [PlatformIO Feather V2 target](https://docs.platformio.org/en/latest/boards/espressif32/adafruit_feather_esp32_v2.html) | Board identifier and upload configuration |
| [Espressif sleep documentation](https://docs.espressif.com/projects/esp-idf/en/stable/esp32/api-reference/system/sleep_modes.html) | RTC pins and EXT0 level-triggered wake |
| [Hammond 1554R2GY](https://www.hammfg.com/part/1554R2GY) / [drawing](https://www.hammfg.com/files/parts/pdf/1554RGY.pdf) | Case dimensions, molded features and cover hardware |
| [Hammond original STEP ZIP](https://www.hammfg.com/files/parts/stp/1554R2GY.zip?v=1697661989) | Local enclosure geometry for optional assembly generation |
| [Amphenol with-nut vent](https://amphenolltw.com/product-info/Vent/Vent.M12Plastic/VENT-PS1YBK-N8001.html) / [original drawing mirror](https://www.mouser.com/datasheet/2/18/1/VENT-PS1XXX-XXXXX-1114173.pdf) | Bore, wall range, installation and clearances |
| [Adafruit 2500 mAh pack](https://www.adafruit.com/product/328) | Original layout's pack choice; verify supplier operating/use limits |
| [EEMB LP103395](https://www.eemb.com/product-208) | Long-pack carrier variant; confirm protected dimensions/polarity and current specification |
| [Adafruit LiPo voltage overview](https://learn.adafruit.com/li-ion-and-lipoly-batteries/voltages) | Broad voltage behavior; not a characterized percentage curve for this pack |
| [3M VHB 5952 sheet](https://multimedia.3m.com/mws/media/2366487O/3m-vhb-tape-5952.pdf?fn=3M-VHB-Tape-5952.pdf) | Nominal adhesive thickness and application guidance |
| [Cloudflare static assets](https://developers.cloudflare.com/workers/static-assets/) | Worker/API/dashboard hosting |
| [D1 pricing](https://developers.cloudflare.com/d1/platform/pricing/) / [limits](https://developers.cloudflare.com/d1/platform/limits/) | Current usage/billing review |
| [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) | Current account quota/cost review |
| [NWS lightning guidance](https://www.weather.gov/safety/lightning-tips) | Independent weather safety guidance |

These sources do not establish detection probability, final ingress certification, measured runtime, complete capture or accurate strike location for the assembled station. See [validation](validation.md) and [commissioning](commissioning.md).
