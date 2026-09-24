import * as THREE from 'three';
import { assemblyMassKg, BY_ID, createTestAssembly, validateAssembly } from './components.js';
import { Controls } from './controls.js';
import { createRigState, DEFAULT_RIG_CONFIG, physicsYawToViewYaw, stepRig } from './locomotion.js';
import { createArenaScene } from './scene.js';
const FIXED_DT = 1 / 60;
const MAX_FRAME_DT = 0.12;
const assembly = createTestAssembly();
const assemblyProblems = validateAssembly(assembly);
if (assemblyProblems.length)
    throw new Error(`Invalid test rig: ${assemblyProblems.join('; ')}`);
const installedMassKg = assemblyMassKg(assembly);
const rigConfig = { ...DEFAULT_RIG_CONFIG, massKg: installedMassKg };
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
const motionEl = required('#motion-direction');
const lookHeadingEl = required('#look-heading');
const devToggle = required('#dev-toggle');
const devPanel = required('#dev-panel');
const devReadout = required('#dev-readout');
const resetRig = required('#reset-rig');
const toggleColliders = required('#toggle-colliders');
const resolutionToggle = required('#resolution-toggle');
const assemblyToggle = required('#assembly-toggle');
const inspectionPanel = required('#inspection-panel');
const partInfo = required('#part-info');
const partList = required('#part-list');
const appView = required('#app-view');
const appSheet = required('#app-sheet');
const appMessage = required('#app-message');
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = false;
renderer.domElement.className = 'game-canvas';
renderer.domElement.setAttribute('aria-label', '3D mech and arena');
mount.appendChild(renderer.domElement);
const arena = createArenaScene(assembly);
let rig = createRigState();
const controls = new Controls(required('#drive-zone'), required('#drive-knob'), required('#look-zone'), required('#brake'));
// Installed assembly is the source of truth; even this first rig's mass comes from parts.
required('#assembly-mass').textContent = `${installedMassKg.toLocaleString()} kg`;
let inspecting = false;
let selectedPart = 'chassis';
const partButtons = new Map();
function selectPart(partId) {
    selectedPart = partId;
    arena.selectPart(partId);
    for (const [id, button] of partButtons) {
        const selected = id === partId;
        button.classList.toggle('selected', selected);
        button.setAttribute('aria-pressed', String(selected));
    }
    partInfo.replaceChildren();
    const definition = partId ? BY_ID.get(partId) : null;
    const installed = assembly.parts.find((part) => part.definitionId === partId);
    if (!definition || !installed) {
        partInfo.textContent = 'Select a component to inspect its physical role.';
        return;
    }
    const title = document.createElement('div');
    title.className = 'part-model';
    title.textContent = definition.model;
    const stats = document.createElement('div');
    stats.className = 'part-stat';
    const parent = definition.mountedTo ? BY_ID.get(definition.mountedTo)?.model ?? definition.mountedTo : 'ROOT FRAME';
    stats.textContent = `SERIAL ${installed.serial}\nMASS ${definition.massKg} kg\nMOUNT ${parent}\nENVELOPE ${definition.envelope.join(' × ')} m`;
    stats.style.whiteSpace = 'pre-line';
    const purpose = document.createElement('div');
    purpose.className = 'part-purpose';
    purpose.textContent = definition.purpose;
    partInfo.append(title, stats, purpose);
}
for (const installed of assembly.parts) {
    const definition = BY_ID.get(installed.definitionId);
    if (!definition)
        continue;
    const button = document.createElement('button');
    button.type = 'button';
    button.setAttribute('aria-label', `Inspect ${definition.model}`);
    const name = document.createElement('span');
    name.textContent = definition.model;
    const mass = document.createElement('span');
    mass.textContent = `${definition.massKg} kg`;
    button.append(name, mass);
    button.addEventListener('click', () => selectPart(definition.id));
    partList.appendChild(button);
    partButtons.set(definition.id, button);
}
selectPart(selectedPart);
function toggleInspection(force) {
    inspecting = force ?? !inspecting;
    document.body.classList.toggle('inspecting', inspecting);
    inspectionPanel.classList.toggle('hidden', !inspecting);
    assemblyToggle.classList.toggle('pressed', inspecting);
    assemblyToggle.setAttribute('aria-pressed', String(inspecting));
    assemblyToggle.textContent = inspecting ? 'PILOT VIEW' : 'ASSEMBLY';
    arena.setInspection(inspecting);
    controls.setEnabled(!inspecting && appSheet.classList.contains('hidden'));
    // Inspecting is a paused 3D parts diagram, not a separate garage or repair mode.
    accumulator = 0;
}
assemblyToggle.addEventListener('click', () => toggleInspection());
renderer.domElement.addEventListener('pointerup', (event) => {
    if (!inspecting)
        return;
    const chosen = arena.pickPart(event.clientX, event.clientY, renderer.domElement);
    if (chosen)
        selectPart(chosen);
});
required('#center-view').addEventListener('click', () => controls.recenterLook());
const appStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
function showAppGuide() {
    appMessage.textContent = appStandalone()
        ? 'You are already running the standalone Home Screen app. Safari tabs are hidden in this mode.'
        : 'On iPhone: open the hosted game in Safari, tap Share → Add to Home Screen, leave Open as Web App enabled if offered, then tap Add. Launch MECH ARENA from its Home Screen icon.';
    appSheet.classList.remove('hidden');
    appSheet.setAttribute('aria-hidden', 'false');
    controls.setEnabled(false);
}
function hideAppGuide() {
    appSheet.classList.add('hidden');
    appSheet.setAttribute('aria-hidden', 'true');
    controls.setEnabled(!inspecting);
}
appView.addEventListener('click', async () => {
    // iPhone Safari does not expose arbitrary page fullscreen; offer the proper app installation path.
    if (appStandalone()) {
        showAppGuide();
        return;
    }
    if (document.fullscreenEnabled && document.documentElement.requestFullscreen) {
        try {
            await document.documentElement.requestFullscreen();
            appView.textContent = 'FULL SCREEN';
            return;
        }
        catch { /* Safari and browsers that reject this fall back to the guide. */ }
    }
    showAppGuide();
});
required('#app-close').addEventListener('click', hideAppGuide);
required('#app-done').addEventListener('click', hideAppGuide);
appView.textContent = appStandalone() ? 'APP MODE' : 'APP VIEW';
document.addEventListener('fullscreenchange', () => {
    appView.textContent = document.fullscreenElement ? 'FULL SCREEN' : appStandalone() ? 'APP MODE' : 'APP VIEW';
    resize();
});
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
    const input = controls.sample();
    let steps = 0;
    if (!inspecting && appSheet.classList.contains('hidden') && document.visibilityState !== 'hidden') {
        accumulator += frameDt;
        while (accumulator >= FIXED_DT && steps < 8) {
            stepRig(rig, input, FIXED_DT, rigConfig);
            accumulator -= FIXED_DT;
            steps++;
        }
        if (steps === 8)
            accumulator = 0;
    }
    else
        accumulator = 0;
    arena.updateRigVisual(rig, input.lookYaw, input.lookPitch, frameDt);
    updateUi(input.lookYaw, steps);
    renderer.render(arena.scene, arena.camera);
    requestAnimationFrame(frame);
}
function updateUi(lookYaw, steps) {
    speedEl.textContent = Math.hypot(rig.vx, rig.vz).toFixed(1);
    motionEl.textContent = rig.forwardSpeed < -0.15 ? 'REV' : rig.forwardSpeed > 0.15 ? 'FWD' : 'IDLE';
    yawRateEl.textContent = Math.round(THREE.MathUtils.radToDeg(rig.yawRate)).toString();
    loadBar.style.transform = `scaleX(${rig.driveLoad.toFixed(3)})`;
    const degrees = Math.round(-THREE.MathUtils.radToDeg(lookYaw));
    lookHeadingEl.textContent = Math.abs(degrees) < 2
        ? 'VIEW: FORWARD · CENTERED'
        : `VIEW: ${degrees > 0 ? 'RIGHT' : 'LEFT'} ${Math.abs(degrees)}° · MECH-RELATIVE`;
    if (!devPanel.classList.contains('hidden')) {
        devReadout.textContent = [
            `FPS       ${fps.toFixed(0)}`,
            `FIXED DT  ${(FIXED_DT * 1000).toFixed(2)} ms`,
            `STEPS     ${steps}${inspecting ? ' (PAUSED INSPECTION)' : ''}`,
            `POS X/Z   ${rig.x.toFixed(2)} / ${rig.z.toFixed(2)} m`,
            `FWD V     ${rig.forwardSpeed.toFixed(2)} m/s`,
            `LAT V     ${rig.lateralSpeed.toFixed(2)} m/s`,
            `YAW       ${THREE.MathUtils.radToDeg(rig.yaw).toFixed(1)}°`,
            `VIEW YAW  ${THREE.MathUtils.radToDeg(physicsYawToViewYaw(rig.yaw) + lookYaw).toFixed(1)}° (THREE)`,
            `YAW RATE  ${THREE.MathUtils.radToDeg(rig.yawRate).toFixed(1)}°/s`,
            `ACCEL     ${rig.longitudinalAcceleration.toFixed(2)} m/s²`,
            `LOAD      ${(rig.driveLoad * 100).toFixed(0)}%`,
            `IMPACT    ${(rig.impact * 100).toFixed(0)}%`,
            `PARTS     ${assembly.parts.length}`,
            `MASS      ${installedMassKg.toLocaleString()} kg`,
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
