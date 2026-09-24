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
/** Convert a two-finger drag into world movement of the camera target.
 * Moving fingers to the right/down moves the viewed mech right/down on screen.
 * All distances are proportional to the current camera radius, so pan stays usable when zoomed. */
export function panInRigSpace(dxPixels, dyPixels, radius, azimuth, elevation, viewportHeight, fovDegrees) {
    if (viewportHeight <= 0 || radius <= 0)
        return { x: 0, y: 0, z: 0 };
    const scale = 2 * radius * Math.tan(fovDegrees * Math.PI / 360) / viewportHeight;
    // Camera-right = (cos(a), 0, sin(a)); camera-up = (-sin(a)sin(e), cos(e), cos(a)sin(e)).
    const rightX = Math.cos(azimuth);
    const rightZ = Math.sin(azimuth);
    const upX = -Math.sin(azimuth) * Math.sin(elevation);
    const upY = Math.cos(elevation);
    const upZ = Math.cos(azimuth) * Math.sin(elevation);
    return {
        x: scale * (-dxPixels * rightX + dyPixels * upX),
        y: scale * dyPixels * upY,
        z: scale * (-dxPixels * rightZ + dyPixels * upZ),
    };
}
/** Aim left by this world distance to frame the rig at the center of the unobstructed right-side viewport.
 * The inspector panel itself remains a normal scrolling HTML overlay. */
export function framingOffsetWorld(panelRightPixels, viewportWidth, viewportHeight, radius, fovDegrees) {
    if (viewportWidth <= 0 || viewportHeight <= 0 || radius <= 0)
        return 0;
    const reserved = Math.max(0, Math.min(panelRightPixels, viewportWidth * 0.72));
    // Horizontal visible width at this radius, times half the panel's fraction of viewport width.
    return radius * Math.tan(fovDegrees * Math.PI / 360) * (viewportWidth / viewportHeight) * (reserved / viewportWidth);
}
