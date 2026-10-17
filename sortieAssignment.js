/** k.3q.1 — session-scoped contract + machine assignment.
 *
 * A staged assignment is intentionally separate from both the persistent stable and
 * the currently loaded contract. Nothing physical changes until DEPLOY commits it.
 */
export const SORTIE_ASSIGNMENT_KEY = 'm3ch4-sortie-assignment-v1';
export const SORTIE_ASSIGNMENT_VERSION = 1;
const PHASES = new Set(['pending', 'launching', 'deployed']);

const cleanId = value => typeof value === 'string' ? value.trim().slice(0, 80) : '';
const cleanName = value => typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, 32) : '';
const finite = value => Number.isFinite(value);

export function createSortieAssignment(contractId, now = Date.now(), id = null) {
    const contract = cleanId(contractId);
    if (!contract) throw new Error('Contract assignment requires a contract id');
    const stamp = finite(now) ? now : Date.now();
    return {
        version: SORTIE_ASSIGNMENT_VERSION,
        id: cleanId(id) || `sortie-${stamp}`,
        contractId: contract,
        rigId: null,
        rigName: null,
        phase: 'pending',
        createdAt: stamp,
        launchedAt: null,
    };
}

export function normalizeSortieAssignment(value) {
    if (!value || typeof value !== 'object' || value.version !== SORTIE_ASSIGNMENT_VERSION)
        throw new Error('Unknown sortie assignment format');
    const id = cleanId(value.id);
    const contractId = cleanId(value.contractId);
    const rigId = value.rigId == null ? null : cleanId(value.rigId);
    const rigName = value.rigName == null ? null : cleanName(value.rigName);
    const phase = PHASES.has(value.phase) ? value.phase : null;
    if (!id || !contractId || !phase || !finite(value.createdAt) ||
        (rigId !== null && !rigId) || (phase !== 'pending' && !rigId))
        throw new Error('Invalid sortie assignment');
    return {
        version: SORTIE_ASSIGNMENT_VERSION,
        id, contractId, rigId, rigName, phase,
        createdAt: value.createdAt,
        launchedAt: finite(value.launchedAt) ? value.launchedAt : null,
    };
}

export function encodeSortieAssignment(assignment) {
    return JSON.stringify(normalizeSortieAssignment(assignment));
}

export function decodeSortieAssignment(json) {
    if (!json) return null;
    try { return normalizeSortieAssignment(JSON.parse(json)); }
    catch { return null; }
}

export function loadSortieAssignment(storage) {
    if (!storage) return null;
    try { return decodeSortieAssignment(storage.getItem(SORTIE_ASSIGNMENT_KEY)); }
    catch { return null; }
}

export function storeSortieAssignment(storage, assignment) {
    if (!storage) return false;
    try {
        storage.setItem(SORTIE_ASSIGNMENT_KEY, encodeSortieAssignment(assignment));
        return true;
    } catch { return false; }
}

export function beginSortieAssignment(storage, contractId, now = Date.now()) {
    const current = loadSortieAssignment(storage);
    const next = current?.phase === 'pending'
        ? { ...current, contractId: cleanId(contractId), rigId: current.contractId === contractId ? current.rigId : null,
            rigName: current.contractId === contractId ? current.rigName : null }
        : createSortieAssignment(contractId, now);
    if (!next.contractId) return { ok: false, reason: 'UNKNOWN CONTRACT', assignment: current };
    return storeSortieAssignment(storage, next)
        ? { ok: true, assignment: normalizeSortieAssignment(next) }
        : { ok: false, reason: 'SORTIE ASSIGNMENT STORAGE UNAVAILABLE', assignment: current };
}

export function assignRigToSortie(storage, rigId, rigName = null) {
    const current = loadSortieAssignment(storage);
    const id = cleanId(rigId);
    if (!current || current.phase !== 'pending') return { ok: false, reason: 'NO PENDING SORTIE' };
    if (!id) return { ok: false, reason: 'MACHINE REQUIRED' };
    const next = { ...current, rigId: id, rigName: cleanName(rigName) || null };
    return storeSortieAssignment(storage, next)
        ? { ok: true, assignment: normalizeSortieAssignment(next) }
        : { ok: false, reason: 'SORTIE ASSIGNMENT STORAGE UNAVAILABLE' };
}

export function markSortieLaunching(storage, rigName = null, now = Date.now()) {
    const current = loadSortieAssignment(storage);
    if (!current?.rigId || current.phase !== 'pending') return { ok: false, reason: 'SORTIE NOT READY' };
    const next = {
        ...current,
        rigName: cleanName(rigName) || current.rigName,
        phase: 'launching',
        launchedAt: finite(now) ? now : Date.now(),
    };
    return storeSortieAssignment(storage, next)
        ? { ok: true, assignment: normalizeSortieAssignment(next) }
        : { ok: false, reason: 'SORTIE ASSIGNMENT STORAGE UNAVAILABLE' };
}

export function markSortieDeployed(storage) {
    const current = loadSortieAssignment(storage);
    if (!current?.rigId || !['launching', 'deployed'].includes(current.phase))
        return { ok: false, reason: 'SORTIE NOT COMMITTED' };
    const next = { ...current, phase: 'deployed' };
    return storeSortieAssignment(storage, next)
        ? { ok: true, assignment: normalizeSortieAssignment(next) }
        : { ok: false, reason: 'SORTIE ASSIGNMENT STORAGE UNAVAILABLE' };
}

export function cancelSortieAssignment(storage) {
    const current = loadSortieAssignment(storage);
    if (!current) return { ok: true, assignment: null };
    if (current.phase !== 'pending') return { ok: false, reason: 'SORTIE ALREADY COMMITTED', assignment: current };
    try {
        storage?.removeItem(SORTIE_ASSIGNMENT_KEY);
        return { ok: true, assignment: null };
    } catch { return { ok: false, reason: 'SORTIE ASSIGNMENT STORAGE UNAVAILABLE', assignment: current }; }
}

export function clearSortieAssignment(storage) {
    if (!storage) return false;
    try { storage.removeItem(SORTIE_ASSIGNMENT_KEY); return true; }
    catch { return false; }
}

export function assignmentReady(assignment) {
    return !!assignment && assignment.phase === 'pending' && !!assignment.contractId && !!assignment.rigId;
}
