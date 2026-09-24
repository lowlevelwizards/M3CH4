export const DEFAULT_RIG_CONFIG = {
    massKg: 4_250,
    driveForceN: 12_200,
    reverseForceN: 8_000,
    brakeForceN: 22_000,
    longitudinalDragNsPerM: 760,
    lateralGripNsPerM: 10_500,
    turnTorqueNm: 23_000,
    yawDampingNms: 26_000,
    yawInertiaKgM2: 9_200,
    maxForwardSpeedMps: 7.4,
    maxReverseSpeedMps: 3.5,
    collisionRadiusM: 0.95,
    collisionRestitution: 0.08,
    collisionTangentialDamping: 0.72,
};
export const DEFAULT_WORLD = {
    minX: -23,
    maxX: 23,
    minZ: -16,
    maxZ: 16,
    obstacles: [
        { id: 'barrier-west', minX: -14.5, maxX: -10.5, minZ: -2.2, maxZ: 2.2 },
        { id: 'barrier-east', minX: 10.5, maxX: 14.5, minZ: -2.2, maxZ: 2.2 },
        { id: 'crate-north', minX: -2.1, maxX: 2.1, minZ: -11.8, maxZ: -9.2 },
    ],
};
export function createRigState() {
    return {
        x: 0,
        z: 8,
        vx: 0,
        vz: 0,
        yaw: 0,
        yawRate: 0,
        driveLoad: 0,
        forwardSpeed: 0,
        lateralSpeed: 0,
        longitudinalAcceleration: 0,
        impact: 0,
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
    const steer = clamp(input.steer, -1, 1);
    const brake = clamp(input.brake, 0, 1);
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
    const lateralForce = -lateralSpeed * config.lateralGripNsPerM;
    const ax = (forwardX * longitudinalForce + rightX * lateralForce) / config.massKg;
    const az = (forwardZ * longitudinalForce + rightZ * lateralForce) / config.massKg;
    state.vx += ax * dt;
    state.vz += az * dt;
    const speedFraction = clamp(Math.abs(previousForwardSpeed) / config.maxForwardSpeedMps, 0, 1);
    const turnAuthority = 0.68 + speedFraction * 0.32;
    const yawTorque = steer * config.turnTorqueNm * turnAuthority - state.yawRate * config.yawDampingNms;
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
    state.longitudinalAcceleration = (state.forwardSpeed - previousForwardSpeed) / dt;
    const propulsionLoad = Math.abs(opposingThrottle ? 0 : requestedForce) / config.driveForceN;
    const turningLoad = Math.abs(steer) * 0.32;
    const brakingLoad = brake * 0.18;
    state.driveLoad = clamp(propulsionLoad + turningLoad + brakingLoad, 0, 1);
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
    state.impact = clamp(state.impact + impactSpeed / 6, 0, 1);
}
