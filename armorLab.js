/** k5t1 no-save interactive armor anatomy and crew-allocation lab.
 * Both viewports use the actual production Cyclops/Kestrel builder. Plate
 * meshes are individually raycastable and follow Kestrel's named joints.
 */
import * as THREE from 'three';
import {createArmoredPrototype,setPrototypePlateHealth,damagePrototypePlate,patchPrototypePlate,
        prototypePlateFromMesh,disposeArmorSpecimen} from './armorPrototype.js';
import {armorMassKg} from './armorPlan.js';
const $=id=>{const el=document.getElementById(id);if(!el)throw Error('Missing '+id);return el;};
const stage=$('armor-stage');
const scene=new THREE.Scene();
scene.background=new THREE.Color(0x3d4b42);
scene.add(new THREE.HemisphereLight(0xe5e5ce,0x27332f,2.0));
const key=new THREE.DirectionalLight(0xf8dda5,2.7);key.position.set(-3,5,-4);scene.add(key);
const rim=new THREE.DirectionalLight(0x8abcb7,1.4);rim.position.set(3,3,3);scene.add(rim);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(10,10),
  new THREE.MeshStandardMaterial({color:0x28362f,roughness:1}));
floor.rotation.x=-Math.PI/2;floor.position.y=-1.05;scene.add(floor);
const grid=new THREE.GridHelper(8,16,0x657569,0x45554a);grid.position.y=-1.048;scene.add(grid);
const renderer=new THREE.WebGLRenderer({antialias:false,powerPreference:'low-power'});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.25));
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.22;
renderer.setScissorTest(true);stage.prepend(renderer.domElement);
const camera=new THREE.PerspectiveCamera(36,1,.03,50);
const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
const state={id:'cab-cyclops',tier:1,selected:null,crew:4,walk:false,
             yaw:-.46,pitch:.18,distance:3.4,drag:null};
let naked=null,armored=null,falling=[],lastTime=0;
const note=text=>{$('armor-feedback').textContent=text;};
function recenter(specimen){
  specimen.root.updateMatrixWorld(true);
  const center=new THREE.Box3().setFromObject(specimen.root).getCenter(new THREE.Vector3());
  specimen.root.position.sub(center);
}
function removeDebris(){
  for(const chunk of falling){chunk.mesh.parent?.remove(chunk.mesh);
    chunk.mesh.geometry.dispose();chunk.mesh.material.dispose();}
  falling=[];
}
function rebuild(){
  removeDebris();
  disposeArmorSpecimen(naked);disposeArmorSpecimen(armored);
  naked=createArmoredPrototype(state.id,0);
  armored=createArmoredPrototype(state.id,state.tier);
  scene.add(naked.root,armored.root);
  recenter(naked);recenter(armored);
  state.selected=armored.plates.keys().next().value??null;
  state.crew=4;state.distance=state.id==='legs-compact'?3.7:3.1;
  const count=armored.plates.size;
  $('armor-tier-label').textContent='LEVEL '+state.tier;
  $('armor-tier').value=String(state.tier);
  $('armor-part').value=state.id;
  $('armor-mass').textContent='+'+armorMassKg(state.id,state.tier)+' KG';
  $('armor-count').textContent=count+' PLATE'+(count===1?'':'S');
  $('armor-walk').disabled=state.id!=='legs-compact';
  if(state.id!=='legs-compact')state.walk=false;
  $('armor-walk').setAttribute('aria-pressed',String(state.walk));
  $('armor-walk').textContent=state.walk?'Ⅱ PAUSE GAIT':'▶ GAIT';
  paintControls();
  note(state.tier===0?'Naked core. Increase armor level to add real removable steel.':
       'Tap an individual armor plate in the right viewport to inspect and damage it.');
}
function paintControls(){
  const list=$('armor-plates');list.replaceChildren();
  let mean=0;
  for(const [id,plate] of armored.plates){
    mean+=plate.health;
    const row=document.createElement('button');
    row.type='button';row.className='armor-plate'+(state.selected===id?' selected':'');
    const title=document.createElement('span');title.textContent=plate.label;
    const meter=document.createElement('meter');meter.min=0;meter.max=1;meter.value=plate.health;
    const value=document.createElement('b');value.textContent=Math.round(plate.health*100)+'%';
    row.append(title,meter,value);
    row.addEventListener('click',()=>{state.selected=id;paintControls();note(plate.label+' · '+Math.round(plate.health*100)+'% · '+plate.region+' · '+plate.massKg+' kg');});
    list.append(row);
  }
  const n=armored.plates.size;
  $('armor-condition').textContent=n?Math.round(mean/n*100)+'% PLATES':'NO ARMOR';
  $('armor-worker-count').textContent='CREW '+state.crew+' / 4';
  $('armor-hit').disabled=$('armor-strip').disabled=!state.selected;
  $('armor-patch').disabled=!state.selected||state.crew===0||
    (armored.plates.get(state.selected)?.health??1)>=.5;
}
function fragment(plate){
  // Visual-only disposable fragment. Never a persistent colliding body.
  const mesh=plate.mesh.clone(false);
  mesh.geometry=plate.mesh.geometry.clone();
  mesh.material=plate.mesh.material.clone();
  plate.mesh.updateWorldMatrix(true,false);
  plate.mesh.matrixWorld.decompose(mesh.position,mesh.quaternion,mesh.scale);
  scene.add(mesh);
  falling.push({mesh,life:.95,velocity:new THREE.Vector3((Math.random()-.5)*.8,.9,Math.random()-.5)});
  if(falling.length>8){
    const old=falling.shift();scene.remove(old.mesh);
    old.mesh.geometry.dispose();old.mesh.material.dispose();
  }
}
function hurt(damage=35){
  const p=armored.plates.get(state.selected);if(!p)return;
  const before=p.health;damagePrototypePlate(armored,p.id,damage);
  if(before>0&&p.health===0)fragment(p);
  note(p.label+' · '+Math.round(p.health*100)+'%'+(p.health===0?' · PLATE GONE, CORE EXPOSED':' · ARMOR ABSORBED IMPACT'));
  paintControls();
}
$('armor-hit').addEventListener('click',()=>hurt(35));
$('armor-strip').addEventListener('click',()=>hurt(9999));
$('armor-patch').addEventListener('click',()=>{
  const p=armored.plates.get(state.selected);if(!p||state.crew<=0||p.health>=.5)return;
  patchPrototypePlate(armored,p.id);state.crew--;
  note('CREW WELDED '+p.label+' → '+Math.round(p.health*100)+'% · '+state.crew+' WORK UNITS REMAIN');
  paintControls();
});
$('armor-repair-reset').addEventListener('click',()=>{removeDebris();
  for(const id of armored.plates.keys())setPrototypePlateHealth(armored,id,1);
  state.crew=4;paintControls();note('SPECIMEN RESET · ALL INSTALLED ARMOR INTACT');});
$('armor-part').addEventListener('change',e=>{state.id=e.target.value;state.tier=state.id==='cab-cyclops'?1:0;rebuild();});
$('armor-tier').addEventListener('input',e=>{const level=Number(e.target.value);if(level!==state.tier){state.tier=level;rebuild();}});
$('armor-walk').addEventListener('click',()=>{if(state.id!=='legs-compact')return;state.walk=!state.walk;
  $('armor-walk').setAttribute('aria-pressed',String(state.walk));
  $('armor-walk').textContent=state.walk?'Ⅱ PAUSE GAIT':'▶ GAIT';});
function aim(yaw,pitch=.18){state.yaw=yaw;state.pitch=pitch;}
$('armor-front').addEventListener('click',()=>aim(0,.12));
$('armor-side').addEventListener('click',()=>aim(-Math.PI/2,.13));
$('armor-rear').addEventListener('click',()=>aim(Math.PI,.13));
$('armor-reset-camera').addEventListener('click',()=>{aim(-.46,.18);state.distance=state.id==='legs-compact'?3.7:3.1;});
function resize(){
  const w=stage.clientWidth,h=stage.clientHeight;
  renderer.setSize(Math.max(1,w),Math.max(1,h),false);
  camera.aspect=Math.max(1,w/2)/Math.max(1,h);camera.updateProjectionMatrix();
}
window.addEventListener('resize',resize);resize();
function pick(clientX,clientY){
  const rect=stage.getBoundingClientRect(),w=rect.width,h=rect.height;
  if(clientX<rect.left+w/2)return;
  const u=(clientX-rect.left-w/2)/(w/2),v=(clientY-rect.top)/h;
  pointer.set(u*2-1,1-v*2);
  armored.root.visible=true;naked.root.visible=false;
  raycaster.setFromCamera(pointer,camera);
  const hits=raycaster.intersectObject(armored.root,true)
    .filter(hit=>hit.object.isMesh&&hit.object.visible);
  if(!hits.length){note('NO COMPONENT UNDER RETICLE');return;}
  const id=prototypePlateFromMesh(hits[0].object);
  if(id&&armored.plates.get(id)?.health>0){
    state.selected=id;const p=armored.plates.get(id);
    note(p.label+' · '+Math.round(p.health*100)+'% · '+p.region+' · TAP HIT OR BREAK OFF');
    paintControls();
  }else{
    note('BARE STRUCTURE · NO FITTED PLATE ON THIS LINE OF SIGHT');
  }
}
const canvas=renderer.domElement;
canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);
  state.drag={x:e.clientX,y:e.clientY,lastX:e.clientX,lastY:e.clientY,moved:false};});
canvas.addEventListener('pointermove',e=>{const d=state.drag;if(!d)return;
  const dx=e.clientX-d.lastX,dy=e.clientY-d.lastY;
  if(Math.hypot(e.clientX-d.x,e.clientY-d.y)>7)d.moved=true;
  state.yaw+=dx*.008;state.pitch=Math.max(-.45,Math.min(.9,state.pitch+dy*.006));
  d.lastX=e.clientX;d.lastY=e.clientY;});
canvas.addEventListener('pointerup',e=>{const d=state.drag;state.drag=null;
  if(d&&!d.moved)pick(e.clientX,e.clientY);});
canvas.addEventListener('pointercancel',()=>{state.drag=null;});
canvas.addEventListener('wheel',e=>{e.preventDefault();
  state.distance=Math.max(1.8,Math.min(7,state.distance+e.deltaY*.003));},{passive:false});
const activeTouches=new Map();
canvas.addEventListener('touchstart',e=>{for(const t of e.changedTouches)activeTouches.set(t.identifier,[t.clientX,t.clientY]);},{passive:true});
canvas.addEventListener('touchmove',e=>{if(e.touches.length===2){
  const t=[...e.touches],prev=t.map(x=>activeTouches.get(x.identifier));
  if(prev.every(Boolean)){
    const previous=Math.hypot(prev[0][0]-prev[1][0],prev[0][1]-prev[1][1]);
    const current=Math.hypot(t[0].clientX-t[1].clientX,t[0].clientY-t[1].clientY);
    if(current>2&&previous>2)state.distance=Math.max(1.8,Math.min(7,state.distance*previous/current));
  }
  for(const x of t)activeTouches.set(x.identifier,[x.clientX,x.clientY]);
}},{passive:true});
canvas.addEventListener('touchend',e=>{for(const t of e.changedTouches)activeTouches.delete(t.identifier);},{passive:true});
function animateLegs(specimen,time){
  if(!specimen||specimen.partId!=='legs-compact')return;
  for(const [i,side] of ['left','right'].entries()){
    const hip=specimen.root.getObjectByName(side+'Hip');
    const knee=specimen.root.getObjectByName(side+'Knee');
    const ankle=specimen.root.getObjectByName(side+'Ankle');
    if(!hip||!knee||!ankle)continue;
    const phase=time*3.1+i*Math.PI;
    hip.rotation.x=state.walk?Math.sin(phase)*.15:0;
    knee.rotation.x=state.walk?Math.max(0,Math.sin(phase+.6))*.19:0;
    ankle.rotation.x=state.walk?-Math.sin(phase+.5)*.085:0;
  }
}
function loop(timeMs){
  requestAnimationFrame(loop);
  const time=timeMs/1000,dt=Math.min(.055,time-lastTime||0);lastTime=time;
  if(!naked||!armored)return;
  animateLegs(naked,time);animateLegs(armored,time);
  camera.position.set(Math.sin(state.yaw)*Math.cos(state.pitch)*state.distance,
    Math.sin(state.pitch)*state.distance, -Math.cos(state.yaw)*Math.cos(state.pitch)*state.distance);
  camera.lookAt(0,0,0);
  for(const piece of [...falling]){
    piece.life-=dt;
    piece.velocity.y-=4*dt;
    piece.mesh.position.addScaledVector(piece.velocity,dt);
    piece.mesh.rotation.x+=dt*3.2;
    if(piece.life<=0){
      piece.mesh.parent?.remove(piece.mesh);
      piece.mesh.geometry.dispose();piece.mesh.material.dispose();
      falling.splice(falling.indexOf(piece),1);
    }
  }
  const w=stage.clientWidth,h=stage.clientHeight,split=Math.floor(w/2);
  renderer.setViewport(0,0,split,h);renderer.setScissor(0,0,split,h);
  naked.root.visible=true;armored.root.visible=false;renderer.render(scene,camera);
  renderer.setViewport(split,0,w-split,h);renderer.setScissor(split,0,w-split,h);
  naked.root.visible=false;armored.root.visible=true;renderer.render(scene,camera);
}
try{rebuild();requestAnimationFrame(loop);}
catch(error){$('armor-error').hidden=false;$('armor-error').textContent=
  'ARMOR LAB INITIALIZATION ERROR\n'+(error?.stack||error?.message||error);}
