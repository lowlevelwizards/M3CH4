import test from 'node:test';
import assert from 'node:assert/strict';
import { recoverSalvage } from '../acquisition.js';
import { decodeMachine, loadMachine, storeMachine } from '../persistence.js';
import {
    activateRig, commissionRig, loadStable, mountPartOnRig, rigById,
    storeStable, syncActiveMachineIntoStable,
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

function addSecondRig(machine) {
    for (const [slot, definitionId, serial] of SECOND_RIG_PARTS) {
        const recovered = recoverSalvage(machine.assembly, {
            slot, definitionId, sourceSerial: serial, condition: .9,
            recoveryFee: 0, preserveSourceSerial: true,
        });
        assert.equal(recovered.ok, true);
    }
}

function assembleSecondRig(stable) {
    for (const [slot, , serial] of SECOND_RIG_PARTS) {
        const mounted = mountPartOnRig(stable, 'rig-02', slot, serial);
        assert.equal(mounted.ok, true, mounted.reason);
    }
    const commissioned = commissionRig(stable, 'rig-02', 'DOGTOOTH');
    assert.equal(commissioned.ok, true, commissioned.reason);
}

test('rotating away from a damaged rig and back restores each machine own persistent damage', () => {
    const storage = new MemoryStorage();
    const starting = decodeMachine(null);
    starting.assembly.name = 'MABEL';
    addSecondRig(starting);
    assert.equal(storeMachine(storage, starting), true);

    const stable = loadStable(storage, '2026-10-17T17:20:00.000Z').stable;
    assembleSecondRig(stable);
    assert.equal(storeStable(storage, stable), true);

    const mabel = loadMachine(storage);
    const mabelGun = mabel.playerCondition.parts.combat;
    mabelGun.integrity = mabelGun.maxIntegrity * .43;
    const mabelGunSerial = mabel.assembly.installed.combat;
    mabel.assembly.owned.find(part => part.serial === mabelGunSerial).condition = .43;
    assert.equal(storeMachine(storage, mabel), true);
    syncActiveMachineIntoStable(stable, mabel);
    assert.equal(storeStable(storage, stable), true);
    const mabelIntegrity = rigById(stable, 'rig-01').playerCondition.parts.combat.integrity;

    const dogtoothActivation = activateRig(storage, stable, 'rig-02');
    assert.equal(dogtoothActivation.ok, true, dogtoothActivation.reason);
    const dogtooth = loadMachine(storage);
    const dogtoothMove = dogtooth.playerCondition.parts.mobility;
    dogtoothMove.integrity = dogtoothMove.maxIntegrity * .61;
    const dogtoothMoveSerial = dogtooth.assembly.installed.mobility;
    dogtooth.assembly.owned.find(part => part.serial === dogtoothMoveSerial).condition = .61;
    assert.equal(storeMachine(storage, dogtooth), true);
    syncActiveMachineIntoStable(stable, dogtooth);
    assert.equal(storeStable(storage, stable), true);
    const dogtoothIntegrity = rigById(stable, 'rig-02').playerCondition.parts.mobility.integrity;

    const mabelActivation = activateRig(storage, stable, 'rig-01');
    assert.equal(mabelActivation.ok, true, mabelActivation.reason);
    const restoredMabel = loadMachine(storage);
    assert.equal(restoredMabel.playerCondition.parts.combat.integrity, mabelIntegrity);
    assert.equal(restoredMabel.assembly.owned.find(part => part.serial === mabelGunSerial).condition, .43);

    const reloadedStable = loadStable(storage, '2026-10-17T17:21:00.000Z').stable;
    assert.equal(rigById(reloadedStable, 'rig-02').playerCondition.parts.mobility.integrity, dogtoothIntegrity);
    assert.equal(reloadedStable.inventory.find(part => part.serial === dogtoothMoveSerial).condition, .61);
});
