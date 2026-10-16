from pathlib import Path

ROOT = Path('.')
def read(path): return (ROOT / path).read_text()
def write(path, text): (ROOT / path).write_text(text)
def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected exactly one match, found {count}')
    return text.replace(old, new, 1)

# -----------------------------------------------------------------------------
# tacticalAwareness.js — pure perception / memory / cover-intent layer.
# It never moves a rig: enemyMotion remains the locomotion-facing authority.
# -----------------------------------------------------------------------------
write('tacticalAwareness.js', r"""import { firstCoverHit } from './coverTruth.js';

const distance = (a, b) => Math.hypot((a?.x ?? 0) - (b?.x ?? 0), (a?.z ?? 0) - (b?.z ?? 0));
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

const RESPONSE = Object.freeze({
    skirmisher: Object.freeze({ reactionSeconds: .14, urgencyThreshold: .92, holdSeconds: .65, maxCoverDistance: 14, rangePenalty: .16, reposition: .92 }),
    pressure: Object.freeze({ reactionSeconds: .52, urgencyThreshold: 1.28, holdSeconds: .95, maxCoverDistance: 12, rangePenalty: .20, reposition: .72 }),
    bruiser: Object.freeze({ reactionSeconds: 1.20, urgencyThreshold: 1.82, holdSeconds: 1.28, maxCoverDistance: 8.5, rangePenalty: .27, reposition: .44 }),
});

function responseFor(behavior) {
    return RESPONSE[behavior?.id] ?? RESPONSE.pressure;
}

function stateOf(owner) {
    return owner?.awareness ?? owner;
}

export function createTacticalAwareness() {
    return {
        lineOfSight: true,
        blockerId: null,
        exposedSeconds: 0,
        unseenSeconds: 0,
        underFireSeconds: 0,
        underFireElapsed: 0,
        urgency: 0,
        recentAttackerId: null,
        lastThreat: null,
        lastSeenTarget: null,
        blockedFireSeconds: 0,
        blockedBy: null,
        repositionSide: 1,
        coverTarget: null,
        coverId: null,
        coverHold: 0,
        decisionCooldown: 0,
    };
}

/** A shot does not have to destroy something to matter tactically. Severity is a
 * small perception hint, not damage math: 0.5 = incoming fire, 1 = armor hit,
 * ~1.5 = internal hit. */
export function noteIncomingFire(owner, sourceRig, sourceId, severity = 1) {
    const state = stateOf(owner);
    if (!state) return;
    const strength = clamp(Number(severity) || 0, .25, 2.5);
    state.underFireSeconds = Math.max(state.underFireSeconds || 0, 2.35 + strength * .55);
    state.underFireElapsed = 0;
    state.urgency = Math.max(state.urgency || 0, strength);
    state.recentAttackerId = sourceId ?? state.recentAttackerId;
    if (sourceRig)
        state.lastThreat = { x: Number(sourceRig.x) || 0, z: Number(sourceRig.z) || 0 };
}

/** Repeatedly wasting fire into cover or another rig is itself tactical evidence:
 * stop holding the same bad lane and sidestep to reacquire. */
export function noteBlockedFire(owner, blockerId = null) {
    const state = stateOf(owner);
    if (!state) return;
    state.blockedFireSeconds = Math.max(state.blockedFireSeconds || 0, 1.8);
    state.blockedBy = blockerId ?? state.blockedBy;
    state.repositionSide = state.repositionSide === 1 ? -1 : 1;
}

export function recentThreatTargetId(owner) {
    const state = stateOf(owner);
    return state?.underFireSeconds > 0 ? state.recentAttackerId ?? null : null;
}

function staticObstacles(world) {
    return (world?.obstacles ?? []).filter(obstacle => !obstacle.dynamic);
}

/** Body-height tactical LOS. Ballistic raycasts remain authoritative for actual fire;
 * this is only what the pilot/AI believes about the lane. */
export function tacticalCoverBlocker(from, to, world, height = 1.85) {
    if (!from || !to) return null;
    const dx = (to.x ?? 0) - (from.x ?? 0);
    const dz = (to.z ?? 0) - (from.z ?? 0);
    const d = Math.hypot(dx, dz);
    if (d < .15) return null;
    return firstCoverHit(
        [from.x, height, from.z], [dx / d, 0, dz / d],
        staticObstacles(world), Math.max(0, d - .18), .045);
}

export function tacticalLineOfSight(from, to, world) {
    return !tacticalCoverBlocker(from, to, world);
}

function insideExpanded(point, box, pad) {
    return point.x >= box.minX - pad && point.x <= box.maxX + pad &&
        point.z >= box.minZ - pad && point.z <= box.maxZ + pad;
}

function validPoint(point, world, radius) {
    return point.x >= world.minX + radius && point.x <= world.maxX - radius &&
        point.z >= world.minZ + radius && point.z <= world.maxZ - radius;
}

/** Sample one protected point behind each substantial obstacle relative to threat.
 * This is deliberately not navmesh/pathfinding. The resulting point is an intent;
 * enemyMotion's existing detour/stuck recovery still decides how the machine gets there. */
export function chooseCoverPoint(enemy, target, world, radius, behavior, preferredSide = 1, threatOverride = null) {
    const response = responseFor(behavior);
    const threat = threatOverride ?? target;
    if (!enemy || !threat || !world) return null;
    let best = null;
    let bestScore = Infinity;
    const dynamic = (world.obstacles ?? []).filter(obstacle => obstacle.dynamic);

    for (const obstacle of staticObstacles(world)) {
        const height = Number(obstacle.height ?? obstacle.maxY ?? 1.1);
        // Tiny pillars and waist-high barricades are useful movement geometry but poor
        // whole-rig emergency cover for this first awareness pass.
        if (height < 2.25 || obstacle.kind === 'pillar') continue;
        const cx = (obstacle.minX + obstacle.maxX) * .5;
        const cz = (obstacle.minZ + obstacle.maxZ) * .5;
        let nx = cx - threat.x, nz = cz - threat.z;
        const length = Math.hypot(nx, nz);
        if (length < .1) continue;
        nx /= length; nz /= length;
        const hx = (obstacle.maxX - obstacle.minX) * .5;
        const hz = (obstacle.maxZ - obstacle.minZ) * .5;
        const support = Math.abs(nx) * hx + Math.abs(nz) * hz + radius + .72;
        const tx = -nz, tz = nx;
        for (const sideOffset of [0, preferredSide * .95, -preferredSide * .95]) {
            const point = { x: cx + nx * support + tx * sideOffset, z: cz + nz * support + tz * sideOffset };
            if (!validPoint(point, world, radius + .25)) continue;
            const travel = distance(enemy, point);
            if (travel > response.maxCoverDistance) continue;
            // The candidate must genuinely put authoritative geometry between threat
            // and the body, otherwise it is just a random waypoint beside a crate.
            if (!tacticalCoverBlocker(threat, point, world, 1.55)) continue;
            let occupied = false;
            for (const body of dynamic) {
                if (insideExpanded(point, body, radius + .7)) { occupied = true; break; }
            }
            if (occupied) continue;
            const rangeError = Math.abs(distance(point, target) - (behavior?.preferredRangeM ?? 6));
            const substantialBonus = obstacle.kind === 'building' ? 1.0 : obstacle.kind === 'container' ? .45 : .2;
            const score = travel + rangeError * response.rangePenalty - substantialBonus;
            if (score < bestScore) {
                bestScore = score;
                best = { point, coverId: obstacle.id ?? 'cover', score };
            }
        }
    }
    return best;
}

/** Advance perception and choose a tactical INTENT. No physics live here. */
export function advanceTacticalAwareness(owner, enemy, target, dt, world, radius, behavior, preferredSide = 1) {
    const state = stateOf(owner);
    if (!state || !Number.isFinite(dt) || dt <= 0)
        return { mode: 'ENGAGE', lineOfSight: true, point: target ? { x: target.x, z: target.z } : null };

    state.underFireSeconds = Math.max(0, state.underFireSeconds - dt);
    state.blockedFireSeconds = Math.max(0, state.blockedFireSeconds - dt);
    state.decisionCooldown = Math.max(0, state.decisionCooldown - dt);
    state.urgency = Math.max(0, state.urgency - dt * .18);
    if (state.underFireSeconds > 0) state.underFireElapsed += dt;
    else {
        state.underFireElapsed = 0;
        state.recentAttackerId = null;
    }

    const blocker = tacticalCoverBlocker(enemy, target, world);
    state.lineOfSight = !blocker;
    state.blockerId = blocker?.id ?? null;
    if (state.lineOfSight) {
        state.exposedSeconds += dt;
        state.unseenSeconds = 0;
        state.lastSeenTarget = { x: target.x, z: target.z };
    }
    else {
        state.unseenSeconds += dt;
        state.exposedSeconds = Math.max(0, state.exposedSeconds - dt * .35);
    }

    const response = responseFor(behavior);
    if (state.coverTarget) {
        const remaining = distance(enemy, state.coverTarget);
        if (remaining > .82) {
            return { mode: 'SEEK_COVER', point: state.coverTarget, coverId: state.coverId, lineOfSight: state.lineOfSight };
        }
        state.coverHold += dt;
        const protectedHold = response.holdSeconds + Math.min(1.0, state.underFireSeconds * .25);
        if (!state.lineOfSight && state.coverHold < protectedHold) {
            return { mode: 'TAKE_COVER', point: state.coverTarget, coverId: state.coverId, lineOfSight: false };
        }
        state.coverTarget = null;
        state.coverId = null;
        state.coverHold = 0;
        state.underFireSeconds *= .55;
        state.blockedFireSeconds = Math.max(state.blockedFireSeconds, .7);
    }

    const pressureEnough = state.underFireSeconds > 0 && state.lineOfSight &&
        (state.underFireElapsed >= response.reactionSeconds || state.urgency >= response.urgencyThreshold);
    if (pressureEnough && state.decisionCooldown <= 0) {
        const cover = chooseCoverPoint(enemy, target, world, radius, behavior, preferredSide, state.lastThreat ?? target);
        state.decisionCooldown = .34;
        if (cover) {
            state.coverTarget = cover.point;
            state.coverId = cover.coverId;
            state.coverHold = 0;
            return { mode: 'SEEK_COVER', point: cover.point, coverId: cover.coverId, lineOfSight: true };
        }
    }

    if (state.blockedFireSeconds > 0) {
        return {
            mode: 'REPOSITION', side: state.repositionSide,
            strength: response.reposition, blockedBy: state.blockedBy,
            lineOfSight: state.lineOfSight,
        };
    }

    // Do not grant omniscient pursuit once a target has been observed and then vanishes.
    // Move toward the last contact until line of sight is reacquired. At initial spawn,
    // where the central house hides everyone before first contact, retain the authored
    // approach behavior so the existing match opening does not stall.
    if (!state.lineOfSight && state.lastSeenTarget) {
        return { mode: 'SEARCH', point: state.lastSeenTarget, blockedBy: state.blockerId, lineOfSight: false };
    }

    return {
        mode: state.underFireSeconds > 0 ? 'UNDER_FIRE' : 'ENGAGE',
        point: { x: target.x, z: target.z }, lineOfSight: state.lineOfSight,
    };
}
""")

# -----------------------------------------------------------------------------
# enemyMotion.js — consume tactical intent before the existing obstacle planner.
# -----------------------------------------------------------------------------
enemy = read('enemyMotion.js')
enemy = replace_once(enemy,
"import { DEFAULT_WORLD } from './locomotion.js';",
"import { DEFAULT_WORLD } from './locomotion.js';\nimport { advanceTacticalAwareness, createTacticalAwareness } from './tacticalAwareness.js';",
'awareness import')
enemy = replace_once(enemy,
"""        waypoint: null,
        lastSide: 1,
        behavior,""",
"""        waypoint: null,
        lastSide: 1,
        awareness: createTacticalAwareness(),
        behavior,""",
'awareness state')
enemy = replace_once(enemy,
"""    const base = tacticalManeuver(motion, enemy, player, profile);
    const dir = {
        x: Math.sin(enemy.yaw) * base.throttle + Math.cos(enemy.yaw) * base.strafe,
        z: -Math.cos(enemy.yaw) * base.throttle + Math.sin(enemy.yaw) * base.strafe,
    };""",
"""    const tactical = advanceTacticalAwareness(motion, enemy, player, dt, world, radius, profile, motion.lastSide);
    const trackingPoint = tactical.mode === 'SEARCH' && tactical.point ? tactical.point : player;
    let base;
    if (tactical.mode === 'SEEK_COVER' && tactical.point) {
        const d = distance(from, tactical.point);
        base = driveToward(enemy, tactical.point, d);
        base.steer = clamp(headingError(enemy, player) * profile.steerGain - enemy.yawRate * profile.yawRateDamping);
        motion.phase = 'SEEK COVER';
        motion.navigation = `SEEK COVER · ${tactical.coverId ?? 'AVAILABLE'} · ${d.toFixed(1)}m`;
        motion.waypoint = tactical.point;
    }
    else if (tactical.mode === 'TAKE_COVER') {
        const steer = clamp(headingError(enemy, player) * profile.steerGain - enemy.yawRate * profile.yawRateDamping);
        base = { throttle: 0, strafe: 0, steer, brake: .72 };
        motion.phase = 'TAKE COVER';
        motion.navigation = `TAKE COVER · ${tactical.coverId ?? 'PROTECTED'}`;
        motion.waypoint = tactical.point ?? null;
    }
    else if (tactical.mode === 'REPOSITION') {
        base = tacticalManeuver(motion, enemy, player, profile);
        base.throttle *= profile.id === 'bruiser' ? .55 : .28;
        base.strafe = clamp((tactical.side || 1) * Math.max(.35, tactical.strength ?? .6));
        motion.phase = 'REPOSITION';
        motion.navigation = `REPOSITION · CLEAR ${tactical.blockedBy ?? 'FIRE LANE'}`;
    }
    else {
        base = tacticalManeuver(motion, enemy, trackingPoint, profile);
        if (tactical.mode === 'SEARCH') {
            motion.phase = 'REPOSITION';
            motion.navigation = `LAST CONTACT · ${tactical.blockedBy ?? 'LOS LOST'}`;
        }
        else if (tactical.mode === 'UNDER_FIRE') {
            motion.phase = 'UNDER FIRE';
            motion.navigation = `UNDER FIRE · ${motion.navigation}`;
        }
    }
    const dir = {
        x: Math.sin(enemy.yaw) * base.throttle + Math.cos(enemy.yaw) * base.strafe,
        z: -Math.cos(enemy.yaw) * base.throttle + Math.sin(enemy.yaw) * base.strafe,
    };""",
'tactical intent override')
# Preserve a tactical waypoint when no obstacle route exists; old code unconditionally erased it.
enemy = replace_once(enemy,
"""    if (!motion.route) {
        motion.waypoint = null;
        motion.elapsed += dt;
    }""",
"""    if (!motion.route) {
        if (tactical.mode !== 'SEEK_COVER' && tactical.mode !== 'TAKE_COVER') motion.waypoint = null;
        motion.elapsed += dt;
    }""",
'preserve tactical waypoint')
write('enemyMotion.js', enemy)

# -----------------------------------------------------------------------------
# main.js — threat-driven target switch, hit/fire notifications, blocked-lane memory.
# -----------------------------------------------------------------------------
main = read('main.js')
main = replace_once(main,
"import { advanceEnemyMotion, createEnemyMotion, withinFiringArc } from './enemyMotion.js';",
"import { advanceEnemyMotion, createEnemyMotion, withinFiringArc } from './enemyMotion.js';\nimport { noteBlockedFire, noteIncomingFire, recentThreatTargetId } from './tacticalAwareness.js';",
'awareness gameplay imports')
main = replace_once(main,
"""function resolveActorTarget(actor) {
    const candidates = liveOpponents(actor);
    actor.targetId = chooseSquadTarget(actor, candidates, actor.targetId);
    return actor.targetId ? candidates.find(candidate => candidate.id === actor.targetId) ?? null : null;
}""",
"""function resolveActorTarget(actor) {
    const candidates = liveOpponents(actor);
    const threatId = recentThreatTargetId(actor.motion);
    const threat = threatId ? candidates.find(candidate => candidate.id === threatId) : null;
    if (threat) {
        actor.targetId = threat.id;
        return threat;
    }
    actor.targetId = chooseSquadTarget(actor, candidates, actor.targetId);
    return actor.targetId ? candidates.find(candidate => candidate.id === actor.targetId) ?? null : null;
}""",
'recent attacker target priority')
main = replace_once(main,
"""    const actorOutput = hostileOutput(actor.condition, actor.behavior);
    if (!actorOutput.operational || !withinFiringArc(actor.rig, target.rig)) return;
    const [spreadX, spreadY] = hostileSpread(shotIndex, actorOutput.spreadRadians);""",
"""    const actorOutput = hostileOutput(actor.condition, actor.behavior);
    if (!actorOutput.operational || !withinFiringArc(actor.rig, target.rig)) return;
    // Do not knowingly waste a trigger cycle through solid cover. Actual ballistic
    // raycasts remain authoritative and can still discover low cover / intervening rigs.
    if (actor.motion?.awareness?.lineOfSight === false) return;
    const [spreadX, spreadY] = hostileSpread(shotIndex, actorOutput.spreadRadians);""",
'awareness firing gate')
main = replace_once(main,
"""    if (showColliders) arena.updateShotAudit(contact, !obstruction && contact.actorId === target.id);
    if (contact.slot === null || contact.actorId !== target.id) return;
    const consumed = fireWeapon(actor.weaponState, actor.weaponSpec);""",
"""    if (showColliders) arena.updateShotAudit(contact, !obstruction && contact.actorId === target.id);
    // AI pilots register fire directed at them even if a crate catches it. That gives
    // suppression/cover behavior before the first internal-damage event.
    if (target.id !== 'player' && target.motion)
        noteIncomingFire(target.motion, actor.rig, actor.id, contact.actorId === target.id ? 1.0 : .48);
    if (obstruction)
        noteBlockedFire(actor.motion, contact.blockedBy ?? (contact.actorId !== target.id ? contact.actorId : null));
    if (contact.slot === null || contact.actorId !== target.id) return;
    const consumed = fireWeapon(actor.weaponState, actor.weaponSpec);""",
'AI suppression and blocked lane')
main = replace_once(main,
"""    const afterPart = partSnapshot(target.condition.parts[contact.slot]);
    scoreHit(actor.id, target.id, contact.slot, beforePart, hit, afterPart);
    const visualHit = { ...hit, justDisabled: beforeIntegrity > 0 && hit.disabled, justDestroyed: !beforePart.destroyed && !!afterPart.destroyed };""",
"""    const afterPart = partSnapshot(target.condition.parts[contact.slot]);
    scoreHit(actor.id, target.id, contact.slot, beforePart, hit, afterPart);
    noteIncomingFire(target.motion, actor.rig, actor.id, hit.internalDamage > 0 ? 1.55 : 1.08);
    const visualHit = { ...hit, justDisabled: beforeIntegrity > 0 && hit.disabled, justDestroyed: !beforePart.destroyed && !!afterPart.destroyed };""",
'AI hit threat memory')
main = replace_once(main,
"""        const afterPart = partSnapshot(targetActor.condition.parts[contact.slot]);
        scoreHit('player', targetActor.id, contact.slot, beforePart, hit, afterPart);
        const visualHit = { ...hit, justDisabled: beforeIntegrity > 0 && hit.disabled, justDestroyed: !beforePart.destroyed && !!afterPart.destroyed };""",
"""        const afterPart = partSnapshot(targetActor.condition.parts[contact.slot]);
        scoreHit('player', targetActor.id, contact.slot, beforePart, hit, afterPart);
        noteIncomingFire(targetActor.motion, rig, 'player', hit.internalDamage > 0 ? 1.65 : 1.12);
        const visualHit = { ...hit, justDisabled: beforeIntegrity > 0 && hit.disabled, justDestroyed: !beforePart.destroyed && !!afterPart.destroyed };""",
'player hit threat memory')
write('main.js', main)

# -----------------------------------------------------------------------------
# Cache/version entry points.
# -----------------------------------------------------------------------------
html = read('index.html')
for old, new, label in [
    ('"./enemyMotion.js": "./enemyMotion.js?v=k3k0",', '"./enemyMotion.js": "./enemyMotion.js?v=k3m0",\n    "./tacticalAwareness.js": "./tacticalAwareness.js?v=k3m0",', 'AI cache'),
    ('<title>MECH ARENA — 0.0.1k.3l.5 — Cockpit + Aftermath Feel</title>', '<title>MECH ARENA — 0.0.1k.3m.0 — Tactical Awareness</title>', 'title'),
    ('<script type="module" src="./main.js?v=k3l5"></script>', '<script type="module" src="./main.js?v=k3m0"></script>', 'main cache'),
]:
    html = replace_once(html, old, new, label)
write('index.html', html)

# -----------------------------------------------------------------------------
# Deterministic tactical awareness tests.
# -----------------------------------------------------------------------------
write('tests/tacticalAwareness.test.mjs', r"""import test from 'node:test';
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
""")

write('tests/k3m0Integration.test.mjs', r"""import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('gameplay feeds real combat evidence into tactical memory', () => {
    const main = fs.readFileSync(new URL('../main.js', import.meta.url), 'utf8');
    assert.match(main, /recentThreatTargetId\(actor\.motion\)/);
    assert.match(main, /noteIncomingFire\(targetActor\.motion, rig, 'player'/);
    assert.match(main, /noteIncomingFire\(target\.motion, actor\.rig, actor\.id/);
    assert.match(main, /noteBlockedFire\(actor\.motion/);
});

test('enemy motion consumes awareness as intent while existing locomotion stays authoritative', () => {
    const source = fs.readFileSync(new URL('../enemyMotion.js', import.meta.url), 'utf8');
    assert.match(source, /advanceTacticalAwareness/);
    assert.match(source, /SEEK COVER/);
    assert.match(source, /TAKE COVER/);
    assert.match(source, /REPOSITION/);
    assert.doesNotMatch(source, /stepRig\(/);
});
""")
