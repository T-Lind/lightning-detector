import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
const data=window.ASSEMBLY;
document.querySelector('.badge').textContent=data.report.checks.length+' geometric fit checks passed';
const stage=document.querySelector('#stage'),canvas=document.querySelector('#canvas');
let renderer;
try{renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true});}
catch(e){const p=document.querySelector('#error');p.style.display='block';p.textContent='WebGL could not start. Open this HTML file in Chrome or Edge with hardware acceleration, or open assembly.step in a CAD viewer.';throw e;}
renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
renderer.setClearColor(0x000000,0);
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.5;
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(37,1,.1,3000);camera.up.set(0,0,1);
const controls=new OrbitControls(camera,canvas);controls.enableDamping=true;controls.dampingFactor=.08;controls.minDistance=85;controls.maxDistance=1000;
scene.add(new THREE.AmbientLight(0xdce8f2,1.3));
for(const [xyz,intensity,col] of [[[130,-120,310],3,0xffffff],[[-150,200,140],2,0xa2c8e4],[[200,200,-80],1.6,0xe8b679]]){const light=new THREE.DirectionalLight(col,intensity);light.position.set(...xyz);scene.add(light);}
const grid=new THREE.GridHelper(320,32,0x526674,0x30434f);grid.rotation.x=Math.PI/2;grid.position.set(80,80,-.8);grid.material.transparent=true;grid.material.opacity=.25;scene.add(grid);
const meshes=[],groups=new Map(),byName=new Map();
for(const p of data.parts){
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p.vertices.flat(),3));g.setIndex(p.faces.flat());g.computeVertexNormals();g.computeBoundingBox();
 const mat=new THREE.MeshStandardMaterial({color:p.color,roughness:p.group==='Wiring'?.75:.6,metalness:p.name.includes('shield')||p.name.includes('socket')||p.name.includes('hardware')?.45:.08,side:THREE.DoubleSide});
 if(p.kind==='keepout'){mat.transparent=true;mat.opacity=.15;mat.depthWrite=false;mat.wireframe=false;}
 const mesh=new THREE.Mesh(g,mat);mesh.userData=p;mesh.renderOrder=p.kind==='keepout'?3:0;scene.add(mesh);meshes.push(mesh);byName.set(p.name,mesh);
 if(!groups.has(p.group))groups.set(p.group,{on:true,color:p.color});
}
const container=document.querySelector('#groups');
for(const [name,group]of groups){if(name==='Clearances'||name==='Cover')continue;const div=document.createElement('div');div.className='group';const label=document.createElement('label');const cb=document.createElement('input');cb.type='checkbox';cb.checked=true;cb.addEventListener('change',()=>{group.on=cb.checked;apply();});const sw=document.createElement('span');sw.className='color';sw.style.background=group.color;label.append(cb,sw,document.createTextNode(name));div.append(label);container.append(div);}
const namedLabels=[['AS3935 PCB','Lightning sensor',new THREE.Vector3(36,45,30)],['Feather V2 PCB','Feather ESP32 V2',new THREE.Vector3(122,103,30)],['2500 mAh LiPo pouch','2500 mAh battery',new THREE.Vector3(59,96,25)],['M12 membrane vent','M12 vent',new THREE.Vector3(80,165,42)],['Insulating carrier','Insulating carrier',new THREE.Vector3(80,38,16)]];
const labels=namedLabels.map(([name,label,anchor])=>{const el=document.createElement('div');el.className='label';el.textContent=label;document.querySelector('#labels').append(el);return{name,el,anchor};});
let selected=null,outline=null;
function apply(){
 const explode=Number(document.querySelector('#explode').value)/100;
 document.querySelector('#explode-value').textContent=explode===0?'Assembled':Math.round(explode*100)+'%';
 for(const mesh of meshes){const p=mesh.userData;mesh.position.set(...p.explode).multiplyScalar(explode);mesh.visible=groups.get(p.group).on;
 if(p.group==='Cover')mesh.visible=document.querySelector('#cover').checked;
 if(p.kind==='keepout')mesh.visible=document.querySelector('#keepouts').checked;
 if(p.group==='Case'||p.name==='Hammond cover'){const transparent=document.querySelector('#transparent').checked;mesh.material.transparent=transparent;mesh.material.opacity=transparent?.21:1;mesh.material.depthWrite=!transparent;mesh.renderOrder=transparent?2:0;}
 }
 if(outline&&selected)outline.position.copy(selected.position);
}
for(const id of ['explode','cover','transparent','keepouts'])document.querySelector('#'+id).addEventListener('input',apply);
function fitView(){
 const bounds=new THREE.Box3();
 for(const mesh of meshes){if(mesh.visible&&mesh.userData.kind==='physical'){mesh.updateMatrixWorld(true);bounds.expandByObject(mesh);}}
 const sphere=bounds.getBoundingSphere(new THREE.Sphere());
 const vertical=THREE.MathUtils.degToRad(camera.fov)/2;
 const horizontal=Math.atan(Math.tan(vertical)*camera.aspect);
 const distance=sphere.radius/Math.sin(Math.min(vertical,horizontal))*1.16;
 const direction=camera.position.clone().sub(controls.target).normalize();
 controls.target.copy(sphere.center);camera.position.copy(sphere.center).addScaledVector(direction,distance);controls.update();
}
function view(name){
 // Flush any pending damping rotation before applying a preset.
 controls.enableDamping=false;controls.update();
 const center=new THREE.Vector3(80,80,document.querySelector('#explode').value>0?60:24);
 const v={iso:[210,250,235],top:[0,.01,340],front:[0,330,55],bottom:[0,320,110]}[name]||[210,250,235];
 camera.position.copy(center).add(new THREE.Vector3(...v));controls.target.copy(center);controls.update();fitView();controls.enableDamping=true;
}
document.querySelector('#fit').addEventListener('click',fitView);
for(const b of document.querySelectorAll('[data-view]'))b.addEventListener('click',()=>view(b.dataset.view));
document.querySelector('#reset').addEventListener('click',()=>{document.querySelector('#explode').value=0;document.querySelector('#cover').checked=false;document.querySelector('#transparent').checked=true;document.querySelector('#keepouts').checked=false;for(const g of groups.values())g.on=true;for(const cb of container.querySelectorAll('input'))cb.checked=true;apply();view('iso');});
let start=null;
canvas.addEventListener('pointerdown',e=>{start={x:e.clientX,y:e.clientY};});
canvas.addEventListener('pointerup',e=>{if(!start||Math.hypot(e.clientX-start.x,e.clientY-start.y)>5)return;const rect=canvas.getBoundingClientRect();const pointer=new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,-((e.clientY-rect.top)/rect.height)*2+1);const ray=new THREE.Raycaster();ray.setFromCamera(pointer,camera);
 const candidates=meshes.filter(m=>m.visible&&m.userData.kind!=='keepout'&&!(m.userData.group==='Case'&&m.material.transparent));let hit=ray.intersectObjects(candidates,false)[0];if(!hit)hit=ray.intersectObjects(meshes.filter(m=>m.visible&&m.userData.kind!=='keepout'),false)[0];if(hit)select(hit.object);
});
function select(mesh){
 selected=mesh;if(outline){scene.remove(outline);outline.geometry.dispose();outline.material.dispose();}
 const bbox=mesh.geometry.boundingBox;const helper=new THREE.Box3Helper(bbox,0xa4edca);outline=helper;outline.position.copy(mesh.position);scene.add(outline);
 const p=mesh.userData;const panel=document.querySelector('#details');panel.replaceChildren();const h2=document.createElement('h2');h2.textContent='Selected part';const h3=document.createElement('h3');h3.textContent=p.name;const note=document.createElement('p');note.textContent=p.note;const dims=document.createElement('div');dims.className='dim';const size=bbox.getSize(new THREE.Vector3());dims.textContent=`${size.x.toFixed(2)} × ${size.y.toFixed(2)} × ${size.z.toFixed(2)} mm`;const origin=document.createElement('p');origin.textContent=`Assembled bounding-box origin: X ${bbox.min.x.toFixed(2)}, Y ${bbox.min.y.toFixed(2)}, Z ${bbox.min.z.toFixed(2)} mm.`;panel.append(h2,h3,note,dims,origin);
}
new ResizeObserver(()=>{const r=stage.getBoundingClientRect();renderer.setSize(r.width,r.height,false);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();fitView();}).observe(stage);
apply();view('iso');
function tick(){requestAnimationFrame(tick);controls.update();for(const l of labels){const mesh=byName.get(l.name);const v=l.anchor.clone().add(mesh.position).project(camera);l.el.style.display=document.querySelector('#label-toggle').checked&&mesh.visible&&v.z<1&&v.x>-1&&v.x<1&&v.y>-1&&v.y<1?'block':'none';l.el.style.left=((v.x+1)*.5*stage.clientWidth)+'px';l.el.style.top=((-v.y+1)*.5*stage.clientHeight)+'px';}renderer.render(scene,camera);}
tick();
window.viewerReady=true;
