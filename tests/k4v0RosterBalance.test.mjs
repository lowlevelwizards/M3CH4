import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CATALOG, SLOTS } from '../components.js';
import { runRosterBalanceAudit, compareRosterBalanceAudits,
    recipeKey, formatRosterBalanceAudit } from '../research/rosterBalanceAudit.mjs';

const fixture = JSON.parse(readFileSync(new URL('../research/baselines/roster-build6-forge.json', import.meta.url), 'utf8'));

test('rebalanced catalogue preserves the original October 22 identities', () => {
    assert.deepEqual(CATALOG.slice(0, fixture.originalIds.length).map(p => p.id), fixture.originalIds);
    assert.equal(new Set(CATALOG.map(p => p.id)).size, CATALOG.length);
    assert.ok(CATALOG.length>=fixture.expected.definitions,'dated fixture covers the sixteen original definitions');
});

test('all live five-module recipes produce the recomputed 324 / 237 / 87 power legality', () => {
    const report = runRosterBalanceAudit(), s = report.summary;
    assert.equal(s.definitions, CATALOG.length);
    const legacy = report.combinations.filter(row => row.recipe.combat !== 'gun-rivet');
    assert.equal(legacy.length, fixture.expected.total, 'original 324 configurations are preserved');
    assert.equal(legacy.filter(row=>row.ready).length, fixture.expected.legal,'original 237 legal recipes remain legal');
    assert.equal(legacy.filter(row=>!row.ready).length, fixture.expected.rejected);
    assert.equal(s.total, report.combinations.length);
    assert.equal(s.legal+s.rejected,s.total);
    assert.ok(s.total>fixture.expected.total,'appended weapon adds combinations');
    assert.equal(report.combinations.length, s.total);
    assert.equal(new Set(report.combinations.map(row => row.key)).size, s.total);
    for (const [id, expected] of Object.entries(fixture.expected.mobilityLegal))
        assert.equal(legacy.filter(row=>row.ready&&row.recipe.mobility===id).length,expected,id);
    for (const slot of SLOTS)
        assert.equal(Object.values(s.bySlot[slot]).reduce((n, row) => n + row.total, 0), s.total);
});

test('the first-hit mounting and eligibility authority is inspected, not simulated', () => {
    const report = runRosterBalanceAudit();
    const get = (slot, id) => report.combinations.filter(row => row.recipe[slot] === id);
    for (const row of report.combinations) {
        assert.equal(row.key, recipeKey(row.recipe));
        assert.ok(row.baseYardValueCredits > 0);
        if (row.ready) {
            assert.deepEqual(row.reasons, [], row.key);
            assert.equal(row.mountingValid, true, row.key);
            assert.ok(row.massKg > 0, row.key);
            assert.ok(row.structuralLoadMarginKg >= 0, row.key);
            assert.ok(row.mobilityLoadMarginKg >= 0, row.key);
            assert.ok(row.nominalPowerHeadroomKw >= 0, row.key);
            assert.equal(row.adapters.reduce((sum, adapter) => sum + adapter.massKg, 0),
                row.recipe.mobility === 'legs-hauler' ? 110 : 0);
        } else {
            assert.ok(row.reasons.length > 0, row.key + ': missing failure reason');
            assert.ok(row.reasons.every(r => r.check && r.reason), row.key);
            assert.equal(row.speedAfterOneSecondMps, undefined);
            assert.equal(row.combatWinRate, undefined);
        }
    }
    assert.equal(get('mobility', 'legs-hauler').filter(row=>row.recipe.combat!=='gun-rivet').length,108);
    assert.ok(report.combinations.some(row => !row.ready &&
        row.reasons.some(r => r.check === 'power')));
    assert.ok(report.combinations.some(row => !row.ready &&
        row.reasons.some(r => r.check === 'structure' || r.check === 'mobility')));
});

test('fixed named reference builds are legal and preserve real installed constraints', () => {
    const report = runRosterBalanceAudit();
    assert.equal(Object.keys(report.references).length, 5);
    for (const [name, row] of Object.entries(report.references)) {
        assert.equal(row.ready, true, name + ' ' + JSON.stringify(row.reasons));
        assert.ok(row.massKg > 0, name);
        assert.ok(row.headroomKw >= 0, name);
    }
    const hauler = report.combinations.find(row =>
        row.recipe.structure === 'frame-wedge' &&
        row.recipe.mobility === 'legs-hauler' &&
        row.recipe.power === 'power-dynamo' &&
        row.recipe.command === 'cab-cyclops' &&
        row.recipe.combat === 'gun-short');
    assert.equal(hauler.ready, true);
    assert.equal(hauler.adapters.length, 1);
    assert.equal(hauler.adapters[0].id, 'hip-h2-u1');
    assert.equal(hauler.massKg, 4240);
    assert.match(formatRosterBalanceAudit(report), /Not evidence|NOT evidence|renderer mesh shielding/);
});

test('baseline JSON is deterministic and comparison highlights true legality changes', () => {
    const original = runRosterBalanceAudit();
    assert.deepEqual(original, runRosterBalanceAudit());
    const next = structuredClone(original);
    const candidate = next.combinations.find(row => row.ready);
    candidate.ready = false;
    candidate.massKg += 10;
    next.summary.legal -= 1;
    next.summary.rejected += 1;
    const change = compareRosterBalanceAudits(original, next);
    assert.deepEqual(change.legalityChanged, [{ key: candidate.key, from: true, to: false }]);
    assert.ok(change.numericsChanged.some(row =>
        row.key === candidate.key && row.field === 'massKg' && row.to === candidate.massKg));
    assert.deepEqual(change.added, []);
    assert.deepEqual(change.removed, []);
});
