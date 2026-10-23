import test from 'node:test';
import assert from 'node:assert/strict';
import {locallyBlockedMuzzle,PLAYER_BLOCK_WARNING_METERS} from '../barrelHudClearance.js';
import {assessPhysicalFireLane,chooseClearFiringPoint,firingLaneBlocker} from '../ai/firingLane.js';
import {planCounterFlankResponses} from '../ai/defensiveResponse.js';
test('pilot red X is a near-barrel cue only, even when distant cover blocks the shot',()=>{
 assert.equal(PLAYER_BLOCK_WARNING_METERS,3.6);
 assert.equal(locallyBlockedMuzzle({aimObstructed:true,distance:2.1}),true);
 assert.equal(locallyBlockedMuzzle({aimObstructed:true,distance:3.61}),false);
 assert.equal(locallyBlockedMuzzle({aimObstructed:false,distance:.3}),false);
 assert.equal(locallyBlockedMuzzle({aimObstructed:true,distance:NaN}),false);
});
test('AI preflight rejects physical muzzle contacts with wrecks, allies and cover',()=>{
 assert.equal(assessPhysicalFireLane({actorId:'target',slot:'structure'},'target').clear,true);
 assert.equal(assessPhysicalFireLane({actorId:'wreck',slot:'combat'},'target').clear,false);
 assert.equal(assessPhysicalFireLane({actorId:'ally',slot:'mobility'},'target').clear,false);
 assert.equal(assessPhysicalFireLane({actorId:null,slot:null,blockedBy:'wall'},'target').clear,false);
});
const world={minX:-30,maxX:30,minZ:-30,maxZ:30,obstacles:[
 {id:'wall',minX:-1,maxX:1,minZ:-6,maxZ:-2},
 {id:'wreck',dynamic:true,minX:2.2,maxX:3.7,minZ:-5,maxZ:-3},
]};
test('AI seek an alternate lane rather than repeatedly firing through cover',()=>{
 const from={x:0,z:0},target={x:0,z:-9};
 assert.equal(firingLaneBlocker(from,target,world)?.id,'wall');
 const p=chooseClearFiringPoint(from,target,world,{radius:1.0,targetId:'target'});
 assert.ok(p,'sidestep exists');
 assert.equal(firingLaneBlocker(p,target,world,'target'),null);
});
test('intervening physical wreck blocks but target-owned collision is exempt',()=>{
 const w={...world,obstacles:[{id:'target',minX:-.7,maxX:.7,minZ:-10,maxZ:-9},
   {id:'wreck',minX:-.7,maxX:.7,minZ:-5,maxZ:-3}]};
 assert.equal(firingLaneBlocker({x:0,z:0},{x:0,z:-10},w,'target')?.id,'wreck');
});
const ally=(id,x,z,underFireSeconds=0,threatPosition=null,anchor=false)=>({
 id,active:true,position:{x,z},underFireSeconds,threatPosition,capability:{canMove:true,canFight:true},
});
test('one free squadmate screens a flanked ally, another keeps its engagement',()=>{
 const a=ally('a',0,0,2,{x:0,z:9}),b=ally('b',3,0),c=ally('c',6,0);
 const plan=planCounterFlankResponses({allies:[a,b,c],contacts:[]},{a:{goal:'ENGAGE'},b:{goal:'ENGAGE'},c:{goal:'ENGAGE'}},10);
 assert.equal(Object.keys(plan).length,1);
 assert.equal(plan.b.goal,'SCREEN');
 assert.deepEqual(plan.b.point,{x:0,z:9});
 assert.equal(plan.c,undefined);
});
test('anchors cannot be stripped off scoring point by ordinary screening request',()=>{
 const a=ally('a',0,0,2,{x:0,z:9}),b=ally('b',3,0),c=ally('c',6,0);
 const plan=planCounterFlankResponses({allies:[a,b,c],contacts:[]},{b:{anchor:true},c:{goal:'DEFEND'}},10);
 assert.equal(plan.b,undefined);
 assert.ok(plan.c);
});
test('attack sector is not promoted to exact target or firing permission',()=>{
 const a=ally('a',0,0,2,{x:0,z:9}),b=ally('b',3,0);
 const plan=planCounterFlankResponses({allies:[a,b],contacts:[{id:'hostile',visible:false,position:{x:17,z:9}}]}, {},10);
 assert.equal(plan.b.targetActorId,null);
 assert.deepEqual(plan.b.point,{x:0,z:9});
 const confirmed=planCounterFlankResponses({allies:[a,b],contacts:[{id:'hostile',visible:true,position:{x:1,z:8}}]}, {},10);
 assert.equal(confirmed.b.targetActorId,'hostile');
});
