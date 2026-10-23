import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createFootContacts,advanceFootContacts,footContactProfile} from '../footContactController.js';
const text=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('sustained observed slip requests a bounded corrective step without changing body position',()=>{
 for(const family of ['legs-yard','legs-compact','legs-hauler']){
  const rig={x:0,z:0,yaw:0,vx:0,vz:0,footSlipMps:3,tractionUse:1,impact:.3};
  let contacts=createFootContacts(rig,family),stepOccurred=false,landed=false;
  for(let i=0;i<180;i++){
    contacts=advanceFootContacts(contacts,rig,family,1/60);
    stepOccurred ||=contacts.catchStepCount>0;
    landed ||=contacts.landings>0;
    assert.equal(rig.x,0);
    assert.equal(rig.z,0);
    assert.ok(contacts.feet.some(f=>f.mode==='stance'));
    for(const f of contacts.feet){
      assert.ok(Number.isFinite(f.x)&&Number.isFinite(f.z));
      assert.ok(Math.abs(f.localX)<footContactProfile(family).lateralReach*2.5);
    }
  }
  assert.equal(stepOccurred,true,family+' visibly catches support');
  assert.equal(landed,true,family+' has actual corrective landing');
  assert.ok(contacts.catchStepCount<=3,family+' finite rate of catch steps');
 }
});
test('ordinary standing never invents a recovery maneuver or a combo bonus',()=>{
 const r={x:0,z:0,yaw:0,vx:0,vz:0,footSlipMps:0,tractionUse:0,impact:0};
 let c=createFootContacts(r);
 for(let i=0;i<500;i++)c=advanceFootContacts(c,r,'legs-yard',1/60);
 assert.equal(c.catchStepCount,0);
 assert.equal(c.landings,0);
 assert.equal(c.flow,0);
 assert.equal(c.maneuver,'SETTLE');
});
test('clean walking develops mechanical flow; traction saturation dissipates it',()=>{
 let r={x:0,z:0,yaw:0,vx:1.7,vz:0,footSlipMps:0,tractionUse:.55,impact:0};
 let c=createFootContacts(r);
 for(let i=0;i<210;i++){
  r={...r,x:i*.028};
  c=advanceFootContacts(c,r,'legs-yard',1/60);
 }
 assert.ok(c.flow>.8);
 for(let i=0;i<70;i++){
  r={...r,x:r.x+.028,footSlipMps:2.8,tractionUse:1};
  c=advanceFootContacts(c,r,'legs-yard',1/60);
 }
 assert.ok(c.flow<.2);
 assert.ok(c.recovery>.4);
});
test('flow and recoveries cannot supply invisible rig physics forces',()=>{
 const scene=text('scene.js'),foot=text('footContactController.js'),physics=text('locomotion.js');
 assert.match(scene,/catchSteps:contacts.catchStepCount/);
 assert.match(scene,/flow:contacts.flow/);
 assert.match(foot,/recoveryStepCooldown/);
 assert.doesNotMatch(physics,/catchStepCount|recoveryStepCooldown|\.flow\b/);
 assert.match(text('pilotingLab.js'),/CATCHES/);
});
