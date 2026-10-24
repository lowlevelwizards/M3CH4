/** k.3q.0 — named three-rig stable foundation.
 *
 * The existing v8 machine save remains the rollback-safe projection of whichever
 * commissioned rig is currently in the live garage. This registry owns persistent
 * rig identity and the installed serials for all three bays. Physical inventory is
 * global: one serial may be mounted to at most one rig at a time.
 */
import { BY_ID, SLOTS, equipSerial, inspectAssembly, installedPart, remove } from './components.js';
import { normalizeEquipment } from './equipment.js';
import { normalizePaint, validPaint } from './factoryPaint.js';
import { graphFromStations, graphMatchesStations, validateGraph } from './assemblyGraph.js';
import { createFunctionalDamage } from './functionalDamage.js';
import { createTargetCondition, reconcileTargetCondition } from './combat.js';
import { loadMachine, storeMachine } from './persistence.js';

export const STABLE_STORAGE_KEY = 'm3ch4-stable-v1';
export const STABLE_VERSION = 1;
export const RIG_IDS = Object.freeze(['rig-01', 'rig-02', 'rig-03']);
const MAX_NAME_LENGTH = 32;
const MAX_PARTS = 250;

const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const finite = value => Number.isFinite(value);
const cleanName = value => typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, MAX_NAME_LENGTH) : '';
const zeroCareer = () => ({
    deployments: 0,
    roundWins: 0,
    roundLosses: 0,
    contractWins: 0,
    damageDealt: 0,
    damageSustained: 0,
    enemySystemsDisabled: 0,
    fieldServices: 0,
    missionKills: 0,
    timesMissionKilled: 0,
    objectiveContribution: 0,
});

function zeroPartHistory(part, source = 'owned') {
    const slot = BY_ID.get(part.definitionId)?.slot ?? null;
    const history = {
        acquisitionSource: source,
        previousOwner: null,
        deployments: 0,
        machinesServed: [],
        damageSustained: 0,
        timesDisabled: 0,
        timesFieldServiced: 0,
        timesDestroyed: part.destroyed ? 1 : 0,
        timesRebuilt: 0,
    };
    if (slot === 'combat') Object.assign(history, {
        roundsFired: 0, hits: 0, damageDealt: 0, subsystemDisables: 0, finishingBlows: 0,
    });
    else if (slot === 'mobility') Object.assign(history, {
        distanceTravelledM: 0, objectiveTimeSeconds: 0, objectiveCaptures: 0, timesMobilityDisabled: 0,
    });
    else if (slot === 'power') history.brownouts = 0;
    else if (slot === 'structure') Object.assign(history, { damageAbsorbed: 0, missionKillsSurvived: 0 });
    return history;
}

function emptyRig(id, index) {
    return {
        id,
        bay: index + 1,
        commissioned: false,
        name: null,
        commissionedAt: null,
        commissionOrder: null,
        originalConfiguration: null,
        installed: {},
        equipment: {},
        graph: graphFromStations({ serial: 'SR-01', owned: [], installed: {} }, BY_ID),
        damage: null,
        playerCondition: null,
        career: zeroCareer(),
    };
}

function inventoryClone(owned = []) {
    return owned.map(part => ({
        serial: part.serial,
        definitionId: part.definitionId,
        condition: part.condition,
        wear: part.wear,
        repairs: part.repairs,
        destroyed: !!part.destroyed,
        ...(normalizePaint(part.paint) ? {paint:normalizePaint(part.paint)} : {}),
    }));
}

function assemblyFor(stable, rig) {
    const assembly = {
        serial: 'SR-01',
        name: rig.name || `RIG ${String(rig.bay).padStart(2, '0')}`,
        owned: inventoryClone(stable.inventory),
        installed: { ...rig.installed },
        equipment: normalizeEquipment(rig.equipment ?? {}),
    };
    assembly.graph = rig.graph ? clone(rig.graph) : graphFromStations(assembly, BY_ID);
    if (!graphMatchesStations(assembly, assembly.graph, BY_ID))
        assembly.graph = graphFromStations(assembly, BY_ID);
    return assembly;
}

function validPart(part, seen) {
    return object(part) && typeof part.serial === 'string' && part.serial.length > 0 && part.serial.length <= 80 &&
        typeof part.definitionId === 'string' && BY_ID.has(part.definitionId) && !seen.has(part.serial) &&
        finite(part.condition) && part.condition >= 0 && part.condition <= 1 && finite(part.wear) && part.wear >= 0 && part.wear <= 1 &&
        Number.isSafeInteger(part.repairs) && part.repairs >= 0 && typeof part.destroyed === 'boolean';
}

function validConditionSnapshot(snapshot) {
    if (!object(snapshot) || !object(snapshot.parts)) return false;
    return SLOTS.every(slot => {
        const part = snapshot.parts[slot];
        return object(part) && typeof part.serial === 'string' && finite(part.integrity) && finite(part.maxIntegrity) &&
            finite(part.armor) && finite(part.maxArmor) && Number.isSafeInteger(part.impacts) && part.impacts >= 0;
    });
}

function normalizeCareer(value) {
    const out = zeroCareer();
    if (!object(value)) return out;
    for (const key of Object.keys(out)) {
        const incoming = value[key];
        if (finite(incoming) && incoming >= 0) out[key] = incoming;
    }
    return out;
}

function ensurePartHistory(stable, part, source = 'owned') {
    if (!object(stable.partHistory[part.serial])) stable.partHistory[part.serial] = zeroPartHistory(part, source);
    const history = stable.partHistory[part.serial];
    if (!Array.isArray(history.machinesServed)) history.machinesServed = [];
    return history;
}

function noteMachineService(stable, rig, serial) {
    const part = stable.inventory.find(item => item.serial === serial);
    if (!part) return;
    const history = ensurePartHistory(stable, part);
    if (!history.machinesServed.includes(rig.id)) history.machinesServed.push(rig.id);
}

function validateRigGraph(stable, rig) {
    const assembly = assemblyFor(stable, rig);
    const verdict = validateGraph(assembly.graph, assembly, BY_ID);
    if (!verdict.valid || !graphMatchesStations(assembly, assembly.graph, BY_ID))
        throw new Error('Invalid rig assembly graph');
}

function normalizeStableData(data) {
    if (!object(data) || data.version !== STABLE_VERSION || !RIG_IDS.includes(data.activeRigId) ||
        !Array.isArray(data.inventory) || data.inventory.length < 1 || data.inventory.length > MAX_PARTS ||
        !Array.isArray(data.rigs) || data.rigs.length !== RIG_IDS.length)
        throw new Error('Unknown stable format');

    const seenParts = new Set();
    const inventory = data.inventory.map(part => {
        const normalized = { ...part, destroyed: !!part.destroyed };
        if (!validPart(normalized, seenParts)) throw new Error('Invalid stable inventory');
        seenParts.add(normalized.serial);
        return normalized;
    });
    const inventoryBySerial = new Map(inventory.map(part => [part.serial, part]));
    const installedOwners = new Map();
    const rigs = RIG_IDS.map((id, index) => {
        const saved = data.rigs.find(rig => rig?.id === id);
        if (!object(saved) || saved.bay !== index + 1 || typeof saved.commissioned !== 'boolean')
            throw new Error('Invalid rig record');
        const rig = emptyRig(id, index);
        rig.commissioned = saved.commissioned;
        rig.name = saved.commissioned ? cleanName(saved.name) : null;
        if (saved.commissioned && !rig.name) throw new Error('Commissioned rig needs a name');
        rig.commissionedAt = saved.commissionedAt == null ? null : String(saved.commissionedAt).slice(0, 64);
        rig.commissionOrder = saved.commissionOrder == null ? null : Number(saved.commissionOrder);
        rig.originalConfiguration = saved.originalConfiguration == null ? null : clone(saved.originalConfiguration);
        rig.installed = {};
        rig.equipment = normalizeEquipment(saved.equipment ?? {});
        if (!object(saved.installed)) throw new Error('Invalid installed map');
        for (const [slot, serial] of Object.entries(saved.installed)) {
            if (!SLOTS.includes(slot) || typeof serial !== 'string') throw new Error('Invalid installed station');
            const part = inventoryBySerial.get(serial);
            if (!part || BY_ID.get(part.definitionId)?.slot !== slot || installedOwners.has(serial))
                throw new Error('Serialized hardware mounted twice');
            rig.installed[slot] = serial;
            installedOwners.set(serial, id);
        }
        const candidate = { serial: 'SR-01', name: rig.name || id, owned: inventoryClone(inventory), installed: { ...rig.installed } };
        candidate.graph = saved.graph ? clone(saved.graph) : graphFromStations(candidate, BY_ID);
        if (!graphMatchesStations(candidate, candidate.graph, BY_ID) || !validateGraph(candidate.graph, candidate, BY_ID).valid)
            throw new Error('Invalid stored graph');
        rig.graph = candidate.graph;
        rig.damage = object(saved.damage) ? clone(saved.damage) : null;
        rig.playerCondition = validConditionSnapshot(saved.playerCondition) ? clone(saved.playerCondition) : null;
        rig.career = normalizeCareer(saved.career);
        return rig;
    });
    const stable = {
        version: STABLE_VERSION,
        activeRigId: data.activeRigId,
        inventory,
        rigs,
        partHistory: object(data.partHistory) ? clone(data.partHistory) : {},
    };
    for (const part of stable.inventory) ensurePartHistory(stable, part);
    return stable;
}

export function createStableFromMachine(machine, now = new Date().toISOString()) {
    const inventory = inventoryClone(machine.assembly.owned);
    const rigs = RIG_IDS.map(emptyRig);
    const rig = rigs[0];
    rig.commissioned = true;
    rig.name = cleanName(machine.assembly.name) || 'SCRAPYARD RIG';
    rig.commissionedAt = now;
    rig.commissionOrder = 1;
    rig.originalConfiguration = { ...machine.assembly.installed };
    rig.installed = { ...machine.assembly.installed };
    rig.equipment = normalizeEquipment(machine.assembly.equipment ?? {});
    rig.graph = clone(machine.assembly.graph || graphFromStations(machine.assembly, BY_ID));
    rig.damage = clone(machine.damage);
    rig.playerCondition = clone(machine.playerCondition);
    const stable = {
        version: STABLE_VERSION,
        activeRigId: rig.id,
        inventory,
        rigs,
        partHistory: {},
    };
    for (const part of inventory) ensurePartHistory(stable, part, 'starting inventory');
    for (const serial of Object.values(rig.installed)) noteMachineService(stable, rig, serial);
    return stable;
}

export function decodeStable(json, machine, now = new Date().toISOString()) {
    if (!json) return { stable: createStableFromMachine(machine, now), status: 'migrated' };
    try { return { stable: normalizeStableData(JSON.parse(json)), status: 'restored' }; }
    catch { return { stable: createStableFromMachine(machine, now), status: 'recovered' }; }
}

export function encodeStable(stable) {
    const normalized = normalizeStableData(clone(stable));
    return JSON.stringify(normalized);
}

export function rigById(stable, rigId) {
    return stable?.rigs?.find(rig => rig.id === rigId) ?? null;
}

export function serialOwner(stable, serial) {
    if (!serial) return null;
    for (const rig of stable.rigs) {
        if (Object.values(rig.installed).includes(serial)) return rig;
    }
    return null;
}

export function originalPartsRemaining(rig) {
    if (!rig?.originalConfiguration) return 0;
    return SLOTS.reduce((count, slot) => count + (rig.originalConfiguration[slot] && rig.originalConfiguration[slot] === rig.installed[slot] ? 1 : 0), 0);
}

export function rigFieldability(stable, rigId) {
    const rig = rigById(stable, rigId);
    if (!rig) return { fieldable: false, missing: [...SLOTS], destroyed: [], disabled: [], inspection: null };
    const assembly = assemblyFor(stable, rig);
    const inspection = inspectAssembly(assembly);
    const missing = SLOTS.filter(slot => !installedPart(assembly, slot));
    const destroyed = [];
    const disabled = [];
    for (const slot of SLOTS) {
        const part = installedPart(assembly, slot)?.instance;
        if (!part) continue;
        if (part.destroyed) destroyed.push(slot);
        else if (!(part.condition > .001)) disabled.push(slot);
    }
    return {
        fieldable: inspection.ready && missing.length === 0 && destroyed.length === 0 && disabled.length === 0,
        missing, destroyed, disabled, inspection,
    };
}

export function mountPartOnRig(stable, rigId, slot, serial) {
    const rig = rigById(stable, rigId);
    if (!rig || !SLOTS.includes(slot)) return { ok: false, reason: 'INVALID RIG STATION' };
    const part = stable.inventory.find(item => item.serial === serial);
    if (!part || BY_ID.get(part.definitionId)?.slot !== slot) return { ok: false, reason: 'PART DOES NOT FIT THIS STATION' };
    const owner = serialOwner(stable, serial);
    if (owner && owner.id !== rigId) return { ok: false, reason: `${serial} IS MOUNTED ON ${owner.name || `RIG ${String(owner.bay).padStart(2, '0')}`}` };
    try {
        const assembly = assemblyFor(stable, rig);
        equipSerial(assembly, slot, serial);
        rig.installed = { ...assembly.installed };
        rig.graph = clone(assembly.graph);
        noteMachineService(stable, rig, serial);
        if (rig.commissioned && validConditionSnapshot(rig.playerCondition)) {
            reconcileTargetCondition(rig.playerCondition, assembly);
        }
        return { ok: true, serial };
    } catch (error) {
        return { ok: false, reason: error?.message || 'MOUNT REJECTED' };
    }
}

export function unmountPartFromRig(stable, rigId, slot) {
    const rig = rigById(stable, rigId);
    if (!rig || !SLOTS.includes(slot)) return { ok: false, reason: 'INVALID RIG STATION' };
    try {
        const assembly = assemblyFor(stable, rig);
        const result = remove(assembly, slot);
        if (!result.ok) return result;
        rig.installed = { ...assembly.installed };
        rig.graph = clone(assembly.graph);
        return { ok: true };
    } catch (error) {
        return { ok: false, reason: error?.message || 'REMOVE REJECTED' };
    }
}

export function commissionRig(stable, rigId, name, now = new Date().toISOString()) {
    const rig = rigById(stable, rigId);
    if (!rig) return { ok: false, reason: 'UNKNOWN RIG' };
    if (rig.commissioned) return { ok: false, reason: 'MACHINE ALREADY COMMISSIONED' };
    const finalName = cleanName(name);
    if (!finalName) return { ok: false, reason: 'NAME REQUIRED' };
    const readiness = rigFieldability(stable, rigId);
    if (!readiness.fieldable) return { ok: false, reason: 'RIG IS NOT FIELDABLE' };
    const assembly = assemblyFor(stable, rig);
    const nextCommissionOrder = 1 + stable.rigs.filter(item => item.commissioned).length;
    rig.commissioned = true;
    rig.name = finalName;
    rig.commissionedAt = now;
    rig.commissionOrder = nextCommissionOrder;
    rig.originalConfiguration = { ...rig.installed };
    rig.damage = createFunctionalDamage();
    rig.playerCondition = createTargetCondition(assembly, true);
    rig.career = zeroCareer();
    for (const serial of Object.values(rig.installed)) noteMachineService(stable, rig, serial);
    return { ok: true, rig };
}

export function renameRig(stable, rigId, name) {
    const rig = rigById(stable, rigId);
    const finalName = cleanName(name);
    if (!rig?.commissioned) return { ok: false, reason: 'COMMISSION MACHINE BEFORE NAMING' };
    if (!finalName) return { ok: false, reason: 'NAME REQUIRED' };
    rig.name = finalName;
    return { ok: true, name: finalName };
}

/** Current v8 inventory/condition is authoritative for the live bay. If an older UI
 * somehow mounts an inactive rig's serial, the physical action wins and the inactive
 * record is detached so persistence can never contain one component in two machines. */
export function syncActiveMachineIntoStable(stable, machine) {
    const activeRig = rigById(stable, stable.activeRigId);
    if (!activeRig) throw new Error('Stable active rig is missing');
    stable.inventory = inventoryClone(machine.assembly.owned);
    for (const part of stable.inventory) ensurePartHistory(stable, part);
    for (const serial of Object.values(machine.assembly.installed)) {
        const owner = serialOwner(stable, serial);
        if (owner && owner.id !== activeRig.id) {
            for (const [slot, mounted] of Object.entries(owner.installed)) {
                if (mounted === serial) delete owner.installed[slot];
            }
            const ownerAssembly = assemblyFor(stable, owner);
            owner.graph = graphFromStations(ownerAssembly, BY_ID);
        }
    }
    activeRig.installed = { ...machine.assembly.installed };
    activeRig.equipment = normalizeEquipment(machine.assembly.equipment ?? {});
    activeRig.graph = clone(machine.assembly.graph || graphFromStations(machine.assembly, BY_ID));
    activeRig.damage = clone(machine.damage);
    activeRig.playerCondition = clone(machine.playerCondition);
    for (const serial of Object.values(activeRig.installed)) noteMachineService(stable, activeRig, serial);
    validateRigGraph(stable, activeRig);
    return stable;
}

function projectedMachine(stable, rigId, currentMachine) {
    const rig = rigById(stable, rigId);
    const readiness = rigFieldability(stable, rigId);
    if (!rig?.commissioned) throw new Error('Machine is not commissioned');
    if (!readiness.fieldable) throw new Error('Machine is not fieldable');
    const assembly = assemblyFor(stable, rig);
    assembly.name = rig.name;
    let playerCondition = validConditionSnapshot(rig.playerCondition)
        ? clone(rig.playerCondition)
        : createTargetCondition(assembly, true);
    reconcileTargetCondition(playerCondition, assembly);
    const damage = object(rig.damage) ? clone(rig.damage) : createFunctionalDamage();
    return {
        assembly,
        damage,
        playerCondition,
        economy: currentMachine.economy,
        progression: currentMachine.progression,
    };
}

export function storeStable(storage, stable) {
    if (!storage) return false;
    try { storage.setItem(STABLE_STORAGE_KEY, encodeStable(stable)); return true; }
    catch { return false; }
}

export function loadStable(storage, now = new Date().toISOString()) {
    const machine = loadMachine(storage);
    if (!storage) return { stable: createStableFromMachine(machine, now), status: 'unavailable', machine };
    try {
        const decoded = decodeStable(storage.getItem(STABLE_STORAGE_KEY), machine, now);
        syncActiveMachineIntoStable(decoded.stable, machine);
        storeStable(storage, decoded.stable);
        return { ...decoded, machine };
    } catch {
        const stable = createStableFromMachine(machine, now);
        storeStable(storage, stable);
        return { stable, status: 'recovered', machine };
    }
}

export function activateRig(storage, stable, rigId) {
    if (!storage) return { ok: false, reason: 'LOCAL SAVE UNAVAILABLE' };
    try {
        const currentMachine = loadMachine(storage);
        syncActiveMachineIntoStable(stable, currentMachine);
        const target = projectedMachine(stable, rigId, currentMachine);
        const previousActive = stable.activeRigId;
        stable.activeRigId = rigId;
        if (!storeMachine(storage, target)) {
            stable.activeRigId = previousActive;
            return { ok: false, reason: 'MACHINE SAVE WRITE FAILED' };
        }
        if (!storeStable(storage, stable)) {
            stable.activeRigId = previousActive;
            storeMachine(storage, currentMachine);
            return { ok: false, reason: 'STABLE SAVE WRITE FAILED' };
        }
        return { ok: true, rig: rigById(stable, rigId) };
    } catch (error) {
        return { ok: false, reason: error?.message || 'RIG SWITCH FAILED' };
    }
}

export function recordActiveDeployment(stable, victory) {
    const rig = rigById(stable, stable.activeRigId);
    if (!rig?.commissioned) return null;
    rig.career.deployments += 1;
    if (victory) {
        rig.career.roundWins += 1;
        rig.career.contractWins += 1;
    } else {
        rig.career.roundLosses += 1;
    }
    for (const serial of Object.values(rig.installed)) {
        const part = stable.inventory.find(item => item.serial === serial);
        if (part) ensurePartHistory(stable, part).deployments += 1;
    }
    return rig.career;
}

export function registerAcquiredPart(stable, serial, source = 'salvage') {
    const part = stable.inventory.find(item => item.serial === serial);
    if (!part) return false;
    const history = ensurePartHistory(stable, part, source);
    if (history.acquisitionSource === 'owned') history.acquisitionSource = source;
    return true;
}


/** k.4d: paint is owned by serial, not by rig or palette selection.
 * The live v8 machine owns the authoritative inventory and is mirrored into
 * the three-bay stable by loadStable. Always save it FIRST or bay switching
 * will silently restore the previous finish from the live machine.
 */
export function repaintSerializedParts(storage, edits) {
    if (!storage) return {ok:false,reason:'LOCAL SAVE UNAVAILABLE'};
    if (!Array.isArray(edits) || !edits.length || edits.length>5)
        return {ok:false,reason:'NO PAINT TARGETS'};
    const machine=loadMachine(storage);
    const owned=new Map(machine.assembly.owned.map(part=>[part.serial,part]));
    const seen=new Set();
    for (const item of edits) {
        if (!item || typeof item.serial!=='string' || seen.has(item.serial) ||
            !owned.has(item.serial) || (item.paint!==null && !validPaint(item.paint)))
            return {ok:false,reason:'INVALID SERIAL OR PAINT'};
        seen.add(item.serial);
    }
    for (const {serial,paint} of edits) {
        if (paint===null) delete owned.get(serial).paint;
        else owned.get(serial).paint=normalizePaint(paint);
    }
    if (!storeMachine(storage,machine))
        return {ok:false,reason:'COULD NOT SAVE PAINT'};
    // Update stable immediately as well. Inactive rigs share this serial inventory.
    loadStable(storage);
    return {ok:true,count:edits.length};
}

export function clearStable(storage) {
    if (!storage) return false;
    try { storage.removeItem(STABLE_STORAGE_KEY); return true; }
    catch { return false; }
}
