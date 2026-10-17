/** k.3p.0 — AI use of the existing emergency weapon bypass.
 *
 * This policy does not move, repair or damage a rig. It only classifies whether a
 * faulted AI weapon should withdraw, settle, or begin the same stationary field
 * service already available to the player.
 */
import { canFieldService, fieldServiceStationary } from './fieldService.js';
import { hostileMissionKillReason } from './hostileRig.js';

export const AI_FIELD_SERVICE_FALLBACK_DISTANCE_M = 9;

const distance = (a, b) => Math.hypot((a?.x ?? 0) - (b?.x ?? 0), (a?.z ?? 0) - (b?.z ?? 0));

export function aiWeaponMissionKillReason(condition, behavior = null, service = null) {
    const reason = hostileMissionKillReason(condition, behavior);
    if (reason === 'WEAPON DISABLED' && canFieldService(condition, service))
        return null;
    return reason;
}

export function aiWeaponRecoveryDirective(actor, target = null) {
    const service = actor?.fieldService;
    if (!actor || !canFieldService(actor.condition, service))
        return Object.freeze({ active: false, mode: 'NONE', safe: false, begin: false });

    const awareness = actor.motion?.awareness ?? {};
    const targetDistance = target ? distance(actor.rig, target.rig ?? target) : Infinity;
    const covered = awareness.lineOfSight === false;
    const quiet = (awareness.underFireSeconds ?? 0) <= .18;
    // If no useful cover exists, a rig that has genuinely opened distance and is no
    // longer under pressure may still attempt the exposed emergency procedure.
    const safe = covered || (quiet && targetDistance >= AI_FIELD_SERVICE_FALLBACK_DISTANCE_M);
    const stationary = fieldServiceStationary(actor.rig);

    if (service.held)
        return Object.freeze({ active: true, mode: 'SERVICE', safe: true, begin: false, targetDistance });
    if (safe && stationary)
        return Object.freeze({ active: true, mode: 'SERVICE', safe: true, begin: true, targetDistance });
    if (safe)
        return Object.freeze({ active: true, mode: 'SETTLE', safe: true, begin: false, targetDistance });
    return Object.freeze({ active: true, mode: 'WITHDRAW', safe: false, begin: false, targetDistance });
}

export function aiWeaponRecoveryPosture(base, directive) {
    if (!directive?.active) return base;
    return {
        ...base,
        state: directive.mode === 'SERVICE' ? 'FIELD SERVICE' : 'WEAPON FAULT',
        preferredMode: directive.mode === 'WITHDRAW' ? 'WITHDRAW' : 'HOLD',
        aggressionScale: Math.min(base?.aggressionScale ?? 1, .18),
        seekCoverBias: Math.max(base?.seekCoverBias ?? 0, 1.35),
    };
}
