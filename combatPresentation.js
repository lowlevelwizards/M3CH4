/** k.3k.3 presentation tuning only. Combat/damage math stays authoritative elsewhere. */
export const SORTIE_OUTRO_SECONDS = 4.25;

const clamp01 = value => Math.max(0, Math.min(1, Number(value) || 0));

/** Translate one localized player hit into cockpit motion/electrical feedback.
 * Armor pings stay readable but restrained. Internal/disabled hits are the dramatic events. */
export function cockpitImpactProfile(slot, { internalDamage = 0, disabled = false, driveSide = null } = {}) {
    const internal = Math.max(0, Number(internalDamage) || 0);
    const severity = clamp01((internal > 0 ? .38 : .12) + internal / 72 + (disabled ? .42 : 0));
    const base = {
        severity,
        shake: .014 + severity * .046,
        pitch: 0,
        roll: 0,
        yaw: 0,
        blackoutSeconds: 0,
        flickerSeconds: internal > 0 ? .34 + severity * .42 : .08,
        sparkCount: internal > 0 ? 5 + Math.round(severity * 7) : 1,
        sparkScale: internal > 0 ? 1.15 + severity * .7 : .72,
        arcCount: 0,
        gunShake: 0,
    };
    if (slot === 'structure') {
        base.pitch = -.020 - severity * .052;
        base.shake *= 1.42;
    }
    else if (slot === 'mobility') {
        const side = driveSide === 'right' ? -1 : 1;
        base.roll = side * (.028 + severity * .078);
        base.pitch = .010 * severity;
    }
    else if (slot === 'power') {
        base.pitch = -.015 - severity * .032;
        base.blackoutSeconds = internal > 0 ? (disabled ? .46 : .16 + severity * .15) : 0;
        base.flickerSeconds = internal > 0 ? .88 + severity * .92 : .14;
        base.sparkCount += internal > 0 ? 7 : 1;
        base.sparkScale += internal > 0 ? .28 : 0;
        base.arcCount = internal > 0 ? (disabled ? 4 : 2 + Math.round(severity)) : 0;
    }
    else if (slot === 'command') {
        // Optical electronics stutter only on a real internal cab strike.
        // Short localized blackout on disable; mandatory safety UI survives.
        if(internal>0){base.flickerSeconds=.22+.34*severity;
            if(disabled)base.blackoutSeconds=.12;}
        base.yaw = (disabled ? .052 : .021) * (severity + .4);
        base.pitch = -.014 * severity;
        base.sparkCount += internal > 0 ? 4 : 0;
    }
    else if (slot === 'combat') {
        base.roll = -.018 - severity * .041;
        base.gunShake = .14 + severity * .25;
        base.sparkCount += internal > 0 ? 5 : 1;
    }
    return base;
}
