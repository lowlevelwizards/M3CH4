import test from 'node:test';
import assert from 'node:assert/strict';
import { WEAPONS, createWeaponState, advanceWeapon, fireWeapon } from '../combat.js';
import { advanceChargedTrigger } from '../weaponController.js';
import { aiWeaponEngagement } from '../ai/weaponTactics.js';
import { createEnemyMotion, advanceEnemyMotion } from '../enemyMotion.js';
import { planTeam } from '../ai/teamPlanner.js';
import { assignmentSwitchCost } from '../ai/objectiveDiscipline.js';
import { createPilotBrain, decidePilot } from '../ai/pilotBrain.js';
import { createStrategicState, evaluateStrategy } from '../ai/strategicState.js';
import { observeBattlefield, createWorldModel } from '../ai/worldModel.js';

const area={minX:-40,maxX:40,minZ:-40,maxZ:40,obstacles:[]};
const point=(x,z)=>({x,z});
const me=(x=0,z=0,yaw=Math.PI/2)=>({x,z,yaw,vx:0,vz:0,yawRate:0,forwardSpeed:0,lateralSpeed:0});
const capability=()=>({canMove:true,canFight:true,mobility:1,command:1,endurance:1,weapon:1,speed:1});
const ally=(id,x,z)=>({id,team:'friendly',active:true,position:point(x,z),capability:capability(),behavior:'pressure'});
const zone=(id,x,z,owner=null)=>({id,point:point(x,z),owner,contested:false,friendly:owner==='friendly'?1:0,hostile:owner==='hostile'?1:0});
function snapshot(t=0){
 const allies=[ally('a',-12,0),ally('b',-11,2),ally('c',1,-7)];
 return {kind:'domination',time:t,zones:[
  zone('A',-12,0,'friendly'),zone('B',2,-7,null),zone('C',14,5,'hostile')],
  zoneRadius:4.7,score:{friendly:0,hostile:0,max:60},
  remaining:{friendly:3,hostile:3},
  knowledge:{friendly:{allies,contacts:[]},hostile:{allies:[],contacts:[]}}};
}
test('currently observed contact controls facing even while a route runs sideways',()=>{
 const motion=createEnemyMotion();
 const action=advanceEnemyMotion(motion,me(),point(0,-8),1/60,true,area,1.1,
   motion.behavior,{mode:'ORDER',point:point(13,0),goal:'CAPTURE'});
 assert.ok(action.steer<-.15,'face enemy north, not side waypoint');
 assert.equal(motion.phase,'ORDER');
});
test('fresh last-known contact guides facing but does not change travel authority',()=>{
 const motion=createEnemyMotion();
 const action=advanceEnemyMotion(motion,me(),null,1/60,true,area,1.1,
   motion.behavior,{mode:'ORDER',point:point(13,0),goal:'CAPTURE'},null,point(0,-8));
 assert.ok(action.steer<-.15);
 assert.equal(motion.phase,'ORDER');
 const unknown=createEnemyMotion();
 const blind=advanceEnemyMotion(unknown,me(),null,1/60,true,area,1.1,
   unknown.behavior,{mode:'ORDER',point:point(13,0),goal:'CAPTURE'});
 assert.ok(Math.abs(blind.steer)<.15,'expired memory does not become new knowledge');
});
test('shot envelope prevents splash suicides, impossible thermal reach and extreme scatter spray',()=>{
 const d=(id,distance,rigSpeed=0)=>aiWeaponEngagement(WEAPONS[id],{distance,rigSpeed});
 assert.equal(d('gun-rocket',3).fire,false);
 assert.equal(d('gun-rocket',14).fire,true);
 assert.equal(d('gun-scatter',12).fire,false);
 assert.equal(d('gun-scatter',5).fire,true);
 assert.equal(d('gun-arc',6.4).fire,false);
 assert.equal(d('gun-arc',4).fire,true);
 assert.equal(d('gun-rivet',17).fire,true);
 assert.equal(d('gun-rivet',24).fire,false);
 assert.equal(d('gun-breaker',12,2.4).fire,false);
 assert.equal(d('gun-breaker',12,.3).fire,true);
 assert.equal(d('gun-cannon',20).fire,true);
});
test('weapon judgment changes no authoritative cooldown, heat, ammo, or recoil',()=>{
 const spec=WEAPONS['gun-rivet'],state=createWeaponState(spec);
 assert.equal(aiWeaponEngagement(spec,{distance:8}).fire,true);
 assert.equal(state.loaded,60);
 assert.equal(fireWeapon(state,spec),1);
 assert.equal(state.loaded,59);
 assert.equal(fireWeapon(state,spec),null);
 advanceWeapon(state,spec,1/60);
 assert.ok(state.cooldown>0);
 const charged=WEAPONS['gun-breaker'],gun=createWeaponState(charged);
 for(let i=0;i<42;i++)advanceChargedTrigger(gun,charged,true,1/60);
 assert.equal(fireWeapon(gun,charged),1);
 assert.equal(gun.loaded,0);
 assert.equal(fireWeapon(gun,charged),null);
});
test('without a scoring majority, a settled defender can rotate',()=>{
 const s=snapshot(8);
 const p=planTeam(s,'friendly',{strategy:{phase:'BREAK_MAJORITY',target:'B'}});
 assert.equal(p.anchors,0);
 assert.ok(Object.values(p.orders).some(o=>o.objectiveId==='B'));
 assert.ok(Object.values(p.orders).filter(o=>o.objectiveId==='A').length<3);
 const first=s.knowledge.friendly.allies[0];
 const previous={goal:'DEFEND',objectiveId:'A'};
 assert.ok(assignmentSwitchCost(first,{kind:'CAPTURE',objectiveId:'B'},previous,s.zones[0],'friendly',true)<.2);
 assert.ok(assignmentSwitchCost(first,{kind:'CAPTURE',objectiveId:'B'},previous,s.zones[0],'friendly')>.5);
});
test('a new meaningful capture task can break a stale local defender commitment',()=>{
 const brain=createPilotBrain();
 const actor={id:'pilot',position:point(-12,0)};
 const context={capability:capability()};
 const previous=decidePilot(brain,actor,{goal:'DEFEND',point:point(-12,0),
   objectiveId:'A',score:.65},context,1);
 assert.equal(previous.goal,'DEFEND');
 const next=decidePilot(brain,actor,{goal:'CAPTURE',point:point(2,-7),
   objectiveId:'B',score:.65,emergency:true},context,2);
 assert.equal(next.goal,'CAPTURE');
});
test('strategic deadlock with insufficient scoring circles eventually calls a rotation',()=>{
 const memory=createStrategicState(),s=snapshot(1);
 evaluateStrategy(memory,s,'friendly');
 s.time=19;
 const p=evaluateStrategy(memory,s,'friendly');
 assert.equal(p.phase,'ROTATE');
 assert.notEqual(p.target,'A');
});
test('known opponent location is only used while public contact memory is fresh',()=>{
 const friend={id:'f',team:'friendly',active:true,rig:me(0,0,0)};
 const enemy={id:'e',team:'hostile',active:true,rig:me(0,-9,Math.PI)};
 const model=createWorldModel();
 let result=observeBattlefield(model,[friend,enemy],{type:'elimination'},area,0);
 assert.equal(result.knowledge.friendly.contacts[0].visible,true);
 enemy.rig.x=0;enemy.rig.z=9;
 result=observeBattlefield(model,[friend,enemy],{type:'elimination'},area,1);
 const known=result.knowledge.friendly.contacts[0];
 assert.equal(known.visible,false);
 assert.equal(known.position.z,-9,'last reported, not current enemy position');
 result=observeBattlefield(model,[friend,enemy],{type:'elimination'},area,7);
 assert.equal(result.knowledge.friendly.contacts.length,0);
});
