import test from 'node:test';
import assert from 'node:assert/strict';
import {
    WEAPONS,
    applyTargetHit,
    createTargetCondition,
    makeRangeTarget,
} from '../combat.js';
import { hostileMissionKillReason } from '../hostileRig.js';

const EXPECTED = Object.freeze({
    'gun-cannon': Object.freeze({ structure: 14, critical: 8, kestrel: 8, yard: 10, hauler: 13 }),
    'gun-short': Object.freeze({ structure: 11, critical: 7, kestrel: 7, yard: 8, hauler: 11 }),
    'gun-light': Object.freeze({ structure: 18, critical: 11, kestrel: 11, yard: 13, hauler: 18 }),
});

function shotsToMissionKill(spec, slot) {
    const condition = createTargetCondition(makeRangeTarget('yard-dog'));
    let shots = 0;
    while (!hostileMissionKillReason(condition) && shots < 100) {
        applyTargetHit(condition, slot, spec.damage);
        shots++;
    }
    return shots;
}

function shotsToMobilityZero(spec, contractId) {
    const condition = createTargetCondition(makeRangeTarget(contractId));
    let shots = 0;
    while (condition.parts.mobility.integrity > 0 && shots < 100) {
        applyTargetHit(condition, 'mobility', spec.damage);
        shots++;
    }
    return shots;
}

function perfectHoldSeconds(shots, spec) {
    const triggerTime = Math.max(0, shots - 1) / spec.roundsPerSecond;
    const reloads = Math.floor(Math.max(0, shots - 1) / spec.magazine);
    return triggerTime + reloads * spec.reloadSeconds;
}

test('critical systems require about three seconds of perfect focused fire', () => {
    for (const id of Object.keys(EXPECTED)) {
        const spec=WEAPONS[id];
        const expected = EXPECTED[id].critical;
        for (const slot of ['power', 'command', 'combat']) {
            const shots = shotsToMissionKill(spec, slot);
            const seconds = perfectHoldSeconds(shots, spec);
            assert.equal(shots, expected, `${spec.label} ${slot} shot count`);
            assert.ok(seconds >= 2.75 && seconds <= 3.15,
                `${spec.label} ${slot} should take about three seconds, got ${seconds.toFixed(2)}`);
        }
    }
});

test('fresh frame kills exceed every current magazine and land in the seven-to-eight second envelope', () => {
    for (const id of Object.keys(EXPECTED)) {
        const spec=WEAPONS[id];
        const shots = shotsToMissionKill(spec, 'structure');
        const seconds = perfectHoldSeconds(shots, spec);
        assert.equal(shots, EXPECTED[id].structure, `${spec.label} frame shot count`);
        assert.ok(shots > spec.magazine, `${spec.label} must reload before a fresh frame kill`);
        assert.ok(seconds >= 7 && seconds <= 8.1,
            `${spec.label} frame kill should take 7-8 seconds of perfect held fire, got ${seconds.toFixed(2)}`);
    }
});

test('fresh critical housings absorb several hits before internal damage begins', () => {
    for (const id of Object.keys(EXPECTED)) {
        const spec=WEAPONS[id];
        const condition = createTargetCondition(makeRangeTarget('yard-dog'));
        for (let shot = 1; shot <= 3; shot++) {
            const hit = applyTargetHit(condition, 'combat', spec.damage);
            assert.equal(hit.internalDamage, 0,
                `${spec.label} should still be working through weapon housing on shot ${shot}`);
        }
    }
});

test('mobility durability preserves Kestrel < Yardwalker < Hauler and makes Hauler require a reload', () => {
    for (const id of Object.keys(EXPECTED)) {
        const spec=WEAPONS[id];
        const kestrel = shotsToMobilityZero(spec, 'cutter');
        const yard = shotsToMobilityZero(spec, 'yard-dog');
        const hauler = shotsToMobilityZero(spec, 'mule');
        const expected = EXPECTED[id];

        assert.equal(kestrel, expected.kestrel, `${spec.label} Kestrel shot count`);
        assert.equal(yard, expected.yard, `${spec.label} Yardwalker shot count`);
        assert.equal(hauler, expected.hauler, `${spec.label} Hauler shot count`);
        assert.ok(kestrel < yard && yard < hauler, `${spec.label} mobility hierarchy`);
        assert.ok(hauler > spec.magazine, `${spec.label} must reload to fully destroy fresh Hauler mobility`);
    }
});
