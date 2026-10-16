from pathlib import Path


def replace(path, old, new, count=-1):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'missing expected text in {path}: {old[:180]!r}')
    p.write_text(text.replace(old, new, count))


def replace_between(path, start, end, new):
    p = Path(path)
    text = p.read_text()
    i = text.find(start)
    if i < 0:
        raise SystemExit(f'missing block start in {path}: {start!r}')
    j = text.find(end, i)
    if j < 0:
        raise SystemExit(f'missing block end in {path}: {end!r}')
    p.write_text(text[:i] + new + text[j:])


# Navigation must collide with moving rigs without treating them as permanent maze walls.
replace('enemyMotion.js',
    "        if (o.id === skipId || o.id === 'pilot-rig' || o.id === 'hostile-rig')\n            continue;",
    "        if (o.id === skipId || o.id === 'pilot-rig' || o.id === 'hostile-rig' || o.dynamic)\n            continue;")

# sceneAssembly must fetch the new base renderer rather than its k.3i cached copy.
replace('sceneAssembly.js', "./scene.js?source=k3i0", "./scene.js?source=k3k0")

# --- scene.js: generic squad visuals/raycasting over the existing player + primary target renderer.
replace('scene.js',
    """    for (const mesh of targetExterior.pickMeshes) {
        const material = mesh.material;
        if (material instanceof THREE.MeshStandardMaterial)
            targetColors.set(mesh, material.color.clone());
    }
    // 0.0.1f:""",
    """    for (const mesh of targetExterior.pickMeshes) {
        mesh.userData.actorId = 'enemy-0';
        const material = mesh.material;
        if (material instanceof THREE.MeshStandardMaterial)
            targetColors.set(mesh, material.color.clone());
    }
    const squadCombatants = new Map();
    function makeSquadMarker(team) {
        const geometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(-.72, -.72, 0), new THREE.Vector3(.72, -.72, 0),
            new THREE.Vector3(.72, .72, 0), new THREE.Vector3(-.72, .72, 0),
        ]);
        const material = new THREE.LineBasicMaterial({
            color: team === 'friendly' ? 0x73e29a : 0xf0a05d,
            transparent: true, opacity: .92, depthTest: true, depthWrite: false,
        });
        const marker = new THREE.LineLoop(geometry, material);
        marker.frustumCulled = false;
        marker.renderOrder = 8;
        scene.add(marker);
        return marker;
    }
    const primaryMarker = makeSquadMarker('hostile');
    squadCombatants.set('enemy-0', {
        id: 'enemy-0', team: 'hostile', assembly: targetAssembly, exterior: targetExterior,
        colors: targetColors, marker: primaryMarker, active: true,
    });
    function colorsFor(exterior) {
        const colors = new WeakMap();
        for (const mesh of exterior.pickMeshes) {
            const material = mesh.material;
            if (material instanceof THREE.MeshStandardMaterial)
                colors.set(mesh, material.color.clone());
        }
        return colors;
    }
    function addCombatant(id, assembly, team, spawn) {
        if (!id || id === 'player' || squadCombatants.has(id))
            throw new Error(`Invalid or duplicate squad combatant: ${id}`);
        const actorExterior = buildExteriorRig(assembly);
        actorExterior.root.position.set(spawn.x, 0, spawn.z);
        actorExterior.root.rotation.y = physicsYawToViewYaw(spawn.yaw ?? 0);
        for (const mesh of actorExterior.pickMeshes)
            mesh.userData.actorId = id;
        scene.add(actorExterior.root);
        const record = {
            id, team, assembly, exterior: actorExterior, colors: colorsFor(actorExterior),
            marker: makeSquadMarker(team), active: true,
        };
        squadCombatants.set(id, record);
        return record;
    }
    function setCombatantActive(id, active) {
        const record = squadCombatants.get(id);
        if (!record) return;
        record.active = !!active;
        record.marker.material.opacity = record.active ? .92 : .22;
        record.marker.scale.setScalar(record.active ? 1 : .78);
    }
    function updateSquadMarkers() {
        for (const record of squadCombatants.values()) {
            record.marker.visible = !inspecting;
            if (inspecting) continue;
            const point = new THREE.Vector3();
            record.exterior.root.getWorldPosition(point);
            point.y += 3.55;
            record.marker.position.copy(point);
            record.marker.quaternion.copy(camera.quaternion);
        }
    }
    function hostilePickMeshes() {
        const meshes = [];
        for (const record of squadCombatants.values()) {
            if (record.team === 'hostile' && record.active)
                meshes.push(...record.exterior.pickMeshes);
        }
        return meshes;
    }
    // 0.0.1f:""")

replace('scene.js',
    """    let exterior = buildExteriorRig(initial);
    scene.add(exterior.root);""",
    """    let exterior = buildExteriorRig(initial);
    for (const mesh of exterior.pickMeshes)
        mesh.userData.actorId = 'player';
    scene.add(exterior.root);""")

replace('scene.js',
    """        exterior = buildExteriorRig(assembly);
        pilotColors = captureColors(exterior.pickMeshes);""",
    """        exterior = buildExteriorRig(assembly);
        for (const mesh of exterior.pickMeshes)
            mesh.userData.actorId = 'player';
        pilotColors = captureColors(exterior.pickMeshes);""")

replace('scene.js',
    """        else {
            camera.position.set(visualX, 2.42 + cockpitHeave, visualZ);
            camera.rotation.set(lookPitch + cockpitPitch * 0.35, renderYaw + lookYaw, cockpitRoll * 0.25, 'YXZ');
        }
    }
    function updateTargetRigVisual(state) {""",
    """        else {
            camera.position.set(visualX, 2.42 + cockpitHeave, visualZ);
            camera.rotation.set(lookPitch + cockpitPitch * 0.35, renderYaw + lookYaw, cockpitRoll * 0.25, 'YXZ');
        }
        updateSquadMarkers();
    }
    function updateCombatantRig(id, state) {
        const record = squadCombatants.get(id);
        if (!record) return;
        record.exterior.root.position.set(state.x, 0, state.z);
        record.exterior.root.rotation.y = physicsYawToViewYaw(state.yaw);
        record.exterior.root.updateWorldMatrix(true, true);
    }
    function updateTargetRigVisual(state) {""")

replace('scene.js',
    """    function updateTargetRigVisual(state) {
        // Use the fixed-step physics pose for both rendering and weapon raycasts.
        // A visual-only translation would make moving parts impossible to hit accurately.
        targetExterior.root.position.set(state.x, 0, state.z);
        targetExterior.root.rotation.y = physicsYawToViewYaw(state.yaw);
        targetExterior.root.updateWorldMatrix(true, true);
    }""",
    """    function updateTargetRigVisual(state) {
        // Backwards-compatible wrapper for the selected contract leader.
        updateCombatantRig('enemy-0', state);
    }""")

replace('scene.js',
    """    function setInspection(enabled) {
        inspecting = enabled;
        exterior.root.visible = enabled;
        cockpit.visible = !enabled;
    }""",
    """    function setInspection(enabled) {
        inspecting = enabled;
        exterior.root.visible = enabled;
        cockpit.visible = !enabled;
        for (const record of squadCombatants.values()) {
            record.exterior.root.visible = !enabled;
            record.marker.visible = !enabled;
        }
    }""")

replace('scene.js', "[...targetExterior.pickMeshes, ...worldSolids]", "[...hostilePickMeshes(), ...worldSolids]", 2)

replace_between('scene.js',
    "    function traceHostileShot(state, aimSlot, spreadX, spreadY) {",
    "    function showShot(contact, outcome) {",
    """    function traceCombatantShot(shooterId, targetId, aimSlot, spreadX, spreadY) {
        const shooter = squadCombatants.get(shooterId);
        const target = targetId === 'player'
            ? { id: 'player', assembly: initial, exterior }
            : squadCombatants.get(targetId);
        if (!shooter || !target)
            return { actorId: null, slot: null, point: new THREE.Vector3(), normal: new THREE.Vector3(0, 1, 0), muzzle: new THREE.Vector3(), distance: 0 };
        shooter.exterior.root.updateWorldMatrix(true, true);
        target.exterior.root.updateWorldMatrix(true, true);
        const combatGroup = shooter.exterior.partGroups.get('combat');
        const weaponId = installedPart(shooter.assembly, 'combat')?.definition.id;
        const muzzleLocalZ = weaponId === 'gun-light' ? -2.16 : weaponId === 'gun-short' ? -1.03 : -1.58;
        const muzzle = combatGroup
            ? combatGroup.localToWorld(new THREE.Vector3(0, -.05, muzzleLocalZ))
            : shooter.exterior.root.localToWorld(new THREE.Vector3(1.17, 2.03, -1.55));
        const aimGroup = target.exterior.partGroups.get(aimSlot);
        const aimPoint = aimGroup
            ? aimGroup.getWorldPosition(new THREE.Vector3())
            : target.exterior.root.localToWorld(new THREE.Vector3(...SLOT_CENTERS[aimSlot]));
        const forward = aimPoint.clone().sub(muzzle).normalize();
        const worldUp = new THREE.Vector3(0, 1, 0);
        let right = new THREE.Vector3().crossVectors(forward, worldUp);
        if (right.lengthSq() < 1e-6) right.set(1, 0, 0); else right.normalize();
        const up = new THREE.Vector3().crossVectors(right, forward).normalize();
        const bore = forward.clone().addScaledVector(right, spreadX).addScaledVector(up, spreadY).normalize();
        raycaster.set(muzzle, bore);
        raycaster.far = 100;
        const actual = raycaster.intersectObjects([...target.exterior.pickMeshes, ...worldSolids], false)[0];
        const point = actual ? actual.point.clone() : muzzle.clone().addScaledVector(bore, 100);
        const surfaceNormal = actual?.face
            ? actual.face.normal.clone().transformDirection(actual.object.matrixWorld)
            : bore.clone().negate();
        const slot = actual?.object.userData.slot;
        let driveSide;
        if (slot === 'mobility') {
            const local = target.exterior.root.worldToLocal(point.clone());
            driveSide = local.x < 0 ? 'left' : 'right';
        }
        return {
            actorId: slot ? targetId : null,
            slot: slot ?? null, point, normal: surfaceNormal, muzzle,
            distance: muzzle.distanceTo(point), driveSide,
        };
    }
    function traceHostileShot(state, aimSlot, spreadX, spreadY) {
        return traceCombatantShot('enemy-0', 'player', aimSlot, spreadX, spreadY);
    }
""")

replace('scene.js',
    """        if (hit) {
            // A dark local scar belongs to the struck machine.""",
    """        if (hit && contact.actorId === 'enemy-0') {
            // Keep persistent soot on the selected contract leader; auxiliary rigs
            // still receive damage tinting and particles without growing mark pools.
            // A dark local scar belongs to the struck machine.""")

replace('scene.js',
    """    function updateTargetDamage(condition) {
        activeTargetCondition = condition;
        for (const [slot, meshes] of targetExterior.partMeshes) {
            const state = condition.parts[slot];
            // Only affected geometry darkens. The rest of the same rig is untouched.
            const damage = 1 - state.integrity / state.maxIntegrity;
            const stripped = 1 - state.armor / state.maxArmor;
            for (const mesh of meshes) {
                const material = mesh.material;
                const color = targetColors.get(mesh);
                if (!(material instanceof THREE.MeshStandardMaterial) || !color)
                    continue;
                material.color.copy(color).multiplyScalar(1 - damage * .56 - stripped * .11);
                material.emissive.setHex(state.integrity === 0 ? 0x30150b : 0);
                material.emissiveIntensity = state.integrity === 0 ? .35 : 0;
            }
        }
    }""",
    """    function updateCombatantDamage(id, condition) {
        const record = squadCombatants.get(id);
        if (!record || !condition?.parts) return;
        for (const [slot, meshes] of record.exterior.partMeshes) {
            const state = condition.parts[slot];
            if (!state) continue;
            const damage = 1 - state.integrity / state.maxIntegrity;
            const stripped = 1 - state.armor / state.maxArmor;
            for (const mesh of meshes) {
                const material = mesh.material;
                const color = record.colors.get(mesh);
                if (!(material instanceof THREE.MeshStandardMaterial) || !color) continue;
                material.color.copy(color).multiplyScalar(1 - damage * .56 - stripped * .11);
                material.emissive.setHex(state.integrity === 0 ? 0x30150b : 0);
                material.emissiveIntensity = state.integrity === 0 ? .35 : 0;
            }
        }
    }
    function updateTargetDamage(condition) {
        activeTargetCondition = condition;
        updateCombatantDamage('enemy-0', condition);
    }""")

replace('scene.js',
    """    function updateTargetDamage(condition) {
        activeTargetCondition = condition;
        updateCombatantDamage('enemy-0', condition);
    }
    function updatePilotDamage(condition) {""",
    """    function updateTargetDamage(condition) {
        activeTargetCondition = condition;
        updateCombatantDamage('enemy-0', condition);
    }
    function showCombatantShot(shooterId, contact, outcome) {
        const shooter = squadCombatants.get(shooterId);
        const friendly = shooter?.team === 'friendly';
        const track = new THREE.BufferGeometry().setFromPoints([contact.muzzle, contact.point]);
        const trackMat = new THREE.LineBasicMaterial({
            color: friendly ? 0x8be1b0 : 0xff9e62, transparent: true, opacity: .86,
        });
        const tracer = new THREE.Line(track, trackMat);
        tracer.frustumCulled = false;
        scene.add(tracer);
        transientFX.push({ object: tracer, remaining: .16, duration: .16, material: trackMat });
        activateParticle(sparkPool, 'spark', contact.muzzle, new THREE.Vector3(0, .08, 0), 1.05, .08, 0, 0, friendly ? 0xbaf4c9 : 0xffd79a);
        if (outcome) {
            const impactPoint = contact.point.clone().addScaledVector(contact.normal, .045);
            spawnImpactParticles(impactPoint, contact.normal, outcome);
        }
    }
    function updatePilotDamage(condition) {""")

replace('scene.js',
    """        traceShot, showShot, traceHostileShot, showHostileShot, updateTargetDamage, updatePilotDamage, resetTargetDamage, updateCombatEffects, setPilotWeapon,
    };""",
    """        traceShot, showShot, traceHostileShot, showHostileShot, updateTargetDamage, updatePilotDamage, resetTargetDamage, updateCombatEffects, setPilotWeapon,
        addCombatant, setCombatantActive, updateCombatantRig, updateCombatantDamage, traceCombatantShot, showCombatantShot,
    };""")

# --- main.js: keep the selected contract leader as the salvage authority, layer four support actors around it.
replace('main.js',
    "import { advanceHostileController, createHostileController, disabledReason, hostileAimSlot, hostileMissionKillReason, hostileOutput, hostileSpread, } from './hostileRig.js';",
    "import { advanceHostileController, createHostileController, disabledReason, hostileAimSlot, hostileMissionKillReason, hostileOutput, hostileSpread, } from './hostileRig.js';\nimport { contractById } from './contracts.js';\nimport { FRIENDLY_SUPPORTS, HOSTILE_SUPPORT_SPAWNS, FRIENDLY_TEAM, HOSTILE_TEAM, chooseSquadTarget, hostileSupportRecipes, squadCounts, squadOutcome } from './squadBattle.js';")

replace('main.js',
    """const hostileDriveDamage = { drives: {} };
let testEnded = false;""",
    """const hostileDriveDamage = { drives: {} };
let playerCombatActive = true;
const primaryEnemyActor = {
    id: 'enemy-0', team: HOSTILE_TEAM, label: targetAssembly.name,
    assembly: targetAssembly, condition: targetCondition, rig: hostileRig,
    weaponSpec: hostileWeaponSpec, weaponState: hostileWeaponState,
    controller: hostileController, motion: hostileMotion,
    baseConfig: hostileBaseConfig, driveDamage: hostileDriveDamage,
    behavior: contractById(targetAssembly.contractId).behavior,
    spawn: HOSTILE_SPAWN, active: true, targetId: 'player', killReason: null,
};
function makeSupportActor(id, team, contractId, spawn, label = null) {
    const actorAssembly = makeRangeTarget(contractId);
    if (label) actorAssembly.name = label;
    const behavior = contractById(contractId).behavior;
    const actorCondition = createTargetCondition(actorAssembly);
    const actorWeaponSpec = weaponFor(actorAssembly);
    const baseConfig = deriveRigConfig(actorAssembly);
    if (!baseConfig || !actorWeaponSpec)
        throw new Error(`Squad support ${id} is not fieldable.`);
    return {
        id, team, label: label ?? actorAssembly.name, assembly: actorAssembly,
        condition: actorCondition, rig: createRigState(spawn),
        weaponSpec: actorWeaponSpec, weaponState: createWeaponState(actorWeaponSpec),
        controller: createHostileController(team === FRIENDLY_TEAM ? 1.0 : 1.55, behavior),
        motion: createEnemyMotion(behavior), baseConfig, driveDamage: { drives: {} },
        behavior, spawn, active: true, targetId: null, killReason: null,
    };
}
const friendlySupportActors = FRIENDLY_SUPPORTS.map(spawn =>
    makeSupportActor(spawn.id, FRIENDLY_TEAM, spawn.contractId, spawn, spawn.label));
const hostileSupportActors = hostileSupportRecipes(targetAssembly.contractId).map((contractId, index) => {
    const spawn = HOSTILE_SUPPORT_SPAWNS[index];
    return makeSupportActor(spawn.id, HOSTILE_TEAM, contractId, spawn);
});
const supportActors = [...friendlySupportActors, ...hostileSupportActors];
const aiActors = [primaryEnemyActor, ...supportActors];
let testEnded = false;""")

replace_between('main.js',
    "// Each mech sees the other as a moving physical obstacle.",
    "let inspection = inspectAssembly(assembly);",
    """// All six rigs share the same physical yard. Dynamic rig boxes collide in stepRig,
// but enemyMotion ignores them when planning long-lived obstacle detours.
const movingObstacleAt = (id, spawn, radius = 1) => ({
    id, dynamic: true, minX: spawn.x - radius, maxX: spawn.x + radius,
    minZ: spawn.z - radius, maxZ: spawn.z + radius,
});
const pilotObstacle = movingObstacleAt('player', PLAYER_SPAWN);
const actorObstacles = new Map(aiActors.map(actor => [actor.id, movingObstacleAt(actor.id, actor.spawn)]));
function placeMovingObstacle(box, x, z, radius) {
    box.minX = x - radius; box.maxX = x + radius;
    box.minZ = z - radius; box.maxZ = z + radius;
}
function syncMovingObstacles() {
    placeMovingObstacle(pilotObstacle, rig.x, rig.z, effectiveConfig?.collisionRadiusM ?? 1);
    for (const actor of aiActors) {
        const radius = actor.baseConfig?.collisionRadiusM ?? 1;
        placeMovingObstacle(actorObstacles.get(actor.id), actor.rig.x, actor.rig.z, radius);
    }
}
function combatWorldFor(actorId) {
    const dynamic = [];
    if (actorId !== 'player') dynamic.push(pilotObstacle);
    for (const [id, obstacle] of actorObstacles) if (id !== actorId) dynamic.push(obstacle);
    return { ...DEFAULT_WORLD, obstacles: [...DEFAULT_WORLD.obstacles, ...dynamic] };
}
function aiLocomotionConfig(actor) {
    const mobility = installedPart(actor.assembly, 'mobility');
    if (mobility) {
        const part = actor.condition.parts.mobility;
        const health = Math.max(0, part.integrity / Math.max(1, part.maxIntegrity));
        actor.driveDamage.drives[mobility.instance.serial] = { left: health, right: health };
    }
    return derateRigConfig(actor.baseConfig, functionalOutput(actor.assembly, actor.driveDamage));
}
function hostileLocomotionConfig() { return aiLocomotionConfig(primaryEnemyActor); }
""")

replace('main.js',
    "const faultStrip = required('#fault-strip');",
    "const faultStrip = required('#fault-strip');\nconst teamStatus = required('#team-status');")

replace('main.js',
    """const arena = createArenaScene(assembly, targetAssembly);
let rig = createRigState();""",
    """const arena = createArenaScene(assembly, targetAssembly);
for (const actor of supportActors)
    arena.addCombatant(actor.id, actor.assembly, actor.team, actor.spawn);
let rig = createRigState();""")

replace('main.js',
    """let targetPanelRefresh = 0;
const selectionButtons = new Map();""",
    """let targetPanelRefresh = 0;
const selectionButtons = new Map();
function actorById(id) {
    if (id === 'player')
        return { id: 'player', team: FRIENDLY_TEAM, label: 'YOU', rig, condition: playerCondition, assembly, active: playerCombatActive };
    return aiActors.find(actor => actor.id === id) ?? null;
}
function liveOpponents(actor) {
    if (actor.team === FRIENDLY_TEAM)
        return aiActors.filter(candidate => candidate.team === HOSTILE_TEAM && candidate.active);
    const candidates = friendlySupportActors.filter(candidate => candidate.active);
    if (playerCombatActive) candidates.unshift(actorById('player'));
    return candidates;
}
function resolveActorTarget(actor) {
    const candidates = liveOpponents(actor);
    actor.targetId = chooseSquadTarget(actor, candidates, actor.targetId);
    return actor.targetId ? candidates.find(candidate => candidate.id === actor.targetId) ?? null : null;
}
function renderSquadStatus() {
    const counts = squadCounts(playerCombatActive, aiActors);
    teamStatus.textContent = `ALLY ${counts.friendly}/3 · HOSTILE ${counts.hostile}/3`;
    teamStatus.classList.toggle('friendly-critical', counts.friendly <= 1);
    teamStatus.classList.toggle('hostile-critical', counts.hostile <= 1);
}
function checkSquadOutcome() {
    const outcome = squadOutcome(playerCombatActive, aiActors);
    if (outcome && !testEnded)
        finishSortie(outcome.victory, outcome.reason);
}
function missionKillAiActor(actor, reason) {
    if (!actor?.active) return;
    actor.active = false;
    actor.killReason = reason;
    actor.targetId = null;
    actor.rig.vx = 0; actor.rig.vz = 0; actor.rig.yawRate = 0;
    arena.setCombatantActive(actor.id, false);
    arena.updateCombatantDamage(actor.id, actor.condition);
    if (actor.id === 'enemy-0') {
        mirrorTargetCondition(targetAssembly, targetCondition);
        renderTarget();
    }
    renderSquadStatus();
    checkSquadOutcome();
}
function missionKillPlayer(reason) {
    if (!playerCombatActive) return;
    playerCombatActive = false;
    rig.vx = 0; rig.vz = 0; rig.yawRate = 0;
    stopFireInput();
    stopFieldServiceInput();
    controls.setEnabled(false);
    faultStrip.textContent = `MISSION KILL · ${reason} · ALLIES STILL ENGAGED`;
    faultStrip.classList.add('faulted');
    shotReport.classList.remove('faded', 'penetrated');
    shotReport.classList.add('disabled-part');
    shotReport.textContent = `YOU ARE COMBAT INEFFECTIVE · ${reason} · ALLIED RIGS CONTINUE`;
    reportFade = 9999;
    renderSquadStatus();
    renderAmmo();
    persistMachine();
    checkSquadOutcome();
}
function resetAiActor(actor) {
    Object.assign(actor.rig, createRigState(actor.spawn));
    Object.assign(actor.condition, createTargetCondition(actor.assembly));
    if (actor.weaponState && actor.weaponSpec)
        Object.assign(actor.weaponState, createWeaponState(actor.weaponSpec));
    Object.assign(actor.controller, createHostileController(actor.id === 'enemy-0' ? 1.8 : actor.team === FRIENDLY_TEAM ? 1.0 : 1.55, actor.behavior));
    Object.assign(actor.motion, createEnemyMotion(actor.behavior));
    actor.active = true;
    actor.targetId = null;
    actor.killReason = null;
    actor.driveDamage.drives = {};
    arena.setCombatantActive(actor.id, true);
    arena.updateCombatantRig(actor.id, actor.rig);
    arena.updateCombatantDamage(actor.id, actor.condition);
}
function resetSquadBattle() {
    for (const actor of aiActors) resetAiActor(actor);
    mirrorTargetCondition(targetAssembly, targetCondition);
    arena.resetTargetDamage(targetCondition);
    arena.updateHostileNavigation(null);
    renderSquadStatus();
}
""")

replace('main.js',
    """        rig = createRigState();
        hostileRig = createRigState(HOSTILE_SPAWN);
        hostileMotion = createEnemyMotion();
        arena.updateHostileNavigation(null);
        // The opponent is a fresh contract machine each sortie; player damage is NOT reset.
        targetCondition = createTargetCondition(targetAssembly);
        mirrorTargetCondition(targetAssembly, targetCondition);
        arena.resetTargetDamage(targetCondition);
        arena.updateTargetRigVisual(hostileRig);
        placeMovingObstacle(hostileObstacle, hostileRig.x, hostileRig.z, 1);
        controls.recenterLook();
        weaponState = weaponSpec ? createWeaponState(weaponSpec) : null;
        hostileWeaponState = hostileWeaponSpec ? createWeaponState(hostileWeaponSpec) : null;
        hostileController = createHostileController();
        fieldService = createFieldServiceState();""",
    """        rig = createRigState();
        playerCombatActive = true;
        resetSquadBattle();
        controls.recenterLook();
        weaponState = weaponSpec ? createWeaponState(weaponSpec) : null;
        fieldService = createFieldServiceState();""")

replace('main.js',
    "controls.setEnabled(!inspecting && !testEnded && appSheet.classList.contains('hidden'));",
    "controls.setEnabled(!inspecting && !testEnded && playerCombatActive && appSheet.classList.contains('hidden'));")

# Replace the fixed-step duel with the same mechanics iterated over five autonomous actors.
replace_between('main.js',
    "            placeMovingObstacle(hostileObstacle, hostileRig.x, hostileRig.z, 1);",
    "            accumulator -= FIXED_DT;",
    """            syncMovingObstacles();
            if (playerCombatActive) {
                const yawBefore = rig.yaw;
                stepRig(rig, { throttle: input.throttle, strafe: input.strafe, steer: bodySteer, brake: input.brake }, FIXED_DT, effectiveConfig, combatWorldFor('player'));
                if (Math.abs(followSteer) > .001) {
                    controls.compensateBodyTurn(rig.yaw - yawBefore);
                    input = controls.sample();
                }
                const serviceStep = advanceFieldService(playerCondition, fieldService, rig, FIXED_DT);
                if (serviceStep.event === 'completed') handleFieldServiceCompleted();
                else if (serviceStep.event === 'interrupted') handleFieldServiceInterrupted();
            }
            for (const actor of aiActors) {
                if (!actor.active) continue;
                const target = resolveActorTarget(actor);
                if (!target) continue;
                const actorOutput = hostileOutput(actor.condition, actor.behavior);
                const canManeuver = actorOutput.structure > .05 && actorOutput.command > .05 && actorOutput.power > .12 && actorOutput.mobility > .05;
                const actorConfig = aiLocomotionConfig(actor);
                const maneuver = advanceEnemyMotion(actor.motion, actor.rig, target.rig, FIXED_DT, canManeuver, combatWorldFor(actor.id), actorConfig.collisionRadiusM, actor.behavior);
                stepRig(actor.rig, maneuver, FIXED_DT, actorConfig, combatWorldFor(actor.id));
                arena.updateCombatantRig(actor.id, actor.rig);
                if (actor.id === 'enemy-0') arena.updateHostileNavigation(actor.motion.waypoint);
                if (actor.weaponSpec && actor.weaponState) {
                    advanceWeapon(actor.weaponState, actor.weaponSpec, FIXED_DT);
                    if (actor.weaponState.loaded <= 0 && actor.weaponState.reloadLeft === 0 && actor.weaponState.reserve > 0)
                        startReload(actor.weaponState, actor.weaponSpec);
                    const shot = advanceHostileController(actor.controller, actor.condition, FIXED_DT, target.active === false);
                    if (shot !== null) attemptAiFire(actor, target, shot);
                }
            }
            if (weaponSpec && weaponState) {
                advanceWeapon(weaponState, weaponSpec, FIXED_DT);
                if (fireHeld && playerCombatActive) attemptFire();
            }
            syncMovingObstacles();
""")

replace('main.js',
    """            `TARGET    ${targetCondition.shotsHit} HITS`,
            `HOSTILE   ${hostileMotion.phase} · ${hostileRig.x.toFixed(1)} / ${hostileRig.z.toFixed(1)} m`,""",
    """            `TARGET    ${targetCondition.shotsHit} HITS`,
            `SQUAD     ${teamStatus.textContent}${playerCombatActive ? '' : ' · YOU OUT'}`,
            `HOSTILE   ${hostileMotion.phase} · ${hostileRig.x.toFixed(1)} / ${hostileRig.z.toFixed(1)} m`,""")

# Team-aware sortie finish messaging.
replace('main.js',
    """    faultStrip.textContent = victory ? `CONTRACT CLEARED · HOSTILE MISSION KILL · ${reason}` : `MISSION KILL · ${reason}`;
    faultStrip.classList.toggle('faulted', !victory);
    shotReport.classList.remove('faded');
    shotReport.classList.toggle('disabled-part', !victory);
    shotReport.classList.toggle('penetrated', victory);
    shotReport.textContent = victory ? `SORTIE COMPLETE · HOSTILE MISSION KILL · ${reason}` : `SORTIE ENDED · MISSION KILL · ${reason} · RECOVERY CREW DISPATCHED`;""",
    """    faultStrip.textContent = victory ? `CONTRACT CLEARED · HOSTILE TEAM DOWN` : `SORTIE LOST · FRIENDLY TEAM DOWN`;
    faultStrip.classList.toggle('faulted', !victory);
    shotReport.classList.remove('faded');
    shotReport.classList.toggle('disabled-part', !victory);
    shotReport.classList.toggle('penetrated', victory);
    shotReport.textContent = victory ? `SORTIE COMPLETE · ${reason}` : `SORTIE ENDED · ${reason} · RECOVERY CREW DISPATCHED`;
    renderSquadStatus();""")

replace_between('main.js',
    "function attemptHostileFire(shotIndex) {",
    "function attemptFire() {",
    """function applyAiHitToPlayer(actor, contact) {
    stopFieldServiceInput();
    const partBefore = playerCondition.parts[contact.slot];
    const beforeIntegrity = partBefore.integrity;
    const hit = applyTargetHit(playerCondition, contact.slot, actor.weaponSpec.damage);
    if (hit.internalDamage > 0) {
        const amount = hit.internalDamage / Math.max(1, partBefore.maxIntegrity);
        if (contact.slot === 'mobility')
            damageInstalledPart(assembly, damage, 'mobility', amount, contact.driveSide ?? 'left');
        else
            damageInstalledPart(assembly, damage, contact.slot, amount);
        const installed = installedPart(assembly, contact.slot);
        if (installed)
            playerCondition.parts[contact.slot].integrity = playerCondition.parts[contact.slot].maxIntegrity * installed.instance.condition;
    }
    let weaponFaulted = false;
    if (contact.slot === 'combat') {
        weaponFaulted = arrestFirstWeaponFailure(playerCondition, fieldService, beforeIntegrity);
        if (weaponFaulted) syncOwnedWeaponCondition(false);
    }
    const nowDisabled = playerCondition.parts[contact.slot].integrity <= 0;
    const visualHit = { ...hit, disabled: nowDisabled, justDisabled: beforeIntegrity > 0 && nowDisabled };
    arena.showCombatantShot(actor.id, contact, visualHit);
    arena.updatePilotDamage(playerCondition);
    persistMachine();
    soundImpact();
    rig.impact = Math.min(1, rig.impact + .65);
    updateFunctionalStatus();
    renderPartsList();
    renderPartInfo();
    renderAmmo();
    if (weaponFaulted) {
        shotReport.classList.remove('faded', 'penetrated');
        shotReport.classList.add('disabled-part');
        shotReport.textContent = 'WEAPON FAULT · EMERGENCY BYPASS AVAILABLE · STOP BEHIND COVER AND HOLD FIELD SERVICE';
        reportFade = 5.0;
    }
    const failure = currentSortieFailureReason();
    if (failure) missionKillPlayer(failure);
}
function attemptAiFire(actor, target, shotIndex) {
    if (!actor?.active || !target || target.active === false || inspecting || testEnded || !appSheet.classList.contains('hidden')) return;
    const actorOutput = hostileOutput(actor.condition, actor.behavior);
    if (!actorOutput.operational || !withinFiringArc(actor.rig, target.rig)) return;
    const [spreadX, spreadY] = hostileSpread(shotIndex, actorOutput.spreadRadians);
    const aimSlot = hostileAimSlot(shotIndex, actor.behavior.aimPriority);
    const contact = arena.traceCombatantShot(actor.id, target.id, aimSlot, spreadX, spreadY);
    if (contact.slot === null || contact.actorId !== target.id) return;
    const consumed = fireWeapon(actor.weaponState, actor.weaponSpec);
    if (consumed === null) return;
    actor.weaponState.cooldown = Math.max(actor.weaponState.cooldown, actorOutput.triggerSeconds * .55);
    soundFire();
    if (target.id === 'player') {
        applyAiHitToPlayer(actor, contact);
        return;
    }
    const beforeIntegrity = target.condition.parts[contact.slot].integrity;
    const hit = applyTargetHit(target.condition, contact.slot, actor.weaponSpec.damage);
    const visualHit = { ...hit, justDisabled: beforeIntegrity > 0 && hit.disabled };
    arena.showCombatantShot(actor.id, contact, visualHit);
    arena.updateCombatantDamage(target.id, target.condition);
    if (target.id === 'enemy-0') {
        mirrorTargetCondition(targetAssembly, targetCondition);
        renderTarget();
    }
    const kill = hostileMissionKillReason(target.condition, target.behavior);
    if (kill) missionKillAiActor(target, kill);
}
""")

replace('main.js',
    "if (!weaponSpec || !weaponState || !rigConfig || inspecting || testEnded || !inspection.ready || !output.weaponOperational || !appSheet.classList.contains('hidden'))",
    "if (!playerCombatActive || !weaponSpec || !weaponState || !rigConfig || inspecting || testEnded || !inspection.ready || !output.weaponOperational || !appSheet.classList.contains('hidden'))")

replace('main.js',
    """    if (contact.slot !== null) {
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
        const hostileKill = hostileMissionKillReason(targetCondition);
        if (hostileKill) {
            finishSortie(true, hostileKill);
            return;
        }
    }""",
    """    if (contact.slot !== null && contact.actorId) {
        const targetActor = actorById(contact.actorId);
        if (!targetActor || targetActor.team !== HOSTILE_TEAM || !targetActor.active) return;
        const beforeIntegrity = targetActor.condition.parts[contact.slot].integrity;
        const hit = applyTargetHit(targetActor.condition, contact.slot, weaponSpec.damage);
        const visualHit = { ...hit, justDisabled: beforeIntegrity > 0 && hit.disabled };
        arena.showShot(contact, visualHit);
        arena.updateCombatantDamage(targetActor.id, targetActor.condition);
        if (targetActor.id === 'enemy-0') {
            mirrorTargetCondition(targetAssembly, targetCondition);
            renderTarget();
        }
        soundImpact();
        recoilFlash = .19;
        lastHit = `${targetActor.label} · ${targetLabels[hit.slot]} · ${hit.serial}`;
        shotReport.classList.toggle('penetrated', hit.internalDamage > 0);
        shotReport.classList.toggle('disabled-part', hit.disabled);
        const outcome = hit.disabled ? 'MODULE DISABLED' : hit.internalDamage > 0 ? 'ARMOR BREACHED' : 'ARMOR IMPACT';
        shotReport.textContent = `${outcome} · ${lastHit} · ARMOR −${hit.armorAbsorbed} · INTERNAL −${hit.internalDamage}`;
        const kill = hostileMissionKillReason(targetActor.condition, targetActor.behavior);
        if (kill) missionKillAiActor(targetActor, kill);
        if (testEnded) return;
    }""")

replace('main.js',
    "const serviceAvailable = canFieldService(playerCondition, fieldService);",
    "const serviceAvailable = playerCombatActive && canFieldService(playerCondition, fieldService);")
replace('main.js',
    """    const suffix = testEnded ? ' · SORTIE ENDED' :
        failure === 'destroyed' ? ' · DESTROYED' :""",
    """    const suffix = !playerCombatActive ? ' · MISSION KILLED' : testEnded ? ' · SORTIE ENDED' :
        failure === 'destroyed' ? ' · DESTROYED' :""")
replace('main.js',
    "fireButton.disabled = !weaponSpec || !weaponState || !inspection.ready || inspecting || testEnded || !output.weaponOperational ||",
    "fireButton.disabled = !playerCombatActive || !weaponSpec || !weaponState || !inspection.ready || inspecting || testEnded || !output.weaponOperational ||")
replace('main.js',
    "if (event.code === 'KeyF' && !event.repeat && !inspecting && !testEnded)",
    "if (event.code === 'KeyF' && !event.repeat && !inspecting && !testEnded && playerCombatActive)")
replace('main.js',
    "if (!inspecting && !testEnded && canFieldService(playerCondition, fieldService))",
    "if (!inspecting && !testEnded && playerCombatActive && canFieldService(playerCondition, fieldService))")
replace('main.js',
    "if (canFieldService(playerCondition, fieldService)) {",
    "if (playerCombatActive && canFieldService(playerCondition, fieldService)) {", 1)

# The dev rebuild now restores the whole six-actor battle so team counts cannot desync.
replace_between('main.js',
    "resetTarget.addEventListener('click', () => {",
    "debriefGarage.addEventListener('click', () => {",
    """resetTarget.addEventListener('click', () => {
    resetSquadBattle();
    lastHit = 'SQUAD RIGS REBUILT';
    shotReport.textContent = 'SQUAD RESET · ALL SIX COMBATANTS RESTORED';
    reportFade = 2;
    renderTarget();
});
""")

replace('main.js',
    """updateFunctionalStatus();
renderEconomy();
renderAmmo();
renderTarget();""",
    """updateFunctionalStatus();
renderEconomy();
renderSquadStatus();
renderAmmo();
renderTarget();""")

# index cache/version and the compact team-strength HUD.
replace('index.html', '"./combat.js": "./combat.js?v=k3j1"', '"./combat.js": "./combat.js?v=k3j1"') if False else None
replace('index.html', '"./scene.js": "./sceneAssembly.js?v=k3i0"', '"./scene.js": "./sceneAssembly.js?v=k3k0"')
replace('index.html', '"./enemyMotion.js": "./enemyMotion.js?v=k3g0"', '"./enemyMotion.js": "./enemyMotion.js?v=k3k0",\n    "./squadBattle.js": "./squadBattle.js?v=k3k0"')
replace('index.html', '<title>MECH ARENA — 0.0.1k.3j.1 — Combat Durability</title>', '<title>MECH ARENA — 0.0.1k.3k.0 — First 3v3</title>')
replace('index.html',
    '<div id="look-heading" class="look-heading">LOOK FORWARD · 0°</div>',
    '<div id="look-heading" class="look-heading">LOOK FORWARD · 0°</div>\n    <div id="team-status" class="team-status" aria-live="polite">ALLY 3/3 · HOSTILE 3/3</div>')
replace('index.html', '<header>RIG DIAGNOSTICS <span>0.0.1k.3j.0</span></header>', '<header>RIG DIAGNOSTICS <span>0.0.1k.3k.0</span></header>')
replace('index.html', '<script type="module" src="./main.js?v=k3j0"></script>', '<script type="module" src="./main.js?v=k3k0"></script>')
replace('index.html', '>REBUILD HOSTILE RIG</button>', '>REBUILD SQUAD</button>')

styles = Path('styles.css')
text = styles.read_text()
if '.team-status {' not in text:
    text += """

/* k.3k.0 — deliberately sparse IFF/team-strength readout. World-space brackets
   do the identification; this only answers how many combat-capable rigs remain. */
.team-status {
  position: fixed;
  top: max(54px, env(safe-area-inset-top));
  left: 50%;
  transform: translateX(-50%);
  z-index: 14;
  padding: 5px 10px;
  border: 1px solid rgba(127, 190, 145, .44);
  background: rgba(18, 23, 20, .76);
  color: #9ed0a8;
  font: 700 10px/1.1 ui-monospace, SFMono-Regular, Menlo, monospace;
  letter-spacing: .11em;
  pointer-events: none;
  white-space: nowrap;
}
.team-status.friendly-critical { border-color: rgba(224, 164, 76, .72); color: #e0a44c; }
.team-status.hostile-critical { box-shadow: inset 0 0 0 1px rgba(224, 164, 76, .22); }
body.inspecting .team-status { display: none; }
"""
    styles.write_text(text)

print('applied k.3k.0 first 3v3 integration')
