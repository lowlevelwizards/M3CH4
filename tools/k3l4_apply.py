from pathlib import Path

ROOT = Path('.')


def read(path):
    return (ROOT / path).read_text()


def write(path, text):
    (ROOT / path).write_text(text)


def replace_once(text, old, new, label):
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f'{label}: expected exactly one match, found {count}')
    return text.replace(old, new, 1)


# -----------------------------------------------------------------------------
# cockpitView.js — preserve diegetic tethering but guarantee a readable safe area
# -----------------------------------------------------------------------------
cockpit = read('cockpitView.js')
cockpit = replace_once(
    cockpit,
    """/** k.3k.4 — keep the combiner tied to the mech while the pilot free-looks.\n * The camera receives look yaw/pitch immediately. The combiner is camera-local, so\n * applying the inverse look angles makes it remain aligned with the chassis/window.\n * As body-follow rotates the mech and controls.compensateBodyTurn() reduces lookYaw,\n * the display naturally recenters without any second steering system. */\nexport function combinerTetherFromLook(lookYaw = 0, lookPitch = 0) {\n    const yaw = Number.isFinite(lookYaw) ? -lookYaw : 0;\n    const pitch = Number.isFinite(lookPitch) ? -lookPitch : 0;\n    return { yaw, pitch };\n}\n""",
    """/** k.3l.4 — keep the combiner feeling chassis-mounted without letting critical\n * telemetry leave the windshield safe area during free-look. The display follows only\n * part of the camera/chassis separation and saturates before the outer readouts clip.\n * Body-follow still recenters it naturally as lookYaw returns toward zero. */\nexport const COMBINER_TETHER_FOLLOW = 0.55;\nexport const COMBINER_TETHER_YAW_LIMIT = 0.16;\nexport const COMBINER_TETHER_PITCH_LIMIT = 0.10;\n\nconst clamp = (value, limit) => Math.max(-limit, Math.min(limit, value));\n\nexport function combinerTetherFromLook(lookYaw = 0, lookPitch = 0) {\n    const yaw = Number.isFinite(lookYaw) ? -lookYaw * COMBINER_TETHER_FOLLOW : 0;\n    const pitch = Number.isFinite(lookPitch) ? -lookPitch * COMBINER_TETHER_FOLLOW : 0;\n    return {\n        yaw: clamp(yaw, COMBINER_TETHER_YAW_LIMIT),\n        pitch: clamp(pitch, COMBINER_TETHER_PITCH_LIMIT),\n    };\n}\n""",
    'safe combiner tether')
write('cockpitView.js', cockpit)


# -----------------------------------------------------------------------------
# scene.js — lift garage shadow values and keep inspection framing machine-readable
# -----------------------------------------------------------------------------
scene = read('scene.js')
scene = replace_once(scene,
    "    const darkSteel = mat(0x171d1b, .84, .44);\n    const concrete = mat(0x48483f, .98, .02);\n    const padMat = mat(0x2b302b, .92, .08);",
    "    const darkSteel = mat(0x222a27, .84, .44);\n    const concrete = mat(0x535248, .98, .02);\n    const padMat = mat(0x343a34, .92, .08);",
    'garage base values')
scene = replace_once(scene,
    "    const lampMat = new THREE.MeshStandardMaterial({ color: 0xffdfad, emissive: 0xffb454, emissiveIntensity: 3.4, roughness: .45 });",
    "    // Lower fixture glare while raising broad fill: the bay should be dim, not black.\n    const lampMat = new THREE.MeshStandardMaterial({ color: 0xffdfad, emissive: 0xffb454, emissiveIntensity: 2.25, roughness: .45 });",
    'garage fixture glare')
scene = replace_once(scene,
    "        const lamp = new THREE.PointLight(0xffc178, 18, 10, 2.0);",
    "        const lamp = new THREE.PointLight(0xffc178, 11.5, 10, 2.0);",
    'garage point lights')
scene = replace_once(scene,
    "    const hemi = new THREE.HemisphereLight(0x9fb7aa, 0x17130f, .48);\n    root.add(hemi);\n    const key = new THREE.DirectionalLight(0xffd19b, 2.35);",
    "    const hemi = new THREE.HemisphereLight(0xa9c0b4, 0x2b241b, .86);\n    root.add(hemi);\n    const key = new THREE.DirectionalLight(0xffd19b, 1.95);",
    'garage broad fill')
scene = replace_once(scene,
    "    const rim = new THREE.DirectionalLight(0x70a9a4, .82);\n    rim.position.set(6, 4, -5);\n    root.add(rim);\n\n    return root;",
    "    const rim = new THREE.DirectionalLight(0x70a9a4, 1.15);\n    rim.position.set(6, 4, -5);\n    root.add(rim);\n    const fill = new THREE.DirectionalLight(0x8fa99f, .72);\n    fill.position.set(5, 5, 6);\n    root.add(fill);\n\n    return root;",
    'garage secondary fill')
scene = replace_once(scene,
    "    let azimuth = 0.64;\n    let elevation = 0.27;\n    let radius = 6.55;",
    "    let azimuth = 0.68;\n    let elevation = 0.25;\n    let radius = 7.20;",
    'inspection orbit defaults')
scene = replace_once(scene,
    """    function focusPart(slot) {\n        if (!slot || !exterior.partGroups.has(slot))\n            desiredTarget.set(0, 1.85, 0);\n        else\n            desiredTarget.set(...SLOT_CENTERS[slot]);\n    }""",
    """    function focusPart(slot) {\n        const machineCenter = new THREE.Vector3(0, 1.85, 0);\n        if (!slot || !exterior.partGroups.has(slot)) {\n            desiredTarget.copy(machineCenter);\n            return;\n        }\n        // Bias toward the selected module rather than turning it into the entire shot.\n        // The machine remains legible as an owned object while the selected part is favored.\n        const partCenter = new THREE.Vector3(...SLOT_CENTERS[slot]);\n        desiredTarget.copy(machineCenter).lerp(partCenter, .40);\n        radius = Math.max(radius, 6.85);\n    }""",
    'selected part framing')
scene = replace_once(scene,
    "            const shift = framingOffsetWorld(panelRightPx, viewportWidth, viewportHeight, radius, camera.fov);\n            camera.lookAt(center.addScaledVector(right, shift));",
    "            const shift = framingOffsetWorld(panelRightPx, viewportWidth, viewportHeight, radius, camera.fov) * .78;\n            camera.lookAt(center.addScaledVector(right, shift));",
    'inspection panel framing')
scene = replace_once(scene,
    "            radius = THREE.MathUtils.clamp(radius / scale, 2.7, 11.2);",
    "            radius = THREE.MathUtils.clamp(radius / scale, 4.0, 11.2);",
    'inspection minimum zoom')
scene = replace_once(scene,
    "    function resetOrbit() {\n        azimuth = 0.64;\n        elevation = 0.27;\n        radius = 6.55;",
    "    function resetOrbit() {\n        azimuth = 0.68;\n        elevation = 0.25;\n        radius = 7.20;",
    'inspection reset orbit')
write('scene.js', scene)


# -----------------------------------------------------------------------------
# acquisitionUI.js — compact result composition and demoted destructive return action
# -----------------------------------------------------------------------------
acq = read('acquisitionUI.js')
acq = replace_once(acq,
    '/** k.3l.3 — compact post-bout score + physical salvage drafting.',
    '/** k.3l.4 — compact post-bout score + physical salvage drafting.',
    'acquisition version comment')
acq = replace_once(acq,
    ".debrief-page{flex:0 0 100%;width:100%;min-width:0;min-height:0;overflow:hidden;scroll-snap-align:start;scroll-snap-stop:always;padding:2px 18px 5px}.debrief-page-title",
    ".debrief-page{flex:0 0 100%;width:100%;min-width:0;min-height:0;overflow:hidden;scroll-snap-align:start;scroll-snap-stop:always;padding:2px 18px 5px}.debrief-page-result{display:flex;flex-direction:column}.debrief-result-summary{flex:1 1 auto;min-height:0;width:min(680px,100%);margin:0 auto;display:flex;flex-direction:column;justify-content:center;padding:0 8px 8px}.debrief-page-title",
    'result centering layout')
acq = replace_once(acq,
    ".debrief-content>.sheet-done{flex:0 0 auto;min-height:32px;margin-top:0;padding:6px 10px;font-size:9px}",
    ".debrief-content>.sheet-done{flex:0 0 auto;min-height:32px;margin-top:0;padding:6px 10px;font-size:9px}#debrief-garage{display:flex;align-items:center;justify-content:center;gap:8px;min-height:27px!important;padding:4px 10px!important;border:1px solid #59675e!important;background:#151b18!important;color:#89988e!important;box-shadow:none!important;font:800 7px/1.1 ui-monospace,monospace!important;letter-spacing:.06em}#debrief-garage strong{font:inherit;color:inherit}#debrief-garage small{font:600 5.8px/1 ui-monospace,monospace;color:#6f7f75;letter-spacing:.04em}#debrief-garage[data-mode=\"forfeit\"]{border-color:#79594a!important;background:#211917!important;color:#c39378!important}#debrief-garage[data-mode=\"forfeit\"] small{color:#8f7465}#debrief-garage[data-mode=\"complete\"]{border-color:#627d66!important;background:#172019!important;color:#b6d2b6!important}",
    'return action hierarchy')
acq = replace_once(acq,
    "@media(max-height:430px){.debrief-content{height:88dvh;max-height:88dvh!important}.debrief-page-result h1",
    "@media(max-height:430px){.debrief-content{height:88dvh;max-height:88dvh!important}.debrief-result-summary{padding-bottom:1px}.debrief-page-result h1",
    'short-screen result spacing')
acq = replace_once(acq,
    "let autoGarageTimer = null;\n\nfunction injectStyles()",
    """let autoGarageTimer = null;\n\nfunction setGarageAction(primary, secondary = '', mode = 'return') {\n    garage.replaceChildren();\n    const label = document.createElement('strong');\n    label.textContent = primary;\n    garage.append(label);\n    if (secondary) {\n        const note = document.createElement('small');\n        note.textContent = secondary;\n        garage.append(note);\n    }\n    garage.dataset.mode = mode;\n}\n\nfunction injectStyles()""",
    'garage action helper')
acq = replace_once(acq,
    "    garage.textContent = 'RETURN TO GARAGE';\n    if (!result?.victory || !result.draft || sheet.classList.contains('hidden')) return;",
    "    setGarageAction('RETURN TO GARAGE');\n    if (!result?.victory || !result.draft || sheet.classList.contains('hidden')) return;",
    'default return label')
acq = replace_once(acq,
    "    if (currentDrafter(result.draft) === 'player')\n        garage.textContent = 'FORFEIT CLAIM · RETURN TO GARAGE';\n    else if (!currentDrafter(result.draft) && autoGarageTimer === null)",
    "    if (currentDrafter(result.draft) === 'player')\n        setGarageAction('RETURN TO GARAGE', 'UNCLAIMED SALVAGE WILL BE FORFEITED', 'forfeit');\n    else if (!currentDrafter(result.draft) && autoGarageTimer === null)",
    'forfeit return label')
acq = replace_once(acq,
    "    garage.textContent = playerClaimed ? 'CLAIM SECURED · RETURNING TO GARAGE' : 'DRAFT COMPLETE · RETURNING TO GARAGE';",
    "    setGarageAction(playerClaimed ? 'CLAIM SECURED' : 'DRAFT COMPLETE', 'RETURNING TO GARAGE…', 'complete');",
    'complete return label')
write('acquisitionUI.js', acq)


# -----------------------------------------------------------------------------
# index.html — wrap result content and bust presentation caches
# -----------------------------------------------------------------------------
html = read('index.html')
html = replace_once(html,
    '"./scene.js": "./sceneAssembly.js?v=k3l3",',
    '"./scene.js": "./sceneAssembly.js?v=k3l4",',
    'scene assembly cache')
html = replace_once(html,
    '"./cockpitView.js": "./cockpitView.js?v=k3k4",',
    '"./cockpitView.js": "./cockpitView.js?v=k3l4",',
    'cockpit view cache')
html = replace_once(html,
    '<title>MECH ARENA — 0.0.1k.3l.3 — Readability + Garage Bay</title>',
    '<title>MECH ARENA — 0.0.1k.3l.4 — Safe HUD + Garage Polish</title>',
    'document title')
html = replace_once(html,
    """            <div class=\"debrief-page-title\">01 / RESULT</div>\n            <div class=\"sheet-label\">SCRAPYARD CONTRACT / RECOVERY</div>\n            <h1 id=\"debrief-title\">SORTIE COMPLETE</h1>\n            <div id=\"debrief-lines\" class=\"debrief-lines\" aria-live=\"polite\"></div>\n            <p class=\"sheet-muted\">Repair estimate is informational · garage service remains a separate choice.</p>""",
    """            <div class=\"debrief-page-title\">01 / RESULT</div>\n            <div class=\"debrief-result-summary\">\n              <div class=\"sheet-label\">SCRAPYARD CONTRACT / RECOVERY</div>\n              <h1 id=\"debrief-title\">SORTIE COMPLETE</h1>\n              <div id=\"debrief-lines\" class=\"debrief-lines\" aria-live=\"polite\"></div>\n              <p class=\"sheet-muted\">Repair estimate is informational · garage service remains a separate choice.</p>\n            </div>""",
    'result summary wrapper')
html = replace_once(html,
    '<script type="module" src="./main.js?v=k3l3"></script>',
    '<script type="module" src="./main.js?v=k3l4"></script>',
    'main cache')
html = replace_once(html,
    '<script type="module" src="./garageMountUI.js?v=k3l3"></script>',
    '<script type="module" src="./garageMountUI.js?v=k3l4"></script>',
    'garage ui cache')
write('index.html', html)


# -----------------------------------------------------------------------------
# bridge/import cache busting
# -----------------------------------------------------------------------------
assembly = read('sceneAssembly.js')
assembly = replace_once(assembly,
    "import { createArenaScene as createBaseArenaScene } from './scene.js?source=k3l3';",
    "import { createArenaScene as createBaseArenaScene } from './scene.js?source=k3l4';",
    'scene source cache')
write('sceneAssembly.js', assembly)

mount = read('garageMountUI.js')
mount = replace_once(mount,
    "import './acquisitionUI.js?v=k3l3';",
    "import './acquisitionUI.js?v=k3l4';",
    'acquisition cache')
write('garageMountUI.js', mount)


# -----------------------------------------------------------------------------
# tests — functional clamp plus source-level presentation regression protection
# -----------------------------------------------------------------------------
cockpit_test = read('tests/cockpitView.test.mjs')
cockpit_test = replace_once(cockpit_test,
    "import { combinerTetherFromLook } from '../cockpitView.js';",
    "import { COMBINER_TETHER_FOLLOW, COMBINER_TETHER_PITCH_LIMIT, COMBINER_TETHER_YAW_LIMIT, combinerTetherFromLook } from '../cockpitView.js';",
    'cockpit test imports')
cockpit_test = replace_once(cockpit_test,
    """    assert.equal(tether.yaw, -lookYaw);\n    assert.equal(tether.pitch, -0.08);""",
    """    assert.equal(tether.yaw, -lookYaw * COMBINER_TETHER_FOLLOW);\n    assert.equal(tether.pitch, -0.08 * COMBINER_TETHER_FOLLOW);""",
    'cockpit partial follow assertions')
cockpit_test += """\n\ntest('combiner tether saturates before critical readouts can leave the safe windshield area', () => {\n    const extreme = combinerTetherFromLook(1.2, -0.8);\n    assert.equal(extreme.yaw, -COMBINER_TETHER_YAW_LIMIT);\n    assert.equal(extreme.pitch, COMBINER_TETHER_PITCH_LIMIT);\n});\n"""
write('tests/cockpitView.test.mjs', cockpit_test)

polish_test = """import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport fs from 'node:fs';\n\nconst scene = fs.readFileSync(new URL('../scene.js', import.meta.url), 'utf8');\nconst acquisition = fs.readFileSync(new URL('../acquisitionUI.js', import.meta.url), 'utf8');\nconst html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');\n\ntest('garage lighting uses broad fill instead of blown-out fixtures over black geometry', () => {\n  assert.match(scene, /HemisphereLight\\(0xa9c0b4, 0x2b241b, \\.86\\)/);\n  assert.match(scene, /DirectionalLight\\(0x8fa99f, \\.72\\)/);\n  assert.match(scene, /emissiveIntensity: 2\\.25/);\n});\n\ntest('garage inspection favors selected parts without losing the complete machine', () => {\n  assert.match(scene, /lerp\\(partCenter, \\.40\\)/);\n  assert.match(scene, /radius = Math\\.max\\(radius, 6\\.85\\)/);\n  assert.match(scene, /framingOffsetWorld[^\\n]+\\* \\.78/);\n  assert.match(scene, /radius = 7\\.20/);\n});\n\ntest('result page centers its compact accounting block and destructive return is visually secondary', () => {\n  assert.match(html, /class=\"debrief-result-summary\"/);\n  assert.match(acquisition, /debrief-result-summary/);\n  assert.match(acquisition, /UNCLAIMED SALVAGE WILL BE FORFEITED/);\n  assert.match(acquisition, /data-mode=\\\"forfeit\\\"/);\n  assert.match(acquisition, /setGarageAction\\('CLAIM SECURED'/);\n});\n"""
write('tests/k3l4Polish.test.mjs', polish_test)
