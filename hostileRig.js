const clamp01 = (n) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
const ratio = (condition, slot) => {
    const part = condition.parts[slot];
    return part.maxIntegrity > 0 ? clamp01(part.integrity / part.maxIntegrity) : 0;
};
export function hostileOutput(condition) {
    const structure = ratio(condition, 'structure');
    const mobility = ratio(condition, 'mobility');
    const power = ratio(condition, 'power');
    const command = ratio(condition, 'command');
    const weapon = ratio(condition, 'combat');
    const operational = structure > .05 && command > .05 && power > .12 && weapon > .12;
    return {
        structure, mobility, power, command, weapon, operational,
        // A healthy stationary test rig fires deliberately rather than at cyclic rate.
        // Weapon and generator damage make the trigger cycle slower before shutdown.
        triggerSeconds: 1.28 + (1 - weapon) * 1.25 + (1 - power) * .85,
        // Damage makes the simple range controller progressively less stable.
        spreadRadians: .010 + (1 - weapon) * .045 + (1 - power) * .020,
    };
}
export function createHostileController(initialDelay = 1.8) {
    return { triggerLeft: Math.max(0, initialDelay), shots: 0 };
}
/** Returns a 1-based shot number only when the automated rig actually pulls the trigger. */
export function advanceHostileController(controller, condition, dt, playerDisabled = false) {
    if (!Number.isFinite(dt) || dt <= 0)
        return null;
    const output = hostileOutput(condition);
    if (!output.operational || playerDisabled)
        return null;
    controller.triggerLeft = Math.max(0, controller.triggerLeft - dt);
    if (controller.triggerLeft > 0)
        return null;
    controller.triggerLeft = output.triggerSeconds;
    return ++controller.shots;
}
/** Deterministic angular jitter keeps repeated failures reproducible. */
export function hostileSpread(index, spread) {
    const a = ((index * .7548776662466927) % 1) * Math.PI * 2;
    const r = Math.sqrt((index * .5698402909980532) % 1) * Math.max(0, spread);
    return [Math.cos(a) * r, Math.sin(a) * r];
}
/** The automated range rig cycles physical aim points rather than using tactical AI. */
const AIM_SEQUENCE = ['structure', 'mobility', 'combat', 'structure', 'power', 'command'];
export function hostileAimSlot(index) {
    return AIM_SEQUENCE[Math.max(0, index - 1) % AIM_SEQUENCE.length];
}
/** A training sortie ends only when the machine can no longer be safely operated.
 * Losing the weapon alone is not a defeat; the player can still limp home. */
export function disabledReason(condition, output) {
    if (ratio(condition, 'structure') <= .05)
        return 'FRAME DISABLED';
    if (ratio(condition, 'command') <= .05)
        return 'COMMAND COMPARTMENT DISABLED';
    if (output.power <= .05 || output.powerAvailableKw <= .5)
        return 'POWER LOST';
    if (output.left <= .05 && output.right <= .05)
        return 'MOBILITY LOST';
    return null;
}
