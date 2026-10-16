/** k.3h.0: deliberately tiny contract-ladder state.
 *
 * Progression is physical-opponent access only: no XP, levels, reputation, or
 * abstract stats. Fresh players start with Yard Dog; each first clear unlocks the
 * next authored contract. Older saves keep the whole current roster unlocked so
 * an update never removes fights they already had access to.
 *
 * This module deliberately does not import contracts.js. contracts.js may consult
 * progression when resolving the selected opponent without creating a cycle through
 * persistence/economy/combat.
 */
export const CIRCUIT_ORDER = Object.freeze(['yard-dog', 'cutter', 'mule']);
export const DEFAULT_CONTRACT_ID = CIRCUIT_ORDER[0];
export const MACHINE_PROGRESS_V8_KEY = 'mech-arena-machine-v8';
export const MACHINE_PROGRESS_V7_KEY = 'mech-arena-machine-v7';
export const MACHINE_PROGRESS_V6_KEY = 'mech-arena-machine-v6';
const LEGACY_MACHINE_KEYS = Object.freeze([
    'mech-arena-machine-v5',
    'mech-arena-machine-v4',
    'mech-arena-machine-v3',
    'mech-arena-machine-v1',
]);
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

function browserLocalStorage() {
    try { return typeof window !== 'undefined' ? window.localStorage : null; }
    catch { return null; }
}

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

export function accessibleContractId(progression, requestedId) {
    if (KNOWN.has(requestedId) && isContractUnlocked(progression, requestedId))
        return requestedId;
    return CIRCUIT_ORDER.find(id => isContractUnlocked(progression, id)) ?? DEFAULT_CONTRACT_ID;
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

/** Read only enough of the machine save to resolve contract access. If no v6 save
 * exists but any older machine save does, this is an existing prototype player and
 * all three current fights remain available. */
export function loadProgression(storage = browserLocalStorage()) {
    if (!storage) return createProgressionState();
    try {
        const current = storage.getItem(MACHINE_PROGRESS_V8_KEY);
        if (current) {
            const data = JSON.parse(current);
            if (data?.version === 8 && data.progression)
                return createProgressionState(data.progression);
        }
        const v7 = storage.getItem(MACHINE_PROGRESS_V7_KEY);
        if (v7) {
            const data = JSON.parse(v7);
            if (data?.version === 7 && data.progression)
                return createProgressionState(data.progression);
        }
        const v6 = storage.getItem(MACHINE_PROGRESS_V6_KEY);
        if (v6) {
            const data = JSON.parse(v6);
            if (data?.version === 6 && data.progression)
                return createProgressionState(data.progression);
        }
        if (LEGACY_MACHINE_KEYS.some(key => storage.getItem(key) !== null))
            return createLegacyProgressionState();
    } catch { /* corrupted/unavailable storage falls back to the fresh ladder */ }
    return createProgressionState();
}

/** Patch only the progression field in an already-created v6 machine save. Combat
 * settlement writes the machine before the debrief becomes visible, so this remains
 * atomic from the player's point of view and cannot invent a partial machine save. */
export function storeProgression(progression, storage = browserLocalStorage()) {
    if (!storage) return false;
    try {
        const key = storage.getItem(MACHINE_PROGRESS_V8_KEY) ? MACHINE_PROGRESS_V8_KEY : MACHINE_PROGRESS_V7_KEY;
        const raw = storage.getItem(key);
        if (!raw) return false;
        const data = JSON.parse(raw);
        if (![7, 8].includes(data?.version)) return false;
        const next = createProgressionState(progression);
        data.progression = {
            unlockedContracts: [...next.unlockedContracts],
            clearedContracts: [...next.clearedContracts],
        };
        storage.setItem(key, JSON.stringify(data));
        return true;
    } catch {
        return false;
    }
}

/** Mutate one loaded progression object in-place. Replays are idempotent and never
 * relock anything. */
export function recordContractClear(progression, contractId) {
    if (!progression || !KNOWN.has(contractId) || !isContractUnlocked(progression, contractId)) {
        const summary = circuitSummary(progression);
        return { firstClear: false, unlockedContractId: null, circuitCleared: false, ...summary };
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
        ...summary,
    };
}
