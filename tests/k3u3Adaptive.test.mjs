import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createStrategicState,evaluateStrategy } from '../ai/strategicState.js';
import { planTeam } from '../ai/teamPlanner.js';
import { createPilotBrain,decidePilot } from '../ai/pilotBrain.js';
import { createIntentExecutor, executeIntent } from '../ai/intentExecutor.js';
import { chooseDefendPosition } from '../ai/positioning.js';
import { DEFAULT_WORLD } from '../locomotion.js';
import { zoneOpportunity,prioritizeVisibleTarget,shouldAttemptTacticalShot,
  tacticalAimSlot,casualtyAssignment,assaultStagingPoint,trafficWaypoint } from '../ai/adaptiveTactics.js';
const content=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
const zone=(id,x,z,owner=null,contested=false,friendly=0,hostile=0)=>({
  id,point:{x,z},owner,contested,friendly,hostile,influence:owner==='friendly'?1:owner==='hostile'?-1:0});
const actor=(id,team,x,z,properties={})=>({id,team,active:true,position:{x,z},
  rig:{x,z,vx:0,vz:0},behavior:'pressure',
  capability:{canMove:true,canFight:true,endurance:1,command:1,speed:1,weapon:1,...properties}});
function snapshot(time=0,zones=null,includePlayer=false){
 const friendly=[actor('ally-1','friendly',-9,20),actor('ally-2','friendly',9,20)];
 if(includePlayer)friendly.push(actor('player','friendly',-17,-1.5));
 return {kind:'domination',time,zoneRadius:4.7,
  zones:zones??[zone('A',-17,-1.5),zone('B',0,-9.1),zone('C',17,1.5)],
  score:{friendly:0,hostile:0,max:60},
  knowledge:{friendly:{allies:friendly,contacts:[]},
    hostile:{allies:[actor('enemy-0','hostile',-9,-20),
      actor('enemy-1','hostile',0,-20),actor('enemy-2','hostile',9,-20)],contacts:[]}}};
}
test('stagnation counts score rather than point ownership churn',()=>{
 const mem=createStrategicState(),s=snapshot(0,[
   zone('A',-17,-1.5,'friendly',true,1,1),
   zone('B',0,-9.1,'hostile',true,1,1),
   zone('C',17,1.5,null,true,1,1)]);
 evaluateStrategy(mem,s,'friendly');
 s.time=5;s.zones[0].owner='hostile';
 evaluateStrategy(mem,s,'friendly');
 s.time=12;s.zones[0].owner='friendly';
 const result=evaluateStrategy(mem,s,'friendly');
 assert.equal(result.phase,'ROTATE');
 assert.ok(result.stalledFor>=12);
 assert.ok(result.deadlockSince>0);
});
test('a real scoring advance resets escalation memory',()=>{
 const mem=createStrategicState(),s=snapshot(12,[
   zone('A',-17,-1.5,'friendly',true,1,1),
   zone('B',0,-9.1,'hostile',true,1,1),
   zone('C',17,1.5,null,true,1,1)]);
 evaluateStrategy(mem,s,'friendly');
 s.score.friendly=1.2;s.time=14;
 const r=evaluateStrategy(mem,s,'friendly');
 assert.notEqual(r.phase,'ROTATE');
 assert.ok(r.stalledFor<.1);
});
test('a scoring majority is worth more than joining an already contested deadlock',()=>{
 const safe=zone('A',-17,-1.5,'friendly',false,1,0);
 const deadlock=zone('B',0,-9.1,'friendly',true,1,2);
 assert.ok(zoneOpportunity(safe,'friendly',true)>zoneOpportunity(deadlock,'friendly',true));
});
test('planner obeys mobility loss rather than ordering a long capture',()=>{
 const s=snapshot(12);
 s.knowledge.friendly.allies[0].capability.canMove=false;
 s.knowledge.friendly.allies[0].position={x:-30,z:25};
 const result=planTeam(s,'friendly',{strategy:evaluateStrategy(createStrategicState(),s,'friendly')});
 assert.equal(result.orders['ally-1'].goal,'HOLD');
});
test('two-rig assault has an explicit staging position outside objective',()=>{
 const a=actor('ally-1','friendly',-10,20),b=actor('ally-2','friendly',0,20);
 const p=assaultStagingPoint(a,{x:-17,z:-1.5},b);
 assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.z));
 assert.ok(Math.hypot(p.x+17,p.z+1.5)>4.6);
});
test('defense can separate allied machines without leaving scored zone',()=>{
 const zonePoint={x:-17,z:-1.5}, self={x:-15,z:3};
 const old=chooseDefendPosition(DEFAULT_WORLD,self,zonePoint,2.8,null,'bruiser',1.1);
 const away=chooseDefendPosition(DEFAULT_WORLD,self,zonePoint,2.8,null,'bruiser',1.1,[{position:old}]);
 assert.ok(Math.hypot(away.x+17,away.z+1.5)<4.7);
 assert.ok(Math.hypot(away.x-old.x,away.z-old.z)>0.1);
});
test('priority target is an observed objective threat, not arbitrary nearest opponent',()=>{
 const s=snapshot(10,[zone('A',-17,-1.5,'friendly',true,1,1),
  zone('B',0,-9.1),zone('C',17,1.5)]);
 const me={id:'ally-1',team:'friendly',rig:{x:-12,z:6}};
 const patrol={id:'enemy-0',rig:{x:-13,z:3}};
 const contest={id:'enemy-1',rig:{x:-17,z:-1.5}};
 const choice=prioritizeVisibleTarget(me,[patrol,contest],s,{objectiveId:'A',role:'INTERCEPT'});
 assert.equal(choice.id,'enemy-1');
});
test('weapon firing respects actual reload, ammo and remote-target discipline',()=>{
 const a={rig:{x:0,z:0},behavior:{preferredRangeM:7},
  weaponSpec:{damage:30},weaponState:{loaded:3,reloadLeft:0}};
 assert.equal(shouldAttemptTacticalShot(a,{rig:{x:0,z:45}}),false);
 assert.equal(shouldAttemptTacticalShot(a,{rig:{x:0,z:45}},{urgent:true}),true);
 a.weaponState.reloadLeft=1;
 assert.equal(shouldAttemptTacticalShot(a,{rig:{x:0,z:5}}),false);
});
test('subsystem aim uses visible motion and service, never hidden component percentages',()=>{
 assert.equal(tacticalAimSlot('structure',{targetSpeed:4}),'mobility');
 assert.equal(tacticalAimSlot('structure',{visibleService:true}),'combat');
 assert.equal(tacticalAimSlot('structure',{contesting:true,targetSpeed:.1}),'combat');
 assert.equal(tacticalAimSlot('structure',{}),'structure');
});
test('disabled weapon still allows safe occupancy rather than mandatory withdrawal',()=>{
 const a=actor('ally-1','friendly',-17,-1.5,{canFight:false});
 assert.ok(casualtyAssignment(a,{kind:'DEFEND',point:{x:-17,z:-1.5}},zone('A',-17,-1.5,'friendly'))>=0);
 assert.ok(casualtyAssignment(a,{kind:'CONTEST',point:{x:0,z:-9.1}},zone('B',0,-9.1,'hostile'))<0);
});
test('traffic advisory alters next waypoint only for a physically close block',()=>{
 const rig={x:-9,z:18}, waypoint={x:-9,z:8};
 const changed=trafficWaypoint(rig,waypoint,[{position:{x:-9,z:15},radius:1}],DEFAULT_WORLD,1);
 assert.notDeepEqual(changed,waypoint);
 const unchanged=trafficWaypoint(rig,waypoint,[{position:{x:20,z:15},radius:1}],DEFAULT_WORLD,1);
 assert.deepEqual(unchanged,waypoint);
});
test('intent executor retains physical route while yielding locally',()=>{
 const exec=createIntentExecutor(),rig={x:-9,z:20};
 const intent={goal:'CAPTURE',point:{x:-17,z:-1.5},objectiveId:'A',radius:4.7};
 const order=executeIntent(exec,intent,rig,DEFAULT_WORLD,1.1,1/60,[{position:{x:-9,z:17},radius:1}]);
 assert.equal(order.mode,'ORDER');
 assert.equal(exec.failures,0);
 assert.ok(exec.route?.waypoints.length>0);
});
test('pilot risk remains bounded and service is still higher priority than a capture',()=>{
 const brain=createPilotBrain(),me={id:'ally-1',position:{x:-9,z:20}};
 const proposed=decidePilot(brain,me,{goal:'CAPTURE',point:{x:-17,z:-1.5},score:.88},
 {capability:{canMove:true,endurance:.95,command:1},weaponRecovery:{active:true,mode:'WITHDRAW'},
 retreatPoint:{x:-9,z:22}},3);
 assert.equal(proposed.goal,'WITHDRAW');
});
test('player remains uncontrolled while squad has real physical orders',()=>{
 const s=snapshot(6,[zone('A',-17,-1.5,'friendly'),zone('B',0,-9.1),zone('C',17,1.5)],true);
 const p=planTeam(s,'friendly',{strategy:{phase:'HOLD_MAJORITY',target:'A'}});
 assert.equal(p.orders.player,undefined);
 assert.ok(Object.keys(p.orders).length===2);
 assert.ok(Object.values(p.orders).every(o=>o.point&&Number.isFinite(o.point.x)));
});
test('page labels and connected circuit map actually ship in the working tree',()=>{
 const html=content('index.html'),ui=content('unifiedGarageUI.js'),css=content('unifiedGarageStyles.css');
 assert.match(html,/RIG DIAGNOSTICS <span id="dev-version"><\/span>/);
 assert.match(html,/Weapon Audio Personalization/);
 assert.match(ui,/CONNECTED JOBS/);
 assert.match(css,/campaign-node-tile/);
 assert.match(content('garageMountUI.js'),/unifiedGarageUI\.js\?v=k3v6/);
});
test('no changes to authored strict capture contract',()=>{
 const src=content('contracts.js'),objectives=content('sortieObjectives.js');
 assert.match(src,/type:'domination'/);
 assert.match(objectives,/capturePolicy: \['superiority','pressure'\]/);
});
