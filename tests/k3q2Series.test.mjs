import test from 'node:test';
import assert from 'node:assert/strict';
import { decodeMachine, storeMachine } from '../persistence.js';
import { loadStable } from '../stable.js';
import { settleSortie } from '../economy.js';
import {
    beginSeriesRound, clearSeries, createSeries, decodeSeries, encodeSeries,
    loadSeries, noteSeriesRoundAmmo, recordSeriesRound, seriesScore, startSeries,
} from '../series.js';

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
    loadStable(storage, '2026-10-17T17:00:00.000Z');
    return { storage, machine };
}

test('BO3 series starts round one on the exact committed machine and assignment', () => {
    const series = createSeries('cutter', 'rig-01', 'MABEL', 'assign-1', 1000, 'series-test');
    assert.equal(series.phase, 'round_active');
    assert.equal(series.roundNumber, 1);
    assert.equal(series.currentRigId, 'rig-01');
    assert.equal(series.currentAssignmentId, 'assign-1');
    assert.equal(seriesScore(series), '0–0');
});

test('one round win advances to intermission without completing the contract', () => {
    const { storage } = readyStorage();
    startSeries(storage, 'yard-dog', 'rig-01', 'MABEL', 'assign-1');
    const result = recordSeriesRound(storage, { victory: true, reason: 'HOSTILES DOWN' });
    assert.equal(result.ok, true);
    assert.equal(result.terminal, false);
    assert.equal(result.series.phase, 'intermission');
    assert.equal(result.series.playerWins, 1);
    assert.equal(result.series.enemyWins, 0);
    assert.equal(result.series.rounds[0].assignmentId, 'assign-1');
});

test('two straight wins end a BO3 at 2-0 and skip round three', () => {
    const { storage } = readyStorage();
    startSeries(storage, 'yard-dog', 'rig-01', 'MABEL', 'assign-1');
    recordSeriesRound(storage, { victory: true, reason: 'R1' });
    beginSeriesRound(storage, 'rig-01', 'MABEL', 'assign-2');
    const final = recordSeriesRound(storage, { victory: true, reason: 'R2' });
    assert.equal(final.terminal, true);
    assert.equal(final.series.finalVictory, true);
    assert.equal(final.series.playerWins, 2);
    assert.equal(final.series.enemyWins, 0);
    assert.equal(final.series.rounds.length, 2);
});

test('a 1-1 split forces round three and can resolve 2-1', () => {
    const { storage } = readyStorage();
    startSeries(storage, 'cutter', 'rig-01', 'MABEL', 'assign-1');
    recordSeriesRound(storage, { victory: true, reason: 'R1' });
    beginSeriesRound(storage, 'rig-01', 'MABEL', 'assign-2');
    const split = recordSeriesRound(storage, { victory: false, reason: 'R2' });
    assert.equal(split.terminal, false);
    assert.equal(seriesScore(split.series), '1–1');
    beginSeriesRound(storage, 'rig-01', 'MABEL', 'assign-3');
    const final = recordSeriesRound(storage, { victory: true, reason: 'R3' });
    assert.equal(final.terminal, true);
    assert.equal(seriesScore(final.series), '2–1');
});

test('the same persistent machine may be assigned in every round', () => {
    const { storage } = readyStorage();
    startSeries(storage, 'mule', 'rig-01', 'MABEL', 'assign-1');
    recordSeriesRound(storage, { victory: false, reason: 'R1' });
    assert.equal(beginSeriesRound(storage, 'rig-01', 'MABEL', 'assign-2').ok, true);
    recordSeriesRound(storage, { victory: true, reason: 'R2' });
    assert.equal(beginSeriesRound(storage, 'rig-01', 'MABEL', 'assign-3').ok, true);
    const final = recordSeriesRound(storage, { victory: true, reason: 'R3' });
    assert.deepEqual(final.series.participatingRigIds, ['rig-01']);
    assert.deepEqual(final.series.rounds.map(round => round.rigId), ['rig-01', 'rig-01', 'rig-01']);
});

test('round ammunition is attached once and aggregated across the series', () => {
    const { storage } = readyStorage();
    startSeries(storage, 'yard-dog', 'rig-01', 'MABEL', 'assign-1');
    recordSeriesRound(storage, { victory: true, reason: 'R1' });
    assert.equal(noteSeriesRoundAmmo(storage, 31).totalRoundsFired, 31);
    assert.equal(noteSeriesRoundAmmo(storage, 99).totalRoundsFired, 31, 'same round cannot be charged twice');
    beginSeriesRound(storage, 'rig-01', 'MABEL', 'assign-2');
    recordSeriesRound(storage, { victory: true, reason: 'R2' });
    assert.equal(noteSeriesRoundAmmo(storage, 18).totalRoundsFired, 49);
});

test('economy settlement is deferred between rounds and pays once using aggregate ammo', () => {
    const { storage } = readyStorage();
    const previous = globalThis.localStorage;
    globalThis.localStorage = storage;
    try {
        startSeries(storage, 'yard-dog', 'rig-01', 'MABEL', 'assign-1');
        recordSeriesRound(storage, { victory: true, reason: 'R1' });
        const deferred = settleSortie({ credits: 600, victory: true, roundsFired: 31, victoryPayout: 1000 });
        assert.equal(deferred.deferred, true);
        assert.equal(deferred.creditsAfter, 600);
        assert.equal(deferred.grossPayout, 0);
        beginSeriesRound(storage, 'rig-01', 'MABEL', 'assign-2');
        recordSeriesRound(storage, { victory: true, reason: 'R2' });
        const final = settleSortie({ credits: 600, victory: true, roundsFired: 18, victoryPayout: 1000 });
        assert.equal(final.deferred, false);
        assert.equal(final.victory, true);
        assert.equal(final.roundsFired, 49);
        assert.equal(final.ammoCost, 49);
        assert.equal(final.grossPayout, 1000);
        assert.equal(final.creditsAfter, 1551);
    } finally {
        if (previous === undefined) delete globalThis.localStorage;
        else globalThis.localStorage = previous;
    }
});

test('orchestration can forfeit an unfinished contract when no fieldable machine remains', () => {
    const { storage } = readyStorage();
    startSeries(storage, 'cutter', 'rig-01', 'MABEL', 'assign-1');
    const result = recordSeriesRound(
        storage,
        { victory: true, reason: 'ROUND WON' },
        { hasFieldableMachine: false },
    );
    assert.equal(result.terminal, true);
    assert.equal(result.series.finalVictory, false);
    assert.equal(result.series.completionReason, 'no-fieldable-machines');
    assert.equal(result.series.playerWins, 1);
});

test('series persistence round trip keeps score, assignment identity and machine rotation', () => {
    const { storage } = readyStorage();
    startSeries(storage, 'cutter', 'rig-01', 'MABEL', 'assign-1');
    recordSeriesRound(storage, { victory: true, reason: 'R1' });
    beginSeriesRound(storage, 'rig-02', 'DOGTOOTH', 'assign-2');
    const payload = encodeSeries(loadSeries(storage));
    const restored = decodeSeries(payload);
    assert.equal(restored.phase, 'round_active');
    assert.equal(restored.currentRigId, 'rig-02');
    assert.equal(restored.currentAssignmentId, 'assign-2');
    assert.equal(restored.rounds[0].assignmentId, 'assign-1');
    assert.deepEqual(restored.participatingRigIds, ['rig-01', 'rig-02']);
});

test('clearing a series removes only BO3 lifecycle state', () => {
    const { storage } = readyStorage();
    storage.setItem('unrelated', 'keep');
    startSeries(storage, 'yard-dog', 'rig-01', 'MABEL', 'assign-1');
    assert.equal(clearSeries(storage), true);
    assert.equal(loadSeries(storage), null);
    assert.equal(storage.getItem('unrelated'), 'keep');
});

test('mixed-weapon BO3 invoices preserve fractional prices and charge each round once',()=>{
    const {storage}=readyStorage();
    const prev=globalThis.localStorage;
    globalThis.localStorage=storage;
    try {
        startSeries(storage,'yard-dog','rig-01','CHEAP RIVET','assign-1');
        recordSeriesRound(storage,{victory:true,reason:'R1'});
        const first=settleSortie({credits:600,victory:true,roundsFired:9,ammoCostCents:225,victoryPayout:850});
        assert.equal(first.deferred,true);
        assert.equal(first.creditsAfter,600);
        assert.equal(loadSeries(storage).rounds[0].ammoCostCents,225);
        // A repeated settlement for this completed round cannot raise the bill.
        settleSortie({credits:600,victory:true,roundsFired:999,ammoCostCents:99999,victoryPayout:850});
        assert.equal(loadSeries(storage).rounds[0].ammoCostCents,225);
        beginSeriesRound(storage,'rig-02','ROCKET RACK','assign-2');
        recordSeriesRound(storage,{victory:true,reason:'R2'});
        const last=settleSortie({credits:600,victory:true,roundsFired:3,ammoCostCents:2400,victoryPayout:850});
        assert.equal(last.deferred,false);
        assert.equal(last.roundsFired,12);
        assert.equal(last.ammoCost,27,'₡2.25 + ₡24 = ₡26.25 rounded once');
        assert.equal(last.creditsAfter,1423);
        assert.equal(last.series.totalAmmoCostCents,2625);
    }finally{
        if(prev===undefined)delete globalThis.localStorage;
        else globalThis.localStorage=prev;
    }
});

test('legacy active series with no weapon invoice retains old one-credit-per-round pricing',()=>{
    const {storage}=readyStorage();
    startSeries(storage,'yard-dog','rig-01','LEGACY','assign-1');
    recordSeriesRound(storage,{victory:true,reason:'OLD'});
    const legacy=noteSeriesRoundAmmo(storage,12);
    const raw=JSON.parse(encodeSeries(legacy));
    delete raw.rounds[0].ammoCostCents;
    storage.setItem('m3ch4-series-v1',JSON.stringify(raw));
    assert.equal(loadSeries(storage).totalAmmoCostCents,1200);
    assert.equal(loadSeries(storage).rounds[0].ammoCostCents,null);
});
