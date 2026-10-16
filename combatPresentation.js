/** k.3k.2 presentation tuning only. Combat/damage math stays authoritative elsewhere. */
export const SORTIE_OUTRO_SECONDS = 2.65;

const clamp01 = value => Math.max(0, Math.min(1, Number(value) || 0));

/** Translate one localized player hit into cockpit motion/electrical feedback.
 * Internal damage, not an armor ping, is what unlocks the dramatic subsystem reaction. */
export function cockpitImpactProfile(slot, { internalDamage = 0, disabled = false, driveSide = null } = {}) {
    const internal = Math.max(0, Number(internalDamage) || 0);
    const severity = clamp01((internal > 0 ? .35 : .12) + internal / 80 + (disabled ? .42 : 0));
    const base = {
        severity,
        shake: .012 + severity * .038,
        pitch: 0,
        roll: 0,
        yaw: 0,
        blackoutSeconds: 0,
        flickerSeconds: internal > 0 ? .28 + severity * .35 : .08,
        sparkCount: internal > 0 ? 3 + Math.round(severity * 5) : 1,
        gunShake: 0,
    };
    if (slot === 'structure') {
        base.pitch = -.018 - severity * .045;
        base.shake *= 1.35;
    }
    else if (slot === 'mobility') {
        const side = driveSide === 'right' ? -1 : 1;
        base.roll = side * (.025 + severity * .07);
        base.pitch = .008 * severity;
    }
    else if (slot === 'power') {
        base.pitch = -.012 - severity * .025;
        base.blackoutSeconds = internal > 0 ? (disabled ? .34 : .11 + severity * .12) : 0;
        base.flickerSeconds = internal > 0 ? .55 + severity * .65 : .12;
        base.sparkCount += internal > 0 ? 5 : 1;
    }
    else if (slot === 'command') {
        base.yaw = (disabled ? .045 : .018) * (severity + .4);
        base.pitch = -.012 * severity;
        base.sparkCount += internal > 0 ? 3 : 0;
    }
    else if (slot === 'combat') {
        base.roll = -.015 - severity * .035;
        base.gunShake = .12 + severity * .22;
        base.sparkCount += internal > 0 ? 4 : 1;
    }
    return base;
}
