import test from 'node:test';
import assert from 'node:assert/strict';
import {WEAPONS,TARGET_RESILIENCE,applyTargetHit,createTargetCondition,makeRangeTarget} from '../combat.js';
import {countDisabled,systemMissionKillReason} from '../fieldService.js';
const baseline={structure:[260,250],mobility:[170,185],power:[110,190],command:[120,185],combat:[130,180]};
const guns=['gun-cannon','gun-short','gun-light'];
function shotsToDisable(spec,slot,contract='yard-dog'){
 const c=createTargetCondition(makeRangeTarget(contract));let n=0;
 while(c.parts[slot].integrity>0&&n<250){applyTargetHit(c,slot,spec.damage);n++;}
 return n;
}
function time(shots,spec){
 return Math.max(0,shots-1)/spec.roundsPerSecond+
 Math.floor(Math.max(0,shots-1)/spec.magazine)*spec.reloadSeconds;
}
test('all five modules double internal durability without artificially extending armor phase',()=>{
 for(const [slot,[oldHp,oldArmor]] of Object.entries(baseline)){
  assert.deepEqual(TARGET_RESILIENCE[slot],[oldHp*2,oldArmor]);
 }
});
test('critical weapon faults now follow several seconds of penetrated operation',()=>{
 for(const id of guns){
  const spec=WEAPONS[id];const c=createTargetCondition(makeRangeTarget('yard-dog'));
  const part=c.parts.power;let shots=0,breach=-1,underHalf=-1;
  while(part.integrity>0 && shots<250){
   const hit=applyTargetHit(c,'power',spec.damage);shots++;
   if(hit.internalDamage>0 && breach<0)breach=shots;
   if(part.integrity<part.maxIntegrity*.5&&underHalf<0)underHalf=shots;
  }
  assert.ok(breach>=4, spec.label+' armor breach should not be instant');
  assert.ok(shots-underHalf>=1,spec.label+' needs a damaged-phase shot after crossing half');
  assert.ok(time(shots,spec)>3.25,spec.label+' must survive materially longer than old three-second kill');
  assert.equal(countDisabled(c),1);
  assert.equal(systemMissionKillReason(c),null);
 }
});
test('focusing multiple systems, not one critical component, produces knockout',()=>{
 const c=createTargetCondition(makeRangeTarget('yard-dog'));
 for(const slot of ['power','command']){
  const p=c.parts[slot];applyTargetHit(c,slot,p.armor+p.integrity);
  assert.equal(systemMissionKillReason(c),null);
 }
 const p=c.parts.combat;applyTargetHit(c,'combat',p.armor+p.integrity);
 assert.match(systemMissionKillReason(c),/THREE DISABLES/);
});
test('Kestrel remains fragile, Yardwalker balanced and Hauler substantially tougher',()=>{
 for(const id of guns){
  const w=WEAPONS[id];
  const k=shotsToDisable(w,'mobility','cutter'),
    y=shotsToDisable(w,'mobility','yard-dog'),
    h=shotsToDisable(w,'mobility','mule');
  assert.ok(k<y&&y<h,`${id}: ${k}/${y}/${h}`);
  assert.ok(h>w.magazine);
 }
});
test('all eight weapons retain physical, bounded damage rates while the new HP curve applies',()=>{
 for(const w of Object.values(WEAPONS)){
  assert.ok(w.damage>0&&w.roundsPerSecond>0&&w.magazine>0&&w.reloadSeconds>0);
  const spec=WEAPONS[w.id],c=createTargetCondition(makeRangeTarget('yard-dog'));
  const hit=applyTargetHit(c,'structure',spec.damage);
  assert.ok(hit.armorAbsorbed>=0);
  assert.equal(c.parts.structure.maxIntegrity,baseline.structure[0]*2);
 }
});
