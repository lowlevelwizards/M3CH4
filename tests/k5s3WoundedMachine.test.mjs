import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {legImpairment,machineWoundPose,recoveryMotion,damageLabCondition} from '../woundedMachine.js';
import {createFootContacts,advanceFootContacts} from '../footContactController.js';
import {createWeaponStabilizer,advanceWeaponStabilizer,registerWeaponStabilityShot} from '../weaponStability.js';
import {createPowerSystem,advancePowerSystem} from '../powerDynamics.js';
import {makeTestAssembly} from '../components.js';
const src=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const families=['legs-yard','legs-compact','legs-hauler'];
test('family-specific weak legs compress, shorten swing and require longer loaded transfer',()=>{
 for(const family of families){
  const healthy=legImpairment(1,1,family),mild=legImpairment(.75,1,family),
    damaged=legImpairment(.5,1,family),critical=legImpairment(.25,1,family);
  assert.equal(healthy.severity,0);
  assert.ok(mild.severity<damaged.severity&&damaged.severity<critical.severity);
  assert.ok(healthy.swingTime<damaged.swingTime&&damaged.swingTime<critical.swingTime);
  assert.ok(healthy.swingLift>damaged.swingLift&&damaged.swingLift>critical.swingLift);
  assert.ok(critical.kneeCompression>mild.kneeCompression);
 }
});
test('left vs right injury produces opposite mechanical lean, healthy machinery stays neutral',()=>{
 for(const family of families){
  const clean=machineWoundPose({family,left:1,right:1});
  assert.equal(clean.bodyRoll,0);
  assert.equal(clean.bodyDrop,0);
  const left=machineWoundPose({family,left:.18,right:1,loadLeft:1,driveLoad:1});
  const right=machineWoundPose({family,left:1,right:.18,loadRight:1,driveLoad:1});
  assert.ok(left.bodyRoll<0&&right.bodyRoll>0,family);
  assert.ok(left.left.kneeCompression>left.right.kneeCompression);
  assert.ok(right.right.kneeCompression>right.left.kneeCompression);
  assert.ok(left.bodyDrop>0&&left.bodyDrop<.12);
 }
});
test('actual anchored-foot controller keeps a slower low-clearance damaged swing',()=>{
 const rig={x:0,z:0,yaw:0,vx:0,vz:0,driveLoad:1};
 for(const family of families){
  const a=createFootContacts(rig,family),b=createFootContacts(rig,family);
  for(const state of [a,b]){
    const foot=state.feet[0];foot.mode='swing';foot.swing=0;
    foot.startX=foot.x;foot.targetX=foot.x+.2;
    foot.startZ=foot.z;foot.targetZ=foot.z+.2;
  }
  advanceFootContacts(a,rig,family,1/60,{leftHealth:1});
  advanceFootContacts(b,rig,family,1/60,{leftHealth:.25});
  assert.ok(b.feet[0].swing<a.feet[0].swing,family);
  assert.ok(b.feet[0].lift<a.feet[0].lift,family);
  assert.equal(a.feet[1].mode,'stance');
  assert.equal(b.feet[1].mode,'stance');
  assert.equal(a.feet[1].x,b.feet[1].x,'healthy stance support remains fixed');
 }
});
test('recovery requires a genuine completed service event, settles to a finite family pose',()=>{
 for(const family of families){
  assert.equal(recoveryMotion(0,'mobility',family).compression,0);
  assert.ok(recoveryMotion(.3,'mobility',family).compression>0);
  assert.ok(recoveryMotion(.3,'mobility',family).knee>0);
  assert.equal(recoveryMotion(3,'mobility',family).compression,0);
  assert.equal(recoveryMotion(3,'combat',family).bolt,0);
  assert.ok(recoveryMotion(.25,'combat',family).bolt>0);
 }
});
test('damage lab uses real maxIntegrity and armor; no invented damage on an unrelated module',()=>{
 const parts={mobility:{maxIntegrity:340,integrity:340,maxArmor:185,armor:185,destroyed:false,destruction:0},
  power:{maxIntegrity:220,integrity:220,maxArmor:190,armor:190}};
 assert.equal(damageLabCondition(parts,'mobility',25),.25);
 assert.equal(parts.mobility.integrity,85);
 assert.equal(parts.mobility.armor,0);
 assert.equal(parts.power.integrity,220);
 assert.equal(damageLabCondition(parts,'mobility',100),1);
 assert.equal(parts.mobility.armor,185);
 assert.equal(damageLabCondition(parts,'nonexistent',25),null);
});
test('damaged real weapon mount follows body acceleration with greater measured error',()=>{
 const a=createWeaponStabilizer(),b=createWeaponStabilizer();
 for(let i=0;i<100;i++){
  const rig={lateralAcceleration:4,longitudinalAcceleration:3,yawRate:.5,footingLoad:.7};
  advanceWeaponStabilizer(a,'gun-short',rig,{stanceCount:1,weightShift:.25},{combat:1,command:1,mobility:1},1/60);
  advanceWeaponStabilizer(b,'gun-short',rig,{stanceCount:1,weightShift:.25},{combat:.25,command:.4,mobility:.35},1/60);
 }
 assert.ok(Math.hypot(b.yaw,b.pitch)>Math.hypot(a.yaw,a.pitch)*1.25);
 registerWeaponStabilityShot(a,'gun-short');registerWeaponStabilityShot(b,'gun-short',{condition:.25});
 assert.ok(b.vPitch>a.vPitch);
});
test('worn generator has physical lower electrical capacity and slower load response',()=>{
 const assembly=makeTestAssembly();
 const fresh=createPowerSystem(assembly),damaged=createPowerSystem(assembly);
 const demand={driveLoad:1};
 advancePowerSystem(fresh,assembly,demand,1/60,1);
 advancePowerSystem(damaged,assembly,demand,1/60,.4);
 assert.ok(damaged.capacityKw<fresh.capacityKw);
 assert.ok(damaged.generationKw<fresh.generationKw);
});
test('both player and AI use actual physical injury and Test Yard remains save-isolated',()=>{
 const main=src('main.js'),scene=src('scene.js'),yard=src('testYard.js'),css=src('testYard.css');
 assert.match(main,/emitMachineMotionSound\(assembly,rig,FIXED_DT,true,\{left:output.left,right:output.right\}\)/);
 assert.match(main,/driveHealth:actor.driveDamage.drives/);
 assert.match(main,/recoveryEventId:fieldService.lastServicedSlot/);
 assert.match(main,/if\(!testYard \|\| !SLOTS.includes\(slot\)\)/);
 assert.match(scene,/machineWoundPose\(/);
 assert.match(scene,/leg\.knee\.rotation\.x-=injury\.kneeCompression/);
 assert.match(scene,/recoveryMotion\(record\.recoveryElapsed/);
 assert.match(scene,/pilotRecovery=recoveryMotion/);
 assert.match(yard,/yard-damage-lab/);
 assert.match(yard,/onDamage\(\{who:who.value,slot:slot.value/);
 assert.match(css,/yard-injury\[hidden\]/);
});
