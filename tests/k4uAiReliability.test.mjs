import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createEnemyMotion,advanceEnemyMotion} from '../enemyMotion.js';
import {createTacticalAwareness,advanceTacticalAwareness,noteIncomingFire} from '../tacticalAwareness.js';
import {createIntentExecutor,executeIntent} from '../ai/intentExecutor.js';
import {planApproachRoute} from '../ai/navigation.js';
import {trafficWaypoint,prioritizeVisibleTarget} from '../ai/adaptiveTactics.js';
import {planTeam} from '../ai/teamPlanner.js';
import {createRigState,stepRig,DEFAULT_RIG_CONFIG} from '../locomotion.js';

const world={minX:-40,maxX:40,minZ:-40,maxZ:40,obstacles:[]};
const pos=(x,z)=>({x,z});
const fakeRig=(x=0,z=0,yaw=0)=>({x,z,yaw,yawRate:0,vx:0,vz:0,
 forwardSpeed:0,lateralSpeed:0});

test('no observed opponent is not fictitiously visible at the pilot location',()=>{
 const a=createTacticalAwareness();
 const result=advanceTacticalAwareness(a,fakeRig(),null,1/60,world,1,
   {id:'pressure',preferredRangeM:6});
 assert.equal(result.mode,'NO_CONTACT');
 assert.equal(result.lineOfSight,false);
 assert.equal(a.lastSeenTarget,null);
});

test('last observed position expires instead of driving eternal tunnel vision',()=>{
 const a=createTacticalAwareness(),me=fakeRig(),target=pos(0,-9);
 advanceTacticalAwareness(a,me,target,.1,world,1,{id:'pressure',preferredRangeM:6});
 assert.deepEqual(a.lastSeenTarget,target);
 let result;
 for(let i=0;i<60;i++)result=advanceTacticalAwareness(a,me,null,.1,world,1,
   {id:'pressure',preferredRangeM:6});
 assert.equal(result.mode,'NO_CONTACT');
 assert.equal(a.lastSeenTarget,null);
});

test('no-contact motion steers toward the actual route waypoint behind the machine',()=>{
 const machine=fakeRig(0,0,0),motion=createEnemyMotion();
 const input=advanceEnemyMotion(motion,machine,null,1/60,true,world,.95,null,
   {mode:'ORDER',point:pos(0,20),role:'TACTICAL'});
 assert.ok(Math.abs(input.steer)>.2,'must turn toward the actual waypoint');
 assert.equal(motion.awareness.lineOfSight,false);
 assert.equal(motion.phase,'ORDER');
});

test('stationary defender scans a rear sector without wandering off the objective',()=>{
 const machine=createRigState({x:0,z:0,yaw:0}),motion=createEnemyMotion();
 for(let i=0;i<180;i++){
   const input=advanceEnemyMotion(motion,machine,null,1/60,true,world,.95,null,
     {mode:'ANCHOR',point:pos(0,0),brakeBias:.94});
   stepRig(machine,input,1/60,DEFAULT_RIG_CONFIG,world);
 }
 assert.ok(Math.abs(machine.yaw)>.035,'anchored rig should visibly scan');
 assert.ok(Math.hypot(machine.x,machine.z)<.5,'scan stays on objective');
});

test('real progress at 2 m/s never trips stuck-route replan',()=>{
 const state=createIntentExecutor(),rig=fakeRig(0,0,0),destination=pos(0,-25);
 for(let i=0;i<180;i++){
   const action=executeIntent(state,{goal:'SEARCH',point:destination},rig,world,.95,1/60);
   assert.equal(action.mode,'ORDER');
   rig.z-=2/60;
 }
 assert.equal(state.replanAttempts,0);
 assert.equal(state.failures,0);
});

test('a genuinely immobile machine still requests path recovery',()=>{
 const state=createIntentExecutor(),rig=fakeRig(0,0,0);
 for(let i=0;i<180;i++)
   executeIntent(state,{goal:'SEARCH',point:pos(0,-25)},rig,world,.95,1/60);
 assert.ok(state.replanAttempts>0);
});

test('three opening pilots take three distinct searching lanes',()=>{
 const actors=['one','two','three'].map(id=>({id,team:'hostile',active:true,
   position:pos(0,-22),capability:{canMove:true,canFight:true,speed:1,weapon:1,endurance:1}}));
 const s={kind:'elimination',time:0,zones:[],missions:{hostile:pos(0,8)},
  knowledge:{hostile:{allies:actors,contacts:[]}}};
 const result=planTeam(s,'hostile');
 assert.deepEqual(Object.values(result.orders).map(o=>o.point.x),[-10,0,10]);
});

test('traffic yields around nearest ally rather than roster-order first',()=>{
 const me=pos(0,0),destination=pos(0,-20);
 const adjusted=trafficWaypoint(me,destination,[
   {id:'distant',position:pos(0,-5),radius:1},
   {id:'nearest',position:pos(0,-2),radius:1}
 ],world,1);
 assert.notDeepEqual(adjusted,destination);
 assert.ok(Math.abs(adjusted.x)>2);
});

test('objective approach picks unoccupied space inside the actual scoring radius',()=>{
 const result=planApproachRoute(world,pos(0,10),pos(0,0),4.7,1,0,null,
   [{position:pos(0,0),radius:1}]);
 assert.equal(result.ok,true);
 const radius=Math.hypot(result.approach.x,result.approach.z);
 assert.ok(radius>.2);
 assert.ok(radius<4.7);
});

test('incoming fire can cause defensive response without revealing shooter location',()=>{
 const motion=createEnemyMotion();
 noteIncomingFire(motion,pos(20,1),'shooter',1.3,fakeRig());
 const result=advanceTacticalAwareness(motion,fakeRig(),null,.1,world,1,motion.behavior);
 assert.notEqual(result.mode,'ENGAGE');
 assert.equal(motion.awareness.lineOfSight,false);
 assert.notDeepEqual(motion.awareness.lastThreat,pos(20,1));
});

test('currently visible forward contact can outrank an equally distant rear contact',()=>{
 const pilot={rig:fakeRig(0,0,0),team:'friendly',id:'pilot'};
 const a={id:'rear',rig:fakeRig(0,8)},b={id:'front',rig:fakeRig(0,-8)};
 const pick=prioritizeVisibleTarget(pilot,[a,b],{kind:'elimination',zones:[]});
 assert.equal(pick.id,'front');
});

test('production integration passes null no-contact and coarse suppressed-fire position',()=>{
 const main=fs.readFileSync(new URL('../main.js',import.meta.url),'utf8');
 const service=fs.readFileSync(new URL('../aiFieldService.js',import.meta.url),'utf8');
 assert.match(main,/target\?\.rig \?\? null, FIXED_DT/);
 assert.match(main,/\.48, target\.rig\)/);
 assert.match(service,/const covered = !!target && awareness\.lineOfSight === false/);
});

test('incoming rear fire interrupts pursuit of a stale last-known contact',()=>{
 const a=createTacticalAwareness(),me=fakeRig();
 advanceTacticalAwareness(a,me,pos(0,-10),.1,world,1,{id:'pressure',preferredRangeM:6});
 noteIncomingFire(a,pos(0,18),'rear-shooter',1.5,me);
 const decision=advanceTacticalAwareness(a,me,null,.1,world,1,
   {id:'pressure',preferredRangeM:6});
 assert.equal(decision.mode,'UNDER_FIRE');
 assert.ok(decision.point.z>0,'threat bearing should face behind');
});
