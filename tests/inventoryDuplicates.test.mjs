import test from 'node:test';
import assert from 'node:assert/strict';
import { makeStarterAssembly, recoverSalvage } from '../acquisition.js';
import { equipSerial } from '../components.js';
import { decodeMachine, encodeMachine, MACHINE_SAVE_VERSION } from '../persistence.js';

test('multiple physical copies of one definition can be recovered and mounted by serial', () => {
    const assembly = makeStarterAssembly();
    const first = recoverSalvage(assembly, {
        slot: 'combat', definitionId: 'gun-cannon', sourceSerial: 'YARD-A-GUN',
        condition: .82, recoveryFee: 0, preserveSourceSerial: true,
    });
    const second = recoverSalvage(assembly, {
        slot: 'combat', definitionId: 'gun-cannon', sourceSerial: 'YARD-B-GUN',
        condition: .44, recoveryFee: 0, preserveSourceSerial: true,
    });
    assert.equal(first.ok, true);
    assert.equal(second.ok, true);
    assert.equal(assembly.owned.filter(part => part.definitionId === 'gun-cannon').length, 3);
    assert.notEqual(first.instance.serial, second.instance.serial);
    equipSerial(assembly, 'combat', second.instance.serial);
    assert.equal(assembly.installed.combat, 'YARD-B-GUN');
});

test('v8 round-trip preserves duplicate definitions as distinct serials', () => {
    const state = decodeMachine(null);
    recoverSalvage(state.assembly, {
        slot: 'power', definitionId: 'power-dynamo', sourceSerial: 'DYN-A',
        condition: .67, recoveryFee: 0, preserveSourceSerial: true,
    });
    recoverSalvage(state.assembly, {
        slot: 'power', definitionId: 'power-dynamo', sourceSerial: 'DYN-B',
        condition: .31, recoveryFee: 0, preserveSourceSerial: true,
    });
    const payload = encodeMachine(state);
    const json = JSON.parse(payload);
    assert.equal(json.version, MACHINE_SAVE_VERSION);
    const restored = decodeMachine(payload);
    assert.equal(restored.status, 'restored');
    const dynamos = restored.assembly.owned.filter(part => part.definitionId === 'power-dynamo');
    assert.equal(dynamos.length, 3);
    assert.equal(new Set(dynamos.map(part => part.serial)).size, 3);
});
