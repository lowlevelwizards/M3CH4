import test from 'node:test';
import assert from 'node:assert/strict';
import {IMPACT_CATCH_PROFILES,impactCatchEvidence,createImpactCatchState,injectImpactCatch,advanceImpactCatch,commitImpactCatchStep} from '../impactCatch.js';

test('all three family profiles react to a REAL hit with distinct identities',()=>{
 assert.equal(Object.keys(IMPACT_CATCH_PROFILES).length,3);
 const hit={impulseNs:2550,massKg:2750,directionX:1,directionZ:.3,pointX:.8};
 const kestrel=impactCatchEvidence(hit,'legs-compact'),yard=impactCatchEvidence(hit,'legs-yard'),hauler=impactCatchEvidence(hit,'legs-hauler');
 assert.ok(kestrel.force>yard.force&&yard.force>hauler.force);
 assert.equal(kestrel.side,1);
 assert.equal(kestrel.requiresStep,true);
 assert.equal(hauler.requiresStep,false);
 assert.ok(hauler.compression>0);
});
test('bracing attenuates shock; no impulse means no invented recovery',()=>{
 assert.equal(impactCatchEvidence({impulseNs:0}),null);
 const hit={impulseNs:3000,massKg:2400,directionX:.85};
 const free=impactCatchEvidence(hit,'legs-compact');
 const braced=impactCatchEvidence({...hit,brace:1},'legs-compact');
 assert.ok(free.force>braced.force*2);
});
test('opposed lateral hits mirror correction; frontal shots favor hit side',()=>{
 const a=impactCatchEvidence({impulseNs:3000,massKg:2300,directionX:.9},'legs-yard');
 const b=impactCatchEvidence({impulseNs:3000,massKg:2300,directionX:-.9},'legs-yard');
 assert.equal(a.side,1);assert.equal(b.side,-1);
 const front=impactCatchEvidence({impulseNs:3000,massKg:2300,directionZ:1,pointX:-.3},'legs-yard');
 assert.equal(front.side,-1);assert.equal(front.z,1);
});
test('one burst can queue one step, then cooldown and decay release it',()=>{
 const s=createImpactCatchState();
 const e=impactCatchEvidence({impulseNs:3200,massKg:2200,directionX:1},'legs-compact');
 for(let i=0;i<6;i++)injectImpactCatch(s,e);
 assert.equal(s.pending,true);
 assert.ok(s.force<=1);
 assert.equal(commitImpactCatchStep(s),true);
 assert.equal(commitImpactCatchStep(s),false);
 assert.equal(s.stepCount,1);
 for(let i=0;i<90;i++)advanceImpactCatch(s,1/60);
 assert.equal(s.pending,false);assert.equal(s.cooldown,0);
 assert.ok(s.force<.03);
});
