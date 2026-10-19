import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { scoreForecast,reserveAnchors,assignmentSwitchCost,canStageAssault,teamPosture } from '../ai/objectiveDiscipline.js';
import { planTeam } from '../ai/teamPlanner.js';
import { createStrategicState,evaluateStrategy } from '../ai/strategicState.js';
import { createIntentExecutor,executeIntent } from '../ai/intentExecutor.js';
import { createPilotBrain,decidePilot } from '../ai/pilotBrain.js';
import { chooseDefendPosition } from '../ai/positioning.js';
import { prioritizeVisibleTarget } from '../ai/adaptiveTactics.js';
import { DEFAULT_WORLD } from '../locomotion.js';
import { observeBattlefield,createWorldModel } from '../ai/worldModel.js';
const here=(x,z)=>({x,z});
const zone=(id,x,z,owner=null,contested=false,friendly=0,hostile=0)=>
 ({id,point:here(x,z),owner,contested,friendly,hostile,influence:owner==='friendly'?1:owner==='hostile'?-1:0});
const cap=(overrides={})=>({canMove:true,canFight:true,weapon:1,mobility:1,command:1,endurance:1,speed:1,...overrides});
const mech=(id,team,x,z,overrides={})=>({id,team,active:true,position:here(x,z),rig:{x,z,yaw:0,vx:0,vz:0},
 capability:cap(overrides),behavior:'bruiser'});
function world(time=12){
 const allies=[mech('ally-1','friendly',-17,-1.5),mech('ally-2','friendly',0,-9.1),mech('ally-3','friendly',8,18)];
 const hostiles=[mech('enemy-0','hostile',17,1.5),mech('enemy-1','hostile',15,-8),mech('enemy-2','hostile',-2,-20)];
 const zones=[zone('A',-17,-1.5,'friendly',false,1,0),zone('B',0,-9.1,'friendly',false,1,0),
  zone('C',17,1.5,'hostile',false,0,1)];
 return {kind:'domination',time,zoneRadius:4.7,zones,
   score:{friendly:15,hostile:3,max:60},
   remaining:{friendly:3,hostile:3},
   knowledge:{friendly:{allies,contacts:[]},hostile:{allies:hostiles,contacts:[]}}};
}
test('1: two currently useful owned points reserve two physical anchors',()=>{
 const s=world();const result=planTeam(s,'friendly',{strategy:{phase:'HOLD_MAJORITY',target:'C'}});
 assert.equal(result.anchors,2);
 assert.equal(result.orders['ally-1'].objectiveId,'A');
 assert.equal(result.orders['ally-2'].objectiveId,'B');
 for(const id of ['ally-1','ally-2']){
   assert.equal(result.orders[id].role,'ANCHOR');
   assert.equal(result.orders[id].goal,'DEFEND');
   assert.equal(result.orders[id].anchor,true);
 }
});
test('1/6: an anchor cannot be reassigned to a speculative remote target',()=>{
 const s=world(),old=planTeam(s,'friendly',{strategy:{phase:'HOLD_MAJORITY',target:'C'}});
 const plan=planTeam({...s,time:12.85},'friendly',{strategy:{phase:'ROTATE',target:'C'},
   previousOrders:old.orders,assaultMemory:{}});
 assert.equal(plan.orders['ally-1'].objectiveId,'A');
 assert.equal(plan.orders['ally-2'].objectiveId,'B');
});
test('2: net objective forecast values a paying majority and penalizes contested imbalance',()=>{
 const safe=zone('A',-17,-1.5,'friendly',false,1,0);
 const contested=zone('B',0,-9.1,'friendly',true,1,2);
 assert.ok(scoreForecast(safe,'friendly',true)>scoreForecast(contested,'friendly',true));
});
test('2/6: switch cost rewards staying on objective and penalizes leaving productive own circle',()=>{
 const a=mech('ally-1','friendly',-17,-1.5);
 const z=zone('A',-17,-1.5,'friendly');
 const previous={goal:'DEFEND',objectiveId:'A'};
 assert.ok(assignmentSwitchCost(a,{kind:'CAPTURE',objectiveId:'B'},previous,z,'friendly')>.5);
 assert.ok(assignmentSwitchCost(a,{kind:'DEFEND',objectiveId:'A'},previous,z,'friendly')<0);
});
test('3: assault staging requires two healthy nearby fighters and enemy physically contesting',()=>{
 const s=world();const pair=[['ally-2',{}],['ally-3',{}]],actors=s.knowledge.friendly.allies;
 assert.equal(canStageAssault({pair,actors,zone:s.zones[2],team:'friendly',now:3,memory:{},majorityHeld:true}),false);
 assert.equal(canStageAssault({pair,actors,zone:s.zones[0],team:'friendly',now:3,memory:{}}),false);
 const pairNear=[['ally-2',{}],['ally-3',{}]];
 actors[1].position=here(13,1);actors[2].position=here(14,4);
 assert.equal(canStageAssault({pair:pairNear,actors,zone:s.zones[2],team:'friendly',now:3,memory:{}}),true);
 assert.equal(canStageAssault({pair:pairNear,actors,zone:s.zones[2],team:'friendly',now:3,memory:{cooldownUntil:9}}),false);
});
test('3: repeatedly planning an assault cannot restart a four-second staging loop',()=>{
 const s=world(10);s.zones[0].owner=null;s.zones[1].owner='hostile';
 s.knowledge.friendly.allies[0].position=here(-2,-8);
 s.knowledge.friendly.allies[1].position=here(-3,-7);
 s.knowledge.friendly.allies[2].position=here(8,18);
 const memory={};
 const opts={strategy:{phase:'BREAK_MAJORITY',target:'B'},assaultMemory:memory};
 let p=planTeam(s,'friendly',opts);
 assert.ok(Object.keys(p.orders).length===3);
 if(memory.target){
   s.time=13;
   planTeam(s,'friendly',opts);
   assert.ok(memory.cooldownUntil>=27);
   s.time=14;
   planTeam(s,'friendly',opts);
   assert.equal(memory.target,null);
 }
});
test('4: physical local detour holds the same bypass endpoint over repeated steps',()=>{
 const state=createIntentExecutor(),rig=here(-9,20);
 const intent={goal:'CAPTURE',point:here(-9,0),objectiveId:'B',radius:4.7};
 const first=executeIntent(state,intent,rig,DEFAULT_WORLD,1.1,1/60,
   [{position:here(-9,17),radius:1,active:true}]);
 assert.equal(first.mode,'ORDER');
 if(first.note.includes('YIELD TRAFFIC')){
   const second=executeIntent(state,intent,rig,DEFAULT_WORLD,1.1,1/60,
     [{position:here(-8,17),radius:1,active:true}]);
   assert.deepEqual(second.point,first.point);
   assert.ok(state.trafficLock);
 }
});
test('5/8: arriving in physical scoring radius anchors without continuously replanning',()=>{
 const state=createIntentExecutor(),rig=here(-17,-1.5);
 const intent={goal:'CAPTURE',point:here(-17,-1.5),objectiveId:'A',radius:4.7};
 for(let i=0;i<4;i++){
   const action=executeIntent(state,intent,rig,DEFAULT_WORLD,1.1,1/60);
   assert.equal(action.mode,'ANCHOR');
   assert.equal(action.note,'SCORING FOOTPRINT');
 }
 assert.equal(state.failures,0);
 assert.equal(state.zoneSettles,4);
});
test('8: settled defender prefers real present footprint over speculative lane swap',()=>{
 const self=here(-17,-1.5);
 const p=chooseDefendPosition(DEFAULT_WORLD,self,here(-17,-1.5),3,null,'pressure',1.1,[],0);
 assert.deepEqual(p,self);
});
test('7: a scoring team does not rotate because ten seconds passed without ownership churn',()=>{
 const s=world(2),memory=createStrategicState();
 const original=evaluateStrategy(memory,s,'friendly');
 assert.equal(original.phase,'HOLD_MAJORITY');
 s.time=25;s.score.friendly=40;
 const r=evaluateStrategy(memory,s,'friendly');
 assert.equal(r.phase,'HOLD_MAJORITY');
});
test('9: visible opponents near an anchor count as more relevant than remote observed combatants',()=>{
 const s=world(),me={id:'ally-1',team:'friendly',rig:here(-17,-1.5)};
 const remote={id:'enemy-1',rig:here(0,-3)};
 const close={id:'enemy-2',rig:here(-16,-3)};
 const order={goal:'DEFEND',objectiveId:'A',point:here(-17,-1.5),anchor:true,role:'ANCHOR'};
 assert.equal(prioritizeVisibleTarget(me,[remote,close],s,order)?.id,'enemy-2');
});
test('10: known public final enemy enables a non-anchor hunter without revealing hidden locations',()=>{
 const s=world();s.remaining.hostile=1;
 s.knowledge.friendly.contacts=[{id:'enemy-0',position:here(11,10),visible:true,confidence:1}];
 const p=planTeam(s,'friendly',{strategy:{phase:'HOLD_MAJORITY',target:'C'}});
 assert.equal(p.orders['ally-1'].anchor,true);
 assert.equal(p.orders['ally-2'].anchor,true);
 assert.equal(p.orders['ally-3'].goal,'ENGAGE');
 assert.equal(p.orders['ally-3'].targetActorId,'enemy-0');
});
test('10: hidden contact never triggers final-opponent hunting',()=>{
 const s=world();s.remaining.hostile=1;
 s.knowledge.friendly.contacts=[{id:'enemy-0',position:here(11,10),visible:false,confidence:.8}];
 const p=planTeam(s,'friendly',{strategy:{phase:'HOLD_MAJORITY',target:'C'}});
 assert.notEqual(p.orders['ally-3'].goal,'ENGAGE');
});
test('10: public roster counts contain no hidden enemy condition or coordinates',()=>{
 const s=world(),conditions=s.knowledge.hostile.allies.map(a=>({
   id:a.id,team:a.team,rig:a.rig,
   condition:{parts:{mobility:{maxIntegrity:100,integrity:60},combat:{maxIntegrity:100,integrity:80}}},
   active:true}));
 const rows=[...s.knowledge.friendly.allies,...conditions];
 const result=observeBattlefield(createWorldModel(),rows,{type:'domination',
   friendlyProgress:0,hostileProgress:0,radius:4.7,domination:{points:[],scoreToWin:60}},
   DEFAULT_WORLD,0);
 assert.equal(result.remaining.hostile,3);
 assert.equal(result.knowledge.friendly.allies.length,3);
 assert.ok(result.knowledge.friendly.contacts.every(c=>!('capability' in c)));
});
test('developer diagnostics expose physical route and footprint measurements',()=>{
 const src=fs.readFileSync(new URL('../ai/debug.js',import.meta.url),'utf8');
 assert.match(src,/trafficYields/);assert.match(src,/routeSwitches/);
 assert.match(src,/scoringSettles/);assert.match(src,/anchor/);
});

test('release entrypoint imports current tactical brain rather than stale cache identities',()=>{
 const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.ok(html.includes('main.js?v=k3u7'));
 assert.ok(html.includes('RIG DIAGNOSTICS <span>0.0.1k.3u.7</span>'));
 for(const file of ['teamPlanner','strategicState','positioning','objectiveDiscipline','debug'])
   assert.ok(html.includes('./ai/'+file+'.js?v=k3u6'),file+' retained module identity');
 for(const file of ['worldModel','pilotBrain','intentExecutor','adaptiveTactics','combatIntelligence'])
   assert.ok(html.includes('./ai/'+file+'.js?v=k3u7'),file+' refreshed combat module identity');
});

test('a single owned point remains tactically flexible until a real scoring majority exists',()=>{
 const s=world();s.zones[1].owner=null;
 const anchors=reserveAnchors(s.knowledge.friendly.allies,s.zones,'friendly');
 assert.equal(anchors.length,0);
});
test('an enemy contesting the capture footprint keeps the attacker maneuvering',()=>{
 const state=createIntentExecutor(),rig=here(-17,-1.5);
 const intent={goal:'CONTEST',point:here(-17,-1.5),objectiveId:'A',
   radius:4.7,contested:true};
 const action=executeIntent(state,intent,rig,DEFAULT_WORLD,1.1,1/60);
 assert.notEqual(action.note,'SCORING FOOTPRINT');
});
