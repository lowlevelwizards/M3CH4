from pathlib import Path


def replace(path, old, new, count=-1):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'missing expected text in {path}: {old[:140]!r}')
    p.write_text(text.replace(old, new, count))


index = Path('index.html')
if '0.0.1k.3j.0' in index.read_text():
    print('k.3j.0 already applied')
    raise SystemExit(0)

# main.js: one recoverable weapon fault, stationary hold-to-service, and clean
# mission-kill resolution. Everything else remains on the existing combat loop.
replace('main.js',
    "import { damageInstalledPart, derateRigConfig, functionalOutput, resetInstalledDamage, weaponCycleMultiplier, weaponSpreadMultiplier, } from './functionalDamage.js';",
    "import { damageInstalledPart, derateRigConfig, functionalOutput, resetInstalledDamage, weaponCycleMultiplier, weaponSpreadMultiplier, } from './functionalDamage.js';\nimport { FIELD_SERVICE_SECONDS, advanceFieldService, arrestFirstWeaponFailure, beginFieldService, cancelFieldService, canFieldService, createFieldServiceState, fieldServiceStationary, weaponFailureState, weaponIntegrityRatio, weaponMissionKillReason, } from './fieldService.js';")
replace('main.js',
    "import { advanceHostileController, createHostileController, disabledReason, hostileAimSlot, hostileOutput, hostileSpread, } from './hostileRig.js';",
    "import { advanceHostileController, createHostileController, disabledReason, hostileAimSlot, hostileMissionKillReason, hostileOutput, hostileSpread, } from './hostileRig.js';")
replace('main.js',
    "let sortieRoundsFired = 0;",
    "let sortieRoundsFired = 0;\nlet fieldService = createFieldServiceState();\nlet servicePointerId = null;\nlet serviceKeyHeld = false;")
replace('main.js',
    "let effectiveConfig = derateRigConfig(rigConfig, output);\nfunction updateFunctionalStatus() {",
    """let effectiveConfig = derateRigConfig(rigConfig, output);
function syncOwnedWeaponCondition(addWear = false) {
    const installed = installedPart(assembly, 'combat');
    const part = playerCondition.parts.combat;
    if (!installed || !part)
        return;
    installed.instance.condition = weaponIntegrityRatio(playerCondition);
    if (addWear)
        installed.instance.wear = Math.min(1, (Number(installed.instance.wear) || 0) + .08);
}
function currentSortieFailureReason() {
    return disabledReason(playerCondition, functionalOutput(assembly, damage)) ??
        weaponMissionKillReason(playerCondition, fieldService);
}
function deploymentBlockReason() {
    const current = functionalOutput(assembly, damage);
    return disabledReason(playerCondition, current) ?? (!current.weaponOperational ? 'WEAPON OFFLINE' : null);
}
function updateFunctionalStatus() {""")
replace('main.js',
    "    if (output.weapon < .99)\n        faults.push(`WEAPON ${Math.round(output.weapon * 100)}%`);",
    """    const weaponFailure = weaponFailureState(playerCondition, fieldService);
    if (weaponFailure === 'faulted')
        faults.push('WEAPON FAULT · FIELD SERVICE AVAILABLE');
    else if (weaponFailure === 'destroyed' || weaponFailure === 'unrecoverable')
        faults.push('WEAPON LOST');
    else if (output.weapon < .99)
        faults.push(`WEAPON ${Math.round(output.weapon * 100)}%`);""")
replace('main.js',
    "function showStatus(message) {",
    """function stopFieldServiceInput() {
    const captured = servicePointerId;
    servicePointerId = null;
    serviceKeyHeld = false;
    cancelFieldService(fieldService);
    reloadButton.classList.remove('servicing');
    if (captured !== null && reloadButton.hasPointerCapture(captured))
        reloadButton.releasePointerCapture(captured);
}
function showStatus(message) {""")
replace('main.js',
    "    testEndReason = disabledReason(playerCondition, functionalOutput(assembly, damage));\n    if (!requested && (!inspection.ready || testEndReason)) {",
    "    testEndReason = deploymentBlockReason();\n    if (!requested && (!inspection.ready || testEndReason)) {")
replace('main.js',
    "    inspecting = requested;\n    stopFireInput();",
    "    inspecting = requested;\n    stopFireInput();\n    stopFieldServiceInput();")
replace('main.js',
    "        hostileController = createHostileController();\n        sortieRoundsFired = 0;",
    "        hostileController = createHostileController();\n        fieldService = createFieldServiceState();\n        sortieRoundsFired = 0;")
replace('main.js',
    """            if (Math.abs(followSteer) > .001) {
                controls.compensateBodyTurn(rig.yaw - yawBefore);
                input = controls.sample();
            }
            placeMovingObstacle(pilotObstacle, rig.x, rig.z, 1);""",
    """            if (Math.abs(followSteer) > .001) {
                controls.compensateBodyTurn(rig.yaw - yawBefore);
                input = controls.sample();
            }
            const serviceStep = advanceFieldService(playerCondition, fieldService, rig, FIXED_DT);
            if (serviceStep.event === 'completed')
                handleFieldServiceCompleted();
            else if (serviceStep.event === 'interrupted')
                handleFieldServiceInterrupted();
            placeMovingObstacle(pilotObstacle, rig.x, rig.z, 1);""")
replace('main.js',
    "            `WEAPON    ${(output.weapon * 100).toFixed(0)}%`,",
    "            `WEAPON    ${(output.weapon * 100).toFixed(0)}%`,\n            `FIELD SVC ${fieldService.used ? 'SPENT' : fieldService.held ? `${Math.round(fieldService.progress / FIELD_SERVICE_SECONDS * 100)}%` : canFieldService(playerCondition, fieldService) ? 'READY' : '—'}`,")

old_render_ammo = """function renderAmmo() {
    weaponLabel.textContent = weaponSpec ? `${weaponSpec.label}${testEnded ? ' · SORTIE ENDED' : !output.weaponOperational ? ' · OFFLINE' : output.weapon < .95 ? ' · DAMAGED' : ''}` : 'NO WEAPON';
    ammoReadout.textContent = !weaponSpec || !weaponState ? '—' :
        weaponState.reloadLeft > 0 ? `RELOAD ${weaponState.reloadLeft.toFixed(1)}s` :
            `${weaponState.loaded} / ${weaponState.reserve}`;
    reloadButton.disabled = !weaponSpec || !weaponState || weaponState.loaded >= weaponSpec.magazine || weaponState.reserve === 0 || weaponState.reloadLeft > 0;
    // Preserve touch capture if an empty magazine starts reloading during a held
    // FIRE drag. Aim remains usable; the weapon itself still refuses to fire.
    fireButton.disabled = !weaponSpec || !weaponState || !inspection.ready || inspecting || testEnded || !output.weaponOperational ||
        (weaponState.reloadLeft > 0 && firePointerId === null);
}"""
new_render_ammo = """function handleFieldServiceCompleted() {
    syncOwnedWeaponCondition(true);
    if (weaponState) {
        weaponState.reloadLeft = 0;
        weaponState.cooldown = Math.max(weaponState.cooldown, .55);
    }
    updateFunctionalStatus();
    arena.updatePilotDamage(playerCondition);
    renderPartsList();
    renderPartInfo();
    soundReload();
    shotReport.classList.remove('faded', 'disabled-part');
    shotReport.classList.add('penetrated');
    shotReport.textContent = 'FIELD SERVICE COMPLETE · WEAPON BYPASS ONLINE · 20% CONDITION';
    reportFade = 3.2;
    persistMachine();
}
function handleFieldServiceInterrupted() {
    shotReport.classList.remove('faded', 'penetrated');
    shotReport.classList.add('disabled-part');
    shotReport.textContent = 'FIELD SERVICE INTERRUPTED · STOP COMPLETELY AND HOLD';
    reportFade = 1.8;
}
function renderAmmo() {
    const failure = weaponFailureState(playerCondition, fieldService);
    const serviceAvailable = canFieldService(playerCondition, fieldService);
    const stationary = fieldServiceStationary(rig);
    const suffix = testEnded ? ' · SORTIE ENDED' :
        failure === 'destroyed' ? ' · DESTROYED' :
        failure === 'unrecoverable' ? ' · FAULT · BYPASS SPENT' :
        failure === 'faulted' ? ' · FAULTED' :
        output.weapon < .95 ? ' · DAMAGED' : '';
    weaponLabel.textContent = weaponSpec ? `${weaponSpec.label}${suffix}` : 'NO WEAPON';
    ammoReadout.textContent = !weaponSpec || !weaponState ? '—' :
        serviceAvailable ? `FAULT ${Math.round(weaponIntegrityRatio(playerCondition) * 100)}%` :
        weaponState.reloadLeft > 0 ? `RELOAD ${weaponState.reloadLeft.toFixed(1)}s` :
            `${weaponState.loaded} / ${weaponState.reserve}`;
    if (serviceAvailable) {
        const percent = Math.round(fieldService.progress / FIELD_SERVICE_SECONDS * 100);
        reloadButton.textContent = fieldService.held ? `FIELD SERVICE ${percent}%` : stationary ? 'HOLD FIELD SERVICE' : 'STOP TO FIELD SERVICE';
        reloadButton.disabled = inspecting || testEnded || !stationary;
        reloadButton.classList.toggle('servicing', fieldService.held);
    }
    else {
        reloadButton.textContent = 'RELOAD';
        reloadButton.classList.remove('servicing');
        reloadButton.disabled = !weaponSpec || !weaponState || weaponState.loaded >= weaponSpec.magazine || weaponState.reserve === 0 || weaponState.reloadLeft > 0;
    }
    // Preserve touch capture if an empty magazine starts reloading during a held
    // FIRE drag. Aim remains usable; the weapon itself still refuses to fire.
    fireButton.disabled = !weaponSpec || !weaponState || !inspection.ready || inspecting || testEnded || !output.weaponOperational ||
        (weaponState.reloadLeft > 0 && firePointerId === null);
}"""
replace('main.js', old_render_ammo, new_render_ammo)
replace('main.js',
    "    debriefTitle.textContent = summary.victory ? 'CONTRACT CLEARED' : 'RIG RECOVERED';",
    "    debriefTitle.textContent = summary.victory ? 'CONTRACT CLEARED' : 'MISSION KILL';")
replace('main.js',
    """    testEndReason = victory ? null : reason;
    stopFireInput();
    controls.setEnabled(false);""",
    """    testEndReason = victory ? null : reason;
    stopFireInput();
    stopFieldServiceInput();
    controls.setEnabled(false);""")
replace('main.js',
    """    faultStrip.textContent = victory ? 'CONTRACT CLEARED · HOSTILE COMBAT CAPABILITY LOST' : `RIG DISABLED · ${reason}`;
    faultStrip.classList.toggle('faulted', !victory);
    shotReport.classList.remove('faded');
    shotReport.classList.toggle('disabled-part', !victory);
    shotReport.classList.toggle('penetrated', victory);
    shotReport.textContent = victory ? 'SORTIE COMPLETE · CONTRACT CLEARED · ACCOUNTING READY' : `SORTIE ENDED · ${reason} · RECOVERY CREW DISPATCHED`;""",
    """    faultStrip.textContent = victory ? `CONTRACT CLEARED · HOSTILE MISSION KILL · ${reason}` : `MISSION KILL · ${reason}`;
    faultStrip.classList.toggle('faulted', !victory);
    shotReport.classList.remove('faded');
    shotReport.classList.toggle('disabled-part', !victory);
    shotReport.classList.toggle('penetrated', victory);
    shotReport.textContent = victory ? `SORTIE COMPLETE · HOSTILE MISSION KILL · ${reason}` : `SORTIE ENDED · MISSION KILL · ${reason} · RECOVERY CREW DISPATCHED`;""")
replace('main.js',
    """    soundFire();
    const partBefore = playerCondition.parts[contact.slot];
    const beforeIntegrity = partBefore.integrity;
    const hit = applyTargetHit(playerCondition, contact.slot, hostileWeaponSpec.damage);""",
    """    soundFire();
    stopFieldServiceInput(); // Any incoming hit interrupts an exposed emergency procedure.
    const partBefore = playerCondition.parts[contact.slot];
    const beforeIntegrity = partBefore.integrity;
    const hit = applyTargetHit(playerCondition, contact.slot, hostileWeaponSpec.damage);""")
replace('main.js',
    """    const nowDisabled = playerCondition.parts[contact.slot].integrity <= 0;
    arena.showHostileShot(contact, { ...hit, disabled: nowDisabled, justDisabled: beforeIntegrity > 0 && nowDisabled });""",
    """    let weaponFaulted = false;
    if (contact.slot === 'combat') {
        weaponFaulted = arrestFirstWeaponFailure(playerCondition, fieldService, beforeIntegrity);
        if (weaponFaulted)
            syncOwnedWeaponCondition(false);
    }
    const nowDisabled = playerCondition.parts[contact.slot].integrity <= 0;
    arena.showHostileShot(contact, { ...hit, disabled: nowDisabled, justDisabled: beforeIntegrity > 0 && nowDisabled });""")
replace('main.js',
    """    renderPartInfo();
    renderAmmo();
    testEndReason = disabledReason(playerCondition, output);
    if (testEndReason)
        finishSortie(false, testEndReason);""",
    """    renderPartInfo();
    renderAmmo();
    if (weaponFaulted) {
        shotReport.classList.remove('faded', 'penetrated');
        shotReport.classList.add('disabled-part');
        shotReport.textContent = 'WEAPON FAULT · EMERGENCY BYPASS AVAILABLE · STOP BEHIND COVER AND HOLD FIELD SERVICE';
        reportFade = 5.0;
    }
    testEndReason = currentSortieFailureReason();
    if (testEndReason)
        finishSortie(false, testEndReason);""")
replace('main.js',
    """        if (!hostileOutput(targetCondition).operational) {
            finishSortie(true, 'HOSTILE COMBAT CAPABILITY LOST');
            return;
        }""",
    """        const hostileKill = hostileMissionKillReason(targetCondition);
        if (hostileKill) {
            finishSortie(true, hostileKill);
            return;
        }""")

old_keys = """window.addEventListener('keydown', event => {
    if (event.code === 'KeyF' && !event.repeat && !inspecting && !testEnded) {
        fireKeyHeld = true;
        fireHeld = true;
        attemptFire();
    }
    if (event.code === 'KeyR' && weaponState && weaponSpec && !event.repeat) {
        if (startReload(weaponState, weaponSpec))
            soundReload();
    }
});
window.addEventListener('keyup', event => {
    if (event.code === 'KeyF') {
        fireKeyHeld = false;
        fireHeld = firePointerId !== null;
    }
});
window.addEventListener('blur', stopFireInput);
reloadButton.addEventListener('click', () => {
    if (weaponState && weaponSpec && startReload(weaponState, weaponSpec))
        soundReload();
    renderAmmo();
});"""
new_keys = """window.addEventListener('keydown', event => {
    if (event.code === 'KeyF' && !event.repeat && !inspecting && !testEnded) {
        fireKeyHeld = true;
        fireHeld = true;
        attemptFire();
    }
    if (event.code === 'KeyR' && weaponState && weaponSpec && !event.repeat) {
        if (canFieldService(playerCondition, fieldService)) {
            if (beginFieldService(playerCondition, fieldService, rig)) {
                serviceKeyHeld = true;
                soundReload();
                shotReport.textContent = 'FIELD SERVICE STARTED · HOLD STILL';
                reportFade = 5;
            }
        }
        else if (startReload(weaponState, weaponSpec))
            soundReload();
    }
});
window.addEventListener('keyup', event => {
    if (event.code === 'KeyF') {
        fireKeyHeld = false;
        fireHeld = firePointerId !== null;
    }
    if (event.code === 'KeyR' && serviceKeyHeld) {
        serviceKeyHeld = false;
        if (fieldService.held)
            cancelFieldService(fieldService);
    }
});
window.addEventListener('blur', () => {
    stopFireInput();
    stopFieldServiceInput();
});
reloadButton.addEventListener('pointerdown', event => {
    if (canFieldService(playerCondition, fieldService)) {
        if (!beginFieldService(playerCondition, fieldService, rig)) {
            renderAmmo();
            return;
        }
        event.preventDefault();
        servicePointerId = event.pointerId;
        reloadButton.setPointerCapture(event.pointerId);
        soundReload();
        shotReport.classList.remove('faded', 'penetrated');
        shotReport.classList.add('disabled-part');
        shotReport.textContent = 'FIELD SERVICE STARTED · HOLD STILL · RELEASE OR MOVE TO ABORT';
        reportFade = 5;
        renderAmmo();
        return;
    }
    if (weaponState && weaponSpec && startReload(weaponState, weaponSpec))
        soundReload();
    renderAmmo();
});
const endServicePointer = event => {
    if (event.pointerId !== servicePointerId)
        return;
    servicePointerId = null;
    if (fieldService.held)
        cancelFieldService(fieldService);
    renderAmmo();
};
reloadButton.addEventListener('pointerup', endServicePointer);
reloadButton.addEventListener('pointercancel', endServicePointer);
reloadButton.addEventListener('lostpointercapture', endServicePointer);
reloadButton.addEventListener('click', event => {
    if (event.detail === 0 && !canFieldService(playerCondition, fieldService)) {
        if (weaponState && weaponSpec && startReload(weaponState, weaponSpec))
            soundReload();
        renderAmmo();
    }
});"""
replace('main.js', old_keys, new_keys)

# index.html: cache-bust the new module and changed runtime files, and expose version.
replace('index.html',
    '    "./functionalDamage.js": "./functionalDamage.js?v=g11",',
    '    "./functionalDamage.js": "./functionalDamage.js?v=g11",\n    "./fieldService.js": "./fieldService.js?v=k3j0",')
replace('index.html',
    '    "./hostileRig.js": "./hostileRig.js?v=k3g0",',
    '    "./hostileRig.js": "./hostileRig.js?v=k3j0",')
replace('index.html',
    '<title>MECH ARENA — 0.0.1k.3i.0 — Beginner Arena</title>',
    '<title>MECH ARENA — 0.0.1k.3j.0 — Emergency Recovery</title>')
replace('index.html',
    '<header>RIG DIAGNOSTICS <span>0.0.1k.3i.0</span></header>',
    '<header>RIG DIAGNOSTICS <span>0.0.1k.3j.0</span></header>')
replace('index.html',
    '<script type="module" src="./main.js?v=k3i0"></script>',
    '<script type="module" src="./main.js?v=k3j0"></script>')

print('applied k.3j.0 integration')
