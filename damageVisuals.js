/** 0.0.1f — pure damage-expression policy.
 * Rendering owns particles; this module only answers what a physical event should communicate.
 * No gameplay damage, health, or repair state is created here. */
const clamp01 = (n) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));

export function integrityRatio(part) {
    if (!part || !Number.isFinite(part.maxIntegrity) || part.maxIntegrity <= 0)
        return 0;
    return clamp01(part.integrity / part.maxIntegrity);
}

export function impactProfile(outcome) {
    if (!outcome)
        return { kind: 'surface', sparkCount: 3, chipCount: 1, smokeCount: 0, markScale: .7, flashScale: .7 };
    if (outcome.justDestroyed)
        return {
            kind: outcome.slot === 'power' ? 'power-destroy' : 'destroy',
            sparkCount: outcome.slot === 'power' ? 38 : 30,
            chipCount: outcome.slot === 'mobility' ? 22 : 18,
            smokeCount: outcome.slot === 'power' ? 11 : 8,
            markScale: 2.0,
            flashScale: outcome.slot === 'power' ? 2.35 : 1.95,
        };
    if (outcome.wreckHit)
        return { kind: outcome.cleared ? 'wreck-break' : 'wreck-hit', sparkCount: outcome.cleared ? 20 : 12, chipCount: outcome.cleared ? 14 : 8, smokeCount: outcome.cleared ? 6 : 3, markScale: 1.45, flashScale: outcome.cleared ? 1.65 : 1.12 };
    if (outcome.justDisabled)
        return {
            kind: outcome.slot === 'power' ? 'power-disable' : 'disable',
            sparkCount: outcome.slot === 'power' ? 22 : 17,
            chipCount: 10,
            smokeCount: outcome.slot === 'power' ? 6 : 4,
            markScale: 1.55,
            flashScale: outcome.slot === 'power' ? 1.8 : 1.35,
        };
    if (outcome.internalDamage > 0) {
        if (outcome.slot === 'power')
            return { kind: 'penetration', sparkCount: 13, chipCount: 4, smokeCount: 2, markScale: 1.25, flashScale: 1.28 };
        if (outcome.slot === 'combat')
            return { kind: 'penetration', sparkCount: 11, chipCount: 5, smokeCount: 1, markScale: 1.25, flashScale: 1.16 };
        if (outcome.slot === 'mobility')
            return { kind: 'penetration', sparkCount: 9, chipCount: 6, smokeCount: 0, markScale: 1.25, flashScale: 1.05 };
        return { kind: 'penetration', sparkCount: 9, chipCount: 5, smokeCount: 0, markScale: 1.25, flashScale: 1.05 };
    }
    return { kind: 'armor', sparkCount: 6, chipCount: 2, smokeCount: 0, markScale: .92, flashScale: .9 };
}

/** Persistent distress turns battle damage into a readable machine state. It remains
 * subsystem-specific: electricity belongs mostly to power, smoke grows after real
 * internal damage, and structure stays mechanically dirty rather than magical. */
export function persistentFailureProfile(slot, ratio) {
    const severity = 1 - clamp01(ratio);
    let sparkStart = .58, smokeStart = .76, sparkMax = 5.0, smokeMax = 1.0, arcMax = 0;
    if (slot === 'power') {
        sparkStart = .26; smokeStart = .40; sparkMax = 14.0; smokeMax = 3.4; arcMax = 1.25;
    }
    else if (slot === 'combat') {
        sparkStart = .38; smokeStart = .55; sparkMax = 9.0; smokeMax = 2.0;
    }
    else if (slot === 'mobility') {
        sparkStart = .44; smokeStart = .62; sparkMax = 8.0; smokeMax = 1.65;
    }
    else if (slot === 'command') {
        sparkStart = .52; smokeStart = .72; sparkMax = 6.0; smokeMax = 1.0; arcMax = .18;
    }
    else if (slot === 'structure') {
        sparkStart = .67; smokeStart = .78; sparkMax = 4.2; smokeMax = .9;
    }
    const sparkT = clamp01((severity - sparkStart) / Math.max(.001, 1 - sparkStart));
    const smokeT = clamp01((severity - smokeStart) / Math.max(.001, 1 - smokeStart));
    const arcT = slot === 'power' ? clamp01((severity - .42) / .58) : slot === 'command' ? clamp01((severity - .82) / .18) : 0;
    return {
        severity,
        sparkRate: sparkT * sparkMax,
        smokeRate: smokeT * smokeMax,
        arcRate: arcT * arcMax,
        disabled: ratio <= 0,
    };
}
