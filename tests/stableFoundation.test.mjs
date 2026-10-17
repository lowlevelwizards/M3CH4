import test from 'node:test';
import assert from 'node:assert/strict';
import { recoverSalvage } from '../acquisition.js';
import { equipSerial } from '../components.js';
import { decodeMachine, loadMachine, storeMachine } from '../persistence.js';
import {
    activateRig, commissionRig, createStableFromMachine, decodeStable, encodeStable,
    loadStable, mountPartOnRig, originalPartsRemaining, rigById, rigFieldability,
    serialOwner, storeStable, syncActiveMachineIntoStable,
} from '../stable.js';

class MemoryStorage {
    constructor() { this.map = new Map(); }
    getItem(key) { return this.map.has(key) ? this.map.get(key) : null; }
    setItem(key, value) { this.map.set(key, String(value)); }
    removeItem(key) { this.map.delete(key); }
}

const SECOND_RIG_PARTS = [
    ['structure', 'frame-sr', 'R2-FRAME'],
    ['mobility', 'legs-yard', 'R2-LEGS'],
    ['power', 'power-dynamo', 'R2-POWER'],
    ['command', 'cab-cyclops', 'R2-CAB'],
    ['combat', 'gun-cannon', 'R2-GUN'],
];

function addPart(assembly, slot, definitionId, serial, condition = .84) {
    const result = recoverSalvage(assembly, {
        slot, definitionId, sourceSerial: serial, condition, recoveryFee: 0, preserveSourceSerial: true,
    });
    assert.equal(result.ok, true);
    return result.instance;
}

function addSecondRigInventory(machine) {
    for (const [slot, definitionId, serial] of SECOND_RIG_PARTS)
        addPart(machine.assembly, slot, definitionId, serial);
}

function assembleRig(stable, rigId, recipe = SECOND_RIG_PARTS) {
    for (const [slot, , serial] of recipe) {
        const mounted = mountPartOnRig(stable, rigId, slot, serial);
        assert.equal(mounted.ok, true, mounted.reason);
    }
}

test('legacy active machine migrates into commissioned Rig 01 with two empty bays', () => {
    const machine = decodeMachine(null);
    machine.assembly.name = 'MABEL';
    const stable = createStableFromMachine(machine, '2026-10-17T12:00:00.000Z');
    assert.equal(stable.activeRigId, 'rig-01');
    assert.equal(stable.rigs.length, 3);
    assert.equal(rigById(stable, 'rig-01').commissioned, true);
    assert.equal(rigById(stable, 'rig-01').name, 'MABEL');
    assert.deepEqual(rigById(stable, 'rig-01').originalConfiguration, machine.assembly.installed);
    assert.equal(Object.keys(rigById(stable, 'rig-02').installed).length, 0);
    assert.equal(Object.keys(rigById(stable, 'rig-03').installed).length, 0);
    assert.equal(rigById(stable, 'rig-02').commissioned, false);
    assert.equal(rigById(stable, 'rig-03').commissioned, false);
});

test('second machine can be assembled from extra serialized hardware without dismantling Rig 01', () => {
    const storage = new MemoryStorage();
    const machine = decodeMachine(null);
    storeMachine(storage, machine);
    let stable = loadStable(storage, '2026-10-17T12:00:00.000Z').stable;
    const rig1Before = { ...rigById(stable, 'rig-01').installed };

    addSecondRigInventory(machine);
    storeMachine(storage, machine);
    stable = loadStable(storage, '2026-10-17T12:01:00.000Z').stable;
    assembleRig(stable, 'rig-02');

    assert.deepEqual(rigById(stable, 'rig-01').installed, rig1Before);
    assert.equal(rigFieldability(stable, 'rig-02').fieldable, true);
    const commissioned = commissionRig(stable, 'rig-02', 'DOGTOOTH', '2026-10-17T12:02:00.000Z');
    assert.equal(commissioned.ok, true);
    assert.equal(commissioned.rig.commissionOrder, 2);
    assert.equal(commissioned.rig.name, 'DOGTOOTH');
    assert.deepEqual(commissioned.rig.originalConfiguration, commissioned.rig.installed);
});

test('one serialized component cannot be mounted to two rigs', () => {
    const machine = decodeMachine(null);
    addPart(machine.assembly, 'combat', 'gun-cannon', 'SHARED-GUN');
    const stable = createStableFromMachine(machine);
    assert.equal(mountPartOnRig(stable, 'rig-02', 'combat', 'SHARED-GUN').ok, true);
    const second = mountPartOnRig(stable, 'rig-03', 'combat', 'SHARED-GUN');
    assert.equal(second.ok, false);
    assert.match(second.reason, /MOUNTED ON/i);
    assert.equal(serialOwner(stable, 'SHARED-GUN').id, 'rig-02');
});

test('destroyed or completely disabled mandatory hardware prevents commissioning', () => {
    const machine = decodeMachine(null);
    addSecondRigInventory(machine);
    const stable = createStableFromMachine(machine);
    assembleRig(stable, 'rig-02');
    stable.inventory.find(part => part.serial === 'R2-GUN').destroyed = true;
    assert.equal(rigFieldability(stable, 'rig-02').fieldable, false);
    assert.equal(commissionRig(stable, 'rig-02', 'BAD IDEA').ok, false);
    stable.inventory.find(part => part.serial === 'R2-GUN').destroyed = false;
    stable.inventory.find(part => part.serial === 'R2-GUN').condition = 0;
    assert.equal(rigFieldability(stable, 'rig-02').fieldable, false);
});

test('activating a commissioned rig projects its hardware into v8 while stable owns the persistent identity', () => {
    const storage = new MemoryStorage();
    const machine = decodeMachine(null);
    machine.assembly.name = 'MABEL';
    addSecondRigInventory(machine);
    storeMachine(storage, machine);
    const stable = createStableFromMachine(machine, '2026-10-17T12:00:00.000Z');
    assembleRig(stable, 'rig-02');
    assert.equal(commissionRig(stable, 'rig-02', 'DOGTOOTH').ok, true);
    assert.equal(storeStable(storage, stable), true);

    const activated = activateRig(storage, stable, 'rig-02');
    assert.equal(activated.ok, true, activated.reason);
    const projected = loadMachine(storage);
    assert.equal(projected.status, 'restored');
    assert.equal(projected.assembly.serial, 'SR-01');
    assert.deepEqual(projected.assembly.installed, rigById(stable, 'rig-02').installed);
    assert.equal(projected.assembly.owned.some(part => part.serial === machine.assembly.installed.combat), true);

    const reloaded = loadStable(storage, '2026-10-17T12:03:00.000Z').stable;
    assert.equal(reloaded.activeRigId, 'rig-02');
    assert.equal(rigById(reloaded, 'rig-02').name, 'DOGTOOTH');
    assert.equal(rigById(reloaded, 'rig-01').name, 'MABEL');
});

test('machine identity and original configuration survive Ship of Theseus replacement', () => {
    const machine = decodeMachine(null);
    addSecondRigInventory(machine);
    addPart(machine.assembly, 'combat', 'gun-cannon', 'R2-GUN-B', .73);
    const stable = createStableFromMachine(machine);
    assembleRig(stable, 'rig-02');
    assert.equal(commissionRig(stable, 'rig-02', 'MABEL II').ok, true);
    const rig = rigById(stable, 'rig-02');
    const originalGun = rig.originalConfiguration.combat;
    assert.equal(originalPartsRemaining(rig), 5);
    assert.equal(mountPartOnRig(stable, 'rig-02', 'combat', 'R2-GUN-B').ok, true);
    assert.equal(rig.id, 'rig-02');
    assert.equal(rig.name, 'MABEL II');
    assert.equal(rig.originalConfiguration.combat, originalGun);
    assert.equal(rig.installed.combat, 'R2-GUN-B');
    assert.equal(originalPartsRemaining(rig), 4);
});

test('stable save round trip preserves rig identities, ownership and compact histories', () => {
    const machine = decodeMachine(null);
    addSecondRigInventory(machine);
    const stable = createStableFromMachine(machine);
    assembleRig(stable, 'rig-02');
    commissionRig(stable, 'rig-02', 'DOGTOOTH');
    rigById(stable, 'rig-02').career.deployments = 7;
    const payload = encodeStable(stable);
    const restored = decodeStable(payload, machine).stable;
    assert.equal(rigById(restored, 'rig-02').name, 'DOGTOOTH');
    assert.equal(rigById(restored, 'rig-02').career.deployments, 7);
    assert.equal(serialOwner(restored, 'R2-GUN').id, 'rig-02');
    assert.equal(restored.partHistory['R2-GUN'].machinesServed.includes('rig-02'), true);
});

test('syncing a live active mount resolves impossible duplicate ownership in favor of the physical active rig', () => {
    const machine = decodeMachine(null);
    addPart(machine.assembly, 'combat', 'gun-cannon', 'SPARE-GUN');
    const stable = createStableFromMachine(machine);
    assert.equal(mountPartOnRig(stable, 'rig-02', 'combat', 'SPARE-GUN').ok, true);
    equipSerial(machine.assembly, 'combat', 'SPARE-GUN');
    syncActiveMachineIntoStable(stable, machine);
    assert.equal(rigById(stable, 'rig-01').installed.combat, 'SPARE-GUN');
    assert.equal(rigById(stable, 'rig-02').installed.combat, undefined);
    assert.equal(serialOwner(stable, 'SPARE-GUN').id, 'rig-01');
});
