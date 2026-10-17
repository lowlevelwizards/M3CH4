/** k.3j.0: one desperate, physical emergency restart for a disabled weapon.
 *
 * This module owns no UI, audio, inventory, economy or assembly rules. It only
 * classifies the localized combat component, arrests the first catastrophic
 * weapon failure into a recoverable fault, and advances a stationary hold-to-
 * service interaction. The recovered gun is intentionally barely functional.
 */
export const WEAPON_FAULT_THRESHOLD = 0.12;
export const WEAPON_FAULT_FLOOR = 0.08;
export const FIELD_SERVICE_RECOVERY_RATIO = 0.20;
export const FIELD_SERVICE_SECONDS = 4.0;
export const FIELD_SERVICE_MAX_SPEED_MPS = 0.35;
export const FIELD_SERVICE_MAX_YAW_RATE_RAD = 0.12;

const clamp01 = value => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));

export function weaponIntegrityRatio(condition) {
    const part = condition?.parts?.combat;
    if (!part || !Number.isFinite(part.maxIntegrity) || part.maxIntegrity <= 0)
        return 0;
    return clamp01(part.integrity / part.maxIntegrity);
}

export function createFieldServiceState() {
    return {
        used: false,
        held: false,
        progress: 0,
        faultLatched: false,
    };
}

export function weaponFailureState(condition, service) {
    const part = condition?.parts?.combat;
    const ratio = weaponIntegrityRatio(condition);
    if (part?.destroyed)
        return 'destroyed';
    // A latched emergency fault can remain physically intact at zero functional
    // integrity. That is DISABLED hardware, not destroyed hardware.
    if (ratio <= 0 && !service?.faultLatched)
        return 'destroyed';
    if (ratio <= WEAPON_FAULT_THRESHOLD)
        return service?.used ? 'unrecoverable' : 'faulted';
    if (ratio < 0.95)
        return 'damaged';
    return 'ready';
}

/** The first hit that would take an operational weapon through the shutdown
 * threshold trips an emergency isolation path instead of immediately deleting the
 * component. A second disabling hit, or any post-service disabling hit, is final. */
export function arrestFirstWeaponFailure(condition, service, beforeIntegrity) {
    const part = condition?.parts?.combat;
    if (!part || !service || service.used || service.faultLatched)
        return false;
    const beforeRatio = clamp01(beforeIntegrity / Math.max(1, part.maxIntegrity));
    const afterRatio = weaponIntegrityRatio(condition);
    if (beforeRatio <= WEAPON_FAULT_THRESHOLD || afterRatio > WEAPON_FAULT_THRESHOLD)
        return false;
    if (afterRatio <= 0)
        part.integrity = part.maxIntegrity * WEAPON_FAULT_FLOOR;
    service.faultLatched = true;
    service.held = false;
    service.progress = 0;
    return true;
}

export function canFieldService(condition, service) {
    const part = condition?.parts?.combat;
    const ratio = weaponIntegrityRatio(condition);
    return !!service && !service.used && !part?.destroyed &&
        ratio <= WEAPON_FAULT_THRESHOLD && (ratio > 0 || service.faultLatched);
}

export function fieldServiceStationary(rig) {
    const speed = Math.hypot(Number(rig?.vx) || 0, Number(rig?.vz) || 0);
    const yawRate = Math.abs(Number(rig?.yawRate) || 0);
    return speed <= FIELD_SERVICE_MAX_SPEED_MPS && yawRate <= FIELD_SERVICE_MAX_YAW_RATE_RAD;
}

export function beginFieldService(condition, service, rig) {
    if (!canFieldService(condition, service) || !fieldServiceStationary(rig))
        return false;
    service.held = true;
    return true;
}

export function cancelFieldService(service) {
    if (!service)
        return;
    service.held = false;
    service.progress = 0;
}

/** Advance one fixed simulation step. Moving, turning, releasing the control or
 * taking a hit resets progress: this is an exposed emergency procedure, not a
 * passive cooldown. Completion mutates only localized combat integrity; gameplay
 * synchronizes the physical owned component record immediately afterward. */
export function advanceFieldService(condition, service, rig, dt) {
    if (!service?.held || !Number.isFinite(dt) || dt <= 0)
        return { event: null, progress: service?.progress ?? 0 };
    if (!canFieldService(condition, service)) {
        cancelFieldService(service);
        return { event: 'unavailable', progress: 0 };
    }
    if (!fieldServiceStationary(rig)) {
        cancelFieldService(service);
        return { event: 'interrupted', progress: 0 };
    }
    service.progress = Math.min(FIELD_SERVICE_SECONDS, service.progress + dt);
    if (service.progress < FIELD_SERVICE_SECONDS)
        return { event: 'progress', progress: service.progress };

    const part = condition.parts.combat;
    part.integrity = Math.max(part.integrity, part.maxIntegrity * FIELD_SERVICE_RECOVERY_RATIO);
    service.used = true;
    service.held = false;
    service.progress = 0;
    return { event: 'completed', progress: FIELD_SERVICE_SECONDS, ratio: weaponIntegrityRatio(condition) };
}

/** A recoverable first fault keeps the sortie alive. Zero functional integrity is
 * still recoverable while the latched bypass remains unused and the physical weapon
 * has not crossed its destruction reserve. Once the bypass is spent—or the hardware
 * is actually destroyed—the weapon can legitimately mission-kill the rig. */
export function weaponMissionKillReason(condition, service) {
    const part = condition?.parts?.combat;
    const ratio = weaponIntegrityRatio(condition);
    if (part?.destroyed)
        return 'WEAPON DESTROYED';
    if (ratio <= 0 && !service?.faultLatched)
        return 'WEAPON DESTROYED';
    if (ratio <= WEAPON_FAULT_THRESHOLD && service?.used)
        return 'WEAPON FAULT · FIELD SERVICE SPENT';
    return null;
}
