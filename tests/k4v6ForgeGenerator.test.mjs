import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG, BY_ID, makeTestAssembly, equip, inspectAssembly,
    installedPart, setGeneratorMount, generatorMount } from '../components.js';
import { makeStarterAssembly } from '../acquisition.js';
import { createPowerSystem, powerProfile, advancePowerSystem } from '../powerDynamics.js';
import { basePartValue } from '../partEconomy.js';
import { encodeMachine,decodeMachine } from '../persistence.js';
import { runRosterBalanceAudit } from '../research/rosterBalanceAudit.mjs';

const legacy= ['frame-sr','legs-yard','legs-hauler','power-dynamo','cab-cyclops','cab-armored',
    'gun-cannon','gun-short','frame-utility','legs-compact','power-air','cab-utility',
    'gun-light','frame-wedge','gun-scatter'];
test('Forge is the sixteenth appended serial definition, not free starter inventory',()=>{
    assert.deepEqual(CATALOG.slice(0,15).map(x=>x.id),legacy);
    assert.equal(CATALOG[15].id,'power-forge');
    assert.equal(makeTestAssembly().owned[15].serial,'SR01-016');
    assert.equal(makeTestAssembly().owned[15].definitionId,'power-forge');
    assert.equal(makeStarterAssembly().owned.length,5);
    assert.ok(!makeStarterAssembly().owned.some(p=>p.definitionId==='power-forge'));
    assert.ok(!decodeMachine(null).assembly.owned.some(p=>p.definitionId==='power-forge'));
    assert.equal(BY_ID.get('power-forge').massKg,680);
    assert.equal(BY_ID.get('power-forge').powerKw,170);
    assert.ok(basePartValue('power-forge')>basePartValue('power-dynamo'));
});
test('real heavy load constraints still forbid overweight or poorly powered configurations',()=>{
    const a=makeTestAssembly();
    equip(a,'mobility','legs-hauler');
    equip(a,'command','cab-armored');
    equip(a,'combat','gun-light');
    const underpowered=inspectAssembly(a);assert.equal(underpowered.ready,false);
    equip(a,'power','power-forge');
    const enabled=inspectAssembly(a);
    assert.equal(enabled.ready,true,JSON.stringify(enabled.checks));
    assert.equal(enabled.powerAvailableKw,170);
    assert.equal(enabled.powerUsedKw,154);
    assert.equal(enabled.adapters[0].massKg,110);
    assert.equal(enabled.massKg,4605);
    const baseline=runRosterBalanceAudit();
    assert.equal(baseline.summary.definitions,CATALOG.length);
    assert.equal(baseline.summary.total,baseline.combinations.length);
    const originalGuns=new Set(CATALOG.slice(0,16).filter(p=>p.slot==='combat').map(p=>p.id));
    const legacy=baseline.combinations.filter(row=>originalGuns.has(row.recipe.combat));
    assert.equal(legacy.length,324,'historic pre-expansion combinations remain represented');
    assert.equal(legacy.filter(row=>row.ready).length,237,'new gun does not change historic build legality');
});
test('Forge remains a finite slow-response electrical machine using shared actuator rules',()=>{
    const a=makeTestAssembly();equip(a,'power','power-forge');
    const forged=powerProfile(a);const dynamo=powerProfile(makeTestAssembly());
    assert.ok(forged.responseSeconds>dynamo.responseSeconds);
    assert.ok(forged.reserveKJ<dynamo.reserveKJ);
    assert.ok(forged.rechargeKw<dynamo.rechargeKw);
    const rig={driveLoad:1};const power=createPowerSystem(a);
    for(let i=0;i<180;i++)advancePowerSystem(power,a,rig,1/60,1);
    assert.ok(power.generationKw<=170);
    assert.ok(power.reserveKJ>=0&&power.reserveKJ<=forged.reserveKJ);
    assert.ok(power.busRatio>=0&&power.busRatio<=1);
});
test('standard and optional real 85 kg bracket stay mount-auditable',()=>{
    const a=makeTestAssembly();equip(a,'power','power-forge');
    assert.equal(generatorMount(a),'standard');
    const placed=setGeneratorMount(a,'offset');
    assert.equal(placed.ok,true,placed.reason);
    assert.equal(generatorMount(a),'offset');
    assert.ok(inspectAssembly(a).ready);
    assert.ok(inspectAssembly(a).adapters.some(x=>x.massKg===85));
});
test('old serialized inventory stays valid without a Forge; new owned Forge preserves serial on restore',()=>{
    const raw=decodeMachine(null);
    assert.ok(!raw.assembly.owned.some(p=>p.definitionId==='power-forge'));
    const save=encodeMachine(raw);
    assert.ok(!decodeMachine(save).assembly.owned.some(p=>p.definitionId==='power-forge'));
    const owned=makeTestAssembly();
    const installed=installedPart(owned,'power');
    assert.equal(installed.definition.id,'power-dynamo');
});
