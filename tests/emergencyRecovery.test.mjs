import test from 'node:test';
import assert from 'node:assert/strict';
import {
 FIELD_SERVICE_SECONDS,FIELD_SERVICE_COOLDOWN_SECONDS,FIELD_SERVICE_RECOVERY_RATIO,
 advanceFieldService,beginFieldService,canFieldService,createFieldServiceState,
 fieldServiceStationary,serviceableSlots,fieldServiceTarget,cycleFieldServiceTarget,
 countDisabled,systemMissionKillReason,weaponFailureState,weaponMissionKillReason
} from '../fieldService.js';
import { hostileMissionKillReason } from '../hostileRig.js';
const stopped=()=>({vx:0,vz:0,yawRate:0});
const machine=(health={})=>({parts:Object.fromEntries(
 ['structure','mobility','power','command','combat'].map(slot=>[slot,
 {integrity:(health[slot]??1)*100,maxIntegrity:100,armor:35,maxArmor:35,destruction:0,destroyed:false}]))});
const service=(c,s,slot)=>{s.selectedSlot=slot;assert.equal(beginFieldService(c,s,stopped()),true);
 return advanceFieldService(c,s,stopped(),FIELD_SERVICE_SECONDS);};
test('single and paired failures continue battle; third concurrent failure is a mission kill',()=>{
 const c=machine({mobility:0});
 assert.equal(countDisabled(c),1);
 assert.equal(systemMissionKillReason(c),null);
 c.parts.combat.integrity=0;
 assert.equal(countDisabled(c),2);
 assert.equal(hostileMissionKillReason(c),null);
 c.parts.power.integrity=0;
 assert.equal(countDisabled(c),3);
 assert.match(systemMissionKillReason(c),/TOTAL SYSTEM FAILURE/);
 assert.equal(weaponMissionKillReason(c),systemMissionKillReason(c));
 c.parts.mobility.integrity=15;
 assert.equal(countDisabled(c),2);
 assert.equal(systemMissionKillReason(c),null);
});
test('destroyed cabin or frame is unrecoverable; noncritical destruction counts as one disable',()=>{
 const c=machine();
 c.parts.combat.destroyed=true;c.parts.combat.integrity=0;
 assert.equal(systemMissionKillReason(c),null);
 assert.deepEqual(serviceableSlots(c),[]);
 c.parts.command.destroyed=true;c.parts.command.integrity=0;
 assert.equal(systemMissionKillReason(c),'PILOT COMPARTMENT DESTROYED');
 c.parts.command.destroyed=false;c.parts.command.integrity=1;
 c.parts.structure.destroyed=true;c.parts.structure.integrity=0;
 assert.equal(systemMissionKillReason(c),'FRAME DESTROYED');
});
test('field service recovers any disabled module, never armor or destruction overflow',()=>{
 for(const slot of ['structure','mobility','power','command','combat']){
  const c=machine({[slot]:0}),s=createFieldServiceState();
  c.parts[slot].armor=0;c.parts[slot].destruction=17;
  assert.equal(fieldServiceTarget(c,s),slot);
  const step=service(c,s,slot);
  assert.equal(step.event,'completed');
  assert.equal(step.slot,slot);
  assert.equal(step.ratio,FIELD_SERVICE_RECOVERY_RATIO);
  assert.equal(c.parts[slot].integrity,25);
  assert.equal(c.parts[slot].armor,0);
  assert.equal(c.parts[slot].destruction,17);
  assert.equal(s.cooldownLeft,FIELD_SERVICE_COOLDOWN_SECONDS);
  assert.equal(serviceableSlots(c).length,0);
 }
});
test('stationary hold breaks when moving, and cooldown prevents immediate re-service',()=>{
 const c=machine({combat:0}),s=createFieldServiceState();
 assert.equal(fieldServiceStationary({vx:.5,vz:0,yawRate:0}),false);
 assert.equal(beginFieldService(c,s,{vx:.5,vz:0,yawRate:0}),false);
 assert.equal(beginFieldService(c,s,stopped()),true);
 assert.equal(advanceFieldService(c,s,stopped(),1).event,'progress');
 assert.equal(advanceFieldService(c,s,{vx:.5,vz:0,yawRate:0},.1).event,'interrupted');
 assert.equal(s.progress,0);
 service(c,s,'combat');
 c.parts.combat.integrity=0;
 assert.equal(canFieldService(c,s),false);
 assert.equal(advanceFieldService(c,s,stopped(),FIELD_SERVICE_COOLDOWN_SECONDS).event,null);
 assert.equal(canFieldService(c,s),true);
 assert.equal(service(c,s,'combat').ratio,.20);
 assert.equal(s.attempts.combat,2);
});
test('third service is increasingly weak, and active choices cycle without serial mutation',()=>{
 const c=machine({power:0,combat:0}),s=createFieldServiceState();
 assert.equal(fieldServiceTarget(c,s),'power');
 assert.equal(cycleFieldServiceTarget(c,s),'combat');
 assert.equal(fieldServiceTarget(c,s),'combat');
 service(c,s,'combat');
 advanceFieldService(c,s,stopped(),10);
 c.parts.combat.integrity=0;
 service(c,s,'combat');
 advanceFieldService(c,s,stopped(),10);
 c.parts.combat.integrity=0;
 assert.equal(service(c,s,'combat').ratio,.15);
 assert.equal(c.parts.combat.integrity,15);
 assert.equal(c.parts.power.integrity,0);
 assert.equal(weaponFailureState(c,s),'damaged');
});
