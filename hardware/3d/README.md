# Carrier designs and local 3D inspection

Both carrier variants fit the intended **Hammond 1554R2GY** case. Pick one complete layout and confirm actual parts before fabrication. All dimensions are mm; print templates at **100%** and verify their scale bar. The purchased enclosure is not a printed part.

## Original notched carrier

| File | Use |
| --- | --- |
| [carrier.step](carrier.step) | Editable solid, manufacturing origin |
| [carrier.stl](carrier.stl) | Optional printable carrier; millimeters, 100% scale |
| [carrier.scad](../carrier.scad) | Editable OpenSCAD source |
| [full-size template](../drawings/carrier-template-1to1.svg) | Preferred sheet-stock cut/drill template |
| [layout.json](../layout.json) | Board coordinates, clearances and stack |
| [floor-block.stl](floor-block.stl) | Four 10 × 10 × 8 mm insulating supports |

The carrier is **138 × 138 × 2 mm**, with 18 mm corner notches, six 2.8 mm board mounting holes and two strap slots. Use nonconductive polycarbonate sheet, or an appropriate PETG/ASA prototype print checked for warp/strength. The original maximum battery envelope is **60 × 70 × 10 mm**, based on a 2500 mAh pack. The lead and USB plug have separate reserved space.

Four 8 mm floor blocks and two full 1.1 mm VHB 5952 layers give 10.2 mm floor clearance. The carrier top is 12.2 mm above the inside floor; 6 mm standoffs support nominal 1.6 mm PCBs. The conservative maximum board height is 30.2 mm above that floor versus a 54 mm nominal interior. Confirm shipped heights, adhesive thickness, connector clearance and actual molded features.

Use lower washers under carrier nuts only; PCB-top washers can overlap components. Nominal 4.5 mm screw-head envelopes have tight pad clearance, which does not qualify the delivered heads or solder. Dry-fit without force and verify fastener engagement. See [assembly](../../docs/build.md).

## EEMB LP103395 / 3700 mAh variant

The [separate 110 × 150 mm template](../drawings/carrier-110x150-eemb-lp103395-1to1.svg) and [layout JSON](../carrier-110x150-eemb-lp103395.json) specify an **unnotched 150 mm X × 110 mm Y × 2 mm plate** with four internal M3 insert mounts on a 138 × 96 mm pattern. The board orientation, battery footprint, EVA outline and four slots for two straps differ from the original layout.

The pack placement uses nominal LP103395 dimensions **33.5 × 97 × 10.3 mm**. Measure the actual protected pack, taped edges and lead exit; check lid clearance and screw engagement before fastening. This variant does not use the original adhesive-block stack. A printed template is a design aid, not proof of delivered fit.

## Optional full assembly and offline viewer

The public repository includes custom carrier parts and the assembly-generation tools. **Hammond enclosure source and derived full-assembly assets are not redistributed.** Fetch the manufacturer reference directly, then generate an assembly/viewer locally:

```powershell
python tools/fetch_enclosure.py
python -m venv .venv-cad
.venv-cad/Scripts/python.exe -m pip install -r tools/requirements-cad.txt
.venv-cad/Scripts/python.exe tools/build_3d.py
.venv-cad/Scripts/python.exe tools/check_3d.py
.venv-cad/Scripts/python.exe tools/render_3d.py
npm.cmd ci --prefix tools/viewer
node tools/viewer/build.mjs
```

On Unix, use `.venv-cad/bin/python`. Open generated `hardware/3d/viewer.html` locally in a browser for rotation, transparent case, exploded views and clearance inspection. The builder currently models the **original notched/2500 mAh layout**; the LP103395 variant has its own template/data and is not the same assembly. Models represent dimensions/envelopes; small components, actual threads, pouch construction and finished wire bends are not fully modeled.

`fetch_enclosure.py` verifies the expected original STEP hash and refuses unexpected content. If Hammond replaces it, review the revision rather than disabling the check. Manufacturer copyright/terms remain in force for local source and outputs. Three.js's MIT notice is preserved when building the viewer. See [third-party notices](../../THIRD_PARTY.md).

Run `python tools/check_fit.py` and `python tools/check_board_fasteners.py` for nominal layout/pad checks. The assembly generator also checks selected solid intersections. These do not establish battery suitability, RF behavior, gasket compression, adhesive durability, weather sealing or final physical fit; complete [commissioning](../../docs/commissioning.md).
