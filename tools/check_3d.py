"""Check delivered mesh dimensions and printable carrier topology.

Run with the CAD virtual environment. This checks output files, not physical parts.
"""
import json
from pathlib import Path
import numpy as np
import trimesh
R=Path(__file__).resolve().parents[1]
d=json.loads((R/'hardware/layout.json').read_text())
model=json.loads((R/'hardware/3d/model-data.json').read_text())
carrier=trimesh.load_mesh(R/'hardware/3d/carrier.stl')
assert carrier.is_watertight and carrier.is_winding_consistent, 'Carrier STL has a topology defect'
assert np.allclose(carrier.extents,[d['carrier'][k] for k in ('width','height','thickness')],atol=.001)
block=trimesh.load_mesh(R/'hardware/3d/floor-block.stl')
assert block.is_watertight and np.allclose(block.extents,[10,10,8],atol=.001)
scene=trimesh.load(R/'hardware/3d/assembly.glb')
physical=[p for p in model['parts'] if p['kind']=='physical']
points=np.concatenate([np.asarray(p['vertices']) for p in physical])
expected=(points.max(axis=0)-points.min(axis=0))*.001
assert np.allclose(scene.extents,expected,atol=.00001), 'GLB dimensions/units differ from the mm model'
assert len(scene.geometry)==len(physical), 'GLB lost physical parts'
assert all(c['pass_check'] for c in model['report']['checks']), 'Recorded collision failure'
for f in ('assembly.step','carrier.step'):
    text=(R/'hardware/3d'/f).read_text()
    assert text.startswith('ISO-10303-21;') and 'END-ISO-10303-21;' in text
print(f"PASS: carrier STL watertight and winding-consistent; {carrier.extents.tolist()} mm.")
print(f"PASS: four-block source STL; {len(physical)} physical meshes preserved in GLB, extents {scene.extents.round(6).tolist()} meters.")
print(f"PASS: STEP file structure and {len(model['report']['checks'])} recorded collision checks.")
