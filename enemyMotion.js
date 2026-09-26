const PHASES = [
    { seconds: 2.8, throttle: .7, strafe: 0, phase: 'APPROACH' },
    { seconds: 2.8, throttle: 0, strafe: .9, phase: 'STEP RIGHT' },
    { seconds: 2.2, throttle: -.65, strafe: 0, phase: 'RETREAT' },
    { seconds: 2.8, throttle: 0, strafe: -.9, phase: 'STEP LEFT' },
    { seconds: .8, throttle: 0, strafe: 0, phase: 'BRACE' },
];
const CYCLE = PHASES.reduce((sum, phase) => sum + phase.seconds, 0);
const clamp = (n) => Math.max(-1, Math.min(1, n));
export function createEnemyMotion() { return { elapsed: 0, phase: 'APPROACH' }; }
/** Signed yaw error toward the actual player, positive meaning clockwise/right. */
export function headingError(enemy, player) {
    const dx = player.x - enemy.x;
    const dz = player.z - enemy.z;
    if (dx * dx + dz * dz < .01)
        return 0;
    const desired = Math.atan2(dx, -dz);
    return Math.atan2(Math.sin(desired - enemy.yaw), Math.cos(desired - enemy.yaw));
}
export function advanceEnemyMotion(motion, enemy, player, dt, canMove = true) {
    if (Number.isFinite(dt) && dt > 0 && canMove)
        motion.elapsed += dt;
    const withinCycle = motion.elapsed % CYCLE;
    let remainder = withinCycle;
    const current = PHASES.find(phase => { remainder -= phase.seconds; return remainder < 0; }) ?? PHASES[0];
    motion.phase = current.phase;
    if (!canMove)
        return { throttle: 0, strafe: 0, steer: 0, brake: 1 };
    const error = headingError(enemy, player);
    // Yaw-rate feedback prevents the heavy body from continuously overshooting its target.
    const steer = clamp(error * 1.75 - enemy.yawRate * 1.15);
    return { throttle: current.throttle, strafe: current.strafe, steer, brake: current.phase === 'BRACE' ? .35 : 0 };
}
/** Weapon mount is not a magic 360-degree turret; j.1 uses a broad fixed firing arc. */
export function withinFiringArc(enemy, player) {
    return Math.abs(headingError(enemy, player)) < .95;
}
