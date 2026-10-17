/** k.3p.1 — squad response to recoverable weapon faults.
 *
 * This layer owns only temporary support assignments. It does not move rigs, repair
 * hardware, choose shots, or bypass LOS. A healthy teammate may screen one nearby
 * recoverable casualty while the existing locomotion/fire-control systems remain
 * authoritative.
 */
import { canFieldService } from './fieldService.js';
import { damagePosture } from './damageBehavior.js';

export const SCREEN_ASSIGN_RANGE_M = 14;
export const SCREEN_BREAK_RANGE_M = 18;
export const SCREEN_STANDOFF_M = 2.8;
export const SCREEN_COMMIT_SECONDS = 1.0;
export const SERVICE_EXPLOIT_THROTTLE_SCALE = 1.06;

const rigOf = actor => actor?.rig ?? actor;
const distance = (a, b) => Math.hypot((a?.x ?? 0) - (b?.x ?? 0), (a?.z ?? 0) - (b?.z ?? 0));

export function needsFaultSupport(actor) {
    return !!actor && actor.active !== false && canFieldService(actor.condition, actor.fieldService);
}

export function canScreenFault(actor) {
    if (!actor || actor.active === false || needsFaultSupport(actor)) return false;
    const posture = damagePosture(actor.condition, actor.behavior);
    if (posture.state === 'CRITICAL' || posture.state === 'CRIPPLED' || posture.state === 'WEAPONLESS')
        return false;
    return posture.structure > .22 && posture.power > .15 && posture.combat > .12;
}

function nearestThreat(casualty, roster) {
    const opponents = roster.filter(actor => actor?.active !== false && actor.team !== casualty.team);
    const current = opponents.find(actor => actor.id === casualty.targetId);
    if (current) return current;
    return opponents.reduce((best, actor) => {
        const d = distance(rigOf(casualty), rigOf(actor));
        return !best || d < best.distance ? { actor, distance: d } : best;
    }, null)?.actor ?? null;
}

export function createFaultSupportState() {
    return { assignments: new Map() };
}

export function resetFaultSupportState(state) {
    state?.assignments?.clear();
}

/** Keep valid assignments stable for the full recovery crisis. The one-second
 * commitment value is diagnostic/documentary hysteresis; a screen is only replaced
 * early if the screener or casualty becomes invalid or separates dramatically. */
export function updateFaultSupportAssignments(state, roster, dt = 0) {
    if (!state?.assignments) return state;
    const live = (roster ?? []).filter(Boolean);
    const byId = new Map(live.map(actor => [actor.id, actor]));
    const step = Number.isFinite(dt) && dt > 0 ? dt : 0;

    for (const [screenerId, assignment] of [...state.assignments]) {
        const screener = byId.get(screenerId);
        const casualty = byId.get(assignment.casualtyId);
        assignment.commitLeft = Math.max(0, (assignment.commitLeft ?? 0) - step);
        if (!screener || !casualty || screener.team !== casualty.team ||
            !needsFaultSupport(casualty) || !canScreenFault(screener) ||
            distance(rigOf(screener), rigOf(casualty)) > SCREEN_BREAK_RANGE_M) {
            state.assignments.delete(screenerId);
            continue;
        }
        const threat = assignment.threatId ? byId.get(assignment.threatId) : null;
        if (!threat || threat.active === false || threat.team === casualty.team)
            assignment.threatId = nearestThreat(casualty, live)?.id ?? null;
    }

    const occupiedCasualties = new Set([...state.assignments.values()].map(a => a.casualtyId));
    const occupiedScreeners = new Set(state.assignments.keys());
    const casualties = live.filter(needsFaultSupport).sort((a, b) => String(a.id).localeCompare(String(b.id)));
    for (const casualty of casualties) {
        if (occupiedCasualties.has(casualty.id)) continue;
        const candidates = live
            .filter(actor => actor.id !== casualty.id && actor.team === casualty.team &&
                !occupiedScreeners.has(actor.id) && canScreenFault(actor))
            .map(actor => ({ actor, distance: distance(rigOf(actor), rigOf(casualty)) }))
            .filter(entry => entry.distance <= SCREEN_ASSIGN_RANGE_M)
            .sort((a, b) => a.distance - b.distance || String(a.actor.id).localeCompare(String(b.actor.id)));
        const pick = candidates[0]?.actor;
        if (!pick) continue;
        const threat = nearestThreat(casualty, live);
        state.assignments.set(pick.id, {
            screenerId: pick.id,
            casualtyId: casualty.id,
            threatId: threat?.id ?? null,
            commitLeft: SCREEN_COMMIT_SECONDS,
        });
        occupiedCasualties.add(casualty.id);
        occupiedScreeners.add(pick.id);
    }
    return state;
}

export function faultSupportForActor(state, actorId) {
    return state?.assignments?.get(actorId) ?? null;
}

/** An actor already fighting a target that has stopped to service its weapon may
 * press the opening slightly harder. This never changes targets, grants LOS, or
 * overrides withdrawal/recovery behavior. */
export function exploitServicingTarget(intent, target, posture = null) {
    if (!intent || !target?.fieldService?.held || posture?.preferredMode === 'WITHDRAW' ||
        intent.mode === 'WITHDRAW' || intent.mode === 'REGROUP' || intent.mode === 'SCREEN')
        return intent;
    return {
        ...intent,
        throttleScale: Math.max(intent.throttleScale ?? .9, SERVICE_EXPLOIT_THROTTLE_SCALE),
        brakeBias: Math.min(intent.brakeBias ?? .24, .18),
        note: `${intent.note ?? intent.mode} · PRESS SERVICE`,
    };
}
