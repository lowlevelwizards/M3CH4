import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
    assignmentReady, assignRigToSortie, beginSortieAssignment, cancelSortieAssignment,
    createSortieAssignment, decodeSortieAssignment, loadSortieAssignment,
    markSortieDeployed, markSortieLaunching, SORTIE_ASSIGNMENT_KEY,
} from '../sortieAssignment.js';

class MemoryStorage {
    constructor() { this.map = new Map(); }
    getItem(key) { return this.map.has(key) ? this.map.get(key) : null; }
    setItem(key, value) { this.map.set(key, String(value)); }
    removeItem(key) { this.map.delete(key); }
}

const ui = fs.readFileSync(new URL('../sortieAssignmentUI.js', import.meta.url), 'utf8');
const garage = fs.readFileSync(new URL('../garageMountUI.js', import.meta.url), 'utf8');

function pending(storage, contract = 'yard-dog') {
    const started = beginSortieAssignment(storage, contract, 1000);
    assert.equal(started.ok, true, started.reason);
    return started.assignment;
}

test('contract selection stages intent without assigning or deploying a machine', () => {
    const storage = new MemoryStorage();
    const assignment = pending(storage, 'cutter');
    assert.equal(assignment.contractId, 'cutter');
    assert.equal(assignment.rigId, null);
    assert.equal(assignment.phase, 'pending');
    assert.equal(assignmentReady(assignment), false);
    assert.equal(loadSortieAssignment(storage).contractId, 'cutter');
});

test('choosing a commissioned rig completes the pending job-machine pair', () => {
    const storage = new MemoryStorage();
    pending(storage, 'mule');
    const assigned = assignRigToSortie(storage, 'rig-02', 'DOGTOOTH');
    assert.equal(assigned.ok, true, assigned.reason);
    assert.equal(assigned.assignment.rigId, 'rig-02');
    assert.equal(assigned.assignment.rigName, 'DOGTOOTH');
    assert.equal(assignmentReady(assigned.assignment), true);
});

test('changing the staged job releases the prior machine choice', () => {
    const storage = new MemoryStorage();
    pending(storage, 'yard-dog');
    assignRigToSortie(storage, 'rig-01', 'MABEL');
    const changed = beginSortieAssignment(storage, 'cutter', 2000);
    assert.equal(changed.ok, true);
    assert.equal(changed.assignment.contractId, 'cutter');
    assert.equal(changed.assignment.rigId, null);
    assert.equal(changed.assignment.rigName, null);
});

test('launch lifecycle cannot commit before a machine is assigned', () => {
    const storage = new MemoryStorage();
    pending(storage, 'yard-dog');
    assert.equal(markSortieLaunching(storage, 'MABEL', 3000).ok, false);
    assignRigToSortie(storage, 'rig-01', 'MABEL');
    const launching = markSortieLaunching(storage, 'MABEL', 3000);
    assert.equal(launching.ok, true, launching.reason);
    assert.equal(launching.assignment.phase, 'launching');
    assert.equal(launching.assignment.launchedAt, 3000);
    const deployed = markSortieDeployed(storage);
    assert.equal(deployed.ok, true, deployed.reason);
    assert.equal(deployed.assignment.phase, 'deployed');
});

test('assignment can be cancelled before deployment but not after commitment', () => {
    const storage = new MemoryStorage();
    pending(storage, 'yard-dog');
    assignRigToSortie(storage, 'rig-01', 'MABEL');
    assert.equal(cancelSortieAssignment(storage).ok, true);
    assert.equal(storage.getItem(SORTIE_ASSIGNMENT_KEY), null);

    pending(storage, 'yard-dog');
    assignRigToSortie(storage, 'rig-01', 'MABEL');
    markSortieLaunching(storage, 'MABEL', 4000);
    const committed = cancelSortieAssignment(storage);
    assert.equal(committed.ok, false);
    assert.equal(committed.reason, 'SORTIE ALREADY COMMITTED');
});

test('malformed session data cannot invent a committed sortie', () => {
    assert.equal(decodeSortieAssignment('{"version":1,"phase":"deployed"}'), null);
    const fresh = createSortieAssignment('yard-dog', 5000, 'sortie-test');
    assert.equal(fresh.id, 'sortie-test');
    assert.equal(fresh.createdAt, 5000);
});

test('garage integration stages campaign clicks and commits only at the DEPLOY boundary', () => {
    assert.match(ui, /document\.addEventListener\('click',[\s\S]*closest\('\.campaign-node'\)[\s\S]*beginSortieAssignment/);
    assert.match(ui, /assemblyToggle\.addEventListener\('click',[\s\S]*assignmentReady\(assignment\)/);
    assert.match(ui, /activateRig\(localStorageRef, loaded\.stable, rig\.id\)/);
    assert.match(ui, /selectContract\(assignment\.contractId, sessionStorageRef, null, campaign\)/);
    assert.match(ui, /markSortieLaunching\(sessionStorageRef, rigLabel\(rig\)\)[\s\S]*window\.location\.reload\(\)/);
    assert.match(ui, /markSortieDeployed\(sessionStorageRef\)[\s\S]*assemblyToggle\.click\(\)/);
});

test('assignment surface keeps all three bays visible and blocks non-fieldable machines', () => {
    assert.match(ui, /for \(const rig of stable\.rigs\) grid\.append\(machineCard/);
    assert.match(ui, /const selectable = rig\.commissioned && readiness\.fieldable/);
    assert.match(ui, /button\.disabled = !selectable \|\| assignment\?\.phase !== 'pending'/);
    assert.match(ui, /inspection\.massKg\.toLocaleString\(\)[\s\S]*inspection\.powerUsedKw/);
    assert.match(ui, /rig\.career\.deployments[\s\S]*rig\.career\.roundWins[\s\S]*rig\.career\.roundLosses/);
    assert.match(ui, /definingHardware\(stable, rig\)/);
});

test('resolved sortie identity remains visible through debrief and stable accounting invariant', () => {
    assert.match(ui, /stable\.activeRigId !== assignment\.rigId/);
    assert.match(ui, /result\.assignment = \{ \.\.\.resolvedAssignment \}/);
    assert.match(ui, /ASSIGNED MACHINE/);
    assert.match(ui, /clearSortieAssignment\(sessionStorageRef\)/);
});

test('q.3q.1 assignment adapter remains loaded under later garage shells', () => {
    assert.match(garage, /sortieAssignmentUI\.js\?v=k3q1/);
});
