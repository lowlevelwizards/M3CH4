import test from 'node:test';
import assert from 'node:assert/strict';
import { runBalanceMechanicalCohorts, formatBalanceMechanicalCohorts } from '../research/balanceMechanicalCohorts.mjs';

test('actual hardware, damage and obstacle cohorts stay repeatable and separated from mesh claims', () => {
    const report = runBalanceMechanicalCohorts();
    assert.equal(report.sampleHz, 60);
    assert.equal(report.namedRecipes.length, 8);
    assert.equal(report.cohorts.length, 32);
    assert.deepEqual(report, runBalanceMechanicalCohorts());
    assert.match(report.restrictions, /no real Three\.js hits/);
    assert.match(formatBalanceMechanicalCohorts(report), /Deterministic|deterministic/);
    for (const x of report.cohorts) {
        if (!x.legal) {
            assert.ok(x.reasons?.length, x.name);
            assert.equal(x.runs, undefined);
            continue;
        }
        assert.ok(x.massKg > 0 && x.headroomKw >= 0, x.name);
        assert.equal(x.power.length, 3);
        assert.ok(x.runs.brace1s.braceFrames > 0, x.name);
        assert.ok(x.runs.brakeAndSteer.braceFraction === 0, x.name);
        assert.equal(x.runs.wallContact.outsideObstacle, true, x.name);
        assert.equal(x.runs.wallReverseRecovery.outsideObstacle, true, x.name);
        for (const [scenario, r] of Object.entries(x.runs))
            for (const [key,value] of Object.entries(r)) if (typeof value === 'number')
                assert.ok(Number.isFinite(value), x.name + '/' + scenario + '/' + key);
        for (const p of x.power) {
            assert.ok(p.minBus >= 0 && p.minBus <= 1);
            assert.ok(p.endReserve >= 0 && p.endReserve <= 1);
            assert.ok(p.ammoSpent >= 0);
            assert.ok(p.shots <= p.ammoSpent);
        }
    }
});

test('damage derates actual movement and braking does not erase momentum or invent shielding', () => {
    const byName = Object.fromEntries(runBalanceMechanicalCohorts().cohorts.map(r => [r.name,r]));
    for (const name of ['workhorse', 'precision', 'anchor', 'raider', 'protected']) {
        const fresh = byName[name], damaged = byName[name+':worn'];
        assert.equal(fresh.legal, true, name);
        assert.equal(damaged.legal, true, name);
        assert.ok(damaged.runs.launch1s.distanceM < fresh.runs.launch1s.distanceM,
            name + ' drives must lose forward authority under real damage');
        assert.ok(byName[name+':damaged-power'].runs.launch1s.distanceM <
            fresh.runs.launch1s.distanceM,
            name + ' generator damage must affect propulsion');
        assert.ok(fresh.runs.brake1s.speedMps < 5, name);
        assert.ok(fresh.runs.recoilBraced.distanceM <= fresh.runs.recoilHalfSecond.distanceM,
            name + ' planted recoil must be less displacement than unbraced');
    }
    const light = byName.precision.runs, heavy = byName.anchor.runs;
    assert.ok(light.launch1s.distanceM > heavy.launch1s.distanceM);
    assert.ok(light.movingSteer1s.headingDeg > heavy.movingSteer1s.headingDeg);
});
