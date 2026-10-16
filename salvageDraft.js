/** k.3l.0 — sanctioned Scrapyard field-control salvage.
 *
 * The losing machines create the physical pool. The winning team gets one claim per
 * pilot, ordered by bout score. Destroyed parts remain visible as scrap but cannot be
 * claimed as usable hardware. This module is pure policy/data; DOM and persistence live
 * elsewhere.
 */
import { installedPart, SLOTS } from './components.js';
import { salvageCondition, salvageRecoveryFee } from './acquisition.js';
import { partFate } from './damageFate.js';

export const SCRAPYARD_CHARTER = Object.freeze({
    id: 'scrapyard-sanctioned-v1',
    label: 'SCRAPYARD CIRCUIT · SANCTIONED RECOVERY',
    claimsPerWinningPilot: 1,
    personalHardwareForfeiture: false,
    destroyedHardware: 'SCRAP ONLY',
    recovery: 'HOUSE RECOVERY',
});

const conditionState = part => {
    const fate = partFate(part);
    if (fate === 'destroyed' || fate === 'disabled' || fate === 'critical' || fate === 'damaged') return fate;
    return 'operational';
};

export function wreckManifest(actor) {
    if (!actor?.assembly || !actor?.condition?.parts) return null;
    const parts = [];
    for (const slot of SLOTS) {
        const fitted = installedPart(actor.assembly, slot);
        const state = actor.condition.parts[slot];
        if (!fitted || !state) continue;
        const condition = salvageCondition(state);
        const status = conditionState(state);
        parts.push({
            id: `${actor.id}:${slot}:${fitted.instance.serial}`,
            actorId: actor.id,
            actorLabel: actor.label ?? actor.id,
            slot,
            definitionId: fitted.definition.id,
            sourceSerial: fitted.instance.serial,
            name: fitted.definition.name,
            condition,
            status,
            destroyed: status === 'destroyed',
            disabled: status === 'disabled',
            recoveryFee: salvageRecoveryFee(fitted.definition, condition),
            integrity: state.integrity,
            maxIntegrity: state.maxIntegrity,
            armor: state.armor,
            maxArmor: state.maxArmor,
        });
    }
    return {
        actorId: actor.id,
        label: actor.label ?? actor.id,
        active: actor.active !== false,
        killReason: actor.killReason ?? null,
        parts,
    };
}

export function buildWreckManifests(actors = []) {
    return actors.map(wreckManifest).filter(Boolean);
}

/** Condition-weighted remains of the defeated field. Destroyed hardware contributes
 * zero; pristine surviving hardware contributes one. This is a sporting/economic stat,
 * not an extra source of pilot score. */
export function wreckPreservation(manifests = []) {
    const parts = manifests.flatMap(manifest => manifest.parts ?? []);
    if (!parts.length) return 0;
    const retained = parts.reduce((sum, part) => sum + (part.destroyed ? 0 : Math.max(0, Math.min(1, part.condition))), 0);
    return Math.round(retained / parts.length * 100);
}

export function draftSequence(order = [], rounds = 1) {
    const base = [...order];
    const result = [];
    for (let round = 0; round < Math.max(0, Math.floor(rounds)); round++)
        result.push(...(round % 2 === 0 ? base : [...base].reverse()));
    return result;
}

export function createSalvageDraft({ draftOrder = [], manifests = [], claimsPerPilot = SCRAPYARD_CHARTER.claimsPerWinningPilot } = {}) {
    const pool = manifests.flatMap(manifest => manifest.parts.map(part => ({ ...part, claimedBy: null })));
    const rounds = Math.max(1, Math.floor(claimsPerPilot || 1));
    return {
        charter: SCRAPYARD_CHARTER,
        order: draftSequence(draftOrder, rounds),
        cursor: 0,
        pool,
        picks: [],
    };
}

export function currentDrafter(draft) {
    return draft?.order?.[draft.cursor] ?? null;
}

export function availableClaims(draft) {
    return (draft?.pool ?? []).filter(entry => !entry.destroyed && !entry.claimedBy);
}

const SLOT_PREFERENCES = Object.freeze({
    'ally-1': Object.freeze(['mobility','combat','power','command','structure']),
    'ally-2': Object.freeze(['mobility','structure','combat','power','command']),
});

export function chooseAiClaim(draft, actorId) {
    const available = availableClaims(draft);
    if (!available.length) return null;
    const preference = SLOT_PREFERENCES[actorId] ?? ['combat','power','mobility','command','structure'];
    const slotRank = slot => preference.indexOf(slot) >= 0 ? preference.indexOf(slot) : preference.length;
    return [...available].sort((a, b) => {
        const aScore = a.condition * 100 - slotRank(a.slot) * 7;
        const bScore = b.condition * 100 - slotRank(b.slot) * 7;
        return bScore - aScore || b.condition - a.condition || a.id.localeCompare(b.id);
    })[0];
}

export function claimDraftEntry(draft, actorId, entryId, { allowDestroyed = false } = {}) {
    if (!draft || currentDrafter(draft) !== actorId)
        return { ok: false, reason: 'NOT YOUR DRAFT TURN' };
    const entry = draft.pool.find(item => item.id === entryId);
    if (!entry || entry.claimedBy)
        return { ok: false, reason: 'SALVAGE UNAVAILABLE' };
    if (entry.destroyed && !allowDestroyed)
        return { ok: false, reason: 'DESTROYED HARDWARE IS SCRAP ONLY' };
    entry.claimedBy = actorId;
    const pick = { actorId, entryId: entry.id, name: entry.name, condition: entry.condition, sourceSerial: entry.sourceSerial };
    draft.picks.push(pick);
    draft.cursor++;
    return { ok: true, entry, pick };
}

export function skipDraftTurn(draft, actorId, reason = 'NO CLAIM') {
    if (!draft || currentDrafter(draft) !== actorId)
        return { ok: false, reason: 'NOT YOUR DRAFT TURN' };
    const pick = { actorId, entryId: null, name: null, condition: null, sourceSerial: null, skipped: true, reason };
    draft.picks.push(pick);
    draft.cursor++;
    return { ok: true, pick };
}

/** Advance deterministic AI turns only. Stops when it is the player's turn or when
 * the draft is exhausted, so the UI never steals a player choice. */
export function advanceAiDraft(draft, playerId = 'player') {
    const advanced = [];
    while (currentDrafter(draft) && currentDrafter(draft) !== playerId) {
        const actorId = currentDrafter(draft);
        const choice = chooseAiClaim(draft, actorId);
        const result = choice
            ? claimDraftEntry(draft, actorId, choice.id)
            : skipDraftTurn(draft, actorId, 'NO RECOVERABLE HARDWARE');
        if (!result.ok) break;
        advanced.push(result.pick);
    }
    return advanced;
}

export function playerClaimChoices(draft, ownedDefinitions = new Set()) {
    return availableClaims(draft).filter(entry => !ownedDefinitions.has(entry.definitionId));
}

export function claimToRecoveryOffer(entry) {
    if (!entry || entry.destroyed) return null;
    return {
        slot: entry.slot,
        definitionId: entry.definitionId,
        sourceSerial: entry.sourceSerial,
        sourceActorId: entry.actorId,
        name: entry.name,
        condition: entry.condition,
        recoveryFee: entry.recoveryFee,
        preserveSourceSerial: true,
    };
}
