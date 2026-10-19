/** k.3v.3 — geometry-backed shielding evidence.
 * The scene's raycaster supplies actual ordered Three.js mesh intersections.
 * This module does not alter damage, assign resistance, or create colliders.
 * A frame shields a component only when one physical frame hit precedes
 * an actual deeper intersection with that component on the same shot ray.
 */
export function shieldedModuleOnRay(intersections, first = intersections?.[0] ?? null) {
    if (!first || first.object?.userData?.slot !== 'structure') return null;
    const actorId = first.object.userData.actorId;
    if (!actorId) return null;
    const minDistance = first.distance + .02; // surface thickness / overlapping seams
    for (const hit of intersections) {
        if (hit.distance <= minDistance) continue;
        if (hit.object?.userData?.actorId !== actorId) continue;
        const slot = hit.object?.userData?.slot;
        if (slot && slot !== 'structure') return slot;
    }
    return null;
}

export function shieldImpactLabel(contact) {
    if (contact?.slot !== 'structure' || !contact?.shieldedSlot) return null;
    const labels = { command: 'CAB', combat: 'WEAPON', mobility: 'DRIVE', power: 'GENERATOR' };
    return labels[contact.shieldedSlot]
        ? `FRAME SHIELDED ${labels[contact.shieldedSlot]}` : null;
}
