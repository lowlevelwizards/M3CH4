/** k.3n.2 — compact objective sortie rules.
 *
 * Objectives sit above the existing six-rig combat simulation. They never teleport,
 * damage or pathfind actors; they only observe active rigs, accumulate objective
 * progress, and return a battle outcome when a non-elimination objective is met.
 */
export const OBJECTIVE_TYPES = Object.freeze({
    ELIMINATION: 'elimination',
    CONTROL: 'control',
    RECOVERY: 'recovery',
    BREAKTHROUGH: 'breakthrough',
});

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const dist = (a, b) => Math.hypot((a?.x ?? 0) - (b?.x ?? 0), (a?.z ?? 0) - (b?.z ?? 0));
const rigOf = participant => participant?.rig ?? participant;

export function createSortieObjective(contract) {
    const spec = contract?.objective ?? { type: OBJECTIVE_TYPES.ELIMINATION, label: 'ELIMINATE HOSTILE TEAM' };
    return {
        type: spec.type ?? OBJECTIVE_TYPES.ELIMINATION,
        label: spec.label ?? 'OBJECTIVE',
        description: spec.description ?? '',
        point: spec.point ? { ...spec.point } : { x: 0, z: 0 },
        friendlyGoal: spec.friendlyGoal ? { ...spec.friendlyGoal } : { x: 0, z: -24 },
        hostileGoal: spec.hostileGoal ? { ...spec.hostileGoal } : { x: 0, z: 24 },
        radius: Number(spec.radius) || 5,
        holdSeconds: Number(spec.holdSeconds) || 12,
        friendlyProgress: 0,
        hostileProgress: 0,
        contested: false,
        complete: false,
        winner: null,
    };
}

function activeInZone(participants, team, point, radius) {
    return (participants ?? []).filter(participant => participant?.active !== false && participant?.team === team && dist(rigOf(participant), point) <= radius);
}

export function objectivePointForTeam(state, team) {
    if (!state || state.type === OBJECTIVE_TYPES.ELIMINATION) return null;
    if (state.type === OBJECTIVE_TYPES.BREAKTHROUGH)
        return team === 'friendly' ? state.friendlyGoal : state.hostileGoal;
    return state.point;
}

export function objectivePresentation(state) {
    if (!state || state.type === OBJECTIVE_TYPES.ELIMINATION)
        return { visible: false };
    const point = objectivePointForTeam(state, 'friendly');
    return {
        visible: true,
        type: state.type,
        point,
        radius: state.radius,
        contested: state.contested,
        progress: clamp(state.friendlyProgress / Math.max(.001, state.holdSeconds), 0, 1),
    };
}

export function objectiveStatusText(state) {
    if (!state) return '';
    if (state.type === OBJECTIVE_TYPES.ELIMINATION)
        return 'OBJ · BREAK HOSTILE TEAM';
    const friendlyPct = Math.round(clamp(state.friendlyProgress / state.holdSeconds, 0, 1) * 100);
    const hostilePct = Math.round(clamp(state.hostileProgress / state.holdSeconds, 0, 1) * 100);
    if (state.type === OBJECTIVE_TYPES.RECOVERY)
        return `OBJ · SECURE WRECK ${friendlyPct}%${state.contested ? ' · CONTESTED' : ''}`;
    if (state.type === OBJECTIVE_TYPES.BREAKTHROUGH)
        return `OBJ · BREAKTHROUGH ${friendlyPct}% · ENEMY ${hostilePct}%`;
    return `OBJ · FIELD CONTROL ${friendlyPct}% · ENEMY ${hostilePct}%${state.contested ? ' · CONTESTED' : ''}`;
}

function win(state, team, reason) {
    state.complete = true;
    state.winner = team;
    return { victory: team === 'friendly', reason };
}

/** Advance one fixed step. Elimination remains handled by squadBattle; objective
 * outcomes are an additional way to resolve a sortie. */
export function advanceSortieObjective(state, participants, dt) {
    if (!state || state.complete || !Number.isFinite(dt) || dt <= 0 || state.type === OBJECTIVE_TYPES.ELIMINATION)
        return null;

    if (state.type === OBJECTIVE_TYPES.RECOVERY) {
        const friendly = activeInZone(participants, 'friendly', state.point, state.radius).length;
        const hostile = activeInZone(participants, 'hostile', state.point, state.radius).length;
        state.contested = friendly > 0 && hostile > 0;
        if (friendly > 0 && hostile === 0)
            state.friendlyProgress = Math.min(state.holdSeconds, state.friendlyProgress + dt);
        else if (friendly === 0)
            state.friendlyProgress = Math.max(0, state.friendlyProgress - dt * .22);
        if (state.friendlyProgress >= state.holdSeconds)
            return win(state, 'friendly', 'RECOVERY SITE SECURED');
        return null;
    }

    if (state.type === OBJECTIVE_TYPES.CONTROL) {
        const friendly = activeInZone(participants, 'friendly', state.point, state.radius).length;
        const hostile = activeInZone(participants, 'hostile', state.point, state.radius).length;
        state.contested = friendly > 0 && hostile > 0;
        if (friendly > 0 && hostile === 0) {
            state.friendlyProgress = Math.min(state.holdSeconds, state.friendlyProgress + dt);
            state.hostileProgress = Math.max(0, state.hostileProgress - dt * .16);
        }
        else if (hostile > 0 && friendly === 0) {
            state.hostileProgress = Math.min(state.holdSeconds, state.hostileProgress + dt);
            state.friendlyProgress = Math.max(0, state.friendlyProgress - dt * .16);
        }
        if (state.friendlyProgress >= state.holdSeconds)
            return win(state, 'friendly', 'FIELD CONTROL SECURED');
        if (state.hostileProgress >= state.holdSeconds)
            return win(state, 'hostile', 'HOSTILE FIELD CONTROL SECURED');
        return null;
    }

    if (state.type === OBJECTIVE_TYPES.BREAKTHROUGH) {
        const friendly = activeInZone(participants, 'friendly', state.friendlyGoal, state.radius).length;
        const hostile = activeInZone(participants, 'hostile', state.hostileGoal, state.radius).length;
        state.contested = friendly > 0 && hostile > 0;
        state.friendlyProgress = friendly > 0
            ? Math.min(state.holdSeconds, state.friendlyProgress + dt)
            : Math.max(0, state.friendlyProgress - dt * .55);
        state.hostileProgress = hostile > 0
            ? Math.min(state.holdSeconds, state.hostileProgress + dt)
            : Math.max(0, state.hostileProgress - dt * .55);
        if (state.friendlyProgress >= state.holdSeconds)
            return win(state, 'friendly', 'FRIENDLY BREAKTHROUGH COMPLETE');
        if (state.hostileProgress >= state.holdSeconds)
            return win(state, 'hostile', 'HOSTILE BREAKTHROUGH COMPLETE');
    }
    return null;
}
