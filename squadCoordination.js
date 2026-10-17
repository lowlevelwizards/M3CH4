/** k.3n.1 — lightweight squad coordination.
 *
 * Individual pilots still own movement and fire control. This layer only produces a
 * team-level intent: anchor, pressure, flank, regroup, withdraw, or support an
 * objective. The existing enemyMotion + stepRig path remains authoritative.
 */
const distance = (a, b) => Math.hypot((a?.x ?? 0) - (b?.x ?? 0), (a?.z ?? 0) - (b?.z ?? 0));
const rigOf = actor => actor?.rig ?? actor;

export function squadRole(actor) {
    const id = actor?.behavior?.id;
    return id === 'skirmisher' ? 'FLANKER' : id === 'bruiser' ? 'ANCHOR' : 'PRESSURE';
}

function centroid(actors) {
    const live = (actors ?? []).filter(actor => actor?.active !== false);
    if (!live.length) return null;
    let x = 0, z = 0;
    for (const actor of live) {
        const rig = rigOf(actor);
        x += rig?.x ?? 0;
        z += rig?.z ?? 0;
    }
    return { x: x / live.length, z: z / live.length };
}

function deterministicSide(id = '') {
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
    return (hash & 1) ? 1 : -1;
}

function separatedPoint(point, actor, allies, amount = 2.6) {
    const self = rigOf(actor);
    let x = point.x, z = point.z;
    for (const ally of allies) {
        const other = rigOf(ally);
        const d = distance(self, other);
        if (d >= 3.2 || d < .05) continue;
        const strength = (3.2 - d) / 3.2 * amount;
        x += (self.x - other.x) / d * strength;
        z += (self.z - other.z) / d * strength;
    }
    return { x, z };
}

/** Produce one stable team intent for an actor. `objectivePoint` is the place this
 * team currently wants to control/reach, not a pathfinding waypoint. */
export function squadIntent(actor, roster, target, objectivePoint = null, posture = null) {
    const self = rigOf(actor);
    const targetRig = rigOf(target);
    if (!actor || !self || !targetRig)
        return { mode: 'ENGAGE', role: squadRole(actor), point: targetRig ?? null, note: 'NO TEAM PLAN' };

    const live = (roster ?? []).filter(item => item?.active !== false);
    const allies = live.filter(item => item.id !== actor.id && item.team === actor.team);
    const allyCenter = centroid(allies);
    const role = squadRole(actor);
    const nearestAlly = allies.reduce((best, ally) => {
        const d = distance(self, rigOf(ally));
        return d < best.distance ? { actor: ally, distance: d } : best;
    }, { actor: null, distance: Infinity });

    if (posture?.preferredMode === 'WITHDRAW') {
        const homeZ = actor.team === 'friendly' ? 20 : -20;
        const point = allyCenter
            ? { x: allyCenter.x * .72 + self.x * .28, z: allyCenter.z * .72 + homeZ * .28 }
            : { x: self.x, z: homeZ };
        return { mode: 'WITHDRAW', role, point: separatedPoint(point, actor, allies, 1.8), throttleScale: .82, note: `${posture.state} · FALL BACK` };
    }
    if (posture?.preferredMode === 'HOLD')
        return { mode: 'ANCHOR', role, point: { x: self.x, z: self.z }, brakeBias: .72, note: `${posture.state} · HOLD` };

    // A stranded machine should rejoin the fight before attempting a clever flank.
    if (allyCenter && nearestAlly.distance > 11.5) {
        return {
            mode: 'REGROUP', role,
            point: separatedPoint(allyCenter, actor, allies, 1.4),
            throttleScale: .84, note: `REGROUP · ${nearestAlly.distance.toFixed(1)}m FROM SUPPORT`,
        };
    }

    // Objectives pull the squad into a useful shape rather than making every actor
    // occupy the exact same point. Anchors sit on it; pressure fighters approach it;
    // flankers work a lateral edge with line-of-fire potential.
    const focus = objectivePoint ?? targetRig;
    const dx = targetRig.x - focus.x, dz = targetRig.z - focus.z;
    const length = Math.max(.001, Math.hypot(dx, dz));
    const nx = dx / length, nz = dz / length;
    const tx = -nz, tz = nx;
    const side = deterministicSide(actor.id);

    if (role === 'ANCHOR' || posture?.preferredMode === 'ANCHOR') {
        const point = objectivePoint
            ? { x: objectivePoint.x - nx * 1.4, z: objectivePoint.z - nz * 1.4 }
            : { x: targetRig.x - nx * (actor.behavior?.preferredRangeM ?? 5), z: targetRig.z - nz * (actor.behavior?.preferredRangeM ?? 5) };
        return {
            mode: distance(self, point) < 2.2 ? 'ANCHOR' : 'OBJECTIVE', role,
            point: separatedPoint(point, actor, allies, 1.2), brakeBias: .48,
            note: objectivePoint ? 'ANCHOR OBJECTIVE' : 'ANCHOR FIRING LANE',
        };
    }

    if (role === 'FLANKER') {
        const flankRadius = objectivePoint ? 4.6 : Math.max(4.4, (actor.behavior?.preferredRangeM ?? 7) * .62);
        const point = {
            x: focus.x + tx * side * flankRadius - nx * 1.2,
            z: focus.z + tz * side * flankRadius - nz * 1.2,
        };
        return {
            mode: 'FLANK', role, point: separatedPoint(point, actor, allies, 2.1),
            strafeBias: side * .22, throttleScale: .92,
            note: `FLANK ${side > 0 ? 'RIGHT' : 'LEFT'}`,
        };
    }

    if (objectivePoint) {
        const point = { x: objectivePoint.x + tx * side * 1.6, z: objectivePoint.z + tz * side * 1.6 };
        return {
            mode: 'OBJECTIVE', role, point: separatedPoint(point, actor, allies, 1.8),
            throttleScale: .94, note: 'PRESS OBJECTIVE',
        };
    }

    // Pressure fighters advance behind/alongside whichever ally is already closest,
    // instead of three rigs collapsing onto exactly the same firing solution.
    const preferred = actor.behavior?.preferredRangeM ?? 6;
    const point = { x: targetRig.x - nx * preferred + tx * side * 1.45, z: targetRig.z - nz * preferred + tz * side * 1.45 };
    return {
        mode: 'PRESSURE', role, point: separatedPoint(point, actor, allies, 1.9),
        throttleScale: .96, note: 'PRESSURE / SUPPORT ANGLE',
    };
}
