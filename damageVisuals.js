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

/** Persistent distress is intentionally restrained. Destroyed metal does not automatically explode. */
export function persistentFailureProfile(slot, ratio) {
    const severity = 1 - clamp01(ratio);
    let sparkStart = .68, smokeStart = .90, sparkMax = 3.2, smokeMax = .45;
    if (slot === 'power') {
        sparkStart = .38; smokeStart = .56; sparkMax = 9.0; smokeMax = 1.75;
    }
    else if (slot === 'combat') {
        sparkStart = .50; smokeStart = .72; sparkMax = 6.2; smokeMax = 1.0;
    }
    else if (slot === 'mobility') {
        sparkStart = .59; smokeStart = .80; sparkMax = 5.2; smokeMax = .8;
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
