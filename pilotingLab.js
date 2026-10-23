/** A.0 — isolated, no-save proving ground using production rig models,
 * locomotion, animation, joystick, terrain collision and audio event logic.
 * No combat initialization, economy, campaign state or browser save writes.
 */
import * as THREE from 'three';
import {makeTestAssembly,equip} from './components.js';
import {makeRangeTarget} from './combat.js';
import {deriveRigConfig} from './assemblyPhysics.js';
import {createRigState,stepRig,DEFAULT_WORLD} from './locomotion.js';
import {Controls,bodyFollowSteer} from './controls.js';
import {createArenaScene} from './sceneAssembly.js?v=a2';
import {soundFamilyFor,createMotionSoundState,advanceMotionSound} from './liveSystemsEvents.js';
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
const DT=1/60;
const controls=new Controls($('drive-zone'),$('drive-knob'),$('look-zone'),$('brake'));
const turn={left:false,right:false};
function heldButton(id,key){
 const button=$(id);
 const end=()=>{turn[key]=false;button.classList.remove('active');};
 button.addEventListener('pointerdown',e=>{e.preventDefault();turn[key]=true;button.classList.add('active');button.setPointerCapture(e.pointerId);});
 for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,end);
 window.addEventListener('blur',end);
}
heldButton('turn-left','left');heldButton('turn-right','right');
const markers=new THREE.Group();arena.scene.add(markers);
const markerMat=new THREE.MeshStandardMaterial({color:0xb68b37,metalness:.18,roughness:.89});
const metalMat=new THREE.MeshStandardMaterial({color:0x3b7770,metalness:.27,roughness:.8});
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
 travel=0;worstGap=0;hitches=0;frameCount=0;
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
$('handling').addEventListener('change',reset);
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
    stepRig(state,{throttle:input.throttle,strafe:input.strafe,steer,brake:input.brake},DT,
      {...config,walkingAssistEnabled:$('handling').value==='assisted'},world);
    travel+=Math.hypot(state.x-beforeX,state.z-beforeZ);
    const events=advanceMotionSound(gait,soundFamilyFor($('family').value),Math.hypot(state.vx,state.vz),DT);
    if(soundOn)for(const id of events)soundSystemEvent(id,{cockpit:$('view').value==='cockpit',strength:id==='engine'?.2:.65});
    if(Math.abs(follow)>.001)controls.compensateBodyTurn(state.yaw-yawBefore);
    accumulator-=DT;iterations++;
  }
  if(iterations===6)accumulator=0;
  const input=controls.sample();
  arena.updateRigVisual(state,input.lookYaw,input.lookPitch,frameDt,{gait});
  arena.updatePilotingLabRig(state,gait,frameDt);
  arena.updateCombatEffects(frameDt);
  renderer.render(arena.scene,arena.camera);
  window.__m3ch4PilotingLabReady=true;
  frameCount++;
  if(frameCount%10===0){
   $('fps').textContent=Math.round(fps)+' FPS';
   const feet=arena.pilotingLabFootReadout();
   $('telemetry').textContent=[
    'MACHINE  '+$('family').selectedOptions[0].textContent,
    'MODE     '+($('handling').value==='assisted'?'ASSISTED WALK':'LEGACY'),
    'WALK     '+(state.walkMode||'—'),
    'SPEED    '+Math.hypot(state.vx,state.vz).toFixed(2)+' m/s',
    'FWD/LAT  '+state.forwardSpeed.toFixed(2)+' / '+state.lateralSpeed.toFixed(2),
    'YAW      '+(state.yaw*180/Math.PI).toFixed(1)+'°',
    'STOP F   '+Math.abs(state.walkSettleForceN||0).toFixed(0)+' N',
    'GRIP     '+(state.tractionUse*100).toFixed(0)+'%',
    'SLIP     '+state.footSlipMps.toFixed(2)+' m/s',
    'DRIVE    '+(state.driveLoad*100).toFixed(0)+'%',
    'CONTACT  '+(feet?.feet.map(f=>(f.side<0?'L':'R')+':'+(f.mode==='stance'?'PLANT':'STEP')).join(' / ')??'—'),
    'PIVOT    '+(feet?.pivot?'STEPPING':'—')+' · '+(feet?.landings??0)+' landings',
    'DIST     '+travel.toFixed(1)+' m',
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
