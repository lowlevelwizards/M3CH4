import test from 'node:test';
import assert from 'node:assert/strict';
import {runPhysicalEvidence,simulateHeavyGenerator} from '../research/loadoutPhysicalEvidence.mjs';

test('Forge and Dynamo are compared on exactly the same legal heavy chassis',()=>{
  const d=simulateHeavyGenerator('power-dynamo','burst');
  const f=simulateHeavyGenerator('power-forge','burst');
  assert.equal(f.kg-d.kg,170);
  assert.equal(f.nominalCapacityKw,170);
  assert.equal(d.nominalCapacityKw,145);
  for(const c of [d,f])assert.ok(c.minBus>=0&&c.minBus<=1);
});
test('physical shells count distinct actual mesh rays not one S6 impact',()=>{
  const report=runPhysicalEvidence();
  assert.equal(report.weapon.rows.length,24);
  for(const r of report.weapon.rows)
    assert.equal(r.firedProjectiles,r.shells*(r.weapon==='gun-scatter'?6:1));
  assert.equal(report.power.rows.length,40);
  const s3=report.weapon.rows.find(r=>r.weapon==='gun-scatter'&&r.rangeM===3);
  const s30=report.weapon.rows.find(r=>r.weapon==='gun-scatter'&&r.rangeM===30);
  assert.ok(s3.struckProjectiles>s30.struckProjectiles);
});
