import test from 'node:test';
import assert from 'node:assert/strict';
import { firstCoverHit, rayAabbHit } from '../coverTruth.js';

const wall = { id: 'wall', minX: -1, maxX: 1, minZ: 4, maxZ: 5, height: 3 };

test('tall cover blocks a muzzle-to-target ray before the target', () => {
    const hit = firstCoverHit({ x: 0, y: 1.8, z: 0 }, { x: 0, y: 0, z: 1 }, [wall], 20, 0);
    assert.ok(hit);
    assert.equal(hit.id, 'wall');
    assert.equal(hit.distance, 4);
});

test('low cover does not block a ray that genuinely clears its top', () => {
    const low = { id: 'low', minX: -1, maxX: 1, minZ: 4, maxZ: 5, height: 1.1 };
    const hit = firstCoverHit({ x: 0, y: 2.0, z: 0 }, { x: 0, y: 0, z: 1 }, [low], 20, 0.02);
    assert.equal(hit, null);
});

test('small ballistic skin closes shallow cover-edge precision gaps', () => {
    const edge = { id: 'edge', minX: -1, maxX: 1, minZ: 4, maxZ: 5, height: 3 };
    const origin = { x: 1.02, y: 1.8, z: 0 };
    const direction = { x: 0, y: 0, z: 1 };
    assert.equal(rayAabbHit(origin, direction, edge, 20, 0), null);
    assert.ok(rayAabbHit(origin, direction, edge, 20, 0.035));
});

test('nearest cover wins when several obstacles share the shot line', () => {
    const near = { id: 'near', minX: -1, maxX: 1, minZ: 3, maxZ: 4, height: 3 };
    const far = { id: 'far', minX: -1, maxX: 1, minZ: 8, maxZ: 9, height: 3 };
    const hit = firstCoverHit({ x: 0, y: 1.5, z: 0 }, { x: 0, y: 0, z: 1 }, [far, near], 20, 0);
    assert.equal(hit?.id, 'near');
    assert.equal(hit?.distance, 3);
});
