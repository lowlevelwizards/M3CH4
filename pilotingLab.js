/** A.0 — isolated, no-save proving ground using production rig models,
 * locomotion, animation, joystick, terrain collision and audio event logic.
 * No combat initialization, economy, campaign state or browser save writes.
 */
import * as THREE from 'three';
import {makeTestAssembly,equip} from './components.js';
import {makeRangeTarget} from './combat.js';
import {deriveRigConfig} from './assemblyPhysics.js';
import {createRigState,stepRig,DEFAULT_WORLD} from './locomotion.js?v=a7';
import {Controls,bodyFollowSteer} from './controls.js';
import {createArenaScene} from './sceneAssembly.js?v=b4';
import {GROUND_MATERIALS,PILOTING_GROUND_PATCHES,groundMaterialAt,groundGripScale} from './groundSurfaceMaterials.js?v=a7';
import {createLabProps,resetLabProps,stepLabProps} from './labPropPhysics.js?v=a8';
import {soundFamilyFor,createMotionSoundState,advanceContactMotionSound} from './liveSystemsEvents.js?v=a5';
import {advanceFootContacts} from './footContactController.js?v=k5b2';
import {groundFootprint} from './groundFootprintEvidence.js?v=k5b3';
import {LOADING_DOCK,loadingDockHeight,advanceLabElevation} from './loadingDockTraversal.js?v=k5b4';
import {createPilotChallenge,advancePilotChallenge,PILOT_CHALLENGES,challengePrompt} from './pilotChallenges.js?v=k5b3';
import {soundSystemEvent} from './audio.js';
const $=id=>document.getElementById(id);
const machine=makeTestAssembly();
const renderer=new THREE.WebGLRenderer({antialias:false,powerPreference:'high-performance'});
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.22;
renderer.shadowMap.enabled=true;
renderer.setPixelRatio(1);
renderer.domElement.style.touchAction='none';
$('stage').append(renderer.domElement);
const arena=createArenaScene(machine,makeRangeTarget());
arena.setInspection(false);
arena.setPilotingLab(true);
let state=createRigState(),gait=createMotionSoundState(),config=deriveRigConfig(machine);
let soundOn=false,frameCount=0,worstGap=0,hitches=0,travel=0,lastTime=0,accumulator=0,fps=60;
let challengeState=createPilotChallenge();
const challengeBests=new Map();
const DT=1/60;
const controls=new Controls($('drive-zone'),$('drive-knob'),$('look-zone'),$('brake'));
const turn={left:false,right:false};
let quickstep={side:0,remaining:0};
function heldButton(id,key){
 const button=$(id);
 const end=()=>{turn[key]=false;button.classList.remove('active');};
 button.addEventListener('pointerdown',e=>{e.preventDefault();turn[key]=true;button.classList.add('active');button.setPointerCapture(e.pointerId);});
 for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,end);
 window.addEventListener('blur',end);
}
heldButton('turn-left','left');heldButton('turn-right','right');
// Quickstep is an intent sustained briefly through the unchanged lateral
// motor and traction limits. It cannot teleport, exceed max acceleration,
// or operate on a disabled mobility system.
for(const [id,side] of [['quick-left',-1],['quick-right',1]]){
 $(id).addEventListener('pointerdown',event=>{
  event.preventDefault();
  quickstep={side,remaining:.26};
 });
}
const markers=new THREE.Group();arena.scene.add(markers);
const challengeMarkers=new THREE.Group();arena.scene.add(challengeMarkers);
const gateMaterial=new THREE.MeshBasicMaterial({color:0xe1b55d,
 side:THREE.DoubleSide,transparent:true,opacity:.78,depthWrite:false});
function syncChallengeMarkers(){
 challengeMarkers.clear();
 const gate=PILOT_CHALLENGES[$('challenge').value]?.checkpoints?.[challengeState.progress];
 if(!gate||challengeState.complete)return;
 const circle=new THREE.Mesh(new THREE.RingGeometry(gate.radius*.87,gate.radius,32),gateMaterial);
 circle.rotation.x=-Math.PI/2;circle.position.set(gate.x,.066+(challengeState.id==='climb'?LOADING_DOCK.heightM:0),gate.z);
 challengeMarkers.add(circle);
}
// Paint visible patches over the real existing arena floor. The meshes have
// no collision geometry; groundMaterialAt supplies the authoritative grip.
const terrainVisuals=new THREE.Group();
terrainVisuals.name='piloting-ground-material-samples';
arena.scene.add(terrainVisuals);
for(const patch of PILOTING_GROUND_PATCHES){
 const surface=GROUND_MATERIALS[patch.surface];
 const width=patch.maxX-patch.minX,height=patch.maxZ-patch.minZ;
 const mesh=new THREE.Mesh(new THREE.PlaneGeometry(width,height),
   new THREE.MeshStandardMaterial({color:surface.color,roughness:.95,metalness:.08,
     transparent:true,opacity:.84,depthWrite:false,side:THREE.DoubleSide}));
 mesh.rotation.x=-Math.PI/2;
 mesh.position.set((patch.maxX+patch.minX)/2,.05,(patch.maxZ+patch.minZ)/2);
 mesh.receiveShadow=true;
 terrainVisuals.add(mesh);
}
const dockRoot=new THREE.Group();arena.scene.add(dockRoot);
dockRoot.name='loading-dock-trial';
const dockSurface=[19,14,10,7];
const dockHeights=[0,LOADING_DOCK.heightM,LOADING_DOCK.heightM,0];
const dockPositions=[];
for(let i=0;i<dockSurface.length-1;i++){
 for(const [x,z,y] of [
   [-LOADING_DOCK.halfWidth,dockSurface[i],dockHeights[i]],
   [LOADING_DOCK.halfWidth,dockSurface[i],dockHeights[i]],
   [-LOADING_DOCK.halfWidth,dockSurface[i+1],dockHeights[i+1]],
   [LOADING_DOCK.halfWidth,dockSurface[i],dockHeights[i]],
   [LOADING_DOCK.halfWidth,dockSurface[i+1],dockHeights[i+1]],
   [-LOADING_DOCK.halfWidth,dockSurface[i+1],dockHeights[i+1]],
 ])dockPositions.push(x,y+.016,z);
}
const dockGeometry=new THREE.BufferGeometry();
dockGeometry.setAttribute('position',new THREE.Float32BufferAttribute(dockPositions,3));
dockGeometry.computeVertexNormals();
const dockMesh=new THREE.Mesh(dockGeometry,new THREE.MeshStandardMaterial({
 color:0x697270,metalness:.42,roughness:.72,side:THREE.DoubleSide,
}));
dockMesh.receiveShadow=true;dockRoot.add(dockMesh);
dockRoot.visible=false;
const markerMat=new THREE.MeshStandardMaterial({color:0xb68b37,metalness:.18,roughness:.89});
const metalMat=new THREE.MeshStandardMaterial({color:0x3b7770,metalness:.27,roughness:.8});
// At most four lightweight reactive objects. These are not authoritative
// contract cover or salvage: only this no-save piloting yard owns them.
const looseProps=createLabProps();
const loosePropMeshes=new Map();
const loosePropRoot=new THREE.Group();
arena.scene.add(loosePropRoot);
for(const p of looseProps){
 const barrel=p.kind==='barrel';
 const geometry=barrel?new THREE.CylinderGeometry(p.radius*.85,p.radius*.85,.84,10):
   new THREE.BoxGeometry(p.radius*1.55,.84,p.radius*1.55);
 const material=new THREE.MeshStandardMaterial({color:barrel?0x4f7571:0x8d703e,
   roughness:.86,metalness:barrel?.48:.20,flatShading:true});
 const mesh=new THREE.Mesh(geometry,material);
 mesh.position.set(p.x,barrel?p.radius*.85:.44,p.z);
 if(barrel){mesh.rotation.order='ZYX';mesh.rotation.z=Math.PI/2;}
 mesh.castShadow=true;mesh.receiveShadow=true;
 loosePropRoot.add(mesh);
 loosePropMeshes.set(p.id,mesh);
}
let propImpacts=0;
const extraObstacles=[];
for(const [index,x,z] of [[0,-7,10],[1,-10,5],[2,8,8]]){
 const cone=new THREE.Mesh(new THREE.CylinderGeometry(.24,.42,1.15,6),markerMat);
 cone.position.set(x,.575,z);cone.castShadow=true;markers.add(cone);
 const plate=new THREE.Mesh(new THREE.BoxGeometry(1,.07,1),metalMat);
 plate.position.set(x,.04,z);markers.add(plate);
 extraObstacles.push({id:'lab-pylon-'+index,minX:x-.43,maxX:x+.43,minZ:z-.43,maxZ:z+.43,height:1.15,kind:'barrier'});
}
const stopMat=new THREE.MeshBasicMaterial({color:0xd6a852});
for(const z of [20,13]){
 const stop=new THREE.Mesh(new THREE.BoxGeometry(6,.015,.075),stopMat);
 stop.position.set(0,.035,z);markers.add(stop);
}
const world={...DEFAULT_WORLD,obstacles:[...DEFAULT_WORLD.obstacles,...extraObstacles]};
function setCamera(){
 const chase=$('view').value==='chase';
 arena.setPilotingLab(true,chase);
 arena.setSpectatorRig(chase?state:null);
 // A production scene already owns the actual model; only its visibility
 // and observer are changed. No duplicate WebGL context for the machine.
}
function reset(){
 state=createRigState();
 gait=createMotionSoundState();
 state.terrainHeightAt=$('challenge').value==='climb'?loadingDockHeight:null;
 state.groundHeightM=0;
 challengeState=createPilotChallenge($('challenge').value);
 syncChallengeMarkers();
 quickstep={side:0,remaining:0};
 travel=0;worstGap=0;hitches=0;frameCount=0;propImpacts=0;
 resetLabProps(looseProps);
 controls.cancelPointers();
 controls.recenterLook();
 setCamera();
}
function fit(){
 const family=$('family').value;
 const result=equip(machine,'mobility',family);
 if(result?.ok===false)throw Error('Incompatible leg configuration: '+family);
 arena.rebuildAssembly(machine);
 arena.setPilotingLab(true);
 config=deriveRigConfig(machine);
 reset();
}
$('family').addEventListener('change',fit);
$('challenge').addEventListener('change',()=>{
 // No props in precision/slalom, but hauling needs the existing tool chest.
 $('props-mode').value=$('challenge').value==='haul'?'on':'off';
 dockRoot.visible=$('challenge').value==='climb';
 loosePropRoot.visible=$('props-mode').value==='on';
 reset();
});
$('handling').addEventListener('change',reset);
$('props-mode').addEventListener('change',()=>{
 loosePropRoot.visible=$('props-mode').value==='on';
 reset();
});
$('surface-mode').addEventListener('change',()=>{
 terrainVisuals.visible=$('surface-mode').value==='mixed';
 reset();
});
$('view').addEventListener('change',setCamera);
$('reset').addEventListener('click',reset);
$('audio').addEventListener('click',()=>{
 soundOn=!soundOn;
 $('audio').textContent=soundOn?'SOUND ON':'SOUND OFF';
});
function resize(){
 const w=Math.max(1,window.innerWidth),h=Math.max(1,window.innerHeight);
 arena.camera.aspect=w/h;
 arena.camera.updateProjectionMatrix();
 renderer.setSize(Math.round(w*.70),Math.round(h*.70),false);
 renderer.domElement.style.width=w+'px';
 renderer.domElement.style.height=h+'px';
}
window.addEventListener('resize',resize);
window.addEventListener('pagehide',()=>controls.cancelPointers());
document.addEventListener('visibilitychange',()=>{if(document.hidden)controls.cancelPointers();});
resize();setCamera();
function loop(now){
 const frameMs=lastTime?Math.max(0,now-lastTime):16.67;
 lastTime=now;
 const frameDt=Math.min(.08,frameMs/1000);
 if(!document.hidden){
  fps+=(1/Math.max(.001,frameDt)-fps)*.06;
  if(frameMs>40&&frameMs<1000){hitches++;worstGap=Math.max(worstGap,frameMs);}
  accumulator+=frameDt;
  let iterations=0;
  while(accumulator>=DT&&iterations<6){
    const input=controls.sample();
    const requestedTurn=(turn.right?1:0)-(turn.left?1:0);
    const follow=bodyFollowSteer(input.lookYaw);
    const steer=THREE.MathUtils.clamp(input.steer+requestedTurn+follow,-1,1);
    const beforeX=state.x,beforeZ=state.z,yawBefore=state.yaw;
    const stepStrafe=quickstep.remaining>0?quickstep.side:input.strafe;
    quickstep.remaining=Math.max(0,quickstep.remaining-DT);
    const ground=$('surface-mode').value==='mixed'
      ?groundMaterialAt(state.x,state.z):GROUND_MATERIALS.concrete;
    stepRig(state,{throttle:input.throttle,strafe:stepStrafe,steer,brake:input.brake},DT,
      {...config,walkingAssistEnabled:$('handling').value==='assisted',
        groundGripScale:groundGripScale(ground)},world);
    if($('props-mode').value==='on'){
      const hits=stepLabProps(looseProps,state,{massKg:config.massKg,radiusM:config.collisionRadiusM},DT);
      propImpacts+=hits.length;
      if(soundOn)for(const hit of hits)soundSystemEvent('glance',{
        cockpit:$('view').value==='cockpit',strength:hit.strength*.5,
      });
    }
    advanceLabElevation(state,config,DT,$('challenge').value==='climb');
    state.footingLoad=Math.max(state.footingLoad??0,(state.verticalDemand??0)*.28);
    travel+=Math.hypot(state.x-beforeX,state.z-beforeZ);
    gait.contactFeet=advanceFootContacts(gait.contactFeet,state,$('family').value,DT);
    const mark=groundFootprint(gait.contactFeet,state,$('family').value,ground.id);
    if(mark)arena.recordFootprint(mark);
    const previousGate=challengeState.progress,wasComplete=challengeState.complete;
    advancePilotChallenge(challengeState,state,looseProps,DT);
    if(challengeState.progress!==previousGate)syncChallengeMarkers();
    if(challengeState.complete&&!wasComplete){
      const old=challengeBests.get(challengeState.id);
      challengeBests.set(challengeState.id,Math.min(old??Infinity,challengeState.elapsed));
    }
    const events=advanceContactMotionSound(gait,soundFamilyFor($('family').value),Math.hypot(state.vx,state.vz),DT,gait.contactFeet);
    if(soundOn)for(const id of events)soundSystemEvent(id,{
      cockpit:$('view').value==='cockpit',
      strength:(id==='engine'?.2:.65)*(id===soundFamilyFor($('family').value).id?ground.impact:1),
    });
    if(Math.abs(follow)>.001)controls.compensateBodyTurn(state.yaw-yawBefore);
    accumulator-=DT;iterations++;
  }
  if(iterations===6)accumulator=0;
  const input=controls.sample();
  arena.updateRigVisual(state,input.lookYaw,input.lookPitch,frameDt,{gait});
  arena.updatePilotingLabRig(state,gait,frameDt);
  arena.updateCombatEffects(frameDt);
  for(const p of looseProps){
    const mesh=loosePropMeshes.get(p.id);
    mesh.position.x=p.x;mesh.position.z=p.z;
    if(p.kind==='barrel')mesh.rotation.x=p.spin;
    else mesh.rotation.z=p.lastImpact*.04;
  }
  renderer.render(arena.scene,arena.camera);
  window.__m3ch4PilotingLabReady=true;
  frameCount++;
  if(frameCount%10===0){
   $('fps').textContent=Math.round(fps)+' FPS';
   const feet=arena.pilotingLabFootReadout();
   const ground=$('surface-mode').value==='mixed'?groundMaterialAt(state.x,state.z):GROUND_MATERIALS.concrete;
   $('telemetry').textContent=[
    'MACHINE  '+$('family').selectedOptions[0].textContent,
    'MODE     '+($('handling').value==='assisted'?'ASSISTED WALK':'LEGACY'),
    'WALK     '+(state.walkMode||'—'),
    'SPEED    '+Math.hypot(state.vx,state.vz).toFixed(2)+' m/s',
    'FWD/LAT  '+state.forwardSpeed.toFixed(2)+' / '+state.lateralSpeed.toFixed(2),
    'YAW      '+(state.yaw*180/Math.PI).toFixed(1)+'°',
    'STOP F   '+Math.abs(state.walkSettleForceN||0).toFixed(0)+' N',
    'GRIP     '+(state.tractionUse*100).toFixed(0)+'%',
    'GROUND   '+ground.label+' · '+Math.round(groundGripScale(ground)*100)+'% CAP',
    'SLIP     '+state.footSlipMps.toFixed(2)+' m/s',
    'DRIVE    '+(state.driveLoad*100).toFixed(0)+'%',
    'CONTACT  '+(feet?.feet.map(f=>(f.side<0?'L':'R')+':'+(f.mode==='stance'?'PLANT':'STEP')).join(' / ')??'—'),
    'WEIGHT   '+((feet?.loadShift??0)*100).toFixed(0)+'% R · EFFORT '+((feet?.effort??0)*100).toFixed(0)+'%',
    'GAIT     '+(feet?.gaitMode??'IDLE')+' · '+(feet?.maneuver??'STANDING'),
    'BALANCE  '+((feet?.recovery??0)*100).toFixed(0)+'% RECOVERY',
    'HEIGHT   '+(state.groundHeightM??0).toFixed(2)+' m · CLIMB '+((state.verticalDemand??0)*100).toFixed(0)+'%',
    'PREP     '+(feet?.preparing?(feet.preparing<0?'LEFT':'RIGHT'):'—')+' · COMP '+((feet?.compression??0)*100).toFixed(1)+' cm',
    'PIVOT    '+(feet?.pivot?'STEPPING':'—')+' · '+(feet?.landings??0)+' landings',
    'DIST     '+travel.toFixed(1)+' m',
    'SCRAP    '+($('props-mode').value==='on'?looseProps.length+' REACTIVE · '+propImpacts+' CONTACTS':'CLEAR'),
    'COURSE   '+challengePrompt(challengeState),
    'TIME     '+challengeState.elapsed.toFixed(2)+'s · BEST '+(challengeBests.has(challengeState.id)?challengeBests.get(challengeState.id).toFixed(2)+'s':'—'),
    'HITCHES  '+hitches+' (>40ms) · '+worstGap.toFixed(0)+' ms',
   ].join('\n');
  }
 }
 requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
window.addEventListener('error',e=>{
 const box=$('lab-error');box.hidden=false;
 box.textContent='PILOTING LAB ERROR\n'+(e.message||e.error?.message||'Unknown');
});
