import * as THREE from 'three';
import { deriveRigConfig } from './assemblyPhysics.js';
import { soundEmpty, soundFire, soundImpact, soundReload } from './audio.js';
import { advanceWeapon, applyRecoil, applyTargetHit, createTargetCondition, createWeaponState, makeRangeTarget, fireWeapon, mirrorTargetCondition, reconcileTargetCondition, restoreTargetPart, shotSpread, startReload, weaponFor } from './combat.js';
import { equip, inspectAssembly, installedPart, makeTestAssembly, partsFor, remove, SLOTS, } from './components.js';
import { Controls } from './controls.js';
import { gestureMetrics } from './inspectionCamera.js';
import { createRigState, DEFAULT_WORLD, physicsYawToViewYaw, stepRig, } from './locomotion.js';
import { createArenaScene } from './scene.js';
import { createFunctionalDamage, damageInstalledPart, derateRigConfig, functionalOutput, resetInstalledDamage, weaponCycleMultiplier, weaponSpreadMultiplier, } from './functionalDamage.js';
import { driveCondition, repairInstalledPart } from './garage.js';
import { advanceHostileController, createHostileController, disabledReason, hostileAimSlot, hostileOutput, hostileSpread, } from './hostileRig.js';
const FIXED_DT = 1 / 60;
const MAX_FRAME_DT = 0.12;
const labels = {
    structure: 'STRUCTURE', mobility: 'MOBILITY', power: 'POWER',
    command: 'COMMAND', combat: 'COMBAT',
};
const symbols = { structure: '⬡', mobility: '⋀', power: 'ϟ', command: '◉', combat: '✦' };
const assembly = makeTestAssembly();
const damage = createFunctionalDamage();
// A different, stationary target built with the same module definitions.
const targetAssembly = makeRangeTarget();
let targetCondition = createTargetCondition(targetAssembly);
// Incoming fire uses the same localized armor/integrity representation, seeded from the owned player's current condition.
let playerCondition = createTargetCondition(assembly, true);
let weaponSpec = weaponFor(assembly);
let weaponState = weaponSpec ? createWeaponState(weaponSpec) : null;
const hostileWeaponSpec = weaponFor(targetAssembly);
let hostileWeaponState = hostileWeaponSpec ? createWeaponState(hostileWeaponSpec) : null;
let hostileController = createHostileController();
let testEnded = false;
let testEndReason = null;
const rangeWorld = {
    ...DEFAULT_WORLD,
    obstacles: [...DEFAULT_WORLD.obstacles,
        { id: 'stationary-target', minX: -1.0, maxX: 1.0, minZ: -.65, maxZ: .65 }],
};
let inspection = inspectAssembly(assembly);
let rigConfig = deriveRigConfig(assembly);
if (!rigConfig)
    throw new Error('Starting test rig must be fieldable.');
let output = functionalOutput(assembly, damage);
let effectiveConfig = derateRigConfig(rigConfig, output);
function updateFunctionalStatus() {
    output = functionalOutput(assembly, damage);
    if (rigConfig)
        effectiveConfig = derateRigConfig(rigConfig, output);
    const faults = [];
    if (output.left < .99)
        faults.push(`L DRIVE ${Math.round(output.left * 100)}%`);
    if (output.right < .99)
        faults.push(`R DRIVE ${Math.round(output.right * 100)}%`);
    if (output.power < .99)
        faults.push(`GENERATOR ${Math.round(output.power * 100)}%`);
    if (output.weapon < .99)
        faults.push(`WEAPON ${Math.round(output.weapon * 100)}%`);
    faultStrip.textContent = faults.length ? `⚠ ${faults.join(' · ')}` : 'SYSTEMS NOMINAL';
    faultStrip.classList.toggle('faulted', faults.length > 0);
}
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
const fireButton = required('#fire');
const reloadButton = required('#reload');
const weaponLabel = required('#weapon-label');
const ammoReadout = required('#ammo-count');
const shotReport = required('#shot-report');
const targetToggle = required('#target-toggle');
const targetPanel = required('#target-panel');
const targetReadout = required('#target-readout');
const resetTarget = required('#reset-target');
const rangeCrosshair = required('#center-crosshair');
const faultStrip = required('#fault-strip');
const renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = false;
renderer.domElement.className = 'game-canvas';
renderer.domElement.setAttribute('aria-label', '3D warehouse and mech');
renderer.domElement.style.touchAction = 'none';
mount.appendChild(renderer.domElement);
const arena = createArenaScene(assembly, targetAssembly);
let rig = createRigState();
const controls = new Controls(required('#drive-zone'), required('#drive-knob'), required('#look-zone'), required('#brake'));
let inspecting = false;
let selectedPart = null;
let statusTimeout = null;
let fireHeld = false;
let recoilFlash = 0;
let reportFade = 0;
let shotsFired = 0;
let lastHit = 'NO SHOTS YET';
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
    fieldStatus.classList.toggle('message', !!fieldStatus.dataset.message);
    fieldStatus.textContent = fieldStatus.dataset.message || (inspection.ready ? 'READY' : 'BLOCKED');
    fieldStatus.title = inspection.ready ? 'All five required functions are present.' : 'One or more required functions are missing or overloaded.';
}
function selectPart(slot, focus = true) {
    selectedPart = slot;
    arena.selectPart(slot);
    inspectionPanel.classList.toggle('expanded', slot !== null);
    // Clearing the highlight never steals the inspection camera from the pilot.
    if (focus && slot)
        arena.focusPart(slot);
    for (const [key, button] of selectionButtons) {
        button.classList.toggle('selected', key === slot);
        button.setAttribute('aria-pressed', String(key === slot));
    }
    renderPartInfo();
    if (inspecting)
        window.requestAnimationFrame(syncInspectorLayout);
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
    return `FIRING LOAD ${-part.powerKw} kW · LIVE-FIRE RANGE`;
}
function renderPartInfo() {
    partInfo.replaceChildren();
    if (!selectedPart) {
        partInfo.textContent = 'Tap a system icon to inspect the installed module, repair damage or choose another available part.';
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
        stats.textContent = `${fitted.definition.name}\nSERIAL ${fitted.instance.serial}\nMASS ${fitted.definition.massKg} kg\nCONDITION ${Math.round(fitted.instance.condition * 100)}% · REPAIRS ${fitted.instance.repairs} · WEAR ${Math.round(fitted.instance.wear * 100)}%`;
        const description = document.createElement('div');
        description.className = 'part-purpose';
        description.textContent = fitted.definition.description;
        const specs = document.createElement('div');
        specs.className = 'part-specs';
        specs.textContent = specLine(fitted.definition);
        partInfo.append(stats, specs, description);
        const meter = document.createElement('div');
        meter.className = `garage-condition ${fitted.instance.condition < .55 ? 'severe' : fitted.instance.condition < .99 ? 'damaged' : ''}`;
        meter.setAttribute('aria-label', `Component condition ${Math.round(fitted.instance.condition * 100)} percent`);
        const fill = document.createElement('i');
        fill.style.width = `${Math.max(0, Math.min(100, fitted.instance.condition * 100))}%`;
        meter.append(fill);
        partInfo.append(meter);
        const symptom = document.createElement('div');
        symptom.className = 'garage-symptom';
        const condition = fitted.instance.condition;
        if (selectedPart === 'mobility') {
            const sections = driveCondition(assembly, damage);
            symptom.textContent = sections
                ? `LEFT DRIVE ${Math.round(sections.left * 100)}% · RIGHT DRIVE ${Math.round(sections.right * 100)}% · uneven output pulls the rig under power.`
                : 'NO MOBILITY INSTALLED';
        }
        else if (selectedPart === 'power') {
            symptom.textContent = `GENERATOR OUTPUT ${output.powerAvailableKw.toFixed(0)} kW · DEMAND ${output.nominalDemandKw.toFixed(0)} kW${output.powerFactor < 1 ? ' · DRIVE POWER LIMITED' : ''}`;
        }
        else if (selectedPart === 'combat') {
            symptom.textContent = !output.weaponOperational ? 'WEAPON OFFLINE · INSUFFICIENT POWER OR INTERNAL DAMAGE' :
                output.weapon < .99 ? 'WEAPON DAMAGED · INCREASED SPREAD AND SLOWER CYCLE' : 'WEAPON READY · NO FUNCTIONAL DAMAGE';
        }
        else
            symptom.textContent = condition < .99
                ? 'COSMETIC / STRUCTURAL CONDITION ONLY · FUNCTIONAL CONSEQUENCES NOT YET MODELED' : 'NO RECORDED DAMAGE';
        partInfo.append(symptom);
        const repair = document.createElement('button');
        repair.type = 'button';
        repair.className = 'garage-repair';
        repair.disabled = condition >= 1 - 1e-6;
        repair.textContent = repair.disabled ? 'NO REPAIR REQUIRED' : `REPAIR ${labels[selectedPart]} · NO COST (TEST)`;
        repair.addEventListener('click', () => {
            if (!selectedPart)
                return;
            const result = repairInstalledPart(assembly, damage, selectedPart);
            if (result.repaired) {
                restoreTargetPart(playerCondition, assembly, selectedPart);
                arena.updatePilotDamage(playerCondition);
                testEndReason = disabledReason(playerCondition, functionalOutput(assembly, damage));
                updateFunctionalStatus();
                renderPartsList();
                renderPartInfo();
                renderChecks();
                showStatus(`${result.serial} REPAIRED · SAME PHYSICAL MODULE`);
                renderAmmo();
            }
        });
        partInfo.append(repair);
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
function moduleCondition(slot) {
    const fitted = installedPart(assembly, slot);
    if (!fitted)
        return null;
    if (slot === 'mobility') {
        const drive = driveCondition(assembly, damage);
        return drive ? Math.min(fitted.instance.condition, drive.left, drive.right) : fitted.instance.condition;
    }
    if (slot === 'power')
        return Math.min(fitted.instance.condition, output.power);
    if (slot === 'combat')
        return output.weaponOperational ? Math.min(fitted.instance.condition, output.weapon) : 0;
    return fitted.instance.condition;
}
function moduleStatus(slot) {
    const condition = moduleCondition(slot);
    if (condition === null)
        return 'missing';
    if (condition <= .05)
        return 'disabled';
    if (condition < .45)
        return 'severe';
    if (condition < .8)
        return 'degraded';
    return 'good';
}
function moduleStatusLabel(status) {
    return status === 'good' ? 'GOOD' : status === 'degraded' ? 'DEGRADED' :
        status === 'severe' ? 'DAMAGED' : status === 'disabled' ? 'DISABLED' : 'MISSING';
}
function renderPartsList() {
    selectionButtons.clear();
    partList.replaceChildren();
    for (const slot of SLOTS) {
        const fitted = installedPart(assembly, slot);
        const condition = moduleCondition(slot);
        const status = moduleStatus(slot);
        const button = document.createElement('button');
        button.type = 'button';
        button.className = `module-tab status-${status}`;
        button.setAttribute('aria-label', `${labels[slot]} · ${fitted?.definition.name ?? 'missing'} · ${moduleStatusLabel(status)}`);
        button.setAttribute('aria-pressed', String(slot === selectedPart));
        button.title = `${labels[slot]} · ${fitted?.definition.name ?? 'missing'} · ${moduleStatusLabel(status)}`;
        const glyph = document.createElement('span');
        glyph.className = 'module-glyph';
        glyph.textContent = symbols[slot];
        const category = document.createElement('small');
        category.textContent = labels[slot] === 'STRUCTURE' ? 'FRAME' : labels[slot] === 'MOBILITY' ? 'MOVE' : labels[slot] === 'COMMAND' ? 'CMD' : labels[slot] === 'COMBAT' ? 'ARMS' : 'PWR';
        const value = document.createElement('i');
        value.textContent = condition === null ? '—' : `${Math.round(condition * 100)}%`;
        button.append(glyph, category, value);
        button.classList.toggle('selected', slot === selectedPart);
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
    updateFunctionalStatus();
    const nextSpec = weaponFor(assembly);
    if (nextSpec?.id !== weaponSpec?.id)
        weaponState = nextSpec ? createWeaponState(nextSpec) : null;
    weaponSpec = nextSpec;
    arena.setPilotWeapon(weaponSpec);
    renderAmmo();
    reconcileTargetCondition(playerCondition, assembly);
    arena.rebuildAssembly(assembly);
    arena.updatePilotDamage(playerCondition);
    renderPartsList();
    renderChecks();
    renderPartInfo();
}
refreshAssembly();
selectPart(null, false);
function toggleInspection(force) {
    const requested = force ?? !inspecting;
    testEndReason = disabledReason(playerCondition, functionalOutput(assembly, damage));
    if (!requested && (!inspection.ready || testEndReason)) {
        showStatus(testEndReason ? `NOT READY · ${testEndReason} · REPAIR REQUIRED` : 'NOT READY · RESTORE ALL FIVE FUNCTIONS');
        return;
    }
    inspecting = requested;
    fireHeld = false;
    if (inspecting) {
        devPanel.classList.add('hidden');
        targetPanel.classList.add('hidden');
        targetToggle.setAttribute('aria-pressed', 'false');
        renderPartsList();
        renderPartInfo();
    }
    else {
        // Each deployment is a new training sortie. Owned damage persists; ammunition and
        // the automated range controller are reset for a clean test run.
        rig = createRigState();
        controls.recenterLook();
        weaponState = weaponSpec ? createWeaponState(weaponSpec) : null;
        hostileWeaponState = hostileWeaponSpec ? createWeaponState(hostileWeaponSpec) : null;
        hostileController = createHostileController();
        testEnded = false;
        testEndReason = null;
        updateFunctionalStatus();
        renderAmmo();
    }
    document.body.classList.toggle('inspecting', inspecting);
    inspectionPanel.classList.toggle('hidden', !inspecting);
    orbitHelp.classList.toggle('hidden', !inspecting);
    resetOrbitButton.classList.toggle('hidden', !inspecting);
    centerView.classList.toggle('hidden', inspecting);
    assemblyToggle.classList.toggle('pressed', inspecting);
    assemblyToggle.setAttribute('aria-pressed', String(inspecting));
    assemblyToggle.textContent = inspecting ? 'DEPLOY' : 'GARAGE';
    arena.setInspection(inspecting);
    if (inspecting) {
        arena.resetOrbit();
        syncInspectorLayout();
    }
    controls.setEnabled(!inspecting && !testEnded && appSheet.classList.contains('hidden'));
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
    fireHeld = false;
}
function hideAppGuide() {
    appSheet.classList.add('hidden');
    appSheet.setAttribute('aria-hidden', 'true');
    controls.setEnabled(!inspecting && !testEnded);
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
toggleInspection(true); // Garage is the home screen. Never begin in an uncontrolled live range.
function frame(now) {
    const frameDt = Math.min((now - previousTime) / 1000, MAX_FRAME_DT);
    previousTime = now;
    fps += ((1 / Math.max(frameDt, .0001)) - fps) * .06;
    const input = controls.sample();
    let steps = 0;
    if (!inspecting && rigConfig && appSheet.classList.contains('hidden') && document.visibilityState !== 'hidden') {
        accumulator += frameDt;
        while (accumulator >= FIXED_DT && steps < 8) {
            stepRig(rig, input, FIXED_DT, effectiveConfig, rangeWorld);
            if (weaponSpec && weaponState) {
                advanceWeapon(weaponState, weaponSpec, FIXED_DT);
                if (fireHeld)
                    attemptFire();
            }
            if (hostileWeaponSpec && hostileWeaponState) {
                advanceWeapon(hostileWeaponState, hostileWeaponSpec, FIXED_DT);
                if (hostileWeaponState.loaded <= 0 && hostileWeaponState.reloadLeft === 0 && hostileWeaponState.reserve > 0) {
                    startReload(hostileWeaponState, hostileWeaponSpec);
                }
                const hostileShot = advanceHostileController(hostileController, targetCondition, FIXED_DT, testEnded);
                if (hostileShot !== null)
                    attemptHostileFire(hostileShot);
            }
            accumulator -= FIXED_DT;
            steps++;
        }
        if (steps === 8)
            accumulator = 0;
    }
    else
        accumulator = 0;
    arena.updateRigVisual(rig, input.lookYaw, input.lookPitch, frameDt);
    arena.updateCombatEffects(frameDt);
    recoilFlash = Math.max(0, recoilFlash - frameDt);
    reportFade = Math.max(0, reportFade - frameDt);
    rangeCrosshair.classList.toggle('confirmed-hit', recoilFlash > 0);
    shotReport.classList.toggle('faded', reportFade === 0);
    renderAmmo();
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
            `POWER     ${output.powerAvailableKw.toFixed(0)}/${output.nominalDemandKw} kW effective`,
            `LEFT LEG  ${(output.left * 100).toFixed(0)}%`,
            `RIGHT LEG ${(output.right * 100).toFixed(0)}%`,
            `WEAPON    ${(output.weapon * 100).toFixed(0)}%`,
            `FIELDED   ${inspection.ready ? 'YES (TRAINING)' : 'NO'}`,
            `ADAPTERS  ${inspection.adapters.length}`,
            `RENDER    ${Math.round(renderScale * 100)}%`,
            `ROUNDS    ${weaponState?.loaded ?? 0}/${weaponState?.reserve ?? 0}`,
            `SHOTS     ${shotsFired}`,
            `TARGET    ${targetCondition.shotsHit} HITS`,
            `LAST HIT  ${lastHit}`,
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
// One tiny target-readout; diagnostic detail is available without covering the cockpit.
const targetLabels = {
    structure: 'HULL', mobility: 'LEGS', power: 'POWER', command: 'CAB', combat: 'WEAPON',
};
function renderAmmo() {
    weaponLabel.textContent = weaponSpec ? `${weaponSpec.label}${testEnded ? ' · TEST ENDED' : !output.weaponOperational ? ' · OFFLINE' : output.weapon < .95 ? ' · DAMAGED' : ''}` : 'NO WEAPON';
    ammoReadout.textContent = !weaponSpec || !weaponState ? '—' :
        weaponState.reloadLeft > 0 ? `RELOAD ${weaponState.reloadLeft.toFixed(1)}s` :
            `${weaponState.loaded} / ${weaponState.reserve}`;
    reloadButton.disabled = !weaponSpec || !weaponState || weaponState.loaded >= weaponSpec.magazine || weaponState.reserve === 0 || weaponState.reloadLeft > 0;
    fireButton.disabled = !weaponSpec || !weaponState || !inspection.ready || inspecting || testEnded || !output.weaponOperational || weaponState.reloadLeft > 0;
}
function renderTarget() {
    targetReadout.replaceChildren();
    for (const slot of SLOTS) {
        const part = targetCondition.parts[slot];
        const row = document.createElement('div');
        row.className = 'target-row';
        const label = document.createElement('span');
        label.textContent = `${targetLabels[slot]} · ${part.serial}`;
        const metrics = document.createElement('b');
        const percent = Math.ceil(part.integrity / part.maxIntegrity * 100);
        const consequence = slot === 'mobility' ? ` · DRIVE ${percent}%` :
            slot === 'power' ? ` · GEN ${percent}%` :
                slot === 'combat' ? ` · GUN ${percent > 12 ? 'ACTIVE' : 'OFFLINE'}` : '';
        metrics.textContent = `${percent}% · ARM ${Math.ceil(part.armor)}${consequence}`;
        const bar = document.createElement('i');
        bar.style.transform = `scaleX(${part.integrity / part.maxIntegrity})`;
        if (!part.integrity)
            row.classList.add('target-disabled');
        row.append(label, metrics, bar);
        targetReadout.append(row);
    }
}
function attemptHostileFire(shotIndex) {
    if (!hostileWeaponSpec || !hostileWeaponState || inspecting || testEnded || !appSheet.classList.contains('hidden'))
        return;
    const hostile = hostileOutput(targetCondition);
    if (!hostile.operational)
        return;
    const consumed = fireWeapon(hostileWeaponState, hostileWeaponSpec);
    if (consumed === null)
        return;
    // The test controller is intentionally slower than the weapon's raw cyclic rate.
    hostileWeaponState.cooldown = Math.max(hostileWeaponState.cooldown, hostile.triggerSeconds * .55);
    const [spreadX, spreadY] = hostileSpread(shotIndex, hostile.spreadRadians);
    const aimSlot = hostileAimSlot(shotIndex);
    const contact = arena.traceHostileShot(rig, aimSlot, spreadX, spreadY);
    soundFire();
    if (contact.slot === null) {
        arena.showHostileShot(contact, null);
        return;
    }
    const partBefore = playerCondition.parts[contact.slot];
    const beforeIntegrity = partBefore.integrity;
    const hit = applyTargetHit(playerCondition, contact.slot, hostileWeaponSpec.damage);
    if (hit.internalDamage > 0) {
        const amount = hit.internalDamage / Math.max(1, partBefore.maxIntegrity);
        if (contact.slot === 'mobility')
            damageInstalledPart(assembly, damage, 'mobility', amount, contact.driveSide ?? 'left');
        else
            damageInstalledPart(assembly, damage, contact.slot, amount);
        // Paired mobility stores side damage in FunctionalDamage; the owned assembly condition is the authoritative average.
        const installed = installedPart(assembly, contact.slot);
        if (installed)
            playerCondition.parts[contact.slot].integrity = playerCondition.parts[contact.slot].maxIntegrity * installed.instance.condition;
    }
    const nowDisabled = playerCondition.parts[contact.slot].integrity <= 0;
    arena.showHostileShot(contact, { ...hit, disabled: nowDisabled, justDisabled: beforeIntegrity > 0 && nowDisabled });
    arena.updatePilotDamage(playerCondition);
    soundImpact();
    rig.impact = Math.min(1, rig.impact + .65);
    updateFunctionalStatus();
    renderPartsList();
    renderPartInfo();
    renderAmmo();
    testEndReason = disabledReason(playerCondition, output);
    if (testEndReason) {
        testEnded = true;
        fireHeld = false;
        controls.setEnabled(false);
        faultStrip.textContent = `RIG DISABLED · ${testEndReason}`;
        faultStrip.classList.add('faulted');
        shotReport.classList.remove('faded');
        shotReport.classList.add('disabled-part');
        shotReport.textContent = `TEST ENDED · ${testEndReason} · RETURN TO GARAGE`;
        reportFade = 9999;
    }
}
function attemptFire() {
    if (!weaponSpec || !weaponState || !rigConfig || inspecting || testEnded || !inspection.ready || !output.weaponOperational || !appSheet.classList.contains('hidden'))
        return;
    const shot = fireWeapon(weaponState, weaponSpec);
    if (shot === null) {
        if (weaponState.loaded <= 0 && weaponState.reloadLeft === 0) {
            if (startReload(weaponState, weaponSpec))
                soundReload();
            else {
                soundEmpty();
                fireHeld = false;
            }
        }
        renderAmmo();
        return;
    }
    weaponState.cooldown *= weaponCycleMultiplier(output);
    const [spreadX, spreadY] = shotSpread(shot, weaponSpec.spread * weaponSpreadMultiplier(output));
    const contact = arena.traceShot(spreadX, spreadY, weaponSpec.muzzleZ);
    const directionX = (contact.point.x - contact.muzzle.x) / Math.max(contact.distance, .001);
    const directionZ = (contact.point.z - contact.muzzle.z) / Math.max(contact.distance, .001);
    applyRecoil(rig, effectiveConfig, directionX, directionZ, weaponSpec.recoilImpulseNs);
    shotsFired++;
    soundFire();
    if (contact.slot !== null) {
        const beforeIntegrity = targetCondition.parts[contact.slot].integrity;
        const hit = applyTargetHit(targetCondition, contact.slot, weaponSpec.damage);
        const visualHit = { ...hit, justDisabled: beforeIntegrity > 0 && hit.disabled };
        arena.showShot(contact, visualHit);
        mirrorTargetCondition(targetAssembly, targetCondition);
        arena.updateTargetDamage(targetCondition);
        soundImpact();
        recoilFlash = .19;
        lastHit = `${targetLabels[hit.slot]} · ${hit.serial}`;
        shotReport.classList.toggle('penetrated', hit.internalDamage > 0);
        shotReport.classList.toggle('disabled-part', hit.disabled);
        const outcome = hit.disabled ? 'MODULE DISABLED' : hit.internalDamage > 0 ? 'ARMOR BREACHED' : 'ARMOR IMPACT';
        shotReport.textContent = `${outcome} · ${lastHit} · ARMOR −${hit.armorAbsorbed} · INTERNAL −${hit.internalDamage}`;
        renderTarget();
    }
    else {
        arena.showShot(contact, null);
        lastHit = 'RANGE SURFACE / MISS';
        shotReport.classList.remove('penetrated', 'disabled-part');
        shotReport.textContent = 'NO TARGET HIT · ADJUST AIM';
    }
    reportFade = 2.2;
    renderAmmo();
}
fireButton.addEventListener('pointerdown', event => {
    if (inspecting)
        return;
    event.preventDefault();
    fireButton.setPointerCapture(event.pointerId);
    fireHeld = true;
    attemptFire(); // A quick tap must fire even if it ends before the next animation frame.
});
const endFire = () => { fireHeld = false; };
fireButton.addEventListener('pointerup', endFire);
fireButton.addEventListener('pointercancel', endFire);
fireButton.addEventListener('lostpointercapture', endFire);
fireButton.addEventListener('click', event => {
    if (event.detail === 0)
        attemptFire(); // keyboard accessibility
});
window.addEventListener('keydown', event => {
    if (event.code === 'KeyF' && !event.repeat) {
        fireHeld = true;
        attemptFire();
    }
    if (event.code === 'KeyR' && weaponState && weaponSpec && !event.repeat) {
        if (startReload(weaponState, weaponSpec))
            soundReload();
    }
});
window.addEventListener('keyup', event => { if (event.code === 'KeyF')
    endFire(); });
window.addEventListener('blur', endFire);
reloadButton.addEventListener('click', () => {
    if (weaponState && weaponSpec && startReload(weaponState, weaponSpec))
        soundReload();
    renderAmmo();
});
targetToggle.addEventListener('click', () => {
    const isOpen = targetPanel.classList.toggle('hidden') === false;
    targetToggle.setAttribute('aria-pressed', String(isOpen));
});
resetTarget.addEventListener('click', () => {
    targetCondition = createTargetCondition(targetAssembly);
    mirrorTargetCondition(targetAssembly, targetCondition);
    hostileWeaponState = hostileWeaponSpec ? createWeaponState(hostileWeaponSpec) : null;
    hostileController = createHostileController(.7);
    arena.resetTargetDamage(targetCondition);
    lastHit = 'HOSTILE RIG REBUILT';
    shotReport.textContent = 'HOSTILE RIG RESET · ARMOR AND COMPONENTS RESTORED';
    reportFade = 2;
    renderTarget();
});
// Direct internal-damage injections: intentionally DEV-only, without implementing
// enemy fire, armor penetration against the player, or a pretend repair economy.
for (const button of document.querySelectorAll('[data-damage]')) {
    button.addEventListener('click', () => {
        const type = button.dataset.damage;
        let touched = null;
        if (type === 'restore') {
            resetInstalledDamage(assembly, damage);
            for (const slot of SLOTS)
                restoreTargetPart(playerCondition, assembly, slot);
        }
        else if (type === 'left' || type === 'right') {
            damageInstalledPart(assembly, damage, 'mobility', .25, type);
            touched = 'mobility';
        }
        else if (type === 'power' || type === 'weapon') {
            touched = type === 'power' ? 'power' : 'combat';
            damageInstalledPart(assembly, damage, touched, .25);
        }
        if (touched) {
            const installed = installedPart(assembly, touched);
            if (installed)
                playerCondition.parts[touched].integrity = playerCondition.parts[touched].maxIntegrity * installed.instance.condition;
        }
        arena.updatePilotDamage(playerCondition);
        updateFunctionalStatus();
        renderAmmo();
        renderPartInfo();
        renderPartsList();
    });
}
updateFunctionalStatus();
renderAmmo();
renderTarget();
// Stage e.2: compact category-based garage UI over the same in-session repair/assembly mechanics.
requestAnimationFrame(frame);
