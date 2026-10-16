const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

/** k.3k.1 — disabled rigs stay meaningful battlefield clutter without becoming hard walls. */
export function wreckCollisionRadius(baseRadius, ageSeconds = 0, cleared = false) {
    const base = Math.max(.35, Number(baseRadius) || .95);
    if (cleared)
        return Math.max(.18, base * .22);
    const settle = clamp((Number(ageSeconds) || 0) / 1.6, 0, 1);
    return base * (0.78 - settle * 0.20);
}

/** Return a small displacement for the wreck, or null if the mover is not actually pushing it.
 * This is intentionally low-energy: a wreck yields under sustained contact rather than skittering. */
export function shoveWreck(mover, wreck, moverRadius, wreckRadius, dt = 1 / 60) {
    if (!mover || !wreck)
        return null;
    const dx = wreck.x - mover.x;
    const dz = wreck.z - mover.z;
    const distance = Math.hypot(dx, dz);
    const contactDistance = Math.max(.2, moverRadius + wreckRadius);
    if (distance >= contactDistance)
        return null;
    const speed = Math.hypot(mover.vx || 0, mover.vz || 0);
    if (speed < .28)
        return null;
    const nx = distance > 1e-5 ? dx / distance : Math.sin(mover.yaw || 0);
    const nz = distance > 1e-5 ? dz / distance : -Math.cos(mover.yaw || 0);
    const overlap = contactDistance - distance;
    const pushSpeed = Math.min(1.15, .28 + speed * .16 + overlap * 1.4);
    const step = Math.min(overlap + .015, pushSpeed * Math.max(0, dt));
    return { dx: nx * step, dz: nz * step, speed: pushSpeed };
}

export function damageWreckIntegrity(current, damage, scale = 150) {
    const value = clamp(Number.isFinite(current) ? current : 1, 0, 1);
    const amount = Math.max(0, Number(damage) || 0) / Math.max(1, scale);
    return clamp(value - amount, 0, 1);
}
