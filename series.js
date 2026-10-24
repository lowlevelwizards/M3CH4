/** k.3q.2 — persistent best-of-three contract series authority.
 *
 * This module owns match lifecycle only. It references stable rig ids but never loads
 * or mutates physical machine state; callers provide whether a fieldable machine still
 * exists after a round. That keeps BO3 state independent of the machine save graph.
 */
export const SERIES_STORAGE_KEY = 'm3ch4-series-v1';
export const SERIES_VERSION = 1;
export const SERIES_FORMAT = 'bo3';
export const WINS_REQUIRED = 2;
const PHASES = new Set(['round_active', 'intermission', 'complete']);
const MAX_ROUNDS = 3;

const cleanId = value => typeof value === 'string' ? value.trim().slice(0, 80) : '';
const cleanName = value => typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').slice(0, 32) : '';
const finite = value => Number.isFinite(value);
const nonNegativeInteger = value => Number.isSafeInteger(value) && value >= 0 ? value : 0;
const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));

export function createSeries(contractId, rigId, rigName = null, assignmentId = null, now = Date.now(), id = null) {
    const contract = cleanId(contractId);
    const rig = cleanId(rigId);
    if (!contract || !rig) throw new Error('BO3 series requires a contract and opening machine');
    const stamp = finite(now) ? now : Date.now();
    return {
        version: SERIES_VERSION,
        id: cleanId(id) || `series-${stamp}`,
        contractId: contract,
        format: SERIES_FORMAT,
        winsRequired: WINS_REQUIRED,
        phase: 'round_active',
        roundNumber: 1,
        playerWins: 0,
        enemyWins: 0,
        currentRigId: rig,
        currentRigName: cleanName(rigName) || null,
        currentAssignmentId: cleanId(assignmentId) || null,
        participatingRigIds: [rig],
        rounds: [],
        totalRoundsFired: 0,
        totalAmmoCostCents: 0,
        finalVictory: null,
        completionReason: null,
        startedAt: stamp,
        completedAt: null,
    };
}

export function normalizeSeries(value) {
    if (!value || typeof value !== 'object' || value.version !== SERIES_VERSION ||
        value.format !== SERIES_FORMAT || value.winsRequired !== WINS_REQUIRED || !PHASES.has(value.phase))
        throw new Error('Unknown BO3 series format');
    const id = cleanId(value.id);
    const contractId = cleanId(value.contractId);
    if (!id || !contractId) throw new Error('Invalid BO3 series identity');
    const rounds = Array.isArray(value.rounds) ? value.rounds.slice(0, MAX_ROUNDS).map((round, index) => {
        const rigId = cleanId(round?.rigId);
        if (!rigId || typeof round?.victory !== 'boolean') throw new Error('Invalid BO3 round');
        const roundsFired = round.roundsFired == null ? null : nonNegativeInteger(round.roundsFired);
        const ammoCostCents = round.ammoCostCents == null ? null : nonNegativeInteger(round.ammoCostCents);
        return {
            round: index + 1,
            rigId,
            rigName: cleanName(round.rigName) || null,
            assignmentId: cleanId(round.assignmentId) || null,
            victory: round.victory,
            reason: typeof round.reason === 'string' ? round.reason.slice(0, 160) : '',
            roundsFired,
            ammoCostCents,
        };
    }) : [];
    const playerWins = rounds.filter(round => round.victory).length;
    const enemyWins = rounds.length - playerWins;
    const participatingRigIds = [...new Set(rounds.map(round => round.rigId))];
    const currentRigId = value.currentRigId == null ? null : cleanId(value.currentRigId);
    const currentRigName = value.currentRigName == null ? null : cleanName(value.currentRigName);
    const currentAssignmentId = value.currentAssignmentId == null ? null : cleanId(value.currentAssignmentId);
    const finalVictory = value.finalVictory == null ? null : !!value.finalVictory;
    if (value.phase === 'round_active' && !currentRigId) throw new Error('Active BO3 round requires a machine');
    if (value.phase === 'complete' && finalVictory === null) throw new Error('Completed BO3 series requires a result');
    if (rounds.length > MAX_ROUNDS || playerWins > WINS_REQUIRED || enemyWins > WINS_REQUIRED)
        throw new Error('Invalid BO3 score');
    const totalRoundsFired = rounds.reduce((sum, round) => sum + (round.roundsFired ?? 0), 0);
    // Old in-progress saves have no per-weapon price; retain the former ₡1
    // price for those specific completed rounds during migration.
    const totalAmmoCostCents = rounds.reduce((sum, round) =>
        sum + (round.ammoCostCents ?? ((round.roundsFired ?? 0) * 100)), 0);
    return {
        version: SERIES_VERSION,
        id,
        contractId,
        format: SERIES_FORMAT,
        winsRequired: WINS_REQUIRED,
        phase: value.phase,
        roundNumber: Math.max(1, Math.min(MAX_ROUNDS, nonNegativeInteger(value.roundNumber) || rounds.length + 1)),
        playerWins,
        enemyWins,
        currentRigId,
        currentRigName,
        currentAssignmentId,
        participatingRigIds: value.phase === 'round_active' && currentRigId
            ? [...new Set([...participatingRigIds, currentRigId])]
            : participatingRigIds,
        rounds,
        totalRoundsFired,
        totalAmmoCostCents,
        finalVictory,
        completionReason: value.completionReason == null ? null : String(value.completionReason).slice(0, 80),
        startedAt: finite(value.startedAt) ? value.startedAt : Date.now(),
        completedAt: finite(value.completedAt) ? value.completedAt : null,
    };
}

export function encodeSeries(series) {
    return JSON.stringify(normalizeSeries(series));
}

export function decodeSeries(json) {
    if (!json) return null;
    try { return normalizeSeries(JSON.parse(json)); }
    catch { return null; }
}

export function loadSeries(storage) {
    if (!storage) return null;
    try { return decodeSeries(storage.getItem(SERIES_STORAGE_KEY)); }
    catch { return null; }
}

export function storeSeries(storage, series) {
    if (!storage) return false;
    try { storage.setItem(SERIES_STORAGE_KEY, encodeSeries(series)); return true; }
    catch { return false; }
}

export function clearSeries(storage) {
    if (!storage) return false;
    try { storage.removeItem(SERIES_STORAGE_KEY); return true; }
    catch { return false; }
}

export function startSeries(storage, contractId, rigId, rigName = null, assignmentId = null, now = Date.now()) {
    const next = createSeries(contractId, rigId, rigName, assignmentId, now);
    return storeSeries(storage, next)
        ? { ok: true, series: normalizeSeries(next) }
        : { ok: false, reason: 'BO3 SERIES STORAGE UNAVAILABLE' };
}

export function beginSeriesRound(storage, rigId, rigName = null, assignmentId = null) {
    const current = loadSeries(storage);
    const rig = cleanId(rigId);
    if (!current || current.phase !== 'intermission') return { ok: false, reason: 'SERIES IS NOT WAITING FOR A MACHINE' };
    if (!rig) return { ok: false, reason: 'MACHINE REQUIRED' };
    const next = {
        ...current,
        phase: 'round_active',
        roundNumber: current.rounds.length + 1,
        currentRigId: rig,
        currentRigName: cleanName(rigName) || null,
        currentAssignmentId: cleanId(assignmentId) || null,
        participatingRigIds: [...new Set([...current.participatingRigIds, rig])],
    };
    return storeSeries(storage, next)
        ? { ok: true, series: normalizeSeries(next) }
        : { ok: false, reason: 'BO3 SERIES STORAGE UNAVAILABLE' };
}

/** Record one physical fight. Machine fieldability is supplied by the orchestration
 * boundary after it has read the authoritative post-hit machine/stable state. */
export function recordSeriesRound(storage, result, options = {}) {
    const current = loadSeries(storage);
    if (!current || current.phase !== 'round_active') return { ok: false, reason: 'NO ACTIVE BO3 ROUND' };
    if (current.rounds.length >= MAX_ROUNDS) return { ok: false, reason: 'BO3 SERIES ALREADY EXHAUSTED' };
    const victory = !!result?.victory;
    const round = {
        round: current.rounds.length + 1,
        rigId: current.currentRigId,
        rigName: current.currentRigName,
        assignmentId: current.currentAssignmentId,
        victory,
        reason: typeof result?.reason === 'string' ? result.reason.slice(0, 160) : '',
        roundsFired: null,
        ammoCostCents: null,
    };
    const rounds = [...current.rounds, round];
    const playerWins = rounds.filter(item => item.victory).length;
    const enemyWins = rounds.length - playerWins;
    let phase = 'intermission';
    let finalVictory = null;
    let completionReason = null;
    if (playerWins >= WINS_REQUIRED || enemyWins >= WINS_REQUIRED) {
        phase = 'complete';
        finalVictory = playerWins >= WINS_REQUIRED;
        completionReason = 'score';
    } else if (options.hasFieldableMachine === false) {
        phase = 'complete';
        finalVictory = false;
        completionReason = 'no-fieldable-machines';
    }
    const next = {
        ...current,
        phase,
        roundNumber: Math.min(MAX_ROUNDS, rounds.length + (phase === 'complete' ? 0 : 1)),
        playerWins,
        enemyWins,
        currentRigId: null,
        currentRigName: null,
        currentAssignmentId: null,
        participatingRigIds: [...new Set([...current.participatingRigIds, round.rigId])],
        rounds,
        finalVictory,
        completionReason,
        completedAt: phase === 'complete' ? (finite(options.now) ? options.now : Date.now()) : null,
    };
    if (!storeSeries(storage, next)) return { ok: false, reason: 'BO3 SERIES STORAGE UNAVAILABLE' };
    return { ok: true, series: normalizeSeries(next), round: clone(round), terminal: phase === 'complete' };
}

/** Called by economy settlement immediately after recordSeriesRound. It attaches the
 * current round's ammunition exactly once, then exposes either a deferred or terminal
 * contract settlement directive. */
export function noteSeriesRoundAmmo(storage, roundsFired, ammoCostCents = null) {
    const current = loadSeries(storage);
    if (!current || current.rounds.length === 0) return null;
    const rounds = current.rounds.map(round => ({ ...round }));
    const latest = rounds[rounds.length - 1];
    // A completed round's ammunition invoice is immutable. Replayed settlement
    // hooks cannot overwrite counts, prices, or charge the same rounds again.
    if (latest.roundsFired == null) {
        latest.roundsFired = nonNegativeInteger(roundsFired);
        latest.ammoCostCents = ammoCostCents == null ? null : nonNegativeInteger(ammoCostCents);
    }
    const next = { ...current, rounds };
    if (!storeSeries(storage, next)) return current;
    return loadSeries(storage);
}

export function seriesSettlementDirective(storage, currentRoundsFired = 0, currentAmmoCostCents = null) {
    const series = noteSeriesRoundAmmo(storage, currentRoundsFired, currentAmmoCostCents);
    if (!series) return null;
    return {
        terminal: series.phase === 'complete',
        victory: series.phase === 'complete' ? !!series.finalVictory : null,
        roundsFired: series.totalRoundsFired,
        ammoCostCents: series.totalAmmoCostCents,
        series,
    };
}

export function seriesScore(series) {
    const normalized = series ? normalizeSeries(series) : null;
    return normalized ? `${normalized.playerWins}–${normalized.enemyWins}` : '0–0';
}
