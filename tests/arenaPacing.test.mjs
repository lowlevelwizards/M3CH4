import test from 'node:test';
import assert from 'node:assert/strict';
import { contractById } from '../contracts.js';
import { advanceEnemyMotion, createEnemyMotion } from '../enemyMotion.js';
import {
    createRigState, DEFAULT_RIG_CONFIG, DEFAULT_WORLD, HOSTILE_SPAWN, PLAYER_SPAWN, stepRig,
} from '../locomotion.js';
import {
    clearMachineSave, MACHINE_SAVE_KEY, MACHINE_SAVE_V3_KEY, MACHINE_SAVE_V4_KEY,
    MACHINE_SAVE_V5_KEY, MACHINE_SAVE_V6_KEY,
} from '../persistence.js';

const insideWorld = point => point.x > DEFAULT_WORLD.minX && point.x < DEFAULT_WORLD.maxX &&
    point.z > DEFAULT_WORLD.minZ && point.z < DEFAULT_WORLD.maxZ;

test('beginner arena starts opponents far apart on opposite ends', () => {
    assert.ok(insideWorld(PLAYER_SPAWN));
    assert.ok(insideWorld(HOSTILE_SPAWN));
    assert.ok(Math.hypot(PLAYER_SPAWN.x - HOSTILE_SPAWN.x, PLAYER_SPAWN.z - HOSTILE_SPAWN.z) >= 40);
    const player = createRigState();
    const hostile = createRigState(HOSTILE_SPAWN);
    assert.deepEqual([player.x, player.z, player.yaw], [PLAYER_SPAWN.x, PLAYER_SPAWN.z, PLAYER_SPAWN.yaw]);
    assert.deepEqual([hostile.x, hostile.z, hostile.yaw], [HOSTILE_SPAWN.x, HOSTILE_SPAWN.z, HOSTILE_SPAWN.yaw]);
});

test('central loading house deliberately breaks the initial direct lane', () => {
    const house = DEFAULT_WORLD.obstacles.find(obstacle => obstacle.id === 'loading-house');
    assert.ok(house);
    assert.ok(house.minX < PLAYER_SPAWN.x && house.maxX > PLAYER_SPAWN.x);
    assert.ok(HOSTILE_SPAWN.z < house.minZ && PLAYER_SPAWN.z > house.maxZ);
    assert.ok(house.height >= 4);
    assert.ok(DEFAULT_WORLD.maxX - DEFAULT_WORLD.minX >= 60);
    assert.ok(DEFAULT_WORLD.maxZ - DEFAULT_WORLD.minZ >= 50);
});

test('Yard Dog navigation can route around central cover toward the player', () => {
    const behavior = contractById('yard-dog').behavior;
    const motion = createEnemyMotion(behavior);
    const enemy = createRigState(HOSTILE_SPAWN);
    const player = createRigState(PLAYER_SPAWN);
    let lateralExcursion = 0;
    const dt = 1 / 60;
    for (let i = 0; i < 60 * 22; i++) {
        const command = advanceEnemyMotion(motion, enemy, player, dt, true, DEFAULT_WORLD, DEFAULT_RIG_CONFIG.collisionRadiusM, behavior);
        stepRig(enemy, command, dt, DEFAULT_RIG_CONFIG, DEFAULT_WORLD);
        lateralExcursion = Math.max(lateralExcursion, Math.abs(enemy.x));
    }
    assert.ok(enemy.z > -10, `enemy should make forward progress, got z=${enemy.z.toFixed(2)}`);
    assert.ok(lateralExcursion > 5.5, `enemy should route around the loading house, x excursion=${lateralExcursion.toFixed(2)}`);
});

test('DEV wipe deletes every machine save generation and nothing unrelated', () => {
    const values = new Map([
        [MACHINE_SAVE_KEY, 'v1'],
        [MACHINE_SAVE_V3_KEY, 'v3'],
        [MACHINE_SAVE_V4_KEY, 'v4'],
        [MACHINE_SAVE_V5_KEY, 'v5'],
        [MACHINE_SAVE_V6_KEY, 'v6'],
        ['unrelated-setting', 'keep'],
    ]);
    const storage = {
        getItem: key => values.has(key) ? values.get(key) : null,
        setItem: (key, value) => values.set(key, value),
        removeItem: key => values.delete(key),
    };
    assert.equal(clearMachineSave(storage), true);
    for (const key of [MACHINE_SAVE_KEY, MACHINE_SAVE_V3_KEY, MACHINE_SAVE_V4_KEY, MACHINE_SAVE_V5_KEY, MACHINE_SAVE_V6_KEY])
        assert.equal(values.has(key), false, key);
    assert.equal(values.get('unrelated-setting'), 'keep');
});
