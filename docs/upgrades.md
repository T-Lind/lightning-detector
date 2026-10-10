# Direction, solar and local/offline upgrades

V1 is the buildable package. The ideas below are development paths, **not validated add-on schematics or purchasing recommendations**. Do not buy their analog parts until experiments establish the requirements.

## First useful upgrade: lower radio energy

If measurements show Wi-Fi association/TLS dominates, add an indoor USB-powered ESP32 gateway. The outdoor Feather sends ESP-NOW, the indoor unit stores/forwards to the same API. This introduces channel selection, acknowledgments, authentication, replay handling and gateway outage management. Merely sending one unacknowledged packet is not an adequate replacement for the current durable queue.

A gateway can also serve a local dashboard during an Internet outage. It is a small always-on board, not a laptop, but still needs storage and a LAN server implementation. LoRa is relevant only if placement/coverage measurements justify another radio. Keep any long outdoor conductive connection out of the V1 design.

## Direction requires waveform information

The prior `atan2` sketch is a conceptual hint, not an engineering specification. A compass only measures enclosure orientation. Two AS3935 energy readings do not provide matched simultaneous field samples or a validated bearing; their internal algorithm outputs have no calibrated physical units.

A proper magnetic direction experiment would use two orthogonal H-field channels and a suitable E-field/polarity channel, sampling the **same early portion of the pulse**. See the primary [ALDIS lightning-location paper](https://www.aldis.at/fileadmin/userdaten/docs/3_SIPDA2007_Diendorfer.pdf) for how such instruments use crossed-loop measurements and field polarity. Site distortion, gain/phase matching, channel saturation, timing and 180° ambiguity all matter.

Independent peak-hold circuits can pick peaks at different times, discard sign or misassociate separate events. Adding an E-field latch alone does not automatically repair that. No claimed ±5°/±15° accuracy is justified before a calibrated waveform dataset.

Recommended development gates:

1. Define target flashes, frequency band, gain, bandwidth, minimum detectable field and allowed azimuth error.
2. Build/measure two matched receivers and synchronous signed sampling with a known field/loop source. Demonstrate phase/gain agreement and clipping detection.
3. Add a protected E-field input and simultaneous polarity/waveform capture. Work out local trigger association, reset, dead time and uncertainty reporting.
4. Use always-on sampling/circular memory or a proven synchronous hold circuit. The AS3935 interrupt arrives after classification; waking the Feather then cannot recover the original RF waveform.
5. Collect real-storm records from safe shelter, compare with independent location data, quantify site error and reject ambiguous observations.
6. Only then add bearing/uncertainty fields to the protocol and show a geographic sector. AS3935 range should remain statistical; it cannot convert a bearing into an exact strike coordinate.

Allow multiple PCB revisions and calibration equipment. Actual parts, cost and enclosure size need a separate design. The V1 box does not promise space for future loop antennas/boards merely because it has unused volume.

## Solar is a power-system redesign

First measure actual battery-side sleep charge, storm uploads and worst-case failed retries. Size solar to daily charge demand and the longest practical cloudy/cold period, then test electromagnetic interference with the AS3935.

A solar version needs cell-specific CC/CV charging, power-path/load sharing, panel/input voltage limits, battery temperature sensing and cold/hot charge inhibition, reverse/surge protection, weatherproof cable entry, fusing as appropriate, and an RF-tested layout. Do not attach a panel to BAT/3V or use a generic converter next to the ferrite.

If selecting LiFePO4, isolate/bypass the Feather's LiPo charging path through a documented redesign and keep voltage limits compatible. Never plug a LiFePO4 pack into the Feather and then connect USB under the assumption its onboard charger is configurable. An industrial battery choice must include duty/temperature approval, not only capacity/chemistry.

After power hardware is selected, repeat the BOM, mechanical checks, empty enclosure tests, antenna calibration and field acceptance. The vent, sealed case and radio link need to be considered together with panel mounts and long exposed conductors.

## Geographic map without RF development

If exact locations/direction matter most, an authorized external lightning dataset can complement this local detector. Keep those observations visibly sourced and separate; they are not measurements from the AS3935. Coverage, latency, licensing, API cost and offline behavior need evaluation. A local sensor circle remains an honest fallback when external data is unavailable.
