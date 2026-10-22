import test from 'node:test';
import assert from 'node:assert/strict';
import {coordinateCorridors,CORRIDOR_POLICIES} from '../ai/corridorCoordinator.js';
import {createIntentExecutor,executeIntent} from '../ai/intentExecutor.js';
import {runOlympicEvent} from '../research/aiOlympics.mjs';
import {runBout} from '../research/headlessDominationStudy.mjs';
const p=(x,z)=>({x,z});
const wall=(id,minX,maxX,minZ,maxZ)=>({id,minX,maxX,minZ,maxZ});
const world={minX:-29,maxX:29,minZ:-27,maxZ:27,
 obstacles:[wall('west',-12,-3,-7,7),wall('east',3,12,-7,7)]};
const empty={...world,obstacles:[]};
const actors=[
 {id:'a',active:true,position:p(-1.8,19),capability:{canMove:true,speed:1}},
 {id:'b',active:true,position:p(0,22),capability:{canMove:true,speed:1}},
 {id:'c',active:true,position:p(1.8,19),capability:{canMove:true,speed:1}}
];
const independent=()=>Object.fromEntries(actors.map((a,i)=>[a.id,{
 goal:'CAPTURE',point:[p(-9,-17),p(0,-20),p(9,-17)][i],
 objectiveId:'separate-'+i,radius:4.7,score:.9
}]));

test('corridor policy registry and open terrain preserve existing plans',()=>{
 assert.deepEqual(CORRIDOR_POLICIES,['legacy','priority','stagger','clearance']);
 assert.throws(()=>coordinateCorridors(independent(),actors,world,{policy:'magic'}),RangeError);
 const base=independent();
 const unchanged=coordinateCorridors(base,actors,world);
 assert.strictEqual(unchanged.orders,base);
 const open=coordinateCorridors(independent(),actors,empty,{policy:'stagger'});
 assert.equal(open.metrics.queued,0);
});

test('different destination routes through the same physical gate are coordinated',()=>{
 const memory={},original=independent();
 const result=coordinateCorridors(original,actors,world,{
  policy:'stagger',time:0,memory,collisionRadius:1.14});
 assert.ok(result.metrics.groups>=1,'expected real shared route overlap');
 assert.ok(result.metrics.queued>=1,'teammates should reserve upstream waits');
 for(const [id,o]of Object.entries(result.orders)){
  assert.deepEqual(o.point,original[id].point,'public goal must never change');
  if(!o.corridorReservation)continue;
  const r=o.corridorReservation;
  assert.ok(r.releaseAt>0&&r.expiresAt>r.releaseAt);
  assert.ok(r.stagePoint.z>7,'holding position is upstream of gate');
 }
 assert.ok(Object.keys(memory).length>=1);
});
test('no corridor reservation for the same objective or disabled machines',()=>{
 const same=independent();
 for(const a of Object.values(same)){a.objectiveId='single';a.point=p(0,-20);}
 const r=coordinateCorridors(same,actors,world,{policy:'stagger'});
 assert.equal(r.metrics.queued,0);
 const broken=actors.map(a=>({...a,capability:{canMove:false}}));
 const stopped=coordinateCorridors(independent(),broken,world,{policy:'priority'});
 assert.equal(stopped.metrics.queued,0);
});
test('reservation release windows survive replanning instead of extending forever',()=>{
 const memory={};
 const first=coordinateCorridors(independent(),actors,world,{
  policy:'stagger',time:0,memory});
 const second=coordinateCorridors(independent(),actors,world,{
  policy:'stagger',time:1,memory});
 const id=Object.keys(first.orders).find(x=>first.orders[x].corridorReservation);
 assert.ok(id);
 assert.equal(first.orders[id].corridorReservation.releaseAt,
  second.orders[id].corridorReservation.releaseAt);
 const past=coordinateCorridors(independent(),actors,world,{
  policy:'stagger',time:35,memory});
 assert.ok(Object.values(past.orders).every(x=>!x.corridorReservation),
  'expired staging window must not re-queue travelling pilots');
});
test('physically stop at upstream stage then proceed when absolute release expires',()=>{
 const group=coordinateCorridors(independent(),actors,world,{policy:'priority',time:0});
 const queued=Object.entries(group.orders).find(([,o])=>o.corridorReservation);
 assert.ok(queued);
 const [id,order]=queued;
 const stage=order.corridorReservation.stagePoint;
 const rig={...stage,yaw:0,vx:0,vz:0,yawRate:0};
 const state=createIntentExecutor();
 const waiting=executeIntent(state,order,rig,world,1.14,1/60,[],
  {now:0,actorId:id});
 assert.equal(waiting.goal,'CORRIDOR_WAIT');
 assert.equal(waiting.corridorQueued,true);
 assert.equal(waiting.mode,'ANCHOR');
 const released=executeIntent(state,order,rig,world,1.14,1/60,[],{
  now:order.corridorReservation.releaseAt+.01,actorId:id});
 assert.equal(released.mode,'ORDER');
 assert.notEqual(released.goal,'CORRIDOR_WAIT');
});
test('corridor physical drill is deterministic on each policy and preserves distinct destinations',()=>{
 for(const policy of CORRIDOR_POLICIES){
  const opts={seed:11783,family:'yard',seconds:3,corridorPolicy:policy};
  const a=runOlympicEvent('corridor-crossing',opts);
  const b=runOlympicEvent('corridor-crossing',opts);
  assert.deepEqual(a,b);
  assert.ok(Number.isFinite(a.score)&&a.actors.length===3);
  assert.ok(a.corridorReservations>=0);
 }
});
test('full 3v3 baseline remains identical and independent corridor options are recorded',()=>{
 const settings={name:'k4x-test',maxSeconds:2,policy:'strict',accuracy:0};
 const normal=runBout(6032,settings);
 const explicit=runBout(6032,{...settings,corridorFriendly:'legacy',
  corridorHostile:'legacy'});
 assert.deepEqual(normal,explicit);
 const variant=runBout(6032,{...settings,corridorFriendly:'stagger',
  corridorHostile:'priority'});
 assert.equal(variant.corridorPolicy.friendly,'stagger');
 assert.equal(variant.corridorPolicy.hostile,'priority');
});

test('reservation persists after leader route no longer overlaps the choke',()=>{
 const memory={};
 const first=coordinateCorridors(independent(),actors,world,{
  policy:'stagger',time:0,memory});
 const chosen=Object.entries(first.orders).find(([,o])=>o.corridorReservation);
 assert.ok(chosen);
 const [id,order]=chosen;
 const moved=actors.map(a=>a.id===id?
  {...a,position:{...order.corridorReservation.stagePoint}}:
  {...a,position:p(-9,-17)});
 const later=coordinateCorridors(independent(),moved,world,{
  policy:'stagger',time:1.2,memory});
 assert.deepEqual(later.orders[id].corridorReservation.stagePoint,
  order.corridorReservation.stagePoint);
 assert.equal(later.orders[id].corridorReservation.releaseAt,
  order.corridorReservation.releaseAt);
});

test('clearance-aware follower can release early when preceding rig physically passes gate',()=>{
 const memory={};
 const scheduled=coordinateCorridors(independent(),actors,world,{
  policy:'clearance',time:0,memory,collisionRadius:1.14});
 const pending=Object.entries(scheduled.orders)
  .find(([,o])=>o.corridorReservation);
 assert.ok(pending,'expected a waiting vehicle');
 const [id,order]=pending;
 const predecessor=order.corridorReservation.leaderId;
 const cleared=actors.map(a=>a.id===predecessor?
  {...a,position:{...order.corridorReservation.leaderGoal}}:a);
 const state=coordinateCorridors(independent(),cleared,world,{
  policy:'clearance',time:1,memory,collisionRadius:1.14});
 assert.equal(state.orders[id].corridorReservation,undefined,
  'cleared passage must not keep its waiting reservation');
});
