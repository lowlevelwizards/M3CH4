/** Visual-only prototype lab. Uses the same five-station upper assembly as
 * production buildExteriorRig(), replacing *only* its mobility visual in a
 * private clone. No catalogue registration, persistence, weapons or IK rewrites.
 */
import * as THREE from 'three';
import {makeTestAssembly} from '../components.js';
import {buildExteriorRig} from '../scene.js';
import {candidateById,SILHOUETTE_PRESETS,TUNABLES,deriveSilhouette,clampParameter}
  from './yardwalkerSilhouetteDesign.js';
import {createSilhouetteMachine} from './yardwalkerSilhouetteGeometry.js';
import {ARMOR_LEVELS,normalizeArmor} from './yardwalkerSilhouetteArmor.js';

const $=id=>document.getElementById(id);
const stage=$('stage'),panels=$('panels'),canvas=$('scene');
const state={selected:'strider',focus:window.innerWidth<761,fullRig:true,black:false,
 view:'quarter',arena:false,zoom:1,yaw:.65,pitch:.22,
 armorTier:0,armorStyle:'box',bootPlate:true,
 configs:Object.fromEntries(SILHOUETTE_PRESETS.map(p=>[p.id,candidateById(p.id)]))};
const scene=new THREE.Scene();scene.background=new THREE.Color(0x33473b);
scene.add(new THREE.HemisphereLight(0xe9e1cb,0x33483e,2.0));
const key=new THREE.DirectionalLight(0xffe1ad,2.5);key.position.set(-4,8,-5);scene.add(key);
const rim=new THREE.DirectionalLight(0x9dc9b5,1.4);rim.position.set(4,4,5);scene.add(rim);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(28,28),
 new THREE.MeshStandardMaterial({color:0x293b32,roughness:1}));
floor.rotation.x=-Math.PI/2;floor.position.y=.20;scene.add(floor);
const grid=new THREE.GridHelper(24,32,0x657869,0x455e4e);grid.position.y=.204;scene.add(grid);
const blackMaterial=new THREE.MeshBasicMaterial({color:0x17221d});
const camera=new THREE.OrthographicCamera(-2,2,2,-2,.05,70);
let renderer;
try{
 renderer=new THREE.WebGLRenderer({canvas,antialias:false,powerPreference:'low-power'});
 renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.4));
 renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;
 renderer.toneMappingExposure=1.18;
 renderer.setScissorTest(true);
}catch(error){$('error').hidden=false;$('error').textContent='Could not initialize 3D silhouette lab: '+error.message;throw error;}

const initial=buildExteriorRig(makeTestAssembly());
const mobility=initial.partGroups.get('mobility');
if(!mobility)throw Error('Could not locate real installed Yardwalker mobility group');
for(const child of [...mobility.children])mobility.remove(child);
// The production body is built once, then cloned with shared GPU geometry. Each
// clone has its own newly authored mobility mesh; no live object is altered.
const rigs=new Map();
for(const preset of SILHOUETTE_PRESETS){
 const root=initial.root.clone(true);
 const mobilityGroup=root.getObjectByName(mobility.name);
 if(!mobilityGroup)throw Error('Missing mobility mount in cloned five-station rig');
 const study=createSilhouetteMachine(state.configs[preset.id],state);
 mobilityGroup.add(study.root);
 root.visible=false;scene.add(root);
 const torso=root.getObjectByName(initial.partGroups.get('structure').name);
 rigs.set(preset.id,{root,mobilityGroup,torso,study});
}
const renderStamp={count:0};
let pending=false;
function schedule(){if(pending)return;pending=true;requestAnimationFrame(render);}
const choose=id=>{
 if(!state.configs[id])throw Error('Unknown lab selection '+id);
 state.selected=id;
 for(const b of document.querySelectorAll('[data-choose]'))
  b.setAttribute('aria-pressed',String(b.dataset.choose===id));
 $('selected-title').textContent=state.configs[id].title;
 $('selected-brief').textContent=state.configs[id].brief;
 for(const [key,range] of Object.entries(TUNABLES)){
  const input=$(key);input.min=String(range.min);input.max=String(range.max);
  input.step=String(range.step);input.value=String(state.configs[id][key]);
  $(key+'-value').textContent=format(key,state.configs[id][key]);
 }
 for(const p of panels.querySelectorAll('.panel'))
  p.classList.toggle('active',p.dataset.id===id);
 updateMetrics();schedule();
};
function format(k,v){return Number(v).toFixed(2)+(TUNABLES[k].unit==='m'?' m':TUNABLES[k].unit);}
function updateMetrics(){
 const p=deriveSilhouette(state.configs[state.selected]);
 $('study-footprint').textContent='FOOTPRINT '+p.footprintSpan.toFixed(2)+' M · JOINT KNEE '+p.kneeY.toFixed(2)+' M';
 const status=$('study-warnings');status.textContent=p.isNominalWidth?
   'REFERENCE U1 WIDTH OK · NO SAVE':'OUTSIDE NOMINAL 2.00 M WIDTH · CONCEPT ONLY';
 status.classList.toggle('warn',!p.isNominalWidth);
}
function redrawStudy(id){
 const rig=rigs.get(id);const old=rig.study.root;
 const study=createSilhouetteMachine(state.configs[id],state);rig.mobilityGroup.remove(old);
 // Only study meshes are exclusive to one rig and may be safely disposed.
 old.traverse(o=>{if(o.isMesh)o.geometry.dispose();});
 rig.mobilityGroup.add(study.root);rig.study=study;updateMetrics();schedule();
}
function updateArmorControls(){
 const armor=normalizeArmor(state.armorTier,state.armorStyle,state.bootPlate);
 for(const b of document.querySelectorAll('[data-armor-tier]'))
  b.setAttribute('aria-pressed',String(Number(b.dataset.armorTier)===armor.tier));
 $('encased-style').disabled=armor.tier!==3;
 $('encased-style').value=armor.style;
 $('boot-plate').disabled=armor.tier!==3;
 $('boot-plate').checked=armor.bootPlate;
 $('armor-description').textContent=ARMOR_LEVELS[armor.tier].detail
  +(armor.tier===3?' · '+(armor.style==='box'?'Box flare':'Tapered hood')+
    (armor.bootPlate?' · Boot plate fitted':' · Bare boots'):'')
  +' · Prototype only';
}
function applyArmor(){
 updateArmorControls();
 for(const preset of SILHOUETTE_PRESETS)redrawStudy(preset.id);
}
for(const b of document.querySelectorAll('[data-armor-tier]'))
 b.addEventListener('click',()=>{state.armorTier=Number(b.dataset.armorTier);applyArmor();});
$('encased-style').addEventListener('change',e=>{state.armorStyle=e.target.value;applyArmor();});
$('boot-plate').addEventListener('change',e=>{state.bootPlate=e.target.checked;applyArmor();});
function setParameter(key,value){
 state.configs[state.selected][key]=clampParameter(key,value);
 $(key).value=String(state.configs[state.selected][key]);
 $(key+'-value').textContent=format(key,state.configs[state.selected][key]);
 redrawStudy(state.selected);
}
for(const key of Object.keys(TUNABLES))$(key).addEventListener('input',event=>setParameter(key,event.target.value));
for(const button of document.querySelectorAll('[data-choose]'))
 button.addEventListener('click',()=>choose(button.dataset.choose));
$('reset-study').addEventListener('click',()=>{
 state.configs[state.selected]=candidateById(state.selected);
 redrawStudy(state.selected);choose(state.selected);
});
$('reset-all').addEventListener('click',()=>{
 for(const preset of SILHOUETTE_PRESETS){
  state.configs[preset.id]=candidateById(preset.id);redrawStudy(preset.id);
 }
 choose(state.selected);
});
function setFocus(focused){
 state.focus=focused;panels.classList.toggle('single',focused);
 $('focus').setAttribute('aria-pressed',String(focused));
 $('compare').setAttribute('aria-pressed',String(!focused));
 choose(state.selected);schedule();
}
$('focus').addEventListener('click',()=>setFocus(true));
$('compare').addEventListener('click',()=>setFocus(false));
function showRig(yes){
 state.fullRig=yes;
 $('full-rig').setAttribute('aria-pressed',String(yes));
 $('legs-only').setAttribute('aria-pressed',String(!yes));schedule();
}
$('full-rig').addEventListener('click',()=>showRig(true));
$('legs-only').addEventListener('click',()=>showRig(false));
$('silhouette').addEventListener('click',()=>{
 state.black=!state.black;
 $('silhouette').setAttribute('aria-pressed',String(state.black));schedule();
});
function setView(view){
 state.view=view;
 const pose={quarter:[.65,.22],front:[0,.10],side:[Math.PI/2,.08],rear:[Math.PI,.10]}[view];
 if(!pose)throw Error('Unknown camera view '+view);
 [state.yaw,state.pitch]=pose;
 for(const b of document.querySelectorAll('[data-view]'))
  b.setAttribute('aria-pressed',String(b.dataset.view===view));
 schedule();
}
for(const b of document.querySelectorAll('[data-view]'))
 b.addEventListener('click',()=>setView(b.dataset.view));
function scaleChange(arena){
 state.arena=arena;
 $('garage').setAttribute('aria-pressed',String(!arena));
 $('arena').setAttribute('aria-pressed',String(arena));schedule();
}
$('garage').addEventListener('click',()=>scaleChange(false));
$('arena').addEventListener('click',()=>scaleChange(true));
function zoom(factor){state.zoom=Math.min(2.1,Math.max(.65,state.zoom*factor));schedule();}
$('zoom-in').addEventListener('click',()=>zoom(.85));
$('zoom-out').addEventListener('click',()=>zoom(1.18));
$('camera-reset').addEventListener('click',()=>{state.zoom=1;setView('quarter');});
const pointers=new Map();let dragged=0,oldPinch=0;
canvas.addEventListener('pointerdown',event=>{
 canvas.setPointerCapture(event.pointerId);
 pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
 if(pointers.size===1)dragged=0;
});
canvas.addEventListener('pointermove',event=>{
 if(!pointers.has(event.pointerId))return;
 const last=pointers.get(event.pointerId);
 pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
 if(pointers.size===1){
  const dx=event.clientX-last.x,dy=event.clientY-last.y;
  dragged+=Math.abs(dx)+Math.abs(dy);
  state.yaw+=dx*.008;state.pitch=Math.max(-.05,Math.min(.82,state.pitch+dy*.006));
  schedule();
 }else if(pointers.size===2){
  const [a,b]=[...pointers.values()];const distance=Math.hypot(a.x-b.x,a.y-b.y);
  if(oldPinch>0&&distance>0)zoom(oldPinch/distance);
  oldPinch=distance;
 }
});
function finishPointer(event){
 pointers.delete(event.pointerId);
 if(pointers.size<2)oldPinch=0;
 if(pointers.size===0&&dragged<8&&!state.focus){
  const cards=[...panels.querySelectorAll('.panel')];
  const hit=cards.find(p=>{const r=p.getBoundingClientRect();
   return event.clientX>=r.left&&event.clientX<r.right&&event.clientY>=r.top&&event.clientY<r.bottom;});
  if(hit)choose(hit.dataset.id);
 }
}
canvas.addEventListener('pointerup',finishPointer);
canvas.addEventListener('pointercancel',event=>{pointers.delete(event.pointerId);oldPinch=0;});
canvas.addEventListener('wheel',event=>{event.preventDefault();zoom(event.deltaY>0?1.1:.91);},{passive:false});
function render(){
 pending=false;
 const r=stage.getBoundingClientRect();if(r.width<1||r.height<1)return;
 renderer.setSize(r.width,r.height,false);
 floor.visible=grid.visible=!state.black;
 scene.background.setHex(state.black?0xa9b8a6:0x33473b);
 scene.overrideMaterial=state.black?blackMaterial:null;
 for(const rig of rigs.values()){rig.root.visible=false;rig.torso.visible=state.fullRig;}
 const ids=state.focus?[state.selected]:SILHOUETTE_PRESETS.map(p=>p.id);
 for(const id of ids){
  const rig=rigs.get(id),panel=panels.querySelector('[data-id="'+id+'"]');
  const v=panel.getBoundingClientRect();if(v.width<2||v.height<2)continue;
  const x=Math.floor(v.left-r.left),y=Math.floor(r.bottom-v.bottom),w=Math.floor(v.width),h=Math.floor(v.height);
  const aspect=w/h;
  // Match the real *whole rig* envelope, not merely the leg footprint.
  // The side view needs more horizontal room for the long training cannon.
  const widthNeeded=state.fullRig?
    (state.view==='side'?4.35:state.view==='quarter'?3.65:3.42):
    (state.view==='side'?2.50:2.35);
  const minHeight=state.fullRig?(state.arena?7.0:3.75):(state.arena?4.5:2.65);
  const height=Math.max(minHeight,
    (state.arena?widthNeeded*1.34:widthNeeded)/aspect)*state.zoom;
  camera.left=-height*aspect/2;camera.right=height*aspect/2;
  camera.top=height/2;camera.bottom=-height/2;camera.updateProjectionMatrix();
  const target=new THREE.Vector3(0,state.fullRig?1.50:1.04,0),radius=9;
  camera.position.set(target.x+Math.sin(state.yaw)*radius*Math.cos(state.pitch),
    target.y+Math.sin(state.pitch)*radius,target.z-Math.cos(state.yaw)*radius*Math.cos(state.pitch));
  camera.lookAt(target);
  renderer.setViewport(x,y,w,h);renderer.setScissor(x,y,w,h);
  renderer.setClearColor(state.black?0xa9b8a6:0x33473b,1);renderer.clear(true,true,true);
  rig.root.visible=true;scene.updateMatrixWorld(true);renderer.render(scene,camera);rig.root.visible=false;
 }
 renderStamp.count++;
 window.__yardwalkerSilhouetteLab={ready:true,frames:renderStamp.count,
  inspect:()=>({selected:state.selected,focus:state.focus,fullRig:state.fullRig,view:state.view,
   black:state.black,arena:state.arena,zoom:state.zoom,
   armorTier:state.armorTier,armorStyle:state.armorStyle,bootPlate:state.bootPlate,
   armorPieces:Object.fromEntries([...rigs.entries()].map(([id,rig])=>{
    let count=0;rig.study.root.traverse(obj=>{if(obj.userData?.armorZone)count++;});
    return [id,count];
   })),
   candidates:SILHOUETTE_PRESETS.map(p=>({id:p.id,...deriveSilhouette(state.configs[p.id])}))})};
}
if('ResizeObserver'in window)new ResizeObserver(schedule).observe(stage);
window.addEventListener('resize',schedule);
updateArmorControls();setFocus(state.focus);choose(state.selected);schedule();
