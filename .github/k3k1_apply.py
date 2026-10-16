from pathlib import Path


def replace(path, old, new, count=-1):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'missing expected text in {path}: {old[:160]!r}')
    p.write_text(text.replace(old, new, count))


def append(path, text):
    p = Path(path)
    current = p.read_text()
    if text.strip() not in current:
        p.write_text(current.rstrip() + '\n\n' + text.strip() + '\n')


# Re-running after the product commit should be a harmless verification-only pass.
if '0.0.1k.3k.1' in Path('index.html').read_text():
    raise SystemExit(0)

# --- index: compact player-focused HUD and cache refresh.
replace('index.html', '"./scene.js": "./sceneAssembly.js?v=k3k0",', '"./scene.js": "./sceneAssembly.js?v=k3k1",')
replace('index.html', '"./squadBattle.js": "./squadBattle.js?v=k3k0"', '"./squadBattle.js": "./squadBattle.js?v=k3k0",\n    "./wreckPhysics.js": "./wreckPhysics.js?v=k3k1"')
replace('index.html', '<link rel="stylesheet" href="./styles.css?v=k3k0" />', '<link rel="stylesheet" href="./styles.css?v=k3k1" />')
replace('index.html', '<title>MECH ARENA — 0.0.1k.3k.0 — First 3v3</title>', '<title>MECH ARENA — 0.0.1k.3k.1 — Combat Readability + Impact</title>')
replace('index.html',
'''    <div id="team-status" class="team-status" aria-live="polite">ALLY 3/3 · HOSTILE 3/3</div>
    <div id="center-crosshair" class="center-crosshair" aria-hidden="true">+</div>
    <div id="shot-report" class="shot-report faded" aria-live="polite">SQUAD CONTACT · HOSTILES AHEAD</div>
    <div id="fault-strip" class="fault-strip" aria-live="polite">SYSTEMS NOMINAL</div>''',
'''    <div id="team-status" class="team-status" aria-live="polite">ALLY 3/3 · HOSTILE 3/3</div>
    <div id="player-damage-hud" class="player-damage-hud" aria-label="player component condition">
      <span data-system="structure"><b>FRAME</b><i>100</i></span>
      <span data-system="mobility"><b>MOVE</b><i>100</i></span>
      <span data-system="power"><b>PWR</b><i>100</i></span>
      <span data-system="command"><b>CMD</b><i>100</i></span>
      <span data-system="combat"><b>ARMS</b><i>100</i></span>
    </div>
    <div id="center-crosshair" class="center-crosshair" aria-hidden="true">+</div>
    <div id="hit-confirm" class="hit-confirm" aria-hidden="true"></div>
    <div id="player-hit-flash" class="player-hit-flash" aria-hidden="true"></div>
    <div id="shot-report" class="shot-report faded" aria-live="polite">COMBAT FEED</div>
    <div id="fault-strip" class="fault-strip nominal" aria-live="polite">SYSTEMS NOMINAL</div>''')
replace('index.html', 'Selected contract opponent uses the same localized armor and component condition as your rig.', 'Combat view withholds remote module telemetry. Open DEV for detailed target diagnostics.')
replace('index.html', '<header>RIG DIAGNOSTICS <span>0.0.1k.3k.0</span></header>', '<header>RIG DIAGNOSTICS <span>0.0.1k.3k.1</span></header>')
replace('index.html', '<script type="module" src="./main.js?v=k3k0"></script>', '<script type="module" src="./main.js?v=k3k1"></script>')

# --- scene bridge cache key.
replace('sceneAssembly.js', "./scene.js?source=k3k0", "./scene.js?source=k3k1")

# --- damage expression: dead metal should be louder than ordinary penetration.
replace('damageVisuals.js',
'''export function impactProfile(outcome) {
    if (!outcome)
        return { kind: 'surface', sparkCount: 3, chipCount: 1, smokeCount: 0, markScale: .7, flashScale: .7 };
    if (outcome.justDisabled)''',
'''export function impactProfile(outcome) {
    if (!outcome)
        return { kind: 'surface', sparkCount: 3, chipCount: 1, smokeCount: 0, markScale: .7, flashScale: .7 };
    if (outcome.wreckHit)
        return { kind: outcome.cleared ? 'wreck-break' : 'wreck-hit', sparkCount: outcome.cleared ? 18 : 10, chipCount: outcome.cleared ? 12 : 7, smokeCount: outcome.cleared ? 5 : 2, markScale: 1.45, flashScale: outcome.cleared ? 1.65 : 1.12 };
    if (outcome.justDisabled)''')
replace('damageVisuals.js', 'sparkCount: outcome.slot === \'power\' ? 18 : 13,\n            chipCount: 8,\n            smokeCount: outcome.slot === \'power\' ? 4 : 2,', 'sparkCount: outcome.slot === \'power\' ? 22 : 17,\n            chipCount: 10,\n            smokeCount: outcome.slot === \'power\' ? 6 : 4,')

# --- scene: world/IFF clarity, all-rig ballistic blocking, generalized damage expression, wreck visuals.
replace('scene.js',
'''    const navMarker = new THREE.Mesh(new THREE.RingGeometry(.42, .52, 16), new THREE.MeshBasicMaterial({ color: 0x73dfc8, side: THREE.DoubleSide, depthTest: false }));
    navMarker.rotation.x = -Math.PI / 2;
    navMarker.visible = false;
    debugColliders.add(navMarker);''',
'''    const navMarker = new THREE.Mesh(new THREE.RingGeometry(.42, .52, 16), new THREE.MeshBasicMaterial({ color: 0x73dfc8, side: THREE.DoubleSide, depthTest: false }));
    navMarker.rotation.x = -Math.PI / 2;
    navMarker.visible = false;
    debugColliders.add(navMarker);
    const shotAuditMaterial = new THREE.LineBasicMaterial({ color: 0x65ff91, depthTest: false, transparent: true, opacity: .92 });
    const shotAuditLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), shotAuditMaterial);
    shotAuditLine.visible = false;
    debugColliders.add(shotAuditLine);
    function updateShotAudit(contact, clear) {
        if (!contact?.muzzle || !contact?.point) {
            shotAuditLine.visible = false;
            return;
        }
        shotAuditLine.geometry.dispose();
        shotAuditLine.geometry = new THREE.BufferGeometry().setFromPoints([contact.muzzle, contact.point]);
        shotAuditMaterial.color.setHex(clear ? 0x65ff91 : 0xff765d);
        shotAuditLine.visible = true;
    }''')
replace('scene.js',
'''    const squadCombatants = new Map();
    function makeSquadMarker(team) {''',
'''    const makeEmitterBudget = () => new Map(SLOTS.map(slot => [slot, { spark: 0, smoke: 0 }]));
    const squadCombatants = new Map();
    function makeSquadMarker(team) {''')
replace('scene.js',
'''    squadCombatants.set('enemy-0', {
        id: 'enemy-0', team: 'hostile', assembly: targetAssembly, exterior: targetExterior,
        colors: targetColors, marker: primaryMarker, active: true,
    });''',
'''    squadCombatants.set('enemy-0', {
        id: 'enemy-0', team: 'hostile', assembly: targetAssembly, exterior: targetExterior,
        colors: targetColors, marker: primaryMarker, active: true, condition: null,
        emitterBudget: makeEmitterBudget(), disabledSlots: new Set(), wrecked: false, cleared: false,
    });''')
replace('scene.js',
'''        const record = {
            id, team, assembly, exterior: actorExterior, colors: colorsFor(actorExterior),
            marker: makeSquadMarker(team), active: true,
        };''',
'''        const record = {
            id, team, assembly, exterior: actorExterior, colors: colorsFor(actorExterior),
            marker: makeSquadMarker(team), active: true, condition: null,
            emitterBudget: makeEmitterBudget(), disabledSlots: new Set(), wrecked: false, cleared: false,
        };''')
replace('scene.js',
'''    function setCombatantActive(id, active) {
        const record = squadCombatants.get(id);
        if (!record) return;
        record.active = !!active;
        record.marker.material.opacity = record.active ? .92 : .22;
        record.marker.scale.setScalar(record.active ? 1 : .78);
    }''',
'''    function setCombatantActive(id, active) {
        const record = squadCombatants.get(id);
        if (!record) return;
        const wasActive = record.active;
        record.active = !!active;
        if (wasActive && !record.active)
            wreckCombatantVisual(record);
        else if (!wasActive && record.active)
            resetCombatantVisual(record);
        record.marker.material.opacity = record.active ? .82 : .24;
        record.marker.scale.setScalar(record.active ? .86 : .62);
    }
    function setCombatantCleared(id, cleared = true) {
        const record = squadCombatants.get(id);
        if (!record) return;
        record.cleared = !!cleared;
        if (record.cleared) {
            record.marker.visible = false;
            record.exterior.root.position.y = -.14;
            record.exterior.root.rotation.z *= 1.55;
            for (const slot of ['command', 'combat']) {
                const group = record.exterior.partGroups.get(slot);
                if (group) group.scale.setScalar(.72);
            }
        }
    }''')
replace('scene.js',
'''            record.marker.visible = !inspecting;
            if (inspecting) continue;''',
'''            record.marker.visible = !inspecting && !record.cleared;
            if (inspecting || record.cleared) continue;''')
replace('scene.js',
'''    function hostilePickMeshes() {
        const meshes = [];
        for (const record of squadCombatants.values()) {
            if (record.team === 'hostile' && record.active)
                meshes.push(...record.exterior.pickMeshes);
        }
        return meshes;
    }''',
'''    function combatPickMeshes(excludeId = null) {
        const meshes = [];
        for (const record of squadCombatants.values()) {
            if (record.id !== excludeId && !record.cleared)
                meshes.push(...record.exterior.pickMeshes);
        }
        return meshes;
    }''')
replace('scene.js', 'const sparkPool = makePool(32,', 'const sparkPool = makePool(52,')
replace('scene.js', 'const chipPool = makePool(18,', 'const chipPool = makePool(34,')
replace('scene.js', 'const smokePool = makePool(16,', 'const smokePool = makePool(28,')
replace('scene.js', '    let activeTargetCondition = null;\n    const emitterBudget = new Map(SLOTS.map(slot => [slot, { spark: 0, smoke: 0 }]));\n', '')
replace('scene.js',
'''    function partWorldPoint(slot) {
        const group = targetExterior.partGroups.get(slot);
        const point = new THREE.Vector3();
        if (group)
            group.getWorldPosition(point);
        point.x += (Math.random() - .5) * .45;
        point.y += (Math.random() - .5) * .30;
        point.z += (Math.random() - .5) * .45;
        return point;
    }''',
'''    function partWorldPoint(record, slot) {
        const group = record?.exterior.partGroups.get(slot);
        const point = new THREE.Vector3();
        if (group) group.getWorldPosition(point);
        else record?.exterior.root.getWorldPosition(point);
        point.x += (Math.random() - .5) * .45;
        point.y += (Math.random() - .5) * .30;
        point.z += (Math.random() - .5) * .45;
        return point;
    }
    function spawnDisableBurst(position, normal, outcome) {
        const flashMat = new THREE.MeshBasicMaterial({ color: outcome?.slot === 'power' ? 0xffd27a : 0xffa75b, transparent: true, opacity: .94, depthWrite: false });
        const flash = new THREE.Mesh(new THREE.IcosahedronGeometry(outcome?.slot === 'power' ? .36 : .27, 0), flashMat);
        flash.position.copy(position);
        scene.add(flash);
        transientFX.push({ object: flash, remaining: .16, duration: .16, material: flashMat });
        for (let i = 0; i < (outcome?.wreckHit ? 8 : 6); i++) {
            const direction = randomBurstDirection(normal, 1.65);
            activateParticle(chipPool, 'chip', position, direction.multiplyScalar(1.2 + Math.random() * 3.0), 1.8 + Math.random() * 1.8, .75 + Math.random() * .75, -7.4, 0, Math.random() > .45 ? 0x4a4d46 : 0x9b7542);
        }
        for (let i = 0; i < 3; i++) {
            const drift = new THREE.Vector3((Math.random() - .5) * .45, .35 + Math.random() * .35, (Math.random() - .5) * .45);
            activateParticle(smokePool, 'smoke', position, drift, 1.0 + Math.random() * .55, 1.15 + Math.random() * .8, 0, 1.15, 0x252722, true);
        }
    }
    function markPartDisabledVisual(actorId, slot) {
        const record = squadCombatants.get(actorId);
        if (!record || record.disabledSlots.has(slot)) return;
        record.disabledSlots.add(slot);
        const group = record.exterior.partGroups.get(slot);
        if (!group) return;
        const side = actorId.length % 2 ? 1 : -1;
        group.rotation.z += side * (slot === 'mobility' ? .055 : .11);
        group.rotation.x += slot === 'combat' ? .09 : .035;
        group.position.y -= slot === 'mobility' ? .035 : .065;
    }
    function wreckCombatantVisual(record) {
        record.wrecked = true;
        record.cleared = false;
        const side = record.id.length % 2 ? 1 : -1;
        record.exterior.root.rotation.z = side * .075;
        record.exterior.root.rotation.x = .025;
        record.exterior.root.position.y = -.06;
        for (const slot of ['power', 'structure']) {
            const group = record.exterior.partGroups.get(slot);
            if (!group) continue;
            const point = group.getWorldPosition(new THREE.Vector3());
            spawnDisableBurst(point, new THREE.Vector3(0, 1, 0), { slot, wreckHit: true });
        }
    }
    function resetCombatantVisual(record) {
        record.wrecked = false;
        record.cleared = false;
        record.disabledSlots.clear();
        record.exterior.root.position.y = 0;
        record.exterior.root.rotation.x = 0;
        record.exterior.root.rotation.z = 0;
        for (const slot of SLOTS) {
            const group = record.exterior.partGroups.get(slot);
            const fitted = installedPart(record.assembly, slot);
            if (!group || !fitted) continue;
            group.position.set(...fitted.definition.center);
            group.rotation.set(0, 0, 0);
            group.scale.set(1, 1, 1);
        }
    }''')
replace('scene.js',
'''        for (const budget of emitterBudget.values()) {
            budget.spark = 0;
            budget.smoke = 0;
        }''',
'''        for (const record of squadCombatants.values()) {
            for (const budget of record.emitterBudget.values()) {
                budget.spark = 0;
                budget.smoke = 0;
            }
        }''')
replace('scene.js',
'''        record.exterior.root.position.set(state.x, 0, state.z);
        record.exterior.root.rotation.y = physicsYawToViewYaw(state.yaw);''',
'''        record.exterior.root.position.set(state.x, record.cleared ? -.14 : record.wrecked ? -.06 : 0, state.z);
        record.exterior.root.rotation.y = physicsYawToViewYaw(state.yaw);''')
replace('scene.js', '[...hostilePickMeshes(), ...worldSolids]', '[...combatPickMeshes(), ...worldSolids]', 2)
replace('scene.js',
'''        const actorId = actual?.object.userData.actorId ?? null;
        return { actorId: slot ? actorId : null, slot: slot ?? null, point, normal: surfaceNormal, muzzle, distance: muzzle.distanceTo(point) };''',
'''        const actorId = actual?.object.userData.actorId ?? null;
        const blockedBy = actual?.object.userData.arenaObstacleId ?? null;
        return { actorId: slot ? actorId : null, slot: slot ?? null, blockedBy, point, normal: surfaceNormal, muzzle, distance: muzzle.distanceTo(point) };''')
replace('scene.js',
'''        const actual = raycaster.intersectObjects([...target.exterior.pickMeshes, ...worldSolids], false)[0];
        const point = actual ? actual.point.clone() : muzzle.clone().addScaledVector(bore, 100);''',
'''        const blockers = [...combatPickMeshes(shooterId), ...exterior.pickMeshes, ...worldSolids];
        const actual = raycaster.intersectObjects(blockers, false)[0];
        const point = actual ? actual.point.clone() : muzzle.clone().addScaledVector(bore, 100);''')
replace('scene.js',
'''        const slot = actual?.object.userData.slot;
        let driveSide;
        if (slot === 'mobility') {
            const local = target.exterior.root.worldToLocal(point.clone());
            driveSide = local.x < 0 ? 'left' : 'right';
        }
        return {
            actorId: slot ? targetId : null,
            slot: slot ?? null, point, normal: surfaceNormal, muzzle,
            distance: muzzle.distanceTo(point), driveSide,
        };''',
'''        const slot = actual?.object.userData.slot;
        const actorId = actual?.object.userData.actorId ?? null;
        const blockedBy = actual?.object.userData.arenaObstacleId ?? null;
        let driveSide;
        if (slot === 'mobility' && actorId) {
            const hitRoot = actorId === 'player' ? exterior.root : squadCombatants.get(actorId)?.exterior.root;
            if (hitRoot) {
                const local = hitRoot.worldToLocal(point.clone());
                driveSide = local.x < 0 ? 'left' : 'right';
            }
        }
        return {
            actorId: slot ? actorId : null,
            slot: slot ?? null, blockedBy, point, normal: surfaceNormal, muzzle,
            distance: muzzle.distanceTo(point), driveSide,
        };''')
replace('scene.js',
'''        const profile = spawnImpactParticles(impactPoint, contact.normal, outcome);
        if (hit && contact.actorId === 'enemy-0') {''',
'''        const profile = spawnImpactParticles(impactPoint, contact.normal, outcome);
        if (outcome?.justDisabled || outcome?.wreckHit) {
            spawnDisableBurst(impactPoint, contact.normal, outcome);
            if (outcome.justDisabled) markPartDisabledVisual(contact.actorId, outcome.slot);
        }
        if (hit && contact.actorId === 'enemy-0') {''')
replace('scene.js',
'''    function updateCombatantDamage(id, condition) {
        const record = squadCombatants.get(id);
        if (!record || !condition?.parts) return;
        for (const [slot, meshes] of record.exterior.partMeshes) {''',
'''    function updateCombatantDamage(id, condition) {
        const record = squadCombatants.get(id);
        if (!record || !condition?.parts) return;
        record.condition = condition;
        for (const [slot, meshes] of record.exterior.partMeshes) {''')
replace('scene.js', 'material.color.copy(color).multiplyScalar(1 - damage * .56 - stripped * .11);\n                material.emissive.setHex(state.integrity === 0 ? 0x30150b : 0);\n                material.emissiveIntensity = state.integrity === 0 ? .35 : 0;', 'material.color.copy(color).multiplyScalar(Math.max(.24, 1 - damage * .68 - stripped * .18));\n                const severe = state.integrity / Math.max(1, state.maxIntegrity) < .32;\n                material.emissive.setHex(state.integrity === 0 ? 0x4b1609 : severe ? 0x241008 : 0);\n                material.emissiveIntensity = state.integrity === 0 ? .58 : severe ? .16 : 0;', 1)
replace('scene.js', '        activeTargetCondition = condition;\n        updateCombatantDamage(\'enemy-0\', condition);', '        updateCombatantDamage(\'enemy-0\', condition);')
replace('scene.js',
'''        if (outcome) {
            const impactPoint = contact.point.clone().addScaledVector(contact.normal, .045);
            spawnImpactParticles(impactPoint, contact.normal, outcome);
        }''',
'''        if (outcome) {
            const impactPoint = contact.point.clone().addScaledVector(contact.normal, .045);
            spawnImpactParticles(impactPoint, contact.normal, outcome);
            if (outcome.justDisabled || outcome.wreckHit) {
                spawnDisableBurst(impactPoint, contact.normal, outcome);
                if (outcome.justDisabled) markPartDisabledVisual(contact.actorId, outcome.slot);
            }
        }''')
replace('scene.js',
'''        // Sustained distress comes from the actual damaged component, at a low bounded rate.
        if (activeTargetCondition) {
            targetExterior.root.updateWorldMatrix(true, true);
            for (const slot of SLOTS) {
                const part = activeTargetCondition.parts[slot];
                if (!part)
                    continue;
                const profile = persistentFailureProfile(slot, integrityRatio(part));
                const budget = emitterBudget.get(slot);
                budget.spark += profile.sparkRate * dt;
                budget.smoke += profile.smokeRate * dt;
                while (budget.spark >= 1) {
                    budget.spark -= 1;
                    const origin = partWorldPoint(slot);
                    const velocity = new THREE.Vector3((Math.random() - .5) * 1.8, .5 + Math.random() * 1.6, (Math.random() - .5) * 1.8);
                    activateParticle(sparkPool, 'spark', origin, velocity, .55 + Math.random() * .5, .18 + Math.random() * .22, -3.8, 0, 0xffb951);
                }
                while (budget.smoke >= 1) {
                    budget.smoke -= 1;
                    const origin = partWorldPoint(slot);
                    const velocity = new THREE.Vector3((Math.random() - .5) * .16, .22 + Math.random() * .22, (Math.random() - .5) * .16);
                    activateParticle(smokePool, 'smoke', origin, velocity, .72 + profile.severity * .4, .9 + Math.random() * .65, 0, 1.05, slot === 'power' ? 0x20241f : 0x2b2d28, true);
                }
            }
        }''',
'''        // Every damaged combatant can now communicate distress; the old build only emitted
        // sustained effects from the selected contract leader.
        for (const record of squadCombatants.values()) {
            if (!record.condition?.parts || record.cleared) continue;
            record.exterior.root.updateWorldMatrix(true, true);
            for (const slot of SLOTS) {
                const part = record.condition.parts[slot];
                if (!part) continue;
                const profile = persistentFailureProfile(slot, integrityRatio(part));
                const budget = record.emitterBudget.get(slot);
                const wreckSmoke = record.wrecked ? .42 : 0;
                budget.spark += profile.sparkRate * dt * (record.wrecked ? .55 : 1);
                budget.smoke += (profile.smokeRate + wreckSmoke) * dt;
                while (budget.spark >= 1) {
                    budget.spark -= 1;
                    const origin = partWorldPoint(record, slot);
                    const velocity = new THREE.Vector3((Math.random() - .5) * 1.8, .5 + Math.random() * 1.6, (Math.random() - .5) * 1.8);
                    activateParticle(sparkPool, 'spark', origin, velocity, .55 + Math.random() * .5, .18 + Math.random() * .22, -3.8, 0, 0xffb951);
                }
                while (budget.smoke >= 1) {
                    budget.smoke -= 1;
                    const origin = partWorldPoint(record, slot);
                    const velocity = new THREE.Vector3((Math.random() - .5) * .16, .22 + Math.random() * .22, (Math.random() - .5) * .16);
                    activateParticle(smokePool, 'smoke', origin, velocity, .8 + profile.severity * .5, 1.0 + Math.random() * .75, 0, 1.15, slot === 'power' ? 0x20241f : 0x2b2d28, true);
                }
            }
        }''')
replace('scene.js',
'''        addCombatant, setCombatantActive, updateCombatantRig, updateCombatantDamage, traceCombatantShot, showCombatantShot,
    };''',
'''        addCombatant, setCombatantActive, setCombatantCleared, updateCombatantRig, updateCombatantDamage, traceCombatantShot, showCombatantShot, updateShotAudit,
    };''')

# --- main: player-focused feedback, soft wrecks, body-blocked fire and audited cover rays.
replace('main.js', "import { FRIENDLY_SUPPORTS, HOSTILE_SUPPORT_SPAWNS, FRIENDLY_TEAM, HOSTILE_TEAM, chooseSquadTarget, hostileSupportRecipes, squadCounts, squadOutcome } from './squadBattle.js';", "import { FRIENDLY_SUPPORTS, HOSTILE_SUPPORT_SPAWNS, FRIENDLY_TEAM, HOSTILE_TEAM, chooseSquadTarget, hostileSupportRecipes, squadCounts, squadOutcome } from './squadBattle.js';\nimport { damageWreckIntegrity, shoveWreck, wreckCollisionRadius } from './wreckPhysics.js';")
replace('main.js', "    spawn: HOSTILE_SPAWN, active: true, targetId: 'player', killReason: null,\n};", "    spawn: HOSTILE_SPAWN, active: true, targetId: 'player', killReason: null,\n    wreckAge: 0, wreckIntegrity: 1, wreckCleared: false,\n};")
replace('main.js', "        behavior, spawn, active: true, targetId: null, killReason: null,\n    };", "        behavior, spawn, active: true, targetId: null, killReason: null,\n        wreckAge: 0, wreckIntegrity: 1, wreckCleared: false,\n    };")
replace('main.js',
'''    for (const actor of aiActors) {
        const radius = actor.baseConfig?.collisionRadiusM ?? 1;
        placeMovingObstacle(actorObstacles.get(actor.id), actor.rig.x, actor.rig.z, radius);
    }''',
'''    for (const actor of aiActors) {
        const baseRadius = actor.baseConfig?.collisionRadiusM ?? 1;
        const radius = actor.active ? baseRadius : wreckCollisionRadius(baseRadius, actor.wreckAge, actor.wreckCleared);
        placeMovingObstacle(actorObstacles.get(actor.id), actor.rig.x, actor.rig.z, radius);
    }''')
replace('main.js',
'''function combatWorldFor(actorId) {
    const dynamic = [];
    if (actorId !== 'player') dynamic.push(pilotObstacle);
    for (const [id, obstacle] of actorObstacles) if (id !== actorId) dynamic.push(obstacle);
    return { ...DEFAULT_WORLD, obstacles: [...DEFAULT_WORLD.obstacles, ...dynamic] };
}''',
'''function combatWorldFor(actorId) {
    const dynamic = [];
    if (actorId !== 'player') dynamic.push(pilotObstacle);
    for (const [id, obstacle] of actorObstacles) if (id !== actorId) dynamic.push(obstacle);
    return { ...DEFAULT_WORLD, obstacles: [...DEFAULT_WORLD.obstacles, ...dynamic] };
}
function shoveDisabledWrecks(moverState, moverConfig) {
    const moverRadius = moverConfig?.collisionRadiusM ?? 1;
    for (const actor of aiActors) {
        if (actor.active) continue;
        const wreckRadius = wreckCollisionRadius(actor.baseConfig?.collisionRadiusM ?? 1, actor.wreckAge, actor.wreckCleared);
        const shove = shoveWreck(moverState, actor.rig, moverRadius, wreckRadius, FIXED_DT);
        if (!shove) continue;
        actor.rig.x = THREE.MathUtils.clamp(actor.rig.x + shove.dx, DEFAULT_WORLD.minX + wreckRadius, DEFAULT_WORLD.maxX - wreckRadius);
        actor.rig.z = THREE.MathUtils.clamp(actor.rig.z + shove.dz, DEFAULT_WORLD.minZ + wreckRadius, DEFAULT_WORLD.maxZ - wreckRadius);
        arena.updateCombatantRig(actor.id, actor.rig);
    }
}''')
replace('main.js',
'''    faultStrip.textContent = faults.length ? `⚠ ${faults.join(' · ')}` : 'SYSTEMS NOMINAL';
    faultStrip.classList.toggle('faulted', faults.length > 0);''',
'''    faultStrip.textContent = faults.length ? `⚠ ${faults.join(' · ')}` : 'SYSTEMS NOMINAL';
    faultStrip.classList.toggle('faulted', faults.length > 0);
    faultStrip.classList.toggle('nominal', faults.length === 0);
    renderPlayerDamageHUD();''')
replace('main.js',
'''const faultStrip = required('#fault-strip');
const teamStatus = required('#team-status');''',
'''const faultStrip = required('#fault-strip');
const teamStatus = required('#team-status');
const playerDamageHud = required('#player-damage-hud');
const hitConfirm = required('#hit-confirm');
const playerHitFlash = required('#player-hit-flash');
const playerDamageSegments = new Map([...playerDamageHud.querySelectorAll('[data-system]')].map(element => [element.dataset.system, element]));
let hitConfirmTimer = null;
let playerHitTimer = null;
let lastCoverAudit = '—';''')
replace('main.js',
'''for (const actor of supportActors)
    arena.addCombatant(actor.id, actor.assembly, actor.team, actor.spawn);
let rig = createRigState();''',
'''for (const actor of supportActors)
    arena.addCombatant(actor.id, actor.assembly, actor.team, actor.spawn);
arena.updateTargetDamage(targetCondition);
for (const actor of supportActors)
    arena.updateCombatantDamage(actor.id, actor.condition);
let rig = createRigState();''')
replace('main.js',
'''function renderSquadStatus() {
    const counts = squadCounts(playerCombatActive, aiActors);
    teamStatus.textContent = `ALLY ${counts.friendly}/3 · HOSTILE ${counts.hostile}/3`;
    teamStatus.classList.toggle('friendly-critical', counts.friendly <= 1);
    teamStatus.classList.toggle('hostile-critical', counts.hostile <= 1);
}''',
'''function renderSquadStatus() {
    const counts = squadCounts(playerCombatActive, aiActors);
    teamStatus.textContent = `ALLY ${counts.friendly}/3 · HOSTILE ${counts.hostile}/3`;
    teamStatus.classList.toggle('friendly-critical', counts.friendly <= 1);
    teamStatus.classList.toggle('hostile-critical', counts.hostile <= 1);
}
function playerPartRemaining(part) {
    if (!part) return 0;
    const total = Math.max(1, part.maxIntegrity + part.maxArmor);
    return Math.max(0, Math.min(1, (part.integrity + part.armor) / total));
}
function renderPlayerDamageHUD(flashSlot = null) {
    for (const slot of SLOTS) {
        const element = playerDamageSegments.get(slot);
        const part = playerCondition.parts[slot];
        if (!element || !part) continue;
        const ratio = playerPartRemaining(part);
        const value = element.querySelector('i');
        if (value) value.textContent = String(Math.round(ratio * 100));
        element.classList.toggle('breached', part.armor < part.maxArmor * .04);
        element.classList.toggle('damaged', ratio < .72);
        element.classList.toggle('severe', ratio < .38);
        element.classList.toggle('disabled', part.integrity <= 0);
        if (flashSlot === slot) {
            element.classList.remove('hit');
            void element.offsetWidth;
            element.classList.add('hit');
            window.setTimeout(() => element.classList.remove('hit'), 460);
        }
    }
}
function signalPlayerHit(slot, hit) {
    renderPlayerDamageHUD(slot);
    playerHitFlash.className = `player-hit-flash active hit-${slot}${hit.internalDamage > 0 ? ' breached' : ''}`;
    void playerHitFlash.offsetWidth;
    if (playerHitTimer !== null) window.clearTimeout(playerHitTimer);
    playerHitTimer = window.setTimeout(() => {
        playerHitFlash.className = 'player-hit-flash';
        playerHitTimer = null;
    }, 240);
}
function showHitConfirm(hit, text = null) {
    const kind = hit?.friendlyBlock ? 'friendly' : hit?.cleared ? 'cleared' : hit?.wreckHit ? 'wreck' : hit?.disabled ? 'disabled' : hit?.internalDamage > 0 ? 'breach' : 'armor';
    const label = text ?? (kind === 'disabled' ? 'DISABLED' : kind === 'breach' ? 'BREACH' : kind === 'cleared' ? 'WRECK CLEARED' : kind === 'wreck' ? 'WRECK' : kind === 'friendly' ? 'ALLY BLOCK' : 'HIT');
    hitConfirm.textContent = label;
    hitConfirm.className = `hit-confirm visible ${kind}`;
    rangeCrosshair.classList.add('confirmed-hit');
    rangeCrosshair.classList.toggle('breach-hit', kind === 'breach');
    rangeCrosshair.classList.toggle('disable-hit', kind === 'disabled' || kind === 'cleared');
    if (hitConfirmTimer !== null) window.clearTimeout(hitConfirmTimer);
    hitConfirmTimer = window.setTimeout(() => {
        hitConfirm.className = 'hit-confirm';
        rangeCrosshair.classList.remove('breach-hit', 'disable-hit');
        hitConfirmTimer = null;
    }, kind === 'disabled' || kind === 'cleared' ? 620 : 280);
}''')
replace('main.js',
'''    actor.killReason = reason;
    actor.targetId = null;
    actor.rig.vx = 0; actor.rig.vz = 0; actor.rig.yawRate = 0;
    arena.setCombatantActive(actor.id, false);''',
'''    actor.killReason = reason;
    actor.targetId = null;
    actor.wreckAge = 0;
    actor.wreckIntegrity = 1;
    actor.wreckCleared = false;
    actor.rig.vx = 0; actor.rig.vz = 0; actor.rig.yawRate = 0;
    arena.setCombatantActive(actor.id, false);''')
replace('main.js',
'''    actor.killReason = null;
    actor.driveDamage.drives = {};
    arena.setCombatantActive(actor.id, true);''',
'''    actor.killReason = null;
    actor.wreckAge = 0;
    actor.wreckIntegrity = 1;
    actor.wreckCleared = false;
    actor.driveDamage.drives = {};
    arena.setCombatantActive(actor.id, true);''')
replace('main.js',
'''    arena.updatePilotDamage(playerCondition);
    persistMachine();
    soundImpact();''',
'''    arena.updatePilotDamage(playerCondition);
    signalPlayerHit(contact.slot, visualHit);
    persistMachine();
    soundImpact();''', 1)
replace('main.js',
'''    const contact = arena.traceCombatantShot(actor.id, target.id, aimSlot, spreadX, spreadY);
    if (contact.slot === null || contact.actorId !== target.id) return;
    const consumed = fireWeapon(actor.weaponState, actor.weaponSpec);''',
'''    const contact = arena.traceCombatantShot(actor.id, target.id, aimSlot, spreadX, spreadY);
    const obstruction = contact.blockedBy ? `COVER ${contact.blockedBy}` : contact.actorId && contact.actorId !== target.id ? `RIG ${contact.actorId}` : null;
    lastCoverAudit = obstruction ? `${actor.id} → ${target.id} · BLOCKED · ${obstruction}` : `${actor.id} → ${target.id} · CLEAR`;
    if (showColliders) arena.updateShotAudit(contact, !obstruction && contact.actorId === target.id);
    if (contact.slot === null || contact.actorId !== target.id) return;
    const consumed = fireWeapon(actor.weaponState, actor.weaponSpec);''')
replace('main.js',
'''        if (!targetActor || targetActor.team !== HOSTILE_TEAM || !targetActor.active) return;
        const beforeIntegrity = targetActor.condition.parts[contact.slot].integrity;''',
'''        if (!targetActor) return;
        if (targetActor.team !== HOSTILE_TEAM) {
            arena.showShot(contact, null);
            soundImpact();
            showHitConfirm({ friendlyBlock: true });
            lastHit = `ALLY BLOCK · ${targetActor.label}`;
            renderAmmo();
            return;
        }
        if (!targetActor.active) {
            targetActor.wreckIntegrity = damageWreckIntegrity(targetActor.wreckIntegrity, weaponSpec.damage);
            const cleared = targetActor.wreckIntegrity <= .001;
            if (cleared && !targetActor.wreckCleared) {
                targetActor.wreckCleared = true;
                arena.setCombatantCleared(targetActor.id, true);
            }
            const wreckHit = { slot: contact.slot, internalDamage: weaponSpec.damage, armorAbsorbed: 0, disabled: true, justDisabled: false, wreckHit: true, cleared };
            arena.showShot(contact, wreckHit);
            soundImpact();
            showHitConfirm(wreckHit);
            lastHit = `${targetActor.label} · WRECK ${Math.round(targetActor.wreckIntegrity * 100)}%`;
            renderAmmo();
            return;
        }
        const beforeIntegrity = targetActor.condition.parts[contact.slot].integrity;''')
replace('main.js',
'''        soundImpact();
        recoilFlash = .19;
        lastHit = `${targetActor.label} · ${targetLabels[hit.slot]} · ${hit.serial}`;
        shotReport.classList.toggle('penetrated', hit.internalDamage > 0);
        shotReport.classList.toggle('disabled-part', hit.disabled);
        const outcome = hit.disabled ? 'MODULE DISABLED' : hit.internalDamage > 0 ? 'ARMOR BREACHED' : 'ARMOR IMPACT';
        shotReport.textContent = `${outcome} · ${lastHit} · ARMOR −${hit.armorAbsorbed} · INTERNAL −${hit.internalDamage}`;''',
'''        soundImpact();
        recoilFlash = .19;
        lastHit = `${targetActor.label} · ${targetLabels[hit.slot]} · ${hit.serial}`;
        showHitConfirm(hit);''')
replace('main.js',
'''    else {
        arena.showShot(contact, null);
        lastHit = 'RANGE SURFACE / MISS';
        shotReport.classList.remove('penetrated', 'disabled-part');
        shotReport.textContent = 'NO TARGET HIT · ADJUST AIM';
    }
    reportFade = 2.2;
    renderAmmo();''',
'''    else {
        arena.showShot(contact, null);
        lastHit = contact.blockedBy ? `COVER · ${contact.blockedBy}` : 'RANGE SURFACE / MISS';
    }
    renderAmmo();''')
replace('main.js',
'''            if (playerCombatActive) {
                const yawBefore = rig.yaw;
                stepRig(rig, { throttle: input.throttle, strafe: input.strafe, steer: bodySteer, brake: input.brake }, FIXED_DT, effectiveConfig, combatWorldFor('player'));
                if (Math.abs(followSteer) > .001) {''',
'''            if (playerCombatActive) {
                const yawBefore = rig.yaw;
                stepRig(rig, { throttle: input.throttle, strafe: input.strafe, steer: bodySteer, brake: input.brake }, FIXED_DT, effectiveConfig, combatWorldFor('player'));
                shoveDisabledWrecks(rig, effectiveConfig);
                if (Math.abs(followSteer) > .001) {''')
replace('main.js',
'''            for (const actor of aiActors) {
                if (!actor.active) continue;
                const target = resolveActorTarget(actor);''',
'''            for (const actor of aiActors) {
                if (!actor.active) {
                    actor.wreckAge += FIXED_DT;
                    continue;
                }
                const target = resolveActorTarget(actor);''')
replace('main.js',
'''                stepRig(actor.rig, maneuver, FIXED_DT, actorConfig, combatWorldFor(actor.id));
                arena.updateCombatantRig(actor.id, actor.rig);''',
'''                stepRig(actor.rig, maneuver, FIXED_DT, actorConfig, combatWorldFor(actor.id));
                shoveDisabledWrecks(actor.rig, actorConfig);
                arena.updateCombatantRig(actor.id, actor.rig);''')
replace('main.js',
'''    rangeCrosshair.classList.toggle('confirmed-hit', recoilFlash > 0);
    shotReport.classList.toggle('faded', reportFade === 0);''',
'''    rangeCrosshair.classList.toggle('confirmed-hit', recoilFlash > 0 || hitConfirmTimer !== null);
    shotReport.classList.toggle('faded', reportFade === 0);''')
replace('main.js',
'''            `NAV       ${hostileMotion.navigation} · STUCK ${hostileMotion.stuckSeconds.toFixed(1)}s`,
            `WAYPOINT  ${hostileMotion.waypoint ? `${hostileMotion.waypoint.x.toFixed(1)} / ${hostileMotion.waypoint.z.toFixed(1)}` : 'NONE'}`,''',
'''            `NAV       ${hostileMotion.navigation} · STUCK ${hostileMotion.stuckSeconds.toFixed(1)}s`,
            `LOS AUDIT ${lastCoverAudit}`,
            `WAYPOINT  ${hostileMotion.waypoint ? `${hostileMotion.waypoint.x.toFixed(1)} / ${hostileMotion.waypoint.z.toFixed(1)}` : 'NONE'}`,''')
replace('main.js', "devToggle.addEventListener('click', () => devPanel.classList.toggle('hidden'));", "devToggle.addEventListener('click', () => { devPanel.classList.toggle('hidden'); renderTarget(); });")
replace('main.js',
'''toggleColliders.addEventListener('click', () => {
    showColliders = !showColliders;
    arena.debugColliders.visible = showColliders;
    toggleColliders.textContent = `COLLIDERS: ${showColliders ? 'ON' : 'OFF'}`;
});''',
'''toggleColliders.addEventListener('click', () => {
    showColliders = !showColliders;
    arena.debugColliders.visible = showColliders;
    if (!showColliders) arena.updateShotAudit(null, false);
    toggleColliders.textContent = `COLLIDERS: ${showColliders ? 'ON' : 'OFF'}`;
});''')
replace('main.js',
'''function renderTarget() {
    targetReadout.replaceChildren();
    const behavior = document.createElement('div');
    behavior.className = 'target-row';
    behavior.textContent = `MOTION: ${hostileMotion.phase} · ${hostileMotion.navigation} · DRIVE ${Math.round(hostileOutput(targetCondition).mobility * 100)}%`;
    targetReadout.appendChild(behavior);
    for (const slot of SLOTS) {''',
'''function renderTarget() {
    targetReadout.replaceChildren();
    const behavior = document.createElement('div');
    behavior.className = 'target-row';
    behavior.textContent = `MOTION: ${hostileMotion.phase} · ${hostileMotion.navigation}`;
    targetReadout.appendChild(behavior);
    if (devPanel.classList.contains('hidden')) {
        const withheld = document.createElement('div');
        withheld.className = 'target-row';
        withheld.textContent = 'REMOTE MODULE TELEMETRY WITHHELD · USE VISUAL DAMAGE / HIT CONFIRMATION';
        targetReadout.appendChild(withheld);
        return;
    }
    for (const slot of SLOTS) {''')

# Ensure initial damage strip exists before the first animation frame.
replace('main.js', 'updateFunctionalStatus();\nrenderEconomy();\nrenderAmmo();\nrenderTarget();', 'updateFunctionalStatus();\nrenderPlayerDamageHUD();\nrenderEconomy();\nrenderAmmo();\nrenderTarget();')

# --- UI hierarchy: player condition first; transient enemy feedback only around the reticle.
append('styles.css', r'''
/* k.3k.1 — combat readability hierarchy. Persistent HUD answers team/ammo/self-condition;
   enemy damage is transient reticle feedback, not a competing telemetry panel. */
.team-status {
  top:max(8px,env(safe-area-inset-top)); padding:3px 8px; font-size:8px; letter-spacing:.10em;
  background:rgba(14,20,17,.76); z-index:13;
}
.look-heading { top:max(36px,calc(env(safe-area-inset-top) + 30px)); padding:3px 8px; font-size:7px; opacity:.72; }
.player-damage-hud {
  position:absolute; z-index:13; top:max(57px,calc(env(safe-area-inset-top) + 51px)); left:50%; transform:translateX(-50%);
  display:grid; grid-template-columns:repeat(5,42px); gap:3px; pointer-events:none;
}
.player-damage-hud span {
  position:relative; display:grid; grid-template-columns:1fr auto; gap:3px; align-items:center; min-height:20px;
  padding:3px 4px; border:1px solid #62866d55; background:#111a16c9; color:#8eb59a;
  font:700 6px/1 ui-monospace,monospace; letter-spacing:.04em; overflow:hidden;
}
.player-damage-hud b { font:inherit; }
.player-damage-hud i { color:#bdd8c0; font:700 7px/1 ui-monospace,monospace; font-style:normal; }
.player-damage-hud span::after { content:''; position:absolute; left:0; bottom:0; width:100%; height:2px; background:#70a77b66; }
.player-damage-hud span.breached { border-color:#c59c5588; color:#d7bb7d; }
.player-damage-hud span.damaged { background:#302b1dcc; color:#d7bd77; }
.player-damage-hud span.severe { border-color:#dd8259aa; background:#40231bcc; color:#f0a271; }
.player-damage-hud span.disabled { border-color:#e45d4fbb; background:#481c18e8; color:#ff8a75; }
.player-damage-hud span.hit { animation:playerSystemHit .44s ease-out; }
@keyframes playerSystemHit { 0%{box-shadow:0 0 0 2px #fff2b8,inset 0 0 14px #f19b55cc;transform:scale(1.08)} 100%{box-shadow:none;transform:scale(1)} }
.fault-strip { top:max(82px,calc(env(safe-area-inset-top) + 76px)); font-size:8px; padding:3px 7px; transition:opacity .18s; }
.fault-strip.nominal { opacity:0; }
.shot-report { top:max(106px,calc(env(safe-area-inset-top) + 100px)); max-width:48vw; font-size:8px; padding:5px 7px; }
.weapon-hud { width:min(155px,24vw); padding:4px 7px; }
.weapon-hud strong { font-size:14px; }
.control-caption { display:none; }
.rig-tag { opacity:.42; font-size:7px; }
.hit-confirm {
  position:absolute; z-index:15; left:50%; top:calc(50% + 20px); transform:translateX(-50%);
  opacity:0; pointer-events:none; color:#e6d7aa; font:800 7px/1 ui-monospace,monospace; letter-spacing:.12em;
  text-shadow:0 0 8px #000; transition:opacity .08s;
}
.hit-confirm.visible { opacity:1; }
.hit-confirm.breach { color:#f0b86e; }
.hit-confirm.disabled,.hit-confirm.cleared { color:#ff8e66; font-size:8px; }
.hit-confirm.friendly { color:#7ce3a0; }
.hit-confirm.wreck { color:#c7b08a; }
.center-crosshair.confirmed-hit { color:#f2d38c; font-size:20px; text-shadow:0 0 8px #d69247; }
.center-crosshair.breach-hit { color:#ffb466; text-shadow:0 0 10px #e8763a; }
.center-crosshair.disable-hit { color:#ff795b; font-size:24px; text-shadow:0 0 13px #ff6b45; }
.player-hit-flash { position:absolute; inset:0; z-index:11; pointer-events:none; opacity:0; border:0 solid transparent; }
.player-hit-flash.active { animation:playerHitEdge .24s ease-out; }
.player-hit-flash.active.breached { animation-name:playerBreachEdge; }
@keyframes playerHitEdge { 0%{opacity:.8;border-width:8px;border-color:#d6a35c88;box-shadow:inset 0 0 42px #bb6b3477} 100%{opacity:0;border-width:2px;border-color:transparent;box-shadow:none} }
@keyframes playerBreachEdge { 0%{opacity:.92;border-width:10px;border-color:#ef7d596f;box-shadow:inset 0 0 58px #d34f395e} 100%{opacity:0;border-width:2px;border-color:transparent;box-shadow:none} }
body.inspecting .player-damage-hud,body.inspecting .hit-confirm,body.inspecting .player-hit-flash { display:none; }
@media(max-height:430px){
  .team-status{top:max(6px,env(safe-area-inset-top));}
  .look-heading{top:max(31px,calc(env(safe-area-inset-top) + 26px));}
  .player-damage-hud{top:max(49px,calc(env(safe-area-inset-top) + 44px));grid-template-columns:repeat(5,37px);}
  .player-damage-hud span{min-height:17px;padding:2px 3px;font-size:5px;}
  .fault-strip{top:max(70px,calc(env(safe-area-inset-top) + 63px));}
  .shot-report{top:max(91px,calc(env(safe-area-inset-top) + 84px));}
}
''')
