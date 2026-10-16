import test from 'node:test';
import assert from 'node:assert/strict';
import { damageWreckIntegrity, shoveWreck, wreckCollisionRadius } from '../wreckPhysics.js';

test('fresh wrecks remain physical but settle into a smaller obstacle', () => {
    const base = 1.05;
    const fresh = wreckCollisionRadius(base, 0, false);
    const settled = wreckCollisionRadius(base, 3, false);
    assert.ok(fresh < base && fresh > base * .7);
    assert.ok(settled < fresh && settled > base * .5);
});

test('cleared wrecks keep a tiny footprint instead of a hard blocking wall', () => {
    const normal = wreckCollisionRadius(1, 2, false);
    const cleared = wreckCollisionRadius(1, 2, true);
    assert.ok(cleared < normal * .5);
    assert.ok(cleared >= .18);
});

test('moving rigs can slowly shove disabled wrecks while idle contact does nothing', () => {
    const wreck = { x: .8, z: 0 };
    const idle = shoveWreck({ x: 0, z: 0, vx: .05, vz: 0, yaw: Math.PI / 2 }, wreck, .9, .65, 1 / 60);
    assert.equal(idle, null);
    const moving = shoveWreck({ x: 0, z: 0, vx: 2.2, vz: 0, yaw: Math.PI / 2 }, wreck, .9, .65, 1 / 60);
    assert.ok(moving);
    assert.ok(moving.dx > 0);
    assert.ok(Math.abs(moving.dz) < .001);
    assert.ok(moving.dx < .05);
});

test('continued fire can reduce a mission-killed wreck to a nearly passable remnant', () => {
    let integrity = 1;
    integrity = damageWreckIntegrity(integrity, 47);
    assert.ok(integrity < 1 && integrity > .5);
    integrity = damageWreckIntegrity(integrity, 47);
    integrity = damageWreckIntegrity(integrity, 47);
    integrity = damageWreckIntegrity(integrity, 47);
    assert.equal(integrity, 0);
});
