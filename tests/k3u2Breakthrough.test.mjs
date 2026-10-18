import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createStrategicState,evaluateStrategy } from '../ai/strategicState.js';
import { planTeam } from '../ai/teamPlanner.js';
import { planApproachRoute } from '../ai/navigation.js';
import { createIntentExecutor,executeIntent } from '../ai/intentExecutor.js';
import { chooseDefendPosition } from '../ai/positioning.js';
import { DEFAULT_WORLD } from '../locomotion.js';
import { createSortieObjective,advanceSortieObjective } from '../sortieObjectives.js';
import { createWeaponState,fireWeapon,WEAPONS } from '../combat.js';
import { createPilotBrain,decidePilot } from '../ai/pilotBrain.js';
const source=n=>fs.readFileSync(new URL('../'+n,import.meta.url),'utf8');
const zone=(id,x,z,owner=null,contested=false,friendly=0,hostile=0)=>({
    id,point:{x,z},owner,contested,friendly,hostile});
const getSnapshot=(time,configured=null)=>{
 const zones=configured??[zone('A',-17,-1.5),zone('B',0,-9.1),zone('C',17,1.5)];
 const rig=(id,x,z)=>({id,active:true,position:{x,z},behavior:'pressure',
    capability:{canMove:true,canFight:true,mobility:1,power:1,weapon:1,
      command:1,endurance:1,speed:1}});
 return {time,kind:'domination',zoneRadius:4.7,zones,
    score:{friendly:0,hostile:0,max:60},knowledge:{
      friendly:{allies:[rig('ally-1',-9,20),rig('ally-2',9,20)],contacts:[]},
      hostile:{allies:[rig('enemy-0',-9,-20),rig('enemy-1',0,-20),
        rig('enemy-2',9,-20)],contacts:[]}
    }};
};
test('team detects unproductive stalemate and commits to another zone, no kill required',()=>{
 const memory=createStrategicState();
 const battlefield=getSnapshot(0,[zone('A',-17,-1.5,'friendly',true,1,1),
    zone('B',0,-9.1,null,true,1,1),zone('C',17,1.5,'hostile',true,1,1)]);
 const early=evaluateStrategy(memory,battlefield,'friendly');
 assert.notEqual(early.phase,'ROTATE');
 battlefield.time=12;
 const strategy=evaluateStrategy(memory,battlefield,'friendly');
 assert.equal(strategy.phase,'ROTATE',JSON.stringify(strategy));
 assert.match(strategy.reason,/ROTATE/);
 const plan=planTeam(battlefield,'friendly',{strategy});
 assert.equal(plan.strategy,'ROTATE');
 assert.ok(Object.values(plan.orders).some(o=>o.objectiveId===strategy.target));
 assert.ok(Object.values(plan.orders).every(o=>o.role));
});
test('respond to hostile two-point majority and rotate when the target is secured',()=>{
 const memory=createStrategicState();
 const snapshot=getSnapshot(2,[zone('A',-17,-1.5,'hostile'),
   zone('B',0,-9.1,'hostile'),zone('C',17,1.5,'friendly')]);
 const first=evaluateStrategy(memory,snapshot,'friendly');
 assert.equal(first.phase,'BREAK_MAJORITY');
 const plan=planTeam(snapshot,'friendly',{strategy:first});
 assert.ok(Object.values(plan.orders).some(p=>p.goal==='CONTEST'));
 snapshot.time=11;
 snapshot.zones.find(z=>z.id===first.target).owner='friendly';
 const second=evaluateStrategy(memory,snapshot,'friendly');
 assert.notEqual(second.target,first.target);
});
test('strategic urgency is observable but never overrides physical no-mobility constraints',()=>{
 const snapshot=getSnapshot(13,[zone('A',-17,-1.5,'hostile',true,2,2),
   zone('B',0,-9.1,'friendly',false,1,0),zone('C',17,1.5,'hostile')]);
 snapshot.knowledge.friendly.allies[0].capability.canMove=false;
 snapshot.knowledge.friendly.allies[0].position={x:-30,z:20};
 const strategy=evaluateStrategy(createStrategicState(),snapshot,'friendly');
 const jobs=planTeam(snapshot,'friendly',{strategy}).orders;
 assert.equal(jobs['ally-1'].goal,'HOLD');
 assert.equal(jobs['ally-2'].role!==undefined,true);
});
test('strict live capture remains frozen when two rigs face one rig',()=>{
 const state=createSortieObjective({objective:{type:'domination',
    points:[{id:'A',x:0,z:0},{id:'B',x:12,z:0},{id:'C',x:-12,z:0}],
    radius:4.7,captureSeconds:3.6}});
 const rigs=[{active:true,team:'friendly',rig:{x:0,z:0}},
   {active:true,team:'friendly',rig:{x:1,z:0}},
   {active:true,team:'hostile',rig:{x:0,z:1}}];
 for(let i=0;i<480;i++)advanceSortieObjective(state,rigs,1/60);
 assert.equal(state.domination.capturePolicy,'strict');
 assert.equal(state.domination.points[0].influence,0);
 assert.equal(state.friendlyProgress,0);
});
test('superiority A/B experiment slowly advances capture influence, but never scores contested point',()=>{
 const state=createSortieObjective({objective:{type:'domination',capturePolicy:'superiority',
    points:[{id:'A',x:0,z:0},{id:'B',x:12,z:0},{id:'C',x:-12,z:0}],
    radius:4.7,captureSeconds:3.6}});
 const rigs=[{active:true,team:'friendly',rig:{x:0,z:0}},
   {active:true,team:'friendly',rig:{x:1,z:0}},
   {active:true,team:'hostile',rig:{x:0,z:1}}];
 for(let i=0;i<240;i++)advanceSortieObjective(state,rigs,1/60);
 assert.ok(state.domination.points[0].influence>.3);
 assert.equal(state.friendlyProgress,0);
 assert.equal(state.domination.points[0].contested,true);
});
test('capture approach is inside the zone and the actual rig collision radius is respected',()=>{
 for(const radius of [.95,1.2,1.45]){
     const route=planApproachRoute(DEFAULT_WORLD,{x:-9,z:22},
         {x:-17,z:-1.5},4.7,radius);
     assert.equal(route.ok,true,route.reason);
     const p=route.waypoints.at(-1);
     assert.ok(Math.hypot(p.x+17,p.z+1.5)<4.7-radius);
 }
});
test('executor does not misdiagnose a stopped rig already inside its capture approach',()=>{
 const state=createIntentExecutor();
 const from={x:-10,z:18},intent={goal:'CAPTURE',objectiveId:'A',
     point:{x:-17,z:-1.5},radius:4.7};
 const first=executeIntent(state,intent,from,DEFAULT_WORLD,1.1,1/60);
 assert.equal(first.mode,'ORDER');
 const p=state.route.waypoints.at(-1);
 const rig={x:p.x,z:p.z};
 for(let i=0;i<300;i++)executeIntent(state,intent,rig,DEFAULT_WORLD,1.1,1/60);
 assert.equal(state.replanAttempts,0);
});
test('defensive position fits scoring zone and has physical clearance',()=>{
 for(const radius of [.95,1.2,1.5]){
   const p=chooseDefendPosition(DEFAULT_WORLD,{x:-9,z:18},
     {x:-17,z:-1.5},3,{x:0,z:-9},'bruiser',radius+.3);
   assert.ok(Math.hypot(p.x+17,p.z+1.5)<4.7);
   for(const block of DEFAULT_WORLD.obstacles.filter(o=>!o.dynamic))
     assert.ok(!(p.x>block.minX-radius-.3&&p.x<block.maxX+radius+.3&&
         p.z>block.minZ-radius-.3&&p.z<block.maxZ+radius+.3));
 }
});
test('weapon transaction consumes a real shot once regardless of hit/miss outcome',()=>{
 const w=WEAPONS['gun-cannon'],state=createWeaponState(w);
 const before=state.loaded;
 const shot=fireWeapon(state,w);
 assert.ok(shot);
 assert.equal(state.loaded,before-1);
 assert.equal(fireWeapon(state,w),null,'cooldown must prevent double spending');
 const main=source('main.js');
 const section=main.slice(main.indexOf('function attemptAiFire('),
     main.indexOf('function attemptFire()'));
 assert.ok(section.indexOf('fireWeapon(actor.weaponState, actor.weaponSpec)')<
   section.indexOf('arena.traceCombatantShot('));
 assert.ok(section.indexOf('fireWeapon(actor.weaponState, actor.weaponSpec)')<
   section.indexOf('if (contact.slot === null || contact.actorId !== target.id) return;'));
 assert.match(section,/applyRecoil\(actor\.rig/);
});
test('service instructions pick actual cover and cannot repair an unavailable module',()=>{
 const main=source('main.js');
 assert.match(main,/chooseCoverPoint\(actor\.rig,target\.rig/);
 assert.match(main,/actor\.lastServiceCoverCheck/);
 const actor={id:'enemy-1',position:{x:0,z:0}};
 const brain=createPilotBrain();
 const intent=decidePilot(brain,actor,{goal:'CAPTURE',point:{x:-17,z:0},score:.8},
 {capability:{canMove:true,endurance:1,command:1},
   weaponRecovery:{active:true,mode:'WITHDRAW'},retreatPoint:{x:8,z:8}},1);
 assert.equal(intent.goal,'WITHDRAW');
 assert.deepEqual(intent.point,{x:8,z:8});
});
test('dev diagnostics include team strategy, target, route and pilot decision details',()=>{
 const main=source('main.js'),debug=source('ai/debug.js');
 assert.match(main,/evaluateStrategy\(strategicMemory/);
 assert.match(main,/AI TEAMS/);
 assert.match(debug,/routeFailure/);
 assert.match(debug,/committedFor/);
});
