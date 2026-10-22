import test from 'node:test';
import assert from 'node:assert/strict';
import {WEAPONS} from '../combat.js';
import {sampleProxyProjectileHits,runBout} from '../research/headlessDominationStudy.mjs';
import {CASES,packFleet,simulateCampaign,runCampaignScenarios} from '../research/campaignEconomyStudy.mjs';
import {makeStarterAssembly} from '../acquisition.js';
import {runRosterBalanceAudit} from '../research/rosterBalanceAudit.mjs';

test('actual six projectile angles consume only one shell and yield 0–6 independent contacts',()=>{
  const scatter=WEAPONS['gun-scatter'],stump=WEAPONS['gun-short'];
  const certain=()=>0,miss=()=>.999999;
  assert.equal(sampleProxyProjectileHits(scatter,1,0,1,certain),6);
  assert.equal(sampleProxyProjectileHits(scatter,1,40,0,certain),0);
  assert.equal(sampleProxyProjectileHits(scatter,1,3,.75,miss),0);
  assert.equal(sampleProxyProjectileHits(stump,1,3,1,certain),1);
  assert.equal(sampleProxyProjectileHits(scatter,1,30,1,()=>.5),1);
});
test('power/pellet research opt-in maintains deterministic legacy and reports voltage',()=>{
  const s={name:'fidelity',maxSeconds:2,accuracy:.7,physicalEquipment:true};
  const a=runBout(909,s);assert.deepEqual(a,runBout(909,s));
  assert.match(a.simulation,/v3-pellets-power/);
  assert.equal(a.actors.length,6);
  assert.ok(a.actors.every(x=>x.minBusRatio>=0&&x.minBusRatio<=1));
  assert.equal(runBout(909,{...s,physicalEquipment:false}).simulation,'research-approximate-v2');
});
test('a starter garage owns one legal complete rig; no phantom catalog modules',()=>{
  const legal=runRosterBalanceAudit().combinations.filter(x=>x.ready);
  const inv=makeStarterAssembly().owned;
  assert.equal(inv.length,5);
  assert.equal(packFleet(inv,legal).length,1);
});
test('campaign sequences are seeded repeatable and honor scarce economics',()=>{
  const opt={seed:1201,contracts:3,assumptions:CASES['middle-scrap-limited']};
  const a=simulateCampaign(opt);
  assert.deepEqual(a,simulateCampaign(opt));
  assert.equal(a.history.length,3);
  assert.ok(a.purchases<=3);
  assert.ok(a.peakFleet<=3);
  assert.ok(a.history.every(x=>x.credits>=0));
  assert.ok(a.owned>=5);
});
test('campaign aggregate cohorts differentiate salvage eligibility without invented wins',()=>{
  const r=runCampaignScenarios({seeds:2,contracts:3});
  assert.equal(r.cases.length,Object.keys(CASES).length);
  assert.equal(r.scenarioRuns,12);
  assert.ok(r.cases.every(c=>c.pctThreeRigs>=0&&c.pctThreeRigs<=100));
});
