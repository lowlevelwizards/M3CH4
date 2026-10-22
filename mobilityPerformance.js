/** k.3c.0 prototype mobility character layer.
 *
 * These values describe how each current leg family feels, not the final load
 * simulation. Total installed rig mass still comes from the live assembly, so
 * what is mounted above the legs already affects acceleration/recoil in the
 * existing Newtonian model. Later builds can replace these family multipliers
 * with load distribution, centre-of-mass and actuator-limit calculations.
 */
export const MOBILITY_PERFORMANCE = Object.freeze({
    'legs-yard': Object.freeze({
        label: 'BALANCED WORK WALKER',
        driveForceScale: 1.00,
        reverseForceScale: 1.00,
        brakeForceScale: 1.00,
        longitudinalDragScale: 1.00,
        lateralGripScale: 1.00,
        lateralDriveScale: 1.00,
        turnTorqueScale: 1.00,
        yawDampingScale: 1.00,
        yawInertiaScale: 1.00,
        turnAuthorityAtZero: .68,
        collisionRestitution: .08,
        collisionTangentialDamping: .72,
        collisionImpactScale: 1.00,
        damageTakenScale: 1.00,
    }),
    'legs-compact': Object.freeze({
        label: 'AGILE RUNNER',
        driveForceScale: 1.35,
        reverseForceScale: 1.25,
        brakeForceScale: .82,
        longitudinalDragScale: 1.35,
        lateralGripScale: .78,
        lateralDriveScale: 1.05,
        turnTorqueScale: 1.15,
        yawDampingScale: .78,
        yawInertiaScale: .72,
        turnAuthorityAtZero: .84,
        collisionRestitution: .12,
        collisionTangentialDamping: .86,
        collisionImpactScale: 1.25,
        damageTakenScale: 1.25,
    }),
    'legs-hauler': Object.freeze({
        label: 'HEAVY LOAD-BEARER',
        driveForceScale: .72,
        reverseForceScale: .80,
        brakeForceScale: 1.45,
        longitudinalDragScale: .60,
        lateralGripScale: 1.15,
        lateralDriveScale: .85,
        turnTorqueScale: .88,
        yawDampingScale: 1.25,
        yawInertiaScale: 1.45,
        turnAuthorityAtZero: .55,
        // Low-speed reduction gearing: higher yaw torque only once both feet
        // are planted. No extra angular velocity or canned heading correction.
        pivotGearTorqueScale: 1.29,
        collisionRestitution: .03,
        collisionTangentialDamping: .55,
        collisionImpactScale: .65,
        damageTakenScale: .72,
    }),
});

export function mobilityPerformance(definitionId) {
    return MOBILITY_PERFORMANCE[definitionId] ?? MOBILITY_PERFORMANCE['legs-yard'];
}
