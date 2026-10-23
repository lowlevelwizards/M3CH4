import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {makeTestAssembly,equip} from '../components.js';
import {deriveRigConfig} from '../assemblyPhysics.js';
import {createRigState,stepRig} from '../locomotion.js';
import {createFootContacts,advanceFootContacts} from '../footContactController.js';
import {createMotionSoundState,advanceContactMotionSound,soundFamilyFor} from '../liveSystemsEvents.js';
const DT=1/60,world={minX:-100,maxX:100,minZ:-100,maxZ:100,obstacles:[]};
const idle={throttle:0,strafe:0,steer:0,brake:0};
const file=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const families=['legs-yard','legs-compact','legs-hauler'];
test('a planted landing creates exactly one real family footstep, not a timer duplicate',()=>{
 for(const id of families){
  const family=soundFamilyFor(id),audio=createMotionSoundState();
  const rig=createRigState({x:0,z:0,yaw:0});
  let feet=createFootContacts(rig,id),expected=0,observed=0,hydraulic=0;
  for(let step=0;step<320;step++){
   rig.x+=.018;rig.vx=1.08;
   feet=advanceFootContacts(feet,rig,id,DT);
   const events=advanceContactMotionSound(audio,family,1.08,DT,feet);
   expected+=feet.landings;
   observed+=events.filter(e=>e===family.id).length;
   hydraulic+=events.filter(e=>e==='hydraulics').length;
   assert.ok(events.filter(e=>e===family.id).length<=1,id+' single contact');
  }
  assert.ok(expected>2,id+' had real contacts');
  assert.equal(observed,expected,id+' audible footfalls exactly equal physical landings');
  assert.equal(hydraulic,Math.floor(expected/3),id+' hydraulic timing follows contacts');
 }
});
test('standing still emits idle engine but zero fictitious footfalls',()=>{
 const id='legs-hauler',audio=createMotionSoundState(),rig=createRigState();
 let feet=createFootContacts(rig,id),steps=0,engines=0;
 for(let i=0;i<180;i++){
  feet=advanceFootContacts(feet,rig,id,DT);
  const sounds=advanceContactMotionSound(audio,soundFamilyFor(id),0,DT,feet);
  steps+=sounds.filter(e=>e==='hauler').length;
  engines+=sounds.filter(e=>e==='engine').length;
 }
 assert.equal(steps,0);
 assert.ok(engines>=1);
});
test('pivot-only contacts make audible steps, even at zero linear speed',()=>{
 for(const id of families){
  const audio=createMotionSoundState(),rig=createRigState({x:0,z:0,yaw:0});
  let feet=createFootContacts(rig,id),landings=0,heard=0;
  for(let i=0;i<220;i++){
   rig.yaw+=.016;rig.yawRate=.96;
   feet=advanceFootContacts(feet,rig,id,DT);
   const events=advanceContactMotionSound(audio,soundFamilyFor(id),0,DT,feet);
   landings+=feet.landings;
   heard+=events.filter(e=>e===soundFamilyFor(id).id).length;
  }
  assert.ok(landings>0,id+' pivots replant');
  assert.equal(landings,heard,id+' physical pivot footfall');
 }
});
test('damage and absent motor authority still use existing integrated physics',()=>{
 const a=makeTestAssembly();equip(a,'mobility','legs-yard');
 const config=deriveRigConfig(a),rig=createRigState();
 const acoustic=createMotionSoundState();
 for(let i=0;i<120;i++){
  stepRig(rig,{...idle,throttle:.8},DT,config,world);
  acoustic.contactFeet=advanceFootContacts(acoustic.contactFeet,rig,'legs-yard',DT);
  advanceContactMotionSound(acoustic,soundFamilyFor('legs-yard'),Math.hypot(rig.vx,rig.vz),DT,acoustic.contactFeet);
 }
 assert.ok(rig.forwardSpeed>.2);
 assert.ok(acoustic.contactFeet);
});
test('scene, gameplay and lab share contact state without allocating independent timed footfall tracks',()=>{
 const scene=file('scene.js'),main=file('main.js'),lab=file('pilotingLab.js');
 assert.match(scene,/visual\?\.gait\?\.contactFeet\?\?advanceFootContacts/);
 assert.match(scene,/serviceVisual\?\.gait\?\.contactFeet\?\?advanceFootContacts/);
 assert.match(main,/acoustic\.contactFeet=advanceFootContacts/);
 assert.match(main,/advanceContactMotionSound\(acoustic/);
 assert.match(lab,/advanceContactMotionSound\(gait/);
 assert.match(file('index.html'),/liveSystemsEvents\.js\?v=k5a5/);
});
