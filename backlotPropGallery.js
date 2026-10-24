/** Backlot DEV-only visual audit gallery.
 * Booted separately from gameplay: never reads/writes campaign saves.
 * All specimens are generated from actual production constructors.
 */
import * as THREE from 'three';
import {BACKLOT} from './maps/backlot.js';
import {buildBacklotPropCatalog,batchBacklotDerbyDecorations} from './backlotDerbyWorld.js?v=k5s2';
import {BACKLOT_COVER_KITS} from './backlotObstacleKits.js';
const $=id=>{const node=document.getElementById(id);if(!node)throw Error('Missing #'+id);return node;};
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const stage=$('stage'),speed=$('gallery-speed'),selectEl=$('gallery-select');
const scene=new THREE.Scene();
scene.background=new THREE.Color(0x9aaca4);
scene.fog=new THREE.Fog(0x9aaca4,130,590);
scene.add(new THREE.HemisphereLight(0xf4dfaf,0x394c43,2.35));
const sun=new THREE.DirectionalLight(0xffdfab,2.0);
sun.position.set(-35,75,25);scene.add(sun);
const camera=new THREE.PerspectiveCamera(70,1,.08,850);
camera.rotation.order='YXZ';
const renderer=new THREE.WebGLRenderer({antialias:false,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.3));
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.13;
stage.append(renderer.domElement);
const root=new THREE.Group();
root.name='actual-backlot-samples';scene.add(root);
const entries=[];
const ROW_SPACE=18.5,COL_SPACE=19.5,COLS=6;
const BORDER_COLOR=0x6d786a;
const plateMat=new THREE.MeshBasicMaterial({color:0x5d6858,side:THREE.DoubleSide});
const boundaryMat=new THREE.LineBasicMaterial({color:BORDER_COLOR,transparent:true,opacity:.55});
const selectedMat=new THREE.LineBasicMaterial({color:0xf3ce81});
const planeGeometry=new THREE.PlaneGeometry(13.8,13.8);
const selectionLine=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([
 new THREE.Vector3(-7.05,.065,-7.05),new THREE.Vector3(7.05,.065,-7.05),
 new THREE.Vector3(7.05,.065,7.05),new THREE.Vector3(-7.05,.065,7.05),
]),selectedMat);
selectionLine.visible=false;scene.add(selectionLine);
function plaque(entry,index){
 const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;
 const c=canvas.getContext('2d');
 c.fillStyle='#17251e';c.fillRect(0,0,512,128);
 c.strokeStyle='#a7b39a';c.lineWidth=6;c.strokeRect(3,3,506,122);
 c.textAlign='center';c.fillStyle='#f6d39b';c.font='bold 25px monospace';
 c.fillText(String(index+1).padStart(2,'0')+' / '+entry.label,256,54,493);
 c.fillStyle='#acc6ae';c.font='19px monospace';
 c.fillText(entry.detail,256,94,490);
 const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;
 tex.magFilter=tex.minFilter=THREE.NearestFilter;
 const p=new THREE.Mesh(new THREE.PlaneGeometry(9.5,2.38),
   new THREE.MeshBasicMaterial({map:tex,side:THREE.DoubleSide,depthWrite:false}));
 p.name='prop-label-'+entry.id;
 p.position.set(0,.075,8.1);p.rotation.x=-Math.PI/2;p.userData.galleryLabel=true;
 return p;
}
function buildGrid(){
 // One invisible bounded pick proxy per specimen. Unlike raycasting every
 // tread, bolt and plate, this remains O(specimen count) on touch devices.
 const pickGeometry=new THREE.BoxGeometry(1,1,1);
 const pickMaterial=new THREE.MeshBasicMaterial({visible:false});
 const catalog=buildBacklotPropCatalog(BACKLOT.world);
 const specimens=catalog.specimens;
 const coverCount=catalog.coverCount;
 const coverBlock=coverCount+catalog.showcaseCount+catalog.experimentCount;
 // Cover occupies the first rows; environmental components follow, with a
 // full empty separator row so no scenic artifact mixes into playable cover.
 const sceneryBase=Math.ceil(coverBlock/COLS)+1;
 const totalRows=sceneryBase+Math.ceil((specimens.length-coverBlock)/COLS);
 for(let i=0;i<specimens.length;i++){
   const entry=specimens[i];
   const row=i<coverBlock?Math.floor(i/COLS):
      sceneryBase+Math.floor((i-coverBlock)/COLS);
   const col=i<coverBlock?i%COLS:(i-coverBlock)%COLS;
   const x=(col-(COLS-1)*.5)*COL_SPACE,z=-row*ROW_SPACE;
   // Keep all parts in one named root so tap-to-inspect can identify them.
   const carrier=new THREE.Group();carrier.name='specimen-'+entry.id;
   carrier.position.set(x,0,z);carrier.userData.galleryIndex=i;
   carrier.add(entry.group);
   // Batch repeated real kit fittings to make 100+ specimens practical on
   // mobile; original geometries and surface materials remain unchanged.
   if(entry.experiment){
     // Batch each half INDEPENDENTLY, keeping old/new visibility and
     // grey-material control intact and avoiding thousands of mobile draws.
     batchBacklotDerbyDecorations(entry.experiment.newPart);
     batchBacklotDerbyDecorations(entry.experiment.oldPart);
   }else batchBacklotDerbyDecorations(entry.group);
   const plate=new THREE.Mesh(planeGeometry,plateMat);
   plate.name='sample-pad';plate.rotation.x=-Math.PI/2;
   plate.position.y=-.028;plate.userData.galleryPad=true;carrier.add(plate);
   const boundary=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-7,.025,-7),new THREE.Vector3(7,.025,-7),
    new THREE.Vector3(7,.025,7),new THREE.Vector3(-7,.025,7)
   ]),boundaryMat);
   carrier.add(boundary);carrier.add(plaque(entry,i));
   const proxy=new THREE.Mesh(pickGeometry,pickMaterial);
   proxy.name='gallery-pick-proxy';
   proxy.scale.set(Math.min(13,Math.max(1.2,entry.width)),
      Math.max(.7,entry.height),Math.min(13,Math.max(1.2,entry.depth)));
   proxy.position.y=Math.max(.7,entry.height)*.5;
   proxy.userData.galleryIndex=i;
   carrier.add(proxy);picking.push(proxy);
   root.add(carrier);
   entries.push({...entry,x,z,row,col,carrier});
 }
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(190,Math.max(140,(totalRows+1)*ROW_SPACE+50)),
   new THREE.MeshStandardMaterial({color:0x8c8064,roughness:1}));
 floor.rotation.x=-Math.PI/2;
 floor.position.set(0,-.065,-(totalRows-1)*ROW_SPACE*.5);
 floor.receiveShadow=true;scene.add(floor);
 $('gallery-description').textContent=coverCount+' individual live cover pieces in '+BACKLOT_COVER_KITS.length+' visually completed cover families · '+
   catalog.sceneryArchetypes+' distinct live scenery/detail types. '+
   'Tap objects or select by name; send screenshots with their IDs.';
 const optgroup1=document.createElement('optgroup');optgroup1.label='EXPERIMENT + ASSEMBLIES + COVER · '+coverBlock;
 const optgroup2=document.createElement('optgroup');optgroup2.label='SCENERY / DETAILS · '+catalog.sceneryArchetypes;
 entries.forEach((entry,i)=>{
   const option=document.createElement('option');option.value=i;
   option.textContent=String(i+1).padStart(2,'0')+' · '+entry.label;
   (entry.category==='cover'||entry.category==='showcase'||entry.category==='experiment'?optgroup1:optgroup2).append(option);
 });
 selectEl.append(optgroup1,optgroup2);
 return {coverCount,experimentCount:catalog.experimentCount,showcaseCount:catalog.showcaseCount,
  sceneryArchetypes:catalog.sceneryArchetypes,total:entries.length,
  styledCoverFamilies:BACKLOT_COVER_KITS,
  secondaryAssemblyIds:entries.filter(e=>e.id.startsWith('secondary-')).map(e=>e.id),
  secondaryCollisionClearance:catalog.secondaryCollisionClearance};
}
let yaw=0,pitch=0,active=0,drag=null,joystickPointer=null;
const axes={x:0,y:0,up:0,down:0};
const keys=new Set();
const expUI=$('gallery-experiment'),compareBtn=$('gallery-before-after'),
 greyBtn=$('gallery-silhouette'),colliderBtn=$('gallery-colliders');
const expState={view:'new',grey:false,colliders:false};
const GREY_MAT=new THREE.MeshStandardMaterial({
 color:0x999999,roughness:1,metalness:0,flatShading:true,
});
const originalMaterial=new WeakMap();
function applyExperimentPresentation(e){
 if(!e?.experiment)return;
 const {newPart,oldPart,collisionOverlay}=e.experiment;
 const both=expState.view==='both';
 newPart.visible=expState.view!=='old';
 oldPart.visible=expState.view!=='new';
 const spread=clamp(Math.max(e.width*.70,4),4,8);
 newPart.position.x=both?-spread:0;
 oldPart.position.x=both?spread:0;
 collisionOverlay.position.x=both?spread:0;
 collisionOverlay.visible=expState.colliders;
 for(const root of [newPart,oldPart])root.traverse(obj=>{
  if(!obj.isMesh)return;
  if(!originalMaterial.has(obj))originalMaterial.set(obj,obj.material);
  obj.material=expState.grey?GREY_MAT:originalMaterial.get(obj);
 });
 compareBtn.textContent=expState.view==='new'?'SHOW OLD':
   expState.view==='old'?'SIDE BY SIDE':'SHOW NEW';
 greyBtn.textContent=expState.grey?'RESTORE COLORS':'GREY SILHOUETTE';
 colliderBtn.textContent=expState.colliders?'COLLIDERS ON':'COLLIDERS OFF';
 $('gallery-experiment-caption').textContent={
  new:(e.id==='experiment-tractor-anatomy'||e.id==='experiment-loader-anatomy')?
   'LIVE COMPOUND GEOMETRY · original AABB ghosts removed from gameplay':
   'DEV PROTOTYPE · pending separate physical integration',
  old:(e.id==='experiment-tractor-anatomy'||e.id==='experiment-loader-anatomy')?
   'LEGACY PRE-COMPOUND AABBs · no longer live':
   'Current Backlot production reference · same camera',
  both:'New at LEFT · original at RIGHT',
 }[expState.view]+' · '+(e.experiment.audit?.pass?'STRUCTURAL JOINS VERIFIED':'REVIEW STRUCTURAL JOINS')+' · collider wireframes = CURRENT LIVE MAP AABBs';
}
function updateExperimentControls(e){
 expUI.hidden=!e.experiment;
 if(!e.experiment)return;
 $('gallery-experiment-title').textContent=e.label.replace(/ · (CHUNK V4|SOLID V5|FINISH V6|EXPERIMENT)/g,'')+
  ((e.id==='experiment-tractor-anatomy'||e.id==='experiment-loader-anatomy')?' · LIVE COMPOUND':' · DEV PROTOTYPE');
 applyExperimentPresentation(e);
}
compareBtn.addEventListener('click',()=>{
 expState.view=expState.view==='new'?'old':
  expState.view==='old'?'both':'new';
 applyExperimentPresentation(entries[active]);
 const entry=entries[active];
 if(expState.view==='both'){
   // Both models must be readable from one camera angle, not a near-field
   // giant old box with the rebuilt tractor tiny behind it.
   const wide=Math.max(entry.width*2.5,entry.depth*2.0,14);
   const facing=entry.experiment?.front==='-z'?-1:1;
   setPose(new THREE.Vector3(entry.x,clamp(entry.height*1.4,4.5,9.5),
      entry.z+facing*clamp(wide,14,30)),
     new THREE.Vector3(entry.x,entry.height*.5,entry.z));
 }else{
   // Restore the same authored three-quarter angle for fair OLD/NEW swaps.
   const distance=clamp(Math.max(entry.depth*1.4,entry.width*.85,5.4),5.4,21);
   const height=clamp(entry.height*.74+1.1,1.7,8);
   const facing=entry.experiment?.front==='-z'?-1:1;
   setPose(new THREE.Vector3(entry.x+distance*.36,height,entry.z+facing*distance),
     new THREE.Vector3(entry.x,entry.height*.5,entry.z));
 }
});
greyBtn.addEventListener('click',()=>{
 expState.grey=!expState.grey;applyExperimentPresentation(entries[active]);
});
colliderBtn.addEventListener('click',()=>{
 expState.colliders=!expState.colliders;applyExperimentPresentation(entries[active]);
});
document.body.classList.add('gallery-compact');
$('gallery-angle-cycle').addEventListener('click',()=>{
 const e=entries[active],front=e.experiment?.front==='-z'?-1:1;
 const d=clamp(Math.max(e.width*1.65,e.depth*1.5,6.5),6.5,23);
 const y=clamp(e.height*.68+1.2,1.8,10);
 const target=new THREE.Vector3(e.x,e.height*.49,e.z);
 viewMode=(viewMode+1)%4;
 const position=[
  new THREE.Vector3(e.x,y,e.z+front*d),
  new THREE.Vector3(e.x+d,y,e.z),
  new THREE.Vector3(e.x,y,e.z-front*d),
  new THREE.Vector3(e.x+d*.18,e.height+d*.80,e.z+front*d*.12),
 ][viewMode];
 setPose(position,target);
 $('gallery-angle-cycle').textContent='VIEW: '+['FRONT','SIDE','REAR','TOP'][viewMode];
});
$('gallery-ui-toggle').addEventListener('click',()=>{
 const compact=document.body.classList.toggle('gallery-compact');
 $('gallery-ui-toggle').textContent=compact?'DETAILS +':'DETAILS −';
});
function setPose(position,target){
 camera.position.copy(position);
 const delta=target.clone().sub(position);
 yaw=Math.atan2(-delta.x,-delta.z);
 pitch=clamp(Math.atan2(delta.y,Math.hypot(delta.x,delta.z)),-1.43,1.43);
 camera.rotation.set(pitch,yaw,0,'YXZ');
}
let viewMode=-1;
function focus(index){
 viewMode=-1;
 $('gallery-angle-cycle').textContent='VIEWS ↻';
 const last=entries[active];
 active=(index+entries.length)%entries.length;
 if(last!==entries[active]){
  expState.view='new';expState.grey=false;expState.colliders=false;
  if(last?.experiment)applyExperimentPresentation(last);
 }
 const e=entries[active];
 selectEl.value=String(active);
 $('gallery-current').textContent=e.label;
 $('gallery-count').textContent=(active+1)+' / '+entries.length;
 $('gallery-description').textContent=e.detail+(e.experiment?.audit?(' · '+e.experiment.audit.checked+' structural joins '+(e.experiment.audit.pass?'verified':'NEED REVIEW')):'')+' · '+e.width.toFixed(1)+' × '+
   e.depth.toFixed(1)+' m · '+e.height.toFixed(1)+' m HIGH · '+e.id;
 selectionLine.position.set(e.x,0,e.z);selectionLine.visible=true;
 updateExperimentControls(e);
 const distance=clamp(Math.max(e.depth*1.4,e.width*.85,5.4),5.4,21);
 const y=clamp(e.height*.74+1.1,1.7,8);
 const facing=e.experiment?.front==='-z'?-1:1;
 setPose(new THREE.Vector3(e.x+distance*.36,y,e.z+facing*distance),
   new THREE.Vector3(e.x,e.height*.5,e.z));
}
function overview(){
 selectionLine.visible=false;
 const c=entries[Math.min(17,entries.length-1)];
 setPose(new THREE.Vector3(0,32,45),new THREE.Vector3(0,0,c.z-8));
 $('gallery-current').textContent='FREE FLIGHT · OVERVIEW';
 $('gallery-description').textContent='All real Backlot prop instances are laid out in labeled rows. '+
  'Fly closer or select any prop from the menu.';
}
$('gallery-prev').addEventListener('click',()=>focus(active-1));
$('gallery-next').addEventListener('click',()=>focus(active+1));
$('gallery-reset').addEventListener('click',()=>focus(active));
$('gallery-overview').addEventListener('click',overview);
selectEl.addEventListener('change',()=>focus(Number(selectEl.value)));
const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2();
const picking=[];
function tapAt(clientX,clientY){
 const rect=renderer.domElement.getBoundingClientRect();
 pointer.set(2*(clientX-rect.left)/rect.width-1,-2*(clientY-rect.top)/rect.height+1);
 raycaster.setFromCamera(pointer,camera);
 for(const hit of raycaster.intersectObjects(picking,false)){
   let n=hit.object;
   while(n&&!Number.isInteger(n.userData.galleryIndex))n=n.parent;
   if(n){focus(n.userData.galleryIndex);return;}
 }
}
renderer.domElement.addEventListener('pointerdown',event=>{
 if(event.pointerType==='mouse'&&event.button!==0)return;
 drag={id:event.pointerId,x:event.clientX,y:event.clientY,
   originX:event.clientX,originY:event.clientY,moved:false};
 renderer.domElement.setPointerCapture(event.pointerId);
});
renderer.domElement.addEventListener('pointermove',event=>{
 if(!drag||drag.id!==event.pointerId)return;
 const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
 drag.x=event.clientX;drag.y=event.clientY;
 if(Math.hypot(event.clientX-drag.originX,event.clientY-drag.originY)>9)
   drag.moved=true;
 yaw-=dx*.0047;
 pitch=clamp(pitch-dy*.0041,-1.45,1.45);
 camera.rotation.set(pitch,yaw,0,'YXZ');
});
const endLook=event=>{
 if(!drag||drag.id!==event.pointerId)return;
 if(!drag.moved)tapAt(event.clientX,event.clientY);
 drag=null;
};
renderer.domElement.addEventListener('pointerup',endLook);
renderer.domElement.addEventListener('pointercancel',()=>{drag=null;});
renderer.domElement.addEventListener('lostpointercapture',()=>{drag=null;});
renderer.domElement.addEventListener('wheel',event=>{
 event.preventDefault();
 const f=new THREE.Vector3(0,0,-1).applyEuler(camera.rotation);
 camera.position.addScaledVector(f,clamp(event.deltaY*.035,-7,7));
 camera.position.y=Math.max(.7,camera.position.y);
},{passive:false});
const stick=$('gallery-joystick'),knob=$('gallery-knob');
function moveStick(event){
 const r=stick.getBoundingClientRect();
 const x=event.clientX-r.left-r.width*.5;
 const y=event.clientY-r.top-r.height*.5;
 const radius=r.width*.37;
 axes.x=clamp(x/radius,-1,1);
 axes.y=clamp(-y/radius,-1,1);
 const length=Math.max(1,Math.hypot(axes.x,axes.y));
 axes.x/=length;axes.y/=length;
 knob.style.transform='translate(calc(-50% + '+(axes.x*radius)+'px), calc(-50% + '+(-axes.y*radius)+'px))';
}
stick.addEventListener('pointerdown',event=>{
 event.preventDefault();joystickPointer=event.pointerId;
 stick.setPointerCapture(event.pointerId);moveStick(event);
});
stick.addEventListener('pointermove',event=>{
 if(event.pointerId===joystickPointer){event.preventDefault();moveStick(event);}
});
const stopStick=event=>{
 if(event.pointerId!==joystickPointer)return;
 joystickPointer=null;axes.x=axes.y=0;
 knob.style.transform='translate(-50%, -50%)';
};
stick.addEventListener('pointerup',stopStick);
stick.addEventListener('pointercancel',stopStick);
stick.addEventListener('lostpointercapture',stopStick);
for(const [id,part]of [['gallery-up','up'],['gallery-down','down']]){
 const b=$(id);
 b.addEventListener('pointerdown',event=>{
  event.preventDefault();b.setPointerCapture(event.pointerId);axes[part]=1;
 });
 for(const type of ['pointerup','pointercancel','lostpointercapture'])
  b.addEventListener(type,()=>axes[part]=0);
}
window.addEventListener('keydown',event=>{
 if(['SELECT','INPUT','TEXTAREA'].includes(document.activeElement?.tagName))return;
 keys.add(event.code);
 if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.code))
  event.preventDefault();
 if(event.code==='Escape')location.href='./index.html?v=k5r1';
});
window.addEventListener('keyup',event=>keys.delete(event.code));
window.addEventListener('blur',()=>{keys.clear();axes.x=axes.y=axes.up=axes.down=0;});
function resize(){
 const rect=stage.getBoundingClientRect();
 const w=Math.max(1,Math.floor(rect.width)),h=Math.max(1,Math.floor(rect.height));
 renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
}
window.addEventListener('resize',resize);
let last=0;
function render(time){
 const dt=last?Math.min(.05,(time-last)/1000):0;last=time;
 const forward=(keys.has('KeyW')||keys.has('ArrowUp')?1:0)-
   (keys.has('KeyS')||keys.has('ArrowDown')?1:0)+axes.y;
 const sideways=(keys.has('KeyD')||keys.has('ArrowRight')?1:0)-
   (keys.has('KeyA')||keys.has('ArrowLeft')?1:0)+axes.x;
 const vertical=(keys.has('KeyE')||keys.has('Space')?1:0)-
   (keys.has('KeyQ')?1:0)+axes.up-axes.down;
 const mag=Math.max(1,Math.hypot(forward,sideways,vertical));
 const pace=Number(speed.value)*(keys.has('ShiftLeft')||keys.has('ShiftRight')?3:1)*dt/mag;
 camera.position.x+=(-Math.sin(yaw)*forward+Math.cos(yaw)*sideways)*pace;
 camera.position.z+=(-Math.cos(yaw)*forward-Math.sin(yaw)*sideways)*pace;
 camera.position.y=Math.max(.65,camera.position.y+vertical*pace);
 renderer.render(scene,camera);
 requestAnimationFrame(render);
}
try{
 const stats=buildGrid();
 // Picking is performed only against the per-specimen proxies built above.
 resize();focus(0);
 window.__backlotGalleryReady={...stats,mapVersion:BACKLOT.version,
  hasFreeCamera:true,experimentId:entries.find(e=>e.experiment)?.id||null,
  experimentalIds:entries.filter(e=>e.experiment).map(e=>e.id),
  assemblyAudits:entries.filter(e=>e.experiment).map(e=>({
   id:e.id,checked:e.experiment.audit?.checked||0,
   pass:e.experiment.audit?.pass===true,
   failures:e.experiment.audit?.failures||[],
  }))};
 requestAnimationFrame(render);
}catch(error){
 $('gallery-error').hidden=false;
 $('gallery-error').textContent='BACKLOT GALLERY FAILED\n'+(error?.stack||String(error));
 throw error;
}
