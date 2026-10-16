/** k.3l.0 — physical component fate beyond ordinary integrity loss.
 *
 * Integrity reaching zero means DISABLED: the hardware still physically exists and
 * can be repaired or salvaged. Further effective damage accumulates destruction
 * reserve; crossing that threshold makes the component DESTROYED / rebuild-only.
 * This module contains no rendering, scoring, ownership or persistence policy.
 */
export const DESTRUCTION_THRESHOLD_RATIO = 0.30;

const finite = value => Number.isFinite(Number(value)) ? Number(value) : 0;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export function destructionThreshold(part) {
    return Math.max(1, finite(part?.maxIntegrity)) * DESTRUCTION_THRESHOLD_RATIO;
}

export function resetDamageFate(part) {
    if (!part) return part;
    part.destruction = 0;
    part.destroyed = false;
    return part;
}

export function hydrateDamageFate(part, { destruction = 0, destroyed = false } = {}) {
    if (!part) return part;
    const threshold = destructionThreshold(part);
    part.destroyed = !!destroyed;
    part.destruction = part.destroyed
        ? threshold
        : clamp(finite(destruction), 0, threshold);
    return part;
}

/** Apply only damage left over after armor and remaining integrity have absorbed a
 * hit. Disabled hardware therefore needs deliberate additional punishment, while a
 * huge disabling blow can also contribute its true overkill on that same impact. */
export function applyDestructionOverflow(part, overflowDamage) {
    if (!part)
        return { destroyed: false, justDestroyed: false, destruction: 0, threshold: 0, progress: 0 };
    if (!Number.isFinite(part.destruction)) part.destruction = 0;
    if (typeof part.destroyed !== 'boolean') part.destroyed = false;
    const threshold = destructionThreshold(part);
    if (part.destroyed)
        return { destroyed: true, justDestroyed: false, destruction: threshold, threshold, progress: 1 };
    const overflow = Math.max(0, finite(overflowDamage));
    if (part.integrity <= 0 && overflow > 0)
        part.destruction = clamp(part.destruction + overflow, 0, threshold);
    const justDestroyed = part.integrity <= 0 && part.destruction >= threshold;
    if (justDestroyed) part.destroyed = true;
    return {
        destroyed: part.destroyed,
        justDestroyed,
        destruction: part.destruction,
        threshold,
        progress: clamp(part.destruction / threshold, 0, 1),
    };
}

export function partFate(part) {
    if (!part) return 'missing';
    if (part.destroyed) return 'destroyed';
    if (finite(part.integrity) <= 0) return 'disabled';
    const ratio = finite(part.integrity) / Math.max(1, finite(part.maxIntegrity));
    if (ratio < .32) return 'critical';
    if (ratio < .72) return 'damaged';
    return 'operational';
}
