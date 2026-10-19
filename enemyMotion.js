import { selectedContract } from './contracts.js';
import { DEFAULT_WORLD } from './locomotion.js';
import { advanceTacticalAwareness, createTacticalAwareness } from './tacticalAwareness.js';

const clamp = (n) => Math.max(-1, Math.min(1, n));
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const valid = (p, world, radius) => p.x >= world.minX + radius && p.x <= world.maxX - radius && p.z >= world.minZ + radius && p.z <= world.maxZ - radius;

function activeBehavior(motion, override = null) {
    return override ?? motion?.behavior ?? selectedContract().behavior;
}

export function createEnemyMotion(behavior = selectedContract().behavior) {
    return {
        elapsed: 0,
        phase: 'APPROACH',
        route: null,
        stuckSeconds: 0,
        recoveryLeft: 0,
        recoveryCooldown: 0,
        recoveryInput: { throttle: -.8, strafe: 0, steer: .7 },
        lastPosition: null,
        navigation: behavior?.label ?? 'TACTICAL',
        waypoint: null,
        lastSide: 1,
        scanBaseYaw:null,emergencySeconds:0,
        awareness: createTacticalAwareness(),
        behavior,
    };
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
        if (o.id === skipId || o.id === 'pilot-rig' || o.id === 'hostile-rig' || o.dynamic)
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
 * Retaining that pair until cleared prevents a rapid left/right oscillation. */
function detour(from, direction, blocker, world, pad, preferredSide) {
    const horizontal = Math.abs(direction.x) >= Math.abs(direction.z);
    const forwards = horizontal ? Math.sign(direction.x) || 1 : Math.sign(direction.z) || 1;
    const near = horizontal ? (forwards > 0 ? blocker.minX : blocker.maxX) : (forwards > 0 ? blocker.minZ : blocker.maxZ);
    const far = horizontal ? (forwards > 0 ? blocker.maxX : blocker.minX) : (forwards > 0 ? blocker.maxZ : blocker.minZ);
    const tangentMin = horizontal ? blocker.minZ : blocker.minX;
    const tangentMax = horizontal ? blocker.maxZ : blocker.maxX;
    let chosen = null, best = Infinity;
    for (const side of [-1, 1]) {
        const tangent = side < 0 ? tangentMin - pad : tangentMax + pad;
        const entry = horizontal ? { x: near - forwards * pad, z: tangent } : { x: tangent, z: near - forwards * pad };
        const exit = horizontal ? { x: far + forwards * pad, z: tangent } : { x: tangent, z: far + forwards * pad };
        // At the outer warehouse pillars, the full entry offset can cross a wall.
        // Clip ONLY along the approach axis, retaining lateral obstacle clearance.
        const inner = pad * .44 + .22;
        if (horizontal)
            entry.x = Math.max(world.minX + inner, Math.min(world.maxX - inner, entry.x));
        else
            entry.z = Math.max(world.minZ + inner, Math.min(world.maxZ - inner, entry.z));
        if (!valid(entry, world, inner) || !valid(exit, world, inner))
            continue;
        if (rayBox(from, entry, blocker, pad - 1.05) !== null)
            continue;
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
    const speedScale = Math.min(.85, Math.max(.24, d * .37));
    const throttle = clamp(localForward * speedScale - enemy.forwardSpeed * .22);
    const strafe = clamp(localRight * speedScale - enemy.lateralSpeed * .25);
    return { throttle, strafe, steer: 0, brake: d < 1.1 ? .24 : 0 };
}

function localTargetAxes(enemy, player, d) {
    const dx = player.x - enemy.x, dz = player.z - enemy.z;
    const safeDistance = Math.max(d, .001);
    const fX = Math.sin(enemy.yaw), fZ = -Math.cos(enemy.yaw);
    const rX = Math.cos(enemy.yaw), rZ = Math.sin(enemy.yaw);
    return {
        forward: (dx * fX + dz * fZ) / safeDistance,
        right: (dx * rX + dz * rZ) / safeDistance,
    };
}

/** Convert the authored contract personality into a desired local maneuver.
 * This layer chooses intent only. stepRig still supplies all acceleration, inertia,
 * grip, braking and damage derating, so a Cutter with ruined Kestrel legs cannot
 * magically execute its skirmisher plan and a Mule still turns like a Hauler. */
export function tacticalManeuver(motion, enemy, player, behavior = activeBehavior(motion)) {
    const d = distance(enemy, player);
    const axes = localTargetAxes(enemy, player, d);
    const error = headingError(enemy, player);
    const steer = clamp(error * behavior.steerGain - enemy.yawRate * behavior.yawRateDamping);
    const cycle = Math.max(.2, behavior.strafeSeconds + behavior.braceSeconds);
    const cycleIndex = Math.floor(motion.elapsed / cycle);
    const cycleTime = motion.elapsed - cycleIndex * cycle;
    const side = cycleIndex % 2 === 0 ? 1 : -1;
    const outer = behavior.preferredRangeM + behavior.rangeBandM;
    const inner = behavior.preferredRangeM - behavior.rangeBandM;

    if (d > outer) {
        motion.phase = behavior.id === 'bruiser' ? 'ADVANCE' : 'APPROACH';
        motion.navigation = `${behavior.label} · CLOSE ${d.toFixed(1)}m`;
        return {
            throttle: clamp(axes.forward * behavior.approachThrottle - enemy.forwardSpeed * .08),
            strafe: clamp(axes.right * behavior.approachThrottle + side * behavior.approachStrafe - enemy.lateralSpeed * .08),
            steer,
            brake: 0,
        };
    }

    if (d < inner) {
        const shouldBrace = behavior.closeAction === 'brace' && d > behavior.closeRetreatM;
        if (shouldBrace) {
            motion.phase = 'BRACE';
            motion.navigation = `${behavior.label} · HOLD GROUND ${d.toFixed(1)}m`;
            return { throttle: 0, strafe: side * behavior.strafeThrottle * .12, steer, brake: .52 };
        }
        motion.phase = 'DISENGAGE';
        motion.navigation = `${behavior.label} · BACK OFF ${d.toFixed(1)}m`;
        return {
            throttle: clamp(-axes.forward * behavior.retreatThrottle - enemy.forwardSpeed * .08),
            strafe: clamp(-axes.right * behavior.retreatThrottle + side * behavior.strafeThrottle * .38 - enemy.lateralSpeed * .08),
            steer,
            brake: 0,
        };
    }

    if (cycleTime < behavior.strafeSeconds) {
        motion.phase = behavior.id === 'skirmisher' ? 'CIRCLE' : behavior.id === 'bruiser' ? 'EDGE' : 'PRESSURE STEP';
        motion.navigation = `${behavior.label} · RANGE ${d.toFixed(1)}m`;
        return { throttle: 0, strafe: side * behavior.strafeThrottle, steer, brake: 0 };
    }

    motion.phase = 'BRACE';
    motion.navigation = `${behavior.label} · FIRE POSITION ${d.toFixed(1)}m`;
    return { throttle: 0, strafe: 0, steer, brake: behavior.id === 'skirmisher' ? .18 : .42 };
}

/** One deterministic fixed simulation step. Pass the SAME obstacle map used by stepRig.
 * The optional behavior argument is mainly for tests/tools; gameplay defaults to the
 * currently selected contract profile captured by createEnemyMotion(). */
export function advanceEnemyMotion(motion, enemy, player, dt, canMove = true, world = DEFAULT_WORLD, radius = .95, behavior = null, teamIntent = null) {
    if (!Number.isFinite(dt) || dt <= 0)
        return { throttle: 0, strafe: 0, steer: 0, brake: 1 };
    const profile = activeBehavior(motion, behavior);
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

    const tactical = advanceTacticalAwareness(motion, enemy, player, dt, world, radius, profile, motion.lastSide);
    const trackingPoint = tactical.mode === 'SEARCH' && tactical.point ? tactical.point : player;
    // A dangerous contact may interrupt an objective route, but not erase
    // its strategic assignment. Movement remains limited by actual stepRig.
    const emergencyCover=(tactical.mode==='SEEK_COVER'||tactical.mode==='TAKE_COVER')&&
        (motion.awareness?.underFireSeconds??0)>.2;
    const emergencyTurn=tactical.mode==='UNDER_FIRE'&&
        (motion.awareness?.underFireSeconds??0)>.2&&
        tactical.point&&distance(from,tactical.point)>.3;
    const navigationOrderActive=teamIntent?.mode==='ORDER'&&!emergencyCover&&!emergencyTurn;
    let base;
    // Only the pilot brain owns strategic intent. Movement tracks a reachable
    // route waypoint and turns the *chassis* toward it. Weapon facing is a
    // separate fire-control constraint, not a steering override.
    if (navigationOrderActive && teamIntent.point) {
        const point=teamIntent.point;
        const d=distance(from,point);
        if(d>1.6){
            base=driveToward(enemy,point,d);
            base.steer=clamp(headingError(enemy,point)*profile.steerGain-
                enemy.yawRate*profile.yawRateDamping);
            base.throttle*=teamIntent.throttleScale??1;
        }else{
            const hasContact=distance(enemy,player)>.3;
            if(!hasContact&&motion.scanBaseYaw===null)motion.scanBaseYaw=enemy.yaw;
            if(hasContact)motion.scanBaseYaw=null;
            const scanYaw=(motion.scanBaseYaw??enemy.yaw)+Math.sin(motion.elapsed*.48)*.85;
            const error=Math.atan2(Math.sin(scanYaw-enemy.yaw),Math.cos(scanYaw-enemy.yaw));
            const face=hasContact?clamp(headingError(enemy,player)*
                profile.steerGain-enemy.yawRate*profile.yawRateDamping):
                clamp(error*profile.steerGain-enemy.yawRate*profile.yawRateDamping);
            base={throttle:0,strafe:0,steer:face,brake:.85};
        }
        motion.phase='ORDER';
        motion.navigation=teamIntent.note??'EXECUTE TEAM ORDER';
        motion.waypoint=point;
    }
    else if (tactical.mode === 'SEEK_COVER' && tactical.point) {
        const d = distance(from, tactical.point);
        base = driveToward(enemy, tactical.point, d);
        base.steer = clamp(headingError(enemy, tactical.point) * profile.steerGain - enemy.yawRate * profile.yawRateDamping);
        motion.phase = 'SEEK COVER';
        motion.navigation = `SEEK COVER · ${tactical.coverId ?? 'AVAILABLE'} · ${d.toFixed(1)}m`;
        motion.waypoint = tactical.point;
    }
    else if (tactical.mode === 'TAKE_COVER') {
        const steer = clamp(headingError(enemy, motion.awareness?.lastThreat??player) *
            profile.steerGain - enemy.yawRate * profile.yawRateDamping);
        base = { throttle: 0, strafe: 0, steer, brake: .72 };
        motion.phase = 'TAKE COVER';
        motion.navigation = `TAKE COVER · ${tactical.coverId ?? 'PROTECTED'}`;
        motion.waypoint = tactical.point ?? null;
    }
    else if (emergencyTurn) {
        const point=tactical.point;
        const steer=clamp(headingError(enemy,point)*profile.steerGain-
            enemy.yawRate*profile.yawRateDamping);
        const d=distance(enemy,point);
        const side=motion.lastSide||1;
        base={throttle:d<3?-.35:-.16,
            strafe:side*(profile.id==='bruiser'?.13:.52),steer,brake:.18};
        motion.phase='UNDER FIRE';
        motion.navigation='DEFENSIVE TURN · UNKNOWN/REAR THREAT';
        motion.waypoint=null;
    }
    else if (tactical.mode === 'REPOSITION') {
        base = tacticalManeuver(motion, enemy, player, profile);
        base.throttle *= profile.id === 'bruiser' ? .55 : .28;
        base.strafe = clamp((tactical.side || 1) * Math.max(.35, tactical.strength ?? .6));
        motion.phase = 'REPOSITION';
        motion.navigation = `REPOSITION · CLEAR ${tactical.blockedBy ?? 'FIRE LANE'}`;
    }
    else if (tactical.mode === 'SEARCH') {
        base = tacticalManeuver(motion, enemy, trackingPoint, profile);
        motion.phase = 'REPOSITION';
        motion.navigation = `LAST CONTACT · ${tactical.blockedBy ?? 'LOS LOST'}`;
    }
    else if (teamIntent?.point) {
        const intentDistance = distance(from, teamIntent.point);
        const targetSteer = clamp(headingError(enemy, player) * profile.steerGain - enemy.yawRate * profile.yawRateDamping);
        if (teamIntent.mode === 'ANCHOR' && intentDistance < 2.2) {
            base = { throttle: 0, strafe: 0, steer: targetSteer, brake: Math.max(.52, teamIntent.brakeBias ?? 0) };
        }
        else if (intentDistance > 1.15) {
            base = driveToward(enemy, teamIntent.point, intentDistance);
            base.steer = targetSteer;
            base.throttle *= teamIntent.throttleScale ?? 1;
            base.strafe = clamp(base.strafe + (teamIntent.strafeBias ?? 0));
            base.brake = Math.max(base.brake ?? 0, teamIntent.brakeBias ?? 0);
        }
        else {
            base = tacticalManeuver(motion, enemy, player, profile);
        }
        motion.phase = teamIntent.mode ?? motion.phase;
        motion.navigation = `${teamIntent.role ?? 'SQUAD'} · ${teamIntent.note ?? teamIntent.mode ?? 'COORDINATE'}`;
        if (tactical.mode === 'UNDER_FIRE') motion.navigation = `UNDER FIRE · ${motion.navigation}`;
    }
    else {
        base = tacticalManeuver(motion, enemy, player, profile);
        if (tactical.mode === 'UNDER_FIRE') {
            motion.phase = 'UNDER FIRE';
            motion.navigation = `UNDER FIRE · ${motion.navigation}`;
        }
    }
    const dir = {
        x: Math.sin(enemy.yaw) * base.throttle + Math.cos(enemy.yaw) * base.strafe,
        z: -Math.cos(enemy.yaw) * base.throttle + Math.sin(enemy.yaw) * base.strafe,
    };
    const magnitude = Math.hypot(dir.x, dir.z);

    // The tactical A* route owns static-obstacle navigation. Don't run a
    // second independent local detour planner against the same wall; it can
    // continually override the selected route and trap the machine.
    if(navigationOrderActive)motion.route=null;
    if (!navigationOrderActive&&magnitude>.15&&!motion.route&&motion.recoveryCooldown<=0) {
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
            motion.stuckSeconds = 1.5;
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
            command = { ...driveToward(enemy, waypoint, dist),
                steer:clamp(headingError(enemy,waypoint)*profile.steerGain-
                    enemy.yawRate*profile.yawRateDamping) };
            motion.phase = 'BYPASS';
            motion.navigation = `BYPASS ${route.id} ${route.side < 0 ? 'A' : 'B'} ${route.index + 1}/2`;
            motion.waypoint = waypoint;
        }
    }

    if (!motion.route) {
        if (!navigationOrderActive && tactical.mode !== 'SEEK_COVER' && tactical.mode !== 'TAKE_COVER') motion.waypoint = null;
        motion.elapsed += dt;
    }

    const movingRequest = Math.hypot(command.throttle, command.strafe ?? 0) > .37 && motion.phase !== 'BRACE';
    const speed = Math.hypot(enemy.vx, enemy.vz);
    const displacement = motion.lastPosition ? distance(from, motion.lastPosition) : 0;
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

    // If tactical intent points beyond the walls, lean back into the playable
    // space rather than grinding against a boundary. Existing bypass/recovery
    // still owns obstacle failures; this only handles the warehouse perimeter.
    if (!motion.route && magnitude > .15) {
        const safe = radius + 1.1;
        const projected = { x: from.x + dir.x * 3, z: from.z + dir.z * 3 };
        const inside = {
            x: Math.max(world.minX + safe, Math.min(world.maxX - safe, projected.x)),
            z: Math.max(world.minZ + safe, Math.min(world.maxZ - safe, projected.z)),
        };
        if (distance(projected, inside) > .25) {
            const redirect = driveToward(enemy, inside, distance(from, inside));
            command = { ...redirect, steer: base.steer };
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
