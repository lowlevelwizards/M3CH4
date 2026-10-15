import test from 'node:test';
import assert from 'node:assert/strict';
import { createTargetCondition, makeRangeTarget } from '../combat.js';
import { recoverSalvage, salvageOffer } from '../acquisition.js';
import { selectContract, selectedContract } from '../contracts.js';
import { decodeMachine, encodeMachine, loadMachine, storeMachine } from '../persistence.js';
import {
    CIRCUIT_ORDER, circuitSummary, createProgressionState, isContractUnlocked,
    loadProgression, recordContractClear, storeProgression,
} from '../progression.js';

function fakeStorage(initial = {}) {
    const values = new Map(Object.entries(initial));
    return {
        getItem: key => values.has(key) ? values.get(key) : null,
        setItem: (key, value) => values.set(key, String(value)),
        dump: () => Object.fromEntries(values),
    };
}

test('fresh scrapyard circuit exposes only Yard Dog and unlocks in order', () => {
    const progression = createProgressionState();
    assert.deepEqual(progression.unlockedContracts, ['yard-dog']);
    assert.deepEqual(progression.clearedContracts, []);
    assert.equal(isContractUnlocked(progression, 'cutter'), false);

    const yard = recordContractClear(progression, 'yard-dog');
    assert.equal(yard.firstClear, true);
    assert.equal(yard.unlockedContractId, 'cutter');
    assert.equal(isContractUnlocked(progression, 'cutter'), true);

    const replay = recordContractClear(progression, 'yard-dog');
    assert.equal(replay.firstClear, false);
    assert.equal(replay.unlockedContractId, null);
    assert.deepEqual(progression.clearedContracts, ['yard-dog']);

    const cutter = recordContractClear(progression, 'cutter');
    assert.equal(cutter.unlockedContractId, 'mule');
    const mule = recordContractClear(progression, 'mule');
    assert.equal(mule.circuitCleared, true);
    assert.deepEqual(circuitSummary(progression), { clearedCount: 3, total: 3, complete: true });
});

test('contract selection rejects locked fights when progression is supplied', () => {
    const session = fakeStorage();
    const progression = createProgressionState();
    const locked = selectContract('cutter', session, progression);
    assert.equal(locked.ok, false);
    assert.equal(locked.reason, 'CONTRACT LOCKED');
    assert.equal(selectedContract(session, progression).id, 'yard-dog');

    recordContractClear(progression, 'yard-dog');
    const opened = selectContract('cutter', session, progression);
    assert.equal(opened.ok, true);
    assert.equal(selectedContract(session, progression).id, 'cutter');
});

test('pre-k3h machine saves retain access to the whole existing roster', () => {
    const storage = fakeStorage({ 'mech-arena-machine-v5': '{legacy-save-present}' });
    const progression = loadProgression(storage);
    assert.deepEqual(progression.unlockedContracts, [...CIRCUIT_ORDER]);
    assert.deepEqual(progression.clearedContracts, []);
});

test('v5 real ownership migrates to v6 without rejecting recovered serials', () => {
    const state = decodeMachine(null);
    const target = makeRangeTarget();
    const condition = createTargetCondition(target);
    condition.parts.combat.integrity = 35;
    condition.parts.combat.armor = 0;
    const offer = salvageOffer(state.assembly, target, condition);
    const recovered = recoverSalvage(state.assembly, offer);
    assert.equal(recovered.ok, true);

    const payload = JSON.parse(encodeMachine(state));
    payload.version = 5;
    delete payload.progression;
    const migrated = decodeMachine(JSON.stringify(payload));
    assert.equal(migrated.status, 'migrated');
    const part = migrated.assembly.owned.find(item => item.serial === recovered.instance.serial);
    assert.ok(part);
    assert.equal(part.definitionId, recovered.instance.definitionId);
    assert.deepEqual(migrated.progression.unlockedContracts, [...CIRCUIT_ORDER]);
});

test('legacy gameplay save calls preserve progression already stored in v6', () => {
    const storage = fakeStorage();
    const state = decodeMachine(null);
    assert.equal(storeMachine(storage, state), true);

    const progression = loadProgression(storage);
    recordContractClear(progression, 'yard-dog');
    assert.equal(storeProgression(progression, storage), true);

    const legacyCallerState = {
        assembly: state.assembly,
        damage: state.damage,
        playerCondition: state.playerCondition,
        economy: state.economy,
    };
    assert.equal(storeMachine(storage, legacyCallerState), true);
    const restored = loadMachine(storage);
    assert.deepEqual(restored.progression.clearedContracts, ['yard-dog']);
    assert.equal(isContractUnlocked(restored.progression, 'cutter'), true);
});
