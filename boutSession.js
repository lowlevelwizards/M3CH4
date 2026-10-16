/** Small in-memory bridge between combat orchestration and the post-bout garage UI.
 * No persistence authority lives here; it only publishes the authoritative result
 * produced from the live six-actor fight.
 */
let latest = null;
const listeners = new Set();

export function publishBoutResult(result) {
    latest = result ?? null;
    for (const listener of listeners) listener(latest);
}

export function latestBoutResult() {
    return latest;
}

export function subscribeBoutResult(listener) {
    if (typeof listener !== 'function') return () => {};
    listeners.add(listener);
    if (latest) listener(latest);
    return () => listeners.delete(listener);
}

export function clearBoutResult() {
    latest = null;
}
