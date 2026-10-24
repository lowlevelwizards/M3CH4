import test from 'node:test';
import assert from 'node:assert/strict';
import {applyTargetHit,createTargetCondition,makeRangeTarget} from '../combat.js';
import {advanceFieldService,beginFieldService,canFieldService,createFieldServiceState,serviceableSlots} from '../fieldService.js';
import {aiWeaponMissionKillReason,aiWeaponRecoveryDirective,aiWeaponRecoveryPosture} from '../aiFieldService.js';
import {damagePosture} from '../damageBehavior.js';
const fixture=()=>({condition:createTargetCondition(makeRangeTarget('yard-dog')),
 fieldService:createFieldServiceState(),behavior:{id:'pressure'},
 rig:{x:0,z:0,vx:0,vz:0,yawRate:0},
 motion:{awareness:{lineOfSight:false,underFireSeconds:1}}});
function disable(actor,slot){
 const p=actor.condition.parts[slot];
 applyTargetHit(actor.condition,slot,p.armor+p.integrity+1);
 assert.equal(p.integrity,0);assert.equal(p.destroyed,false);
}
test('any physical module disable is recoverable while actor remains alive',()=>{
 for(const slot of ['structure','mobility','power','command','combat']){
  const a=fixture();disable(a,slot);
  assert.deepEqual(serviceableSlots(a.condition),[slot]);
  assert.equal(canFieldService(a.condition,a.fieldService),true);
  assert.equal(aiWeaponMissionKillReason(a.condition,a.behavior,a.fieldService),null);
 }
});
test('wounded AI withdraws in danger and services under real cover',()=>{
 const a=fixture();disable(a,'power');a.motion.awareness.lineOfSight=true;
 const target={rig:{x:5,z:0}};
 assert.equal(aiWeaponRecoveryDirective(a,target).mode,'WITHDRAW');
 a.motion.awareness.lineOfSight=false;
 const order=aiWeaponRecoveryDirective(a,target);
 assert.equal(order.mode,'SERVICE');assert.equal(order.slot,'power');
 assert.equal(order.begin,true);
 assert.equal(aiWeaponRecoveryPosture(damagePosture(a.condition,a.behavior),order).preferredMode,'HOLD');
});
test('immobile AI holds instead of trying to withdraw with broken legs',()=>{
 const a=fixture();disable(a,'mobility');a.motion.awareness.lineOfSight=true;
 const o=aiWeaponRecoveryDirective(a,{rig:{x:3,z:0}});
 assert.equal(o.mode,'SERVICE');assert.equal(o.begin,true);
});
test('AI restart is cooldown-gated and cannot repair destroyed hardware',()=>{
 const a=fixture();disable(a,'combat');
 const safe={rig:{x:10,z:0}};
 beginFieldService(a.condition,a.fieldService,a.rig);
 const d=advanceFieldService(a.condition,a.fieldService,a.rig,4);
 assert.equal(d.event,'completed');assert.equal(d.ratio,.25);
 a.condition.parts.combat.integrity=0;
 assert.equal(aiWeaponRecoveryDirective(a,safe).mode,'WITHDRAW');
 a.condition.parts.combat.destroyed=true;
 assert.equal(serviceableSlots(a.condition).length,0);
});
test('battle loop exposes all-module service and genuine external recovery particles',async()=>{
 const fs=await import('node:fs/promises');
 const main=await fs.readFile(new URL('../main.js',import.meta.url),'utf8');
 const scene=await fs.readFile(new URL('../scene.js',import.meta.url),'utf8');
 assert.match(main,/serviceSlot: actor\.fieldService\.held/);
 assert.match(main,/handleAiFieldServiceCompleted\(actor,serviceStep\)/);
 assert.match(main,/restoreFieldServicedDrive/);
 assert.match(scene,/partWorldPoint\(record,record\.serviceSlot\)/);
});
