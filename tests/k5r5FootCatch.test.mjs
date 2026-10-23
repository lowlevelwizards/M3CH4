import test from 'node:test';
import assert from 'node:assert/strict';
import {createFootContacts,advanceFootContacts,registerFootImpact,footPresentation} from '../footContactController.js';
const rig=()=>({x:0,z:0,yaw:0,vx:0,vz:0,forwardSpeed:0,lateralSpeed:0,
  yawRate:0,impact:0,tractionUse:0,footSlipMps:0,driveLoad:0,groundHeightM:0});
const run=(feet,body,family,frames)=>{for(let i=0;i<frames;i++)feet=advanceFootContacts(feet,body,family,1/60);return feet;};
test('Kestrel responds to a genuine lateral hit with one planted catch step',()=>{
 const body=rig();let feet=createFootContacts(body,'legs-compact');
 const left=feet.feet[0],right=feet.feet[1],firstX=left.x,firstZ=left.z;
 const hit=registerFootImpact(feet,{impulseNs:2550,massKg:2750,directionX:1,pointX:.5});
 assert.ok(hit.requiresStep);
 assert.equal(feet.hitCatch.pending,true);
 feet=run(feet,body,'legs-compact',18);
 assert.equal(feet.hitCatch.stepCount,1);
 assert.equal(feet.feet[1].impactCatch,true);
 assert.ok(feet.feet[1].targetX>right.startX+.04);
 assert.equal(left.x,firstX);assert.equal(left.z,firstZ);
 assert.ok(feet.hitCatch.force<1);
 feet=run(feet,body,'legs-compact',95);
 assert.equal(feet.hitCatch.stepCount,1);
 assert.equal(feet.hitCatch.pending,false);
 assert.ok(Math.abs(feet.weightShift)<1);
});
test('Yardwalker catches a mirrored side strike on the opposite foot',()=>{
 const body=rig(),feet=createFootContacts(body,'legs-yard');
 const hit=registerFootImpact(feet,{impulseNs:3200,massKg:2450,directionX:-1,pointX:-.6});
 assert.equal(hit.side,-1);
 const advanced=run(feet,body,'legs-yard',18);
 assert.equal(advanced.hitCatch.stepCount,1);
 assert.equal(advanced.feet[0].impactCatch,true);
 assert.ok(advanced.feet[0].targetX<advanced.feet[0].startX);
});
test('Hauler absorbs a moderate hit through planted compression instead of forced steps',()=>{
 const body=rig(),feet=createFootContacts(body,'legs-hauler');
 const hit=registerFootImpact(feet,{impulseNs:2550,massKg:3400,directionX:1});
 assert.ok(hit.force>0);
 assert.equal(hit.requiresStep,false);
 const advanced=run(feet,body,'legs-hauler',24);
 assert.equal(advanced.hitCatch.stepCount,0);
 assert.ok(advanced.feet.every(f=>f.mode==='stance'));
 assert.ok(advanced.bodyCompression>0);
});
test('braced support and thermal/zero impulse do not invent a catch',()=>{
 const body=rig(),feet=createFootContacts(body,'legs-compact');
 assert.equal(registerFootImpact(feet,{impulseNs:0,massKg:2000}),null);
 assert.equal(feet.hitCatch.stepCount,0);
 const hit=registerFootImpact(feet,{impulseNs:2550,massKg:3400,directionX:1,brace:1});
 assert.equal(hit.requiresStep,false);
 run(feet,body,'legs-compact',60);
 assert.equal(feet.hitCatch.stepCount,0);
});
test('simultaneous pellets coalesce to one correction, no teleporting a supporting foot',()=>{
 const body=rig(),feet=createFootContacts(body,'legs-compact');
 const left=feet.feet[0],x=left.x,z=left.z;
 for(let i=0;i<6;i++)registerFootImpact(feet,{impulseNs:3550/6,massKg:1700,directionX:1});
 const advanced=run(feet,body,'legs-compact',24);
 assert.ok(advanced.hitCatch.stepCount<=1);
 assert.equal(left.x,x);assert.equal(left.z,z);
 const p=footPresentation(advanced,-1);
 assert.equal(typeof p.planted,'boolean');
});
