import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeTestAssembly, equip, inspectAssembly, CATALOG } from '../components.js';
import { deriveRigConfig } from '../assemblyPhysics.js';
import { createRigState, stepRig } from '../locomotion.js';
import { applyRecoil, WEAPONS } from '../combat.js';
import { derateRigConfig } from '../functionalDamage.js';
import { runMobilityTemperamentStudy, formatMobilityTemperamentStudy } from '../research/mobilityTemperamentStudy.mjs';

const DT = 1 / 60;
const world = { minX: -200, maxX: 200, minZ: -200, maxZ: 200, obstacles: [] };
const neutral = { throttle: 0, strafe: 0, steer: 0, brake: 0 };
const configs = () => Object.fromEntries(['legs-compact','legs-yard','legs-hauler'].map(id => {
    const a = makeTestAssembly();
    equip(a, 'mobility', id);
    assert.equal(inspectAssembly(a).ready, true, id);
    return [id, deriveRigConfig(a)];
}));
function evolve(config, state, input, n = 60) {
    for(let i = 0; i < n; i++) stepRig(state, input, DT, config, world);
    return state;
}
function newState(start = {}) {
    return Object.assign(createRigState({ x: 0, z: 0, yaw: 0 }), start);
}

test('all three published mobility temperaments use real, legal installed hardware', () => {
    const reports = runMobilityTemperamentStudy();
    assert.equal(reports.length, 3);
    assert.equal(new Set(reports.map(r => r.id)).size, 3);
    for (const r of reports) {
        assert.equal(r.ready, true);
        assert.ok(r.massKg > 1000 && r.massKg < 6000);
        for (const [key, value] of Object.entries(r)) {
            if (typeof value === 'number') assert.ok(Number.isFinite(value), r.id + ':' + key);
        }
    }
    assert.match(formatMobilityTemperamentStudy(reports), /Hard|hard corner|Peak slip|Grip saturated/);
    assert.deepEqual(reports, runMobilityTemperamentStudy(), 'fixed-step study is fully deterministic');
});

test('Kestrel accelerates and yaws eagerly; Yardwalker is balanced; Hauler turns deliberately', () => {
    const x = Object.fromEntries(runMobilityTemperamentStudy().map(r => [r.id,r]));
    assert.ok(x['legs-compact'].launchMps > x['legs-yard'].launchMps);
    assert.ok(x['legs-yard'].launchMps > x['legs-hauler'].launchMps);
    assert.ok(x['legs-compact'].turnDegrees > x['legs-yard'].turnDegrees);
    assert.ok(x['legs-yard'].turnDegrees > x['legs-hauler'].turnDegrees);
    assert.ok(x['legs-compact'].brakeTurnDegrees > x['legs-hauler'].brakeTurnDegrees);
});

test('hard simultaneous acceleration and steering reaches Kestrel foot grip ceiling first', () => {
    const x = Object.fromEntries(runMobilityTemperamentStudy().map(r => [r.id,r]));
    assert.ok(x['legs-compact'].hardCornerSaturationFrames > 0,
        JSON.stringify(x['legs-compact']));
    assert.ok(x['legs-compact'].hardCornerSaturationFrames > x['legs-yard'].hardCornerSaturationFrames);
    assert.ok(x['legs-compact'].hardCornerPeakSlipMps > x['legs-yard'].hardCornerPeakSlipMps);
});

test('finite ground traction governs simultaneous acceleration/strafe without velocity deletion', () => {
    for(const [id, config] of Object.entries(configs())) {
        const state = newState({ vz: -5, vx: 1.5 });
        const initial = Math.hypot(state.vx, state.vz);
        evolve(config, state, { throttle: 1, strafe: 1, steer: 1, brake: 0 }, 45);
        assert.ok(state.tractionUse >= 0 && state.tractionUse <= 1, id);
        assert.ok(state.footingLoad >= 0 && state.footingLoad <= 1, id);
        assert.ok(state.footSlipMps >= 0, id);
        assert.ok(Math.hypot(state.vx, state.vz) > 0, id + ' lost all momentum');
        assert.ok(initial > 0);
        for(const key of ['x','z','vx','vz','yaw','footingLoad','recoilLoad','tractionUse','lateralAcceleration'])
            assert.ok(Number.isFinite(state[key]), id + ' invalid ' + key);
    }
});

test('braking while turning is not mistaken for deliberate stationary brace', () => {
    for(const [id, config] of Object.entries(configs())) {
        const state = newState({ vz: -5 });
        evolve(config, state, { ...neutral, brake: 1, steer: 1 }, 60);
        assert.equal(state.braced, false, id);
        assert.equal(state.brace, 0, id);
        assert.ok(Number.isFinite(state.yaw));
        assert.ok(Math.hypot(state.vx,state.vz) < 5, id + ' failed to brake');
    }
});

test('firing while moving adds a footing disturbance that recovers through actual installed grip', () => {
    const retained = {};
    for(const [id,config] of Object.entries(configs())) {
        const state = newState({ vz: -4, vx: .4 });
        const before = { ...state };
        applyRecoil(state,config,0,-1,WEAPONS['gun-short'].recoilImpulseNs);
        assert.ok(state.recoilLoad > 0 && state.recoilLoad <= 1, id);
        assert.ok(state.vx === before.vx, 'straight shot preserves existing lateral momentum');
        assert.notEqual(state.vz, before.vz, 'round delivers real backward impulse');
        const init = state.recoilLoad;
        evolve(config,state,{...neutral, throttle:1},15);
        assert.ok(state.recoilLoad < init, id + ' failed to recover');
        retained[id] = state.recoilLoad;
    }
    assert.ok(retained['legs-compact'] > retained['legs-yard'],
        'Kestrel feet stay upset longer than workhorse feet');
    assert.ok(retained['legs-yard'] > retained['legs-hauler'],
        'Hauler settles quickest under identical gun impulse');
});

test('destroyed drive does not create phantom positive traction or extra power', () => {
    const base = configs()['legs-yard'];
    const derated = derateRigConfig(base,{left:0,right:0,powerFactor:0});
    const state = newState({ vz:-4, vx:1 });
    evolve(derated,state,{...neutral, throttle:1, strafe:1},90);
    assert.equal(state.braced,false);
    assert.ok(Math.hypot(state.vx,state.vz) <= Math.hypot(1,4) + 1e-6);
    assert.ok(state.footingLoad >= 0 && state.footingLoad <= 1);
});

test('there are no new slots/serial IDs and mobile controls still use existing movement/brake surfaces', () => {
    assert.equal(new Set(CATALOG.map(p=>p.id)).size, CATALOG.length);
    assert.equal(CATALOG.length,14);
    const read = file => fs.readFileSync(new URL(file,import.meta.url),'utf8');
    const html = read('../index.html'), controls = read('../controls.js');
    const main = read('../main.js'), scene = read('../scene.js');
    assert.match(html,/0\.0\.1k\.3v\.5 — Three Cockpit Identities/);
    assert.match(html,/main\.js\?v=k3v5/);
    assert.match(html,/audio\.js\?v=k3v3/);
    assert.match(controls,/this\.keyboard\.has\('Space'\)/);
    assert.match(html,/id="drive-zone"/);
    assert.match(html,/id="brake"/);
    assert.match(main,/soundFootScrape/);
    assert.match(main,/soundDriveStrain/);
    assert.match(main,/slip: rig\.footSlipMps, footing: rig\.footingLoad, recoil: rig\.recoilLoad/);
    assert.match(scene,/FOOT SCRAPE/);
    assert.match(scene,/state\.lateralAcceleration/);
});
