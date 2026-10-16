from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'anchor missing in {path}: {old[:100]!r}')
    p.write_text(text.replace(old, new, 1))

# --- index / cache keys / sortie outro -------------------------------------------------
p = Path('index.html')
text = p.read_text()
text = text.replace('"./scene.js": "./sceneAssembly.js?v=k3k1"', '"./scene.js": "./sceneAssembly.js?v=k3k2"')
text = text.replace('"./wreckPhysics.js": "./wreckPhysics.js?v=k3k1"', '"./wreckPhysics.js": "./wreckPhysics.js?v=k3k1",\n    "./combatPresentation.js": "./combatPresentation.js?v=k3k2"')
text = text.replace('./styles.css?v=k3k1', './styles.css?v=k3k2')
text = text.replace('0.0.1k.3k.1 — Combat Readability + Impact', '0.0.1k.3k.2 — Cockpit Embodiment + Sortie Flow')
text = text.replace('RIG DIAGNOSTICS <span>0.0.1k.3k.1</span>', 'RIG DIAGNOSTICS <span>0.0.1k.3k.2</span>')
text = text.replace('<script type="module" src="./main.js?v=k3k1"></script>', '<script type="module" src="./main.js?v=k3k2"></script>')
outro = '''    <div id="sortie-outro" class="sortie-outro hidden" aria-live="assertive" aria-hidden="true">\n      <small>SCRAPYARD LIVE FIRE</small>\n      <strong id="sortie-outro-title">SORTIE COMPLETE</strong>\n      <span id="sortie-outro-reason">HOSTILE TEAM COMBAT INEFFECTIVE</span>\n    </div>\n\n'''
anchor = '    <div id="sortie-debrief" class="sheet hidden" role="dialog" aria-label="Sortie result" aria-modal="true" aria-hidden="true">'
if anchor not in text:
    raise SystemExit('index sortie debrief anchor missing')
text = text.replace(anchor, outro + anchor, 1)
p.write_text(text)

# --- presentation helpers --------------------------------------------------------------
Path('combatPresentation.js').write_text(r'''/** k.3k.2 presentation tuning only. Combat/damage math stays authoritative elsewhere. */
export const SORTIE_OUTRO_SECONDS = 2.65;

const clamp01 = value => Math.max(0, Math.min(1, Number(value) || 0));

/** Translate one localized player hit into cockpit motion/electrical feedback.
 * Internal damage, not an armor ping, is what unlocks the dramatic subsystem reaction. */
export function cockpitImpactProfile(slot, { internalDamage = 0, disabled = false, driveSide = null } = {}) {
    const internal = Math.max(0, Number(internalDamage) || 0);
    const severity = clamp01((internal > 0 ? .35 : .12) + internal / 80 + (disabled ? .42 : 0));
    const base = {
        severity,
        shake: .012 + severity * .038,
        pitch: 0,
        roll: 0,
        yaw: 0,
        blackoutSeconds: 0,
        flickerSeconds: internal > 0 ? .28 + severity * .35 : .08,
        sparkCount: internal > 0 ? 3 + Math.round(severity * 5) : 1,
        gunShake: 0,
    };
    if (slot === 'structure') {
        base.pitch = -.018 - severity * .045;
        base.shake *= 1.35;
    }
    else if (slot === 'mobility') {
        const side = driveSide === 'right' ? -1 : 1;
        base.roll = side * (.025 + severity * .07);
        base.pitch = .008 * severity;
    }
    else if (slot === 'power') {
        base.pitch = -.012 - severity * .025;
        base.blackoutSeconds = internal > 0 ? (disabled ? .34 : .11 + severity * .12) : 0;
        base.flickerSeconds = internal > 0 ? .55 + severity * .65 : .12;
        base.sparkCount += internal > 0 ? 5 : 1;
    }
    else if (slot === 'command') {
        base.yaw = (disabled ? .045 : .018) * (severity + .4);
        base.pitch = -.012 * severity;
        base.sparkCount += internal > 0 ? 3 : 0;
    }
    else if (slot === 'combat') {
        base.roll = -.015 - severity * .035;
        base.gunShake = .12 + severity * .22;
        base.sparkCount += internal > 0 ? 4 : 1;
    }
    return base;
}
''')

Path('tests/combatPresentation.test.mjs').write_text(r'''import test from 'node:test';
import assert from 'node:assert/strict';
import { SORTIE_OUTRO_SECONDS, cockpitImpactProfile } from '../combatPresentation.js';

test('sortie outro leaves a readable battlefield beat before debrief', () => {
  assert.ok(SORTIE_OUTRO_SECONDS >= 2.4 && SORTIE_OUTRO_SECONDS <= 3.2);
});

test('power internals cause blackout/flicker while armor pings stay restrained', () => {
  const armor = cockpitImpactProfile('power', { internalDamage: 0 });
  const internal = cockpitImpactProfile('power', { internalDamage: 30 });
  assert.equal(armor.blackoutSeconds, 0);
  assert.ok(internal.blackoutSeconds > 0);
  assert.ok(internal.flickerSeconds > armor.flickerSeconds);
  assert.ok(internal.sparkCount > armor.sparkCount);
});

test('mobility hit attitude identifies the struck drive side', () => {
  const left = cockpitImpactProfile('mobility', { internalDamage: 20, driveSide: 'left' });
  const right = cockpitImpactProfile('mobility', { internalDamage: 20, driveSide: 'right' });
  assert.ok(left.roll > 0);
  assert.ok(right.roll < 0);
});

test('combat internals shake the physical weapon mount', () => {
  assert.ok(cockpitImpactProfile('combat', { internalDamage: 20 }).gunShake > 0);
});
''')

# --- sceneAssembly: never steal AI groups when serials collide -------------------------
replace_once('sceneAssembly.js',
'''function findPartGroup(scene, slot, serial) {\n    if (!serial) return null;\n    let found = null;\n    scene.traverse(object => {\n        if (object.type === 'Group' && object.name.startsWith(`${slot}: `) &&\n            object.name.endsWith(`(${serial})`)) found = object;\n    });\n    return found;\n}''',
'''function findPartGroup(scene, slot, serial) {\n    if (!serial) return null;\n    let found = null;\n    scene.traverse(object => {\n        if (found || object.type !== 'Group' || !object.name.startsWith(`${slot}: `) ||\n            !object.name.endsWith(`(${serial})`)) return;\n        // 3v3 rigs can legitimately share definition/serial-looking names. Graph alignment\n        // belongs only to the owned player exterior; never reparent an AI module into it.\n        let belongsToPlayer = false;\n        object.traverse(child => {\n            if (child.isMesh && child.userData.actorId === 'player') belongsToPlayer = true;\n        });\n        if (belongsToPlayer) found = object;\n    });\n    return found;\n}''')
replace_once('sceneAssembly.js', "import { createArenaScene as createBaseArenaScene } from './scene.js?source=k3k1';", "import { createArenaScene as createBaseArenaScene } from './scene.js?source=k3k2';")

# --- scene: physical displays, damage reactions, pristine actor transforms -------------
replace_once('scene.js',
'''    const camera = new THREE.PerspectiveCamera(68, 1, 0.06, 125);\n    camera.rotation.order = 'YXZ';''',
'''    const camera = new THREE.PerspectiveCamera(68, 1, 0.06, 125);\n    camera.rotation.order = 'YXZ';\n    scene.add(camera);''')

replace_once('scene.js',
'''    const primaryMarker = makeSquadMarker('hostile');\n    squadCombatants.set('enemy-0', {\n        id: 'enemy-0', team: 'hostile', assembly: targetAssembly, exterior: targetExterior,\n        colors: targetColors, marker: primaryMarker, active: true, condition: null,\n        emitterBudget: makeEmitterBudget(), disabledSlots: new Set(), wrecked: false, cleared: false,\n    });''',
'''    const capturePartTransforms = exterior => new Map([...exterior.partGroups].map(([slot, group]) => [slot, {\n        position: group.position.clone(), rotation: group.rotation.clone(), scale: group.scale.clone(),\n    }]));\n    const primaryMarker = makeSquadMarker('hostile');\n    squadCombatants.set('enemy-0', {\n        id: 'enemy-0', team: 'hostile', assembly: targetAssembly, exterior: targetExterior,\n        colors: targetColors, marker: primaryMarker, active: true, condition: null,\n        emitterBudget: makeEmitterBudget(), disabledSlots: new Set(), wrecked: false, cleared: false,\n        baseParts: capturePartTransforms(targetExterior),\n    });''')

replace_once('scene.js',
'''            marker: makeSquadMarker(team), active: true, condition: null,\n            emitterBudget: makeEmitterBudget(), disabledSlots: new Set(), wrecked: false, cleared: false,\n        };''',
'''            marker: makeSquadMarker(team), active: true, condition: null,\n            emitterBudget: makeEmitterBudget(), disabledSlots: new Set(), wrecked: false, cleared: false,\n            baseParts: capturePartTransforms(actorExterior),\n        };''')

replace_once('scene.js',
'''        for (const slot of SLOTS) {\n            const group = record.exterior.partGroups.get(slot);\n            const fitted = installedPart(record.assembly, slot);\n            if (!group || !fitted) continue;\n            group.position.set(...fitted.definition.center);\n            group.rotation.set(0, 0, 0);\n            group.scale.set(1, 1, 1);\n        }''',
'''        for (const slot of SLOTS) {\n            const group = record.exterior.partGroups.get(slot);\n            const base = record.baseParts.get(slot);\n            if (!group || !base) continue;\n            group.position.copy(base.position);\n            group.rotation.copy(base.rotation);\n            group.scale.copy(base.scale);\n        }''')

# Physical cockpit screens and lamps.
replace_once('scene.js',
'''    cockpit.userData.gunBreech = breech;\n    cockpit.userData.flashMesh = flashMesh;\n    return cockpit;''',
'''    cockpit.userData.gunBreech = breech;\n    cockpit.userData.flashMesh = flashMesh;\n\n    const makeScreen = (name, width, height, x, y, z, rotationX = -.18) => {\n        const canvas = document.createElement('canvas');\n        canvas.width = width; canvas.height = height;\n        const texture = new THREE.CanvasTexture(canvas);\n        texture.magFilter = THREE.NearestFilter; texture.minFilter = THREE.NearestFilter;\n        const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: .94, toneMapped: false });\n        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width / 250, height / 250), material);\n        mesh.name = `cockpit-screen:${name}`;\n        mesh.position.set(x, y, z); mesh.rotation.x = rotationX;\n        cockpit.add(mesh);\n        return { canvas, texture, mesh, ctx: canvas.getContext('2d') };\n    };\n    const screens = {\n        systems: makeScreen('systems', 192, 76, -.43, 1.94, -1.195),\n        weapon: makeScreen('weapon', 150, 76, .43, 1.94, -1.195),\n        team: makeScreen('team', 138, 42, 0, 2.20, -1.02, -.10),\n    };\n    const amberLampMat = new THREE.MeshStandardMaterial({ color: 0x6b572a, emissive: 0xe0a44c, emissiveIntensity: .08, roughness: .65 });\n    const redLampMat = new THREE.MeshStandardMaterial({ color: 0x5b281f, emissive: 0xff4938, emissiveIntensity: .03, roughness: .65 });\n    const amberLamp = box(.12, .08, .04, amberLampMat); amberLamp.position.set(-.69, 2.14, -1.03); cockpit.add(amberLamp);\n    const redLamp = box(.12, .08, .04, redLampMat); redLamp.position.set(.69, 2.14, -1.03); cockpit.add(redLamp);\n    const amberWash = new THREE.PointLight(0xe0a44c, 0, 2.8, 2); amberWash.position.set(-.62, 2.22, -.86); cockpit.add(amberWash);\n    const redWash = new THREE.PointLight(0xff4938, 0, 3.0, 2); redWash.position.set(.62, 2.22, -.86); cockpit.add(redWash);\n    cockpit.userData.instrumentScreens = screens;\n    cockpit.userData.warningLamps = { amberLampMat, redLampMat, amberWash, redWash };\n    return cockpit;''')

# Camera-attached glass damage and blackout plus instrument painter / hit trigger.
replace_once('scene.js',
'''    const smokePool = makePool(28, new THREE.BoxGeometry(.15, .15, .15), 0x252a26, true);\n    let sparkCursor = 0, chipCursor = 0, smokeCursor = 0;''',
'''    const smokePool = makePool(28, new THREE.BoxGeometry(.15, .15, .15), 0x252a26, true);\n    let sparkCursor = 0, chipCursor = 0, smokeCursor = 0;\n\n    const glassCanvas = document.createElement('canvas');\n    glassCanvas.width = 512; glassCanvas.height = 300;\n    const glassTexture = new THREE.CanvasTexture(glassCanvas);\n    glassTexture.magFilter = THREE.NearestFilter; glassTexture.minFilter = THREE.NearestFilter;\n    const glassMaterial = new THREE.MeshBasicMaterial({ map: glassTexture, transparent: true, opacity: .82, depthTest: false, depthWrite: false, toneMapped: false });\n    const glassDamage = new THREE.Mesh(new THREE.PlaneGeometry(.195, .114), glassMaterial);\n    glassDamage.position.set(0, 0, -.075); glassDamage.renderOrder = 100; camera.add(glassDamage);\n    const blackoutMaterial = new THREE.MeshBasicMaterial({ color: 0x010201, transparent: true, opacity: 0, depthTest: false, depthWrite: false, toneMapped: false });\n    const blackout = new THREE.Mesh(new THREE.PlaneGeometry(.205, .12), blackoutMaterial);\n    blackout.position.set(0, 0, -.068); blackout.renderOrder = 101; camera.add(blackout);\n    let hitPitchKick = 0, hitRollKick = 0, hitYawKick = 0, gunDamageKick = 0;\n    let powerBlackout = 0, powerFlicker = 0, cockpitWarningLevel = 0;\n    let cockpitInstrumentKey = '';\n    let crackKey = -1;\n    function redrawCracks(commandPercent) {\n        const level = Math.max(0, Math.min(1, (72 - commandPercent) / 72));\n        const key = Math.round(level * 8);\n        if (key === crackKey) return;\n        crackKey = key;\n        const ctx = glassCanvas.getContext('2d');\n        ctx.clearRect(0, 0, glassCanvas.width, glassCanvas.height);\n        if (key <= 0) { glassTexture.needsUpdate = true; return; }\n        const branches = [\n            [[.78,.18],[.72,.29],[.76,.39],[.66,.48],[.69,.61]],\n            [[.72,.29],[.61,.25],[.55,.31],[.47,.27]],\n            [[.66,.48],[.57,.52],[.49,.63],[.39,.66]],\n            [[.69,.61],[.77,.70],[.74,.82]],\n            [[.34,.14],[.39,.25],[.36,.35],[.44,.44]],\n            [[.39,.25],[.29,.31],[.23,.42]],\n            [[.44,.44],[.51,.50],[.48,.58]],\n            [[.23,.42],[.18,.55],[.24,.68]],\n        ];\n        ctx.lineCap = 'round'; ctx.lineJoin = 'round';\n        for (let i = 0; i < Math.min(key, branches.length); i++) {\n            const points = branches[i];\n            ctx.beginPath();\n            ctx.moveTo(points[0][0] * 512, points[0][1] * 300);\n            for (const [x,y] of points.slice(1)) ctx.lineTo(x * 512, y * 300);\n            ctx.strokeStyle = i < 3 ? 'rgba(235,225,190,.72)' : 'rgba(185,205,185,.48)';\n            ctx.lineWidth = i < 3 ? 2.0 : 1.25; ctx.stroke();\n            ctx.strokeStyle = 'rgba(20,25,22,.58)'; ctx.lineWidth = .7; ctx.stroke();\n        }\n        glassTexture.needsUpdate = true;\n    }\n    function drawCockpitScreen(screen, lines, tone = 'green') {\n        const ctx = screen?.ctx; if (!ctx) return;\n        const w = screen.canvas.width, h = screen.canvas.height;\n        ctx.fillStyle = 'rgba(8,18,15,.96)'; ctx.fillRect(0, 0, w, h);\n        ctx.strokeStyle = tone === 'red' ? '#c85b46' : tone === 'amber' ? '#c99b52' : '#527d61'; ctx.lineWidth = 4; ctx.strokeRect(2,2,w-4,h-4);\n        ctx.font = `bold ${Math.max(13, Math.round(h * .22))}px monospace`;\n        ctx.textBaseline = 'middle';\n        lines.forEach((line, index) => {\n            ctx.fillStyle = line.hot ? '#f0a06d' : line.warn ? '#e2bb72' : '#9fd4aa';\n            ctx.fillText(line.text, 10, h * ((index + .65) / Math.max(1, lines.length)));\n        });\n        screen.texture.needsUpdate = true;\n    }\n    function updateCockpitInstruments(data = {}) {\n        const key = JSON.stringify(data);\n        if (key === cockpitInstrumentKey) return;\n        cockpitInstrumentKey = key;\n        const s = data.systems ?? {};\n        const hot = value => Number(value) <= 35;\n        const warn = value => Number(value) < 75;\n        drawCockpitScreen(cockpit.userData.instrumentScreens.systems, [\n            { text: `F ${s.structure ?? 0}  M ${s.mobility ?? 0}  P ${s.power ?? 0}`, warn: warn(Math.min(s.structure ?? 0, s.mobility ?? 0, s.power ?? 0)), hot: hot(Math.min(s.structure ?? 0, s.mobility ?? 0, s.power ?? 0)) },\n            { text: `C ${s.command ?? 0}  A ${s.combat ?? 0}`, warn: warn(Math.min(s.command ?? 0, s.combat ?? 0)), hot: hot(Math.min(s.command ?? 0, s.combat ?? 0)) },\n        ], data.warning >= 2 ? 'red' : data.warning >= 1 ? 'amber' : 'green');\n        drawCockpitScreen(cockpit.userData.instrumentScreens.weapon, [\n            { text: String(data.weapon ?? 'NO WEAPON').slice(0, 17) },\n            { text: `${data.ammo ?? '—'} ${data.weaponState ?? ''}`.trim(), warn: data.weaponState && data.weaponState !== 'READY', hot: data.weaponState === 'LOST' },\n        ], data.weaponState === 'LOST' ? 'red' : data.weaponState === 'DAMAGED' || data.weaponState === 'FAULT' ? 'amber' : 'green');\n        drawCockpitScreen(cockpit.userData.instrumentScreens.team, [\n            { text: `A ${data.team?.friendly ?? 0}/3   H ${data.team?.hostile ?? 0}/3`, warn: (data.team?.friendly ?? 3) <= 1 },\n        ], (data.team?.friendly ?? 3) <= 1 ? 'amber' : 'green');\n        cockpitWarningLevel = Math.max(0, Math.min(2, Number(data.warning) || 0));\n        redrawCracks(Number(s.command ?? 100));\n    }\n    function triggerCockpitHit(slot, profile = {}) {\n        const severity = Math.max(0, Math.min(1, Number(profile.severity) || 0));\n        hitPitchKick += Number(profile.pitch) || 0;\n        hitRollKick += Number(profile.roll) || 0;\n        hitYawKick += Number(profile.yaw) || 0;\n        gunDamageKick = Math.max(gunDamageKick, Number(profile.gunShake) || 0);\n        powerBlackout = Math.max(powerBlackout, Number(profile.blackoutSeconds) || 0);\n        powerFlicker = Math.max(powerFlicker, Number(profile.flickerSeconds) || 0);\n        cockpit.updateWorldMatrix(true, true);\n        const localBySlot = {\n            structure: [0, 2.05, -.82], mobility: [-.62, 1.58, -.82], power: [-.32, 1.83, -1.02],\n            command: [0, 2.72, -.61], combat: [.86, 2.08, -.72],\n        };\n        const origin = cockpit.localToWorld(new THREE.Vector3(...(localBySlot[slot] ?? [0,2,-.8])));\n        const count = Math.max(1, Math.min(12, Math.round(profile.sparkCount ?? 1)));\n        for (let i = 0; i < count; i++) {\n            const velocity = new THREE.Vector3((Math.random() - .5) * 2.8, .5 + Math.random() * 2.8, (Math.random() - .5) * 2.2);\n            activateParticle(sparkPool, 'spark', origin, velocity, .55 + severity * .9, .16 + Math.random() * .35, -4.1, 0, i % 3 ? 0xffbb58 : 0xfff0af);\n        }\n    }\n    function resetCockpitTransientFeedback() {\n        hitPitchKick = hitRollKick = hitYawKick = gunDamageKick = 0;\n        powerBlackout = powerFlicker = 0;\n        blackoutMaterial.opacity = 0;\n    }''')

# Use hit impulses in cockpit/camera pose.
replace_once('scene.js',
'''        gunPivot.rotation.set(lookPitch * .85, lookYaw * .85, 0, 'YXZ');\n        gunPivot.position.z = -0.62 + muzzleKick * .13;\n        flashMesh.visible = muzzleFlash > 0;\n        cockpit.position.set(visualX, 0, visualZ);\n        cockpit.rotation.set(cockpitPitch, renderYaw, cockpitRoll, 'YXZ');''',
'''        const damageWave = Math.sin(performance.now() * .043);\n        gunPivot.rotation.set(lookPitch * .85, lookYaw * .85, gunDamageKick * damageWave * .16, 'YXZ');\n        gunPivot.position.x = 1.16 + gunDamageKick * damageWave * .045;\n        gunPivot.position.z = -0.62 + muzzleKick * .13;\n        flashMesh.visible = muzzleFlash > 0;\n        cockpit.position.set(visualX, 0, visualZ);\n        cockpit.rotation.set(cockpitPitch + hitPitchKick, renderYaw + hitYawKick, cockpitRoll + hitRollKick, 'YXZ');''')
replace_once('scene.js',
'''            camera.position.set(visualX, 2.42 + cockpitHeave, visualZ);\n            camera.rotation.set(lookPitch + cockpitPitch * 0.35, renderYaw + lookYaw, cockpitRoll * 0.25, 'YXZ');''',
'''            camera.position.set(visualX, 2.42 + cockpitHeave - Math.abs(hitPitchKick) * .2, visualZ);\n            camera.rotation.set(lookPitch + cockpitPitch * 0.35 + hitPitchKick * 1.35, renderYaw + lookYaw + hitYawKick * 1.1, cockpitRoll * 0.25 + hitRollKick * 1.25, 'YXZ');''')

# Animate hit decay, electrical blackout/flicker, and physical warning lamps.
replace_once('scene.js',
'''    function updateCombatEffects(dt) {\n        muzzleKick = Math.max(0, muzzleKick - dt * 5);\n        muzzleFlash = Math.max(0, muzzleFlash - dt);''',
'''    function updateCombatEffects(dt) {\n        muzzleKick = Math.max(0, muzzleKick - dt * 5);\n        muzzleFlash = Math.max(0, muzzleFlash - dt);\n        const hitDecay = Math.exp(-8.5 * dt);\n        hitPitchKick *= hitDecay; hitRollKick *= hitDecay; hitYawKick *= hitDecay; gunDamageKick *= Math.exp(-5.2 * dt);\n        powerBlackout = Math.max(0, powerBlackout - dt);\n        powerFlicker = Math.max(0, powerFlicker - dt);\n        const flicker = powerFlicker > 0 ? (.12 + Math.abs(Math.sin(performance.now() * .075)) * .34) : 0;\n        blackoutMaterial.opacity = powerBlackout > 0 ? .96 : flicker;\n        const screenOpacity = powerBlackout > 0 ? .05 : powerFlicker > 0 ? Math.max(.18, 1 - flicker * 1.7) : .94;\n        for (const screen of Object.values(cockpit.userData.instrumentScreens)) screen.mesh.material.opacity = screenOpacity;\n        const pulse = .55 + .45 * Math.abs(Math.sin(performance.now() * .008));\n        const lamps = cockpit.userData.warningLamps;\n        lamps.amberLampMat.emissiveIntensity = cockpitWarningLevel >= 1 ? 1.4 * pulse : .08;\n        lamps.redLampMat.emissiveIntensity = cockpitWarningLevel >= 2 ? 2.8 * pulse : .03;\n        lamps.amberWash.intensity = cockpitWarningLevel >= 1 ? 1.8 * pulse : 0;\n        lamps.redWash.intensity = cockpitWarningLevel >= 2 ? 3.4 * pulse : 0;''')

# Visual audit ensures each actor still owns its own groups after resets/alignment.
replace_once('scene.js',
'''    selectPart(selected);\n    return {\n        scene, camera, cockpit, debugColliders,''',
'''    function combatantVisualAudit() {\n        const misplaced = [];\n        for (const record of squadCombatants.values()) {\n            for (const [slot, group] of record.exterior.partGroups) {\n                let node = group, owned = false;\n                while (node) { if (node === record.exterior.root) { owned = true; break; } node = node.parent; }\n                if (!owned) misplaced.push(`${record.id}:${slot}`);\n            }\n        }\n        return { ok: misplaced.length === 0, actors: squadCombatants.size, misplaced };\n    }\n    selectPart(selected);\n    return {\n        scene, camera, cockpit, debugColliders,''')
replace_once('scene.js',
'''        addCombatant, setCombatantActive, setCombatantCleared, updateCombatantRig, updateCombatantDamage, traceCombatantShot, showCombatantShot, updateShotAudit,\n    };''',
'''        addCombatant, setCombatantActive, setCombatantCleared, updateCombatantRig, updateCombatantDamage, traceCombatantShot, showCombatantShot, updateShotAudit,\n        updateCockpitInstruments, triggerCockpitHit, resetCockpitTransientFeedback, combatantVisualAudit,\n    };''')

# --- main: sortie state, cockpit data sync, subsystem hit reactions --------------------
replace_once('main.js',
"import { damageWreckIntegrity, shoveWreck, wreckCollisionRadius } from './wreckPhysics.js';",
"import { damageWreckIntegrity, shoveWreck, wreckCollisionRadius } from './wreckPhysics.js';\nimport { SORTIE_OUTRO_SECONDS, cockpitImpactProfile } from './combatPresentation.js';")

replace_once('main.js',
'''const debriefGarage = required('#debrief-garage');''',
'''const debriefGarage = required('#debrief-garage');\nconst sortieOutro = required('#sortie-outro');\nconst sortieOutroTitle = required('#sortie-outro-title');\nconst sortieOutroReason = required('#sortie-outro-reason');''')

replace_once('main.js',
'''let targetPanelRefresh = 0;\nconst selectionButtons = new Map();''',
'''let targetPanelRefresh = 0;\nlet sortiePhase = 'garage';\nlet sortieOutroRemaining = 0;\nlet pendingDebrief = null;\nconst selectionButtons = new Map();''')

replace_once('main.js',
'''function renderSquadStatus() {\n    const counts = squadCounts(playerCombatActive, aiActors);\n    teamStatus.textContent = `ALLY ${counts.friendly}/3 · HOSTILE ${counts.hostile}/3`;\n    teamStatus.classList.toggle('friendly-critical', counts.friendly <= 1);\n    teamStatus.classList.toggle('hostile-critical', counts.hostile <= 1);\n}''',
'''function renderSquadStatus() {\n    const counts = squadCounts(playerCombatActive, aiActors);\n    teamStatus.textContent = `ALLY ${counts.friendly}/3 · HOSTILE ${counts.hostile}/3`;\n    teamStatus.classList.toggle('friendly-critical', counts.friendly <= 1);\n    teamStatus.classList.toggle('hostile-critical', counts.hostile <= 1);\n    syncCockpitInstruments();\n}''')

# Inject sync function after remaining-part helper so it can use percentages.
replace_once('main.js',
'''function playerPartRemaining(part) {\n    if (!part) return 0;\n    const total = Math.max(1, part.maxIntegrity + part.maxArmor);\n    return Math.max(0, Math.min(1, (part.integrity + part.armor) / total));\n}\nfunction renderPlayerDamageHUD''',
'''function playerPartRemaining(part) {\n    if (!part) return 0;\n    const total = Math.max(1, part.maxIntegrity + part.maxArmor);\n    return Math.max(0, Math.min(1, (part.integrity + part.armor) / total));\n}\nfunction syncCockpitInstruments() {\n    if (!arena?.updateCockpitInstruments) return;\n    const systems = {};\n    let lowest = 1; let disabled = false;\n    for (const slot of SLOTS) {\n        const part = playerCondition.parts[slot];\n        const ratio = playerPartRemaining(part);\n        systems[slot] = Math.round(ratio * 100);\n        lowest = Math.min(lowest, ratio);\n        disabled ||= !!part && part.integrity <= 0;\n    }\n    const counts = squadCounts(playerCombatActive, aiActors);\n    const failure = weaponFailureState(playerCondition, fieldService);\n    const weaponStateLabel = !weaponSpec ? 'LOST' : failure === 'faulted' ? 'FAULT' : failure === 'destroyed' || failure === 'unrecoverable' ? 'LOST' : output.weapon < .95 ? 'DAMAGED' : weaponState?.reloadLeft > 0 ? 'RELOAD' : 'READY';\n    arena.updateCockpitInstruments({\n        systems, team: counts, warning: disabled || lowest < .38 ? 2 : lowest < .72 ? 1 : 0,\n        weapon: weaponSpec?.label ?? 'NO WEAPON',\n        ammo: weaponState ? `${weaponState.loaded}/${weaponState.reserve}` : '—',\n        weaponState: sortiePhase === 'outro' ? 'SAFE' : weaponStateLabel,\n    });\n}\nfunction renderPlayerDamageHUD''')

replace_once('main.js',
'''    }\n}\nfunction signalPlayerHit(slot, hit) {\n    renderPlayerDamageHUD(slot);''',
'''    }\n    syncCockpitInstruments();\n}\nfunction signalPlayerHit(slot, hit) {\n    renderPlayerDamageHUD(slot);\n    arena.triggerCockpitHit(slot, cockpitImpactProfile(slot, { internalDamage: hit.internalDamage, disabled: hit.disabled, driveSide: hit.driveSide }));''')

# Clean transient state on deploy and explicit phase ownership.
replace_once('main.js',
'''    if (inspecting) {\n        devPanel.classList.add('hidden');''',
'''    if (inspecting) {\n        sortiePhase = 'garage';\n        sortieOutro.classList.add('hidden');\n        sortieOutro.setAttribute('aria-hidden', 'true');\n        devPanel.classList.add('hidden');''')
replace_once('main.js',
'''        debriefSheet.classList.add('hidden');\n        debriefSheet.setAttribute('aria-hidden', 'true');\n        rig = createRigState();''',
'''        debriefSheet.classList.add('hidden');\n        debriefSheet.setAttribute('aria-hidden', 'true');\n        sortieOutro.classList.add('hidden');\n        sortieOutro.setAttribute('aria-hidden', 'true');\n        sortiePhase = 'combat'; sortieOutroRemaining = 0; pendingDebrief = null;\n        reportFade = 0; shotReport.textContent = ''; shotReport.className = 'shot-report faded';\n        hitConfirm.className = 'hit-confirm'; rangeCrosshair.classList.remove('confirmed-hit', 'breach-hit', 'disable-hit');\n        arena.resetCockpitTransientFeedback();\n        assemblyToggle.disabled = false;\n        rig = createRigState();''')

# Freeze combat simulation during the victory/defeat battlefield hold.
replace_once('main.js',
'''    if (!inspecting && rigConfig && appSheet.classList.contains('hidden') && document.visibilityState !== 'hidden') {''',
'''    if (!inspecting && !testEnded && rigConfig && appSheet.classList.contains('hidden') && document.visibilityState !== 'hidden') {''')

# Advance explicit outro -> debrief state after particles/cockpit still get to animate.
replace_once('main.js',
'''    arena.updateRigVisual(rig, input.lookYaw, input.lookPitch, frameDt);\n    arena.updateCombatEffects(frameDt);''',
'''    arena.updateRigVisual(rig, input.lookYaw, input.lookPitch, frameDt);\n    arena.updateCombatEffects(frameDt);\n    if (sortiePhase === 'outro') {\n        sortieOutroRemaining = Math.max(0, sortieOutroRemaining - frameDt);\n        if (sortieOutroRemaining === 0 && pendingDebrief) {\n            const next = pendingDebrief; pendingDebrief = null; sortiePhase = 'debrief';\n            sortieOutro.classList.add('hidden'); sortieOutro.setAttribute('aria-hidden', 'true');\n            assemblyToggle.disabled = false;\n            renderDebrief(next.summary, next.reason);\n        }\n    }''')

# DEV invariant for accidental actor-group reparenting.
replace_once('main.js',
'''            `LOS AUDIT ${lastCoverAudit}`,''',
'''            `LOS AUDIT ${lastCoverAudit}`,\n            `RIG VIS   ${arena.combatantVisualAudit().ok ? `OK · ${arena.combatantVisualAudit().actors} ACTORS` : `MISPLACED ${arena.combatantVisualAudit().misplaced.join(',')}`}`,''')

# Delay debrief and show proper sortie-complete presentation first.
replace_once('main.js',
'''    shotReport.textContent = victory ? `SORTIE COMPLETE · ${reason}` : `SORTIE ENDED · ${reason} · RECOVERY CREW DISPATCHED`;\n    renderSquadStatus();\n    reportFade = 9999;\n    renderAmmo();\n    renderDebrief(summary, reason);\n}''',
'''    shotReport.textContent = '';\n    shotReport.classList.add('faded');\n    renderSquadStatus();\n    reportFade = 0;\n    sortiePhase = 'outro';\n    sortieOutroRemaining = SORTIE_OUTRO_SECONDS;\n    pendingDebrief = { summary, reason };\n    sortieOutroTitle.textContent = victory ? 'SORTIE COMPLETE' : 'SORTIE FAILED';\n    sortieOutroReason.textContent = victory ? reason : `${reason} · RECOVERY CREW INBOUND`;\n    sortieOutro.classList.remove('hidden');\n    sortieOutro.classList.toggle('failed', !victory);\n    sortieOutro.setAttribute('aria-hidden', 'false');\n    assemblyToggle.disabled = true;\n    renderAmmo();\n    syncCockpitInstruments();\n}''')

# Pass hit side into cockpit response.
replace_once('main.js',
'''    signalPlayerHit(contact.slot, visualHit);''',
'''    signalPlayerHit(contact.slot, { ...visualHit, driveSide: contact.driveSide });''')

# Keep physical display in sync with ammo state even though renderAmmo runs every frame; scene caches identical snapshots.
replace_once('main.js',
'''    fireButton.disabled = !playerCombatActive || !weaponSpec || !weaponState || !inspection.ready || inspecting || testEnded || !output.weaponOperational ||''',
'''    syncCockpitInstruments();\n    fireButton.disabled = !playerCombatActive || !weaponSpec || !weaponState || !inspection.ready || inspecting || testEnded || !output.weaponOperational ||''')

# --- CSS: move persistent telemetry off flat HUD, style projected/outro states ----------
p = Path('styles.css')
css = p.read_text()
css += r'''

/* k.3k.2 — persistent combat telemetry now lives on physical cockpit screens. */
body:not(.inspecting) .team-status,
body:not(.inspecting) .player-damage-hud,
body:not(.inspecting) .weapon-hud { opacity:0; visibility:hidden; }
body:not(.inspecting) .look-heading {
  top:max(16px,calc(env(safe-area-inset-top) + 10px)); border:0; background:transparent;
  opacity:.42; font-size:6px; letter-spacing:.16em; text-shadow:0 0 8px #08110c;
}
body:not(.inspecting) .fault-strip { top:max(35px,calc(env(safe-area-inset-top) + 29px)); }
body:not(.inspecting) .fault-strip.nominal { display:none; }
body:not(.inspecting) .shot-report { top:max(54px,calc(env(safe-area-inset-top) + 48px)); }
.sortie-outro {
  position:absolute; z-index:40; left:50%; top:39%; transform:translate(-50%,-50%);
  min-width:min(520px,70vw); padding:14px 24px 13px; text-align:center; pointer-events:none;
  border:2px solid #d49b52; background:rgba(13,18,15,.82); box-shadow:0 0 0 1px #241e13,0 14px 50px #0009;
  font-family:ui-monospace,SFMono-Regular,Menlo,monospace; letter-spacing:.11em; color:#e6c98d;
  animation:sortieAnnounceIn .22s ease-out;
}
.sortie-outro small { display:block; font-size:7px; color:#8ba28d; margin-bottom:5px; }
.sortie-outro strong { display:block; font-size:18px; color:#f0c681; }
.sortie-outro span { display:block; margin-top:6px; font-size:8px; color:#c5b48f; }
.sortie-outro.failed { border-color:#c85b46; }
.sortie-outro.failed strong { color:#f08a70; }
@keyframes sortieAnnounceIn { from{opacity:0;transform:translate(-50%,-46%) scale(.96)} to{opacity:1;transform:translate(-50%,-50%) scale(1)} }
@media(max-height:430px){
  .sortie-outro{top:36%;padding:9px 18px;min-width:min(440px,66vw)}
  .sortie-outro strong{font-size:14px}.sortie-outro span{font-size:7px}
}
'''
p.write_text(css)
