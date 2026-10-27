/** k.3k.4 — pure ballistic cover certificate.
 *
 * Three.js raycasts remain the visual/mesh source of truth for precise rig hits.
 * This small independent slab test verifies that a shot segment does not cross one
 * of the arena's authoritative obstacle prisms first. It closes precision/edge gaps
 * and gives DEV diagnostics an explicit cover identity.
 */
import {collisionPieces} from './backlotCompoundGeometry.js';
const EPS = 1e-8;
const n = value => Number.isFinite(Number(value)) ? Number(value) : 0;

function component(vector, axis) {
    if (Array.isArray(vector)) return n(vector[axis === 'x' ? 0 : axis === 'y' ? 1 : 2]);
    return n(vector?.[axis]);
}

/** Return the first distance along a normalized ray that enters an AABB. */
export function rayAabbHit(origin, direction, box, maxDistance = 100, padding = 0) {
    const pad = Math.max(0, n(padding));
    const bounds = {
        x: [n(box.minX) - pad, n(box.maxX) + pad],
        y: [n(box.minY ?? 0) - pad, n(box.maxY ?? box.height ?? 1.1) + pad],
        z: [n(box.minZ) - pad, n(box.maxZ) + pad],
    };
    let enter = 0;
    let exit = Math.max(0, n(maxDistance));
    let normal = [0, 0, 0];
    for (const axis of ['x', 'y', 'z']) {
        const o = component(origin, axis);
        const d = component(direction, axis);
        const [lo, hi] = bounds[axis];
        if (Math.abs(d) < EPS) {
            if (o < lo || o > hi) return null;
            continue;
        }
        let tNear = (lo - o) / d;
        let tFar = (hi - o) / d;
        let nearNormal = axis === 'x' ? [-1, 0, 0] : axis === 'y' ? [0, -1, 0] : [0, 0, -1];
        if (tNear > tFar) {
            [tNear, tFar] = [tFar, tNear];
            nearNormal = nearNormal.map(value => -value);
        }
        if (tNear > enter) {
            enter = tNear;
            normal = nearNormal;
        }
        exit = Math.min(exit, tFar);
        if (enter > exit) return null;
    }
    if (exit < 0 || enter > maxDistance) return null;
    const distance = Math.max(0, enter);
    const point = [
        component(origin, 'x') + component(direction, 'x') * distance,
        component(origin, 'y') + component(direction, 'y') * distance,
        component(origin, 'z') + component(direction, 'z') * distance,
    ];
    return { distance, point, normal };
}

/** Find the nearest authoritative arena obstacle intersected by the ray. */
export function firstCoverHit(origin, direction, obstacles, maxDistance = 100, padding = 0.035) {
    let best = null;
    for (const obstacle of obstacles ?? []) {
        for(const piece of collisionPieces(obstacle)){
            const hit = rayAabbHit(origin, direction, piece, maxDistance, padding);
            if (!hit || (best && hit.distance >= best.distance)) continue;
            best = { ...hit, id: obstacle.id ?? 'arena-cover',
                partId:piece.partId??obstacle.partId??obstacle.id,obstacle };
        }
    }
    return best;
}
