/** k.3d.0 recovery economy, extended in k.3f.0 with authored contract payouts.
 * k.3q.2 defers settlement between BO3 rounds and aggregates ammunition at the end.
 */
import { selectedContract } from './contracts.js';
import { seriesSettlementDirective } from './series.js';

export const STARTING_CREDITS = 600;
export const VICTORY_PAYOUT = 850; // Yard Dog / fallback contract value.
export const RECOVERY_PAYOUT = 350;
export const AMMO_COST_PER_ROUND = 1;
export const REBUILD_MULTIPLIER = 1.65;

const REPAIR_RATES = Object.freeze({
    structure: Object.freeze({ integrity: 1.00, armor: .35 }),
    mobility: Object.freeze({ integrity: .95, armor: .35 }),
    power: Object.freeze({ integrity: 1.10, armor: .40 }),
    command: Object.freeze({ integrity: 1.05, armor: .40 }),
    combat: Object.freeze({ integrity: 1.00, armor: .35 }),
});

const nonNegativeInteger = value => Number.isSafeInteger(value) && value >= 0 ? value : 0;
const missing = (current, maximum) => Math.max(0, Number(maximum) - Number(current));

function browserStorage() {
    try { return globalThis.localStorage ?? null; }
    catch { return null; }
}

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

export function rebuildQuote(part) {
    const repair = repairQuote(part);
    return part?.destroyed ? Math.max(1, Math.ceil(repair * REBUILD_MULTIPLIER)) : repair;
}

export function totalRepairQuote(condition) {
    if (!condition?.parts)
        return 0;
    return Object.values(condition.parts).reduce((sum, part) => sum + rebuildQuote(part), 0);
}

export function settleSortie({ credits, victory, roundsFired, repairEstimate = 0, victoryPayout = null }) {
    const before = nonNegativeInteger(credits);
    const currentRounds = nonNegativeInteger(roundsFired);
    const directive = seriesSettlementDirective(browserStorage(), currentRounds);
    if (directive && !directive.terminal) {
        return {
            victory: !!victory,
            creditsBefore: before,
            creditsAfter: before,
            grossPayout: 0,
            ammoCost: 0,
            netPayout: 0,
            repairEstimate: nonNegativeInteger(Math.ceil(repairEstimate)),
            roundsFired: currentRounds,
            deferred: true,
            series: directive.series,
        };
    }

    const finalVictory = directive?.terminal ? !!directive.victory : !!victory;
    const rounds = directive?.terminal ? directive.roundsFired : currentRounds;
    const selectedPayout = nonNegativeInteger(victoryPayout ?? selectedContract().payout) || VICTORY_PAYOUT;
    const grossPayout = finalVictory ? selectedPayout : RECOVERY_PAYOUT;
    const ammoCost = rounds * AMMO_COST_PER_ROUND;
    const nominalNet = grossPayout - ammoCost;
    const after = Math.max(0, before + nominalNet);
    return {
        victory: finalVictory,
        creditsBefore: before,
        creditsAfter: after,
        grossPayout,
        ammoCost,
        netPayout: after - before,
        repairEstimate: nonNegativeInteger(Math.ceil(repairEstimate)),
        roundsFired: rounds,
        deferred: false,
        series: directive?.series ?? null,
    };
}
