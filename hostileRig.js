import { selectedContract } from './contracts.js';
import { systemMissionKillReason } from './fieldService.js';
import {weaponDamageResponse} from './woundResponse.js';

const clamp01 = (n) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
const ratio = (condition, slot) => {
    const part = condition.parts[slot];
    return part.maxIntegrity > 0 ? clamp01(part.integrity / part.maxIntegrity) : 0;
};

function activeBehavior(behavior = null) {
    return behavior ?? selectedContract().behavior;
}

export function hostileOutput(condition, behavior = null) {
    const profile = activeBehavior(behavior);
    const structure = ratio(condition, 'structure');
    const mobility = ratio(condition, 'mobility');
    const power = ratio(condition, 'power');
    const command = ratio(condition, 'command');
    const weapon = ratio(condition, 'combat');
    const operational = structure > 0 && command > 0 && power > 0 && weapon > 0;
    const baseSpread = .010 * weaponDamageResponse(weapon).spreadMultiplier + (1 - power) * .007;
    return {
        structure, mobility, power, command, weapon, operational,
        // Only the physical fitted weapon controls cyclic rate. Pilot personality
        // may still change target selection and actual shot opportunity.
        spreadRadians: baseSpread * profile.spreadScale,
    };
}

export function createHostileController(initialDelay = .45, behavior = selectedContract().behavior) {
    return { triggerLeft: Math.max(0, initialDelay), shots: 0, behavior };
}

/** Returns a 1-based shot number only when the automated rig actually pulls the trigger. */
export function advanceHostileController(controller, condition, dt, playerDisabled = false, weaponReady=true) {
    if (!Number.isFinite(dt) || dt <= 0)return null;
    // Initial acquisition delay only. After that, real ammunition, reload and
    // weapon cooldown are the ONLY cyclic rate authorities.
    controller.triggerLeft=Math.max(0,controller.triggerLeft-dt);
    const output=hostileOutput(condition,controller.behavior);
    if(!output.operational||playerDisabled||!weaponReady||controller.triggerLeft>0)
        return null;
    return ++controller.shots;
}

/** Deterministic angular jitter keeps repeated failures reproducible. */
export function hostileSpread(index, spread) {
    const a = ((index * .7548776662466927) % 1) * Math.PI * 2;
    const r = Math.sqrt((index * .5698402909980532) % 1) * Math.max(0, spread);
    return [Math.cos(a) * r, Math.sin(a) * r];
}

/** Contract profiles choose physical aim points; this is still deterministic rather
 * than omniscient tactical targeting. Damage can make the chosen shot miss entirely. */
export function hostileAimSlot(index, aimPriority = selectedContract().behavior.aimPriority) {
    const sequence = Array.isArray(aimPriority) && aimPriority.length
        ? aimPriority
        : ['structure', 'mobility', 'combat', 'structure', 'power', 'command'];
    return sequence[Math.max(0, index - 1) % sequence.length];
}

/** A training sortie ends only when the machine can no longer be safely operated.
 * Weapon shutdown is handled separately by k.3j field service so a recoverable
 * first fault does not become dead time. */
export function disabledReason(condition, output) {
    return systemMissionKillReason(condition);
}

/** Explain why an opponent has lost combat capability. Mobility alone is not a
 * mission kill: an immobilized rig with a working gun can still fight like a turret. */
export function hostileMissionKillReason(condition, behavior = null) {
    return systemMissionKillReason(condition);
}
