/** Authored scrapyard jobs + opponent recipes.
 *
 * k.3n.0 expands the original three-opponent ladder into a tiny campaign without
 * creating a second combat stack. Every node is still an ordinary physical bout;
 * campaign state only decides which authored job may currently be selected.
 */
import { accessibleContractId, isContractUnlocked, loadProgression } from './progression.js';
import { campaignFallbackNode, isCampaignNodeAvailable, loadCampaign } from './campaign.js';

export const CONTRACT_STORAGE_KEY = 'm3ch4-contract-v1';

const YARD_DOG_BEHAVIOR = Object.freeze({
    id: 'pressure', label: 'PRESSURE FIGHTER', preferredRangeM: 6.2, rangeBandM: 1.0,
    approachThrottle: .72, approachStrafe: .10, retreatThrottle: .62, strafeThrottle: .68,
    strafeSeconds: 2.2, braceSeconds: .75, closeAction: 'retreat', closeRetreatM: 0,
    steerGain: 1.75, yawRateDamping: 1.15, spreadScale: 1.0,
    aimPriority: Object.freeze(['structure', 'mobility', 'combat', 'structure', 'power', 'command']),
});

const RECOVERY_BEHAVIOR = Object.freeze({
    ...YARD_DOG_BEHAVIOR,
    label: 'YARD CLEANUP CREW',
    approachThrottle: .58,
    strafeThrottle: .48,
    spreadScale: 1.18,
});

const CUTTER_BEHAVIOR = Object.freeze({
    id: 'skirmisher', label: 'MOBILE SKIRMISHER', preferredRangeM: 8.4, rangeBandM: 1.0,
    approachThrottle: .82, approachStrafe: .34, retreatThrottle: .86, strafeThrottle: .96,
    strafeSeconds: 3.4, braceSeconds: .18, closeAction: 'retreat', closeRetreatM: 0,
    steerGain: 2.05, yawRateDamping: 1.0, spreadScale: 1.10,
    aimPriority: Object.freeze(['mobility', 'combat', 'power', 'mobility', 'command', 'combat']),
});

const MULE_BEHAVIOR = Object.freeze({
    id: 'bruiser', label: 'ADVANCING BRUISER', preferredRangeM: 4.8, rangeBandM: .8,
    approachThrottle: .88, approachStrafe: 0, retreatThrottle: .38, strafeThrottle: .28,
    strafeSeconds: .55, braceSeconds: 2.35, closeAction: 'brace', closeRetreatM: 1.55,
    steerGain: 1.45, yawRateDamping: 1.35, spreadScale: .82,
    aimPriority: Object.freeze(['structure', 'structure', 'mobility', 'command', 'structure', 'power']),
});

const yardLoadout = Object.freeze({
    structure: 'frame-sr', mobility: 'legs-yard', power: 'power-air',
    command: 'cab-cyclops', combat: 'gun-short',
});

export const CONTRACTS = Object.freeze([
    Object.freeze({
        id: 'yard-dog', name: 'YARD DOG', opponentSerial: 'YD-01', serialPrefix: 'YD01',
        role: 'BALANCED SCRAPPER', payout: 850, risk: 'LIGHT', kind: 'OPENING BOUT',
        loadout: yardLoadout, behavior: YARD_DOG_BEHAVIOR,
        objective: Object.freeze({ type: 'elimination', label: 'BREAK HOSTILE TEAM', description: 'Win the opening bout by making the opposing squad combat ineffective.' }),
        salvagePriority: Object.freeze(['combat', 'power', 'mobility', 'command', 'structure']),
        knownEquipment: Object.freeze(['Yardwalker', 'Stump Cannon', 'A-1 Generator']),
        salvageHint: 'BASELINE YARD HARDWARE',
        briefing: 'Conventional yard rig. Predictable pressure, measured sidesteps and a heavy short cannon.',
    }),
    Object.freeze({
        id: 'recovery-run', name: 'RECOVERY RUN', opponentSerial: 'REC-01', serialPrefix: 'REC01',
        role: 'LOW-RISK YARD WORK', payout: 450, risk: 'LOW', kind: 'OPTIONAL RECOVERY',
        loadout: Object.freeze({...yardLoadout, combat:'gun-cannon'}), behavior: RECOVERY_BEHAVIOR,
        objective: Object.freeze({ type: 'recovery', label: 'SECURE RECOVERY SITE', description: 'Hold the marked east-yard recovery pad uncontested.', point: Object.freeze({ x: 16, z: 1.5 }), radius: 4.8, holdSeconds: 8.5 }),
        salvagePriority: Object.freeze(['power', 'combat', 'mobility', 'structure', 'command']),
        knownEquipment: Object.freeze(['Training Cannon', 'Common Yard Lots', 'Repairable Hardware']),
        salvageHint: 'COMMON / STABILIZING SALVAGE',
        briefing: 'A smaller cleanup crew working a quiet corner of the yard. Lower pay, lighter opposition and useful common hardware.',
    }),
    Object.freeze({
        id: 'cutter', name: 'CUTTER', opponentSerial: 'CUT-01', serialPrefix: 'CUT01',
        role: 'FAST / LIGHT', payout: 950, risk: 'MODERATE', kind: 'CIRCUIT BOUT',
        loadout: Object.freeze({
            structure: 'frame-utility', mobility: 'legs-compact', power: 'power-air',
            command: 'cab-utility', combat: 'gun-light',
        }),
        behavior: CUTTER_BEHAVIOR,
        objective: Object.freeze({ type: 'control', label: 'HOLD WEST CONTROL', description: 'Control the marked west-yard work zone while Cutter contests it.', point: Object.freeze({ x: -16, z: -1 }), radius: 4.8, holdSeconds: 11 }),
        salvagePriority: Object.freeze(['mobility', 'combat', 'command', 'power', 'structure']),
        knownEquipment: Object.freeze(['Kestrel', 'Needle Cannon']),
        salvageHint: 'HIGH-MOBILITY HARDWARE',
        briefing: 'Light skirmisher. Keeps distance, changes lateral direction often and hunts exposed systems.',
    }),
    Object.freeze({
        id: 'domination', name: 'THREE POINT LOCK', opponentSerial: 'DOM-01', serialPrefix: 'DOM01',
        role: 'TERRITORY CREW', payout: 1100, risk: 'MODERATE', kind: 'DOMINATION CONTRACT',
        loadout: Object.freeze({...yardLoadout, power:'power-dynamo', combat:'gun-rivet'}), behavior: YARD_DOG_BEHAVIOR,
        objective: Object.freeze({
            type:'domination',label:'SECURE TWO OF THREE',description:
                'Capture A, B and C. Hold two uncontested points to score; first to 60 wins. Contested zones stop paying.',
            radius:4.7,captureSeconds:3.6,scoreToWin:60,scoreRate:1.2,
            points:Object.freeze([
                Object.freeze({id:'A',x:-17,z:-1.5}),
                Object.freeze({id:'B',x:0,z:-9.1}),
                Object.freeze({id:'C',x:17,z:1.5}),
            ]),
        }),
        salvagePriority: Object.freeze(['mobility','command','combat','power','structure']),
        knownEquipment:Object.freeze(['RR-4 Rivet Repeater','Needle Flanker','Hauler Scattergun']),
        salvageHint:'TERRITORY CREW SPARES',
        briefing:'The RR-4 lead lays down suppressing rivets while a fast Needle flanker changes lanes and a Hauler guard punishes close pushes with a scattergun. Take two points, not every firefight.',
    }),
    Object.freeze({
        id: 'mule', name: 'MULE', opponentSerial: 'MULE-01', serialPrefix: 'MULE01',
        role: 'HEAVY / TOUGH', payout: 1050, risk: 'HEAVY', kind: 'CIRCUIT BOUT',
        loadout: Object.freeze({
            structure: 'frame-wedge', mobility: 'legs-hauler', power: 'power-dynamo',
            command: 'cab-cyclops', combat: 'gun-breaker',
        }),
        behavior: MULE_BEHAVIOR,
        objective: Object.freeze({ type: 'breakthrough', label: 'BREAK THE FAR LINE', description: 'Get a friendly rig into the hostile backline and hold long enough to break through.', friendlyGoal: Object.freeze({ x: 0, z: -20 }), hostileGoal: Object.freeze({ x: 0, z: 20 }), radius: 4.4, holdSeconds: 5.5 }),
        salvagePriority: Object.freeze(['mobility', 'structure', 'combat', 'power', 'command']),
        knownEquipment: Object.freeze(['Breaker Driver', 'Arc Cutter', 'Hauler H2', 'W-3 Wedge']),
        salvageHint: 'HEAVY / DURABLE HARDWARE',
        briefing: 'The Hauler charges a hydraulic Breaker shot before striking layered armor. Its welding escort rushes close with an Arc Cutter while a Kestrel flanker strips mobility.',
    }),
    Object.freeze({
        id: 'circuit-final', name: 'CIRCUIT FINAL', opponentSerial: 'FIN-01', serialPrefix: 'FIN01',
        role: 'MIXED SCRAPYARD CREW', payout: 1450, risk: 'SEVERE', kind: 'FINAL CONTRACT',
        loadout: Object.freeze({...yardLoadout,combat:'gun-rocket'}), behavior: YARD_DOG_BEHAVIOR,
        objective: Object.freeze({ type: 'elimination', label: 'BREAK THE CIRCUIT CREW', description: 'The final is a straight mixed-role squad fight. Make the opposing team combat ineffective.' }),
        salvagePriority: Object.freeze(['combat', 'mobility', 'structure', 'power', 'command']),
        knownEquipment: Object.freeze(['Scrap Rocket Rack','RR-4 Rivet Wing', 'Breaker Hauler']),
        salvageHint: 'MIXED SIGNATURE HARDWARE',
        briefing: 'An unguided rocket lead controls open ground, an RR-4 Kestrel wing keeps lanes hot, and a braced Hauler drives penetrators through exposed assemblies.',
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

function browserCampaign() {
    return typeof window !== 'undefined' ? loadCampaign() : null;
}

function allowedId(requestedId, progression, campaign) {
    if (campaign) return isCampaignNodeAvailable(campaign, requestedId) ? requestedId : campaignFallbackNode(campaign);
    if (progression) return accessibleContractId(progression, requestedId);
    return BY_ID.has(requestedId) ? requestedId : DEFAULT_CONTRACT_ID;
}

export function selectedContract(storage = browserSessionStorage(), progression = browserProgression(), campaign = browserCampaign()) {
    let id = DEFAULT_CONTRACT_ID;
    try { id = storage?.getItem(CONTRACT_STORAGE_KEY) || DEFAULT_CONTRACT_ID; }
    catch { /* Session storage is optional. */ }
    id = allowedId(id, progression, campaign);
    return contractById(id);
}

export function selectContract(id, storage = browserSessionStorage(), progression = browserProgression(), campaign = browserCampaign()) {
    const contract = BY_ID.get(id);
    if (!contract)
        return { ok: false, reason: 'UNKNOWN CONTRACT', contract: selectedContract(storage, progression, campaign) };
    if (campaign && !isCampaignNodeAvailable(campaign, id))
        return { ok: false, reason: 'CAMPAIGN NODE LOCKED', contract: selectedContract(storage, progression, campaign) };
    if (!campaign && progression && BY_ID.has(id) && ['yard-dog', 'cutter', 'mule'].includes(id) && !isContractUnlocked(progression, id))
        return { ok: false, reason: 'CONTRACT LOCKED', contract: selectedContract(storage, progression, campaign) };
    try { storage?.setItem(CONTRACT_STORAGE_KEY, contract.id); }
    catch { return { ok: false, reason: 'CONTRACT SELECTION UNAVAILABLE', contract: selectedContract(storage, progression, campaign) }; }
    return { ok: true, contract };
}
