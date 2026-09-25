import * as THREE from 'three';
import { deriveRigConfig } from './assemblyPhysics.js';
import { equip, inspectAssembly, installedPart, makeTestAssembly, partsFor, remove, SLOTS, } from './components.js';
import { Controls } from './controls.js';
import { gestureMetrics } from './inspectionCamera.js?v=b51';
import { createRigState, physicsYawToViewYaw, stepRig, } from './locomotion.js';
import { createArenaScene } from './scene.js?v=b6';
const FIXED_DT = 1 / 60;
const MAX_FRAME_DT = 0.12;
const labels = {
    structure: 'STRUCTURE', mobility: 'MOBILITY', power: 'POWER',
    command: 'COMMAND', combat: 'COMBAT',
};
const assembly = makeTestAssembly();
let inspection = inspectAssembly(assembly);
let rigConfig = deriveRigConfig(assembly);
if (!rigConfig)
    throw new Error('Starting test rig must be fieldable.');
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
const checkList = required('#field-checks');
const fieldStatus = required('#field-status');
const assemblyMass = required('#assembly-mass');
const powerStatus = required('#power-status');
const adapterStatus = required('#adapter-status');
const orbitHelp = required('#orbit-help');
const resetOrbitButton = required('#inspect-reset');
const centerView = required('#center-view');
const appView = required('#app-view');
const appSheet = required('#app-sheet');
const appMessage = required('#app-message');
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = false;
renderer.domElement.className = 'game-canvas';
renderer.domElement.setAttribute('aria-label', '3D warehouse and mech');
renderer.domElement.style.touchAction = 'none';
mount.appendChild(renderer.domElement);
const arena = createArenaScene(assembly);
let rig = createRigState();
const controls = new Controls(required('#drive-zone'), required('#drive-knob'), required('#look-zone'), required('#brake'));
let inspecting = false;
let selectedPart = null;
let statusTimeout = null;
const selectionButtons = new Map();
function showStatus(message) {
    fieldStatus.dataset.message = message;
    if (statusTimeout !== null)
        window.clearTimeout(statusTimeout);
    statusTimeout = window.setTimeout(() => {
        delete fieldStatus.dataset.message;
        statusTimeout = null;
    }, 2400);
    renderFieldStatus();
}
function renderFieldStatus() {
    fieldStatus.classList.toggle('ready', inspection.ready);
    fieldStatus.classList.toggle('blocked', !inspection.ready);
    fieldStatus.textContent = fieldStatus.dataset.message || (inspection.ready ? 'TRAINING-RIG READY · ENTER PILOT VIEW' :
        'ASSEMBLY INCOMPLETE · RESOLVE CHECKS TO DRIVE');
}
function selectPart(slot, focus = true) {
    selectedPart = slot;
    arena.selectPart(slot);
    // Clearing the highlight never steals the inspection camera from the pilot.
    if (focus && slot)
        arena.focusPart(slot);
    for (const [key, button] of selectionButtons) {
        button.classList.toggle('selected', key === slot);
        button.setAttribute('aria-pressed', String(key === slot));
    }
    renderPartInfo();
}
function specLine(part) {
    if (part.slot === 'structure')
        return `FRAME LIMIT ${part.loadLimitKg.toLocaleString()} kg`;
    if (part.slot === 'mobility')
        return `LOAD ${part.loadLimitKg.toLocaleString()} kg · ${part.maxForwardSpeedMps} m/s · ${-part.powerKw} kW`;
    if (part.slot === 'power')
        return `OUTPUT ${part.powerKw} kW`;
    if (part.slot === 'command')
        return `CONTROL LOAD ${-part.powerKw} kW`;
    return `NOMINAL LOAD ${-part.powerKw} kW · INERT`;
}
function renderPartInfo() {
    partInfo.replaceChildren();
    if (!selectedPart) {
        partInfo.textContent = 'Choose a physical assembly to inspect or try a replacement.';
        return;
    }
    const fitted = installedPart(assembly, selectedPart);
    const section = document.createElement('div');
    section.className = 'part-model';
    section.textContent = labels[selectedPart];
    partInfo.append(section);
    if (fitted) {
        const stats = document.createElement('div');
        stats.className = 'part-stat';
        stats.style.whiteSpace = 'pre-line';
        stats.textContent = `${fitted.definition.name}\nSERIAL ${fitted.instance.serial}\nMASS ${fitted.definition.massKg} kg`;
        const description = document.createElement('div');
        description.className = 'part-purpose';
        description.textContent = fitted.definition.description;
        const specs = document.createElement('div');
        specs.className = 'part-specs';
        specs.textContent = specLine(fitted.definition);
        partInfo.append(stats, specs, description);
    }
    else {
        const missing = document.createElement('div');
        missing.className = 'part-purpose missing-part';
        missing.textContent = 'NO MODULE INSTALLED. Choose an owned part below.';
        partInfo.append(missing);
    }
    const options = document.createElement('div');
    options.className = 'swap-options';
    for (const def of partsFor(selectedPart)) {
        const button = document.createElement('button');
        button.type = 'button';
        const fittedHere = fitted?.definition.id === def.id;
        button.className = `swap-option ${fittedHere ? 'installed-option' : ''}`;
        const title = document.createElement('span');
        title.textContent = `${fittedHere ? '✓ ' : 'FIT '}${def.name} · ${def.massKg} kg`;
        const specs = document.createElement('small');
        specs.textContent = specLine(def);
        button.append(title, specs);
        button.disabled = fittedHere;
        button.addEventListener('click', () => {
            equip(assembly, def.slot, def.id);
            refreshAssembly();
            selectPart(def.slot);
        });
        options.appendChild(button);
    }
    partInfo.append(options);
    if (fitted) {
        const takeOff = document.createElement('button');
        takeOff.type = 'button';
        takeOff.className = 'remove-option';
        takeOff.textContent = 'REMOVE INSTALLED MODULE';
        takeOff.addEventListener('click', () => {
            remove(assembly, selectedPart);
            refreshAssembly();
            selectPart(selectedPart);
        });
        partInfo.appendChild(takeOff);
    }
}
function renderPartsList() {
    selectionButtons.clear();
    partList.replaceChildren();
    for (const slot of SLOTS) {
        const fitted = installedPart(assembly, slot);
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'module-row';
        button.setAttribute('aria-label', `Inspect ${labels[slot]}`);
        button.setAttribute('aria-pressed', String(slot === selectedPart));
        const name = document.createElement('span');
        const category = document.createElement('small');
        category.textContent = labels[slot];
        name.append(category, document.createTextNode(fitted?.definition.name ?? 'EMPTY STATION'));
        const mass = document.createElement('span');
        mass.textContent = fitted ? `${fitted.definition.massKg} kg` : '—';
        button.append(name, mass);
        button.classList.toggle('selected', slot === selectedPart);
        button.classList.toggle('empty', !fitted);
        button.addEventListener('click', () => selectPart(selectedPart === slot ? null : slot));
        partList.appendChild(button);
        selectionButtons.set(slot, button);
    }
}
function renderChecks() {
    checkList.replaceChildren();
    for (const check of inspection.checks) {
        const row = document.createElement('div');
        row.className = `field-check ${check.passes ? 'pass' : 'fail'}`;
        const title = document.createElement('strong');
        title.textContent = `${check.passes ? '✓' : '!'} ${check.label.toUpperCase()}`;
        const reason = document.createElement('div');
        reason.textContent = check.reason;
        row.append(title, reason);
        checkList.append(row);
    }
    assemblyMass.textContent = `${inspection.massKg.toLocaleString()} kg`;
    powerStatus.textContent = `${inspection.powerUsedKw} / ${inspection.powerAvailableKw} kW`;
    adapterStatus.textContent = inspection.adapters.length
        ? inspection.adapters.map(a => `${a.description} · ${a.serial}`).join(' · ')
        : 'Direct-mount stations · no adapters';
    renderFieldStatus();
}
function refreshAssembly() {
    inspection = inspectAssembly(assembly);
    rigConfig = deriveRigConfig(assembly);
    arena.rebuildAssembly(assembly);
    renderPartsList();
    renderChecks();
    renderPartInfo();
}
refreshAssembly();
selectPart(null, false);
function toggleInspection(force) {
    const requested = force ?? !inspecting;
    if (!requested && !inspection.ready) {
        showStatus('NOT READY · RESTORE ALL FIVE FUNCTIONS');
        return;
    }
    inspecting = requested;
    document.body.classList.toggle('inspecting', inspecting);
    inspectionPanel.classList.toggle('hidden', !inspecting);
    orbitHelp.classList.toggle('hidden', !inspecting);
    resetOrbitButton.classList.toggle('hidden', !inspecting);
    centerView.classList.toggle('hidden', inspecting);
    assemblyToggle.classList.toggle('pressed', inspecting);
    assemblyToggle.setAttribute('aria-pressed', String(inspecting));
    assemblyToggle.textContent = inspecting ? 'PILOT VIEW' : 'ASSEMBLY';
    arena.setInspection(inspecting);
    if (inspecting) {
        arena.resetOrbit();
        syncInspectorLayout();
    }
    controls.setEnabled(!inspecting && appSheet.classList.contains('hidden'));
    accumulator = 0;
}
assemblyToggle.addEventListener('click', () => toggleInspection());
centerView.addEventListener('click', () => controls.recenterLook());
resetOrbitButton.addEventListener('click', () => { arena.resetOrbit(); showStatus('INSPECTION CAMERA RESET'); });
const pointers = new Map();
renderer.domElement.addEventListener('pointerdown', event => {
    if (!inspecting)
        return;
    event.preventDefault();
    renderer.domElement.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, {
        x: event.clientX, y: event.clientY,
        startX: event.clientX, startY: event.clientY, dragged: false,
    });
    if (pointers.size >= 2)
        for (const pointer of pointers.values())
            pointer.dragged = true;
});
renderer.domElement.addEventListener('pointermove', event => {
    const pointer = pointers.get(event.pointerId);
    if (!pointer || !inspecting)
        return;
    event.preventDefault();
    const before = gestureMetrics([...pointers.values()]);
    const dx = event.clientX - pointer.x;
    const dy = event.clientY - pointer.y;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    if (Math.hypot(pointer.x - pointer.startX, pointer.y - pointer.startY) > 7)
        pointer.dragged = true;
    const after = gestureMetrics([...pointers.values()]);
    if (before && after) {
        for (const active of pointers.values())
            active.dragged = true;
        const panX = after.center.x - before.center.x;
        const panY = after.center.y - before.center.y;
        if (panX || panY)
            arena.panBy(panX, panY, renderer.domElement.clientHeight);
        if (before.separation > 2 && after.separation > 2)
            arena.zoomBy(after.separation / before.separation);
    }
    else if (pointer.dragged) {
        arena.orbitBy(dx, dy);
    }
});
const endPointer = (event) => {
    const pointer = pointers.get(event.pointerId);
    if (!pointer)
        return;
    // When one finger of a pinch lifts, the remaining finger must never count as a tap.
    if (pointers.size > 1)
        for (const active of pointers.values())
            active.dragged = true;
    pointers.delete(event.pointerId);
    if (inspecting && event.type === 'pointerup' && !pointer.dragged) {
        const slot = arena.pickPart(event.clientX, event.clientY, renderer.domElement);
        selectPart(slot === selectedPart ? null : slot, slot !== null);
    }
};
renderer.domElement.addEventListener('pointerup', endPointer);
renderer.domElement.addEventListener('pointercancel', endPointer);
renderer.domElement.addEventListener('lostpointercapture', endPointer);
renderer.domElement.addEventListener('wheel', event => {
    if (!inspecting)
        return;
    event.preventDefault();
    arena.zoomBy(Math.exp(-event.deltaY * .0015));
}, { passive: false });
const appStandalone = () => window.matchMedia('(display-mode: standalone)').matches ||
    navigator.standalone === true;
function showAppGuide() {
    appMessage.textContent = appStandalone()
        ? 'You are running the standalone Home Screen app. Safari tabs are hidden.'
        : 'On iPhone: open the hosted game in Safari, tap Share → Add to Home Screen, leave Open as Web App enabled if offered, tap Add, then launch the MECH ARENA icon.';
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
        catch { /* iPhone Safari requires Home Screen web-app mode. */ }
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
const renderScales = [.55, .70, .85];
let renderScaleIndex = 1;
let renderScale = renderScales[renderScaleIndex];
let previousTime = performance.now();
let accumulator = 0;
let fps = 60;
let showColliders = false;
function syncInspectorLayout() {
    // The actual canvas bounds (not stale window dimensions) are the camera viewport.
    // This also handles landscape-left / landscape-right and Safari toolbar resizing.
    const rect = renderer.domElement.getBoundingClientRect();
    const panelRight = inspecting ? inspectionPanel.getBoundingClientRect().right - rect.left + 12 : 0;
    arena.setInspectorLayout(panelRight, rect.width, rect.height);
}
function resize() {
    const bounds = mount.getBoundingClientRect();
    const width = Math.max(1, Math.round(bounds.width));
    const height = Math.max(1, Math.round(bounds.height));
    arena.camera.aspect = width / height;
    arena.camera.updateProjectionMatrix();
    renderer.setSize(Math.floor(width * renderScale), Math.floor(height * renderScale), false);
    renderer.domElement.style.width = `${width}px`;
    renderer.domElement.style.height = `${height}px`;
    syncInspectorLayout();
}
window.addEventListener('resize', resize);
// Safari can settle the visual viewport a little after its orientation event.
window.visualViewport?.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => {
    resize();
    window.setTimeout(resize, 180);
});
resize();
function frame(now) {
    const frameDt = Math.min((now - previousTime) / 1000, MAX_FRAME_DT);
    previousTime = now;
    fps += ((1 / Math.max(frameDt, .0001)) - fps) * .06;
    const input = controls.sample();
    let steps = 0;
    if (!inspecting && rigConfig && appSheet.classList.contains('hidden') && document.visibilityState !== 'hidden') {
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
    speedEl.textContent = Math.hypot(rig.vx, rig.vz).toFixed(1);
    motionEl.textContent = rig.forwardSpeed < -.15 ? 'REV' : rig.forwardSpeed > .15 ? 'FWD' : 'IDLE';
    yawRateEl.textContent = Math.round(THREE.MathUtils.radToDeg(rig.yawRate)).toString();
    loadBar.style.transform = `scaleX(${rig.driveLoad.toFixed(3)})`;
    const degrees = Math.round(-THREE.MathUtils.radToDeg(input.lookYaw));
    lookHeadingEl.textContent = Math.abs(degrees) < 2 ? 'VIEW: FORWARD · CENTERED' :
        `VIEW: ${degrees > 0 ? 'RIGHT' : 'LEFT'} ${Math.abs(degrees)}° · MECH-RELATIVE`;
    if (!devPanel.classList.contains('hidden')) {
        devReadout.textContent = [
            `FPS       ${fps.toFixed(0)}`,
            `FIXED DT  ${(FIXED_DT * 1000).toFixed(2)} ms`,
            `STEPS     ${steps}${inspecting ? ' (PAUSED)' : ''}`,
            `POS X/Z   ${rig.x.toFixed(2)} / ${rig.z.toFixed(2)} m`,
            `FWD V     ${rig.forwardSpeed.toFixed(2)} m/s`,
            `LAT V     ${rig.lateralSpeed.toFixed(2)} m/s`,
            `YAW       ${THREE.MathUtils.radToDeg(rig.yaw).toFixed(1)}°`,
            `VIEW YAW  ${THREE.MathUtils.radToDeg(physicsYawToViewYaw(rig.yaw) + input.lookYaw).toFixed(1)}°`,
            `YAW RATE  ${THREE.MathUtils.radToDeg(rig.yawRate).toFixed(1)}°/s`,
            `ACCEL     ${rig.longitudinalAcceleration.toFixed(2)} m/s²`,
            `LOAD      ${(rig.driveLoad * 100).toFixed(0)}%`,
            `MASS      ${inspection.massKg.toLocaleString()} kg`,
            `POWER     ${inspection.powerUsedKw}/${inspection.powerAvailableKw} kW`,
            `FIELDED   ${inspection.ready ? 'YES (TRAINING)' : 'NO'}`,
            `ADAPTERS  ${inspection.adapters.length}`,
            `RENDER    ${Math.round(renderScale * 100)}%`,
        ].join('\n');
    }
    renderer.render(arena.scene, arena.camera);
    requestAnimationFrame(frame);
}
devToggle.addEventListener('click', () => devPanel.classList.toggle('hidden'));
resetRig.addEventListener('click', () => { rig = createRigState(); controls.recenterLook(); });
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
// Deliberately no save, purchasing, damage or firing yet: this is a build/inspection test.
requestAnimationFrame(frame);
