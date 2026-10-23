import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { reconcileMatchOnBoot } from '../matchRecovery.js';
import { beginSeriesRound, loadSeries, recordSeriesRound, startSeries } from '../series.js';
import {
    assignRigToSortie, beginSortieAssignment, loadSortieAssignment,
    markSortieDeployed, markSortieLaunching,
} from '../sortieAssignment.js';

class MemoryStorage {
    constructor() { this.values = new Map(); }
    getItem(key) { return this.values.get(key) ?? null; }
    setItem(key, value) { this.values.set(key, String(value)); }
    removeItem(key) { this.values.delete(key); }
}

function pit() {
    const local = new MemoryStorage();
    const session = new MemoryStorage();
    assert.equal(startSeries(local, 'yard-dog', 'rig-01', 'MABEL', 'sortie-1000').ok, true);
    assert.equal(recordSeriesRound(local, { victory: true, reason: 'ROUND ONE' },
        { hasFieldableMachine: true }).ok, true);
    assert.equal(loadSeries(local).phase, 'intermission');
    return { local, session };
}

function nextAssignment(session, phase) {
    assert.equal(beginSortieAssignment(session, 'yard-dog', 2000).ok, true);
    assert.equal(assignRigToSortie(session, 'rig-01', 'MABEL').ok, true);
    if (phase === 'launching' || phase === 'deployed')
        assert.equal(markSortieLaunching(session, 'MABEL').ok, true);
    if (phase === 'deployed') assert.equal(markSortieDeployed(session).ok, true);
    return loadSortieAssignment(session);
}

for (const phase of ['launching', 'deployed']) {
    test(`boot recovery preserves a fresh ${phase} Round 2 commitment`, () => {
        const { local, session } = pit();
        const before = nextAssignment(session, phase);
        const recovered = reconcileMatchOnBoot(local, session);
        assert.equal(recovered.action, 'round-committing');
        assert.deepEqual(loadSortieAssignment(session), before);
        assert.equal(loadSeries(local).phase, 'intermission');
        if (phase === 'launching') assert.equal(markSortieDeployed(session).ok, true);
        const assignment = loadSortieAssignment(session);
        assert.equal(beginSeriesRound(local, assignment.rigId, assignment.rigName, assignment.id).ok, true);
        assert.equal(loadSeries(local).phase, 'round_active');
        assert.equal(loadSeries(local).roundNumber, 2);
        assert.equal(reconcileMatchOnBoot(local, session).action, 'resume');
    });
}

test('a previously deployed Round 1 assignment is not replayed as Round 2', () => {
    const { local, session } = pit();
    assert.equal(beginSortieAssignment(session, 'yard-dog', 1000).ok, true);
    assert.equal(assignRigToSortie(session, 'rig-01', 'MABEL').ok, true);
    assert.equal(markSortieLaunching(session).ok, true);
    assert.equal(markSortieDeployed(session).ok, true);
    const recovered = reconcileMatchOnBoot(local, session);
    assert.equal(recovered.action, 'pit-restored');
    const next = loadSortieAssignment(session);
    assert.equal(next.phase, 'pending');
    assert.notEqual(next.id, 'sortie-1000');
    assert.equal(loadSeries(local).phase, 'intermission');
});

test('an untouched pit pending assignment remains pending', () => {
    const { local, session } = pit();
    const before = nextAssignment(session, 'pending');
    assert.equal(reconcileMatchOnBoot(local, session).action, 'pit');
    assert.deepEqual(loadSortieAssignment(session), before);
});

test('pit footer and bay selector reserve separate horizontal lanes', () => {
    const css = readFileSync(new URL('../physicalPitWorkspace.css', import.meta.url), 'utf8');
    const section = css.slice(css.indexOf('/* Reserve a separate bottom lane'));
    assert.ok(section.includes('left:calc((100% - var(--pit-footer-width) - 16px) / 2)'));
    assert.ok(section.includes('max-width:calc(100% - var(--pit-footer-width) - 24px)'));
    // Check the declared geometry at representative landscape screen widths.
    for (const viewport of [667, 844, 1024, 1799]) {
        const footer = Math.max(246, Math.min(365, .36 * viewport));
        const tray = Math.min(Math.max(190, .27 * viewport), 300, viewport - footer - 24);
        const trayRight = (viewport - footer - 16) / 2 + tray / 2;
        assert.ok(trayRight < viewport - footer,
            `bay tray must clear footer at ${viewport}px`);
    }
});
