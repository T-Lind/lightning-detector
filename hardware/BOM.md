# Generic bill of materials

The [CSV](bom.csv) lists quantities used and example part/specification choices for the original 2500 mAh carrier. It contains no personal inventory, order history, prices or regional stock claims. Confirm delivered revisions and current specifications before buying.

For an electronics-only bench build, use a Feather ESP32 V2 (Adafruit 5400), SparkFun SEN-15441 SPI sensor, USB-C data cable, approximately 220 mm of eight-conductor stranded ribbon, two 100 kΩ resistors and insulated/strain-relieved connections. A compatible protected 1S LiPo is optional during USB bench tests.

For the original outdoor package, add Hammond **1554R2GY**, Amphenol **VENT-PS1YBK-N8001** with nut, a 138 × 138 × 2 mm notched nonconductive carrier, four 10 × 10 × 8 mm floor blocks, VHB 5952 pads, six 6 mm M2.5 nylon standoff/screw/nut sets, six lower nylon washers, a soft battery strap, 2 mm nonconductive closed-cell EVA foam, wire anchors/ties and a sealed 1 g indicating desiccant packet.

The original battery envelope is 60 × 70 × 10 mm. The **EEMB LP103395 / 3700 mAh variant** uses a separate 110 × 150 mm plate, four internal M3 insert mounts and two battery straps. See [mechanical variants](3d/README.md). Confirm polarity, pack/protection/lead dimensions, fastener engagement and lid clearance; do not combine the two layouts blindly.

Tools: soldering iron and supplies, multimeter, appropriate wire cutters/stripper, insulated work surface, measuring tools, carrier fabrication tools and (for outdoor assembly) an empty-box drill/deburr setup. A scope/frequency counter and low-burden current profiler improve tuning and power validation. A 10 kΩ resistor used in the isolated GPIO wake test is temporary test equipment, not a normal harness component.

The vent requires a **12.2 ±0.1 mm** hole and 2.0–3.5 mm wall; an M12 label does not define the bore. Verify actual nylon PCB screw heads clear components; the original plan allows at most 4.5 mm heads and no PCB-top washers. Lower carrier washers are separate. See [assembly](../docs/build.md) and [commissioning](../docs/commissioning.md).
