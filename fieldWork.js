/** k.3r.0 — one crude inter-round field action for a persistent stable.
 *
 * A field patch never replaces a serial and never behaves like a full garage repair.
 * It can only revive one disabled-but-intact installed component to a poor 22% state,
 * restores no armor, and commits that exact machine to the next BO3 round.
 */
import { BY_ID, SLOTS } from './components.js';
import { loadMachine, storeMachine } from './persistence.js';
import { loadSeries } from './series.js';
import { loadStable, rigById, rigFieldability, storeStable } from './stable.js';

export const FIELD_WORK_STORAGE_KEY = 'm3ch4-field-work-v1';
export const FIELD_WORK_VERSION = 1;
export const FIELD_PATCH_CONDITION = .22;
const EPSILON = .0015;
const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
const finite = value => Number.isFinite(value);
const cleanId = value => typeof value === 'string' ? value.trim().slice(0, 80) : '';
const cleanSlot = value => SLOTS.includes(value) ? value : null;

function emptyState() {
    return { version: FIELD_WORK_VERSION, seriesId: null, actions: [], patches: {} };
}

function normalizeAction(value) {
    if (!value || typeof value !== 'object') return null;
    const rigId = cleanId(value.rigId);
    const serial = cleanId(value.serial);
    const slot = cleanSlot(value.slot);
    const afterRound = Number.isSafeInteger(value.afterRound) && value.afterRound >= 1 && value.afterRound <= 2
        ? value.afterRound : null;
    if (!rigId || !serial || !slot || afterRound === null) return null;
    return {
        type: 'patch', afterRound, rigId,
        rigName: typeof value.rigName === 'string' ? value.rigName.trim().slice(0, 32) : null,
        serial, slot,
        restoredCondition: FIELD_PATCH_CONDITION,
        at: finite(value.at) ? value.at : Date.now(),
    };
}

function normalizePatch(value, serialKey = null) {
    if (!value || typeof value !== 'object') return null;
    const serial = cleanId(value.serial || serialKey);
    const rigId = cleanId(value.rigId);
    const slot = cleanSlot(value.slot);
    if (!serial || !rigId || !slot) return null;
    return {
        serial, rigId, slot,
        restoredCondition: FIELD_PATCH_CONDITION,
        patchedAt: finite(value.patchedAt) ? value.patchedAt : Date.now(),
    };
}

export function normalizeFieldWorkState(value) {
    if (!value || typeof value !== 'object' || value.version !== FIELD_WORK_VERSION) return emptyState();
    const actions = Array.isArray(value.actions)
        ? value.actions.map(normalizeAction).filter(Boolean).slice(-4)
        : [];
    const patches = {};
    if (value.patches && typeof value.patches === 'object') {
        for (const [serial, raw] of Object.entries(value.patches)) {
            const patch = normalizePatch(raw, serial);
            if (patch) patches[patch.serial] = patch;
        }
    }
    return {
        version: FIELD_WORK_VERSION,
        seriesId: value.seriesId == null ? null : cleanId(value.seriesId) || null,
        actions,
        patches,
    };
}

export function loadFieldWorkState(storage) {
    if (!storage) return emptyState();
    try { return normalizeFieldWorkState(JSON.parse(storage.getItem(FIELD_WORK_STORAGE_KEY) || 'null')); }
    catch { return emptyState(); }
}

export function storeFieldWorkState(storage, state) {
    if (!storage) return false;
    try {
        storage.setItem(FIELD_WORK_STORAGE_KEY, JSON.stringify(normalizeFieldWorkState(state)));
        return true;
    } catch { return false; }
}

export function clearFieldWorkSeries(storage) {
    const state = loadFieldWorkState(storage);
    state.seriesId = null;
    state.actions = [];
    return storeFieldWorkState(storage, state);
}

export function clearFieldWorkAll(storage) {
    if (!storage) return false;
    try { storage.removeItem(FIELD_WORK_STORAGE_KEY); return true; }
    catch { return false; }
}

function installedPartRecord(stable, rig, slot) {
    const serial = rig?.installed?.[slot];
    if (!serial) return null;
    return stable.inventory.find(part => part.serial === serial) ?? null;
}

function snapshotFor(rig, slot, serial) {
    const snapshot = rig?.playerCondition?.parts?.[slot];
    return snapshot?.serial === serial ? snapshot : null;
}

function isDestroyed(part, snapshot) {
    return !!part?.destroyed || !!snapshot?.destroyed;
}

function isDisabled(part, snapshot) {
    const ownedDisabled = !part || !(Number(part.condition) > .001);
    const targetDisabled = snapshot?.maxIntegrity > 0 ? snapshot.integrity <= snapshot.maxIntegrity * .001 : false;
    return ownedDisabled || targetDisabled;
}

function patchStableUnsafe(stable, rigId, slot, now = Date.now(), history = true) {
    const rig = rigById(stable, rigId);
    const part = installedPartRecord(stable, rig, slot);
    if (!rig || !part) return null;
    const serial = part.serial;
    const snapshot = snapshotFor(rig, slot, serial);
    part.condition = FIELD_PATCH_CONDITION;
    part.destroyed = false;
    if (snapshot?.maxIntegrity > 0) {
        snapshot.integrity = snapshot.maxIntegrity * FIELD_PATCH_CONDITION;
        snapshot.destroyed = false;
    }
    if (slot === 'mobility') {
        rig.damage ??= { drives: {} };
        rig.damage.drives ??= {};
        rig.damage.drives[serial] = { left: FIELD_PATCH_CONDITION, right: FIELD_PATCH_CONDITION };
    }
    if (history) {
        rig.career.fieldServices = (Number(rig.career.fieldServices) || 0) + 1;
        const partHistory = stable.partHistory?.[serial];
        if (partHistory) {
            partHistory.timesFieldServiced = (Number(partHistory.timesFieldServiced) || 0) + 1;
            partHistory.lastFieldServiceAt = finite(now) ? now : Date.now();
        }
    }
    return { rig, part, snapshot };
}

function patchMachineUnsafe(machine, slot, serial) {
    if (!machine?.assembly?.installed || machine.assembly.installed[slot] !== serial) return false;
    const part = machine.assembly.owned?.find(item => item.serial === serial);
    const snapshot = machine.playerCondition?.parts?.[slot];
    if (!part || snapshot?.serial !== serial) return false;
    part.condition = FIELD_PATCH_CONDITION;
    part.destroyed = false;
    if (snapshot.maxIntegrity > 0) {
        snapshot.integrity = snapshot.maxIntegrity * FIELD_PATCH_CONDITION;
        snapshot.destroyed = false;
    }
    if (slot === 'mobility') {
        machine.damage ??= { drives: {} };
        machine.damage.drives ??= {};
        machine.damage.drives[serial] = { left: FIELD_PATCH_CONDITION, right: FIELD_PATCH_CONDITION };
    }
    return true;
}

export function fieldPatchEligibility(stable, rigId, slot) {
    const rig = rigById(stable, rigId);
    if (!rig?.commissioned) return { patchable: false, reason: 'MACHINE NOT COMMISSIONED' };
    if (!SLOTS.includes(slot)) return { patchable: false, reason: 'UNKNOWN FIELD STATION' };
    const part = installedPartRecord(stable, rig, slot);
    if (!part) return { patchable: false, reason: 'NO INSTALLED HARDWARE' };
    const snapshot = snapshotFor(rig, slot, part.serial);
    if (isDestroyed(part, snapshot)) {
        return { patchable: false, rigId, slot, serial: part.serial, reason: 'DESTROYED · SHOP REBUILD REQUIRED' };
    }
    if (!isDisabled(part, snapshot)) {
        return { patchable: false, rigId, slot, serial: part.serial, reason: 'NOT DISABLED' };
    }
    const simulated = clone(stable);
    patchStableUnsafe(simulated, rigId, slot, Date.now(), false);
    if (!rigFieldability(simulated, rigId).fieldable) {
        return { patchable: false, rigId, slot, serial: part.serial, reason: 'ONE PATCH WILL NOT RETURN THIS MACHINE TO FIELDABLE' };
    }
    const definition = BY_ID.get(part.definitionId);
    return {
        patchable: true,
        rigId, rigName: rig.name, slot, serial: part.serial,
        definitionId: part.definitionId,
        name: definition?.name || part.definitionId,
        restoredCondition: FIELD_PATCH_CONDITION,
    };
}

export function fieldPatchCandidates(stable) {
    const candidates = [];
    for (const rig of stable?.rigs || []) {
        if (!rig.commissioned) continue;
        for (const slot of SLOTS) {
            const candidate = fieldPatchEligibility(stable, rig.id, slot);
            if (candidate.patchable) candidates.push(candidate);
        }
    }
    return candidates;
}

export function fieldWorkRecoveryPossible(stable) {
    return fieldPatchCandidates(stable).length > 0;
}

export function currentIntermissionFieldAction(storage, series = loadSeries(storage)) {
    if (!series || series.phase !== 'intermission') return null;
    const state = loadFieldWorkState(storage);
    if (state.seriesId !== series.id) return null;
    return state.actions.find(action => action.afterRound === series.rounds.length) ?? null;
}

export function fieldWorkCommitment(storage) {
    const series = loadSeries(storage);
    const action = currentIntermissionFieldAction(storage, series);
    return action ? { ...action, nextRound: series.roundNumber } : null;
}

export function partLifecycle(stable, serial, state = null) {
    const part = stable?.inventory?.find(item => item.serial === serial);
    if (!part) return 'MISSING';
    if (part.destroyed) return 'DESTROYED';
    if (!(part.condition > .001)) return 'DISABLED';
    const patch = (state?.patches || {})[serial];
    if (patch && part.condition <= patch.restoredCondition + EPSILON) return 'PATCHED';
    if (part.condition < .995) return 'DEGRADED';
    return 'FUNCTIONAL';
}

/** Remove only the active patch marker after a proper shop repair or a later disable /
 * destruction. Historical field-service counts stay on the stable/part career data. */
export function reconcileFieldPatches(storage, stable) {
    const state = loadFieldWorkState(storage);
    let changed = false;
    for (const [serial, patch] of Object.entries(state.patches)) {
        const part = stable?.inventory?.find(item => item.serial === serial);
        if (!part || part.destroyed || !(part.condition > .001) || part.condition > patch.restoredCondition + EPSILON) {
            delete state.patches[serial];
            changed = true;
        }
    }
    if (changed) storeFieldWorkState(storage, state);
    return state;
}

/** Transactional coordinator for the one intermission action. The stable owns inactive
 * rigs; if the patched rig is also the live v8 projection, that save is patched too so
 * loadStable cannot immediately overwrite the field work with stale disabled state. */
export function applyEmergencyFieldPatch(storage, { seriesId, rigId, slot, now = Date.now() } = {}) {
    if (!storage) return { ok: false, reason: 'LOCAL SAVE UNAVAILABLE' };
    const series = loadSeries(storage);
    if (!series || series.phase !== 'intermission' || (seriesId && series.id !== seriesId))
        return { ok: false, reason: 'FIELD WORK REQUIRES A LIVE INTERMISSION' };
    if (currentIntermissionFieldAction(storage, series))
        return { ok: false, reason: 'FIELD ACTION ALREADY SPENT THIS INTERMISSION' };

    const loaded = loadStable(storage);
    const stable = loaded.stable;
    const candidate = fieldPatchEligibility(stable, rigId, slot);
    if (!candidate.patchable) return { ok: false, reason: candidate.reason || 'FIELD PATCH REJECTED' };

    const originalStable = clone(stable);
    const originalMachine = clone(loadMachine(storage));
    const originalFieldState = loadFieldWorkState(storage);
    const patched = patchStableUnsafe(stable, rigId, slot, now, true);
    if (!patched) return { ok: false, reason: 'FIELD PATCH TARGET LOST' };

    // The v8 active projection also owns the global serialized inventory copy.
    // Even a patch to a parked rig must update that inventory entry, or the next
    // loadStable() would mirror stale condition into the stable and undo the patch.
    const machine = loadMachine(storage);
    const ownedCopy = machine.assembly.owned?.find(part => part.serial === candidate.serial);
    if (!ownedCopy) return { ok: false, reason: 'PATCH SERIAL MISSING FROM GLOBAL INVENTORY' };
    ownedCopy.condition = FIELD_PATCH_CONDITION;
    ownedCopy.destroyed = false;
    if (stable.activeRigId === rigId && !patchMachineUnsafe(machine, slot, candidate.serial))
        return { ok: false, reason: 'LIVE MACHINE DOES NOT MATCH PATCH TARGET' };
    if (!storeMachine(storage, machine)) return { ok: false, reason: 'MACHINE SAVE WRITE FAILED' };
    const machineChanged = true;
    if (!storeStable(storage, stable)) {
        if (machineChanged) storeMachine(storage, originalMachine);
        return { ok: false, reason: 'STABLE SAVE WRITE FAILED' };
    }

    const state = loadFieldWorkState(storage);
    if (state.seriesId !== series.id) {
        state.seriesId = series.id;
        state.actions = [];
    }
    const action = {
        type: 'patch', afterRound: series.rounds.length,
        rigId, rigName: candidate.rigName, serial: candidate.serial, slot,
        restoredCondition: FIELD_PATCH_CONDITION,
        at: finite(now) ? now : Date.now(),
    };
    state.actions.push(action);
    state.patches[candidate.serial] = {
        serial: candidate.serial, rigId, slot,
        restoredCondition: FIELD_PATCH_CONDITION,
        patchedAt: action.at,
    };
    if (!storeFieldWorkState(storage, state)) {
        storeStable(storage, originalStable);
        if (machineChanged) storeMachine(storage, originalMachine);
        storeFieldWorkState(storage, originalFieldState);
        return { ok: false, reason: 'FIELD WORK SAVE FAILED' };
    }
    return { ok: true, action: clone(action), rig: clone(patched.rig) };
}
