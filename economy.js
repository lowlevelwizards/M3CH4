/** k.3d.0: deliberately small first recovery economy.
 *
 * Credits answer one question only: what does it cost to keep the same owned
 * machine fieldable after a sortie? Acquisition, markets, rarity and salvage
 * inventory belong to later builds.
 */
export const STARTING_CREDITS = 600;
export const VICTORY_PAYOUT = 850;
export const RECOVERY_PAYOUT = 350;
export const AMMO_COST_PER_ROUND = 1;

const REPAIR_RATES = Object.freeze({
    structure: Object.freeze({ integrity: 1.00, armor: .35 }),
    mobility: Object.freeze({ integrity: .95, armor: .35 }),
    power: Object.freeze({ integrity: 1.10, armor: .40 }),
    command: Object.freeze({ integrity: 1.05, armor: .40 }),
    combat: Object.freeze({ integrity: 1.00, armor: .35 }),
});

const nonNegativeInteger = value => Number.isSafeInteger(value) && value >= 0 ? value : 0;
const missing = (current, maximum) => Math.max(0, Number(maximum) - Number(current));

export function createEconomyState(credits = STARTING_CREDITS) {
    return { credits: nonNegativeInteger(credits) };
}

/** Quote restoring the selected module's current housing/integrity to its maxima.
 * This does not mutate the machine and intentionally ignores long-term wear. */
export function repairQuote(part) {
    if (!part || !REPAIR_RATES[part.slot])
        return 0;
    const rates = REPAIR_RATES[part.slot];
    const raw = missing(part.integrity, part.maxIntegrity) * rates.integrity +
        missing(part.armor, part.maxArmor) * rates.armor;
    return raw > 1e-6 ? Math.max(1, Math.ceil(raw)) : 0;
}

export function totalRepairQuote(condition) {
    if (!condition?.parts)
        return 0;
    return Object.values(condition.parts).reduce((sum, part) => sum + repairQuote(part), 0);
}

export function settleSortie({ credits, victory, roundsFired, repairEstimate = 0 }) {
    const before = nonNegativeInteger(credits);
    const rounds = nonNegativeInteger(roundsFired);
    const grossPayout = victory ? VICTORY_PAYOUT : RECOVERY_PAYOUT;
    const ammoCost = rounds * AMMO_COST_PER_ROUND;
    const nominalNet = grossPayout - ammoCost;
    const after = Math.max(0, before + nominalNet);
    return {
        victory: !!victory,
        creditsBefore: before,
        creditsAfter: after,
        grossPayout,
        ammoCost,
        netPayout: after - before,
        repairEstimate: nonNegativeInteger(Math.ceil(repairEstimate)),
        roundsFired: rounds,
    };
}
