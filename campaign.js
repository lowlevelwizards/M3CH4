/** k.3n.0 — tiny Scrapyard Circuit campaign state.
 *
 * Campaign persistence is intentionally separate from the physical machine save.
 * The machine remains authoritative for inventory, condition, credits and repairs;
 * this module only remembers which jobs were cleared and a few run-summary facts.
 * Existing k.3h progression is imported once when no campaign save exists so an
 * established prototype save does not lose its place in the circuit.
 */
import { loadProgression } from './progression.js';

export const CAMPAIGN_ID = 'scrapyard-circuit-01';
export const CAMPAIGN_STORAGE_KEY = 'm3ch4-campaign-v1';
export const CAMPAIGN_VERSION = 1;
export const CAMPAIGN_REQUIRED_NODES = Object.freeze(['yard-dog', 'cutter', 'mule', 'circuit-final']);

export const CAMPAIGN_NODES = Object.freeze([
    Object.freeze({ id: 'yard-dog', stage: '01', lane: 'opening', required: true, prereq: null }),
    Object.freeze({ id: 'recovery-run', stage: '02A', lane: 'recovery', required: false, prereq: 'yard-dog' }),
    Object.freeze({ id: 'cutter', stage: '02B', lane: 'risk', required: true, prereq: 'yard-dog' }),
    Object.freeze({ id: 'domination', stage: '02C', lane: 'territory', required: false, prereq: 'yard-dog' }),
    Object.freeze({ id: 'mule', stage: '03', lane: 'pressure', required: true, prereq: 'cutter' }),
    Object.freeze({ id: 'circuit-final', stage: '04', lane: 'final', required: true, prereq: 'mule' }),
]);

const NODE_IDS = new Set(CAMPAIGN_NODES.map(node => node.id));
const CORE_LEGACY_IDS = new Set(['yard-dog', 'cutter', 'mule']);
const finiteInt = value => Number.isSafeInteger(value) && value >= 0 ? value : 0;
const uniqueKnown = values => {
    const out = [];
    const seen = new Set();
    for (const id of Array.isArray(values) ? values : []) {
        if (!NODE_IDS.has(id) || seen.has(id)) continue;
        seen.add(id); out.push(id);
    }
    return out;
};

function browserLocalStorage() {
    try { return typeof window !== 'undefined' ? window.localStorage : null; }
    catch { return null; }
}

export function createCampaignState({
    clearedNodes = [], sorties = 0, victories = 0, defeats = 0,
    creditsEarned = 0, salvageRecovered = 0, status = 'active',
} = {}) {
    const cleared = uniqueKnown(clearedNodes);
    const complete = cleared.includes('circuit-final');
    return {
        version: CAMPAIGN_VERSION,
        id: CAMPAIGN_ID,
        status: complete || status === 'complete' ? 'complete' : 'active',
        clearedNodes: cleared,
        sorties: finiteInt(sorties),
        victories: finiteInt(victories),
        defeats: finiteInt(defeats),
        creditsEarned: finiteInt(creditsEarned),
        salvageRecovered: finiteInt(salvageRecovered),
    };
}

export function campaignFromLegacyProgression(progression) {
    const cleared = (progression?.clearedContracts ?? []).filter(id => CORE_LEGACY_IDS.has(id));
    return createCampaignState({ clearedNodes: cleared });
}

export function campaignNode(id) {
    return CAMPAIGN_NODES.find(node => node.id === id) ?? null;
}

export function availableCampaignNodes(state) {
    const campaign = createCampaignState(state);
    if (campaign.status === 'complete') return CAMPAIGN_NODES.map(node => node.id);
    const cleared = new Set(campaign.clearedNodes);
    const available = new Set(['yard-dog']);
    for (const id of campaign.clearedNodes) available.add(id); // cleared jobs remain replayable
    if (cleared.has('yard-dog')) {
        available.add('cutter');
        available.add('recovery-run');
        available.add('domination');
    }
    if (campaign.defeats > 0) available.add('recovery-run');
    if (campaign.status === 'complete') available.add('domination');
    if (cleared.has('cutter')) available.add('mule');
    if (cleared.has('mule')) available.add('circuit-final');
    return CAMPAIGN_NODES.map(node => node.id).filter(id => available.has(id));
}

export function isCampaignNodeAvailable(state, id) {
    return NODE_IDS.has(id) && availableCampaignNodes(state).includes(id);
}

export function campaignFallbackNode(state) {
    const campaign = createCampaignState(state);
    const available = availableCampaignNodes(campaign);
    const nextRequired = CAMPAIGN_REQUIRED_NODES.find(id => available.includes(id) && !campaign.clearedNodes.includes(id));
    return nextRequired ?? available.find(id => id !== 'recovery-run') ?? 'yard-dog';
}

export function campaignSummary(state) {
    const campaign = createCampaignState(state);
    const clearedRequired = CAMPAIGN_REQUIRED_NODES.filter(id => campaign.clearedNodes.includes(id)).length;
    return {
        ...campaign,
        clearedRequired,
        requiredTotal: CAMPAIGN_REQUIRED_NODES.length,
        complete: campaign.status === 'complete',
        availableNodes: availableCampaignNodes(campaign),
    };
}

export function recordCampaignSortie(state, { nodeId, victory, creditsEarned = 0 } = {}) {
    const campaign = createCampaignState(state);
    if (!NODE_IDS.has(nodeId)) return { state: campaign, firstClear: false, becameComplete: false, newlyAvailable: [] };
    const before = new Set(availableCampaignNodes(campaign));
    campaign.sorties++;
    campaign.creditsEarned += finiteInt(creditsEarned);
    if (victory) campaign.victories++;
    else campaign.defeats++;
    const firstClear = !!victory && !campaign.clearedNodes.includes(nodeId);
    if (firstClear) campaign.clearedNodes.push(nodeId);
    const becameComplete = firstClear && nodeId === 'circuit-final';
    if (becameComplete) campaign.status = 'complete';
    const after = availableCampaignNodes(campaign);
    const newlyAvailable = after.filter(id => !before.has(id));
    return { state: campaign, firstClear, becameComplete, newlyAvailable };
}

export function recordCampaignSalvage(state, count = 1) {
    const campaign = createCampaignState(state);
    campaign.salvageRecovered += Math.max(0, finiteInt(count));
    return campaign;
}

export function loadCampaign(storage = browserLocalStorage(), legacyProgression = null) {
    if (!storage) return createCampaignState();
    try {
        const raw = storage.getItem(CAMPAIGN_STORAGE_KEY);
        if (raw) {
            const data = JSON.parse(raw);
            if (data?.version === CAMPAIGN_VERSION && data?.id === CAMPAIGN_ID)
                return createCampaignState(data);
        }
        const migrated = campaignFromLegacyProgression(legacyProgression ?? loadProgression(storage));
        storage.setItem(CAMPAIGN_STORAGE_KEY, JSON.stringify(migrated));
        return migrated;
    } catch {
        return createCampaignState();
    }
}

export function storeCampaign(state, storage = browserLocalStorage()) {
    if (!storage) return false;
    try {
        storage.setItem(CAMPAIGN_STORAGE_KEY, JSON.stringify(createCampaignState(state)));
        return true;
    } catch {
        return false;
    }
}

export function resetCampaign(storage = browserLocalStorage()) {
    const fresh = createCampaignState();
    if (!storage) return fresh;
    try { storage.setItem(CAMPAIGN_STORAGE_KEY, JSON.stringify(fresh)); }
    catch { /* callers can still continue with the in-memory fresh state */ }
    return fresh;
}

export function clearCampaign(storage = browserLocalStorage()) {
    if (!storage) return false;
    try { storage.removeItem(CAMPAIGN_STORAGE_KEY); return true; }
    catch { return false; }
}
