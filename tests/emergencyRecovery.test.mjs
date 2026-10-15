import test from 'node:test';
import assert from 'node:assert/strict';
import {
    FIELD_SERVICE_RECOVERY_RATIO,
    FIELD_SERVICE_SECONDS,
    WEAPON_FAULT_FLOOR,
    advanceFieldService,
    arrestFirstWeaponFailure,
    beginFieldService,
    canFieldService,
    createFieldServiceState,
    fieldServiceStationary,
    weaponFailureState,
    weaponIntegrityRatio,
    weaponMissionKillReason,
} from '../fieldService.js';
import { hostileMissionKillReason } from '../hostileRig.js';

const condition = (combatRatio = 1) => ({
    parts: {
        combat: { integrity: 115 * combatRatio, maxIntegrity: 115 },
    },
});
const stoppedRig = () => ({ vx: 0, vz: 0, yawRate: 0 });
const hostileCondition = ({ structure = 1, mobility = 1, power = 1, command = 1, combat = 1 } = {}) => ({
    parts: Object.fromEntries(Object.entries({ structure, mobility, power, command, combat }).map(([slot, value]) => [
        slot, { integrity: 100 * value, maxIntegrity: 100 },
    ])),
});
const behavior = { fireCadenceScale: 1, spreadScale: 1 };

test('first catastrophic weapon hit becomes a recoverable fault instead of dead time', () => {
    const service = createFieldServiceState();
    const player = condition(0);
    const latched = arrestFirstWeaponFailure(player, service, 30);

    assert.equal(latched, true);
    assert.equal(weaponFailureState(player, service), 'faulted');
    assert.equal(weaponIntegrityRatio(player), WEAPON_FAULT_FLOOR);
    assert.equal(canFieldService(player, service), true);
    assert.equal(weaponMissionKillReason(player, service), null);

    // Another disabling hit before the bypass is completed is genuinely terminal.
    player.parts.combat.integrity = 0;
    assert.equal(arrestFirstWeaponFailure(player, service, 115 * WEAPON_FAULT_FLOOR), false);
    assert.equal(weaponFailureState(player, service), 'destroyed');
    assert.equal(weaponMissionKillReason(player, service), 'WEAPON DESTROYED');
});

test('field service requires the rig to stop and interruption resets the hold', () => {
    const service = createFieldServiceState();
    const player = condition(0.08);
    const movingRig = { vx: 0.5, vz: 0, yawRate: 0 };

    assert.equal(fieldServiceStationary(movingRig), false);
    assert.equal(beginFieldService(player, service, movingRig), false);
    assert.equal(beginFieldService(player, service, stoppedRig()), true);

    let result = advanceFieldService(player, service, stoppedRig(), 1.5);
    assert.equal(result.event, 'progress');
    assert.equal(service.progress, 1.5);

    result = advanceFieldService(player, service, movingRig, 0.1);
    assert.equal(result.event, 'interrupted');
    assert.equal(service.held, false);
    assert.equal(service.progress, 0);
});

test('four-second emergency bypass restores only poor combat capability and is one-shot', () => {
    const service = createFieldServiceState();
    const player = condition(0.08);
    const rig = stoppedRig();
    assert.equal(beginFieldService(player, service, rig), true);

    let result;
    for (let elapsed = 0; elapsed < FIELD_SERVICE_SECONDS; elapsed += 0.5)
        result = advanceFieldService(player, service, rig, 0.5);

    assert.equal(result.event, 'completed');
    assert.equal(service.used, true);
    assert.equal(service.held, false);
    assert.ok(Math.abs(weaponIntegrityRatio(player) - FIELD_SERVICE_RECOVERY_RATIO) < 1e-9);
    assert.equal(weaponFailureState(player, service), 'damaged');
    assert.equal(canFieldService(player, service), false);

    // If the recovered gun falls through the shutdown threshold again, the sortie
    // resolves immediately rather than offering an infinite repair loop.
    player.parts.combat.integrity = player.parts.combat.maxIntegrity * 0.1;
    assert.equal(weaponFailureState(player, service), 'unrecoverable');
    assert.equal(weaponMissionKillReason(player, service), 'WEAPON FAULT · FIELD SERVICE SPENT');
});

test('hostile mission kills report the actual disabled combat-critical system', () => {
    assert.equal(hostileMissionKillReason(hostileCondition({ combat: 0.1 }), behavior), 'WEAPON DISABLED');
    assert.equal(hostileMissionKillReason(hostileCondition({ power: 0.1 }), behavior), 'POWER LOST');
    assert.equal(hostileMissionKillReason(hostileCondition({ mobility: 0 }), behavior), null,
        'immobilized armed opponent remains dangerous');
});
