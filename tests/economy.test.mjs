import test from 'node:test';
import assert from 'node:assert/strict';
import { createEconomyState, repairQuote, settleSortie, STARTING_CREDITS, totalRepairQuote } from '../economy.js';
import { decodeMachine, encodeMachine, MACHINE_SAVE_VERSION } from '../persistence.js';

test('fresh recovery wallet starts small but fieldable', () => {
    assert.deepEqual(createEconomyState(), { credits: STARTING_CREDITS });
});

test('victory pays contract minus only rounds actually fired', () => {
    const result = settleSortie({ credits: 600, victory: true, roundsFired: 17, repairEstimate: 123 });
    assert.equal(result.grossPayout, 850);
    assert.equal(result.ammoCost, 17);
    assert.equal(result.netPayout, 833);
    assert.equal(result.creditsAfter, 1433);
    assert.equal(result.repairEstimate, 123);
});

test('defeat still provides recovery money instead of soft-locking the save', () => {
    const result = settleSortie({ credits: 0, victory: false, roundsFired: 40 });
    assert.equal(result.grossPayout, 350);
    assert.equal(result.creditsAfter, 310);
    assert.ok(result.creditsAfter > 0);
});

test('repair quote responds to actual missing armor and integrity', () => {
    const mobility = {
        slot: 'mobility', integrity: 90, maxIntegrity: 150, armor: 8, maxArmor: 38,
    };
    assert.equal(repairQuote(mobility), 68);
    assert.equal(repairQuote({ ...mobility, integrity: 150, armor: 38 }), 0);
    assert.equal(totalRepairQuote({ parts: { mobility } }), 68);
});

test('v3 saves migrate with their machine intact and receive the starter wallet', () => {
    const fresh = decodeMachine(null);
    const encoded = JSON.parse(encodeMachine(fresh));
    encoded.version = 3;
    delete encoded.economy;
    const migrated = decodeMachine(JSON.stringify(encoded));
    assert.equal(migrated.status, 'migrated');
    assert.equal(migrated.economy.credits, STARTING_CREDITS);
    assert.equal(migrated.assembly.serial, fresh.assembly.serial);
    assert.deepEqual(migrated.assembly.installed, fresh.assembly.installed);
});

test('current saves round-trip credits on the new rollback-safe format', () => {
    const fresh = decodeMachine(null);
    fresh.economy.credits = 1427;
    const payload = JSON.parse(encodeMachine(fresh));
    assert.equal(payload.version, MACHINE_SAVE_VERSION);
    assert.equal(payload.economy.credits, 1427);
    const restored = decodeMachine(JSON.stringify(payload));
    assert.equal(restored.status, 'restored');
    assert.equal(restored.economy.credits, 1427);
});
