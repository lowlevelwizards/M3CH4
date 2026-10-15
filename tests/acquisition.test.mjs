import test from 'node:test';
import assert from 'node:assert/strict';
import { createTargetCondition, makeRangeTarget } from '../combat.js';
import { equip, makeTestAssembly } from '../components.js';
import { createFunctionalDamage } from '../functionalDamage.js';
import {
    makeStarterAssembly, recoverSalvage, salvageOffer,
    STARTER_DEFINITION_IDS,
} from '../acquisition.js';
import { decodeMachine, encodeMachine, MACHINE_SAVE_VERSION } from '../persistence.js';

test('fresh ownership contains only the five physical starter modules', () => {
    const assembly = makeStarterAssembly();
    assert.equal(assembly.owned.length, STARTER_DEFINITION_IDS.length);
    assert.deepEqual(
        assembly.owned.map(part => part.definitionId),
        STARTER_DEFINITION_IDS,
    );
    assert.equal(Object.keys(assembly.installed).length, 5);
});

test('first enemy salvage is a fitted unowned component with real recovered condition', () => {
    const player = makeStarterAssembly();
    const target = makeRangeTarget();
    const condition = createTargetCondition(target);
    condition.parts.combat.integrity = condition.parts.combat.maxIntegrity * .4;
    condition.parts.combat.armor = 0;
    const offer = salvageOffer(player, target, condition);
    assert.ok(offer);
    assert.equal(offer.slot, 'combat');
    assert.equal(offer.definitionId, 'gun-short');
    assert.ok(offer.condition > 0 && offer.condition < .5);
    assert.ok(offer.recoveryFee > 0);
});

test('recovering salvage adds one unique owned part and advances the next offer', () => {
    const player = makeStarterAssembly();
    const target = makeRangeTarget();
    const condition = createTargetCondition(target);
    const first = salvageOffer(player, target, condition);
    const recovered = recoverSalvage(player, first);
    assert.equal(recovered.ok, true);
    assert.equal(recovered.instance.serial, 'REC-0001');
    assert.equal(player.owned.some(part => part.definitionId === 'gun-short'), true);
    assert.equal(salvageOffer(player, target, condition)?.definitionId, 'power-air');
});

test('v4 sandbox saves migrate to starter ownership plus currently fitted alternatives', () => {
    const legacy = makeTestAssembly();
    equip(legacy, 'mobility', 'legs-compact');
    equip(legacy, 'combat', 'gun-short');
    const legacyState = {
        assembly: legacy,
        damage: createFunctionalDamage(),
        playerCondition: createTargetCondition(legacy, true),
        economy: { credits: 1337 },
    };
    const payload = JSON.parse(encodeMachine(legacyState));
    payload.version = 4;
    const migrated = decodeMachine(JSON.stringify(payload));
    assert.equal(migrated.status, 'migrated');
    assert.equal(migrated.economy.credits, 1337);
    const owned = new Set(migrated.assembly.owned.map(part => part.definitionId));
    for (const id of STARTER_DEFINITION_IDS) assert.equal(owned.has(id), true, id);
    assert.equal(owned.has('legs-compact'), true);
    assert.equal(owned.has('gun-short'), true);
    assert.equal(owned.has('legs-hauler'), false);
    assert.equal(owned.has('power-air'), false);
    assert.equal(migrated.assembly.installed.mobility, legacy.installed.mobility);
    assert.equal(migrated.assembly.installed.combat, legacy.installed.combat);
});

test('v5 round-trip preserves recovered serial and condition', () => {
    const state = decodeMachine(null);
    const target = makeRangeTarget();
    const condition = createTargetCondition(target);
    condition.parts.combat.integrity = 30;
    condition.parts.combat.armor = 0;
    const offer = salvageOffer(state.assembly, target, condition);
    const recovered = recoverSalvage(state.assembly, offer);
    assert.equal(recovered.ok, true);
    state.economy.credits = 777;
    const encoded = JSON.parse(encodeMachine(state));
    assert.equal(encoded.version, MACHINE_SAVE_VERSION);
    const restored = decodeMachine(JSON.stringify(encoded));
    assert.equal(restored.status, 'restored');
    const part = restored.assembly.owned.find(item => item.serial === 'REC-0001');
    assert.ok(part);
    assert.equal(part.definitionId, 'gun-short');
    assert.equal(part.condition, recovered.instance.condition);
    assert.equal(restored.economy.credits, 777);
});
