/** The center of a two-finger gesture drives pan, its separation drives zoom. */
export function gestureMetrics(points) {
    if (points.length < 2)
        return null;
    const [a, b] = points;
    return {
        center: { x: (a.x + b.x) * 0.5, y: (a.y + b.y) * 0.5 },
        separation: Math.hypot(a.x - b.x, a.y - b.y),
    };
}
/** A rightward drag brings the viewed machine rightward on screen at every orbit angle.
 * Our inspection camera sits at (sin(a), e, -cos(a)) relative to the mech, so its
 * SCREEN-right axis is (-cos(a), 0, -sin(a)), not (+cos(a), 0, +sin(a)).
 * A rightward drag moves the CAMERA screen-left (opposite screen-right). */
export function orbitAzimuthAfterDrag(azimuth, dxPixels) {
    return (azimuth + dxPixels * 0.007) % (Math.PI * 2);
}
/** Two-finger panning moves the viewed mech with your fingers, at every orbit angle.
 * The camera target must move opposite the camera's on-screen right axis.
 * Distances scale with radius, so pan stays useful when zoomed. */
export function panInRigSpace(dxPixels, dyPixels, radius, azimuth, elevation, viewportHeight, fovDegrees) {
    if (viewportHeight <= 0 || radius <= 0)
        return { x: 0, y: 0, z: 0 };
    const scale = 2 * radius * Math.tan(fovDegrees * Math.PI / 360) / viewportHeight;
    // Camera SCREEN-right = (-cos(a), 0, -sin(a)); camera-up = (-sin(a)sin(e), cos(e), cos(a)sin(e).
    // Moving the camera/target in +rightX/+rightZ moves the visible mech right.
    const rightX = Math.cos(azimuth);
    const rightZ = Math.sin(azimuth);
    const upX = -Math.sin(azimuth) * Math.sin(elevation);
    const upY = Math.cos(elevation);
    const upZ = Math.cos(azimuth) * Math.sin(elevation);
    return {
        x: scale * (dxPixels * rightX + dyPixels * upX),
        y: scale * dyPixels * upY,
        z: scale * (dxPixels * rightZ + dyPixels * upZ),
    };
}
/** Shift the look-at direction toward +world-right to place the rig SCREEN-right,
 * in the middle of the space that remains after the left inspector panel. */
export function framingOffsetWorld(panelRightPixels, viewportWidth, viewportHeight, radius, fovDegrees) {
    if (viewportWidth <= 0 || viewportHeight <= 0 || radius <= 0)
        return 0;
    const reserved = Math.max(0, Math.min(panelRightPixels, viewportWidth * 0.72));
    // Perspective approximation: projects to half the panel's width in screen pixels.
    return radius * Math.tan(fovDegrees * Math.PI / 360) * (viewportWidth / viewportHeight) * (reserved / viewportWidth);
}
