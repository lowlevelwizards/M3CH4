/** k.3l.4 — keep the combiner feeling chassis-mounted without letting critical
 * telemetry leave the windshield safe area during free-look. The display follows only
 * part of the camera/chassis separation and saturates before the outer readouts clip.
 * Body-follow still recenters it naturally as lookYaw returns toward zero. */
export const COMBINER_TETHER_FOLLOW = 0.55;
export const COMBINER_TETHER_YAW_LIMIT = 0.16;
export const COMBINER_TETHER_PITCH_LIMIT = 0.10;

const clamp = (value, limit) => Math.max(-limit, Math.min(limit, value));

export function combinerTetherFromLook(lookYaw = 0, lookPitch = 0) {
    const yaw = Number.isFinite(lookYaw) ? -lookYaw * COMBINER_TETHER_FOLLOW : 0;
    const pitch = Number.isFinite(lookPitch) ? -lookPitch * COMBINER_TETHER_FOLLOW : 0;
    return {
        yaw: clamp(yaw, COMBINER_TETHER_YAW_LIMIT),
        pitch: clamp(pitch, COMBINER_TETHER_PITCH_LIMIT),
    };
}
