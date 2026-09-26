/** The bridge between installed *physical* assemblies and assisted locomotion.
 * No rendering, DOM or builder UI logic belongs here. */
import { inspectAssembly, installedPart } from './components.js';
import { DEFAULT_RIG_CONFIG } from './locomotion.js';
export function deriveRigConfig(assembly) {
    const inspection = inspectAssembly(assembly);
    if (!inspection.ready)
        return null;
    const mover = installedPart(assembly, 'mobility').definition;
    const frame = installedPart(assembly, 'structure').definition;
    const massRatio = inspection.massKg / DEFAULT_RIG_CONFIG.massKg;
    const relativeWidth = (mover.envelope[0] / 2) ** 2;
    return {
        ...DEFAULT_RIG_CONFIG,
        massKg: inspection.massKg,
        driveForceN: mover.driveForceN,
        reverseForceN: mover.driveForceN * (8 / 12.2),
        turnTorqueNm: mover.turnTorqueNm,
        lateralGripNsPerM: mover.lateralGripNsPerM,
        lateralDriveForceN: mover.lateralDriveForceN,
        maxLateralSpeedMps: mover.maxLateralSpeedMps,
        maxForwardSpeedMps: mover.maxForwardSpeedMps,
        maxReverseSpeedMps: mover.maxForwardSpeedMps * .475,
        // Wider, heavier mobility assemblies cost real angular acceleration.
        // A narrow hull concentrates the supported mass nearer the yaw axis; leg stance still dominates.
        yawInertiaKgM2: 9200 * massRatio * relativeWidth * (.78 + .22 * (frame.envelope[0] / 1.78) ** 2),
        brakeForceN: 22000 * massRatio,
        collisionRadiusM: Math.max(.95, mover.envelope[0] * .47),
    };
}
