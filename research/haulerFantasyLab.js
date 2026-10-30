/** HAULER H2 / fantasy-only comparison studio.
 * Exact live five-station upper-rig clone for scale; mobility mesh is always
 * the independently authored Hauler fantasy model. No storage or registry writes.
 */
import * as THREE from 'three';
import {makeTestAssembly} from '../components.js';
import {buildExteriorRig} from '../scene.js';
import {HAULER_PRESETS,HAULER_IDS,HAULER_TUNABLES,preset,adjust,
 haulerDimensions,H2_INTERFACE} from './haulerFantasyDesign.js';
import {createMovingHauler,HAULER_MOTIONS} from './haulerFantasyMotion.js';
const $=id=>document.getElementById(id);
const stage=$('stage'),canvas=$('scene'),panels=$('panels');
const state={selected:'dock',focus:innerWidth<761,fullRig:false,
 silhouette:false,contacts:false,joints:false,ghost:false,arena:false,grid:true,
 motion:'idle',playing:false,phase:0,speed:1,
 view:'quarter',yaw:.68,pitch:.22,zoom:1,panX:0,panY:0,footprint:false,assemblyView:'all',
 edits:Object.fromEntries(HAULER_IDS.map(id=>[id,preset(id)]))};
const scene=new THREE.Scene();scene.background=new THREE.Color(0x354636);
scene.add(new THREE.HemisphereLight(0xe9e1cb,0x33483e,2.15));
const sun=new THREE.DirectionalLight(0xffdba3,2.65);sun.position.set(-4,9,-6);scene.add(sun);
const edge=new THREE.DirectionalLight(0xa9ccbb,1.3);edge.position.set(4,4,5);scene.add(edge);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(32,32),
 new THREE.MeshStandardMaterial({color:0x2e4233,roughness:1}));
floor.rotation.x=-Math.PI/2;floor.position.y=.188;scene.add(floor);
const grid=new THREE.GridHelper(24,32,0x71836c,0x4a5c4a);grid.position.y=.192;scene.add(grid);
const ink=new THREE.MeshBasicMaterial({color:0x122019});
const camera=new THREE.OrthographicCamera(-2,2,2,-2,.04,75);
let renderer;
try{
 renderer=new THREE.WebGLRenderer({canvas,alpha:false,antialias:false,powerPreference:'low-power'});
 renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));
 renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;
 renderer.toneMappingExposure=1.14;
 renderer.setScissorTest(true);
}catch(error){$('error').hidden=false;$('error').textContent='3D lab cannot start: '+error.message;throw error;}
const assembly=buildExteriorRig(makeTestAssembly());
const originalMount=assembly.partGroups.get('mobility');
if(!originalMount)throw Error('Missing actual mobility mount in the five-station assembly');
for(const child of [...originalMount.children])originalMount.remove(child);
const rigs=new Map();
function addFootprintMarkers(study){
 const outlines=[];
 for(const limb of study.limbs){
  const width=study.params.soleWidth,depth=study.params.soleDepth;
  const geometry=new THREE.EdgesGeometry(new THREE.BoxGeometry(width,.006,depth));
  const mat=new THREE.LineBasicMaterial({color:0xe7bd75,depthTest:false});
  const edge=new THREE.LineSegments(geometry,mat);
  edge.name='DEV / grounded footprint '+limb.leg.side;
  edge.position.set(0,-.083,0);edge.visible=false;
  limb.foot.add(edge);outlines.push(edge);
 }
 return outlines;
}
function sectionOf(obj){
 if(obj.userData?.dynamicActuator)return 'actuator';
 let parent=obj.parent;
 while(parent){
  if(parent.userData?.joint==='foot')return 'feet';
  parent=parent.parent;
 }
 if(/stationary drive pod|top casting|guide shroud|transverse head|fixed shear truss|main axle mount|compact central|enclosed outer guide|guide crown|integral stationary|upper spherical bearing|side connector|load-distribution casting/.test(obj.name))
  return 'housing';
 if(obj.name.includes('U1 reference')||obj.name.includes('contact face'))return 'housing';
 return 'structure';
}
function applySectionVisibility(study){
 const mode=state.assemblyView;
 study.root.traverse(obj=>{
  if(!obj.isMesh||obj.userData.jointMarker||obj.userData.contactMarker)return;
  const section=sectionOf(obj);
  obj.visible=mode==='all'||
   mode==='feet'&&section==='feet'||
   mode==='housings'&&section==='housing'||
   mode==='mechanism'&&(section==='actuator'||section==='structure');
 });
}
function markJoints(study){
 const markers=[];
 for(const limb of study.limbs){
  for(const joint of ['hip','knee','ankle']){
   const dot=new THREE.Mesh(new THREE.SphereGeometry(.040,8,6),
    new THREE.MeshBasicMaterial({color:0x79cfb7,depthTest:false}));
   dot.name='DEV / '+joint+' locator '+limb.leg.side;
   dot.userData.jointMarker=true;dot.visible=false;
   limb[joint].add(dot);markers.push(dot);
  }
 }
 return markers;
}
for(const p of HAULER_PRESETS){
 const root=assembly.root.clone(true);
 const mount=root.getObjectByName(originalMount.name);
 if(!mount)throw Error('Missing mobility attachment in cloned upper structure');
 const study=createMovingHauler(state.edits[p.id]);
 const markers=markJoints(study);
 const outlines=addFootprintMarkers(study);
 mount.add(study.root);root.visible=false;scene.add(root);
 const upperGroups=[...assembly.partGroups.entries()].filter(([k])=>k!=='mobility')
  .map(([,group])=>root.getObjectByName(group.name)).filter(Boolean);
 rigs.set(p.id,{root,mount,study,upperGroups,markers,outlines,ghosts:[],base:root.position.clone()});
}
let dirty=false,frameCount=0,lastTime;
function schedule(){if(dirty)return;dirty=true;requestAnimationFrame(render);}
function disposeGhosts(r){
 for(const g of r.ghosts){
  r.mount.remove(g);
  g.traverse(o=>{if(o.isMesh&&o.material?.userData?.ghostCopy)o.material.dispose();});
 }
 r.ghosts=[];
}
function ghostsForSelected(){
 const rig=rigs.get(state.selected);for(const r of rigs.values())disposeGhosts(r);
 if(!state.ghost||!state.focus)return;
 for(const p of HAULER_PRESETS){
  if(p.id===state.selected)continue;
  const study=rigs.get(p.id).study.root.clone(true);
  study.name='DEV / ghost '+p.title;
  study.traverse(o=>{
   if(!o.isMesh)return;
   const material=new THREE.MeshBasicMaterial({color:0x97c1ac,
    transparent:true,opacity:.20,depthWrite:false,side:THREE.DoubleSide});
   material.userData.ghostCopy=true;
   o.material=material;
   o.userData.ghostCopy=true;
   if(o.userData.contactMarker||o.userData.jointMarker)o.visible=false;
  });
  rig.mount.add(study);rig.ghosts.push(study);
 }
}
function replaceStudy(id){
 const r=rigs.get(id);for(const rig of rigs.values())disposeGhosts(rig);
 r.mount.remove(r.study.root);
 r.study.root.traverse(obj=>{if(obj.isMesh)obj.geometry.dispose();});
 r.markers.forEach(m=>{m.material.dispose();m.geometry.dispose();});
 r.outlines.forEach(m=>{m.material.dispose();m.geometry.dispose();});
 r.fitKey=null;
 r.study=createMovingHauler(state.edits[id]);
 r.markers=markJoints(r.study);
 r.outlines=addFootprintMarkers(r.study);
 r.mount.add(r.study.root);
 ghostsForSelected();
 schedule();
}
function inspect(){
 return {selected:state.selected,focus:state.focus,fullRig:state.fullRig,
  silhouette:state.silhouette,contacts:state.contacts,joints:state.joints,
  ghost:state.ghost,arena:state.arena,grid:state.grid,
  footprint:state.footprint,assemblyView:state.assemblyView,
  motion:state.motion,playing:state.playing,phase:state.phase,speed:state.speed,
  view:state.view,yaw:state.yaw,pitch:state.pitch,zoom:state.zoom,
  frameCount,candidates:HAULER_PRESETS.map(p=>{
   const r=rigs.get(p.id),data=haulerDimensions(state.edits[p.id]);
   return {id:p.id,mechanism:data.mechanism,soleWidth:data.soleWidth,
    hipSpan:data.hipSpan,ground:data.ground,mount:data.topContact,
    motion:r.study.root.userData.lastPose,
    framing:r.frameInfo??null,
    meshCount:(()=>{let n=0;r.study.root.traverse(x=>{if(x.isMesh&&!x.userData.jointMarker&&!x.userData.contactMarker)n++;});return n;})()};
  })};
}
window.__haulerFantasyLab={ready:true,inspect};
function setFocus(yes){
 state.focus=yes;panels.classList.toggle('single',yes);
 stage.classList.toggle('compare-mode',!yes);
 $('compare').setAttribute('aria-pressed',String(!yes));
 $('focus').setAttribute('aria-pressed',String(yes));
 for(const panel of panels.querySelectorAll('.panel'))
  panel.classList.toggle('active',panel.dataset.id===state.selected);
 ghostsForSelected();schedule();
}
function choose(id){
 if(!HAULER_IDS.includes(id))throw Error('Unknown Hauler concept '+id);
 state.selected=id;
 const p=HAULER_PRESETS.find(x=>x.id===id);
 $('selected-name').textContent=p.letter+' / '+p.title;
 $('selected-description').textContent=p.brief;
 $('mechanism').textContent=p.mechanism.toUpperCase().replace(/-/g,' / ');
 for(const b of document.querySelectorAll('[data-choose]'))
  b.setAttribute('aria-pressed',String(b.dataset.choose===id));
 for(const panel of panels.querySelectorAll('.panel'))
  panel.classList.toggle('active',panel.dataset.id===id);
 for(const key of Object.keys(HAULER_TUNABLES)){
  const val=state.edits[id][key];
  $(key).value=val;
  $(key+'-value').textContent=(key==='hipSpread'?val.toFixed(3)+' m':val.toFixed(2)+'×');
 }
 const p2=haulerDimensions(state.edits[id]);
 $('footprint').textContent='H2 / '+(p2.maxFootX*2).toFixed(2)+' m SHOE SPAN · 2.55 × 1.68 × 1.35 m';
 ghostsForSelected();schedule();
}
$('compare').addEventListener('click',()=>setFocus(false));
$('focus').addEventListener('click',()=>setFocus(true));
for(const b of document.querySelectorAll('[data-choose]'))
 b.addEventListener('click',()=>choose(b.dataset.choose));
function showUpper(show){
 state.fullRig=show;
 $('full-rig').setAttribute('aria-pressed',String(show));
 $('legs-only').setAttribute('aria-pressed',String(!show));schedule();
}
$('full-rig').addEventListener('click',()=>showUpper(true));
$('legs-only').addEventListener('click',()=>showUpper(false));
function view(name){
 const orientations={quarter:[.68,.22],front:[0,.10],side:[Math.PI/2,.10],rear:[Math.PI,.10]};
 if(!orientations[name])throw Error('Unknown Hauler view '+name);
 state.view=name;[state.yaw,state.pitch]=orientations[name];
 for(const b of document.querySelectorAll('[data-view]'))
  b.setAttribute('aria-pressed',String(b.dataset.view===name));schedule();
}
for(const b of document.querySelectorAll('[data-view]'))
 b.addEventListener('click',()=>view(b.dataset.view));
function zoom(f){state.zoom=Math.max(.52,Math.min(2.45,state.zoom*f));schedule();}
$('zoom-in').addEventListener('click',()=>zoom(.83));
$('zoom-out').addEventListener('click',()=>zoom(1.20));
$('reset-camera').addEventListener('click',()=>{
 state.panX=state.panY=0;state.zoom=1;view('quarter');
});
for(const key of ['silhouette','contacts','joints','ghost','arena','grid-toggle','footprint-toggle']){
 $(key).addEventListener('change',event=>{
  state[key==='grid-toggle'?'grid':key==='footprint-toggle'?'footprint':key]=event.target.checked;
  if(key==='ghost')ghostsForSelected();
  schedule();
 });
}
$('assembly-view').addEventListener('change',event=>{
 state.assemblyView=event.target.value;schedule();
});
function setMotion(mode){
 if(!HAULER_MOTIONS.includes(mode))throw Error('Unknown motion '+mode);
 state.motion=mode;if(mode==='idle'||mode==='brace')state.playing=false;
 for(const b of document.querySelectorAll('[data-motion]'))
  b.setAttribute('aria-pressed',String(b.dataset.motion===mode));
 $('play').setAttribute('aria-pressed',String(state.playing));
 $('play').textContent=state.playing?'■ STOP':'▶ PLAY';schedule();
}
for(const b of document.querySelectorAll('[data-motion]'))
 b.addEventListener('click',()=>{state.phase=0;setMotion(b.dataset.motion);});
$('play').addEventListener('click',()=>{
 if(state.motion==='idle'||state.motion==='brace')state.motion='walk';
 state.playing=!state.playing;
 setMotion(state.motion);
});
$('speed').addEventListener('input',event=>{
 state.speed=Number(event.target.value);
 $('speed-value').textContent=state.speed.toFixed(2)+'×';schedule();
});
$('phase').addEventListener('input',event=>{
 state.phase=Number(event.target.value)/100;
 state.playing=false;
 $('play').setAttribute('aria-pressed','false');$('play').textContent='▶ PLAY';
 schedule();
});
for(const key of Object.keys(HAULER_TUNABLES)){
 $(key).addEventListener('input',event=>{
  state.edits[state.selected]=adjust(state.selected,{
   ...state.edits[state.selected],[key]:Number(event.target.value)
  });
  choose(state.selected);replaceStudy(state.selected);
 });
}
$('reset-study').addEventListener('click',()=>{
 state.edits[state.selected]=preset(state.selected);
 replaceStudy(state.selected);choose(state.selected);
});
$('reset-all').addEventListener('click',()=>{
 for(const id of HAULER_IDS){state.edits[id]=preset(id);replaceStudy(id);}
 choose(state.selected);
});
const pointers=new Map();let moved=0,oldDistance=0,oldMid=null;
canvas.addEventListener('pointerdown',event=>{
 canvas.setPointerCapture(event.pointerId);
 pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
 if(pointers.size===1)moved=0;
});
canvas.addEventListener('pointermove',event=>{
 if(!pointers.has(event.pointerId))return;
 const previous=pointers.get(event.pointerId);
 pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
 if(pointers.size===1){
  const dx=event.clientX-previous.x,dy=event.clientY-previous.y;
  moved+=Math.abs(dx)+Math.abs(dy);
  state.yaw+=dx*.008;state.pitch=Math.max(-.09,Math.min(.82,state.pitch+dy*.006));schedule();
 }else if(pointers.size===2){
  const [a,b]=[...pointers.values()];
  const dist=Math.hypot(a.x-b.x,a.y-b.y),mid={x:(a.x+b.x)*.5,y:(a.y+b.y)*.5};
  if(oldDistance>0&&dist>0)zoom(oldDistance/dist);
  if(oldMid){
   state.panX-=(mid.x-oldMid.x)*.006*state.zoom;
   state.panY+=(mid.y-oldMid.y)*.006*state.zoom;
  }
  oldDistance=dist;oldMid=mid;schedule();
 }
});
function endPointer(event){
 pointers.delete(event.pointerId);
 if(pointers.size<2){oldDistance=0;oldMid=null;}
 if(pointers.size===0&&moved<9&&!state.focus){
  const element=[...panels.querySelectorAll('.panel')].find(panel=>{
   const r=panel.getBoundingClientRect();
   return event.clientX>=r.left&&event.clientX<=r.right&&
    event.clientY>=r.top&&event.clientY<=r.bottom;
  });
  if(element)choose(element.dataset.id);
 }
}
canvas.addEventListener('pointerup',endPointer);
canvas.addEventListener('pointercancel',endPointer);
canvas.addEventListener('wheel',event=>{event.preventDefault();zoom(event.deltaY>0?1.12:.89);},{passive:false});
/** Actual visible geometry determines every camera fit. Shared compare scale,
 * independent centering. Includes the complete weapon silhouette in Full Mech,
 * excludes hidden legacy frame groups, joint markers and ghost overlays.
 */
function fitVisibleRig(rig,id,aspect){
 const key=[id,state.fullRig,state.assemblyView,state.yaw.toFixed(4),
  state.pitch.toFixed(4),aspect.toFixed(4)].join('/');
 if(rig.fitKey===key)return rig.fitValue;
 rig.root.updateWorldMatrix(true,true);
 const orientationCamera=new THREE.Object3D();
 const direction=new THREE.Vector3(Math.sin(state.yaw)*Math.cos(state.pitch),
  Math.sin(state.pitch),-Math.cos(state.yaw)*Math.cos(state.pitch));
 orientationCamera.position.copy(direction);
 orientationCamera.lookAt(0,0,0);
 const right=new THREE.Vector3(1,0,0).applyQuaternion(orientationCamera.quaternion);
 const upAxis=new THREE.Vector3(0,1,0).applyQuaternion(orientationCamera.quaternion);
 let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
 const box=new THREE.Box3();
 function visit(node,visible=true){
  if(!visible||!node.visible||node.userData?.ghostCopy)return;
  if(node.isMesh&&!node.userData?.jointMarker&&!node.userData?.contactMarker&&
     node.geometry){
   if(!node.geometry.boundingBox)node.geometry.computeBoundingBox();
   const local=node.geometry.boundingBox;
   const {min,max}=local;
   for(const x of [min.x,max.x])for(const y of [min.y,max.y])
    for(const z of [min.z,max.z]){
     const pt=new THREE.Vector3(x,y,z).applyMatrix4(node.matrixWorld);
     box.expandByPoint(pt);
     const rx=right.dot(pt),uy=upAxis.dot(pt);
     minX=Math.min(minX,rx);maxX=Math.max(maxX,rx);
     minY=Math.min(minY,uy);maxY=Math.max(maxY,uy);
    }
  }
  for(const child of node.children)visit(child,true);
 }
 visit(rig.root);
 if(box.isEmpty())throw Error('No Hauler meshes visible for '+id);
 const center=box.getCenter(new THREE.Vector3());
 const width=maxX-minX,vertical=maxY-minY;
 const height=Math.max(1.7,vertical*1.19,width/Math.max(aspect,.10)*1.14);
 rig.fitKey=key;
 rig.fitValue={height,center,width,vertical};
 return rig.fitValue;
}
function render(timestamp=0){
 dirty=false;
 const dt=lastTime==null?0:Math.min(.07,Math.max(0,(timestamp-lastTime)/1000));
 lastTime=timestamp;
 if(state.playing)state.phase=(state.phase+dt*state.speed/2.15)%1;
 $('phase').value=String(Math.round(state.phase*100));
 $('phase-value').textContent=Math.round(state.phase*100)+'%';
 floor.visible=grid.visible=state.grid&&!state.silhouette;
 scene.overrideMaterial=state.silhouette?ink:null;
 const bounds=stage.getBoundingClientRect();if(bounds.width<3||bounds.height<3)return;
 renderer.setSize(bounds.width,bounds.height,false);
 const ids=state.focus?[state.selected]:HAULER_IDS;
 for(const rig of rigs.values()){
  rig.root.visible=false;
  for(const g of rig.upperGroups)g.visible=state.fullRig;
  for(const marker of rig.markers)marker.visible=state.joints;
  for(const outline of rig.outlines)outline.visible=state.footprint;
 }
 let maxReachError=0;
 const frames=[];
 for(const id of ids){
  const rig=rigs.get(id);
  const pose=rig.study.pose({motion:state.motion,phase:state.phase,contacts:state.contacts});
  applySectionVisibility(rig.study);
  maxReachError=Math.max(maxReachError,pose.reachError);
  rig.root.position.copy(rig.base);
  rig.root.position.y+=pose.bodyY;
  rig.root.position.z+=pose.bodyZ;
  rig.root.visible=true;
  const panel=panels.querySelector('[data-id="'+id+'"]');
  const rect=panel.getBoundingClientRect();
  if(rect.width<3||rect.height<3){rig.root.visible=false;continue;}
  const x=Math.floor(rect.left-bounds.left),y=Math.floor(bounds.bottom-rect.bottom);
  const w=Math.floor(rect.width),h=Math.floor(rect.height),aspect=w/h;
  // Refit when paused or when view/geometry changes, not on every walk frame.
  const fit=fitVisibleRig(rig,id,aspect);
  frames.push({id,rig,fit,x,y,w,h,aspect});
  rig.root.visible=false;
 }
 const sharedHeight=state.focus?null:Math.max(...frames.map(f=>f.fit.height));
 for(const {rig,fit,x,y,w,h,aspect} of frames){
  const height=(sharedHeight??fit.height)*(state.arena?1.65:1)*state.zoom;
  camera.left=-height*aspect*.5;camera.right=height*aspect*.5;
  camera.top=height*.5;camera.bottom=-height*.5;camera.updateProjectionMatrix();
  const target=fit.center.clone().add(new THREE.Vector3(state.panX,state.panY,0));
  const radius=10;
  camera.position.set(target.x+Math.sin(state.yaw)*radius*Math.cos(state.pitch),
   target.y+Math.sin(state.pitch)*radius,
   target.z-Math.cos(state.yaw)*radius*Math.cos(state.pitch));
  camera.lookAt(target);
  rig.frameInfo={height,projectedWidth:fit.width,projectedHeight:fit.vertical,
   viewportWidth:w,viewportHeight:h,aspect,center:target.toArray()};
  rig.root.visible=true;
  renderer.setViewport(x,y,w,h);renderer.setScissor(x,y,w,h);
  renderer.setClearColor(state.silhouette?0xa7b5a5:0x354636,1);
  renderer.clear();renderer.render(scene,camera);
  rig.root.visible=false;
 }
 $('link-status').textContent=maxReachError>.008?
  'REACH WARNING · '+maxReachError.toFixed(3)+' m':'ANCHORS CONNECTED · FEET GROUNDED';
 $('link-status').classList.toggle('warn',maxReachError>.008);
 $('motion-status').textContent=state.motion.toUpperCase()+' · '+
  (state.playing?'LOOPING · ':'PAUSED / SCRUB · ')+
  (maxReachError>.008?'REACH LIMIT '+maxReachError.toFixed(3)+' m':'HEAVY CONTACT STUDY');
 frameCount++;
 if(state.playing)schedule();
}
if('ResizeObserver'in window)new ResizeObserver(schedule).observe(stage);
window.addEventListener('resize',schedule);
setFocus(state.focus);choose('dock');showUpper(false);setMotion('idle');schedule();
