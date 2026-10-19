import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG, inspectAssembly, makeTestAssembly } from '../components.js';
import { WEAPONS } from '../combat.js';
import { runPartIdentityBaseline, buildMeasuredAssembly, formatPartIdentityBaseline } from '../research/partIdentityBaseline.mjs';

// The original owned serial order is migration-sensitive. Future additions may append.
const LEGACY_IDS = [
    'frame-sr','legs-yard','legs-hauler','power-dynamo','cab-cyclops',
    'cab-armored','gun-cannon','gun-short','frame-utility','legs-compact',
    'power-air','cab-utility','gun-light','frame-wedge',
];

test('first fourteen catalogue identities and factory serials remain stable', () => {
    assert.deepEqual(CATALOG.slice(0, LEGACY_IDS.length).map(x => x.id), LEGACY_IDS);
    assert.equal(new Set(CATALOG.map(x => x.id)).size, CATALOG.length);
    assert.deepEqual(makeTestAssembly().owned.slice(0, 14).map(x => x.definitionId), LEGACY_IDS);
});

test('bounded baseline has legal comparisons and reports illegality rather than simulating parked rigs', () => {
    const report = runPartIdentityBaseline();
    assert.equal(report.hz, 60);
    assert.equal(report.mechanical.length, 27);
    assert.equal(report.powerAndCab.length, 18);
    for (const family of ['legs-yard','legs-compact','legs-hauler']) {
        assert.ok(report.mechanical.some(x => x.ready && x.legs === family), family + ' must have a legal sample');
    }
    for (const frame of ['frame-sr','frame-utility','frame-wedge']) {
        assert.ok(report.mechanical.some(x => x.ready && x.frame === frame), frame + ' must have a legal sample');
    }
    for (const weapon of Object.keys(WEAPONS))
        assert.ok(report.mechanical.some(x => x.ready && x.gun === weapon), weapon + ' must have a legal sample');
    for (const x of report.mechanical) {
        if (!x.ready) {
            assert.ok(x.reasons.length > 0, 'reject with a source-of-truth reason');
            assert.equal(x.recoil, undefined, 'no fake metrics for non-deployable combinations');
            continue;
        }
        for (const value of [x.massKg,x.speedAfterOneSecondMps,x.distanceAfterOneSecondM,
            x.strafeAfterOneSecondMps,x.brakeFromFiveMpsDistanceM,x.turnNinetySeconds,
            x.recoil.impulseVelocityMps,x.recoil.impulseYawRateRadS,x.recoil.driftAfterHalfSecondM])
            assert.ok(Number.isFinite(value) && value >= 0, JSON.stringify(x));
    }
    assert.ok(report.mechanical.some(x => !x.ready), 'known overweight / power-starved cases must remain visible');
    assert.match(formatPartIdentityBaseline(report), /NOT a warehouse/);
});

test('known Hauler + Draft power mismatch is blocked by real inspection', () => {
    const { assembly, inspection } = buildMeasuredAssembly({
        mobility: 'legs-hauler', power: 'power-air', combat: 'gun-short',
    });
    assert.equal(inspectAssembly(assembly).ready, false);
    assert.equal(inspection.ready, false);
    assert.ok(inspection.powerUsedKw > inspection.powerAvailableKw);
});

test('measurement report is bit-for-bit repeatable with current 60Hz authoritative functions', () => {
    const first = runPartIdentityBaseline();
    const second = runPartIdentityBaseline();
    assert.deepEqual(first, second);
    for (const cycle of Object.values(first.weapons)) {
        assert.ok(cycle.shotsInEightSeconds > 0);
        assert.ok(cycle.shotsInEightSeconds <= cycle.magazine + cycle.reserve);
        assert.ok(cycle.loaded >= 0 && cycle.reserve >= 0);
    }
});
