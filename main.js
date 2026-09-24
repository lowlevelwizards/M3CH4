import * as THREE from 'three';
import { Controls } from './controls.js';
import { createRigState, DEFAULT_RIG_CONFIG, stepRig } from './locomotion.js';
import { createArenaScene } from './scene.js';
const FIXED_DT = 1 / 60;
const MAX_FRAME_DT = 0.12;
function required(selector) {
    const element = document.querySelector(selector);
    if (!element)
        throw new Error(`Missing required element: ${selector}`);
    return element;
}
const mount = required('#game');
const speedEl = required('#speed');
const yawRateEl = required('#yaw-rate');
const loadBar = required('#load-bar');
const devToggle = required('#dev-toggle');
const devPanel = required('#dev-panel');
const devReadout = required('#dev-readout');
const resetRig = required('#reset-rig');
const toggleColliders = required('#toggle-colliders');
const resolutionToggle = required('#resolution-toggle');
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = false;
renderer.domElement.className = 'game-canvas';
mount.appendChild(renderer.domElement);
const arena = createArenaScene();
let rig = createRigState();
const controls = new Controls(required('#drive-zone'), required('#drive-knob'), required('#look-zone'), required('#brake'));
const renderScales = [0.55, 0.7, 0.85];
let renderScaleIndex = 1;
let renderScale = renderScales[renderScaleIndex];
let previousTime = performance.now();
let accumulator = 0;
let fps = 60;
let showColliders = false;
function resize() {
    const width = Math.max(1, window.innerWidth);
    const height = Math.max(1, window.innerHeight);
    arena.camera.aspect = width / height;
    arena.camera.updateProjectionMatrix();
    renderer.setSize(Math.floor(width * renderScale), Math.floor(height * renderScale), false);
    renderer.domElement.style.width = `${width}px`;
    renderer.domElement.style.height = `${height}px`;
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => window.setTimeout(resize, 120));
resize();
function frame(now) {
    const frameDt = Math.min((now - previousTime) / 1000, MAX_FRAME_DT);
    previousTime = now;
    fps += ((1 / Math.max(frameDt, 0.0001)) - fps) * 0.06;
    accumulator += frameDt;
    const input = controls.sample();
    let steps = 0;
    while (accumulator >= FIXED_DT && steps < 8) {
        stepRig(rig, input, FIXED_DT);
        accumulator -= FIXED_DT;
        steps += 1;
    }
    if (steps === 8)
        accumulator = 0;
    arena.updateRigVisual(rig, input.lookYaw, input.lookPitch, frameDt);
    updateUi(steps);
    renderer.render(arena.scene, arena.camera);
    requestAnimationFrame(frame);
}
function updateUi(steps) {
    speedEl.textContent = Math.abs(rig.forwardSpeed).toFixed(1);
    yawRateEl.textContent = Math.round(THREE.MathUtils.radToDeg(rig.yawRate)).toString();
    loadBar.style.transform = `scaleX(${rig.driveLoad.toFixed(3)})`;
    if (!devPanel.classList.contains('hidden')) {
        devReadout.textContent = [
            `FPS       ${fps.toFixed(0)}`,
            `FIXED DT  ${(FIXED_DT * 1000).toFixed(2)} ms`,
            `STEPS     ${steps}`,
            `POS X/Z   ${rig.x.toFixed(2)} / ${rig.z.toFixed(2)} m`,
            `FWD V     ${rig.forwardSpeed.toFixed(2)} m/s`,
            `LAT V     ${rig.lateralSpeed.toFixed(2)} m/s`,
            `YAW       ${THREE.MathUtils.radToDeg(rig.yaw).toFixed(1)}°`,
            `YAW RATE  ${THREE.MathUtils.radToDeg(rig.yawRate).toFixed(1)}°/s`,
            `ACCEL     ${rig.longitudinalAcceleration.toFixed(2)} m/s²`,
            `LOAD      ${(rig.driveLoad * 100).toFixed(0)}%`,
            `IMPACT    ${(rig.impact * 100).toFixed(0)}%`,
            `MASS      ${DEFAULT_RIG_CONFIG.massKg.toLocaleString()} kg`,
            `RENDER    ${Math.round(renderScale * 100)}%`,
        ].join('\n');
    }
}
devToggle.addEventListener('click', () => devPanel.classList.toggle('hidden'));
resetRig.addEventListener('click', () => {
    rig = createRigState();
    controls.recenterLook();
});
toggleColliders.addEventListener('click', () => {
    showColliders = !showColliders;
    arena.debugColliders.visible = showColliders;
    toggleColliders.textContent = `COLLIDERS: ${showColliders ? 'ON' : 'OFF'}`;
});
resolutionToggle.addEventListener('click', () => {
    renderScaleIndex = (renderScaleIndex + 1) % renderScales.length;
    renderScale = renderScales[renderScaleIndex];
    resolutionToggle.textContent = `RES ${Math.round(renderScale * 100)}`;
    resize();
});
requestAnimationFrame(frame);
