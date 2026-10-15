/** k.3g.0 roster, extended in k.3h.0 with progression-gated selection.
 *
 * A contract remains only an opponent recipe + payout + presentation + behavior.
 * Combat, damage and salvage remain owned by their existing systems. Progression
 * only decides which authored opponent may currently be selected.
 */
import { accessibleContractId, isContractUnlocked, loadProgression } from './progression.js';

export const CONTRACT_STORAGE_KEY = 'm3ch4-contract-v1';

const YARD_DOG_BEHAVIOR = Object.freeze({
    id: 'pressure',
    label: 'PRESSURE FIGHTER',
    preferredRangeM: 6.2,
    rangeBandM: 1.0,
    approachThrottle: .72,
    approachStrafe: .10,
    retreatThrottle: .62,
    strafeThrottle: .68,
    strafeSeconds: 2.2,
    braceSeconds: .75,
    closeAction: 'retreat',
    closeRetreatM: 0,
    steerGain: 1.75,
    yawRateDamping: 1.15,
    fireCadenceScale: 1.0,
    spreadScale: 1.0,
    aimPriority: Object.freeze(['structure', 'mobility', 'combat', 'structure', 'power', 'command']),
});

const CUTTER_BEHAVIOR = Object.freeze({
    id: 'skirmisher',
    label: 'MOBILE SKIRMISHER',
    preferredRangeM: 8.4,
    rangeBandM: 1.0,
    approachThrottle: .82,
    approachStrafe: .34,
    retreatThrottle: .86,
    strafeThrottle: .96,
    strafeSeconds: 3.4,
    braceSeconds: .18,
    closeAction: 'retreat',
    closeRetreatM: 0,
    steerGain: 2.05,
    yawRateDamping: 1.0,
    fireCadenceScale: .78,
    spreadScale: 1.10,
    aimPriority: Object.freeze(['mobility', 'combat', 'power', 'mobility', 'command', 'combat']),
});

const MULE_BEHAVIOR = Object.freeze({
    id: 'bruiser',
    label: 'ADVANCING BRUISER',
    preferredRangeM: 4.8,
    rangeBandM: .8,
    approachThrottle: .88,
    approachStrafe: 0,
    retreatThrottle: .38,
    strafeThrottle: .28,
    strafeSeconds: .55,
    braceSeconds: 2.35,
    closeAction: 'brace',
    closeRetreatM: 1.55,
    steerGain: 1.45,
    yawRateDamping: 1.35,
    fireCadenceScale: 1.22,
    spreadScale: .82,
    aimPriority: Object.freeze(['structure', 'structure', 'mobility', 'command', 'structure', 'power']),
});

export const CONTRACTS = Object.freeze([
    Object.freeze({
        id: 'yard-dog',
        name: 'YARD DOG',
        opponentSerial: 'YD-01',
        serialPrefix: 'YD01',
        role: 'BALANCED SCRAPPER',
        payout: 850,
        loadout: Object.freeze({
            structure: 'frame-sr', mobility: 'legs-yard', power: 'power-air',
            command: 'cab-cyclops', combat: 'gun-short',
        }),
        behavior: YARD_DOG_BEHAVIOR,
        salvagePriority: Object.freeze(['combat', 'power', 'mobility', 'command', 'structure']),
        knownEquipment: Object.freeze(['Yardwalker', 'Stump Cannon', 'A-1 Generator']),
        briefing: 'Conventional yard rig. Predictable pressure, measured sidesteps and a heavy short cannon.',
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
        behavior: CUTTER_BEHAVIOR,
        salvagePriority: Object.freeze(['mobility', 'combat', 'command', 'power', 'structure']),
        knownEquipment: Object.freeze(['Kestrel', 'Needle Cannon']),
        briefing: 'Light skirmisher. Keeps distance, changes lateral direction often and hunts exposed systems.',
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
        behavior: MULE_BEHAVIOR,
        salvagePriority: Object.freeze(['mobility', 'structure', 'combat', 'power', 'command']),
        knownEquipment: Object.freeze(['Hauler H2', 'W-3 Wedge']),
        briefing: 'Heavy bruiser. Walks down space, braces in cannon range and favors deliberate center-mass fire.',
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

function browserProgression() {
    return typeof window !== 'undefined' ? loadProgression() : null;
}

export function selectedContract(storage = browserSessionStorage(), progression = browserProgression()) {
    let id = DEFAULT_CONTRACT_ID;
    try { id = storage?.getItem(CONTRACT_STORAGE_KEY) || DEFAULT_CONTRACT_ID; }
    catch { /* Session storage is optional; fall back to Yard Dog. */ }
    if (progression)
        id = accessibleContractId(progression, id);
    return contractById(id);
}

export function selectContract(id, storage = browserSessionStorage(), progression = browserProgression()) {
    const contract = BY_ID.get(id);
    if (!contract)
        return { ok: false, reason: 'UNKNOWN CONTRACT', contract: selectedContract(storage, progression) };
    if (progression && !isContractUnlocked(progression, id))
        return { ok: false, reason: 'CONTRACT LOCKED', contract: selectedContract(storage, progression) };
    try { storage?.setItem(CONTRACT_STORAGE_KEY, contract.id); }
    catch { return { ok: false, reason: 'CONTRACT SELECTION UNAVAILABLE', contract: selectedContract(storage, progression) }; }
    return { ok: true, contract };
}
