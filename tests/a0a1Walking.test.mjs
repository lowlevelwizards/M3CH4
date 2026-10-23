import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {makeTestAssembly,equip} from '../components.js';
import {deriveRigConfig} from '../assemblyPhysics.js';
import {createRigState,stepRig} from '../locomotion.js';
import {walkingLongitudinalIntent} from '../walkingController.js';
const DT=1/60;
const WORLD={minX:-500,maxX:500,minZ:-500,maxZ:500,obstacles:[]};
const idle={throttle:0,strafe:0,steer:0,brake:0};
const src=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const families=['legs-yard','legs-compact','legs-hauler'];
function make(id){
 const assembly=makeTestAssembly();equip(assembly,'mobility',id);
 return deriveRigConfig(assembly);
}
function coast(config,assisted,seconds=1.5){
 const state=createRigState({x:0,z:0,yaw:0});
 state.vz=-3;
 const k={...config,walkingAssistEnabled:assisted};
 for(let i=0;i<Math.round(seconds/DT);i++)stepRig(state,idle,DT,k,WORLD);
 return {distance:22-state.z,speed:Math.hypot(state.vx,state.vz),state};
}
test('all families settle from neutral much sooner than the legacy coasting model',()=>{
 for(const id of families){
  const config=make(id);
  const old=coast(config,false),modern=coast(config,true);
  assert.ok(modern.speed<old.speed*.32, id+' active neutral capture');
  assert.ok(modern.speed<.18, id+' settles instead of sliding');
  assert.ok(modern.state.walkSettleForceN<=0,id+' opposes forward velocity');
  assert.ok(modern.distance<old.distance,id+' shorter stopping path');
  assert.equal(old.state.walkMode,'LEGACY');
 }
});
test('neutral assistance never supplies energy to unpowered or destroyed mobility',()=>{
 const config=make('legs-yard');
 for(const missing of ['driveForceN','reverseForceN','brakeForceN']){
  const bad={...config,[missing]:0};
  const result=walkingLongitudinalIntent({forwardVelocity:4},idle,bad,DT);
  assert.equal(result.forceN,0,missing+' missing authority');
 }
 assert.equal(walkingLongitudinalIntent({forwardVelocity:4},{throttle:1,brake:0},config,DT).forceN,0);
 assert.equal(walkingLongitudinalIntent({forwardVelocity:4},{throttle:0,brake:1},config,DT).forceN,0);
});
test('assisted locomotion remains force-limited, finite and cannot reverse while settling',()=>{
 for(const id of families){
  const config=make(id),state=createRigState({x:0,z:0,yaw:0});
  state.vz=-2.6;
  for(let i=0;i<300;i++){
   const previous=state.vz;
   stepRig(state,idle,DT,config,WORLD);
   assert.ok(Number.isFinite(state.vz)&&Number.isFinite(state.z),id);
   assert.ok(state.vz<=.000001,id+' no reversal of velocity');
   assert.ok(state.tractionUse>=0&&state.tractionUse<=1,id);
   assert.ok(state.walkSettleForceN<=0 || Math.abs(previous)<.03,id);
  }
  assert.ok(Math.hypot(state.vx,state.vz)<.01,id+' fully settled');
 }
});
test('unchanged positive input retains meaningful powered acceleration',()=>{
 for(const id of families){
  const config=make(id),s=createRigState();
  for(let i=0;i<60;i++)stepRig(s,{...idle,throttle:1},DT,config,WORLD);
  assert.ok(s.forwardSpeed>.4,id);
  assert.equal(s.walkMode,'WALK');
 }
});
test('real isolated lab is a dedicated page with no persistence, combat or economy hooks',()=>{
 const html=src('piloting-lab.html'),js=src('pilotingLab.js');
 assert.match(html,/id="handling"/);
 assert.match(html,/id="family"/);
 assert.match(html,/id="drive-zone"/);
 assert.match(html,/id="view"/);
 assert.match(js,/createArenaScene\(machine,makeRangeTarget\(\)\)/);
 assert.ok(js.includes("walkingAssistEnabled:$('handling').value==='assisted'"));
 assert.match(js,/arena\.updatePilotingLabRig\(state,gait,frameDt\)/);
 assert.match(src('scene.js'),/function setPilotingLab\(enabled,showExterior=true\)/);
 assert.doesNotMatch(js,/localStorage|storeMachine|persistMachine|settleSortie|startSeries/);
 assert.match(src('index.html'),/href="\.\/piloting-lab\.html\?v=k5a7"/);
});
