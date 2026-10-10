"""Check the specified screw-head envelope against original Eagle pad geometry.

This is a nominal planar clearance check, not a claim about the supplied kit's
unpublished head dimensions or actual solder fillets/component bodies.
"""
import json, math, xml.etree.ElementTree as ET
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]

def segment_distance(point,a,b):
    dx,dy=b[0]-a[0],b[1]-a[1]
    t=max(0,min(1,((point[0]-a[0])*dx+(point[1]-a[1])*dy)/(dx*dx+dy*dy))) if dx*dx+dy*dy else 0
    return math.dist(point,(a[0]+t*dx,a[1]+t*dy))

results=[]
for file in (ROOT/'hardware/reference').glob('*.brd'):
    tree=ET.parse(file)
    packages={p.get('name'):p for p in tree.findall('.//packages/package')}
    elements=tree.findall('.//elements/element')
    mounts=tree.findall('.//board/plain/hole')+[e for e in elements if e.get('package') in ('STAND-OFF-TIGHT','MOUNTINGHOLE_2.5_PLATED')]
    for hole in mounts:
        center=(float(hole.get('x')),float(hole.get('y')))
        distances=[]
        for e in elements:
            pkg=e.get('package')
            if pkg not in packages or pkg in ('STAND-OFF-TIGHT','MOUNTINGHOLE_2.5_PLATED') or 'FIDUCIAL' in pkg:
                continue
            angle=math.radians(float(e.get('rot','R0').split('R')[-1]))
            mirror=-1 if 'M' in e.get('rot','') else 1
            def transform(x,y):
                return (float(e.get('x'))+mirror*x*math.cos(angle)-y*math.sin(angle),
                        float(e.get('y'))+mirror*x*math.sin(angle)+y*math.cos(angle))
            for pad in list(packages[pkg].findall('smd'))+list(packages[pkg].findall('pad')):
                x,y=float(pad.get('x','0')),float(pad.get('y','0'))
                dx=float(pad.get('dx',pad.get('diameter','2')))/2
                dy=float(pad.get('dy',pad.get('diameter','2')))/2
                pa=math.radians(float(pad.get('rot','R0').split('R')[-1]))
                corners=[transform(x+cx*math.cos(pa)-cy*math.sin(pa),y+cx*math.sin(pa)+cy*math.cos(pa))
                         for cx,cy in [(-dx,-dy),(dx,-dy),(dx,dy),(-dx,dy)]]
                distance=min(segment_distance(center,corners[i],corners[(i+1)%4]) for i in range(4))
                distances.append((distance,e.get('name'),pad.get('name')))
        distance,component,pad=min(distances)
        assert distance>2.25, (file.name,center,component,distance)
        results.append(dict(board=file.name,original_hole_center=center,nearest_component=component,pad=pad,
                            nearest_pad_edge_mm=round(distance,6),specified_max_head_diameter_mm=4.5,
                            nominal_clearance_mm=round(distance-2.25,6)))
report=dict(checks=results,minimum_nominal_clearance_mm=min(r['nominal_clearance_mm'] for r in results),
            limitations='Kit head diameter unpublished. Measure <=4.5mm and dry-fit every head; do not press on components or solder. Pad shapes use exact SMD rectangles and conservative through-hole bounding squares; physical solder and package bodies are not qualified.')
(ROOT/'verification').mkdir(exist_ok=True)
(ROOT/'verification/board-fastener-fit.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
print(f"PASS: {len(results)} mounting head envelopes against nominal CAD pads; minimum clearance {report['minimum_nominal_clearance_mm']:.3f}mm. Physical kit heads remain unverified.")
