import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveRigConfig } from '../assemblyPhysics.js';
import { applyTargetHit, createTargetCondition } from '../combat.js';
import { equip, makeTestAssembly } from '../components.js';
import { createRigState, stepRig } from '../locomotion.js';
import { mobilityPerformance } from '../mobilityPerformance.js';

const OPEN_WORLD = { minX: -100, maxX: 100, minZ: -100, maxZ: 100, obstacles: [] };
const input = (overrides = {}) => ({ throttle: 0, strafe: 0, steer: 0, brake: 0, ...overrides });

function assemblyWithMobility(id) {
    const assembly = makeTestAssembly();
    equip(assembly, 'mobility', id);
    return assembly;
}

function simulate(config, start, controls, seconds = 1) {
    const state = { ...createRigState(), ...start };
    const dt = 1 / 60;
    for (let t = 0; t < seconds - 1e-9; t += dt)
        stepRig(state, controls, dt, config, OPEN_WORLD);
    return state;
}

test('mobility family profiles express three distinct handling roles', () => {
    const kestrel = mobilityPerformance('legs-compact');
    const yard = mobilityPerformance('legs-yard');
    const hauler = mobilityPerformance('legs-hauler');
    assert.ok(kestrel.driveForceScale > yard.driveForceScale);
    assert.ok(yard.driveForceScale > hauler.driveForceScale);
    assert.ok(kestrel.yawInertiaScale < yard.yawInertiaScale);
    assert.ok(yard.yawInertiaScale < hauler.yawInertiaScale);
    assert.ok(kestrel.longitudinalDragScale > yard.longitudinalDragScale);
    assert.ok(yard.longitudinalDragScale > hauler.longitudinalDragScale);
    assert.ok(kestrel.damageTakenScale > yard.damageTakenScale);
    assert.ok(yard.damageTakenScale > hauler.damageTakenScale);
});

test('Kestrel launches fastest while Hauler launches slowest', () => {
    const configs = {
        kestrel: deriveRigConfig(assemblyWithMobility('legs-compact')),
        yard: deriveRigConfig(assemblyWithMobility('legs-yard')),
        hauler: deriveRigConfig(assemblyWithMobility('legs-hauler')),
    };
    const speed = Object.fromEntries(Object.entries(configs).map(([key, config]) => [
        key, simulate(config, {}, input({ throttle: 1 }), 1).forwardSpeed,
    ]));
    assert.ok(speed.kestrel > speed.yard, `${speed.kestrel} should exceed ${speed.yard}`);
    assert.ok(speed.yard > speed.hauler, `${speed.yard} should exceed ${speed.hauler}`);
});

test('Hauler carries momentum while Kestrel sheds speed quickly off throttle', () => {
    const configs = {
        kestrel: deriveRigConfig(assemblyWithMobility('legs-compact')),
        yard: deriveRigConfig(assemblyWithMobility('legs-yard')),
        hauler: deriveRigConfig(assemblyWithMobility('legs-hauler')),
    };
    const retained = Object.fromEntries(Object.entries(configs).map(([key, config]) => [
        key, Math.abs(simulate(config, { vz: -5 }, input(), 1).forwardSpeed),
    ]));
    assert.ok(retained.hauler > retained.yard);
    assert.ok(retained.yard > retained.kestrel);
});

test('Kestrel rotates most eagerly and Hauler resists yaw in motion', () => {
    const configs = {
        kestrel: deriveRigConfig(assemblyWithMobility('legs-compact')),
        yard: deriveRigConfig(assemblyWithMobility('legs-yard')),
        hauler: deriveRigConfig(assemblyWithMobility('legs-hauler')),
    };
    const yaw = Object.fromEntries(Object.entries(configs).map(([key, config]) => [
        key, Math.abs(simulate(config, { vz: -4 }, input({ steer: 1, throttle: .8 }), 1).yawRate),
    ]));
    assert.ok(yaw.kestrel > yaw.yard);
    assert.ok(yaw.yard > yaw.hauler);
});

test('Hauler brakes hardest from the same road speed', () => {
    const configs = {
        kestrel: deriveRigConfig(assemblyWithMobility('legs-compact')),
        yard: deriveRigConfig(assemblyWithMobility('legs-yard')),
        hauler: deriveRigConfig(assemblyWithMobility('legs-hauler')),
    };
    const remaining = Object.fromEntries(Object.entries(configs).map(([key, config]) => [
        key, Math.abs(simulate(config, { vz: -5 }, input({ brake: 1 }), .5).forwardSpeed),
    ]));
    assert.ok(remaining.hauler < remaining.yard);
    assert.ok(remaining.yard < remaining.kestrel);
});

test('the same mobility still responds to total installed rig mass', () => {
    const light = makeTestAssembly();
    equip(light, 'structure', 'frame-utility');
    equip(light, 'command', 'cab-utility');
    equip(light, 'combat', 'gun-light');
    const heavy = makeTestAssembly();
    equip(heavy, 'command', 'cab-armored');
    const lightConfig = deriveRigConfig(light);
    const heavyConfig = deriveRigConfig(heavy);
    assert.ok(lightConfig.massKg < heavyConfig.massKg);
    assert.equal(lightConfig.driveForceN, heavyConfig.driveForceN);
    const lightSpeed = simulate(lightConfig, {}, input({ throttle: 1 }), .5).forwardSpeed;
    const heavySpeed = simulate(heavyConfig, {}, input({ throttle: 1 }), .5).forwardSpeed;
    assert.ok(lightSpeed > heavySpeed);
});

test('mobility resilience follows Kestrel < Yardwalker < Hauler', () => {
    const remaining = {};
    for (const [key, id] of [['kestrel', 'legs-compact'], ['yard', 'legs-yard'], ['hauler', 'legs-hauler']]) {
        const condition = createTargetCondition(assemblyWithMobility(id));
        applyTargetHit(condition, 'mobility', 60);
        remaining[key] = condition.parts.mobility.integrity + condition.parts.mobility.armor;
    }
    assert.ok(remaining.kestrel < remaining.yard);
    assert.ok(remaining.yard < remaining.hauler);
});
