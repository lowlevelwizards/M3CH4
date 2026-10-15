/** k.3h.0: deliberately tiny contract-ladder state.
 *
 * Progression is physical-opponent access only: no XP, levels, reputation, or
 * abstract stats. Fresh players start with Yard Dog; each first clear unlocks the
 * next authored contract. Older saves can migrate with the whole current roster
 * unlocked so an update never removes fights they already had access to.
 */
import { CONTRACTS, DEFAULT_CONTRACT_ID, contractById } from './contracts.js';

export const CIRCUIT_ORDER = Object.freeze(CONTRACTS.map(contract => contract.id));
const KNOWN = new Set(CIRCUIT_ORDER);

const uniqueKnown = values => {
    const result = [];
    const seen = new Set();
    for (const id of Array.isArray(values) ? values : []) {
        if (!KNOWN.has(id) || seen.has(id)) continue;
        seen.add(id);
        result.push(id);
    }
    return result;
};

export function createProgressionState({ unlockedContracts = [DEFAULT_CONTRACT_ID], clearedContracts = [] } = {}) {
    const unlocked = uniqueKnown(unlockedContracts);
    if (!unlocked.includes(DEFAULT_CONTRACT_ID)) unlocked.unshift(DEFAULT_CONTRACT_ID);
    const cleared = uniqueKnown(clearedContracts).filter(id => unlocked.includes(id));
    return { unlockedContracts: unlocked, clearedContracts: cleared };
}

/** v5 players were already allowed to choose any current contract. Preserve that
 * access on migration without pretending those fights were historically cleared. */
export function createLegacyProgressionState() {
    return createProgressionState({ unlockedContracts: CIRCUIT_ORDER, clearedContracts: [] });
}

export function isContractUnlocked(progression, id) {
    return !!progression?.unlockedContracts?.includes(id);
}

export function isContractCleared(progression, id) {
    return !!progression?.clearedContracts?.includes(id);
}

export function accessibleContract(progression, requestedId) {
    if (KNOWN.has(requestedId) && isContractUnlocked(progression, requestedId))
        return contractById(requestedId);
    const first = CIRCUIT_ORDER.find(id => isContractUnlocked(progression, id)) ?? DEFAULT_CONTRACT_ID;
    return contractById(first);
}

export function prerequisiteFor(id) {
    const index = CIRCUIT_ORDER.indexOf(id);
    return index > 0 ? CIRCUIT_ORDER[index - 1] : null;
}

export function circuitSummary(progression) {
    const clearedCount = CIRCUIT_ORDER.filter(id => isContractCleared(progression, id)).length;
    return {
        clearedCount,
        total: CIRCUIT_ORDER.length,
        complete: clearedCount === CIRCUIT_ORDER.length,
    };
}

/** Mutate the loaded progression object in-place so persistence and the garage UI
 * observe one authority. Replays are idempotent and never relock anything. */
export function recordContractClear(progression, contractId) {
    if (!progression || !KNOWN.has(contractId) || !isContractUnlocked(progression, contractId)) {
        return { firstClear: false, unlockedContractId: null, circuitCleared: circuitSummary(progression).complete };
    }
    const firstClear = !isContractCleared(progression, contractId);
    let unlockedContractId = null;
    if (firstClear) {
        progression.clearedContracts.push(contractId);
        const index = CIRCUIT_ORDER.indexOf(contractId);
        const next = CIRCUIT_ORDER[index + 1] ?? null;
        if (next && !isContractUnlocked(progression, next)) {
            progression.unlockedContracts.push(next);
            unlockedContractId = next;
        }
    }
    const summary = circuitSummary(progression);
    return {
        firstClear,
        unlockedContractId,
        circuitCleared: firstClear && summary.complete,
        clearedCount: summary.clearedCount,
        total: summary.total,
    };
}
