import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { decodeMachine, loadMachine, storeMachine } from '../persistence.js';
import { loadStable, rigById } from '../stable.js';
import { recordSeriesRound, startSeries } from '../series.js';
import {
    applyEmergencyFieldPatch, currentIntermissionFieldAction, fieldPatchCandidates,
    fieldPatchEligibility, fieldWorkCommitment, fieldWorkRecoveryPossible,
    loadFieldWorkState, partLifecycle, reconcileFieldPatches, FIELD_PATCH_CONDITION,
} from '../fieldWork.js';
import { clearBoutResult, publishBoutResult } from '../boutSession.js';

class MemoryStorage {
    constructor() { this.map = new Map(); }
    getItem(key) { return this.map.has(key) ? this.map.get(key) : null; }
    setItem(key, value) { this.map.set(key, String(value)); }
    removeItem(key) { this.map.delete(key); }
}

function readyStorage() {
    const storage = new MemoryStorage();
    const machine = decodeMachine(null);
    machine.assembly.name = 'MABEL';
    storeMachine(storage, machine);
    loadStable(storage, '2026-10-17T19:30:00.000Z');
    return storage;
}

function damageActive(storage, slot, { destroyed = false, armor = 0 } = {}) {
    const machine = loadMachine(storage);
    const serial = machine.assembly.installed[slot];
    const part = machine.assembly.owned.find(item => item.serial === serial);
    const snapshot = machine.playerCondition.parts[slot];
    part.condition = 0;
    part.destroyed = destroyed;
    snapshot.integrity = 0;
    snapshot.armor = armor;
    snapshot.destroyed = destroyed;
    if (slot === 'mobility') machine.damage.drives[serial] = { left: 0, right: 0 };
    assert.equal(storeMachine(storage, machine), true);
    return serial;
}

function openIntermission(storage, contractId = 'yard-dog') {
    assert.equal(startSeries(storage, contractId, 'rig-01', 'MABEL', 'assign-1').ok, true);
    const result = recordSeriesRound(storage, { victory: true, reason: 'ROUND WON' }, { hasFieldableMachine: true });
    assert.equal(result.ok, true);
    assert.equal(result.series.phase, 'intermission');
    return result.series;
}

test('only disabled intact hardware is patchable and destroyed hardware requires shop rebuild', () => {
    const storage = readyStorage();
    const serial = damageActive(storage, 'combat');
    let stable = loadStable(storage).stable;
    const candidate = fieldPatchEligibility(stable, 'rig-01', 'combat');
    assert.equal(candidate.patchable, true);
    assert.equal(candidate.serial, serial);

    const machine = loadMachine(storage);
    machine.assembly.owned.find(part => part.serial === serial).destroyed = true;
    machine.playerCondition.parts.combat.destroyed = true;
    storeMachine(storage, machine);
    stable = loadStable(storage).stable;
    const destroyed = fieldPatchEligibility(stable, 'rig-01', 'combat');
    assert.equal(destroyed.patchable, false);
    assert.match(destroyed.reason, /DESTROYED · SHOP REBUILD REQUIRED/);
});

test('one field patch revives the same serial to twenty-two percent without restoring armor', () => {
    const storage = readyStorage();
    const serial = damageActive(storage, 'combat', { armor: 0 });
    const series = openIntermission(storage);
    const result = applyEmergencyFieldPatch(storage, { seriesId: series.id, rigId: 'rig-01', slot: 'combat', now: 1234 });
    assert.equal(result.ok, true, result.reason);
    assert.equal(result.action.serial, serial);
    assert.equal(result.action.restoredCondition, FIELD_PATCH_CONDITION);

    const machine = loadMachine(storage);
    const part = machine.assembly.owned.find(item => item.serial === serial);
    const snapshot = machine.playerCondition.parts.combat;
    assert.equal(part.condition, FIELD_PATCH_CONDITION);
    assert.equal(part.destroyed, false);
    assert.equal(snapshot.integrity, snapshot.maxIntegrity * FIELD_PATCH_CONDITION);
    assert.equal(snapshot.armor, 0, 'field work does not rebuild armor housing');
    assert.equal(part.repairs, 0, 'field work is not a garage repair');
});

test('field patch history is attached to both the named machine and exact serialized component', () => {
    const storage = readyStorage();
    const serial = damageActive(storage, 'power');
    const series = openIntermission(storage);
    assert.equal(applyEmergencyFieldPatch(storage, { seriesId: series.id, rigId: 'rig-01', slot: 'power', now: 5678 }).ok, true);
    const stable = loadStable(storage).stable;
    assert.equal(rigById(stable, 'rig-01').career.fieldServices, 1);
    assert.equal(stable.partHistory[serial].timesFieldServiced, 1);
    assert.equal(stable.partHistory[serial].lastFieldServiceAt, 5678);
});

test('mobility patch restores both physical drive sections to the same crude capability', () => {
    const storage = readyStorage();
    const serial = damageActive(storage, 'mobility');
    const series = openIntermission(storage);
    const result = applyEmergencyFieldPatch(storage, { seriesId: series.id, rigId: 'rig-01', slot: 'mobility' });
    assert.equal(result.ok, true, result.reason);
    const machine = loadMachine(storage);
    assert.deepEqual(machine.damage.drives[serial], { left: FIELD_PATCH_CONDITION, right: FIELD_PATCH_CONDITION });
    const stable = loadStable(storage).stable;
    assert.deepEqual(rigById(stable, 'rig-01').damage.drives[serial], { left: FIELD_PATCH_CONDITION, right: FIELD_PATCH_CONDITION });
});

test('one-action preflight refuses a patch that would still leave the committed machine unfieldable', () => {
    const storage = readyStorage();
    damageActive(storage, 'combat');
    damageActive(storage, 'power');
    const stable = loadStable(storage).stable;
    assert.equal(fieldPatchCandidates(stable).length, 0);
    assert.equal(fieldWorkRecoveryPossible(stable), false);
    assert.match(fieldPatchEligibility(stable, 'rig-01', 'combat').reason, /ONE PATCH WILL NOT RETURN/);
});

test('a field patch is the only action allowed in that intermission and commits the patched rig', () => {
    const storage = readyStorage();
    damageActive(storage, 'combat');
    const series = openIntermission(storage);
    const first = applyEmergencyFieldPatch(storage, { seriesId: series.id, rigId: 'rig-01', slot: 'combat' });
    assert.equal(first.ok, true);
    const action = currentIntermissionFieldAction(storage, series);
    assert.equal(action.rigId, 'rig-01');
    assert.equal(fieldWorkCommitment(storage).rigId, 'rig-01');
    const second = applyEmergencyFieldPatch(storage, { seriesId: series.id, rigId: 'rig-01', slot: 'combat' });
    assert.equal(second.ok, false);
    assert.match(second.reason, /ACTION ALREADY SPENT/);
});

test('part lifecycle reads FUNCTIONAL DEGRADED DISABLED PATCHED and DESTROYED from physical state', () => {
    const storage = readyStorage();
    let stable = loadStable(storage).stable;
    const serial = rigById(stable, 'rig-01').installed.combat;
    assert.equal(partLifecycle(stable, serial, loadFieldWorkState(storage)), 'FUNCTIONAL');

    let machine = loadMachine(storage);
    machine.assembly.owned.find(part => part.serial === serial).condition = .6;
    storeMachine(storage, machine);
    stable = loadStable(storage).stable;
    assert.equal(partLifecycle(stable, serial, loadFieldWorkState(storage)), 'DEGRADED');

    damageActive(storage, 'combat');
    stable = loadStable(storage).stable;
    assert.equal(partLifecycle(stable, serial, loadFieldWorkState(storage)), 'DISABLED');
    const series = openIntermission(storage);
    assert.equal(applyEmergencyFieldPatch(storage, { seriesId: series.id, rigId: 'rig-01', slot: 'combat' }).ok, true);
    stable = loadStable(storage).stable;
    assert.equal(partLifecycle(stable, serial, loadFieldWorkState(storage)), 'PATCHED');

    machine = loadMachine(storage);
    machine.assembly.owned.find(part => part.serial === serial).destroyed = true;
    machine.playerCondition.parts.combat.destroyed = true;
    machine.playerCondition.parts.combat.integrity = 0;
    storeMachine(storage, machine);
    stable = loadStable(storage).stable;
    assert.equal(partLifecycle(stable, serial, loadFieldWorkState(storage)), 'DESTROYED');
});

test('proper later garage repair clears active PATCHED marker but preserves field-service history', () => {
    const storage = readyStorage();
    const serial = damageActive(storage, 'combat');
    const series = openIntermission(storage);
    assert.equal(applyEmergencyFieldPatch(storage, { seriesId: series.id, rigId: 'rig-01', slot: 'combat' }).ok, true);

    const machine = loadMachine(storage);
    const part = machine.assembly.owned.find(item => item.serial === serial);
    const snapshot = machine.playerCondition.parts.combat;
    part.condition = 1;
    snapshot.integrity = snapshot.maxIntegrity;
    storeMachine(storage, machine);
    const stable = loadStable(storage).stable;
    const state = reconcileFieldPatches(storage, stable);
    assert.equal(state.patches[serial], undefined);
    assert.equal(partLifecycle(stable, serial, state), 'FUNCTIONAL');
    assert.equal(stable.partHistory[serial].timesFieldServiced, 1);
});

test('BO3 exhaustion waits for a valid emergency patch path instead of forfeiting immediately', () => {
    const storage = readyStorage();
    damageActive(storage, 'combat');
    const previous = globalThis.localStorage;
    globalThis.localStorage = storage;
    clearBoutResult();
    try {
        startSeries(storage, 'yard-dog', 'rig-01', 'MABEL', 'assign-1');
        const round = publishBoutResult({ victory: true, reason: 'R1' });
        assert.equal(round.terminal, false);
        assert.equal(round.series.phase, 'intermission');
        assert.equal(fieldWorkRecoveryPossible(loadStable(storage).stable), true);
    } finally {
        clearBoutResult();
        if (previous === undefined) delete globalThis.localStorage;
        else globalThis.localStorage = previous;
    }
});

test('destroyed last machine still forfeits because field work cannot rebuild hardware', () => {
    const storage = readyStorage();
    damageActive(storage, 'combat', { destroyed: true });
    const previous = globalThis.localStorage;
    globalThis.localStorage = storage;
    clearBoutResult();
    try {
        startSeries(storage, 'yard-dog', 'rig-01', 'MABEL', 'assign-1');
        const result = publishBoutResult({ victory: true, reason: 'R1' });
        assert.equal(result.terminal, true);
        assert.equal(result.series.finalVictory, false);
        assert.equal(result.series.completionReason, 'no-fieldable-machines');
    } finally {
        clearBoutResult();
        if (previous === undefined) delete globalThis.localStorage;
        else globalThis.localStorage = previous;
    }
});

test('pit integration makes field work legible and enforces patch-to-next-round commitment before q1 deploy', () => {
    const ui = fs.readFileSync(new URL('../fieldWorkUI.js', import.meta.url), 'utf8');
    const css = fs.readFileSync(new URL('../fieldWorkStyles.css', import.meta.url), 'utf8');
    const garage = fs.readFileSync(new URL('../garageMountUI.js', import.meta.url), 'utf8');
    assert.match(ui, /1 ACTION AVAILABLE/);
    assert.match(ui, /NO ARMOR RESTORED/);
    assert.match(ui, /YOU MAY DECLINE FIELD WORK AND ROTATE NORMALLY/);
    assert.match(ui, /fieldWorkCommitment/);
    assert.match(ui, /assignment\?\.rigId !== commitment\.rigId/);
    assert.match(ui, /stopImmediatePropagation/);
    assert.match(css, /FIELD PATCH · COMMITTED/);
    assert.match(garage, /unifiedGarageUI\.js\?v=k3s2/);
    const unified = fs.readFileSync(new URL('../unifiedGarageUI.js', import.meta.url), 'utf8');
    assert.match(unified, /fieldWorkCommitment/);
    assert.match(unified, /applyEmergencyFieldPatch/);
});
