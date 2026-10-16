import test from 'node:test';
import assert from 'node:assert/strict';
import {
    advanceTacticalAwareness, chooseCoverPoint, createTacticalAwareness,
    noteBlockedFire, noteIncomingFire, recentThreatTargetId, tacticalLineOfSight,
} from '../tacticalAwareness.js';
import { contractById } from '../contracts.js';
import { DEFAULT_WORLD } from '../locomotion.js';

const rig = (x, z) => ({ x, z, yaw: 0, yawRate: 0, vx: 0, vz: 0, forwardSpeed: 0, lateralSpeed: 0 });

test('authoritative arena geometry informs tactical line of sight', () => {
    assert.equal(tacticalLineOfSight(rig(0, -10), rig(0, 10), DEFAULT_WORLD), false);
    assert.equal(tacticalLineOfSight(rig(-28, -8), rig(-28, 8), DEFAULT_WORLD), true);
});

test('incoming fire records a short-lived attacker memory for reactive targeting', () => {
    const awareness = createTacticalAwareness();
    noteIncomingFire(awareness, rig(4, 2), 'enemy-2', 1.2);
    assert.equal(recentThreatTargetId(awareness), 'enemy-2');
    assert.deepEqual(awareness.lastThreat, { x: 4, z: 2 });
    assert.ok(awareness.underFireSeconds > 2.5);
});

test('cover candidates are actual protected positions, not random nearby waypoints', () => {
    const world = {
        minX: -12, maxX: 12, minZ: -12, maxZ: 12,
        obstacles: [{ id: 'screen', minX: 2, maxX: 4, minZ: -1, maxZ: 1, height: 3, kind: 'barrier' }],
    };
    const enemy = rig(0, 5), threat = rig(0, -6);
    const cover = chooseCoverPoint(enemy, threat, world, .9, contractById('cutter').behavior, 1, threat);
    assert.ok(cover);
    assert.equal(cover.coverId, 'screen');
    assert.equal(tacticalLineOfSight(threat, cover.point, world), false);
});

test('Cutter reacts to a hit faster than Mule while both retain personality', () => {
    const world = {
        minX: -12, maxX: 12, minZ: -12, maxZ: 12,
        obstacles: [{ id: 'screen', minX: 2, maxX: 4, minZ: -1, maxZ: 1, height: 3, kind: 'barrier' }],
    };
    const enemy = rig(0, 5), threat = rig(0, -6);
    const cutter = { awareness: createTacticalAwareness() };
    const mule = { awareness: createTacticalAwareness() };
    noteIncomingFire(cutter, threat, 'player', 1.0);
    noteIncomingFire(mule, threat, 'player', 1.0);
    const fast = advanceTacticalAwareness(cutter, enemy, threat, .16, world, .9, contractById('cutter').behavior, 1);
    const heavy = advanceTacticalAwareness(mule, enemy, threat, .16, world, .9, contractById('mule').behavior, 1);
    assert.equal(fast.mode, 'SEEK_COVER');
    assert.equal(heavy.mode, 'UNDER_FIRE');
});

test('a blocked firing lane produces a deterministic reposition intent', () => {
    const owner = { awareness: createTacticalAwareness() };
    noteBlockedFire(owner, 'loading-house');
    const decision = advanceTacticalAwareness(owner, rig(-8, -8), rig(-8, 8), .1,
        { minX: -20, maxX: 20, minZ: -20, maxZ: 20, obstacles: [] }, .9,
        contractById('yard-dog').behavior, 1);
    assert.equal(decision.mode, 'REPOSITION');
    assert.equal(decision.blockedBy, 'loading-house');
    assert.ok(Math.abs(decision.strength) >= .7);
});


test('sustained incoming fire accumulates reaction time instead of restarting it', () => {
    const owner = { awareness: createTacticalAwareness() };
    const source = rig(0, -5);
    noteIncomingFire(owner, source, 'player', .5);
    owner.awareness.underFireElapsed = .4;
    noteIncomingFire(owner, source, 'player', .5);
    assert.equal(owner.awareness.underFireElapsed, .4);
});

test('repeated blocked shots commit to one reposition lane until memory expires', () => {
    const owner = { awareness: createTacticalAwareness() };
    noteBlockedFire(owner, 'screen');
    const first = owner.awareness.repositionSide;
    noteBlockedFire(owner, 'screen');
    assert.equal(owner.awareness.repositionSide, first);
    assert.equal(owner.awareness.blockedLaneCommitted, true);
});
