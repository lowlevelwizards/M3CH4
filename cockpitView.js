/** k.3l.5 — soft cockpit deadband + safe-area tether.
 * Small pilot head movements keep the combiner visually settled. Outside that central
 * deadband the chassis-mounted displays move more assertively than k.3l.4, restoring
 * physical cockpit parallax, then saturate before critical telemetry can leave view. */
export const COMBINER_TETHER_FOLLOW = 0.78;
export const COMBINER_TETHER_YAW_DEADZONE = 0.075;
export const COMBINER_TETHER_PITCH_DEADZONE = 0.050;
export const COMBINER_TETHER_YAW_LIMIT = 0.16;
export const COMBINER_TETHER_PITCH_LIMIT = 0.10;

const clamp = (value, limit) => Math.max(-limit, Math.min(limit, value));
const outsideDeadzone = (value, deadzone) => {
    if (!Number.isFinite(value)) return 0;
    const magnitude = Math.max(0, Math.abs(value) - deadzone);
    return Math.sign(value) * magnitude;
};

export function combinerTetherFromLook(lookYaw = 0, lookPitch = 0) {
    const yaw = -outsideDeadzone(lookYaw, COMBINER_TETHER_YAW_DEADZONE) * COMBINER_TETHER_FOLLOW;
    const pitch = -outsideDeadzone(lookPitch, COMBINER_TETHER_PITCH_DEADZONE) * COMBINER_TETHER_FOLLOW;
    return {
        yaw: clamp(yaw, COMBINER_TETHER_YAW_LIMIT),
        pitch: clamp(pitch, COMBINER_TETHER_PITCH_LIMIT),
    };
}
