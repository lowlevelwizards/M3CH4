/** k.3f.0: tiny authored contract roster.
 *
 * A contract is only an opponent recipe + payout + presentation. Combat, damage,
 * salvage and persistence remain owned by their existing systems. Selection lives
 * in sessionStorage so choosing a new opponent can rebuild the arena cleanly.
 */
export const CONTRACT_STORAGE_KEY = 'm3ch4-contract-v1';

export const CONTRACTS = Object.freeze([
    Object.freeze({
        id: 'yard-dog',
        name: 'YARD DOG',
        opponentSerial: 'YD-01',
        serialPrefix: 'YD01',
        role: 'BALANCED SCRAPPER',
        payout: 850,
        loadout: Object.freeze({
            structure: 'frame-sr', mobility: 'legs-yard', power: 'power-dynamo',
            command: 'cab-cyclops', combat: 'gun-short',
        }),
        salvagePriority: Object.freeze(['combat', 'power', 'mobility', 'command', 'structure']),
        knownEquipment: Object.freeze(['Yardwalker', 'Stump Cannon']),
        briefing: 'Conventional yard rig. Predictable movement, solid power margin, heavy short cannon.',
    }),
    Object.freeze({
        id: 'cutter',
        name: 'CUTTER',
        opponentSerial: 'CUT-01',
        serialPrefix: 'CUT01',
        role: 'FAST / LIGHT',
        payout: 950,
        loadout: Object.freeze({
            structure: 'frame-utility', mobility: 'legs-compact', power: 'power-air',
            command: 'cab-utility', combat: 'gun-light',
        }),
        salvagePriority: Object.freeze(['mobility', 'combat', 'command', 'power', 'structure']),
        knownEquipment: Object.freeze(['Kestrel', 'Needle Cannon']),
        briefing: 'Light utility build. Fast response and long gun reach, but less planted under damage.',
    }),
    Object.freeze({
        id: 'mule',
        name: 'MULE',
        opponentSerial: 'MULE-01',
        serialPrefix: 'MULE01',
        role: 'HEAVY / TOUGH',
        payout: 1050,
        loadout: Object.freeze({
            structure: 'frame-wedge', mobility: 'legs-hauler', power: 'power-dynamo',
            command: 'cab-cyclops', combat: 'gun-short',
        }),
        salvagePriority: Object.freeze(['mobility', 'structure', 'combat', 'power', 'command']),
        knownEquipment: Object.freeze(['Hauler H2', 'W-3 Wedge']),
        briefing: 'Slow heavy carrier. High inertia, planted drive and a stubborn load-bearing chassis.',
    }),
]);

const BY_ID = new Map(CONTRACTS.map(contract => [contract.id, contract]));
export const DEFAULT_CONTRACT_ID = CONTRACTS[0].id;

export function contractById(id) {
    return BY_ID.get(id) ?? BY_ID.get(DEFAULT_CONTRACT_ID);
}

function browserSessionStorage() {
    try { return typeof window !== 'undefined' ? window.sessionStorage : null; }
    catch { return null; }
}

export function selectedContract(storage = browserSessionStorage()) {
    let id = DEFAULT_CONTRACT_ID;
    try { id = storage?.getItem(CONTRACT_STORAGE_KEY) || DEFAULT_CONTRACT_ID; }
    catch { /* Session storage is optional; fall back to Yard Dog. */ }
    return contractById(id);
}

export function selectContract(id, storage = browserSessionStorage()) {
    const contract = BY_ID.get(id);
    if (!contract)
        return { ok: false, reason: 'UNKNOWN CONTRACT', contract: selectedContract(storage) };
    try { storage?.setItem(CONTRACT_STORAGE_KEY, contract.id); }
    catch { return { ok: false, reason: 'CONTRACT SELECTION UNAVAILABLE', contract: selectedContract(storage) }; }
    return { ok: true, contract };
}
