import test from 'node:test';
import assert from 'node:assert/strict';
import {trafficAdvice,TRAFFIC_POLICIES} from '../ai/trafficCoordination.js';
import {createIntentExecutor,executeIntent} from '../ai/intentExecutor.js';
import {createRigState,stepRig,DEFAULT_RIG_CONFIG} from '../locomotion.js';
import {runOlympicEvent} from '../research/aiOlympics.mjs';
const world={minX:-30,maxX:30,minZ:-30,maxZ:30,obstacles:[]};
const rig=()=>createRigState({x:0,z:12,yaw:0});
const ahead=[{id:'ally-1',position:{x:0,z:8},radius:1,
  speed:2,velocity:{x:0,z:-2}}];
const target={x:0,z:-15};

test('all four research policy identities are known and invalid input is rejected',()=>{
 assert.deepEqual(TRAFFIC_POLICIES,['legacy','zipper','lanes','hybrid']);
 assert.throws(()=>trafficAdvice(rig(),target,ahead,world,1,
  {policy:'magic'}),RangeError);
});
test('zipper yields to physically present moving ally ahead, not behind',()=>{
 const forward=trafficAdvice(rig(),target,ahead,world,1,
  {policy:'zipper',actorId:'ally-2'});
 assert.equal(forward?.kind,'WAIT');
 const back=[{...ahead[0],position:{x:0,z:17}}];
 assert.equal(trafficAdvice(rig(),target,back,world,1,
  {policy:'zipper',actorId:'ally-2'}),null);
});
test('zipper always stops yielding after a bounded interval',()=>{
 const decision=trafficAdvice(rig(),target,ahead,world,1,{
  policy:'zipper',actorId:'ally-2',waitedSeconds:3.1});
 assert.notEqual(decision?.kind,'WAIT');
});
test('stable lanes are deterministic and never propose coordinates inside solid cover',()=>{
 const blocked={...world,obstacles:[{
  id:'central-factory',minX:-2,maxX:2,minZ:3,maxZ:6}]};
 const a=trafficAdvice(rig(),target,ahead,blocked,1,{
  policy:'lanes',actorId:'ally-2'});
 const b=trafficAdvice(rig(),target,ahead,blocked,1,{
  policy:'lanes',actorId:'ally-2'});
 assert.deepEqual(a,b);
 if(a?.point){
  assert.ok(a.point.x<=-3||a.point.x>=3||
    a.point.z<=2||a.point.z>=7);
 }
});
test('queueing does not get mistaken for capture success or reset the mission route',()=>{
 const st=createIntentExecutor(),body=rig();
 const intent={goal:'CAPTURE',point:target,score:.9};
 const command=executeIntent(st,intent,body,world,1,1/60,ahead,{
  trafficPolicy:'zipper',actorId:'ally-2'});
 assert.equal(command.mode,'ANCHOR');
 assert.equal(command.goal,'TRAFFIC_WAIT');
 assert.equal(command.trafficQueued,true);
 assert.ok(st.route);
 assert.ok(st.trafficQueueSeconds>0);
 const before={x:body.x,z:body.z};
 stepRig(body,{throttle:0,strafe:0,steer:0,brake:1},1/60,
  DEFAULT_RIG_CONFIG,world);
 assert.ok(Math.hypot(body.x-before.x,body.z-before.z)<.01);
});
test('legacy traffic policy remains a deterministic default',()=>{
 const a=runOlympicEvent('ally-choke',{seed:1958,family:'yard',seconds:5});
 const b=runOlympicEvent('ally-choke',{seed:1958,family:'yard',
  trafficPolicy:'legacy',seconds:5});
 assert.deepEqual(a,b);
});
test('traffic experiments use identical starting seeds and physical families',()=>{
 for(const policy of TRAFFIC_POLICIES){
  const r=runOlympicEvent('ally-choke',{seed:7654,family:'hauler',
   trafficPolicy:policy,seconds:5});
  assert.equal(r.trafficPolicy,policy);
  assert.deepEqual(r.actors.map(a=>a.family),['hauler','hauler','hauler']);
  assert.ok(r.score>=0&&r.score<=100);
  assert.ok(Number.isFinite(r.motion.trafficQueueSeconds));
  assert.ok(Number.isFinite(r.motion.loopSeconds));
 }
});
