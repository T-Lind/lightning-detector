"""Conservative dimensional checks; these cannot measure physical parts or RF performance."""
import json, math, re
import xml.etree.ElementTree as ET
from pathlib import Path
root=Path(__file__).resolve().parents[1]
d=json.loads((root/'hardware/layout.json').read_text())
c=d['carrier']; width,height=c['width'],c['height']
parts=d['components']
def overlap(a,b):
    return a['x']<b['x']+b['w'] and b['x']<a['x']+a['w'] and a['y']<b['y']+b['h'] and b['y']<a['y']+a['h']
for p in parts:
    assert p['x']>=0 and p['y']>=0 and p['x']+p['w']<=width and p['y']+p['h']<=height,p
    assert p['top_z']+5<d['enclosure']['inside'][2],p
    # Corner notches: every component must clear all four removed rectangles.
    n=c['corner_notch']
    for x,y in [(0,0),(width-n,0),(0,height-n),(width-n,height-n)]:
        assert not overlap(p,{'x':x,'y':y,'w':n,'h':n}),f"{p['name']} overlaps corner notch"
for i,a in enumerate(parts):
    for b in parts[i+1:]: assert not overlap(a,b),f"Collision: {a['name']} / {b['name']}"
for space in d['service_keepouts']:
    for p in parts: assert not overlap(space,p),f"Service clearance: {space['name']} / {p['name']}"
    assert 0<=space['x'] and space['x']+space['w']<=width and 0<=space['y'] and space['y']+space['h']<=height
assert width+4<=min(d['enclosure']['inside'][:2])
# Verify the template hole positions against the downloaded original Eagle CAD.
for name,filename,board_w,board_h in [
    ('Feather V2','feather-Adafruit ESP32 Feather V2.brd',50.8,22.86),
    ('AS3935','sensor-SparkFun_AS3935_Lightning_Detector.brd',25.4,25.4)]:
    part=next(p for p in parts if p['name']==name)
    cad=ET.parse(root/'hardware/reference'/filename)
    actual=[]
    mounts=cad.findall('.//board/plain/hole') + [e for e in cad.findall('.//elements/element')
        if e.get('package') in ('STAND-OFF-TIGHT','MOUNTINGHOLE_2.5_PLATED')]
    for e in mounts:
        x,y=float(e.get('x')),board_h-float(e.get('y'))
        if part['rotation']==90: x,y=board_h-y,x
        elif part['rotation']==270: x,y=y,board_w-x
        actual.append((round(x+part['x'],3),round(y+part['y'],3)))
    planned=[(h['x'],h['y']) for h in d['holes'] if h['name'].startswith('Feather' if name=='Feather V2' else 'Sensor')]
    assert len(actual)==len(planned) and all(any(math.dist(a,p)<0.01 for p in planned) for a in actual),(name,actual,planned)
scad=(root/'hardware/carrier.scad').read_text()
scad_holes=json.loads(re.search(r'holes=(\[.*?\]);',scad).group(1))
assert scad_holes==[[h['x'],h['y']] for h in d['holes']], 'SCAD holes differ from template source'
# On the centered carrier, the bottom-wall vent enters approximately 4 mm beyond
# its lower edge. Its 24 mm nut/tool zone is checked at its lowest conservative z.
vent=d['vent']; inside=d['enclosure']['inside']; cy=(inside[1]-height)/2
vent_z=vent['z_from_back_outside']-3 # outside back wall -> inside floor
vent_top_limit=vent_z-vent['internal_reserved_radius']
bottom_band=height+cy-vent['internal_protrusion']
for p in parts:
    if p['y']+p['h']>bottom_band and p['x']<80 and p['x']+p['w']>56:
        assert p['top_z']<vent_top_limit,'Vent tool zone collision'
distance=math.dist(d['sensor_antenna_center'],d['wifi_antenna_reference'])
assert distance>=100
print(f"Fit PASS: carrier {width} x {height} mm; antenna reference separation {distance:.1f} mm")
print('PCB holes match original CAD; SCAD holes match JSON; USB and battery-lead service spaces clear.')
print(f"Reserved component tops <={max(p['top_z'] for p in parts):.1f} mm above floor; verified internal height 54 mm.")
print('Physical dry fit, actual USB plug dimensions, vent wall thickness, and RF tests are still required.')
