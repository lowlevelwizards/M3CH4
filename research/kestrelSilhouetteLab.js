/** Visual-only prototype lab. Uses the same five-station upper assembly as
 * production buildExteriorRig(), replacing *only* its mobility visual in a
 * private clone. No catalogue registration, persistence, weapons or IK rewrites.\n * Kestrel V3 adds an entirely experimental removable visual armor study.
 */
import * as THREE from 'three';
import {makeTestAssembly} from '../components.js';
import {buildExteriorRig} from '../scene.js';
import {candidateById,SILHOUETTE_PRESETS,TUNABLES,deriveSilhouette,clampParameter}
  from './kestrelSilhouetteDesign.js';
import {createArticulatedKestrel,STANCE_IDS,STANCES} from './kestrelSilhouetteMotion.js';
import {installKestrelArmor} from './kestrelSilhouetteArmor.js';
import {ARMOR_LEVELS,ENCASED_FORMS,ARMOR_ZONES,normalizeArmorSettings} from './kestrelArmorSpec.js';

const $=id=>document.getElementById(id);
const stage=$('stage'),panels=$('panels'),canvas=$('scene');
const state={selected:'raptor',focus:window.innerWidth<761,fullRig:true,black:false,
 comparison:'designs',stance:'balanced',motion:'stand',playing:false,phase:0,speed:1,
 armorTier:0,armorForm:'swept',bootPlate:true,armorOnly:false,exploded:false,
 armorZones:Object.fromEntries(ARMOR_ZONES.map(zone=>[zone,true])),
 view:'quarter',arena:false,zoom:1,yaw:.65,pitch:.22,
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
if(!mobility)throw Error('Could not locate real installed Kestrel mobility group');
for(const child of [...mobility.children])mobility.remove(child);
// The unchanged upper body is built once, then cloned with shared GPU geometry. Each
// clone has its own newly authored mobility mesh; no live object is altered.
const rigs=new Map();
for(const preset of [...SILHOUETTE_PRESETS,{id:'naked'}]){
 const root=initial.root.clone(true);
 const mobilityGroup=root.getObjectByName(mobility.name);
 if(!mobilityGroup)throw Error('Missing mobility mount in cloned five-station rig');
 const design=preset.id==='naked'?'raptor':preset.id;
 const study=createArticulatedKestrel(state.configs[design]);
 const armor=installKestrelArmor(study,{tier:0});
 mobilityGroup.add(study.root);
 root.visible=false;scene.add(root);
 const upperGroups=[...initial.partGroups.entries()].filter(([key])=>key!=='mobility')
  .map(([,group])=>root.getObjectByName(group.name)).filter(Boolean);
 rigs.set(preset.id,{root,mobilityGroup,upperGroups,study,armor,
  design,armorTier:0,basePosition:root.position.clone()});
}
const renderStamp={count:0};
let pending=false;
function schedule(){if(pending)return;pending=true;requestAnimationFrame(render);}
function displayFor(panelId){
 if(state.comparison==='armor'&&!state.focus)
  return {candidate:state.selected,stance:state.stance,
   tier:['raptor','field','perch','naked'].indexOf(panelId)};
 if(state.comparison==='stances'&&!state.focus)
  return {candidate:state.selected,stance:STANCE_IDS[SILHOUETTE_PRESETS.findIndex(p=>p.id===panelId)],
   tier:state.armorTier};
 return {candidate:panelId==='naked'?state.selected:panelId,stance:state.stance,tier:state.armorTier};
}
function refreshPanelTitles(){
 const armorMode=state.comparison==='armor'&&!state.focus;
 panels.classList.toggle('four',armorMode);
 const armorPanel=panels.querySelector('[data-id="naked"]');
 armorPanel.classList.toggle('hidden',!armorMode);
 for(const [i,preset] of [...SILHOUETTE_PRESETS,{id:'naked'}].entries()){
  if(i===3&&!armorMode)continue;
  const panel=panels.querySelector('[data-id="'+preset.id+'"]');
  const caption=panel.querySelector('.caption');
  if(armorMode){
   caption.querySelector('b').textContent=i+' / '+ARMOR_LEVELS[i].name;
   caption.querySelector('span').textContent=ARMOR_LEVELS[i].description;
  }else if(state.comparison==='stances'&&!state.focus){
   caption.querySelector('b').textContent=(i+1)+' / '+STANCES[STANCE_IDS[i]].name;
   caption.querySelector('span').textContent=state.configs[state.selected].title+' · '+STANCES[STANCE_IDS[i]].description;
  }else{
   caption.querySelector('b').textContent=preset.title;
   caption.querySelector('span').textContent=preset.brief;
  }
 }
}
function replaceRigStudy(rig,candidate,tier=state.armorTier){
 if(rig.design===candidate&&rig.armorTier===tier)return;
 const old=rig.study.root;
 const next=createArticulatedKestrel(state.configs[candidate]);
 const kit=installKestrelArmor(next,{tier,form:state.armorForm,boot:state.bootPlate});
 rig.mobilityGroup.remove(old);
 rig.armor.dispose();
 old.traverse(o=>{if(o.isMesh)o.geometry.dispose();});
 rig.study=next;rig.armor=kit;rig.design=candidate;rig.armorTier=tier;
 rig.mobilityGroup.add(next.root);
}
function repaintDesign(design){
 for(const rig of rigs.values()){
  if(rig.design!==design)continue;
  const old=rig.study.root,study=createArticulatedKestrel(state.configs[design]);
  const armor=installKestrelArmor(study,{tier:rig.armorTier,
   form:state.armorForm,boot:state.bootPlate});
  rig.mobilityGroup.remove(old);rig.armor.dispose();
  old.traverse(o=>{if(o.isMesh)o.geometry.dispose();});
  rig.mobilityGroup.add(study.root);rig.study=study;rig.armor=armor;
 }
 schedule();
}
function syncRigAssignments(){
 for(const [panelId,rig] of rigs){
  const display=displayFor(panelId);
  replaceRigStudy(rig,display.candidate,display.tier);
 }
 refreshPanelTitles();
 schedule();
}
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
 updateMetrics();syncRigAssignments();
};
function format(k,v){return Number(v).toFixed(2)+(TUNABLES[k].unit==='m'?' m':TUNABLES[k].unit);}
function updateMetrics(){
 const p=deriveSilhouette(state.configs[state.selected]);
 $('study-footprint').textContent='FOOTPRINT '+p.footprintSpan.toFixed(2)+' M · JOINT KNEE '+p.kneeY.toFixed(2)+' M';
 const status=$('study-warnings');status.textContent=p.isNominalWidth?
   'REFERENCE COMPACT WIDTH OK · NO SAVE':'OUTSIDE NOMINAL 1.67 M WIDTH · CONCEPT ONLY';
 status.classList.toggle('warn',!p.isNominalWidth);
}
function redrawStudy(id){ repaintDesign(id);updateMetrics();schedule(); }
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
 choose(state.selected);syncRigAssignments();schedule();
}
$('focus').addEventListener('click',()=>setFocus(true));
$('compare').addEventListener('click',()=>setFocus(false));
function setComparison(mode){
 if(!['designs','stances','armor'].includes(mode))throw Error('Unknown Kestrel comparison '+mode);
 state.comparison=mode;
 $('compare-designs').setAttribute('aria-pressed',String(mode==='designs'));
 $('compare-stances').setAttribute('aria-pressed',String(mode==='stances'));
 $('compare-armor').setAttribute('aria-pressed',String(mode==='armor'));
 if(mode!=='designs'&&state.focus)setFocus(false);
 syncRigAssignments();
}
$('compare-designs').addEventListener('click',()=>setComparison('designs'));
$('compare-stances').addEventListener('click',()=>setComparison('stances'));
$('compare-armor').addEventListener('click',()=>setComparison('armor'));
function setStance(id){
 if(!STANCES[id])throw Error('Unknown stance '+id);
 state.stance=id;
 for(const b of document.querySelectorAll('[data-stance]'))
  b.setAttribute('aria-pressed',String(b.dataset.stance===id));
 updateMetrics();schedule();
}
for(const b of document.querySelectorAll('[data-stance]'))
 b.addEventListener('click',()=>setStance(b.dataset.stance));
function updateArmorControls(){
 const spec=normalizeArmorSettings({tier:state.armorTier,
  form:state.armorForm,boot:state.bootPlate});
 for(const b of document.querySelectorAll('[data-armor-tier]'))
  b.setAttribute('aria-pressed',String(Number(b.dataset.armorTier)===spec.tier));
 $('encased-form').disabled=spec.tier!==3;
 $('encased-form').value=spec.form;
 $('boot-plate').disabled=spec.tier!==3;
 $('boot-plate').checked=spec.boot;
 $('armor-only').setAttribute('aria-pressed',String(state.armorOnly));
 $('armor-explode').setAttribute('aria-pressed',String(state.exploded));
 for(const b of document.querySelectorAll('[data-armor-zone]'))
  b.setAttribute('aria-pressed',String(state.armorZones[b.dataset.armorZone]));
 $('armor-description').textContent=ARMOR_LEVELS[spec.tier].description+
  (spec.tier===3?' · '+ENCASED_FORMS.find(f=>f.id===spec.form).name+
  (spec.boot?' · Foot cap fitted':' · Naked feet'):'')+' · Prototype only · No save';
}
function applyArmor(){
 for(const [id,rig] of rigs){
  const desired=displayFor(id);
  rig.armorTier=-1;
  replaceRigStudy(rig,desired.candidate,desired.tier);
 }
 updateArmorControls();schedule();
}
for(const b of document.querySelectorAll('[data-armor-tier]'))
 b.addEventListener('click',()=>{state.armorTier=Number(b.dataset.armorTier);applyArmor();});
$('encased-form').addEventListener('change',e=>{
 state.armorForm=e.target.value;applyArmor();
});
$('boot-plate').addEventListener('change',e=>{
 state.bootPlate=e.target.checked;applyArmor();
});
$('armor-only').addEventListener('click',()=>{
 state.armorOnly=!state.armorOnly;updateArmorControls();schedule();
});
$('armor-explode').addEventListener('click',()=>{
 state.exploded=!state.exploded;updateArmorControls();schedule();
});
for(const b of document.querySelectorAll('[data-armor-zone]'))
 b.addEventListener('click',()=>{
  state.armorZones[b.dataset.armorZone]=!state.armorZones[b.dataset.armorZone];
  updateArmorControls();schedule();
 });
$('armor-reset-view').addEventListener('click',()=>{
 state.armorOnly=false;state.exploded=false;
 for(const zone of ARMOR_ZONES)state.armorZones[zone]=true;
 updateArmorControls();schedule();
});
function updatePlayButton(){
 $('toggle-play').textContent=state.playing?'Ⅱ PAUSE':'▶ PLAY';
 $('toggle-play').setAttribute('aria-pressed',String(state.playing));
}
function setMotion(mode){
 if(!['stand','walk','inspect'].includes(mode))throw Error('Unknown lab motion '+mode);
 state.motion=mode;
 state.playing=mode==='walk';
 if(mode==='stand')state.phase=0;
 for(const b of document.querySelectorAll('[data-motion]'))
  b.setAttribute('aria-pressed',String(b.dataset.motion===mode));
 updatePlayButton();schedule();
}
for(const b of document.querySelectorAll('[data-motion]'))
 b.addEventListener('click',()=>setMotion(b.dataset.motion));
$('toggle-play').addEventListener('click',()=>{
 if(state.motion==='stand')setMotion('walk');
 else{state.playing=!state.playing;updatePlayButton();schedule();}
});
$('gait-speed').addEventListener('input',e=>{
 state.speed=Number(e.target.value);
 $('gait-speed-value').textContent=state.speed.toFixed(2)+'×';
});
$('gait-phase').addEventListener('input',e=>{
 state.phase=Number(e.target.value)/100;
 state.playing=false;
 if(state.motion==='stand')state.motion='inspect';
 for(const b of document.querySelectorAll('[data-motion]'))
  b.setAttribute('aria-pressed',String(b.dataset.motion===state.motion));
 updatePlayButton();schedule();
});
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
let previousTime;
function render(timestamp=0){
 pending=false;
 const dt=previousTime===undefined?0:Math.min(.08,Math.max(0,(timestamp-previousTime)/1000));
 previousTime=timestamp;
 if(state.playing){
  // Two complete steps in a roughly 1.7s repeat; no saved game transform.
  state.phase=(state.phase+dt*state.speed/1.7)%1;
 }
 $('gait-phase').value=String(Math.round(state.phase*100));
 $('gait-phase-value').textContent=Math.round(state.phase*100)+'%';
 const r=stage.getBoundingClientRect();if(r.width<1||r.height<1)return;
 renderer.setSize(r.width,r.height,false);
 floor.visible=grid.visible=!state.black;
 scene.background.setHex(state.black?0xa9b8a6:0x33473b);
 scene.overrideMaterial=state.black?blackMaterial:null;
 for(const rig of rigs.values()){
  rig.root.visible=false;
  for(const part of rig.upperGroups)part.visible=state.fullRig&&!state.armorOnly;
 }
 let worstReach=0;
 const ids=state.focus?[state.selected]:state.comparison==='armor'?
 ['raptor','field','perch','naked']:SILHOUETTE_PRESETS.map(p=>p.id);
 for(const id of ids){
  const rig=rigs.get(id),panel=panels.querySelector('[data-id="'+id+'"]');
  const assignment=displayFor(id);
  replaceRigStudy(rig,assignment.candidate,assignment.tier);
  rig.armor.present({armorOnly:state.armorOnly,exploded:state.exploded,zones:state.armorZones});
  const pose=rig.study.pose({stance:assignment.stance,motion:state.motion,phase:state.phase});
  rig.root.position.copy(rig.basePosition);
  rig.root.position.y+=pose.bodyY;
  rig.root.position.z+=pose.bodyZ;
  worstReach=Math.max(worstReach,pose.maxReachError);
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
  const target=new THREE.Vector3(0,state.fullRig?1.48:1.03,pose.bodyZ),radius=9;
  camera.position.set(target.x+Math.sin(state.yaw)*radius*Math.cos(state.pitch),
    target.y+Math.sin(state.pitch)*radius,target.z-Math.cos(state.yaw)*radius*Math.cos(state.pitch));
  camera.lookAt(target);
  renderer.setViewport(x,y,w,h);renderer.setScissor(x,y,w,h);
  renderer.setClearColor(state.black?0xa9b8a6:0x33473b,1);renderer.clear(true,true,true);
  rig.root.visible=true;scene.updateMatrixWorld(true);renderer.render(scene,camera);rig.root.visible=false;
 }
 $('pose-status').textContent=worstReach>0.002?
  'JOINT REACH LIMIT · '+worstReach.toFixed(3)+' M':
  (state.comparison==='armor'&&!state.focus?'FOUR ARMOR LEVELS':
   state.comparison==='stances'&&!state.focus?'THREE STANCES':
  STANCES[state.stance].name)+' · '+(state.motion==='stand'?'GROUNDED':'FOOT-PLANT PREVIEW');
 $('pose-status').classList.toggle('warn',worstReach>0.002);
 renderStamp.count++;
 if(state.playing)schedule();
 window.__kestrelSilhouetteLab={ready:true,frames:renderStamp.count,
  inspect:()=>({selected:state.selected,focus:state.focus,fullRig:state.fullRig,view:state.view,
   black:state.black,arena:state.arena,zoom:state.zoom,
   comparison:state.comparison,stance:state.stance,motion:state.motion,
   armorTier:state.armorTier,armorForm:state.armorForm,bootPlate:state.bootPlate,
   armorOnly:state.armorOnly,exploded:state.exploded,armorZones:{...state.armorZones},
   playing:state.playing,phase:state.phase,speed:state.speed,
   rigPoses:ids.map(id=>{const r=rigs.get(id);return {id,design:r.design,
    pose:r.study.root.userData.lastPose,armorTier:r.armorTier,
    armorCount:r.armor.meshes.length,
    visibleArmor:r.armor.meshes.filter(m=>m.visible).length,
    worldY:r.root.position.y,worldZ:r.root.position.z};}),
   candidates:SILHOUETTE_PRESETS.map(p=>({id:p.id,...deriveSilhouette(state.configs[p.id])}))})};
}
if('ResizeObserver'in window)new ResizeObserver(schedule).observe(stage);
window.addEventListener('resize',schedule);
setFocus(state.focus);choose(state.selected);setStance('balanced');setMotion('stand');
updateArmorControls();schedule();
