"""Rebuild the mechanical assembly, STEP/STL/GLB and browser geometry.

Units: mm. X left-to-right, Y top-to-bottom of mounted case, Z back-to-lid.
Manufacturer enclosure geometry is retained; component heights are envelopes.
"""
import json, math, hashlib, xml.etree.ElementTree as ET
from pathlib import Path
import cadquery as cq
import trimesh
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'hardware/3d'
layout = json.loads((ROOT / 'hardware/layout.json').read_text())
parts = []
checks = []
OX, OY = 11.0, 11.0
FLOOR = 3.0
# 8 mm blocks + two full 1.1 mm VHB 5952 layers; no assumed compression.
CZ = FLOOR + layout['carrier']['floor_clearance']
ADH = layout['carrier']['adhesive_layer_thickness']
PCBZ = CZ + 2 + 6

def box(x,y,z,w,h,d):
    return cq.Workplane('XY').box(w,h,d,centered=False).val().translate((x,y,z))
def cyl(x,y,z,r,h):
    return cq.Solid.makeCylinder(r,h,cq.Vector(x,y,z))
def ring(x,y,z,outer,inner,h):
    return cyl(x,y,z,outer,h).cut(cyl(x,y,z-0.1,inner,h+0.2))
def hexagon(x,y,z,across,h,hole=0):
    s=cq.Workplane('XY').polygon(6,across/math.cos(math.pi/6)).extrude(h).val().translate((x,y,z))
    return s.cut(cyl(x,y,z-.1,hole,h+.2)) if hole else s
def add(name,shape,color,group,note,explode=(0,0,0),kind='physical'):
    parts.append(dict(name=name,shape=shape,color=color,group=group,note=note,explode=list(explode),kind=kind))
    return shape
def moved(s):
    return s.rotate((0,0,0),(1,0,0),90).translate((12.724,147.873,45))
def test_clear(name,a,b,tolerance=.001):
    v=a.intersect(b).Volume()
    checks.append(dict(check=name,intersection_mm3=round(v,6),pass_check=v<tolerance))
    return v

vendor = cq.importers.importStep(str(OUT/'source/1554R.stp')).solids().vals()
# The file also contains an OPTIONAL steel panel and its four screws: omitted.
base, lid, gasket = moved(vendor[0]), moved(vendor[1]), moved(vendor[3])
vent_hole = cq.Solid.makeCylinder(6.1,20,cq.Vector(80,145,34),cq.Vector(0,1,0))
# Check the actual wall thickness at the proposed bore center before cutting.
probe = cq.Solid.makeCylinder(.1,20,cq.Vector(80,145,34),cq.Vector(0,1,0))
wall = base.intersect(probe)
wall_thickness = wall.Volume()/(math.pi*.1**2)
assert 2 <= wall_thickness <= 3.5, wall_thickness
base = base.cut(vent_hole)
add('Hammond case — drilled base',base,'#a9b5b8','Case','Original Hammond STEP; added Ø12.2 mm vent bore at X80 / Z34. Purchased 1554R2GY.',(0,0,0))
add('Hammond cover',lid,'#b7c2c5','Cover','Original manufacturer cover. Includes the supplied lid screws and gasket.',(0,0,100))
add('Cover gasket',gasket,'#242b2f','Cover','Original gasket geometry; illustrative unloaded position from vendor assembly.',(0,0,75))
for i in range(4,12):
    add(f'Cover hardware {i-3}',moved(vendor[i]),'#adb0b3','Cover','Original supplied cover fastener geometry.',(0,0,120 if i<8 else 0))

c = layout['carrier']
carrier=box(0,0,0,138,138,2)
for x in (0,120):
    for y in (0,120): carrier=carrier.cut(box(x,y,-1,18,18,4))
for h in layout['holes']: carrier=carrier.cut(cyl(h['x'],h['y'],-1,h['diameter']/2,4))
for x,y,w,h in layout['strap_slots']: carrier=carrier.cut(box(x,y,-1,w,h,4))
cq.exporters.export(carrier,str(OUT/'carrier.step'))
cq.exporters.export(carrier,str(OUT/'carrier.stl'),tolerance=.04,angularTolerance=.1)
carrier=carrier.translate((OX,OY,CZ))
add('Insulating carrier',carrier,'#e9dfc7','Carrier','138 × 138 × 2 mm; four 18 mm corner notches; six Ø2.8 mm holes. STEP/STL at local origin for manufacture.',(0,0,18))
test_clear('Carrier versus actual molded base',carrier,base)
test_clear('Carrier versus closed lid',carrier,lid)

for i,(x,y) in enumerate(c['floor_block_centers']):
    x,y=OX+x-5,OY+y-5
    block=box(x,y,FLOOR+ADH,10,10,8)
    pads=box(x,y,FLOOR,10,10,ADH).fuse(box(x,y,FLOOR+8+ADH,10,10,ADH))
    add(f'Floor block {i+1}',block,'#eee4cb','Carrier','10 × 10 × 8 mm insulating block; two 1.1 mm adhesive layers.',(0,0,9))
    add(f'Adhesive tabs {i+1}',pads,'#50555b','Carrier','Full nominal VHB 5952 thickness, 1.1 mm each; combined lift 10.2 mm.',(0,0,9))
    test_clear(f'Floor block {i+1} versus molded bosses',block,base)
cq.exporters.export(box(0,0,0,10,10,8),str(OUT/'floor-block.stl'))

mount_holes=[]
lower_washers=[]
for i,h in enumerate(layout['holes']):
    x,y=OX+h['x'],OY+h['y']; mount_holes.append((x,y))
    standoff=hexagon(x,y,CZ+2,5,6,1.05).fuse(cyl(x,y,CZ-3,1.25,5))
    add(f'Nylon standoff {i+1}',standoff,'#faf4e5','Hardware','M2.5, 6 mm body, 5 mm male stud assumed; verify delivered kit thread length.',(0,0,24))
    # DigiKey MFW020A only BELOW the carrier; its 5.99 mm OD is
    # unsuitable on Feather PCB tops near passives. Direct nylon screw heads.
    washer=ring(x,y,CZ-.51,5.99/2,2.69/2,.51)
    lower_washers.append(washer)
    nut=hexagon(x,y,CZ-2.71,5,2.2,1.25)
    screw=cyl(x,y,PCBZ+1.6-6,1.1,6).fuse(cyl(x,y,PCBZ+1.6,2.25,1.7))
    add(f'Lower nylon washer {i+1}',washer,'#fcf7ed','Hardware','MFW020A: 2.69 mm ID, 5.99 mm OD, 0.51 mm thick. No top PCB washer.',(0,0,14))
    add(f'Nylon nut {i+1}',nut,'#e9e0cd','Hardware','M2.5 nylon nut under carrier.',(0,0,14))
    add(f'Nylon screw {i+1}',screw,'#fff9e9','Hardware','6 mm thread; 4.5 mm maximum head acceptance envelope. Kit head size unpublished; measure and dry-fit. No top washer.',(0,0,48))
    test_clear(f'Mount {i+1} versus base',standoff.fuse(nut),base)
    test_clear(f'Lower washer {i+1} versus base',washer,base)

board_solids={}; lid_distances={}
for name,filename,color in [('AS3935','sensor-SparkFun_AS3935_Lightning_Detector.brd','#b22f40'),('Feather V2','feather-Adafruit ESP32 Feather V2.brd','#27394b')]:
    p=next(v for v in layout['components'] if v['name']==name)
    x,y=OX+p['x'],OY+p['y']
    s=box(x,y,PCBZ,p['w'],p['h'],1.6)
    if name=='Feather V2':
        # Eagle layer-20 contour has four R2.54 quarter-circle corners.
        s=cq.Workplane(obj=s).edges('|Z').fillet(2.54).val()
    holes=mount_holes[:2] if name=='AS3935' else mount_holes[2:]
    for hx,hy in holes: s=s.cut(cyl(hx,hy,PCBZ-.1,1.524 if name=='AS3935' else 1.27,1.8))
    add(name+' PCB',s,color,'Sensor' if name=='AS3935' else 'Feather', 'Outline, rotation and mount centers from original Eagle CAD. 1.6 mm board thickness assumed.',(0,0,42))
    pads=[]
    # Render original through-hole signal pads at their CAD coordinates.
    tree=ET.parse(ROOT/'hardware/reference'/filename)
    packages={v.get('name'):v for v in tree.findall('.//packages/package')}
    bw,bh=(25.4,25.4) if name=='AS3935' else (50.8,22.86)
    def xy(ex,ey):
        ix,iy=ex,bh-ey
        if p['rotation']==90: ix,iy=bh-iy,ix
        else: ix,iy=iy,bw-ix
        return OX+p['x']+ix, OY+p['y']+iy
    for e in tree.findall('.//elements/element'):
        if e.get('package') not in packages: continue
        rot=e.get('rot','R0'); angle=float(rot.split('R')[-1] or 0)*math.pi/180
        for pad in packages[e.get('package')].findall('pad'):
            if e.get('package') in ('STAND-OFF-TIGHT','MOUNTINGHOLE_2.5_PLATED'): continue
            px,py=float(pad.get('x','0')),float(pad.get('y','0'))
            xx=float(e.get('x'))+px*math.cos(angle)-py*math.sin(angle)
            yy=float(e.get('y'))+px*math.sin(angle)+py*math.cos(angle)
            xx,yy=xy(xx,yy)
            # All actual signal pads within the PCB outline; stack top and bottom annuli.
            if x<=xx<=x+p['w'] and y<=yy<=y+p['h']:
                rr=float(pad.get('drill','1'))/2
                pads.append(ring(xx,yy,PCBZ-.015,max(rr+.25,.8),rr,.03))
                pads.append(ring(xx,yy,PCBZ+1.6-.015,max(rr+.25,.8),rr,.03))
    if pads: add(name+' signal pads',cq.Compound.makeCompound(pads),'#d7b967','Sensor' if name=='AS3935' else 'Feather','Through-hole positions extracted from original Eagle package definitions.',(0,0,42))
    if name=='AS3935':
        fx,fy=OX+24.573,OY+22.286
        ferrite=box(fx-5.85,fy-1.75,PCBZ+1.6,11.7,3.5,3.5)
        add('500 kHz ferrite antenna',ferrite,'#555962','Sensor','Antenna center/orientation from original CAD; body height is representative.',(0,0,42))
        chip=box(x+9,y+10,PCBZ+1.6,4,4,1.3)
        components=ferrite.fuse(chip)
        add('AS3935 IC',chip,'#161d22','Sensor','Representative package at breakout center; tiny passives omitted.',(0,0,42))
    else:
        shield=box(x+2.43,y+24,PCBZ+1.6,18,17,3.2)
        antenna=box(x+2.43,y+41,PCBZ+1.6,18,8,1)
        usb=box(x+7.08,y-1,PCBZ+1.6,8.7,7,3.4)
        jst=box(x+15.36,y+9,PCBZ+1.6,7.5,8,4.5)
        add('ESP32 module / shield',shield,'#b8bfc5','Feather','Representative module body; outline fits reserved Feather volume.',(0,0,42))
        add('ESP32 PCB antenna',antenna,'#696762','Feather','Antenna zone at lower end; leave free of ties, wire bundles and metal.',(0,0,42))
        add('USB-C socket',usb,'#c2c6c9','Feather','Representative connector body; USB service clearance highlighted separately.',(0,0,42))
        add('JST-PH battery socket',jst,'#eee9db','Feather','Representative socket body; lead exit shown schematically.',(0,0,42))
        components=shield.fuse(antenna).fuse(usb).fuse(jst)
    board_solids[name]=s.fuse(components)
    test_clear(name+' versus base',board_solids[name],base)
    test_clear(name+' versus closed cover',board_solids[name],lid)
    # Check the conservative component envelope as well as the simplified bodies.
    envelope=box(x,y,PCBZ,p['w'],p['h'],FLOOR+p['top_z']-PCBZ)
    test_clear(name+' maximum height envelope versus base',envelope,base)
    test_clear(name+' maximum height envelope versus closed cover',envelope,lid)
    lid_distances[name]=round(envelope.distance(lid),3)
    add(name+' maximum height envelope',envelope,'#9f87c9','Clearances','Conservative board body/height envelope from layout.json, including both full-thickness 1.1 mm adhesive layers.',kind='keepout')

foam=box(OX+22.5,OY+52.5,CZ+2,55,65,2)
battery=box(OX+25,OY+52.5,CZ+4,50,65,8)
add('Battery cushion',foam,'#767d80','Battery','2 mm nonconductive closed-cell foam; representative 55 × 65 mm pad.',(0,0,34))
add('2500 mAh LiPo pouch',battery,'#bfc7cb','Battery','Representative 50 × 65 × 8 mm pack, NOT an exact vendor CAD model. Reserved space is 60 × 70 × 10 mm plus lead bend.',(0,0,54))
add('Battery protection / taped edge',box(OX+64,OY+52.5,CZ+4,10,8,8),'#e9bf51','Battery','Representative insulation around protection electronics. Check delivered pack revision.',(0,0,54))
# Soft strap around pouch, lifted off the carrier at battery height.
strap=box(OX+17.5,OY+64,CZ+2,1.5,10,12).fuse(box(OX+82,OY+64,CZ+2,1.5,10,12)).fuse(box(OX+17.5,OY+64,CZ+14,66,10,1))
add('Soft battery strap',strap,'#515e66','Battery','10 mm soft ONE-WRAP strap; adjust around delivered pouch without compressing it.',(0,0,57))
desiccant=box(OX+50,OY+13,CZ+2,45,28,8)
add('1 g desiccant sachet reserve',desiccant,'#e7c68c','Accessories','45 × 28 × 8 mm conservative envelope covers both published footprints of 1GR.INDICATING. Check delivered sealed packet; humidity buffer only.',(0,0,36))
test_clear('Desiccant reserve versus battery',desiccant,battery)
test_clear('Desiccant reserve versus battery maximum envelope',desiccant,box(OX+20,OY+50,CZ+4,60,70,10))
test_clear('Desiccant reserve versus closed lid',desiccant,lid)
for name,s in board_solids.items():test_clear('Desiccant reserve versus '+name,desiccant,s)

# External mount washers are not installed internal components. Check the
# selected nominal 7/16-inch OD at the original external mounting wells.
for label,y in [('upper',11),('lower',149)]:
    mount_washer=ring(80,y,9,4.70,2.25,.79)
    test_clear('External '+label+' FWSS008 washer versus molded case',mount_washer,base)

vent= cq.Solid.makeCylinder(6,10,cq.Vector(80,150,34),cq.Vector(0,1,0)).fuse(cq.Solid.makeCylinder(8.5,5,cq.Vector(80,160,34),cq.Vector(0,1,0)))
nut=hexagon(0,0,0,16,3,6).rotate((0,0,0),(1,0,0),90).translate((80,157,34))
# O-ring outside wall at Y160, body profile approximated from product drawing.
seal=ring(0,0,0,8,6,.6).rotate((0,0,0),(1,0,0),90).translate((80,160.1,34))
add('M12 membrane vent',vent,'#283439','Vent','Amphenol specified thread/flange envelope; detailed membrane internals and threads omitted.',(0,28,0))
add('Vent nylon nut',nut,'#3a464a','Vent','Representative 16 mm wrench-flat nut; reserve Ø24 mm tool access.',(0,-10,0))
add('Vent O-ring',seal,'#171f24','Vent','Representative compressed O-ring; follow manufacturer assembly torque.',(0,28,0))
test_clear('Vent versus carrier',vent.fuse(nut),carrier)
test_clear('Vent versus battery reserve',vent.fuse(nut),box(OX+20,OY+50,CZ+4,60,70,10))

# Swept straight segments: routing concept; eight individual direct-solder wires.
def wire(points,r=.4):
    segments=[]
    for a,b in zip(points,points[1:]):
        va,vb=cq.Vector(*a),cq.Vector(*b); delta=vb-va
        segments.append(cq.Solid.makeCylinder(r,delta.Length,va,delta.normalized()))
    return cq.Compound.makeCompound(segments)
colors=['#db4f4b','#262c32','#e1be53','#64b591','#72a8d1','#c27ca1','#e68b4c','#ddd9ca']
for i,col in enumerate(colors):
    # Route up from right-facing sensor header, across upper carrier, then down to Feather.
    zz=PCBZ+2.3+i*.12
    points=[(OX+36,OY+24+i*2.54,zz),(OX+42+i,OY+24+i*2.54,zz),(OX+48+i,OY+42,zz),(OX+91+i,OY+42,zz),(OX+96+i*.6,OY+71+i*2.54,zz),(OX+102.5,OY+71+i*2.54,zz)]
    add(f'Signal wire {i+1}',wire(points),col,'Wiring','Representative wire route, not a pin-identification diagram. Use the separate wiring.svg for exact nets.',(0,0,44))
for name,color,off in [('Battery positive lead','#db4f4b',0),('Battery negative lead','#292e34',1.2)]:
    points=[(OX+70,OY+55+off,CZ+9),(OX+85,OY+55+off,CZ+12),(OX+91,OY+60+off,CZ+12),(OX+116,OY+78+off,PCBZ+4)]
    add(name,wire(points,.65),color,'Wiring','Representative JST lead route; allow a gentle bend and verify polarity.',(0,0,50))

# Resistor junctions/anchors are shown alongside the harness, outside antenna zones.
for i,y in enumerate((29,40)):
    body=cq.Solid.makeCylinder(1.2,6.3,cq.Vector(OX+43,OY+y,PCBZ+2),cq.Vector(0,1,0))
    sleeve=cq.Solid.makeCylinder(1.6,10,cq.Vector(OX+43,OY+y-2,PCBZ+2),cq.Vector(0,1,0)).cut(cq.Solid.makeCylinder(1.25,10,cq.Vector(OX+43,OY+y-2,PCBZ+2),cq.Vector(0,1,0)))
    add(f'100 kohm pull-down resistor {i+1}',body,'#bbac8b','Wiring','Representative 1/4 W axial body at sensor end. Exact electrical connection: SCK/MOSI to GND per wiring.svg; routing is schematic.',(0,0,44))
    add(f'Resistor heat-shrink {i+1}',sleeve,'#444b54','Wiring','Representative insulated resistor junction. Prepare and shrink away from the battery.',(0,0,44))
for i,(x,y) in enumerate(((101,30),(84,88))):
    anchor=box(OX+x,OY+y,CZ+2,13,13,3.2)
    add(f'Wire anchor {i+1}',anchor,'#deddd3','Accessories','Selected 13 × 13 × 3.2 mm nylon adhesive anchor; positions revised for the purchased size. Route ties clear of both antennas.',(0,0,32))
    test_clear(f'Wire anchor {i+1} versus battery',anchor,battery)
    test_clear(f'Wire anchor {i+1} versus battery reserve',anchor,box(OX+20,OY+50,CZ+4,60,70,10))
    for name,s in board_solids.items():
        test_clear(f'Wire anchor {i+1} versus {name}',anchor,s)
    test_clear(f'Wire anchor {i+1} versus closed cover',anchor,lid)

for name,x,y,w,h,z,d in [('Battery maximum envelope',20,50,60,70,CZ+4,10),('USB-C insertion clearance',100,45,22.86,20,PCBZ,12),('Battery lead bend clearance',80,50,20,30,PCBZ,12)]:
    add(name,box(OX+x,OY+y,z,w,h,d),'#72bfc1','Clearances','Reserved volume; transparent guide, not a physical part.',kind='keepout')
tool = cq.Solid.makeCylinder(12,10,cq.Vector(80,147,34),cq.Vector(0,1,0))
add('Vent nut / tool access',tool,'#e4bb65','Clearances','Ø24 mm internal tool-access reserve. Do not install wires or pouch in this volume.',kind='keepout')

for name,s in [('AS3935',board_solids['AS3935']),('Feather',board_solids['Feather V2']),('battery pouch',battery)]:
    for other,t in [('vent access',tool)]: test_clear(name+' versus '+other,s,t)
test_clear('Board-to-board',board_solids['AS3935'],board_solids['Feather V2'])
test_clear('Battery versus sensor',battery,board_solids['AS3935'])
test_clear('Battery versus Feather',battery,board_solids['Feather V2'])
test_clear('Battery reserve versus base',box(OX+20,OY+50,CZ+4,60,70,10),base)
test_clear('Battery reserve versus closed lid',box(OX+20,OY+50,CZ+4,60,70,10),lid)

assembly=cq.Assembly(name='Lightning_detector_V1')
mesh_data=[]; scene=trimesh.Scene()
for n,p in enumerate(parts):
    hexcol=p['color']; rgb=[int(hexcol[i:i+2],16) for i in (1,3,5)]
    if p['kind']=='physical': assembly.add(p['shape'],name=f'{n:02d}_'+p['name'].replace('/','_').replace('—','-'),color=cq.Color(*[v/255 for v in rgb]))
    vertices,faces=p['shape'].tessellate(.18,.15)
    verts=[[round(v.x,4),round(v.y,4),round(v.z,4)] for v in vertices]
    mesh=trimesh.Trimesh(vertices=verts,faces=faces,process=False)
    if p['kind']=='physical':
        mesh.visual.vertex_colors=rgb+[255]
        mesh.apply_scale(.001); mesh.units='m'  # glTF uses meters; STEP and viewer stay mm.
        scene.add_geometry(mesh,node_name=p['name'])
    mesh_data.append({k:v for k,v in p.items() if k!='shape'} | {'vertices':verts,'faces':faces})
assembly.save(str(OUT/'assembly.step'))
scene.export(str(OUT/'assembly.glb'))
report={'date':'2026-10-05','units':'mm','coordinate_system':'X left, Y downward on mounted case, Z from outside back toward lid','case_source':'https://www.hammfg.com/files/parts/stp/1554R2GY.zip?v=1697661989','case_step_sha256':hashlib.sha256((OUT/'source/1554R.stp').read_bytes()).hexdigest(),'case_original_solids':16,'omitted_optional_solids':[2,12,13,14,15],'carrier_bottom_from_outside_back':CZ,'pcb_bottom_from_outside_back':PCBZ,'vent_wall_thickness_mm':round(wall_thickness,4),'minimum_distance_to_closed_lid_mm':lid_distances,'checks':checks,'limitations':['Board outline and mounting centers are CAD-derived; component bodies, heights, wiring, battery, vent details and nylon hardware are representative.','Thread forms, assembly tolerances, gasket compression, adhesive aging, battery swelling, RF performance and enclosure IP rating are not validated by this model.','Printed carrier hole size and screw engagement must be checked on physical parts.']}
(OUT/'fit-report.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
(OUT/'model-data.json').write_text(json.dumps({'parts':mesh_data,'report':report},separators=(',',':')),encoding='utf-8')
failed=[v for v in checks if not v['pass_check']]
print(json.dumps({'parts':len(parts),'physical':sum(p['kind']=='physical' for p in parts),'triangles':sum(len(p['faces']) for p in mesh_data),'checks':len(checks),'failed':failed,'vent_wall_mm':round(wall_thickness,4),'carrier_z':CZ},indent=2))
assert not failed, 'CAD intersections need resolution; see fit-report.json'
