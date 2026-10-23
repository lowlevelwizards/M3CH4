import { firstCoverHit } from './coverTruth.js';

const distance = (a, b) => Math.hypot((a?.x ?? 0) - (b?.x ?? 0), (a?.z ?? 0) - (b?.z ?? 0));
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

const RESPONSE = Object.freeze({
    skirmisher: Object.freeze({ reactionSeconds: .16, urgencyThreshold: .92, holdSeconds: .65, maxCoverDistance: 14, rangePenalty: .16, reposition: .92 }),
    pressure: Object.freeze({ reactionSeconds: .38, urgencyThreshold: 1.28, holdSeconds: .95, maxCoverDistance: 12, rangePenalty: .20, reposition: .72 }),
    bruiser: Object.freeze({ reactionSeconds: .78, urgencyThreshold: 1.82, holdSeconds: 1.28, maxCoverDistance: 8.5, rangePenalty: .27, reposition: .44 }),
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
        blockedLaneCommitted: false,
        repositionSide: 1,
        coverTarget: null,
        coverId: null,
        coverHold: 0,
        decisionCooldown: 0,
        unseenThreat:false,shotWarnings:0,
    };
}

/** A shot does not have to destroy something to matter tactically. Severity is a
 * small perception hint, not damage math: 0.5 = incoming fire, 1 = armor hit,
 * ~1.5 = internal hit. */
export function noteIncomingFire(owner, sourceRig, sourceId, severity = 1, observerRig=null) {
    const state = stateOf(owner);
    if (!state) return;
    const strength = clamp(Number(severity) || 0, .25, 2.5);
    const continuingPressure = (state.underFireSeconds || 0) > 0;
    state.underFireSeconds = Math.max(state.underFireSeconds || 0, 2.35 + strength * .55);
    // A burst of repeated shots is sustained pressure, not a sequence of brand-new
    // encounters. Preserve elapsed exposure so suppression eventually forces action.
    if (!continuingPressure) state.underFireElapsed = 0;
    state.urgency = Math.max(state.urgency || 0, strength);
    state.recentAttackerId = sourceId ?? state.recentAttackerId;
    if(sourceRig){
        // An impact can reveal APPROXIMATE approach bearing, not hidden
        // attacker coordinates. Observer position is supplied by the live
        // physics event; old test helpers without it retain old semantics.
        const dx=sourceRig.x-(observerRig?.x??sourceRig.x);
        const dz=sourceRig.z-(observerRig?.z??sourceRig.z);
        const length=Math.hypot(dx,dz);
        state.lastThreat=observerRig&&length>.1?
            {x:observerRig.x+dx/length*9,z:observerRig.z+dz/length*9}:
            {x:sourceRig.x,z:sourceRig.z};
        state.unseenThreat=!!observerRig;
    }
}

/** Repeatedly wasting fire into cover or another rig is itself tactical evidence:
 * stop holding the same bad lane and sidestep to reacquire. */
export function noteBlockedFire(owner, blockerId = null) {
    const state = stateOf(owner);
    if (!state) return;
    state.blockedFireSeconds = Math.max(state.blockedFireSeconds || 0, 1.8);
    state.blockedBy = blockerId ?? state.blockedBy;
    // Commit to one lane for this entire blocked-fire episode; repeated impacts on
    // the same bad lane extend the memory instead of producing left/right oscillation.
    if (!state.blockedLaneCommitted) {
        state.repositionSide = state.repositionSide === 1 ? -1 : 1;
        state.blockedLaneCommitted = true;
    }
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

/** Optical contact is not a torso-height firing certificate. A command cab
 * or shoulder can be visible above a barricade while the lower frame is
 * hidden. Sample actual 3D slopes from the cab optics to exposed modules.
 * Fire control must still independently test the real muzzle and meshes. */
export function tacticalRigVisible(from, to, world) {
    if (!from || !to) return false;
    const dx=to.x-from.x,dz=to.z-from.z;
    const groundDistance=Math.hypot(dx,dz);
    if(groundDistance<.15)return true;
    const eyeHeight=2.38;
    for(const targetHeight of [2.45,2.08,1.82]){
        const dy=targetHeight-eyeHeight;
        const rayLength=Math.hypot(dx,dy,dz);
        const hit=firstCoverHit(
            [from.x,eyeHeight,from.z],
            [dx/rayLength,dy/rayLength,dz/rayLength],
            staticObstacles(world),Math.max(0,rayLength-.18),.045);
        if(!hit)return true;
    }
    return false;
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
    if (state.blockedFireSeconds === 0) {
        state.blockedLaneCommitted = false;
        state.blockedBy = null;
    }
    state.decisionCooldown = Math.max(0, state.decisionCooldown - dt);
    state.urgency = Math.max(0, state.urgency - dt * .18);
    if (state.underFireSeconds > 0) state.underFireElapsed += dt;
    else {
        state.underFireElapsed = 0;
        state.recentAttackerId = null;
        state.shotSequence=0;
        state.shotWarnings=0;
        state.lastShotEvidenceAt=null;
    }

    const blocker = target ? tacticalCoverBlocker(enemy, target, world) : null;
    // Seeing an exposed command cab is genuine contact, even with the frame
    // behind cover. The muzzle ray is separately certified before firing.
    state.lineOfSight = !!target && tacticalRigVisible(enemy,target,world);
    state.blockerId = state.lineOfSight ? null : blocker?.id ?? null;
    if (state.lineOfSight) {
        state.exposedSeconds += dt;
        state.unseenSeconds = 0;
        if(distance(enemy,target)>.2)
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

    // Cover response is driven by credible fire pressure, even when the
    // current tracked target is elsewhere or the attacker remains unseen.
    const pressureEnough=state.underFireSeconds>0&&state.lastThreat&&
        (state.underFireElapsed>=response.reactionSeconds||
         state.urgency>=response.urgencyThreshold);
    if (pressureEnough && state.decisionCooldown <= 0) {
        const danger=state.lastThreat??target;
        const cover = chooseCoverPoint(enemy, danger, world, radius, behavior, preferredSide, danger);
        state.decisionCooldown = .34;
        if (cover) {
            state.coverTarget = cover.point;
            state.coverId = cover.coverId;
            state.coverHold = 0;
            return { mode: 'SEEK_COVER', point: cover.point, coverId: cover.coverId, lineOfSight: true };
        }
    }

    // Immediate incoming fire outranks returning to an old search coordinate.
    // Otherwise an AI can ignore unseen rear attacks while tunnel-visioned.
    if(state.underFireSeconds>.2&&state.lastThreat)
        return {mode:'UNDER_FIRE',point:{...state.lastThreat},
            lineOfSight:state.lineOfSight,unseen:!!state.unseenThreat};

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
    if (!state.lineOfSight && state.lastSeenTarget && state.unseenSeconds < 5.5) {
        return { mode: 'SEARCH', point: state.lastSeenTarget, blockedBy: state.blockerId, lineOfSight: false };
    }
    // A lost contact expires; don't circle an old coordinate forever.
    if (state.unseenSeconds >= 5.5) state.lastSeenTarget = null;
    if (!target) return {mode:'NO_CONTACT',point:null,lineOfSight:false};
    return {mode:'ENGAGE',point:{x:target.x,z:target.z},
        lineOfSight:state.lineOfSight};
}
