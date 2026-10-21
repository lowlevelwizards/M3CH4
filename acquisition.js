import { normalizePaint } from './factoryPaint.js';
/** k.3e.0: first real ownership + salvage acquisition.
 *
 * The catalogue describes what exists in the world. assembly.owned describes what
 * the player physically possesses. This module keeps those two concepts separate
 * without adding a shop, rarity, procedural loot, or duplicate-part handling yet.
 */
import { BY_ID, installedPart, makeTestAssembly, SLOTS } from './components.js';

export const STARTER_DEFINITION_IDS = Object.freeze([
    'frame-sr',
    'legs-yard',
    'power-dynamo',
    'cab-cyclops',
    'gun-cannon',
]);

const STARTER_IDS = new Set(STARTER_DEFINITION_IDS);
const SALVAGE_PRIORITY = Object.freeze(['combat', 'power', 'mobility', 'command', 'structure']);
const clamp01 = value => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

/** Fresh players own only the five modules that make up the starter rig. */
export function makeStarterAssembly() {
    const assembly = makeTestAssembly();
    assembly.owned = assembly.owned.filter(part => STARTER_IDS.has(part.definitionId));
    return assembly;
}

export function isStarterDefinition(definitionId) {
    return STARTER_IDS.has(definitionId);
}

/** Combine remaining housing and internal integrity into one portable salvage
 * condition. The current owned-part format has one condition field, so armor wear
 * is folded into that condition rather than pretending a recovered shell is fresh. */
export function salvageCondition(part) {
    if (!part)
        return 0;
    const maximum = Math.max(1, Number(part.maxIntegrity) + Number(part.maxArmor));
    return clamp01((Number(part.integrity) + Number(part.armor)) / maximum);
}

export function salvageRecoveryFee(definition, condition) {
    if (!definition)
        return 0;
    const mass = Math.max(0, Number(definition.massKg) || 0);
    const usable = clamp01(condition);
    // Recovery is mostly crane/transport labor. Better-condition parts carry a
    // modest premium, while badly damaged parts remain worth dragging home.
    return Math.max(40, Math.ceil(55 + mass * .20 + usable * 45));
}

/** Offer one actually fitted enemy component the player does not already own.
 * Contracts may put their signature hardware first; old/debug targets retain the
 * original deterministic weapon -> power -> mobility -> cab -> frame priority. */
export function salvageOffer(playerAssembly, targetAssembly, targetCondition) {
    if (!playerAssembly?.owned || !targetAssembly || !targetCondition?.parts)
        return null;
    const ownedDefinitions = new Set(playerAssembly.owned.map(part => part.definitionId));
    const priority = Array.isArray(targetAssembly.salvagePriority) && targetAssembly.salvagePriority.length
        ? targetAssembly.salvagePriority
        : SALVAGE_PRIORITY;
    for (const slot of priority) {
        const fitted = installedPart(targetAssembly, slot);
        const conditionPart = targetCondition.parts[slot];
        if (!fitted || !conditionPart || ownedDefinitions.has(fitted.definition.id))
            continue;
        const condition = salvageCondition(conditionPart);
        return {
            slot,
            definitionId: fitted.definition.id,
            sourceSerial: fitted.instance.serial,
            name: fitted.definition.name,
            condition,
            recoveryFee: salvageRecoveryFee(fitted.definition, condition),
            ...(normalizePaint(fitted.instance.paint)?{paint:normalizePaint(fitted.instance.paint)}:{}),
        };
    }
    return null;
}

function nextRecoveredSerial(assembly) {
    let highest = 0;
    for (const part of assembly.owned ?? []) {
        const match = /^REC-(\d+)$/.exec(part.serial ?? '');
        if (match)
            highest = Math.max(highest, Number(match[1]));
    }
    return `REC-${String(highest + 1).padStart(4, '0')}`;
}

/** Add one physical recovered component to ownership. Definition IDs describe a model;
 * serials identify possessions, so multiple Yardwalkers/cannons/etc. are legitimate. */
export function recoverSalvage(assembly, offer) {
    if (!assembly?.owned || !offer || !BY_ID.has(offer.definitionId))
        return { ok: false, reason: 'INVALID SALVAGE' };
    const definition = BY_ID.get(offer.definitionId);
    if (definition.slot !== offer.slot)
        return { ok: false, reason: 'SALVAGE SLOT MISMATCH' };
    const preserve = offer.preserveSourceSerial === true && typeof offer.sourceSerial === 'string' &&
        offer.sourceSerial.length > 0 && !assembly.owned.some(part => part.serial === offer.sourceSerial);
    const instance = {
        serial: preserve ? offer.sourceSerial : nextRecoveredSerial(assembly),
        definitionId: offer.definitionId,
        condition: clamp01(offer.condition),
        wear: Math.min(.35, (1 - clamp01(offer.condition)) * .12),
        repairs: 0,
        destroyed: false,
        ...(normalizePaint(offer.paint)?{paint:normalizePaint(offer.paint)}:{}),
    };
    assembly.owned.push(instance);
    return { ok: true, instance, definition };
}

/** Lightweight invariant used by persistence/tests. */
export function hasStarterInventory(assembly) {
    const owned = new Set((assembly?.owned ?? []).map(part => part.definitionId));
    return STARTER_DEFINITION_IDS.every(id => owned.has(id));
}

export function installedDefinitions(assembly) {
    return Object.fromEntries(SLOTS.map(slot => [slot, installedPart(assembly, slot)?.definition.id ?? null]));
}
