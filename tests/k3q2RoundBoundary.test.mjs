import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { decodeMachine, storeMachine } from '../persistence.js';
import { loadStable } from '../stable.js';
import { beginSeriesRound, loadSeries, startSeries } from '../series.js';
import {
    clearBoutResult, latestBoutResult, latestRoundResult, publishBoutResult,
    subscribeBoutResult, subscribeRoundResult,
} from '../boutSession.js';

class MemoryStorage {
    constructor() { this.map = new Map(); }
    getItem(key) { return this.map.has(key) ? this.map.get(key) : null; }
    setItem(key, value) { this.map.set(key, String(value)); }
    removeItem(key) { this.map.delete(key); }
}

function readyStorage() {
    const storage = new MemoryStorage();
    const machine = decodeMachine(null);
    storeMachine(storage, machine);
    loadStable(storage, '2026-10-17T17:10:00.000Z');
    return storage;
}

test('round results publish every fight while contract subscribers fire only at series end', () => {
    const storage = readyStorage();
    const previous = globalThis.localStorage;
    globalThis.localStorage = storage;
    clearBoutResult();
    const rounds = [];
    const contracts = [];
    const offRound = subscribeRoundResult(result => rounds.push(result));
    const offBout = subscribeBoutResult(result => contracts.push(result));
    try {
        startSeries(storage, 'yard-dog', 'rig-01', 'MABEL', 'assign-1');
        publishBoutResult({ victory: true, reason: 'R1', wrecks: ['not yet salvage'], draft: { premature: true }, wreckPreservation: .8 });
        assert.equal(rounds.length, 1);
        assert.equal(rounds[0].terminal, false);
        assert.equal(contracts.length, 0);
        assert.equal(latestBoutResult(), null);
        assert.equal(latestRoundResult().round.round, 1);

        beginSeriesRound(storage, 'rig-01', 'MABEL', 'assign-2');
        publishBoutResult({ victory: true, reason: 'R2', wrecks: ['terminal wreck'], draft: { ok: true }, wreckPreservation: .8 });
        assert.equal(rounds.length, 2);
        assert.equal(rounds[1].terminal, true);
        assert.equal(contracts.length, 1);
        assert.equal(contracts[0].victory, true);
        assert.equal(contracts[0].series.playerWins, 2);
        assert.equal(loadSeries(storage).phase, 'complete');
    } finally {
        offRound(); offBout(); clearBoutResult();
        if (previous === undefined) delete globalThis.localStorage;
        else globalThis.localStorage = previous;
    }
});

test('stable career integration records rounds by explicit rig id and contract wins once', () => {
    const source = fs.readFileSync(new URL('../stableUI.js', import.meta.url), 'utf8');
    assert.match(source, /subscribeRoundResult/);
    assert.match(source, /rigById\(stable, result\.round\.rigId\)/);
    assert.match(source, /career\.deployments \+= 1/);
    assert.match(source, /career\.roundWins \+= 1/);
    assert.match(source, /result\.series\.participatingRigIds/);
    assert.match(source, /career\.contractWins \+= 1/);
    assert.match(source, /else \{\s*recordActiveDeployment\(stable, !!result\.victory\)/s);
});

test('inter-round pit keeps contract locked and blocks garage mutation surfaces', () => {
    const source = fs.readFileSync(new URL('../seriesUI.js', import.meta.url), 'utf8');
    assert.match(source, /CONTRACT IN PROGRESS/);
    assert.match(source, /PIT SERVICE LOCKED/);
    assert.match(source, /campaign\.querySelectorAll\('\.campaign-node'\)/);
    assert.match(source, /#garage-context button, #garage-context select, #garage-context input/);
    assert.match(source, /beginSortieAssignment\(sessionStorageRef, series\.contractId\)/);
    assert.match(source, /beginSeriesRound/);
    assert.match(source, /assignment\.id === lastAssignmentId\(series\)/);
});

test('intermediate debrief explicitly defers settlement and suppresses salvage pages', () => {
    const ui = fs.readFileSync(new URL('../seriesUI.js', import.meta.url), 'utf8');
    const css = fs.readFileSync(new URL('../seriesStyles.css', import.meta.url), 'utf8');
    assert.match(ui, /CONTRACT SETTLEMENT', 'DEFERRED · SERIES IN PROGRESS/);
    assert.match(ui, /CONTINUE TO PIT/);
    assert.match(css, /bo3-round-debrief \.debrief-page-nav/);
    assert.match(css, /data-debrief-page="1"/);
    assert.match(css, /data-debrief-page="2"/);
});

test('q.3q.2 series shell remains loaded under later garage releases', () => {
    const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    assert.match(html, /"\.\/series\.js": "\.\/series\.js\?v=k3q2"/);
    const garage = fs.readFileSync(new URL('../garageMountUI.js', import.meta.url), 'utf8');
    assert.match(garage, /seriesUI\.js\?v=k3s2/);
});
