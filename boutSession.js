/** In-memory bridge between live combat and garage/debrief consumers.
 *
 * k.3q.2 distinguishes a physical ROUND from a terminal CONTRACT result. Existing
 * bout subscribers intentionally fire only once the BO3 is over, so campaign,
 * salvage and progression keep their old contract-level semantics.
 */
import { loadSeries, recordSeriesRound } from './series.js';

let latest = null;
let latestRound = null;
const listeners = new Set();
const roundListeners = new Set();

function localStorageRef() {
    try { return globalThis.localStorage ?? null; }
    catch { return null; }
}

function publishRound(result) {
    latestRound = result ?? null;
    for (const listener of roundListeners) listener(latestRound);
}

export function publishBoutResult(result) {
    let terminalResult = result ?? null;
    const storage = localStorageRef();
    const activeSeries = loadSeries(storage);
    if (terminalResult && activeSeries?.phase === 'round_active') {
        const resolution = recordSeriesRound(storage, terminalResult);
        if (resolution.ok) {
            const roundResult = {
                ...terminalResult,
                roundVictory: !!terminalResult.victory,
                round: resolution.round,
                series: resolution.series,
                terminal: resolution.terminal,
            };
            publishRound(roundResult);
            if (!resolution.terminal) return roundResult;

            const overallVictory = !!resolution.series.finalVictory;
            const exhaustion = resolution.series.completionReason === 'no-fieldable-machines';
            terminalResult = {
                ...terminalResult,
                roundVictory: !!terminalResult.victory,
                victory: overallVictory,
                reason: exhaustion ? 'NO FIELDABLE MACHINES · STABLE UNABLE TO CONTINUE' : terminalResult.reason,
                round: resolution.round,
                series: resolution.series,
                terminal: true,
                wrecks: overallVictory ? terminalResult.wrecks : [],
                draft: overallVictory ? terminalResult.draft : null,
                wreckPreservation: overallVictory ? terminalResult.wreckPreservation : 0,
            };
        }
    }
    latest = terminalResult;
    for (const listener of listeners) listener(latest);
    return terminalResult;
}

export function latestBoutResult() {
    return latest;
}

export function latestRoundResult() {
    return latestRound;
}

export function subscribeBoutResult(listener) {
    if (typeof listener !== 'function') return () => {};
    listeners.add(listener);
    if (latest) listener(latest);
    return () => listeners.delete(listener);
}

export function subscribeRoundResult(listener) {
    if (typeof listener !== 'function') return () => {};
    roundListeners.add(listener);
    if (latestRound) listener(latestRound);
    return () => roundListeners.delete(listener);
}

export function clearBoutResult() {
    latest = null;
    latestRound = null;
}
