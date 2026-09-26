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
    if (outcome.justDisabled)
        return {
            kind: outcome.slot === 'power' ? 'power-disable' : 'disable',
            sparkCount: outcome.slot === 'power' ? 18 : 13,
            chipCount: 8,
            smokeCount: outcome.slot === 'power' ? 4 : 2,
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

/** Persistent distress is intentionally restrained. Destroyed metal does not automatically explode. */
export function persistentFailureProfile(slot, ratio) {
    const severity = 1 - clamp01(ratio);
    let sparkStart = .68, smokeStart = .90, sparkMax = 3.2, smokeMax = .45;
    if (slot === 'power') {
        sparkStart = .42; smokeStart = .62; sparkMax = 7.5; smokeMax = 1.35;
    }
    else if (slot === 'combat') {
        sparkStart = .55; smokeStart = .78; sparkMax = 5.0; smokeMax = .75;
    }
    else if (slot === 'mobility') {
        sparkStart = .64; smokeStart = .86; sparkMax = 4.2; smokeMax = .55;
    }
    else if (slot === 'command') {
        sparkStart = .72; smokeStart = .92; sparkMax = 2.5; smokeMax = .35;
    }
    else if (slot === 'structure') {
        sparkStart = .88; smokeStart = .96; sparkMax = 1.2; smokeMax = .25;
    }
    const sparkT = sparkStart >= 1 ? 0 : clamp01((severity - sparkStart) / (1 - sparkStart));
    const smokeT = smokeStart >= 1 ? 0 : clamp01((severity - smokeStart) / (1 - smokeStart));
    return {
        severity,
        sparkRate: sparkT * sparkMax,
        smokeRate: smokeT * smokeMax,
        disabled: ratio <= 0,
    };
}
