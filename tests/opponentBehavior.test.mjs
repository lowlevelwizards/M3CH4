import test from 'node:test';
import assert from 'node:assert/strict';
import { contractById } from '../contracts.js';
import { createEnemyMotion, tacticalManeuver } from '../enemyMotion.js';
import { hostileAimSlot, hostileOutput } from '../hostileRig.js';

const rig = (z = 0) => ({
    x: 0, z, yaw: Math.PI, yawRate: 0,
    forwardSpeed: 0, lateralSpeed: 0, vx: 0, vz: 0,
});
const player = z => ({ x: 0, z });
const healthyCondition = () => ({
    parts: Object.fromEntries(['structure', 'mobility', 'power', 'command', 'combat'].map(slot => [
        slot, { integrity: 100, maxIntegrity: 100 },
    ])),
});

test('signature rivals expose three distinct authored combat personalities', () => {
    const signature = ['yard-dog', 'cutter', 'mule'].map(id => contractById(id));
    assert.deepEqual(signature.map(contract => contract.behavior.id), ['pressure', 'skirmisher', 'bruiser']);
    assert.ok(contractById('cutter').behavior.preferredRangeM > contractById('yard-dog').behavior.preferredRangeM);
    assert.ok(contractById('yard-dog').behavior.preferredRangeM > contractById('mule').behavior.preferredRangeM);
    assert.ok(contractById('cutter').behavior.strafeThrottle > contractById('yard-dog').behavior.strafeThrottle);
    assert.ok(contractById('yard-dog').behavior.strafeThrottle > contractById('mule').behavior.strafeThrottle);
});

test('same geometry produces visibly different tactical intent', () => {
    const enemy = rig();
    const distantPlayer = player(8);
    const yardBehavior = contractById('yard-dog').behavior;
    const cutterBehavior = contractById('cutter').behavior;
    const muleBehavior = contractById('mule').behavior;

    const yardMotion = createEnemyMotion(yardBehavior);
    const cutterMotion = createEnemyMotion(cutterBehavior);
    const muleMotion = createEnemyMotion(muleBehavior);
    const yard = tacticalManeuver(yardMotion, enemy, distantPlayer, yardBehavior);
    const cutter = tacticalManeuver(cutterMotion, enemy, distantPlayer, cutterBehavior);
    const mule = tacticalManeuver(muleMotion, enemy, distantPlayer, muleBehavior);

    assert.equal(yardMotion.phase, 'APPROACH');
    assert.ok(yard.throttle > .5);
    assert.equal(cutterMotion.phase, 'CIRCLE');
    assert.ok(Math.abs(cutter.strafe) > .9);
    assert.equal(muleMotion.phase, 'ADVANCE');
    assert.ok(mule.throttle > .7);
});

test('Mule braces at close cannon range while lighter opponents give ground', () => {
    const enemy = rig();
    const closePlayer = player(3);
    const yardBehavior = contractById('yard-dog').behavior;
    const cutterBehavior = contractById('cutter').behavior;
    const muleBehavior = contractById('mule').behavior;

    const yardMotion = createEnemyMotion(yardBehavior);
    const cutterMotion = createEnemyMotion(cutterBehavior);
    const muleMotion = createEnemyMotion(muleBehavior);
    const yard = tacticalManeuver(yardMotion, enemy, closePlayer, yardBehavior);
    const cutter = tacticalManeuver(cutterMotion, enemy, closePlayer, cutterBehavior);
    const mule = tacticalManeuver(muleMotion, enemy, closePlayer, muleBehavior);

    assert.equal(yardMotion.phase, 'DISENGAGE');
    assert.ok(yard.throttle < 0);
    assert.equal(cutterMotion.phase, 'DISENGAGE');
    assert.ok(cutter.throttle < yard.throttle);
    assert.equal(muleMotion.phase, 'BRACE');
    assert.equal(mule.throttle, 0);
    assert.ok(mule.brake >= .5);
});

test('contract fire control changes cadence, precision and subsystem preference', () => {
    const condition = healthyCondition();
    const yard = contractById('yard-dog').behavior;
    const cutter = contractById('cutter').behavior;
    const mule = contractById('mule').behavior;
    const yardOutput = hostileOutput(condition, yard);
    const cutterOutput = hostileOutput(condition, cutter);
    const muleOutput = hostileOutput(condition, mule);

    assert.ok(cutterOutput.triggerSeconds < yardOutput.triggerSeconds);
    assert.ok(yardOutput.triggerSeconds < muleOutput.triggerSeconds);
    assert.ok(cutterOutput.spreadRadians > yardOutput.spreadRadians);
    assert.ok(muleOutput.spreadRadians < yardOutput.spreadRadians);
    assert.equal(hostileAimSlot(1, yard.aimPriority), 'structure');
    assert.equal(hostileAimSlot(1, cutter.aimPriority), 'mobility');
    assert.deepEqual([1, 2, 3, 4].map(index => hostileAimSlot(index, mule.aimPriority)),
        ['structure', 'structure', 'mobility', 'command']);
});
