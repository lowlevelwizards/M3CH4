/** Holding brake plants the feet once nearly stationary. This is a shared,
 * deterministic controller state: no extra button and no special AI exceptions. */
export const BRACE = Object.freeze({
    brakeThreshold: .85, settleSpeedMps: .26, settleYawRadS: .22,
    transitionSeconds: .30, intentDeadzone: .12,
});
export const DEFAULT_RIG_CONFIG = {
    massKg: 4_250,
    driveForceN: 12_200,
    reverseForceN: 8_000,
    brakeForceN: 22_000,
    longitudinalDragNsPerM: 760,
    lateralGripNsPerM: 10_500,
    lateralDriveForceN: 21_500,
    maxLateralSpeedMps: 2.4,
    turnTorqueNm: 23_000,
    yawDampingNms: 26_000,
    yawInertiaKgM2: 9_200,
    turnAuthorityAtZero: .68,
    maxForwardSpeedMps: 7.4,
    maxReverseSpeedMps: 3.5,
    collisionRadiusM: 0.95,
    collisionRestitution: 0.08,
    collisionTangentialDamping: 0.72,
    collisionImpactScale: 1,
    // The footprint has a finite combined longitudinal/lateral contact budget.
    // Derive its force from fitted grip and drive, rather than invented class bonuses.
};

/** k.3i.0 beginner yard: enough distance and occlusion for a real approach phase.
 * Obstacles remain plain AABBs for collision/navigation, but optional render metadata
 * lets scene.js draw the same authoritative shapes as useful cover rather than props. */
export const PLAYER_SPAWN = Object.freeze({ x: 0, z: 22, yaw: 0 });
export const HOSTILE_SPAWN = Object.freeze({ x: 0, z: -22, yaw: Math.PI });
export const DEFAULT_WORLD = {
    minX: -32,
    maxX: 32,
    minZ: -27,
    maxZ: 27,
    obstacles: [
        // The central loading house deliberately breaks spawn-to-spawn line of sight.
        { id: 'loading-house', minX: -5.2, maxX: 5.2, minZ: -4.4, maxZ: 4.4, height: 4.4, kind: 'building' },

        // Offset concrete screens make two readable lanes without turning the yard
        // into a maze. They are tall enough to hide most of a mech at combat range.
        { id: 'screen-north-west', minX: -20.5, maxX: -12.0, minZ: -13.0, maxZ: -10.3, height: 2.7, kind: 'barrier' },
        { id: 'screen-north-east', minX: 11.5, maxX: 19.5, minZ: -9.2, maxZ: -6.5, height: 2.7, kind: 'barrier' },
        { id: 'screen-south-west', minX: -20.0, maxX: -12.0, minZ: 7.0, maxZ: 9.7, height: 2.7, kind: 'barrier' },
        { id: 'screen-south-east', minX: 12.5, maxX: 20.5, minZ: 11.0, maxZ: 13.7, height: 2.7, kind: 'barrier' },

        // Two container stacks create outer flanking cover and visually widen the yard.
        { id: 'container-west', minX: -27.0, maxX: -22.3, minZ: -3.6, maxZ: 3.6, height: 3.0, kind: 'container' },
        { id: 'container-east', minX: 22.3, maxX: 27.0, minZ: -3.6, maxZ: 3.6, height: 3.0, kind: 'container' },

        // Lower home-side barricades give each spawn somewhere to fall back to without
        // fully blocking the forward view from the cockpit.
        { id: 'home-cover-west', minX: -10.0, maxX: -3.5, minZ: 15.2, maxZ: 17.0, height: 1.65, kind: 'barrier-low' },
        { id: 'home-cover-east', minX: 4.0, maxX: 10.5, minZ: 14.0, maxZ: 15.8, height: 1.65, kind: 'barrier-low' },
        { id: 'away-cover-west', minX: -10.5, maxX: -4.0, minZ: -15.8, maxZ: -14.0, height: 1.65, kind: 'barrier-low' },
        { id: 'away-cover-east', minX: 3.5, maxX: 10.0, minZ: -17.0, maxZ: -15.2, height: 1.65, kind: 'barrier-low' },

        // Perimeter steel supports keep the industrial-bay language from the first map.
        ...[-27, -13, 13, 27].flatMap(x => [-23.5, 23.5].map(z => ({
            id: `pillar-${x}-${z}`, minX: x - .3, maxX: x + .3, minZ: z - .3, maxZ: z + .3,
            height: 7.5, kind: 'pillar',
        }))),
    ],
};

export function createRigState(spawn = PLAYER_SPAWN) {
    return {
        x: Number.isFinite(spawn?.x) ? spawn.x : PLAYER_SPAWN.x,
        z: Number.isFinite(spawn?.z) ? spawn.z : PLAYER_SPAWN.z,
        vx: 0,
        vz: 0,
        yaw: Number.isFinite(spawn?.yaw) ? spawn.yaw : PLAYER_SPAWN.yaw,
        yawRate: 0,
        driveLoad: 0,
        forwardSpeed: 0,
        lateralSpeed: 0,
        longitudinalAcceleration: 0,
        impact: 0,
        brace: 0,
        braceHoldSeconds: 0,
        braced: false,
        recoilLoad: 0,
        tractionUse: 0,
        tractionSaturated: false,
        footSlipMps: 0,
        footingLoad: 0,
        lateralAcceleration: 0,
    };
}
/** Three.js camera's -Z forward requires the opposite signed Y rotation. */
export function physicsYawToViewYaw(physicsYaw) { return -physicsYaw; }
/** Physics forward direction on the ground: +X right, -Z forward at zero yaw. */
export function rigForward(yaw) { return [Math.sin(yaw), -Math.cos(yaw)]; }
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const damp = (value, strength, dt) => value * Math.exp(-strength * dt);
export function stepRig(state, input, dt, config = DEFAULT_RIG_CONFIG, world = DEFAULT_WORLD) {
    const throttle = clamp(input.throttle, -1, 1);
    const strafe = clamp(input.strafe ?? 0, -1, 1);
    const steer = clamp(input.steer, -1, 1);
    const brake = clamp(input.brake, 0, 1);
    // Bracing is a deliberate hold after coming to rest. Turning, stepping,
    // throttle, power loss or drive damage prevents/relinquishes the stance.
    // No random state or player-only shortcut: AI uses stepRig too.
    const canBrace = brake >= BRACE.brakeThreshold &&
        Math.abs(throttle) < BRACE.intentDeadzone &&
        Math.abs(strafe) < BRACE.intentDeadzone &&
        Math.abs(steer) < BRACE.intentDeadzone &&
        Math.hypot(state.vx, state.vz) <= BRACE.settleSpeedMps &&
        Math.abs(state.yawRate) <= BRACE.settleYawRadS &&
        config.driveForceN > 0 && config.lateralDriveForceN > 0 &&
        (config.turnLeftScale ?? 1) > .42 && (config.turnRightScale ?? 1) > .42;
    state.braceHoldSeconds = canBrace ? Math.min(BRACE.transitionSeconds, (state.braceHoldSeconds ?? 0) + dt) : 0;
    state.brace = canBrace ? Math.min(1, state.braceHoldSeconds / BRACE.transitionSeconds) : 0;
    state.braced = state.brace >= 1;
    const sin = Math.sin(state.yaw);
    const cos = Math.cos(state.yaw);
    const forwardX = sin;
    const forwardZ = -cos;
    const rightX = cos;
    const rightZ = sin;
    const previousForwardSpeed = state.vx * forwardX + state.vz * forwardZ;
    const lateralSpeed = state.vx * rightX + state.vz * rightZ;
    const requestedForce = throttle >= 0 ? throttle * config.driveForceN : throttle * config.reverseForceN;
    const opposingThrottle = Math.abs(previousForwardSpeed) > 0.3 && Math.sign(throttle) !== Math.sign(previousForwardSpeed) && Math.abs(throttle) > 0.08;
    const brakingForce = (brake + (opposingThrottle ? Math.abs(throttle) : 0)) * config.brakeForceN;
    let longitudinalForce = opposingThrottle ? 0 : requestedForce;
    longitudinalForce += -previousForwardSpeed * config.longitudinalDragNsPerM;
    if (brakingForce > 0 && Math.abs(previousForwardSpeed) > 0.02) {
        longitudinalForce += -Math.sign(previousForwardSpeed) * brakingForce;
    }
    if (previousForwardSpeed >= config.maxForwardSpeedMps && longitudinalForce > 0)
        longitudinalForce = 0;
    if (previousForwardSpeed <= -config.maxReverseSpeedMps && longitudinalForce < 0)
        longitudinalForce = 0;
    // With hard braking, never overshoot through zero and accelerate in reverse.
    // The old signed fixed brake impulse could oscillate indefinitely around 0.
    if (brakingForce > 0 && Math.abs(previousForwardSpeed) <= .02)
        longitudinalForce = -previousForwardSpeed * config.massKg / dt;
    const predictedForward = previousForwardSpeed + longitudinalForce * dt / config.massKg;
    if (brakingForce > 0 && Math.abs(previousForwardSpeed) > .02 &&
        Math.sign(predictedForward) !== Math.sign(previousForwardSpeed))
        longitudinalForce = -previousForwardSpeed * config.massKg / dt;
    // A legged rig actively steps toward a requested sideways velocity. The grip
    // coefficient damps uncontrolled slide; lateralDriveForceN is the actuator limit.
    const targetLateralSpeed = strafe * config.maxLateralSpeedMps * (1 - brake * .8);
    const lateralError = targetLateralSpeed - lateralSpeed;
    let lateralForce = clamp(lateralError * config.lateralGripNsPerM, -config.lateralDriveForceN, config.lateralDriveForceN);
    // A planted foot cannot simultaneously provide unlimited propulsion,
    // sidestepping and cornering correction. The budget uses the *existing*
    // grip, motor and installed mass; yaw simply rotates the existing world
    // velocity into local lateral slip on the next fixed step.
    const groundBudgetN = Math.max(1, Math.min(
        config.massKg * 9.81,
        config.lateralGripNsPerM * 2.75 + config.driveForceN * .4,
    )) * (1 - .22 * (state.recoilLoad ?? 0));
    const demandedGroundN = Math.hypot(longitudinalForce, lateralForce);
    const contactRatio = demandedGroundN > groundBudgetN ? groundBudgetN / demandedGroundN : 1;
    longitudinalForce *= contactRatio;
    lateralForce *= contactRatio;
    state.tractionUse = clamp(demandedGroundN * contactRatio / groundBudgetN, 0, 1);
    state.tractionSaturated = demandedGroundN > groundBudgetN;
    // Intentional sidestepping is not a skid. Only unmet lateral correction
    // under saturated contact is reported as an audible/visual foot scrape.
    state.footSlipMps = state.tractionSaturated
        ? Math.abs(lateralError) * (1 - contactRatio) : 0;
    state.footingLoad += (clamp(state.tractionUse * .82 + (state.recoilLoad ?? 0) * .18, 0, 1) -
        (state.footingLoad ?? 0)) * (1 - Math.exp(-9 * dt));
    const ax = (forwardX * longitudinalForce + rightX * lateralForce) / config.massKg;
    const az = (forwardZ * longitudinalForce + rightZ * lateralForce) / config.massKg;
    state.vx += ax * dt;
    state.vz += az * dt;
    const speedFraction = clamp(Math.abs(previousForwardSpeed) / config.maxForwardSpeedMps, 0, 1);
    const zeroSpeedAuthority = clamp(config.turnAuthorityAtZero ?? .68, 0, 1);
    const turnAuthority = zeroSpeedAuthority + speedFraction * (1 - zeroSpeedAuthority);
    const directionalTurnScale = steer >= 0 ? (config.turnRightScale ?? 1) : (config.turnLeftScale ?? 1);
    const yawTorque = steer * config.turnTorqueNm * turnAuthority * directionalTurnScale
        + throttle * (config.driveAsymmetryTorqueNm ?? 0)
        - state.yawRate * config.yawDampingNms * (1 + 1.7 * state.brace);
    state.yawRate += (yawTorque / config.yawInertiaKgM2) * dt;
    state.yaw += state.yawRate * dt;
    state.x += state.vx * dt;
    state.z += state.vz * dt;
    state.impact = damp(state.impact, 7.5, dt);
    resolveWorldCollisions(state, config, world);
    const newSin = Math.sin(state.yaw);
    const newCos = Math.cos(state.yaw);
    const newForwardX = newSin;
    const newForwardZ = -newCos;
    const newRightX = newCos;
    const newRightZ = newSin;
    state.forwardSpeed = state.vx * newForwardX + state.vz * newForwardZ;
    state.lateralSpeed = state.vx * newRightX + state.vz * newRightZ;
    state.lateralAcceleration = (state.lateralSpeed - lateralSpeed) / dt;
    state.recoilLoad = Math.max(0, (state.recoilLoad ?? 0) - dt *
        config.lateralGripNsPerM / Math.max(1, config.massKg) * .78);
    state.longitudinalAcceleration = (state.forwardSpeed - previousForwardSpeed) / dt;
    const propulsionLoad = config.driveForceN > 0
        ? Math.abs(opposingThrottle ? 0 : requestedForce) / config.driveForceN : 0;
    const lateralLoad = config.lateralDriveForceN > 0 ? Math.abs(lateralForce) / config.lateralDriveForceN * .55 : 0;
    const turningLoad = Math.abs(steer) * 0.26;
    const brakingLoad = brake * 0.18;
    state.driveLoad = clamp(propulsionLoad + lateralLoad + turningLoad + brakingLoad, 0, 1);
}
function resolveWorldCollisions(state, config, world) {
    const radius = config.collisionRadiusM;
    let collisionNormalX = 0;
    let collisionNormalZ = 0;
    let penetration = 0;
    if (state.x - radius < world.minX) {
        collisionNormalX = 1;
        penetration = world.minX - (state.x - radius);
    }
    else if (state.x + radius > world.maxX) {
        collisionNormalX = -1;
        penetration = state.x + radius - world.maxX;
    }
    if (penetration > 0) {
        state.x += collisionNormalX * penetration;
        applyCollisionVelocity(state, collisionNormalX, 0, config);
    }
    collisionNormalX = 0;
    collisionNormalZ = 0;
    penetration = 0;
    if (state.z - radius < world.minZ) {
        collisionNormalZ = 1;
        penetration = world.minZ - (state.z - radius);
    }
    else if (state.z + radius > world.maxZ) {
        collisionNormalZ = -1;
        penetration = state.z + radius - world.maxZ;
    }
    if (penetration > 0) {
        state.z += collisionNormalZ * penetration;
        applyCollisionVelocity(state, 0, collisionNormalZ, config);
    }
    for (const obstacle of world.obstacles) {
        resolveCircleAabb(state, obstacle, radius, config);
    }
}
function resolveCircleAabb(state, obstacle, radius, config) {
    const closestX = clamp(state.x, obstacle.minX, obstacle.maxX);
    const closestZ = clamp(state.z, obstacle.minZ, obstacle.maxZ);
    let dx = state.x - closestX;
    let dz = state.z - closestZ;
    const distSq = dx * dx + dz * dz;
    if (distSq >= radius * radius)
        return;
    if (distSq < 1e-9) {
        const left = Math.abs(state.x - obstacle.minX);
        const right = Math.abs(obstacle.maxX - state.x);
        const top = Math.abs(state.z - obstacle.minZ);
        const bottom = Math.abs(obstacle.maxZ - state.z);
        const minEdge = Math.min(left, right, top, bottom);
        if (minEdge === left) {
            dx = -1;
            dz = 0;
        }
        else if (minEdge === right) {
            dx = 1;
            dz = 0;
        }
        else if (minEdge === top) {
            dx = 0;
            dz = -1;
        }
        else {
            dx = 0;
            dz = 1;
        }
    }
    const dist = Math.max(Math.hypot(dx, dz), 1e-6);
    const nx = dx / dist;
    const nz = dz / dist;
    const push = radius - dist;
    state.x += nx * push;
    state.z += nz * push;
    applyCollisionVelocity(state, nx, nz, config);
}
function applyCollisionVelocity(state, nx, nz, config) {
    const normalVelocity = state.vx * nx + state.vz * nz;
    if (normalVelocity >= 0)
        return;
    const impactSpeed = -normalVelocity;
    const tx = -nz;
    const tz = nx;
    const tangentVelocity = state.vx * tx + state.vz * tz;
    const reboundVelocity = impactSpeed * config.collisionRestitution;
    state.vx = nx * reboundVelocity + tx * tangentVelocity * config.collisionTangentialDamping;
    state.vz = nz * reboundVelocity + tz * tangentVelocity * config.collisionTangentialDamping;
    state.yawRate *= 0.82;
    state.impact = clamp(state.impact + impactSpeed / 6 * (config.collisionImpactScale ?? 1), 0, 1);
}
