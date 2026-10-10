"""Generate reviewable vector wiring, mechanical and timing drawings."""
import json, math
from pathlib import Path
from xml.sax.saxutils import escape
root=Path(__file__).resolve().parents[1]
out=root/'hardware/drawings'; out.mkdir(exist_ok=True)
def svg_start(w,h):
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}"><style>text{{font-family:Arial,sans-serif;fill:#183236}}.small{{font-size:13px}}.muted{{fill:#5d7275}}.title{{font-size:25px;font-weight:bold}}</style><rect width="100%" height="100%" fill="#f7faf8"/>'
def text(x,y,s,size=16,cls=''):
    return f'<text x="{x}" y="{y}" font-size="{size}" class="{cls}">{escape(s)}</text>'
def rect(x,y,w,h,fill='#e2eee9',stroke='#335955',rx=8):
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{fill}" stroke="{stroke}"/>'
def line(x,y,xx,yy,color='#335955',width=2,dash=''):
    return f'<path d="M{x} {y} L{xx} {yy}" fill="none" stroke="{color}" stroke-width="{width}" stroke-dasharray="{dash}"/>'
s=svg_start(1000,720)+text(40,48,'V1 / Electrical wiring',cls='title')+text(40,74,'Logical connections. Match pad LABELS on each board; positions below are not a physical pinout.',14,'muted')
s+=rect(50,140,255,370)+text(74,174,'Adafruit Feather V2',20)+rect(720,140,230,370)+text(743,174,'SparkFun SEN-15441',19)
pins=[('3V (always on)','3V3','#c8514c'),('GND','GND','#273f48'),('D33 / GPIO33','INT (active HIGH)','#a06617'),('D27 / GPIO27','CS','#855bac'),('SCK / GPIO5','SCK','#527bb6'),('MI / GPIO21','MISO','#397765'),('MO / GPIO19','MOSI','#9b597b')]
for i,(left,right,color) in enumerate(pins):
    y=216+i*40
    s+=text(75,y,left,15)+text(739,y,right,15)+line(306,y-5,719,y-5,color)+text(470,y-11,'1 MHz SPI mode 1' if i==4 else '',12)
s+=text(50,540,'Battery: Adafruit 328, protected 1S 3.7V LiPo → Feather JST-PH socket',16)
s+=text(50,568,'At SENSOR end: R1 100kΩ SCK → GND; R2 100kΩ MOSI → GND. Onboard R8 holds CS high.',15)
s+=text(50,595,'8-wire harness: GND, 3V3, INT, GND, CS, SCK, MISO, MOSI. Connect both grounds.',15)
s+=text(50,623,'Cut sensor LED jumper after bench test. Preserve the factory SPI interface jumper.',15)
s+=text(50,650,'Power the sensor from main 3V. GPIO35 battery divider is already on the Feather.',15)
s+=text(50,679,'USB-C is used indoors for programming / charging; there is no USB hole in the enclosure.',14,'muted')+'</svg>'
(out/'wiring.svg').write_text(s,encoding='utf-8')

d=json.loads((root/'hardware/layout.json').read_text()); scale=3.2; ox=65; oy=130
s=svg_start(1050,720)+text(40,45,'V1 / Enclosure and carrier layout',cls='title')+text(40,74,'Hammond 1554R2GY · 160 × 160 × 60.5 mm · top view · all dimensions in mm',15,'muted')
s+=rect(ox-11*scale,oy-11*scale,160*scale,160*scale,'#edf1ef','#758982',0)
s+=rect(ox,oy,138*scale,138*scale,'#ffffff','#335955',0)
for x in [0,120]:
    for y in [0,120]: s+=rect(ox+x*scale,oy+y*scale,18*scale,18*scale,'#edf1ef','#758982',0)
for p in d['components']:
    x,y,w,h=[p[k]*scale for k in ['x','y','w','h']]
    s+=rect(ox+x,oy+y,w,h,'#f9dfba' if 'Battery' in p['name'] else '#d4e8dd','#335955',3)
    label=p['name'].replace(' reserved envelope','').replace('Feather V2','Feather')
    s+=text(ox+x+6,oy+y+(28 if p['name']=='AS3935' else 28),label,11)
    s+=text(ox+x+6,oy+y+45,f"{p['w']} × {p['h']}",9)
for p in d['service_keepouts']:
    s+=rect(ox+p['x']*scale,oy+p['y']*scale,p['w']*scale,p['h']*scale,'#edf4ff','#537eb4',0)
    s+=text(ox+p['x']*scale+3,oy+p['y']*scale+15,'USB space' if p['name'].startswith('USB') else 'Lead bend',10)
for h in d['holes']:
    s+=f'<circle cx="{ox+h["x"]*scale}" cy="{oy+h["y"]*scale}" r="4.5" fill="white" stroke="#335955"/>'
for a in d['strap_slots']: s+=rect(ox+a[0]*scale,oy+a[1]*scale,a[2]*scale,a[3]*scale,'white','#335955',0)
x,y=d['sensor_antenna_center']; s+=rect(ox+(x-5.85)*scale,oy+(y-1.75)*scale,11.7*scale,3.5*scale,'#304344','#304344',1)
x,y=d['wifi_antenna_reference'];s+=text(ox+(x-9)*scale,oy+(y+9)*scale,'Wi-Fi ↓',11)
s+=text(ox,oy-11,'138 mm notched carrier, centered in enclosure',14)
s+=f'<circle cx="{ox+69*scale}" cy="{oy+149*scale}" r="7" fill="#537eb4"/>'
s+=text(ox+69*scale+14,oy+149*scale+16,'Bottom-wall vent',12)
s+=text(590,150,'Mechanical allowances',19)
separation=math.dist(d['sensor_antenna_center'],d['wifi_antenna_reference'])
notes=['Carrier: 138 × 138 × 2; 18 × 18 corner notches','Floor lift: 10.2 mm; PCB standoffs: 6 mm','Board top allowance: ≤30.2 mm above floor','Available internal height: 54 mm','Battery envelope: 60 × 70 × 10 mm','Battery is beside boards; nothing on top of pouch','Feather USB: 20 mm plug space above board',f'Antenna reference separation: {separation:.0f} mm','Keep wires off both antenna zones','Four Feather screws; two sensor screws','Vent: bottom-facing wall, x=80 from outside left','Vent center: z=34 from outside back','Hole: Ø12.2 ±0.1 per vent drawing','No holes through enclosure back or gasket']
for i,n in enumerate(notes):s+=text(590,180+26*i,n,14)
s+=text(65,642,'Vertical box installation: ferrite axis horizontal, sensor header to right. Origin: carrier upper-left.',14,'muted')
s+=text(65,670,'Drawing confirms reserved volumes. Dry-fit the delivered parts and USB cable before drilling the vent.',14,'muted')+'</svg>'
(out/'enclosure-layout.svg').write_text(s,encoding='utf-8')

# Full-size fabrication template; no ambiguous printer rescaling.
s=svg_start('180mm','180mm').replace('viewBox="0 0 180mm 180mm"','viewBox="0 0 180 180"')
s+=rect(20,20,138,138,'none','#000',0)
for x in [20,140]:
    for y in [20,140]:s+=rect(x,y,18,18,'white','#000',0)
for h in d['holes']:s+=f'<circle cx="{20+h["x"]}" cy="{20+h["y"]}" r="1.4" fill="none" stroke="black" stroke-width=".25"/>'
for x,y,w,h in d['strap_slots']:s+=rect(20+x,20+y,w,h,'none','#000',0)
s+=line(20,168,70,168,'#000',.4)+line(20,165,20,171,'#000',.4)+line(70,165,70,171,'#000',.4)+text(75,169,'50 mm scale check',3)
s+=text(20,13,'PRINT AT 100% · V1 CARRIER · CHECK SCALE BEFORE DRILLING',3)+'</svg>'
(out/'carrier-template-1to1.svg').write_text(s,encoding='utf-8')

s=svg_start(1000,530)+text(40,45,'V1 / Wake, capture, upload, sleep',cls='title')
steps=[('AS3935 listening','ESP32 deep asleep'),('INT high','ESP32 wakes'),('Read result first','SPI + ≥2 ms delay'),('Save queue','Durable flash slots'),('Wi-Fi / HTTPS','Signed batch + ACK'),('Return to sleep','Timer + GPIO33')]
for i,(title,sub) in enumerate(steps):
    x=40+(i%3)*320;y=110+(i//3)*150
    s+=rect(x,y,285,100)+text(x+16,y+35,f'{i+1}. {title}',19)+text(x+16,y+67,sub,14,'muted')
s+=text(40,444,'Sensor remains powered at all times. ESP32 only wakes for events, queued retries, or health reports.',15)
s+=text(40,475,'Cloud keeps the activity window. Overdue/faulty sensor → UNKNOWN. No bearing is measured.',15)
s+=text(40,504,'A sensor result can be overwritten by later events; burst completeness is not guaranteed.',14,'muted')+'</svg>'
(out/'operation.svg').write_text(s,encoding='utf-8')
print('Generated four SVG drawings.')
