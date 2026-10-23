/** True only when the real muzzle's first physical collision prevents the shot
 * from reaching the point chosen by the camera's sight ray. A hit at the
 * sighted wall, floor, ally or enemy is not a barrel-angle obstruction.
 *
 * Distances are measured from the actual muzzle along the same zero-spread
 * line. The small dead zone absorbs collision skin and small mesh offsets,
 * not a missing enemy target. This is HUD-only, never ballistic authority.
 */
export function muzzleRayFallsShort(aimDistance, impactDistance, hasPhysicalHit, toleranceMeters = .45) {
    return !!hasPhysicalHit &&
        Number.isFinite(aimDistance) && Number.isFinite(impactDistance) &&
        aimDistance >= 0 && impactDistance >= 0 &&
        aimDistance - impactDistance > toleranceMeters;
}
