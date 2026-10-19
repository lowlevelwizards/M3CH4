import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { shotThreatEvidence,recordShotEvidence,recordSubsystemHit,
 threatenedSubsystem,counterFlankOrder,cautiousApproach,threatFacingPoint } from '../ai/combatIntelligence.js';
import { createTacticalAwareness,noteIncomingFire } from '../tacticalAwareness.js';
import { observeBattlefield,createWorldModel } from '../ai/worldModel.js';
import { createHostileController,advanceHostileController,hostileOutput } from '../hostileRig.js';
import { WEAPONS,createWeaponState,advanceWeapon,fireWeapon } from '../combat.js';
import { createEnemyMotion,advanceEnemyMotion,withinFiringArc } from '../enemyMotion.js';
import { createPilotBrain,decidePilot } from '../ai/pilotBrain.js';
import { createIntentExecutor,executeIntent } from '../ai/intentExecutor.js';
const arena={minX:-40,maxX:40,minZ:-40,maxZ:40,obstacles:[]};
const rig=(x,z,yaw=0)=>({x,z,yaw,vx:0,vz:0,yawRate:0,forwardSpeed:0,lateralSpeed:0});
const pos=(x,z)=>({x,z});
const condition=()=>({parts:Object.fromEntries(['structure','mobility','power','command','combat']
 .map(k=>[k,{integrity:100,maxIntegrity:100}]))});
const actor=(id,team,x,z,yaw=0)=>({id,team,rig:rig(x,z,yaw),condition:condition(),active:true});
test('near-miss evidence requires physical proximity to the finite bullet path',()=>{
 const near=shotThreatEvidence(pos(1,7),pos(0,0),pos(0,15));
 assert.ok(near&&near.severity>0);
 assert.equal(Math.abs(near.bearing.x),0);
 assert.equal(near.bearing.z,-1);
 assert.equal(shotThreatEvidence(pos(8,7),pos(0,0),pos(0,15)),null);
 assert.equal(shotThreatEvidence(pos(0,25),pos(0,0),pos(0,15)),null);
});
test('nearby rounds yield uncertain direction but never shooter identity or an aimable enemy',()=>{
 const awareness=createTacticalAwareness();
 const event=shotThreatEvidence(pos(1,7),pos(0,0),pos(0,15));
 recordShotEvidence(awareness,pos(1,7),event);
 assert.ok(awareness.underFireSeconds>1);
 assert.equal(awareness.unseenThreat,true);
 assert.equal(awareness.recentAttackerId,null);
 assert.deepEqual(threatFacingPoint(pos(1,7),awareness),{x:1,z:-2});
});
test('optic rear sector is blind until chassis rotates into physical sight cone',()=>{
 const friend=actor('friend','friendly',15,0,0);
 const enemy=actor('enemy','hostile',15,8,Math.PI);
 const objective={type:'elimination'};
 let s=observeBattlefield(createWorldModel(),[friend,enemy],objective,arena,0);
 assert.equal(s.knowledge.friendly.contacts.length,0);
 friend.rig.yaw=Math.PI;
 s=observeBattlefield(createWorldModel(),[friend,enemy],objective,arena,.2);
 assert.equal(s.knowledge.friendly.contacts[0].id,'enemy');
 assert.equal(s.knowledge.friendly.contacts[0].visible,true);
});
test('squad line-of-sight detection never reveals unseen enemy parts',()=>{
 const f=actor('f','friendly',0,0,0),e=actor('e','hostile',0,-8,Math.PI);
 const s=observeBattlefield(createWorldModel(),[f,e],{type:'elimination'},arena,0);
 assert.ok(s.knowledge.friendly.contacts[0].visible);
 assert.ok(!Object.hasOwn(s.knowledge.friendly.contacts[0],'capability'));
 assert.ok(!Object.hasOwn(s.knowledge.friendly.contacts[0],'condition'));
});
test('shared threat reports include actual ally fire pressure, not opponent health',()=>{
 const f=actor('f','friendly',0,0,0),e=actor('e','hostile',0,-8,Math.PI);
 f.motion={awareness:{underFireSeconds:2.4}};
 const s=observeBattlefield(createWorldModel(),[f,e],{type:'elimination'},arena,0);
 assert.equal(s.knowledge.friendly.allies[0].underFireSeconds,2.4);
 assert.equal(s.knowledge.friendly.allies[0].yaw,0);
});
test('true cyclic-rate authority belongs to gun, not AI controller timer',()=>{
 const spec=WEAPONS['gun-short'],machine=condition();
 const gun=createWeaponState(spec),controller=createHostileController(0);
 let fired=0;
 for(let i=0;i<60;i++){
   const ready=gun.cooldown<=0&&gun.loaded>0&&gun.reloadLeft<=0;
   const shot=advanceHostileController(controller,machine,1/60,false,ready);
   if(shot!==null){assert.ok(fireWeapon(gun,spec)!==null);fired++;}
   advanceWeapon(gun,spec,1/60);
 }
 assert.equal(fired,2); // 2.0 rounds/s, real physical cooldown
 assert.equal(controller.shots,fired);
 assert.equal(hostileOutput(machine).triggerSeconds,undefined);
});
test('AI acquisition does not keep restarting an artificial cooldown after shot',()=>{
 const m=condition(),controller=createHostileController(.3);
 assert.equal(advanceHostileController(controller,m,.1,false,true),null);
 assert.equal(advanceHostileController(controller,m,.21,false,true),1);
 assert.equal(advanceHostileController(controller,m,1/60,false,true),2);
 assert.equal(advanceHostileController(controller,m,1/60,false,false),null);
});
test('fitted weapon retains magazine, reload and hardware condition constraints',()=>{
 const m=condition();m.parts.combat.integrity=1;
 const c=createHostileController(0);
 assert.equal(advanceHostileController(c,m,1/60,false,true),null);
 assert.equal(fireWeapon({...createWeaponState(WEAPONS['gun-short']),loaded:0},WEAPONS['gun-short']),null);
});
test('under fire from rear temporarily interrupts an otherwise active team route',()=>{
 const motion=createEnemyMotion(),self=rig(0,0,0),behind=pos(0,10);
 noteIncomingFire(motion,behind,'player',1.55);
 const order={mode:'ORDER',point:pos(0,-19),role:'TACTICAL',note:'CAPTURE B'};
 const move=advanceEnemyMotion(motion,self,self,1/60,true,arena,1.1,
   motion.behavior,order);
 assert.equal(motion.phase,'UNDER FIRE');
 assert.ok(Math.abs(move.steer)>.1);
 assert.equal(motion.navigation.includes('THREAT'),true);
});
test('emergency posture does not teleport/overwrite physical yaw or position',()=>{
 const motion=createEnemyMotion(),self=rig(0,0,0);
 noteIncomingFire(motion,pos(0,12),'player',1.4);
 advanceEnemyMotion(motion,self,self,1/60,true,arena,1.1,motion.behavior,
  {mode:'ORDER',point:pos(0,-20)});
 assert.equal(self.x,0);assert.equal(self.z,0);assert.equal(self.yaw,0);
});
test('actual fitted forward firing arc remains narrow even after fire-rate removal',()=>{
 assert.equal(withinFiringArc(rig(0,0,0),pos(0,-8)),true);
 assert.equal(withinFiringArc(rig(0,0,0),pos(0,8)),false);
});
test('two repeated real impacts on weakened combat slot trigger preservation',()=>{
 const mem={},c=condition();c.parts.combat.integrity=60;
 recordSubsystemHit(mem,'combat',2);
 assert.equal(threatenedSubsystem(mem,c,2),null);
 recordSubsystemHit(mem,'combat',3);
 assert.equal(threatenedSubsystem(mem,c,3).slot,'combat');
 assert.equal(threatenedSubsystem(mem,c,7),null);
});
test('critical subsystem risk interrupts normal capture with actual cover recommendation',()=>{
 const brain=createPilotBrain(),self={id:'m',position:pos(0,0)};
 const intent=decidePilot(brain,self,{goal:'CAPTURE',objectiveId:'C',
   point:pos(15,0),score:.7},{
   capability:{canMove:true,canFight:true,endurance:.7,command:.8,mobility:.7,weapon:.5},
   systemAtRisk:{slot:'combat',remaining:.4},survivalPoint:pos(-5,0),
   underFireSeconds:1.2},3);
 assert.equal(intent.goal,'WITHDRAW');
 assert.deepEqual(intent.point,pos(-5,0));
});
test('counterflank requires visible public contact and a free maneuverable defender',()=>{
 const me={id:'one',position:pos(0,0),capability:{canMove:true,canFight:true}};
 const allies=[me,{id:'two',position:pos(4,1),active:true,underFireSeconds:2.4}];
 const contacts=[{id:'player',position:pos(9,2),visible:true,confidence:1}];
 const result=counterFlankOrder(me,{goal:'CAPTURE'},allies,contacts,arena,4);
 assert.equal(result.goal,'ENGAGE');assert.equal(result.targetActorId,'player');
 assert.equal(counterFlankOrder(me,{anchor:true},allies,contacts,arena,4),null);
 assert.equal(counterFlankOrder(me,{goal:'CAPTURE'},allies,
   [{...contacts[0],visible:false}],arena,4),null);
});
test('cautious route planning has no synthetic waypoint without real cover',()=>{
 assert.equal(cautiousApproach(arena,pos(0,0),pos(0,-20),1.1),null);
});
test('route intent may carry a sheltered via-point without rewriting scoring destination',()=>{
 const exec=createIntentExecutor();
 const action=executeIntent(exec,{goal:'CAPTURE',objectiveId:'B',
   point:pos(0,-20),radius:4.7,viaPoint:pos(3,-8)},rig(0,0),arena,1.1,1/60);
 assert.equal(action.mode,'ORDER');
 assert.equal(exec.viaReached,false);
 const next=executeIntent(exec,{goal:'CAPTURE',objectiveId:'B',
   point:pos(0,-20),radius:4.7,viaPoint:pos(3,-8)},rig(3,-8),arena,1.1,1/60);
 assert.equal(exec.viaReached,true);
 assert.ok(next);
});
test('production source uses fast local perception and near-miss warnings',()=>{
 const main=fs.readFileSync(new URL('../main.js',import.meta.url),'utf8');
 assert.match(main,/aiPerceptionCooldown=\.15/);
 assert.match(main,/warnNearbyAiFromShot\(FRIENDLY_TEAM,contact\)/);
 assert.match(main,/counterFlankOrder\(/);
 assert.match(main,/recordSubsystemHit\(/);
 assert.doesNotMatch(main,/actorOutput\.triggerSeconds\s*\*\s*\.55/);
});
