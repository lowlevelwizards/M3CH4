import { DEFAULT_WORLD } from './locomotion.js';
const PHASES = [
    { seconds: 2.8, throttle: .7, strafe: 0, phase: 'APPROACH' },
    { seconds: 2.8, throttle: 0, strafe: .9, phase: 'STEP RIGHT' },
    { seconds: 2.2, throttle: -.65, strafe: 0, phase: 'RETREAT' },
    { seconds: 2.8, throttle: 0, strafe: -.9, phase: 'STEP LEFT' },
    { seconds: .8, throttle: 0, strafe: 0, phase: 'BRACE' },
];
const CYCLE = PHASES.reduce((sum, phase) => sum + phase.seconds, 0);
const clamp = (n) => Math.max(-1, Math.min(1, n));
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const valid = (p, world, radius) => p.x >= world.minX + radius && p.x <= world.maxX - radius && p.z >= world.minZ + radius && p.z <= world.maxZ - radius;
export function createEnemyMotion() {
    return { elapsed: 0, phase: 'APPROACH', route: null, stuckSeconds: 0,
        recoveryLeft: 0, recoveryCooldown: 0,
        recoveryInput: { throttle: -.8, strafe: 0, steer: .7 },
        lastPosition: null, navigation: 'CLEAR', waypoint: null, lastSide: 1 };
}
/** Signed yaw error toward the player, positive meaning clockwise/right. */
export function headingError(enemy, player) {
    const dx = player.x - enemy.x;
    const dz = player.z - enemy.z;
    if (dx * dx + dz * dz < .01)
        return 0;
    const desired = Math.atan2(dx, -dz);
    return Math.atan2(Math.sin(desired - enemy.yaw), Math.cos(desired - enemy.yaw));
}
/** Nearest first intersection with a circle-inflated obstacle, or null. */
function rayBox(start, end, o, pad) {
    let near = 0, far = 1;
    const axes = [
        [start.x, end.x - start.x, o.minX - pad, o.maxX + pad],
        [start.z, end.z - start.z, o.minZ - pad, o.maxZ + pad],
    ];
    for (const [origin, delta, min, max] of axes) {
        if (Math.abs(delta) < 1e-7) {
            if (origin < min || origin > max)
                return null;
            continue;
        }
        const t0 = (min - origin) / delta, t1 = (max - origin) / delta;
        near = Math.max(near, Math.min(t0, t1));
        far = Math.min(far, Math.max(t0, t1));
        if (near > far)
            return null;
    }
    return near;
}
function firstBlock(from, to, world, pad, skipId = '') {
    let closest = Infinity, found = null;
    for (const o of world.obstacles) {
        if (o.id === skipId || o.id === 'pilot-rig' || o.id === 'hostile-rig')
            continue;
        const hit = rayBox(from, to, o, pad);
        if (hit !== null && hit < closest) {
            closest = hit;
            found = o;
        }
    }
    return found;
}
/** Choose one of the two outside edges, with an entry and an exit corner.
 * Retaining that pair until cleared prevents a rapid left/right oscillation.
 */
function detour(from, direction, blocker, world, pad, preferredSide) {
    const horizontal = Math.abs(direction.x) >= Math.abs(direction.z);
    const forwards = horizontal ? Math.sign(direction.x) || 1 : Math.sign(direction.z) || 1;
    const near = horizontal ? (forwards > 0 ? blocker.minX : blocker.maxX) : (forwards > 0 ? blocker.minZ : blocker.maxZ);
    const far = horizontal ? (forwards > 0 ? blocker.maxX : blocker.minX) : (forwards > 0 ? blocker.maxZ : blocker.minZ);
    const tangentMin = horizontal ? blocker.minZ : blocker.minX;
    const tangentMax = horizontal ? blocker.maxZ : blocker.maxX;
    let chosen = null, best = Infinity;
    for (const side of [-1, 1]) {
        const tangent = (side < 0 ? tangentMin - pad : tangentMax + pad);
        const entry = horizontal ? { x: near - forwards * pad, z: tangent } : { x: tangent, z: near - forwards * pad };
        const exit = horizontal ? { x: far + forwards * pad, z: tangent } : { x: tangent, z: far + forwards * pad };
        // At the outer warehouse pillars, the full entry offset can cross a wall.
        // Clip ONLY along the approach axis, retaining lateral obstacle clearance.
        const inner = pad * .44 + .22; // always leaves approximately one rig radius
        if (horizontal)
            entry.x = Math.max(world.minX + inner, Math.min(world.maxX - inner, entry.x));
        else
            entry.z = Math.max(world.minZ + inner, Math.min(world.maxZ - inner, entry.z));
        if (!valid(entry, world, inner) || !valid(exit, world, inner))
            continue;
        if (rayBox(from, entry, blocker, pad - 1.05) !== null)
            continue;
        // Check the first leg against *other* obstacles; our own expanded box
        // is already skirted by the padding. Do not choose inaccessible corners.
        if (firstBlock(from, entry, world, pad - .22, blocker.id))
            continue;
        if (firstBlock(entry, exit, world, pad - .22, blocker.id))
            continue;
        const endpoint = { x: from.x + direction.x * 8, z: from.z + direction.z * 8 };
        const cost = distance(from, entry) + distance(entry, exit) + distance(exit, endpoint)
            + (side === preferredSide ? -.07 : 0);
        if (cost < best) {
            best = cost;
            chosen = { id: blocker.id, side, waypoints: [entry, exit], index: 0, age: 0 };
        }
    }
    return chosen;
}
function driveToward(enemy, point, distanceToPoint) {
    const dx = point.x - enemy.x, dz = point.z - enemy.z;
    const d = Math.max(distanceToPoint, .001);
    const fX = Math.sin(enemy.yaw), fZ = -Math.cos(enemy.yaw);
    const rX = Math.cos(enemy.yaw), rZ = Math.sin(enemy.yaw);
    const localForward = (dx * fX + dz * fZ) / d;
    const localRight = (dx * rX + dz * rZ) / d;
    // Damp with the actual simulated velocity; damaged drives still govern what
    // the mech can physically achieve. Slow down as a waypoint approaches.
    const speedScale = Math.min(.85, Math.max(.24, d * .37));
    const throttle = clamp(localForward * speedScale - enemy.forwardSpeed * .22);
    const strafe = clamp(localRight * speedScale - enemy.lateralSpeed * .25);
    return { throttle, strafe, steer: 0, brake: d < 1.1 ? .24 : 0 };
}
/** One deterministic fixed simulation step. Pass the SAME obstacle map used by stepRig.
 * The optional arguments preserve the earlier j.1 test/standalone call sites.
 */
export function advanceEnemyMotion(motion, enemy, player, dt, canMove = true, world = DEFAULT_WORLD, radius = .95) {
    if (!Number.isFinite(dt) || dt <= 0)
        return { throttle: 0, strafe: 0, steer: 0, brake: 1 };
    const from = { x: enemy.x, z: enemy.z };
    if (!canMove) {
        motion.route = null;
        motion.waypoint = null;
        motion.lastPosition = from;
        motion.navigation = 'DRIVE OFFLINE';
        motion.phase = 'BRACE';
        return { throttle: 0, strafe: 0, steer: 0, brake: 1 };
    }
    motion.recoveryCooldown = Math.max(0, motion.recoveryCooldown - dt);
    if (motion.recoveryLeft > 0) {
        motion.recoveryLeft = Math.max(0, motion.recoveryLeft - dt);
        motion.lastPosition = from;
        motion.phase = 'RECOVER';
        motion.navigation = 'BACK UP / RETRY';
        motion.waypoint = null;
        return { ...motion.recoveryInput, brake: 0 };
    }
    let remainder = motion.elapsed % CYCLE;
    const phase = PHASES.find(p => { remainder -= p.seconds; return remainder < 0; }) ?? PHASES[0];
    const error = headingError(enemy, player);
    const steer = clamp(error * 1.75 - enemy.yawRate * 1.15);
    const base = { throttle: phase.throttle, strafe: phase.strafe, steer, brake: phase.phase === 'BRACE' ? .35 : 0 };
    const dir = { x: Math.sin(enemy.yaw) * phase.throttle + Math.cos(enemy.yaw) * phase.strafe,
        z: -Math.cos(enemy.yaw) * phase.throttle + Math.sin(enemy.yaw) * phase.strafe };
    const magnitude = Math.hypot(dir.x, dir.z);
    if (magnitude > .15 && !motion.route && motion.recoveryCooldown <= 0) {
        const direction = { x: dir.x / magnitude, z: dir.z / magnitude };
        const endpoint = { x: from.x + direction.x * 5, z: from.z + direction.z * 5 };
        const blocker = firstBlock(from, endpoint, world, radius + .52);
        if (blocker) {
            const route = detour(from, direction, blocker, world, radius + 1.35, motion.lastSide);
            if (route) {
                motion.route = route;
                motion.lastSide = route.side;
                motion.stuckSeconds = 0;
            }
        }
    }
    let command = base;
    if (motion.route) {
        const route = motion.route;
        route.age += dt;
        if (route.age > 13)
            motion.stuckSeconds = 1.5; // Time-box an unreachable detour.
        let waypoint = route.waypoints[route.index];
        if (distance(from, waypoint) < .62) {
            if (route.index === 0) {
                route.index = 1;
                waypoint = route.waypoints[1];
            }
            else {
                motion.route = null;
                motion.recoveryCooldown = Math.max(motion.recoveryCooldown, 1.5);
            }
        }
        if (motion.route && waypoint) {
            const dist = distance(from, waypoint);
            command = { ...driveToward(enemy, waypoint, dist), steer };
            motion.phase = 'BYPASS';
            motion.navigation = `BYPASS ${route.id} ${route.side < 0 ? 'A' : 'B'} ${route.index + 1}/2`;
            motion.waypoint = waypoint;
        }
    }
    if (!motion.route) {
        motion.phase = phase.phase;
        motion.navigation = 'CLEAR';
        motion.waypoint = null;
        motion.elapsed += dt;
    }
    const movingRequest = Math.hypot(command.throttle, command.strafe ?? 0) > .37 && phase.phase !== 'BRACE';
    const speed = Math.hypot(enemy.vx, enemy.vz);
    const displacement = motion.lastPosition ? distance(from, motion.lastPosition) : 0;
    // Require both low speed and very little actual displacement, never just a
    // large distance to the player (a heavily damaged mech may simply be slow).
    if (movingRequest && speed < .19 && displacement < .008 && motion.recoveryCooldown <= 0)
        motion.stuckSeconds += dt;
    else
        motion.stuckSeconds = Math.max(0, motion.stuckSeconds - dt * 2);
    motion.lastPosition = from;
    if (motion.stuckSeconds > 1.45) {
        motion.recoveryInput = {
            throttle: Math.abs(command.throttle) > .16 ? -Math.sign(command.throttle) * .8 : -.7,
            strafe: Math.abs(command.strafe ?? 0) > .16 ? -Math.sign(command.strafe ?? 0) * .7 : 0,
            steer: motion.lastSide * .75,
        };
        motion.route = null;
        motion.stuckSeconds = 0;
        motion.recoveryLeft = .90;
        motion.recoveryCooldown = 2.15;
        motion.lastSide = motion.lastSide === 1 ? -1 : 1;
        motion.waypoint = null;
        motion.phase = 'RECOVER';
        motion.navigation = 'BACK UP / RETRY';
        return { ...motion.recoveryInput, brake: 0 };
    }
    // If the current time-limited maneuver points beyond the walls, lean back
    // into the playable space rather than pushing forever against a boundary.
    if (!motion.route && magnitude > .15) {
        const safe = radius + 1.1;
        const projected = { x: from.x + dir.x * 3, z: from.z + dir.z * 3 };
        const inside = { x: Math.max(world.minX + safe, Math.min(world.maxX - safe, projected.x)),
            z: Math.max(world.minZ + safe, Math.min(world.maxZ - safe, projected.z)) };
        if (distance(projected, inside) > .25) {
            const redirect = driveToward(enemy, inside, distance(from, inside));
            command = { ...redirect, steer };
            motion.navigation = 'WALL CLEARANCE';
            motion.phase = 'BYPASS';
            motion.waypoint = inside;
        }
    }
    return command;
}
/** Weapon mount is not a magic 360-degree turret: the forward firing arc remains. */
export function withinFiringArc(enemy, player) {
    return Math.abs(headingError(enemy, player)) < .95;
}
