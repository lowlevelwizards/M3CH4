from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'anchor missing in {path}: {old[:120]!r}')
    p.write_text(text.replace(old, new, 1))

# scene.js — mech-tethered combiner, perimeter placement, cover certification.
replace_once('scene.js',
"import { impactProfile, integrityRatio, persistentFailureProfile } from './damageVisuals.js';\nconst C = {",
"import { impactProfile, integrityRatio, persistentFailureProfile } from './damageVisuals.js';\nimport { combinerTetherFromLook } from './cockpitView.js';\nimport { firstCoverHit } from './coverTruth.js';\nconst C = {")

replace_once('scene.js',
"""    const combinerLayout = {
        systems: { position: [-.086, .004, -.090], scale: .060 },
        team:    { position: [ 0.000, .051, -.090], scale: .050 },
        weapon:  { position: [ .084, .010, -.090], scale: .058 },
        motion:  { position: [-.041,-.038, -.090], scale: .050 },
        drive:   { position: [ .023,-.039, -.090], scale: .052 },
    };""",
"""    const combinerLayout = {
        // Keep persistent information on the bezel. The middle of the windshield is
        // reserved for the world, reticle and genuinely transient combat events.
        systems: { position: [-.122, .002, -.105], scale: .055 },
        team:    { position: [ 0.000, .060, -.105], scale: .043 },
        weapon:  { position: [ .118,-.006, -.105], scale: .052 },
        motion:  { position: [-.078,-.056, -.105], scale: .044 },
        drive:   { position: [ .004,-.059, -.105], scale: .044 },
    };""")

replace_once('scene.js',
"    glassDamage.position.set(0, 0, -.075); glassDamage.renderOrder = 100; camera.add(glassDamage);",
"    glassDamage.position.set(0, 0, -.086); glassDamage.renderOrder = 100; combinerHud.add(glassDamage);")

replace_once('scene.js',
"""    const raycaster = new THREE.Raycaster();
    let selected = null;""",
"""    const raycaster = new THREE.Raycaster();
    // Mesh raycasts remain responsible for exact module hits. This independent prism
    // certificate makes arena cover authoritative too, so a precision seam or visual
    // cover decoration can never permit a target hit through the obstacle volume.
    function certifiedCoverHit(muzzle, bore, maxDistance, actual) {
        const meshDistance = actual ? muzzle.distanceTo(actual.point) : maxDistance;
        const cover = firstCoverHit(muzzle, bore, DEFAULT_WORLD.obstacles, maxDistance, .035);
        if (!cover || cover.distance >= meshDistance - .005) return null;
        return {
            id: cover.id,
            distance: cover.distance,
            point: new THREE.Vector3(...cover.point),
            normal: new THREE.Vector3(...cover.normal),
        };
    }
    let selected = null;""")

replace_once('scene.js',
"""        const mobilityStumble = Math.sin(nowMs * .026) * driveDamage * Math.min(Math.abs(state.forwardSpeed) / 2.8, 1) * .008;
        gunPivot.rotation.set(lookPitch * .85, lookYaw * .85, gunDamageKick * damageWave * .16, 'YXZ');""",
"""        const mobilityStumble = Math.sin(nowMs * .026) * driveDamage * Math.min(Math.abs(state.forwardSpeed) / 2.8, 1) * .008;
        // The camera is the pilot's head; the combiner belongs to the mech. Inverse
        // free-look keeps the display on the windshield until chassis body-follow catches up.
        const tether = combinerTetherFromLook(lookYaw, lookPitch);
        combinerHud.rotation.set(
            tether.pitch + cockpitPitch * .65 - hitPitchKick * .35,
            tether.yaw - hitYawKick * .10,
            cockpitRoll * .75 - hitRollKick * .25 + sustainedDriveRoll * .28,
            'YXZ');
        gunPivot.rotation.set(lookPitch * .85, lookYaw * .85, gunDamageKick * damageWave * .16, 'YXZ');""")

old_trace = """        const actual = raycaster.intersectObjects([...combatPickMeshes(), ...worldSolids], false)[0];
        const point = actual ? actual.point.clone() : muzzle.clone().addScaledVector(bore, 100);
        const surfaceNormal = actual?.face
            ? actual.face.normal.clone().transformDirection(actual.object.matrixWorld)
            : bore.clone().negate();
        const slot = actual?.object.userData.slot;
        const actorId = actual?.object.userData.actorId ?? null;
        const blockedBy = actual?.object.userData.arenaObstacleId ?? null;
        return { actorId: slot ? actorId : null, slot: slot ?? null, blockedBy, point, normal: surfaceNormal, muzzle, distance: muzzle.distanceTo(point) };"""
new_trace = """        const actual = raycaster.intersectObjects([...combatPickMeshes(), ...worldSolids], false)[0];
        const cover = certifiedCoverHit(muzzle, bore, 100, actual);
        const point = cover ? cover.point : actual ? actual.point.clone() : muzzle.clone().addScaledVector(bore, 100);
        const surfaceNormal = cover ? cover.normal : actual?.face
            ? actual.face.normal.clone().transformDirection(actual.object.matrixWorld)
            : bore.clone().negate();
        const slot = cover ? null : actual?.object.userData.slot;
        const actorId = cover ? null : actual?.object.userData.actorId ?? null;
        const blockedBy = cover?.id ?? actual?.object.userData.arenaObstacleId ?? null;
        return { actorId: slot ? actorId : null, slot: slot ?? null, blockedBy, point, normal: surfaceNormal, muzzle, distance: muzzle.distanceTo(point) };"""
replace_once('scene.js', old_trace, new_trace)

old_ai_trace = """        const actual = raycaster.intersectObjects(blockers, false)[0];
        const point = actual ? actual.point.clone() : muzzle.clone().addScaledVector(bore, 100);
        const surfaceNormal = actual?.face
            ? actual.face.normal.clone().transformDirection(actual.object.matrixWorld)
            : bore.clone().negate();
        const slot = actual?.object.userData.slot;
        const actorId = actual?.object.userData.actorId ?? null;
        const blockedBy = actual?.object.userData.arenaObstacleId ?? null;
        let driveSide;"""
new_ai_trace = """        const actual = raycaster.intersectObjects(blockers, false)[0];
        const cover = certifiedCoverHit(muzzle, bore, 100, actual);
        const point = cover ? cover.point : actual ? actual.point.clone() : muzzle.clone().addScaledVector(bore, 100);
        const surfaceNormal = cover ? cover.normal : actual?.face
            ? actual.face.normal.clone().transformDirection(actual.object.matrixWorld)
            : bore.clone().negate();
        const slot = cover ? null : actual?.object.userData.slot;
        const actorId = cover ? null : actual?.object.userData.actorId ?? null;
        const blockedBy = cover?.id ?? actual?.object.userData.arenaObstacleId ?? null;
        let driveSide;"""
replace_once('scene.js', old_ai_trace, new_ai_trace)

# Every visibly opaque world solid now identifies itself to ballistic diagnostics.
replace_once('scene.js',
"    floor.position.set((DEFAULT_WORLD.minX + DEFAULT_WORLD.maxX) / 2, -0.18, (DEFAULT_WORLD.minZ + DEFAULT_WORLD.maxZ) / 2);\n    scene.add(floor);",
"    floor.position.set((DEFAULT_WORLD.minX + DEFAULT_WORLD.maxX) / 2, -0.18, (DEFAULT_WORLD.minZ + DEFAULT_WORLD.maxZ) / 2);\n    floor.userData.arenaObstacleId = 'floor';\n    scene.add(floor);")
for name, obstacle_id in [('north','wall-north'),('south','wall-south'),('west','wall-west'),('east','wall-east')]:
    replace_once('scene.js',
        f"    {name}.position.set(" + ({
            'north': "centerX, wallHeight / 2, DEFAULT_WORLD.minZ - wallOffset);\n    scene.add(north);",
            'south': "centerX, wallHeight / 2, DEFAULT_WORLD.maxZ + wallOffset);\n    scene.add(south);",
            'west': "DEFAULT_WORLD.minX - wallOffset, wallHeight / 2, centerZ);\n    scene.add(west);",
            'east': "DEFAULT_WORLD.maxX + wallOffset, wallHeight / 2, centerZ);\n    scene.add(east);",
        }[name]),
        f"    {name}.position.set(" + ({
            'north': f"centerX, wallHeight / 2, DEFAULT_WORLD.minZ - wallOffset);\n    north.userData.arenaObstacleId = '{obstacle_id}';\n    scene.add(north);",
            'south': f"centerX, wallHeight / 2, DEFAULT_WORLD.maxZ + wallOffset);\n    south.userData.arenaObstacleId = '{obstacle_id}';\n    scene.add(south);",
            'west': f"DEFAULT_WORLD.minX - wallOffset, wallHeight / 2, centerZ);\n    west.userData.arenaObstacleId = '{obstacle_id}';\n    scene.add(west);",
            'east': f"DEFAULT_WORLD.maxX + wallOffset, wallHeight / 2, centerZ);\n    east.userData.arenaObstacleId = '{obstacle_id}';\n    scene.add(east);",
        }[name]))

replace_once('scene.js',
"""            cap.position.set(object.position.x, h + .04, object.position.z);
            scene.add(cap);""",
"""            cap.position.set(object.position.x, h + .04, object.position.z);
            cap.userData.arenaObstacleId = obstacle.id;
            scene.add(cap);
            solids.push(cap);""")
replace_once('scene.js',
"""                rib.position.set(object.position.x + side * (w / 2 - .10), h * .5, object.position.z);
                scene.add(rib);""",
"""                rib.position.set(object.position.x + side * (w / 2 - .10), h * .5, object.position.z);
                rib.userData.arenaObstacleId = obstacle.id;
                scene.add(rib);
                solids.push(rib);""")

# main.js — diagnostics distinguish cover/world blockage from a genuine clear shot.
replace_once('main.js',
"""    const obstruction = contact.blockedBy ? `COVER ${contact.blockedBy}` : contact.actorId && contact.actorId !== target.id ? `RIG ${contact.actorId}` : null;
    lastCoverAudit = obstruction ? `${actor.id} → ${target.id} · BLOCKED · ${obstruction}` : `${actor.id} → ${target.id} · CLEAR`;""",
"""    const obstruction = contact.blockedBy ? `COVER ${contact.blockedBy}` :
        contact.actorId && contact.actorId !== target.id ? `RIG ${contact.actorId}` :
        contact.slot === null && contact.distance < 99.5 ? 'WORLD GEOMETRY' : null;
    lastCoverAudit = contact.actorId === target.id
        ? `${actor.id} → ${target.id} · CLEAR · TARGET FIRST`
        : obstruction ? `${actor.id} → ${target.id} · BLOCKED · ${obstruction}`
            : `${actor.id} → ${target.id} · MISS`;""")

# sceneAssembly cache key.
replace_once('sceneAssembly.js',
"import { createArenaScene as createBaseArenaScene } from './scene.js?source=k3k3';",
"import { createArenaScene as createBaseArenaScene } from './scene.js?source=k3k4';")

# index.html cache/version keys and new pure modules.
replace_once('index.html',
"    \"./scene.js\": \"./sceneAssembly.js?v=k3k3\",",
"    \"./scene.js\": \"./sceneAssembly.js?v=k3k4\",")
replace_once('index.html',
"    \"./combatPresentation.js\": \"./combatPresentation.js?v=k3k3\"",
"    \"./combatPresentation.js\": \"./combatPresentation.js?v=k3k3\",\n    \"./cockpitView.js\": \"./cockpitView.js?v=k3k4\",\n    \"./coverTruth.js\": \"./coverTruth.js?v=k3k4\"")
replace_once('index.html',
"    <title>MECH ARENA — 0.0.1k.3k.3 — Cockpit HUD + Damage Escalation</title>",
"    <title>MECH ARENA — 0.0.1k.3k.4 — Combiner Anchoring + Cover Truth</title>")
replace_once('index.html',
"      <header>RIG DIAGNOSTICS <span>0.0.1k.3k.3</span></header>",
"      <header>RIG DIAGNOSTICS <span>0.0.1k.3k.4</span></header>")
replace_once('index.html',
"    <script type=\"module\" src=\"./main.js?v=k3k3\"></script>",
"    <script type=\"module\" src=\"./main.js?v=k3k4\"></script>")
