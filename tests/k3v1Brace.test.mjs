import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeTestAssembly, equip, inspectAssembly } from '../components.js';
import { deriveRigConfig } from '../assemblyPhysics.js';
import { createRigState, stepRig, BRACE } from '../locomotion.js';
import { WEAPONS, applyRecoil, createWeaponState, fireWeapon } from '../combat.js';
import { derateRigConfig } from '../functionalDamage.js';

const DT = 1 / 60;
const FREE = Object.freeze({ minX: -100, maxX: 100, minZ: -100, maxZ: 100, obstacles: [] });
const idle = { throttle: 0, strafe: 0, steer: 0, brake: 0 };
const brake = { ...idle, brake: 1 };
function configFor(legs = 'legs-yard') {
    const assembly = makeTestAssembly();
    if (legs !== 'legs-yard') equip(assembly, 'mobility', legs);
    assert.equal(inspectAssembly(assembly).ready, true);
    return deriveRigConfig(assembly);
}
function stepN(rig, config, n, input = idle) {
    for (let i = 0; i < n; i++) stepRig(rig, input, DT, config, FREE);
    return rig;
}
function recoilDelta(rig, config) {
    const before = { vx: rig.vx, vz: rig.vz, yaw: rig.yawRate };
    applyRecoil(rig, config, 0, -1, WEAPONS['gun-short'].recoilImpulseNs);
    return { speed: Math.hypot(rig.vx - before.vx, rig.vz - before.vz),
        yaw: Math.abs(rig.yawRate - before.yaw) };
}

test('hard brake stops precisely and never oscillates around zero in legal light/medium/heavy builds', () => {
    for (const family of ['legs-yard','legs-compact','legs-hauler']) {
        const config = configFor(family);
        const rig = Object.assign(createRigState({ x: 0, z: 0, yaw: 0 }), { vz: -5 });
        stepN(rig, config, 600, brake);
        assert.ok(Math.abs(rig.forwardSpeed) < .025, family + ' brake: ' + rig.forwardSpeed);
        assert.ok(Math.abs(rig.z) < 10, family + ' stop traveled ' + rig.z);
        assert.equal(rig.vz, 0, family + ' cannot creep backwards on repeated held brake');
    }
});

test('holding brake alone plants feet only after a deliberate stationary transition', () => {
    const config = configFor();
    const rig = createRigState({ x: 0, z: 0, yaw: 0 });
    stepN(rig, config, 1, brake);
    assert.ok(rig.brace > 0 && rig.brace < 1);
    assert.equal(rig.braced, false);
    stepN(rig, config, Math.ceil(BRACE.transitionSeconds / DT) + 1, brake);
    assert.equal(rig.braced, true);
    assert.equal(rig.brace, 1);
    stepN(rig, config, 1, { ...brake, steer: 1 });
    assert.equal(rig.braced, false);
    assert.equal(rig.brace, 0);
    stepN(rig, config, 1, idle);
    assert.equal(rig.braceHoldSeconds, 0);
});

test('brake is not an instant brace while sliding, yawing or commanding movement', () => {
    const config = configFor();
    for (const [state, input] of [
        [{ vz: -3 }, brake],
        [{ yawRate: 1 }, brake],
        [{}, { ...brake, throttle: 1 }],
        [{}, { ...brake, strafe: 1 }],
        [{}, { ...brake, steer: 1 }],
    ]) {
        const rig = Object.assign(createRigState({ x: 0, z: 0, yaw: 0 }), state);
        stepN(rig, config, 1, input);
        assert.equal(rig.brace, 0, JSON.stringify({ state, input }));
    }
});

test('disabled drive authority cannot enter brace even with brake held', () => {
    const healthy = configFor();
    for (const config of [
        { ...healthy, driveForceN: 0 },
        { ...healthy, lateralDriveForceN: 0 },
        derateRigConfig(healthy, { left: 1, right: 0, powerFactor: 1 }),
    ]) {
        const rig = createRigState({ x: 0, z: 0, yaw: 0 });
        stepN(rig, config, 60, brake);
        assert.equal(rig.braced, false);
    }
});

test('foot grip absorbs a fraction of new recoil without erasing prior momentum', () => {
    const config = configFor();
    const running = createRigState({ x: 0, z: 0, yaw: 0 });
    running.vx = .6;
    running.vz = -.3;
    const planted = { ...running, brace: 1, braced: true };
    const free = recoilDelta(running, config);
    const braced = recoilDelta(planted, config);
    assert.ok(braced.speed < free.speed && braced.speed > 0);
    assert.ok(braced.yaw < free.yaw && braced.yaw > 0);
    assert.equal(running.vx, .6, 'straight-backward shot does not alter sideward momentum');
    assert.equal(planted.vx, .6, 'brace never erases existing sideways velocity');
    assert.ok(planted.vz > running.vz, 'brace transmits less of this new impulse');
});

test('actual physical grip changes braced recoil absorption across legal leg families', () => {
    const retained = {};
    for (const family of ['legs-yard','legs-compact','legs-hauler']) {
        const config = configFor(family);
        const a = recoilDelta(createRigState({ x: 0, z: 0, yaw: 0 }), config).speed;
        const b = recoilDelta(Object.assign(createRigState({ x: 0, z: 0, yaw: 0 }), { brace: 1, braced: true }), config).speed;
        retained[family] = b / a;
    }
    assert.ok(retained['legs-hauler'] < retained['legs-yard']);
    assert.ok(retained['legs-yard'] < retained['legs-compact']);
});

test('player and AI rigs obey the same brake, brace and ammunition authority', () => {
    const config = configFor();
    const player = createRigState({ x: 0, z: 0, yaw: 0 });
    const ai = createRigState({ x: 0, z: 0, yaw: 0 });
    stepN(player, config, 22, brake);
    stepN(ai, config, 22, brake);
    assert.deepEqual(player, ai);
    const wp = createWeaponState(WEAPONS['gun-short']);
    const wa = createWeaponState(WEAPONS['gun-short']);
    assert.equal(fireWeapon(wp, WEAPONS['gun-short']), fireWeapon(wa, WEAPONS['gun-short']));
    applyRecoil(player, config, 0, -1, WEAPONS['gun-short'].recoilImpulseNs);
    applyRecoil(ai, config, 0, -1, WEAPONS['gun-short'].recoilImpulseNs);
    stepN(player, config, 30, brake);
    stepN(ai, config, 30, brake);
    assert.deepEqual(player, ai);
    assert.equal(wp.loaded, wa.loaded);
});

test('60Hz brace state and shot behavior is deterministic across repeat trials', () => {
    const run = () => {
        const rig = createRigState({ x: 0, z: 0, yaw: 0 });
        const config = configFor();
        stepN(rig, config, 24, brake);
        recoilDelta(rig, config);
        stepN(rig, config, 60, brake);
        stepN(rig, config, 15, { ...idle, throttle: 1 });
        return rig;
    };
    assert.deepEqual(run(), run());
});

test('existing touch brake and keyboard Space remain the only brace inputs', () => {
    const controls = fs.readFileSync(new URL('../controls.js', import.meta.url), 'utf8');
    const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
    const main = fs.readFileSync(new URL('../main.js', import.meta.url), 'utf8');
    assert.match(controls, /brake: this\.enabled \? Math\.max\(this\.brake, this\.keyboard\.has\('Space'\)/);
    assert.match(html, /id="brake"[^>]*Hold brake to stop/);
    assert.match(main, /stepRig\(rig, \{ throttle: input\.throttle, strafe: input\.strafe, steer: bodySteer, brake: input\.brake \}/);
    assert.match(main, /settledToShoot/);
    assert.match(html, /0\.0\.1k\.3v\.1/);
});
