/** k.3k.4 — keep the combiner tied to the mech while the pilot free-looks.
 * The camera receives look yaw/pitch immediately. The combiner is camera-local, so
 * applying the inverse look angles makes it remain aligned with the chassis/window.
 * As body-follow rotates the mech and controls.compensateBodyTurn() reduces lookYaw,
 * the display naturally recenters without any second steering system. */
export function combinerTetherFromLook(lookYaw = 0, lookPitch = 0) {
    const yaw = Number.isFinite(lookYaw) ? -lookYaw : 0;
    const pitch = Number.isFinite(lookPitch) ? -lookPitch : 0;
    return { yaw, pitch };
}
