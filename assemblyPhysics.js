/** Bridge installed physical assemblies to assisted locomotion. No renderer or DOM. */
import { inspectAssembly, installedPart } from './components.js';
import { DEFAULT_RIG_CONFIG } from './locomotion.js';
import { mobilityPerformance } from './mobilityPerformance.js';

/** An unfinished garage rig needs an inert configuration so its saved parts can
 * reopen for repair. It is NEVER deployable: inspectAssembly().ready gates the
 * existing deployment, fire and hostile-run flows in main.js. */
function parkedConfig(massKg) {
    return {
        ...DEFAULT_RIG_CONFIG,
        massKg: Math.max(1, massKg),
        driveForceN: 0, reverseForceN: 0, turnTorqueNm: 0,
        lateralDriveForceN: 0, maxLateralSpeedMps: 0,
        maxForwardSpeedMps: 0, maxReverseSpeedMps: 0,
    };
}
export function deriveRigConfig(assembly) {
    const inspection = inspectAssembly(assembly);
    if (!inspection.ready)
        return parkedConfig(inspection.massKg);
    const mover = installedPart(assembly, 'mobility').definition;
    const frame = installedPart(assembly, 'structure').definition;
    const profile = mobilityPerformance(mover.id);
    const massRatio = inspection.massKg / DEFAULT_RIG_CONFIG.massKg;
    const relativeWidth = (mover.envelope[0] / 2) ** 2;
    return {
        ...DEFAULT_RIG_CONFIG,
        massKg: inspection.massKg,
        driveForceN: mover.driveForceN * profile.driveForceScale,
        reverseForceN: mover.driveForceN * (8 / 12.2) * profile.reverseForceScale,
        brakeForceN: 22000 * massRatio * profile.brakeForceScale,
        longitudinalDragNsPerM: DEFAULT_RIG_CONFIG.longitudinalDragNsPerM * profile.longitudinalDragScale,
        lateralGripNsPerM: mover.lateralGripNsPerM * profile.lateralGripScale,
        lateralDriveForceN: mover.lateralDriveForceN * profile.lateralDriveScale,
        maxLateralSpeedMps: mover.maxLateralSpeedMps,
        maxForwardSpeedMps: mover.maxForwardSpeedMps,
        maxReverseSpeedMps: mover.maxForwardSpeedMps * .475,
        turnTorqueNm: mover.turnTorqueNm * profile.turnTorqueScale,
        yawDampingNms: DEFAULT_RIG_CONFIG.yawDampingNms * profile.yawDampingScale,
        yawInertiaKgM2: 9200 * massRatio * relativeWidth * (.78 + .22 * (frame.envelope[0] / 1.78) ** 2) * profile.yawInertiaScale,
        turnAuthorityAtZero: profile.turnAuthorityAtZero,
        // Hauler-only low-speed gearing, still limited by real actuator health,
        // electrical supply and the fitted footprint's contact moment.
        pivotTorqueNm: profile.pivotGearTorqueScale
            ? mover.turnTorqueNm * profile.pivotGearTorqueScale : 0,
        pivotLeverArmM: mover.envelope[0] / 2,
        collisionRadiusM: Math.max(.95, mover.envelope[0] * .47),
        collisionRestitution: profile.collisionRestitution,
        collisionTangentialDamping: profile.collisionTangentialDamping,
        collisionImpactScale: profile.collisionImpactScale,
    };
}
