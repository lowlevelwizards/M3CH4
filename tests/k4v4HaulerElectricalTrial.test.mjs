import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG, makeTestAssembly, equip, inspectAssembly } from '../components.js';
import { runHaulerElectricalTrial } from '../research/haulerElectricalTrial.mjs';
import { simulatePowerProfile } from '../research/powerResponseStudy.mjs';

test('110 kW Hauler expands legal assemblies without admitting Draft heavy rigs',()=>{
    assert.equal(CATALOG.find(p=>p.id==='legs-hauler').powerKw,-110);
    const matrix=runHaulerElectricalTrial();
    assert.deepEqual(matrix.candidates.map(r=>r.drawKw),[115,110,105]);
    assert.ok(matrix.candidates[0].totalLegal >= 229);
    assert.ok(matrix.candidates[1].totalLegal >= 237);
    assert.ok(matrix.candidates[2].totalLegal >= 239);
    assert.ok(matrix.candidates.every(r=>r.haulerLegal>0&&r.haulerLegal<r.totalLegal));
    assert.ok(matrix.candidates[0].haulerLegal < matrix.candidates[1].haulerLegal);
    assert.ok(matrix.candidates[1].haulerLegal <= matrix.candidates[2].haulerLegal);
    assert.ok(matrix.candidates[0].totalLegal < matrix.candidates[1].totalLegal);
    assert.ok(matrix.candidates[1].totalLegal <= matrix.candidates[2].totalLegal);
    const rig=makeTestAssembly();
    equip(rig,'mobility','legs-hauler');
    equip(rig,'combat','gun-light');
    const result=inspectAssembly(rig);
    assert.equal(result.ready,true);
    assert.equal(result.powerUsedKw,142);
    assert.equal(result.powerAvailableKw,145);
    equip(rig,'power','power-air');
    assert.equal(inspectAssembly(rig).ready,false);
});
test('generator transients remain real and repeatable after Hauler rating change',()=>{
    const draft=simulatePowerProfile('power-air','sustained');
    const dynamo=simulatePowerProfile('power-dynamo','sustained');
    assert.ok(draft.nominalKw<=draft.capacityKw);
    assert.ok(dynamo.nominalKw<=dynamo.capacityKw);
    assert.deepEqual(draft,simulatePowerProfile('power-air','sustained'));
    assert.deepEqual(dynamo,simulatePowerProfile('power-dynamo','sustained'));
});
