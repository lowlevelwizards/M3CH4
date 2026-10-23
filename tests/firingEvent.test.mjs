import test from 'node:test';
import assert from 'node:assert/strict';
import {createFiringEventState,triggerFiringEvent,advanceFiringEvent,firingProfile,FIRING_PROFILES} from '../firingEvent.js';

test('all eight weapons have bounded real firing profiles',()=>{
 assert.equal(Object.keys(FIRING_PROFILES).length,8);
 for(const [id,p] of Object.entries(FIRING_PROFILES)){
  assert.ok(p.duration>=p.cycle, id);
  const state=createFiringEventState();
  triggerFiringEvent(state,id);
  const first=advanceFiringEvent(state,1/60);
  for(const x of ['travel','mount','cab','bolt','stop','feeder'])assert.ok(Number.isFinite(first[x]),id+' '+x);
  for(let i=0;i<200;i++)advanceFiringEvent(state,1/60);
  assert.equal(state.pulses.length,0,id);
  assert.equal(state.pose.active,false,id);
 }
});
test('a worn heavy cannon has a larger stroke than a needle',()=>{
 const heavy=createFiringEventState(),light=createFiringEventState();
 triggerFiringEvent(heavy,'gun-short',{condition:.25});
 triggerFiringEvent(light,'gun-light');
 assert.ok(advanceFiringEvent(heavy,.016).travel>advanceFiringEvent(light,.016).travel*2);
});
test('bracing restrains cab shock but never invents less recoil travel',()=>{
 const braced=createFiringEventState(),free=createFiringEventState();
 triggerFiringEvent(braced,'gun-short',{brace:1});
 triggerFiringEvent(free,'gun-short',{brace:0});
 const a=advanceFiringEvent(braced,.08),b=advanceFiringEvent(free,.08);
 assert.ok(Math.abs(a.cab)<Math.abs(b.cab));
 assert.equal(a.travel,b.travel);
});
test('sustained automatic fire stays in five bounded pulse slots',()=>{
 const state=createFiringEventState();
 for(let i=0;i<150;i++){
  triggerFiringEvent(state,'gun-rivet');
  const pose=advanceFiringEvent(state,.01);
  assert.ok(pose.travel>=0 && pose.travel<=2);
  assert.ok(state.pulses.length<=5);
 }
});
test('no new behavior for unknown definitions or broken delta',()=>{
 const state=createFiringEventState();
 assert.equal(firingProfile('bogus'),firingProfile('gun-cannon'));
 triggerFiringEvent(state,'bogus');
 const before=advanceFiringEvent(state,Number.NaN);
 assert.equal(before.active,false);
});
