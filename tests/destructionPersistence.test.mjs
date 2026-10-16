import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeMachine, encodeMachine, MACHINE_SAVE_VERSION } from '../persistence.js';
import { destructionThreshold } from '../damageFate.js';

test('v7 round trip preserves rebuild-required owned hardware fate', () => {
    const state = decodeMachine(null);
    const part = state.playerCondition.parts.mobility;
    part.integrity = 0;
    part.armor = 0;
    part.destroyed = true;
    part.destruction = destructionThreshold(part);
    const serial = part.serial;
    const owned = state.assembly.owned.find(item => item.serial === serial);
    owned.condition = 0;
    owned.destroyed = true;

    const payload = JSON.parse(encodeMachine(state));
    assert.equal(payload.version, MACHINE_SAVE_VERSION);
    assert.equal(payload.housing.mobility.destroyed, true);
    const restored = decodeMachine(JSON.stringify(payload));
    assert.equal(restored.status, 'restored');
    assert.equal(restored.playerCondition.parts.mobility.destroyed, true);
    assert.equal(restored.assembly.owned.find(item => item.serial === serial).destroyed, true);
});

test('v6 migration treats all old hardware as not destroyed', () => {
    const state = decodeMachine(null);
    const payload = JSON.parse(encodeMachine(state));
    payload.version = 6;
    for (const part of payload.assembly.owned) delete part.destroyed;
    for (const housing of Object.values(payload.housing)) {
        delete housing.destroyed;
        delete housing.destruction;
    }
    const migrated = decodeMachine(JSON.stringify(payload));
    assert.equal(migrated.status, 'migrated');
    assert.equal(Object.values(migrated.playerCondition.parts).some(part => part.destroyed), false);
    assert.equal(migrated.assembly.owned.some(part => part.destroyed), false);
});
