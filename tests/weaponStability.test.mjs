import test from 'node:test';
import assert from 'node:assert/strict';
import {WEAPON_MOUNT_PROFILES,createWeaponStabilizer,advanceWeaponStabilizer,registerWeaponStabilityShot,resetWeaponStabilizer,MAX_MOUNT_ANGLE} from '../weaponStability.js';
const step=(state,id='gun-short',rig={},feet=null,health={})=>advanceWeaponStabilizer(state,id,rig,feet,health,1/60);
test('all eight real gun profiles use finite bounded mount angles',()=>{
 assert.equal(Object.keys(WEAPON_MOUNT_PROFILES).length,8);
 for(const id of Object.keys(WEAPON_MOUNT_PROFILES)){
  const s=createWeaponStabilizer();
  for(let i=0;i<180;i++){step(s,id,{lateralAcceleration:7,longitudinalAcceleration:8,yawRate:1.2,footingLoad:1},{stanceCount:1,landings:1,lastLandingStrength:1,weightShift:.5},{combat:.15,command:.2,mobility:.2});
   assert.ok(Math.abs(s.yaw)<=MAX_MOUNT_ANGLE&&Math.abs(s.pitch)<=MAX_MOUNT_ANGLE);
  }
 }
});
test('heavy Stump mounts wander more under movement than Needle',()=>{
 const a=createWeaponStabilizer(),b=createWeaponStabilizer();
 for(let i=0;i<90;i++){const rig={lateralAcceleration:4,longitudinalAcceleration:3,footingLoad:.7,yawRate:.7};step(a,'gun-short',rig,{stanceCount:1});step(b,'gun-light',rig,{stanceCount:1});}
 assert.ok(Math.abs(a.yaw)>Math.abs(b.yaw)*2);
});
test('brace and planted feet restrain the exact same acceleration',()=>{
 const free=createWeaponStabilizer(),firm=createWeaponStabilizer();
 for(let i=0;i<90;i++){step(free,'gun-cannon',{lateralAcceleration:3,yawRate:.7,brace:0},{stanceCount:1});step(firm,'gun-cannon',{lateralAcceleration:3,yawRate:.7,brace:1},{stanceCount:2});}
 assert.ok(Math.abs(firm.yaw)<Math.abs(free.yaw)*.5);
});
test('shot changes the NEXT sight picture, not the existing sampled bearing',()=>{
 const s=createWeaponStabilizer();
 const initial=s.pitch;
 registerWeaponStabilityShot(s,'gun-short');
 assert.equal(s.pitch,initial);
 step(s,'gun-short');
 assert.ok(s.pitch>initial);
 const light=createWeaponStabilizer();
 registerWeaponStabilityShot(light,'gun-light');step(light,'gun-light');
 assert.ok(s.pitch>light.pitch*2);
});
test('repeated shots accumulate then return to an exact settled sight',()=>{
 const s=createWeaponStabilizer();
 for(let i=0;i<15;i++){registerWeaponStabilityShot(s,'gun-rivet');for(let j=0;j<7;j++)step(s,'gun-rivet');}
 assert.ok(s.settled<1);
 for(let i=0;i<350;i++)step(s,'gun-rivet');
 assert.ok(Math.abs(s.yaw)+Math.abs(s.pitch)<.0001);
 assert.ok(s.settled>.99);
 resetWeaponStabilizer(s);assert.deepEqual(s,createWeaponStabilizer());
});
test('damage slows settling but no random jitter appears at rest',()=>{
 const a=createWeaponStabilizer(),b=createWeaponStabilizer();
 registerWeaponStabilityShot(a,'gun-short');registerWeaponStabilityShot(b,'gun-short');
 for(let i=0;i<14;i++){step(a,'gun-short',{},null,{combat:1,command:1});step(b,'gun-short',{},null,{combat:.2,command:.3});}
 assert.ok(Math.abs(b.pitch)>Math.abs(a.pitch));
 const still=createWeaponStabilizer();
 for(let i=0;i<120;i++)step(still,'gun-short',{},null,{combat:.1,command:.1,mobility:.1});
 assert.equal(still.yaw,0);assert.equal(still.pitch,0);
});
