/** M3CH4 white-room construction laboratory. Entirely branch-local and isolated.
 * Stage 1–5: physical existing models, station swaps, graph inspection, exposed
 * socket positions and the existing real generator outrigger experiment.
 * NOT arbitrary joints, detached individual legs, universal sockets or combat.
 */
import * as THREE from 'three';
import { CATALOG, BY_ID, SLOT_CENTERS, graphWorldPoses } from './components.js';
import { SHARED_PART_IDS, buildPartVisual } from './partVisuals.js';
import { buildFitFixture } from './chassisFitVisuals.js';
import { fitFixtureFor } from './chassisFitFixtures.js';
import { rotatedY } from './assemblyGraph.js';
import {
  createLabMachine, labInspection, labEquip, labSetGeneratorMount, labBlueprint,
  loadLabBlueprint, labNodeList, LAB_SLOTS
} from './constructionLabCore.js';

const $=id=>document.getElementById(id);
const stage=$('viewport'), slots=$('slots'), catalog=$('catalog'), tree=$('tree');
const status=$('verdict'), inspect=$('inspection'), stats=$('stats');
const socketToggle=$('socket-toggle'), gridToggle=$('grid-toggle'),explode=$('explode');
const slotLabels={structure:'FRAME',mobility:'MOBILITY',power:'POWER',command:'CAB',combat:'WEAPON'};
let machine=createLabMachine(), selectedSlot='structure', selectedSerial=machine.installed.structure;
let currentTab='catalog', isolate=false, rayTargets=[], sockets=[],partRoots=new Map(), nodeWorldPoses=new Map();
const viewMap={quarter:[2.42,.22],front:[Math.PI,.08],side:[Math.PI/2,.10],top:[Math.PI,1.47]};
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
let azimuth=viewMap.quarter[0], elevation=viewMap.quarter[1], distance=8;
const focus=new THREE.Vector3(0,1.75,0);
const renderer=new THREE.WebGLRenderer({antialias:false,powerPreference:'low-power'});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.6));
renderer.setClearColor(0xfafbf9);
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.25;
renderer.shadowMap.enabled=false;
stage.append(renderer.domElement);
const scene=new THREE.Scene();
scene.background=new THREE.Color(0xfafbf9);
scene.add(new THREE.HemisphereLight(0xffffff,0xc5cbc4,2.4));
const key=new THREE.DirectionalLight(0xffffff,3.15);key.position.set(-4,8,-5);scene.add(key);
const fill=new THREE.DirectionalLight(0xe1e8e5,1.25);fill.position.set(6,4,2);scene.add(fill);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshStandardMaterial({color:0xffffff,roughness:.96,metalness:0}));
floor.rotation.x=-Math.PI/2;floor.position.y=-.035;scene.add(floor);
const grid=new THREE.GridHelper(30,60,0xd8dfd9,0xecf0eb);grid.position.y=-.025;grid.visible=false;scene.add(grid);
const guideMat=new THREE.MeshBasicMaterial({color:0x336c66,depthTest:true});
const usedMat=new THREE.MeshBasicMaterial({color:0xd89d57,depthTest:true});
const partGroup=new THREE.Group();scene.add(partGroup);
const markerGroup=new THREE.Group();scene.add(markerGroup);
const outline=new THREE.BoxHelper(new THREE.Object3D(),0x267c79);outline.visible=false;scene.add(outline);
const camera=new THREE.PerspectiveCamera(38,1,.06,160);
const raycaster=new THREE.Raycaster(), pointer=new THREE.Vector2();
function setMessage(message,error=false){status.textContent=message;status.classList.toggle('error',error)}
function button(label,click,extra=''){
  const el=document.createElement('button');el.type='button';el.textContent=label;
  if(extra)el.className=extra;el.addEventListener('click',click);return el;
}
function renderSlots(){
  slots.replaceChildren();
  LAB_SLOTS.forEach(slot=>{
    const b=button(slotLabels[slot],()=>{selectedSlot=slot;renderSlots();renderCatalog();});
    b.setAttribute('aria-pressed',String(selectedSlot===slot));slots.append(b);
  });
}
function renderCatalog(){
  catalog.replaceChildren();
  const installed=machine.owned.find(p=>p.serial===machine.installed[selectedSlot])?.definitionId;
  CATALOG.filter(p=>p.slot===selectedSlot).forEach(def=>{
    const real=SHARED_PART_IDS.includes(def.id)||['power-dynamo'].includes(def.id);
    const entry=button('',()=>{
      const result=labEquip(machine,selectedSlot,def.id);
      if(!result.ok){setMessage(result.reason,true);return;}
      selectedSerial=machine.installed[selectedSlot];
      rebuild(true);setMessage('Installed '+def.name);
    },'catalog-entry');
    if(def.id===installed)entry.classList.add('active');
    const text=document.createElement('span'),name=document.createElement('strong'),meta=document.createElement('small');
    name.textContent=def.name;meta.textContent=def.massKg+' kg · '+(def.mountSize||'FRAME')+(real?'':' · ENVELOPE PREVIEW');
    text.append(name,meta);const indicator=document.createElement('b');
    indicator.textContent=def.id===installed?'FITTED':'+ FIT';entry.append(text,indicator);catalog.append(entry);
  });
}
function own(serial){return machine.owned.find(p=>p.serial===serial);}
function showTree(){
  tree.replaceChildren();
  labNodeList(machine).forEach(node=>{
    const row=button('',()=>{
      selectedSerial=node.serial;refreshSelection();showTree();renderInspection();switchTab('inspect');
    },'tree-row tree-depth-'+Math.min(2,node.depth));
    row.setAttribute('aria-pressed',String(selectedSerial===node.serial));
    const content=document.createElement('span');content.className='tree-label';
    const nm=document.createElement('strong'),sub=document.createElement('small');
    nm.textContent=node.name;
    sub.textContent=node.serial+(node.parentSocket?' · '+node.parentSocket:' · ROOT')+(node.virtual?' · ADAPTER':'');
    content.append(nm,sub);row.append(content);tree.append(row);
  });
  const mount=$('mount-control');mount.replaceChildren();
  const power=machine.installed.power && own(machine.installed.power);
  if(power){
    const card=document.createElement('section');card.className='card';
    const title=document.createElement('h2');title.textContent='PHYSICAL GENERATOR MOUNT';
    const help=document.createElement('p');help.className='meta';
    help.textContent='Existing graph-backed mount experiment: direct rear station or +85 kg left outrigger.';
    card.append(title,help);
    for(const [id,label] of [['standard','REAR / DIRECT'],['offset','LEFT / OUTRIGGER']]){
      const b=button(label,()=>{
        const r=labSetGeneratorMount(machine,id);
        if(!r.ok){setMessage(r.reason,true);return;}
        rebuild(false);setMessage(id==='offset'?'Outrigger installed':'Direct mount restored');
      });
      b.style.marginRight='5px';card.append(b);
    }mount.append(card);
  }
}
function renderInspection(){
  inspect.replaceChildren();
  const node=labNodeList(machine).find(n=>n.serial===selectedSerial);
  const card=document.createElement('section');card.className='card';
  const heading=document.createElement('h2');heading.textContent=node?.name||'SELECT A PART';card.append(heading);
  if(node){
    const def=BY_ID.get(node.definitionId);
    const data=[
      ['Identity',node.serial],
      ['Type',def?.slot?.toUpperCase()||'STRUCTURAL ADAPTER'],
      ['Attached to',node.parentSerial||'ROOT'],
      ['Socket',node.parentSocket||'—'],
      ['Mount',def?.mountSize||'—'],
      ['Mass',def?.massKg+' kg'||'—'],
      ['Condition',own(node.serial)?Math.round((own(node.serial).condition||0)*100)+'%':'Structural adapter']
    ];
    data.forEach(([title,value])=>{
      const line=document.createElement('div');line.className='metric';
      const a=document.createElement('span'),b=document.createElement('strong');
      a.textContent=title;b.textContent=value;line.append(a,b);card.append(line);
    });
    const description=document.createElement('p');description.className='meta';
    description.textContent=def?.description||'Adapter defined in the shared structural graph.';
    card.append(description);
    if(def&&!SHARED_PART_IDS.includes(def.id)&&def.id!=='power-dynamo'){
      const note=document.createElement('p');note.className='meta';
      note.textContent='The shared standalone visual registry has not yet migrated this mesh. A labeled envelope placeholder is displayed.';
      card.append(note);
    }
  }
  inspect.append(card);
  const info=document.createElement('p');info.className='explain';
  info.textContent='This stage supports the existing full assemblies and real adapter mounts. Individual knees, shins, and unrestricted attachments are deliberately not editable yet.';
  inspect.append(info);
}
function switchTab(which){
  currentTab=which;
  document.querySelectorAll('[data-tab]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.tab===which)));
  for(const tab of ['catalog','tree','inspect'])$(tab+'-panel').hidden=which!==tab;
}
document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>switchTab(b.dataset.tab)));
function makeProxy(def){
  // Deliberate technical placeholder, never an invented replacement model.
  const root=new THREE.Group(),size=def.envelope||[.8,.8,.8];
  const shell=new THREE.Mesh(new THREE.BoxGeometry(...size),new THREE.MeshStandardMaterial({
    color:0xaab7af,transparent:true,opacity:.22,roughness:1,depthWrite:false
  }));
  const edge=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(...size)),new THREE.LineBasicMaterial({color:0x648078,transparent:true,opacity:.75}));
  root.add(shell,edge);root.userData.proxy=true;return root;
}
function makeVisual(def){
  const actual=buildPartVisual(def.id,{mode:'preview'});
  if(actual)return actual;
  if(def.id==='power-dynamo'){
    const fixture=fitFixtureFor(def.id);
    if(fixture)return buildFitFixture(fixture);
  }
  return makeProxy(def);
}
function makeAdapterVisual(node){
  const group=new THREE.Group(),m=new THREE.MeshStandardMaterial({color:0x788f86,metalness:.3,roughness:.68});
  const shape=node.definitionId==='hip-h2-u1'?
    new THREE.CylinderGeometry(.40,.40,.11,14):new THREE.BoxGeometry(.65,.12,.24);
  group.add(new THREE.Mesh(shape,m));group.userData.proxy=true;return group;
}
function clearGeometry(parent){
  for(const object of [...parent.children]){
    parent.remove(object);
    object.traverse(obj=>{
      obj.geometry?.dispose?.();
      // Don't dispose imported shared materials from the production visual kit.
      if(obj.material?.userData?.constructionLabOwned)obj.material.dispose();
    });
  }
}
function buildModels(){
  clearGeometry(partGroup);clearGeometry(markerGroup);
  partGroup.position.set(0,0,0);
  partRoots.clear();rayTargets=[];sockets=[];
  const inspection=labInspection(machine),graph=inspection.graph;
  const frame=own(graph.root),frameDef=BY_ID.get(frame?.definitionId);
  if(!frameDef){setMessage('Missing structural frame.',true);return;}
  nodeWorldPoses=graphWorldPoses(graph,BY_ID,frameDef.center);
  const nodes=labNodeList(machine);
  nodes.forEach(node=>{
    const pose=nodeWorldPoses.get(node.serial);if(!pose)return;
    const def=BY_ID.get(node.definitionId);
    const model=def?makeVisual(def):makeAdapterVisual(node);
    model.name='lab:'+node.serial;
    model.userData.labSerial=node.serial;
    model.position.set(...pose.position);model.rotation.y=pose.rotationQuarterTurns*Math.PI/2;
    partGroup.add(model);partRoots.set(node.serial,model);
    model.traverse(obj=>{if(obj.isMesh){obj.userData.labSerial=node.serial;rayTargets.push(obj);}});
  });
  let bounds=new THREE.Box3().setFromObject(partGroup);
  if(!bounds.isEmpty()){
    partGroup.position.y-=bounds.min.y;
    bounds=new THREE.Box3().setFromObject(partGroup);
    // Keep existing frame coordinates; only shift the whole assembled machine.
  }
  for(const node of nodes){
    const pose=nodeWorldPoses.get(node.serial);
    const def=BY_ID.get(node.definitionId);
    if(!pose||!def?.sockets)continue;
    for(const socket of def.sockets){
      const taken=Object.values(graph.nodes).some(n=>n.parentSerial===node.serial&&n.parentSocket===socket.id);
      const orb=new THREE.Mesh(new THREE.SphereGeometry(.085,9,7),taken?usedMat:guideMat);
      const relative=rotatedY(socket.position,pose.rotationQuarterTurns);
      orb.position.set(pose.position[0]+relative[0],pose.position[1]+relative[1]+partGroup.position.y,pose.position[2]+relative[2]);
      orb.userData.socketParent=node.serial;orb.userData.socketId=socket.id;
      markerGroup.add(orb);sockets.push(orb);
    }
  }
  markerGroup.visible=socketToggle.checked;
  applyExplode();applyIsolation();
  return bounds;
}
function applyExplode(){
  const fraction=Number(explode.value)/100;
  const rootPart=partRoots.get(labInspection(machine).graph.root);
  const center=rootPart?rootPart.position:new THREE.Vector3();
  for(const [serial,model] of partRoots){
    const pose=nodeWorldPoses.get(serial);
    if(!pose)continue;
    model.position.set(...pose.position);
    if(serial===labInspection(machine).graph.root)continue;
    const vector=model.position.clone().sub(center);
    if(vector.length()<.12)vector.set(serial.includes('AD-')?0:-1,1,.3);
    vector.normalize();
    model.position.addScaledVector(vector,fraction*.9);
  }
  markerGroup.visible=socketToggle.checked&&fraction<.01;
  refreshSelection();
}
function applyIsolation(){
  for(const [serial,model] of partRoots)model.visible=!isolate || serial===selectedSerial;
  markerGroup.visible=!isolate&&socketToggle.checked&&Number(explode.value)<1;
  refreshSelection();
}
function refreshSelection(){
  const part=partRoots.get(selectedSerial);
  if(!part||!part.visible){outline.visible=false;return;}
  outline.setFromObject(part);outline.visible=true;
}
function reframe(){
  const bounds=new THREE.Box3().setFromObject(partGroup);
  if(bounds.isEmpty())return;
  const center=bounds.getCenter(new THREE.Vector3()), size=bounds.getSize(new THREE.Vector3());
  focus.copy(center);
  distance=clamp(Math.max(size.x,size.y,size.z)*2.0+1.8,3.2,26);
  updateCamera();
}
function rebuild(fit=true){
  const bounds=buildModels();
  renderSlots();renderCatalog();showTree();renderInspection();
  const verdict=labInspection(machine);
  const nr=labNodeList(machine).length;
  const absent=LAB_SLOTS.filter(s=>!machine.installed[s]).length;
  stats.textContent=nr+' PHYSICAL GRAPH NODES · '+Math.round(verdict.machineCheck.massKg)+' KG';
  $('stageMode').textContent=absent?'INCOMPLETE':'STRUCTURAL GRAPH V1';
  if(!verdict.valid)setMessage(verdict.graphCheck.errors.join(' | '),true);
  else if(!verdict.ready)setMessage('Structurally valid · not combat-ready in live rules',false);
  else setMessage('Assembly graph valid · '+nr+' nodes');
  if(bounds&&fit)reframe();
  refreshSelection();
}
function updateCamera(){
  const cp=Math.cos(elevation);
  camera.position.set(
    focus.x+Math.sin(azimuth)*cp*distance,
    focus.y+Math.sin(elevation)*distance,
    focus.z+Math.cos(azimuth)*cp*distance
  );
  camera.lookAt(focus);
}
function pick(x,y){
  const rect=renderer.domElement.getBoundingClientRect();
  if(!rect.width||!rect.height)return;
  pointer.set((x-rect.left)/rect.width*2-1,-(y-rect.top)/rect.height*2+1);
  raycaster.setFromCamera(pointer,camera);
  const marker=markerGroup.visible?raycaster.intersectObjects(sockets,false)[0]:null;
  if(marker){
    selectedSerial=marker.object.userData.socketParent;
    setMessage('Socket '+marker.object.userData.socketId+' on '+selectedSerial);
  }else{
    const hit=raycaster.intersectObjects(rayTargets,false).find(h=>h.object.visible);
    if(!hit)return;
    selectedSerial=hit.object.userData.labSerial;
  }
  refreshSelection();showTree();renderInspection();switchTab('inspect');
}
function cameraPreset(name){
  [azimuth,elevation]=viewMap[name];reframe();
}
$('view-reset').addEventListener('click',()=>cameraPreset('quarter'));
$('view-front').addEventListener('click',()=>cameraPreset('front'));
$('view-side').addEventListener('click',()=>cameraPreset('side'));
$('view-top').addEventListener('click',()=>cameraPreset('top'));
$('reset').addEventListener('click',()=>{
  machine=createLabMachine();selectedSlot='structure';selectedSerial=machine.installed.structure;isolate=false;
  $('isolate').setAttribute('aria-pressed','false');explode.value='0';rebuild(true);setMessage('Clean test rig restored');
});
$('isolate').addEventListener('click',()=>{
  isolate=!isolate;$('isolate').setAttribute('aria-pressed',String(isolate));applyIsolation();
});
explode.addEventListener('input',applyExplode);
socketToggle.addEventListener('change',applyIsolation);
gridToggle.addEventListener('change',()=>{grid.visible=gridToggle.checked;});
$('export').addEventListener('click',()=>{
  try{
    const data=JSON.stringify(labBlueprint(machine),null,2);
    const objectUrl=URL.createObjectURL(new Blob([data],{type:'application/json'}));
    const link=document.createElement('a');link.href=objectUrl;link.download='m3ch4-construction-lab.json';
    document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(objectUrl),250);
    setMessage('Blueprint exported · laboratory format v1');
  }catch(error){setMessage(error.message,true);}
});
$('import').addEventListener('click',()=>$('import-file').click());
$('import-file').addEventListener('change',async event=>{
  const file=event.target.files?.[0];event.target.value='';
  if(!file)return;
  if(file.size>250000){setMessage('Blueprint exceeds 250 KB limit.',true);return;}
  try{
    const next=loadLabBlueprint(JSON.parse(await file.text()));
    machine=next;selectedSerial=machine.installed.structure;rebuild(true);
    setMessage('Blueprint imported and validated.');
  }catch(error){setMessage('Import blocked: '+error.message,true);}
});
const pointers=new Map();let gesture=null;
function multiCenter(){
  const a=[...pointers.values()];return {x:(a[0].x+a[1].x)/2,y:(a[0].y+a[1].y)/2,
    spread:Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y)};
}
stage.addEventListener('pointerdown',e=>{
  if(e.target!==renderer.domElement)return;
  stage.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId,{x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,moved:false});
  if(pointers.size===2)gesture=multiCenter();
});
stage.addEventListener('pointermove',e=>{
  if(!pointers.has(e.pointerId))return;
  const old=pointers.get(e.pointerId),dx=e.clientX-old.x,dy=e.clientY-old.y;
  old.x=e.clientX;old.y=e.clientY;
  if(Math.hypot(old.x-old.startX,old.y-old.startY)>7)old.moved=true;
  if(pointers.size===2){
    const now=multiCenter();
    if(gesture){
      distance=clamp(distance*gesture.spread/Math.max(now.spread,5),2,40);
      // Parallel two-finger motion pans the orbit target.
      const rect=stage.getBoundingClientRect();
      const scale=distance*Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*2/Math.max(1,rect.height);
      const right=new THREE.Vector3().setFromMatrixColumn(camera.matrix,0);
      const up=new THREE.Vector3().setFromMatrixColumn(camera.matrix,1);
      focus.addScaledVector(right,-(now.x-gesture.x)*scale);
      focus.addScaledVector(up,(now.y-gesture.y)*scale);
    }
    gesture=now;
  }else if(pointers.size===1){
    if(e.shiftKey){
      const scale=distance*.0018;
      const right=new THREE.Vector3().setFromMatrixColumn(camera.matrix,0);
      const up=new THREE.Vector3().setFromMatrixColumn(camera.matrix,1);
      focus.addScaledVector(right,-dx*scale);focus.addScaledVector(up,dy*scale);
    }else{
      azimuth-=dx*.009;elevation=clamp(elevation+dy*.007,-.75,1.48);
    }
  }
  updateCamera();
});
stage.addEventListener('pointerup',e=>{
  const old=pointers.get(e.pointerId);
  if(old&&!old.moved&&pointers.size===1)pick(e.clientX,e.clientY);
  pointers.delete(e.pointerId);gesture=pointers.size===2?multiCenter():null;
});
stage.addEventListener('pointercancel',e=>{pointers.delete(e.pointerId);gesture=null;});
stage.addEventListener('wheel',e=>{e.preventDefault();distance=clamp(distance*Math.exp(e.deltaY*.001),2,40);updateCamera();},{passive:false});
function resize(){
  const width=stage.clientWidth,height=stage.clientHeight;
  if(!width||!height)return;
  camera.aspect=width/height;camera.updateProjectionMatrix();renderer.setSize(width,height,false);
}
new ResizeObserver(resize).observe(stage);
function animate(){requestAnimationFrame(animate);renderer.render(scene,camera);}
renderSlots();rebuild(true);resize();animate();
