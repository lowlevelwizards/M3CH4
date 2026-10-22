import test from 'node:test';
import assert from 'node:assert/strict';
import {coordinateSquadArrivals,ARRIVAL_POLICIES} from '../ai/squadPositioning.js';
import {planTeam} from '../ai/teamPlanner.js';
import {runOlympicEvent} from '../research/aiOlympics.mjs';
import {createIntentExecutor,executeIntent} from '../ai/intentExecutor.js';
import {createPilotBrain,decidePilot} from '../ai/pilotBrain.js';
import {runBout} from '../research/headlessDominationStudy.mjs';
const p=(x,z)=>({x,z});
const world={minX:-30,maxX:30,minZ:-30,maxZ:30,obstacles:[]};
const r=4.7;
const actors=[
 {id:'m1',active:true,position:p(-4,15),capability:{canMove:true,speed:1,weapon:1,endurance:1,canFight:true}},
 {id:'m2',active:true,position:p(0,16),capability:{canMove:true,speed:1,weapon:1,endurance:1,canFight:true}},
 {id:'m3',active:true,position:p(4,15),capability:{canMove:true,speed:1,weapon:1,endurance:1,canFight:true}}
];
const zones=[{id:'A',point:p(0,0)}];
const orders=()=>Object.fromEntries(actors.map(a=>[a.id,{
 goal:'CAPTURE',objectiveId:'A',point:p(0,0),radius:r,score:.85
}]));
const pairwise=values=>values.flatMap((a,i)=>values.slice(i+1).map(b=>
 Math.hypot(a.x-b.x,a.z-b.z)));

test('legacy policy returns unmodified orders and rejects unknown arrival profiles',()=>{
 const initial=orders();
 assert.equal(coordinateSquadArrivals(initial,actors,zones),initial);
 assert.deepEqual(ARRIVAL_POLICIES,['legacy','slots','lanes','coordinated']);
 assert.throws(()=>coordinateSquadArrivals(initial,actors,zones,{policy:'omniscient'}),RangeError);
});
test('coordinated assigns distinct physical slots but keeps true scoring centres',()=>{
 const o=coordinateSquadArrivals(orders(),actors,zones,{
  policy:'coordinated',world,zoneRadius:r,collisionRadius:1.14});
 const slots=Object.values(o).map(x=>x.arrivalPoint);
 assert.ok(slots.every(x=>x&&Math.hypot(x.x,x.z)<r-1.14-.2));
 assert.ok(pairwise(slots).every(d=>d>2.1),'distinct inside-zone destinations');
 for(const order of Object.values(o)){
  assert.deepEqual(order.point,p(0,0),'public objective remains authoritative');
  if(order.viaPoint){
   assert.ok(Number.isFinite(order.viaPoint.x));
   assert.ok(Number.isFinite(order.viaPoint.z));
  }
 }
});
test('slot and lane hypotheses differ as advertised',()=>{
 const slot=coordinateSquadArrivals(orders(),actors,zones,{policy:'slots',world});
 const lanes=coordinateSquadArrivals(orders(),actors,zones,{policy:'lanes',world});
 assert.ok(Object.values(slot).every(o=>o.arrivalPoint&&!o.viaPoint));
 assert.ok(Object.values(lanes).every(o=>!o.arrivalPoint));
});
test('world bounds and solid static obstacles invalidate reserved positions',()=>{
 const confined={minX:-6,maxX:6,minZ:-10,maxZ:10,obstacles:[
 {id:'block',minX:-1,maxX:1,minZ:1.0,maxZ:4.2}]};
 const out=coordinateSquadArrivals(orders(),actors,zones,{
  policy:'slots',world:confined,collisionRadius:1.2});
 for(const o of Object.values(out)){
  if(!o.arrivalPoint)continue;
  const q=o.arrivalPoint;
  assert.ok(q.x>-4.46&&q.x<4.46&&q.z>-8.46&&q.z<8.46);
  assert.ok(!(q.x> -2.54 && q.x<2.54 && q.z>-.54&&q.z<5.74));
 }
});
test('selection is independent of roster ordering and stable under tiny repositioning',()=>{
 const seed=coordinateSquadArrivals(orders(),actors,zones,{
  policy:'slots',world});
 const shuffled=coordinateSquadArrivals(orders(),actors.slice().reverse(),zones,{
  policy:'slots',world});
 assert.deepEqual(seed,shuffled);
 const shifted=actors.map(a=>({...a,position:p(a.position.x+.03,a.position.z+.02)}));
 const repeated=coordinateSquadArrivals(orders(),shifted,zones,{
  policy:'slots',world,previousOrders:seed});
 for(const actor of actors){
  const old=seed[actor.id].arrivalPoint;
  const next=repeated[actor.id].arrivalPoint;
  assert.ok(Math.hypot(old.x-next.x,old.z-next.z)<.1,
    'reservation must not oscillate each strategy update');
 }
});
test('player and paying anchor are never ordered or displaced',()=>{
 const initial=orders();initial.m1.goal='DEFEND';initial.m1.anchor=true;
 const player={id:'player',active:true,position:p(2.6,0)};
 const o=coordinateSquadArrivals(initial,actors,zones,{
  policy:'slots',world,player});
 assert.deepEqual(o.m1,initial.m1);
 assert.equal(o.player,undefined);
 for(const k of ['m2','m3']){
  if(o[k].arrivalPoint)
   assert.ok(Math.hypot(o[k].arrivalPoint.x-player.position.x,
    o[k].arrivalPoint.z-player.position.z)>2);
 }
});
test('pilot carries reserved DEFEND point; executor routes reserved CAPTURE inside REAL zone',()=>{
 const defended=coordinateSquadArrivals(Object.fromEntries(actors.map(a=>[
  a.id,{goal:'DEFEND',objectiveId:'A',point:p(0,0),radius:r,score:.9}
 ])),actors,zones,{policy:'slots',world});
 const first=defended.m1;
 const selected=decidePilot(createPilotBrain(),{id:'m1',position:actors[0].position},
  first,{capability:actors[0].capability,world,nearbyAllies:[]},0);
 assert.deepEqual(selected.point,first.reservationPoint);
 const captured=coordinateSquadArrivals(orders(),actors,zones,{
  policy:'slots',world}).m1;
 const rig={x:-4,z:15,yaw:0,vx:0,vz:0,yawRate:0};
 const movement=executeIntent(createIntentExecutor(),captured,rig,world,1.14,1/60);
 assert.equal(movement.mode,'ORDER');
 assert.ok(Math.hypot(movement.point.x-captured.arrivalPoint.x,
  movement.point.z-captured.arrivalPoint.z)<.1);
 assert.deepEqual(captured.point,p(0,0));
});
test('full team planner accepts optional coordination but default remains unchanged',()=>{
 const snap={kind:'domination',time:0,zoneRadius:r,
  zones:[{id:'A',point:p(0,0),owner:null,contested:false,friendly:0,hostile:0}],
  score:{friendly:0,hostile:0},
  knowledge:{friendly:{allies:actors,contacts:[]}}};
 const baseline=planTeam(snap,'friendly');
 const legacy=planTeam(snap,'friendly',{arrivalPolicy:'legacy',world});
 assert.deepEqual(baseline,legacy);
 const coordinated=planTeam(snap,'friendly',{arrivalPolicy:'coordinated',world});
 const targets=Object.values(coordinated.orders);
 assert.ok(targets.length===3);
 assert.ok(targets.some(o=>!!o.arrivalPoint));
});
test('headless Olympics event is deterministic under each policy with physical positions',()=>{
 for(const policy of ARRIVAL_POLICIES){
  const opt={seed:4188,family:'yard',seconds:5,arrivalPolicy:policy};
  const a=runOlympicEvent('squad-arrival',opt),b=runOlympicEvent('squad-arrival',opt);
  assert.deepEqual(a,b,policy+' nondeterministic');
  assert.equal(a.arrivalPolicy,policy);
  assert.ok(a.actors.every(x=>Number.isFinite(x.z)&&Number.isFinite(x.x)));
 }
});
test('full three-v-three defaults retain identical outcomes with or without explicit legacy flag',()=>{
 const settings={name:'arrival-smoke',maxSeconds:2,policy:'strict',accuracy:.0};
 const a=runBout(4129,settings);
 const b=runBout(4129,{...settings,arrivalFriendly:'legacy',arrivalHostile:'legacy'});
 assert.deepEqual(a,b);
 const result=runBout(4129,{...settings,arrivalFriendly:'coordinated',
  arrivalHostile:'slots'});
 assert.equal(result.arrivals.friendly,'coordinated');
 assert.equal(result.arrivals.hostile,'slots');
});
