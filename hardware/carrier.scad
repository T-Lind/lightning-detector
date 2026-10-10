// V1 carrier for Hammond 1554R2GY; units mm. Layout source: layout.json.
// Suggested PETG/ASA; dimensions are a dry-fit design, not a production release.
// Mount on 8mm blocks + two 1.1mm adhesive layers = 10.2mm floor lift.
// Board underside: carrier top + 6mm.
// Print flat. Drill final M2.5 clearances if printer undersizes holes.
$fn=40;
w=138; h=138; t=2; notch=18;
holes=[[14.54,22.54],[14.54,42.86],[102.54,67.54],[120.32,67.54],[102.54,113.26],[120.32,113.26]];
difference(){
  cube([w,h,t]);
  for(x=[0,w-notch])for(y=[0,h-notch])translate([x,y,-1])cube([notch,notch,t+2]);
  for(p=holes)translate([p[0],p[1],-1])cylinder(d=2.8,h=t+2);
  for(x=[16,81])translate([x,63,-1])cube([3,12,t+2]);
}
