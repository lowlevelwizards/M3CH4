/** k.3n.3 — damage-aware tactical posture.
 *
 * This module converts the existing localized component condition into a small set
 * of behavioral modifiers. It never repairs, damages, moves or fires anything;
 * locomotion and the physical damage model remain authoritative.
 */
const clamp01 = value => Math.max(0, Math.min(1, Number(value) || 0));

export function partHealth(condition, slot) {
    const part = condition?.parts?.[slot];
    if (!part) return 0;
    if (part.destroyed) return 0;
    return clamp01(part.integrity / Math.max(1, part.maxIntegrity));
}

export function damagePosture(condition, behavior = null) {
    const structure = partHealth(condition, 'structure');
    const mobility = partHealth(condition, 'mobility');
    const power = partHealth(condition, 'power');
    const command = partHealth(condition, 'command');
    const combat = partHealth(condition, 'combat');
    const weakest = Math.min(structure, mobility, power, command, combat);
    const average = (structure + mobility + power + command + combat) / 5;

    let state = 'FIGHTING';
    let preferredMode = null;
    if (structure <= .18 || power <= .12 || command <= .12) {
        state = 'CRITICAL';
        preferredMode = 'WITHDRAW';
    }
    else if (combat <= .03) {
        // A weaponless bruiser can still be useful as hard cover / a physical screen;
        // lighter machines should preserve themselves rather than charge uselessly.
        state = 'WEAPONLESS';
        preferredMode = behavior?.id === 'bruiser' && structure > .42 ? 'ANCHOR' : 'WITHDRAW';
    }
    else if (mobility <= .20) {
        state = 'CRIPPLED';
        preferredMode = 'HOLD';
    }
    else if (weakest < .38 || average < .56) {
        state = 'WOUNDED';
        preferredMode = behavior?.id === 'bruiser' ? 'ANCHOR' : 'CAUTIOUS';
    }

    const control = Math.min(1, command * 1.15, power * 1.12);
    const paceScale = .22 + mobility * .78;
    const steerScale = .26 + Math.min(mobility, control) * .74;
    const strafeScale = .08 + mobility * .92;
    const aggressionScale = Math.max(.18, Math.min(structure, power, Math.max(.15, combat)));
    const recoilRecoveryScale = 1 + (1 - Math.min(structure, command, combat)) * .8;
    const animationHealth = Math.max(.05, Math.min(mobility, structure * .8 + .2, power * .85 + .15));

    return Object.freeze({
        state, preferredMode,
        structure, mobility, power, command, combat, weakest, average,
        paceScale, steerScale, strafeScale, aggressionScale,
        recoilRecoveryScale, animationHealth,
        seekCoverBias: Math.max(0, 1 - average) + (power < .45 ? .25 : 0) + (command < .45 ? .2 : 0),
    });
}
