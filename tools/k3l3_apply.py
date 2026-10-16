from pathlib import Path
import re
import textwrap

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

def regex_once(text, pattern, replacement, label):
    next_text, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise RuntimeError(f'{label}: expected exactly one regex match, found {count}')
    return next_text

# -----------------------------------------------------------------------------
# scene.js — readable source shadows, split HUD layer, and a dedicated garage bay
# -----------------------------------------------------------------------------
scene = read('scene.js')
scene = replace_once(scene,
    "    scene.add(new THREE.HemisphereLight(0x9dafaa, 0x171511, .56));",
    "    const arenaHemisphere = new THREE.HemisphereLight(0x9dafaa, 0x171511, .56);\n    scene.add(arenaHemisphere);",
    'arena hemisphere reference')
scene = replace_once(scene,
    "    sun.shadow.mapSize.set(128, 128);",
    "    // Keep the shadow silhouette coherent at source; the deliberately low-res world\n    // framebuffer does the final pixelation instead of destroying the shadow shape first.\n    sun.shadow.mapSize.set(512, 512);",
    'shadow map resolution')
scene = replace_once(scene,
    "    const worldSolids = buildWarehouse(scene);\n    const cockpit = buildCockpit(scene);",
    "    const arenaRoot = new THREE.Group();\n    arenaRoot.name = 'arena-environment';\n    scene.add(arenaRoot);\n    const arenaPresentationRoot = new THREE.Group();\n    arenaPresentationRoot.name = 'arena-presentation';\n    scene.add(arenaPresentationRoot);\n    const worldSolids = buildWarehouse(arenaRoot);\n    const garageRoot = buildGarageBay();\n    garageRoot.name = 'garage-bay';\n    garageRoot.visible = false;\n    scene.add(garageRoot);\n    const GARAGE_RIG_YAW = -0.10;\n    const cockpit = buildCockpit(scene);",
    'arena and garage roots')
scene = replace_once(scene,
    "        systems: { position: [-.122, .002, -.105], scale: .055 },\n        team:    { position: [ 0.000, .060, -.105], scale: .043 },\n        weapon:  { position: [ .118,-.006, -.105], scale: .052 },\n        motion:  { position: [-.078,-.056, -.105], scale: .044 },\n        drive:   { position: [ .004,-.059, -.105], scale: .044 },",
    "        systems: { position: [-.094, .004, -.105], scale: .059 },\n        team:    { position: [ 0.000, .057, -.105], scale: .047 },\n        weapon:  { position: [ .094,-.004, -.105], scale: .057 },\n        motion:  { position: [-.058,-.052, -.105], scale: .048 },\n        drive:   { position: [ .020,-.054, -.105], scale: .048 },",
    'inward combiner layout')
scene = replace_once(scene,
    "    scene.add(targetExterior.root);",
    "    arenaPresentationRoot.add(targetExterior.root);",
    'primary hostile presentation root')
scene = replace_once(scene,
    "        scene.add(marker);\n        return marker;",
    "        arenaPresentationRoot.add(marker);\n        return marker;",
    'squad marker presentation root')
scene = replace_once(scene,
    "        scene.add(actorExterior.root);\n        const record = {",
    "        arenaPresentationRoot.add(actorExterior.root);\n        const record = {",
    'support actor presentation root')
scene = replace_once(scene,
    "    scene.add(particleRoot);",
    "    arenaPresentationRoot.add(particleRoot);",
    'particle presentation root')
scene = replace_once(scene,
    "            scene.attach(group);",
    "            arenaPresentationRoot.attach(group);",
    'detached wreck presentation root')
scene = replace_once(scene,
    "    scene.add(ring);",
    "    arenaPresentationRoot.add(ring);",
    'hostile ring presentation root')
scene = replace_once(scene,
    "    scene.add(pilotRing);",
    "    arenaPresentationRoot.add(pilotRing);",
    'pilot ring presentation root')
scene = replace_once(scene,
    "    blackout.position.set(0, 0, -.068); blackout.renderOrder = 101; camera.add(blackout);",
    "    blackout.position.set(0, 0, -.068); blackout.renderOrder = 101; camera.add(blackout);\n    // Layer 1 is rendered by a tiny second renderer at display resolution. The world\n    // remains intentionally low-res while cockpit telemetry stays legible.\n    combinerHud.traverse(object => object.layers.set(1));\n    blackout.layers.set(1);",
    'combiner render layer')
scene = replace_once(scene,
    "    let azimuth = 0.57;\n    let elevation = 0.31;\n    let radius = 5.85;",
    "    let azimuth = 0.64;\n    let elevation = 0.27;\n    let radius = 6.55;",
    'garage orbit defaults')

inspection_pattern = r"        if \(inspecting\) \{\n            // Orbit the machine, not the background\. The camera target follows selected modules\.\n.*?            camera\.lookAt\(center\.addScaledVector\(right, shift\)\);\n        \}\n        else \{"
inspection_replacement = """        if (inspecting) {
            // Garage inspection is a deliberately separate presentation state. The owned
            // rig always returns to the service pad instead of inheriting its last arena pose.
            exterior.root.position.set(0, 0, 0);
            exterior.root.rotation.y = GARAGE_RIG_YAW;
            orbitTarget.lerp(desiredTarget, 1 - Math.exp(-9 * dt));
            const around = new THREE.Vector3(
                radius * Math.sin(azimuth) * Math.cos(elevation),
                radius * Math.sin(elevation),
                -radius * Math.cos(azimuth) * Math.cos(elevation),
            ).applyAxisAngle(THREE.Object3D.DEFAULT_UP, GARAGE_RIG_YAW);
            const center = orbitTarget.clone().applyAxisAngle(THREE.Object3D.DEFAULT_UP, GARAGE_RIG_YAW);
            camera.position.copy(center).add(around);
            const right = new THREE.Vector3(Math.cos(azimuth), 0, Math.sin(azimuth))
                .applyAxisAngle(THREE.Object3D.DEFAULT_UP, GARAGE_RIG_YAW);
            const shift = framingOffsetWorld(panelRightPx, viewportWidth, viewportHeight, radius, camera.fov);
            camera.lookAt(center.addScaledVector(right, shift));
        }
        else {"""
scene = regex_once(scene, inspection_pattern, inspection_replacement, 'garage inspection camera')

scene = replace_once(scene,
    "    function setInspection(enabled) {\n        inspecting = enabled;\n        exterior.root.visible = enabled;\n        cockpit.visible = !enabled;\n        combinerHud.visible = !enabled;\n        for (const record of squadCombatants.values()) {\n            record.exterior.root.visible = !enabled;\n            record.marker.visible = !enabled;\n        }\n    }",
    "    function setInspection(enabled) {\n        inspecting = enabled;\n        exterior.root.visible = enabled;\n        cockpit.visible = !enabled;\n        combinerHud.visible = !enabled;\n        blackout.visible = !enabled;\n        arenaRoot.visible = !enabled;\n        arenaPresentationRoot.visible = !enabled;\n        garageRoot.visible = enabled;\n        arenaHemisphere.visible = !enabled;\n        sun.visible = !enabled;\n        coolRim.visible = !enabled;\n        debugColliders.visible = false;\n        scene.background.setHex(enabled ? 0x0d1210 : 0x171915);\n        scene.fog.color.setHex(enabled ? 0x0d1210 : 0x171915);\n        scene.fog.density = enabled ? 0.0075 : 0.0125;\n        if (enabled) {\n            exterior.root.position.set(0, 0, 0);\n            exterior.root.rotation.y = GARAGE_RIG_YAW;\n        }\n        for (const record of squadCombatants.values()) {\n            record.exterior.root.visible = !enabled;\n            record.marker.visible = !enabled;\n        }\n    }",
    'inspection scene isolation')
scene = replace_once(scene,
    "    function resetOrbit() {\n        azimuth = 0.57;\n        elevation = 0.31;\n        radius = 5.85;\n        focusPart(null);\n    }",
    "    function resetOrbit() {\n        azimuth = 0.64;\n        elevation = 0.27;\n        radius = 6.55;\n        focusPart(null);\n    }",
    'garage reset orbit')

garage_builder = r'''
function buildGarageBay() {
    const root = new THREE.Group();
    const steel = mat(0x2d3431, .72, .55);
    const darkSteel = mat(0x171d1b, .84, .44);
    const concrete = mat(0x48483f, .98, .02);
    const padMat = mat(0x2b302b, .92, .08);
    const safety = mat(0xb18432, .82, .16);
    const teal = mat(0x2c6662, .82, .24);
    const rust = mat(0x714029, .88, .18);

    const floor = box(18, .22, 15, concrete);
    floor.position.set(0, -.13, .35);
    root.add(floor);
    const pad = box(5.8, .15, 6.1, padMat);
    pad.position.set(0, .015, 0);
    root.add(pad);
    for (const x of [-3.03, 3.03]) {
        const rail = box(.16, .06, 6.4, safety);
        rail.position.set(x, .11, 0);
        root.add(rail);
    }
    for (const z of [-3.14, 3.14]) {
        const rail = box(6.2, .06, .16, safety);
        rail.position.set(0, .11, z);
        root.add(rail);
    }

    const backWall = box(18, 7.4, .38, darkSteel);
    backWall.position.set(0, 3.55, 6.15);
    root.add(backWall);
    const sideWall = box(.38, 7.4, 12.5, darkSteel);
    sideWall.position.set(-8.15, 3.55, .2);
    root.add(sideWall);

    // Four-post service lift and overhead gantry make the bay read as a place that can
    // actually remove several-ton modules, rather than a decorative arena backdrop.
    for (const x of [-3.55, 3.55]) {
        for (const z of [-2.35, 2.35]) {
            const post = box(.28, 4.9, .28, steel);
            post.position.set(x, 2.47, z);
            root.add(post);
            const foot = box(.65, .16, .65, safety);
            foot.position.set(x, .08, z);
            root.add(foot);
        }
    }
    for (const z of [-2.35, 2.35]) {
        const beam = box(7.7, .32, .34, steel);
        beam.position.set(0, 4.78, z);
        root.add(beam);
    }
    const bridge = box(.42, .38, 5.2, safety);
    bridge.position.set(.75, 5.02, 0);
    root.add(bridge);
    const trolley = box(.82, .42, .72, steel);
    trolley.position.set(.75, 4.72, -.15);
    root.add(trolley);
    for (const x of [.64, .86]) {
        const chain = new THREE.Mesh(new THREE.CylinderGeometry(.022, .022, 1.65, 6), steel);
        chain.position.set(x, 3.68, -.15);
        chain.castShadow = true;
        root.add(chain);
    }
    const hook = new THREE.Mesh(new THREE.TorusGeometry(.18, .045, 5, 10, Math.PI * 1.45), safety);
    hook.position.set(.75, 2.82, -.15);
    hook.rotation.z = Math.PI * .18;
    root.add(hook);

    // Back catwalk, rails and ladder.
    const walk = box(10.8, .18, 1.15, steel);
    walk.position.set(-.6, 3.18, 5.18);
    root.add(walk);
    for (const x of [-5.85, -3.6, -1.35, .9, 3.15, 4.8]) {
        const railPost = box(.08, .92, .08, safety);
        railPost.position.set(x, 3.68, 4.68);
        root.add(railPost);
    }
    const railTop = box(10.8, .08, .08, safety);
    railTop.position.set(-.6, 4.12, 4.68);
    root.add(railTop);
    for (const x of [-6.55, -6.15]) {
        const ladderSide = box(.08, 3.05, .08, safety);
        ladderSide.position.set(x, 1.62, 4.88);
        root.add(ladderSide);
    }
    for (let y = .35; y < 3.05; y += .34) {
        const rung = box(.46, .055, .07, safety);
        rung.position.set(-6.35, y, 4.88);
        root.add(rung);
    }

    // Work/storage dressing: lockers, bench, crates, drums and a spare-part rack.
    for (let i = 0; i < 4; i++) {
        const locker = box(.72, 2.05, .62, i % 2 ? steel : teal);
        locker.position.set(5.55 + (i % 2) * .78, 1.03, 4.25 - Math.floor(i / 2) * .72);
        root.add(locker);
    }
    const bench = box(3.2, .18, .85, rust);
    bench.position.set(-5.1, 1.08, 3.65);
    root.add(bench);
    for (const x of [-6.35, -3.85]) {
        const leg = box(.16, 1.0, .16, steel);
        leg.position.set(x, .54, 3.65);
        root.add(leg);
    }
    const rackA = box(.18, 2.7, .18, steel); rackA.position.set(6.65, 1.35, .75); root.add(rackA);
    const rackB = box(.18, 2.7, .18, steel); rackB.position.set(4.55, 1.35, .75); root.add(rackB);
    for (const y of [.42, 1.28, 2.14]) {
        const shelf = box(2.3, .10, 1.0, steel); shelf.position.set(5.6, y, .75); root.add(shelf);
        const spare = box(.65, .42, .72, y > 2 ? safety : teal); spare.position.set(5.6, y + .28, .75); root.add(spare);
    }
    for (const [x,z,c] of [[-5.9,1.7,0x765034],[-4.9,1.35,0x3b6660],[5.7,-2.7,0x6d432d]]) {
        const crate = box(1.05, .78, .92, mat(c, .92, .08));
        crate.position.set(x, .39, z);
        root.add(crate);
    }
    for (const [x,z] of [[-6.5,-2.9],[-5.75,-3.05],[6.35,3.0]]) {
        const drum = new THREE.Mesh(new THREE.CylinderGeometry(.34, .34, .9, 10), mat(0x4b5550, .78, .36));
        drum.position.set(x, .45, z); drum.castShadow = true; drum.receiveShadow = true; root.add(drum);
    }

    const lampMat = new THREE.MeshStandardMaterial({ color: 0xffdfad, emissive: 0xffb454, emissiveIntensity: 3.4, roughness: .45 });
    for (const x of [-2.7, 0, 2.7]) {
        const fixture = box(1.55, .10, .25, lampMat);
        fixture.position.set(x, 5.45, -.3);
        root.add(fixture);
        const lamp = new THREE.PointLight(0xffc178, 18, 10, 2.0);
        lamp.position.set(x, 5.15, -.3);
        root.add(lamp);
    }
    const hemi = new THREE.HemisphereLight(0x9fb7aa, 0x17130f, .48);
    root.add(hemi);
    const key = new THREE.DirectionalLight(0xffd19b, 2.35);
    key.position.set(-5, 8, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(256, 256);
    key.shadow.camera.left = -9; key.shadow.camera.right = 9;
    key.shadow.camera.top = 8; key.shadow.camera.bottom = -4;
    key.shadow.camera.near = 1; key.shadow.camera.far = 24;
    key.shadow.bias = -.0006; key.shadow.normalBias = .045;
    root.add(key);
    const rim = new THREE.DirectionalLight(0x70a9a4, .82);
    rim.position.set(6, 4, -5);
    root.add(rim);

    return root;
}
'''
scene = replace_once(scene, "function buildWarehouse(scene) {", garage_builder + "\nfunction buildWarehouse(scene) {", 'garage bay builder')
write('scene.js', scene)

# -----------------------------------------------------------------------------
# main.js — low-res world + display-res HUD compositor
# -----------------------------------------------------------------------------
main = read('main.js')
main = replace_once(main, "renderer.shadowMap.type = THREE.BasicShadowMap;", "renderer.shadowMap.type = THREE.PCFShadowMap;", 'filtered source shadows')
main = replace_once(main,
    "mount.appendChild(renderer.domElement);\nconst arena = createArenaScene(assembly, targetAssembly);",
    "mount.appendChild(renderer.domElement);\nconst hudRenderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, powerPreference: 'low-power' });\nhudRenderer.outputColorSpace = THREE.SRGBColorSpace;\nhudRenderer.setClearColor(0x000000, 0);\nhudRenderer.domElement.className = 'hud-canvas';\nhudRenderer.domElement.setAttribute('aria-hidden', 'true');\nhudRenderer.domElement.style.pointerEvents = 'none';\nmount.appendChild(hudRenderer.domElement);\nconst arena = createArenaScene(assembly, targetAssembly);",
    'HUD renderer creation')
main = replace_once(main,
    "    renderer.setSize(Math.floor(width * renderScale), Math.floor(height * renderScale), false);\n    renderer.domElement.style.width = `${width}px`;\n    renderer.domElement.style.height = `${height}px`;\n    syncInspectorLayout();",
    "    renderer.setSize(Math.floor(width * renderScale), Math.floor(height * renderScale), false);\n    renderer.domElement.style.width = `${width}px`;\n    renderer.domElement.style.height = `${height}px`;\n    // The combiner is intentionally independent from world resolution: keep text crisp\n    // without paying full-resolution lighting/shading cost for the arena.\n    hudRenderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));\n    hudRenderer.setSize(width, height, false);\n    hudRenderer.domElement.style.width = `${width}px`;\n    hudRenderer.domElement.style.height = `${height}px`;\n    syncInspectorLayout();",
    'HUD renderer resize')
main = replace_once(main,
    "            `RENDER    ${Math.round(renderScale * 100)}%`,",
    "            `RENDER    WORLD ${Math.round(renderScale * 100)}% · HUD HI-RES`,",
    'dev render readout')
main = replace_once(main,
    "    renderer.render(arena.scene, arena.camera);\n    requestAnimationFrame(frame);",
    "    // World and cockpit telemetry deliberately use separate resolution budgets.\n    arena.camera.layers.set(0);\n    renderer.render(arena.scene, arena.camera);\n    hudRenderer.clear();\n    if (!inspecting) {\n        arena.camera.layers.set(1);\n        hudRenderer.render(arena.scene, arena.camera);\n    }\n    arena.camera.layers.set(0);\n    requestAnimationFrame(frame);",
    'split-resolution rendering')
write('main.js', main)

# -----------------------------------------------------------------------------
# acquisitionUI.js — compact horizontal report, two-card score and salvage layouts
# -----------------------------------------------------------------------------
acquisition_ui = r'''/** k.3l.3 — compact post-bout score + physical salvage drafting.
 * Result, score and salvage are fixed-height horizontal cards. The salvage browser
 * scrolls independently from the selected physical part so the claim control never
 * falls off-screen on a phone.
 */
import { activePlayerArena } from './scene.js';
import { loadMachine, storeMachine } from './persistence.js';
import { recoverSalvage } from './acquisition.js';
import { latestBoutResult, subscribeBoutResult } from './boutSession.js';
import { partCreditValue } from './partEconomy.js';
import { createPartCard, createPartDetail, installPartGridStyles, sortPartEntries } from './partGridUI.js';
import {
    advanceAiDraft, claimDraftEntry, claimToRecoveryOffer, currentDrafter,
    playerClaimChoices, skipDraftTurn,
} from './salvageDraft.js';

const sheet = document.querySelector('#sortie-debrief');
const lines = document.querySelector('#debrief-lines');
const garage = document.querySelector('#debrief-garage');
const fieldStatus = document.querySelector('#field-status');
const pages = document.querySelector('#debrief-pages');
const scorePage = document.querySelector('#debrief-score-page');
const salvagePage = document.querySelector('#debrief-salvage-page');
const pageNav = document.querySelector('#debrief-page-nav');
const pagePrev = document.querySelector('#debrief-prev');
const pageNext = document.querySelector('#debrief-next');
if (!sheet || !lines || !garage || !pages || !scorePage || !salvagePage || !pageNav || !pagePrev || !pageNext)
    throw new Error('Bout salvage UI needs the paged debrief surface.');
const pageButtons = [...pageNav.querySelectorAll('[data-debrief-target]')];

let storage = null;
try { storage = window.localStorage; }
catch { /* Storage-unavailable sessions can inspect but cannot claim hardware. */ }

const actorLabel = (result, id) => result?.score?.standings?.find(row => row.id === id)?.label ?? id;
const percent = value => `${Math.round(Math.max(0, Math.min(1, Number(value) || 0)) * 100)}%`;
let sortMode = 'wreck';
let claimableOnly = false;
let selectedEntryId = null;
let currentPageIndex = 0;
let lastRenderedResult = null;
let pageScrollFrame = null;
let autoGarageTimer = null;

function injectStyles() {
    installPartGridStyles();
    if (document.querySelector('#bout-stakes-styles')) return;
    const style = document.createElement('style');
    style.id = 'bout-stakes-styles';
    style.textContent = `
.debrief-content{position:relative;width:min(740px,94vw)!important;height:min(86dvh,560px);max-height:86dvh!important;overflow:hidden!important;display:flex;flex-direction:column;padding:11px 14px 10px!important}.debrief-pages{display:flex;flex:1 1 auto;min-height:0;width:100%;overflow-x:auto;overflow-y:hidden;scroll-snap-type:x mandatory;scroll-behavior:smooth;overscroll-behavior-x:contain;-webkit-overflow-scrolling:touch;touch-action:pan-x;scrollbar-width:none}.debrief-pages::-webkit-scrollbar{display:none}.debrief-page{flex:0 0 100%;width:100%;min-width:0;min-height:0;overflow:hidden;scroll-snap-align:start;scroll-snap-stop:always;padding:2px 18px 5px}.debrief-page-title{margin:0 0 4px;color:#86998a;font:800 7px/1 ui-monospace,monospace;letter-spacing:.15em}.debrief-page-result .sheet-label{font-size:8px}.debrief-page-result h1{margin:4px 0 7px;font-size:18px}.debrief-page-result .debrief-lines{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:5px 7px}.debrief-page-result .debrief-row{min-height:32px;margin:0;padding:5px 7px;display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:center}.debrief-page-result .debrief-row span{font-size:7px}.debrief-page-result .debrief-row strong{font-size:10px}.debrief-page-result .sheet-muted{margin:7px 0 0;font:7px/1.25 ui-monospace,monospace;color:#8f9a90}.debrief-page-nav{display:flex;justify-content:center;gap:5px;flex:0 0 auto;padding:6px 0 5px;border-top:1px solid #8a754c44}.debrief-page-nav button{min-width:68px;min-height:24px;padding:3px 7px;border:1px solid #596b60;background:#151b18;color:#87998d;font:800 7px/1 ui-monospace,monospace;letter-spacing:.08em}.debrief-page-nav button.active{border-color:#d0a95f;background:#302a1c;color:#edc77a}.debrief-edge{position:absolute;z-index:4;top:43%;width:30px;height:56px;border:1px solid #6c806f;background:#101713d9;color:#d6b871;font:900 25px/1 ui-monospace,monospace;opacity:.82}.debrief-edge:disabled{opacity:.12}.debrief-edge-left{left:5px}.debrief-edge-right{right:5px}.debrief-content>.sheet-done{flex:0 0 auto;min-height:32px;margin-top:0;padding:6px 10px;font-size:9px}
.score-layout{height:calc(100% - 13px);display:grid;grid-template-columns:minmax(0,.92fr) minmax(0,1.08fr);gap:8px}.score-card{min-width:0;min-height:0;padding:8px;border:1px solid #68776d;background:#111714;color:#d8d0b9;font:7px/1.25 ui-monospace,monospace}.score-card h2{margin:0 0 3px;color:#edc77a;font:900 11px/1.1 ui-monospace,monospace;letter-spacing:.08em}.score-kicker{color:#91aa97;margin-bottom:6px}.score-stat-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px}.score-stat{min-height:39px;padding:5px;border:1px solid #59665a55;background:#171d1a}.score-stat span,.score-stat small{display:block;color:#89998e}.score-stat b{display:block;margin:2px 0;color:#e0c078;font-size:12px}.score-stat small{font-size:6px}.score-explain{margin-top:6px;padding-top:5px;border-top:1px solid #59665a42;color:#9dac9d;font-size:6.5px}.score-match-meta{display:grid;grid-template-columns:1fr 1fr;gap:4px;margin-bottom:5px}.score-match-meta div{padding:5px;border:1px solid #59665a55;background:#171d1a}.score-match-meta span,.score-match-meta b{display:block}.score-match-meta span{color:#89998e}.score-match-meta b{margin-top:2px;color:#e0c078;font-size:10px}.score-standings{border-top:1px solid #59665a42}.score-standing{display:grid;grid-template-columns:15px minmax(64px,1fr) 42px minmax(92px,1.35fr);gap:4px;align-items:center;min-height:20px;border-bottom:1px solid #59665a2b}.score-standing b{color:#e0c078}.score-standing small{color:#8d9b90;font-size:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.score-standing.low{opacity:.52}.score-standing.mvp strong:after{content:' · MVP';color:#f2c96f}.draft-order{margin-top:5px;padding:5px 6px;border:1px solid #8a754c66;color:#ccb77f;background:#26251d;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.salvage-draft{height:calc(100% - 13px);display:flex;flex-direction:column;min-height:0;color:#d8d0b9;font:7px/1.25 ui-monospace,monospace}.salvage-head{display:flex;align-items:baseline;justify-content:space-between;gap:8px;flex:0 0 auto;padding:0 1px 5px}.salvage-head h2{margin:0;color:#edc77a;font:900 11px/1 ui-monospace,monospace;letter-spacing:.08em}.salvage-head span{color:#8fa293;font-size:6.5px;text-align:right}.salvage-layout{display:grid;grid-template-columns:minmax(0,1.15fr) minmax(210px,.85fr);gap:8px;flex:1 1 auto;min-height:0}.salvage-browser,.salvage-inspector{min-width:0;min-height:0;border:1px solid #68776d;background:#111714;padding:6px}.salvage-browser{display:flex;flex-direction:column}.salvage-browser .part-grid-toolbar{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:3px;flex:0 0 auto;margin:0 0 5px}.salvage-browser .part-grid-toolbar button{min-height:22px;padding:3px 2px;font-size:6px}.salvage-scroll{min-height:0;overflow-y:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch;touch-action:pan-y;padding-right:2px}.salvage-browser .part-grid{grid-template-columns:repeat(3,minmax(0,1fr));gap:4px;margin-top:4px}.salvage-browser .part-card{min-height:58px;aspect-ratio:1.18/1}.salvage-browser .part-card-slot{font-size:9px}.salvage-browser .part-card-value,.salvage-browser .part-card-condition,.salvage-browser .part-card-source{font-size:5.8px}.wreck-grid-section{margin-top:5px}.wreck-grid-section:first-child{margin-top:0}.wreck-grid-section>header{padding:2px 1px;font-size:7px}.wreck-grid-section>header small{font-size:5.5px}.salvage-inspector{display:flex;flex-direction:column}.salvage-inspector .part-detail{display:grid;grid-template-columns:1fr;grid-template-rows:minmax(86px,1fr) auto;gap:5px;height:100%;min-height:0;margin:0;padding:0;border:0;background:transparent}.salvage-inspector .part-detail-preview{min-height:0}.salvage-inspector .part-detail-copy{padding:4px 2px 0}.salvage-inspector .part-detail h3{font-size:10px}.salvage-inspector .part-detail-meta{font-size:6.5px;line-height:1.3}.salvage-inspector .part-detail-value{font-size:9px}.salvage-inspector .part-detail-action{min-height:31px;margin-top:5px}.salvage-empty,.salvage-placeholder{padding:12px 6px;color:#87978a;text-align:center;border:1px dashed #59665a}.salvage-confirm-note{margin-top:4px;color:#89998e;font-size:6px}.salvage-action-message{margin:5px 0 0;padding:5px 6px;border:1px solid #bb7255;color:#efb188;background:#2c1815;font:800 6.5px/1.3 ui-monospace,monospace}
@media(max-width:730px){.debrief-content{width:min(700px,96vw)!important;padding:8px 10px!important}.debrief-page{padding-left:15px;padding-right:15px}.debrief-edge{width:25px;height:48px}.score-layout,.salvage-layout{gap:6px}.score-card{padding:6px}.score-stat{min-height:34px;padding:4px}.score-stat b{font-size:10px}.score-standing{grid-template-columns:13px minmax(54px,1fr) 36px minmax(70px,1.2fr);font-size:6.5px}.salvage-browser,.salvage-inspector{padding:5px}.salvage-browser .part-card{min-height:52px}}
@media(max-height:430px){.debrief-content{height:88dvh;max-height:88dvh!important}.debrief-page-result h1{font-size:15px;margin:3px 0 5px}.debrief-page-result .debrief-row{min-height:27px;padding:4px 6px}.debrief-page-result .sheet-muted{margin-top:4px}.score-stat{min-height:31px}.score-stat b{font-size:9px}.score-explain{margin-top:4px;padding-top:3px}.score-standing{min-height:17px}.salvage-head{padding-bottom:3px}.salvage-browser .part-grid-toolbar{margin-bottom:3px}.salvage-browser .part-card{min-height:46px}.salvage-inspector .part-detail{grid-template-rows:minmax(72px,1fr) auto}.debrief-page-nav{padding:4px 0}.debrief-content>.sheet-done{min-height:28px;padding:4px 8px}}
`;
    document.head.append(style);
}

function thumbnail(entry) {
    const session = activePlayerArena();
    return session?.arena?.partThumbnailDataUrl?.(entry.definitionId, entry) ?? null;
}

function entryValue(entry) {
    return Number.isFinite(entry?.value)
        ? entry.value
        : partCreditValue(entry?.definitionId, entry?.condition, { destroyed: entry?.destroyed });
}

function statTile(label, value, note) {
    const tile = document.createElement('div');
    tile.className = 'score-stat';
    const name = document.createElement('span'); name.textContent = label;
    const amount = document.createElement('b'); amount.textContent = value;
    const detail = document.createElement('small'); detail.textContent = note;
    tile.append(name, amount, detail);
    return tile;
}

function renderScore(result) {
    scorePage.replaceChildren();
    const title = document.createElement('div'); title.className = 'debrief-page-title'; title.textContent = '02 / SCORE';
    scorePage.append(title);
    if (!result || sheet.classList.contains('hidden')) return;
    const standings = result.score.standings ?? [];
    const player = standings.find(row => row.id === 'player');
    const rank = Math.max(1, standings.findIndex(row => row.id === 'player') + 1);
    const layout = document.createElement('div'); layout.className = 'score-layout';

    const personal = document.createElement('section'); personal.className = 'score-card score-personal';
    const personalTitle = document.createElement('h2'); personalTitle.textContent = 'YOUR BOUT';
    const personalKick = document.createElement('div'); personalKick.className = 'score-kicker';
    personalKick.textContent = player
        ? `RANK ${rank}/${standings.length}${result.score.mvp?.id === 'player' ? ' · MVP' : ''} · ${player.survived ? 'RETURNED TO BAY' : 'MISSION KILLED'}`
        : 'NO PLAYER SCORE RECORDED';
    personal.append(personalTitle, personalKick);
    if (player) {
        const grid = document.createElement('div'); grid.className = 'score-stat-grid';
        grid.append(
            statTile('TOTAL SCORE', Math.round(player.totalScore), 'combat + result + survival'),
            statTile('COMBAT SCORE', Math.round(player.combatScore), 'direct fighting contribution'),
            statTile('MISSION KILLS', player.missionKills, 'rigs made combat-ineffective'),
            statTile('DISABLES', player.disables, 'individual modules disabled'),
            statTile('ASSISTS', player.assists, 'meaningful shared takedowns'),
            statTile('BREACHES', player.breaches, 'armor sections opened'),
            statTile('INTERNAL DMG', `${Math.round(player.internalPercent)}%`, 'integrity removed across targets'),
            statTile('ARMOR STRIPPED', `${Math.round(player.armorPercent)}%`, 'armor removed across targets'),
        );
        personal.append(grid);
        const explain = document.createElement('div'); explain.className = 'score-explain';
        const draftRank = (result.score.draftOrder ?? []).indexOf('player');
        explain.textContent = draftRank >= 0
            ? `SALVAGE PRIORITY #${draftRank + 1} · score and participation determine claim order; destroying parts does not award bonus score.`
            : 'LOW PARTICIPATION CAN DROP A PILOT BEHIND QUALIFIED TEAMMATES IN SALVAGE ORDER.';
        personal.append(explain);
    }

    const match = document.createElement('section'); match.className = 'score-card score-match';
    const matchTitle = document.createElement('h2'); matchTitle.textContent = 'FIELD RESULT';
    const matchKick = document.createElement('div'); matchKick.className = 'score-kicker';
    matchKick.textContent = result.victory ? 'FRIENDLY TEAM CONTROLS THE FIELD' : 'HOSTILE TEAM CONTROLS THE FIELD';
    const meta = document.createElement('div'); meta.className = 'score-match-meta';
    const mvp = document.createElement('div'); mvp.innerHTML = `<span>MVP</span><b>${result.score.mvp?.label ?? '—'} · ${Math.round(result.score.mvp?.combatScore ?? 0)}</b>`;
    const preservation = document.createElement('div'); preservation.innerHTML = `<span>WRECK PRESERVATION</span><b>${result.victory ? `${result.wreckPreservation}%` : '—'}</b>`;
    meta.append(mvp, preservation);
    const table = document.createElement('div'); table.className = 'score-standings';
    standings.forEach((row, index) => {
        const item = document.createElement('div');
        item.className = `score-standing${row.lowParticipation ? ' low' : ''}${row.id === result.score.mvp?.id ? ' mvp' : ''}`;
        const rankEl = document.createElement('b'); rankEl.textContent = String(index + 1);
        const name = document.createElement('strong'); name.textContent = row.label;
        const score = document.createElement('b'); score.textContent = String(Math.round(row.totalScore));
        const stats = document.createElement('small');
        stats.textContent = `${row.missionKills}K · ${row.assists}A · ${row.disables}DIS · ${row.survived ? 'RTB' : 'OUT'}${row.lowParticipation ? ' · LOW' : ''}`;
        item.append(rankEl, name, score, stats); table.append(item);
    });
    match.append(matchTitle, matchKick, meta, table);
    if (result.victory) {
        const order = document.createElement('div'); order.className = 'draft-order';
        order.textContent = `SALVAGE · ${result.score.draftOrder.map(id => actorLabel(result, id)).join(' → ')}`;
        match.append(order);
    }
    layout.append(personal, match);
    scorePage.append(layout);
}

function isClaimable(result, entry) {
    return currentDrafter(result.draft) === 'player' && !entry.destroyed && !entry.claimedBy &&
        playerClaimChoices(result.draft).some(choice => choice.id === entry.id);
}

function visibleEntries(result, entries) {
    const filtered = claimableOnly ? entries.filter(entry => isClaimable(result, entry)) : entries;
    return sortMode === 'wreck' ? filtered : sortPartEntries(filtered, sortMode);
}

function appendToolbar(panel) {
    const toolbar = document.createElement('div'); toolbar.className = 'part-grid-toolbar';
    for (const [mode, label] of [['wreck','WRECK'],['value','VALUE'],['condition','COND'],['type','TYPE']]) {
        const button = document.createElement('button'); button.type = 'button'; button.textContent = label;
        button.classList.toggle('active', sortMode === mode);
        button.addEventListener('click', () => { sortMode = mode; render(); });
        toolbar.append(button);
    }
    const filter = document.createElement('button'); filter.type = 'button';
    filter.textContent = claimableOnly ? 'CLAIMABLE' : 'ALL';
    filter.classList.toggle('active', claimableOnly);
    filter.addEventListener('click', () => { claimableOnly = !claimableOnly; render(); });
    toolbar.append(filter); panel.append(toolbar);
}

function appendGrid(panel, result, entries, sourceLabel = '') {
    const list = visibleEntries(result, entries);
    if (!list.length) return;
    const grid = document.createElement('div'); grid.className = 'part-grid';
    for (const entry of list) {
        const card = createPartCard({
            entry, thumbnailUrl: thumbnail(entry), value: entryValue(entry),
            selected: selectedEntryId === entry.id,
            source: sourceLabel || entry.actorLabel || entry.actorId,
            claimed: !!entry.claimedBy,
            onSelect: () => { selectedEntryId = entry.id; render(); },
        });
        grid.append(card);
    }
    panel.append(grid);
}

function appendWreckGroups(panel, result) {
    if (sortMode !== 'wreck') {
        appendGrid(panel, result, result.draft.pool);
        return;
    }
    for (const manifest of result.wrecks) {
        const section = document.createElement('section'); section.className = 'wreck-grid-section';
        const head = document.createElement('header');
        const title = document.createElement('strong'); title.textContent = manifest.label;
        const contribution = result.score.contributionByVictim[manifest.actorId] ?? [];
        const detail = document.createElement('small');
        detail.textContent = contribution.length
            ? contribution.map(item => `${actorLabel(result, item.actorId)} ${item.percent}%`).join(' · ')
            : 'NO SCORED DAMAGE';
        head.append(title, detail); section.append(head);
        appendGrid(section, result, result.draft.pool.filter(entry => entry.actorId === manifest.actorId), manifest.label);
        if (section.querySelector('.part-grid')) panel.append(section);
    }
}

function appendSelection(panel, result) {
    const entry = result.draft.pool.find(item => item.id === selectedEntryId);
    if (!entry) {
        const empty = document.createElement('div'); empty.className = 'salvage-placeholder';
        empty.textContent = 'SELECT A PHYSICAL COMPONENT'; panel.append(empty); return;
    }
    const claimable = isClaimable(result, entry);
    const claimed = entry.claimedBy ? `CLAIMED BY ${actorLabel(result, entry.claimedBy)}` : '';
    const meta = `${entry.actorLabel ?? entry.actorId} · ${entry.slot.toUpperCase()}${claimed ? `\n${claimed}` : ''}${entry.destroyed ? '\nDESTROYED HARDWARE · SCRAP ONLY' : entry.disabled ? '\nDISABLED · REBUILDABLE' : ''}`;
    const actionLabel = entry.destroyed ? 'DESTROYED · SCRAP ONLY' : entry.claimedBy
        ? `CLAIMED · ${actorLabel(result, entry.claimedBy)}`
        : claimable ? 'CONFIRM CLAIM · FREE' : 'NOT YOUR CLAIM TURN';
    const detail = createPartDetail({
        entry, thumbnailUrl: thumbnail(entry), value: entryValue(entry), meta,
        actionLabel, actionDisabled: !claimable,
        onAction: () => claimPlayerPart(result, entry),
    });
    panel.append(detail);
    if (claimable) {
        const note = document.createElement('div'); note.className = 'salvage-confirm-note';
        note.textContent = 'EXACT SERIAL + BATTLE CONDITION ENTER OWNED INVENTORY.';
        panel.append(note);
    }
}

function renderDraft(result) {
    salvagePage.replaceChildren();
    const title = document.createElement('div'); title.className = 'debrief-page-title'; title.textContent = '03 / SALVAGE';
    salvagePage.append(title);
    garage.textContent = 'RETURN TO GARAGE';
    if (!result?.victory || !result.draft || sheet.classList.contains('hidden')) return;

    advanceAiDraft(result.draft, 'player');
    const choices = playerClaimChoices(result.draft);
    if (currentDrafter(result.draft) === 'player' && choices.length === 0) {
        skipDraftTurn(result.draft, 'player', 'NO RECOVERABLE HARDWARE');
        advanceAiDraft(result.draft, 'player');
    }
    if (selectedEntryId && !result.draft.pool.some(entry => entry.id === selectedEntryId)) selectedEntryId = null;
    if (!selectedEntryId) {
        selectedEntryId = playerClaimChoices(result.draft)[0]?.id
            ?? result.draft.pool.find(entry => !entry.destroyed && !entry.claimedBy)?.id
            ?? result.draft.pool[0]?.id
            ?? null;
    }

    const panel = document.createElement('section'); panel.className = 'salvage-draft';
    const head = document.createElement('div'); head.className = 'salvage-head';
    const heading = document.createElement('h2');
    heading.textContent = currentDrafter(result.draft) === 'player' ? 'YOUR SALVAGE CLAIM' : 'SALVAGE COMPLETE';
    const rule = document.createElement('span');
    rule.textContent = '1 CLAIM / PILOT · DESTROYED = SCRAP · PERSONAL HARDWARE PROTECTED';
    head.append(heading, rule); panel.append(head);

    const layout = document.createElement('div'); layout.className = 'salvage-layout';
    const browser = document.createElement('section'); browser.className = 'salvage-browser';
    appendToolbar(browser);
    const scroll = document.createElement('div'); scroll.className = 'salvage-scroll';
    appendWreckGroups(scroll, result);
    if (!scroll.querySelector('.part-grid')) {
        const empty = document.createElement('div'); empty.className = 'salvage-empty';
        empty.textContent = claimableOnly ? 'NO CLAIMABLE HARDWARE IN THIS VIEW.' : 'NO WRECK HARDWARE RECORDED.';
        scroll.append(empty);
    }
    browser.append(scroll);

    const inspector = document.createElement('section'); inspector.className = 'salvage-inspector';
    appendSelection(inspector, result);
    layout.append(browser, inspector); panel.append(layout); salvagePage.append(panel);

    if (currentDrafter(result.draft) === 'player')
        garage.textContent = 'FORFEIT CLAIM · RETURN TO GARAGE';
}

function showClaimProblem(message) {
    const host = salvagePage.querySelector('.salvage-inspector') ?? salvagePage;
    let notice = host.querySelector('.salvage-action-message');
    if (!notice) {
        notice = document.createElement('div'); notice.className = 'salvage-action-message'; notice.setAttribute('role', 'status'); host.append(notice);
    }
    notice.textContent = message;
    if (fieldStatus) {
        fieldStatus.dataset.message = message; fieldStatus.textContent = message; fieldStatus.classList.add('message', 'blocked');
    }
}

function rollbackDraftClaim(draft, entry, entryId) {
    entry.claimedBy = null;
    const pickIndex = [...draft.picks].reverse().findIndex(pick => pick.actorId === 'player' && pick.entryId === entryId);
    if (pickIndex >= 0) draft.picks.splice(draft.picks.length - 1 - pickIndex, 1);
    draft.cursor = Math.max(0, draft.cursor - 1);
}

function scheduleGarageReturn(result) {
    if (autoGarageTimer !== null) window.clearTimeout(autoGarageTimer);
    garage.textContent = 'CLAIM SECURED · RETURNING TO GARAGE';
    autoGarageTimer = window.setTimeout(() => {
        autoGarageTimer = null;
        if (!sheet.classList.contains('hidden') && result === latestBoutResult() && !currentDrafter(result.draft))
            garage.click();
    }, 900);
}

function claimPlayerPart(result, entry) {
    if (currentDrafter(result.draft) !== 'player' || entry.destroyed || entry.claimedBy) {
        showClaimProblem('CLAIM NO LONGER AVAILABLE · REFRESHED DRAFT STATE'); return;
    }
    if (!storage) { showClaimProblem('CLAIM BLOCKED · LOCAL SAVE UNAVAILABLE'); return; }
    const session = activePlayerArena();
    const liveAssembly = session?.assembly;
    if (!liveAssembly) { showClaimProblem('CLAIM BLOCKED · LIVE GARAGE ASSEMBLY NOT CONNECTED'); return; }
    const offer = claimToRecoveryOffer(entry);
    if (!offer) { showClaimProblem('CLAIM BLOCKED · INVALID SALVAGE RECORD'); return; }
    const recovered = recoverSalvage(liveAssembly, offer);
    if (!recovered.ok) { showClaimProblem(`CLAIM BLOCKED · ${recovered.reason}`); return; }
    const removeRecovered = () => {
        const index = liveAssembly.owned.findIndex(part => part.serial === recovered.instance.serial);
        if (index >= 0) liveAssembly.owned.splice(index, 1);
    };
    const claimed = claimDraftEntry(result.draft, 'player', entry.id);
    if (!claimed.ok) { removeRecovered(); showClaimProblem(`CLAIM BLOCKED · ${claimed.reason}`); return; }
    const state = loadMachine(storage);
    state.assembly = structuredClone(liveAssembly);
    if (!storeMachine(storage, state)) {
        removeRecovered(); rollbackDraftClaim(result.draft, entry, entry.id);
        showClaimProblem('CLAIM NOT SAVED · LOCAL STORAGE WRITE FAILED · TRY AGAIN'); return;
    }
    advanceAiDraft(result.draft, 'player');
    selectedEntryId = entry.id;
    document.dispatchEvent(new CustomEvent('m3ch4:inventory-changed', {
        detail: { serial: recovered.instance.serial, definitionId: recovered.definition.id },
    }));
    if (fieldStatus) {
        fieldStatus.dataset.message = `RECOVERED · ${recovered.definition.name} · ${recovered.instance.serial} · ${percent(recovered.instance.condition)}`;
        fieldStatus.textContent = fieldStatus.dataset.message;
        fieldStatus.classList.remove('blocked'); fieldStatus.classList.add('message');
    }
    render();
    if (!currentDrafter(result.draft)) scheduleGarageReturn(result);
}

function visiblePageIndices() {
    return pageButtons.filter(button => !button.hidden).map(button => Number(button.dataset.debriefTarget));
}

function syncPageNav() {
    const width = Math.max(1, pages.clientWidth);
    const visible = visiblePageIndices();
    const maxIndex = visible.length ? Math.max(...visible) : 0;
    currentPageIndex = Math.max(0, Math.min(maxIndex, Math.round(pages.scrollLeft / width)));
    for (const button of pageButtons) {
        const active = Number(button.dataset.debriefTarget) === currentPageIndex;
        button.classList.toggle('active', active);
        button.setAttribute('aria-current', active ? 'page' : 'false');
    }
    const position = visible.indexOf(currentPageIndex);
    pagePrev.disabled = position <= 0;
    pageNext.disabled = position < 0 || position >= visible.length - 1;
}

function goToPage(index, behavior = 'smooth') {
    const button = pageButtons.find(item => Number(item.dataset.debriefTarget) === index && !item.hidden);
    if (!button) return;
    currentPageIndex = index;
    pages.scrollTo({ left: pages.clientWidth * index, top: 0, behavior });
    syncPageNav();
}

function movePage(direction) {
    const visible = visiblePageIndices();
    const position = visible.indexOf(currentPageIndex);
    const next = visible[Math.max(0, Math.min(visible.length - 1, position + direction))];
    if (next !== undefined) goToPage(next);
}

function syncPager(result) {
    const hasSalvage = !!result?.victory;
    salvagePage.hidden = !hasSalvage;
    const salvageButton = pageButtons.find(button => Number(button.dataset.debriefTarget) === 2);
    if (salvageButton) salvageButton.hidden = !hasSalvage;
    if (!hasSalvage && currentPageIndex === 2) currentPageIndex = 1;
    syncPageNav();
}

pageNav.addEventListener('click', event => {
    const button = event.target.closest('[data-debrief-target]');
    if (!button || button.hidden) return;
    goToPage(Number(button.dataset.debriefTarget));
});
pagePrev.addEventListener('click', () => movePage(-1));
pageNext.addEventListener('click', () => movePage(1));
pages.addEventListener('scroll', () => {
    if (pageScrollFrame !== null) return;
    pageScrollFrame = requestAnimationFrame(() => { pageScrollFrame = null; syncPageNav(); });
}, { passive: true });

garage.addEventListener('click', () => {
    const result = latestBoutResult();
    if (result?.draft && currentDrafter(result.draft) === 'player') {
        skipDraftTurn(result.draft, 'player', 'PLAYER FORFEITED CLAIM');
        advanceAiDraft(result.draft, 'player');
    }
}, true);

function render() {
    const result = latestBoutResult();
    const newResult = !!result && result !== lastRenderedResult;
    renderScore(result);
    renderDraft(result);
    syncPager(result);
    if (newResult) {
        lastRenderedResult = result;
        selectedEntryId = null;
        currentPageIndex = 0;
        requestAnimationFrame(() => goToPage(0, 'auto'));
    } else if (!result) {
        lastRenderedResult = null;
        selectedEntryId = null;
        if (autoGarageTimer !== null) { window.clearTimeout(autoGarageTimer); autoGarageTimer = null; }
    }
}

injectStyles();
subscribeBoutResult(render);
const observer = new MutationObserver(render);
observer.observe(sheet, { attributes: true, attributeFilter: ['class'] });
render();
'''
write('acquisitionUI.js', acquisition_ui)

# -----------------------------------------------------------------------------
# Canonical scene singleton + cache/version bumps
# -----------------------------------------------------------------------------
mount_ui = read('garageMountUI.js')
mount_ui = replace_once(mount_ui, "import { activePlayerArena } from './sceneAssembly.js';", "import { activePlayerArena } from './scene.js';", 'garage canonical arena import')
mount_ui = mount_ui.replace("./acquisitionUI.js?v=k3l2", "./acquisitionUI.js?v=k3l3")
write('garageMountUI.js', mount_ui)

scene_assembly = read('sceneAssembly.js')
scene_assembly = scene_assembly.replace("./scene.js?source=k3l2", "./scene.js?source=k3l3")
write('sceneAssembly.js', scene_assembly)

index = read('index.html')
index = index.replace('./sceneAssembly.js?v=k3l2', './sceneAssembly.js?v=k3l3')
index = index.replace('./styles.css?v=k3k3', './styles.css?v=k3l3')
index = index.replace('0.0.1k.3l.2 — Post-Bout + Pixel Lighting Polish', '0.0.1k.3l.3 — Readability + Garage Bay')
index = index.replace('RIG DIAGNOSTICS <span>0.0.1k.3l.2</span>', 'RIG DIAGNOSTICS <span>0.0.1k.3l.3</span>')
index = index.replace('<div id="debrief-pages" class="debrief-pages" aria-label="Post-bout report pages">', '<button id="debrief-prev" class="debrief-edge debrief-edge-left" type="button" aria-label="Previous report page">‹</button>\n        <button id="debrief-next" class="debrief-edge debrief-edge-right" type="button" aria-label="Next report page">›</button>\n        <div id="debrief-pages" class="debrief-pages" aria-label="Post-bout report pages">')
index = index.replace('Repair estimate is informational only. Nothing is repaired or charged until you choose a module in the garage.', 'Repair estimate is informational · garage service remains a separate choice.')
index = index.replace('./main.js?v=k3l2', './main.js?v=k3l3')
index = index.replace('./garageMountUI.js?v=k3l2', './garageMountUI.js?v=k3l3')
write('index.html', index)

# -----------------------------------------------------------------------------
# styles.css — high-res HUD canvas, quieter help, readable reload, dedicated toast
# -----------------------------------------------------------------------------
styles = read('styles.css')
styles += r'''

/* k.3l.3 — the world framebuffer stays intentionally chunky while the combiner
   gets its own display-resolution transparent canvas. */
.game-canvas { z-index:0; }
.hud-canvas {
  position:absolute; inset:0; z-index:3; display:block; pointer-events:none;
  image-rendering:auto;
}
/* Garage status messages are true toasts now; they no longer write over the contract board. */
.field-status.message {
  position:fixed !important; left:50% !important; top:max(58px,calc(env(safe-area-inset-top) + 52px)) !important;
  width:min(360px,48vw) !important; transform:translateX(-50%); z-index:32 !important;
  text-align:center !important; padding:6px 9px !important; box-shadow:0 6px 24px #000b;
  border:1px solid #6e9b78; background:#122018f2; color:#a9d4ae;
}
.field-status.message.blocked { border-color:#b96550; background:#281713f2; color:#efaa91; }
body.inspecting .orbit-help {
  padding:5px 9px; max-width:46vw; opacity:.62; font-size:7px; letter-spacing:.07em;
  background:rgba(10,15,12,.72); border-color:rgba(181,157,101,.24);
}
.reload-button:not(:disabled) { border-color:#b88b50; color:#d9cfaa; background:rgba(20,28,24,.91); }
.reload-button:disabled { opacity:.52; }
@media(max-height:430px){
  .field-status.message{top:max(45px,calc(env(safe-area-inset-top) + 40px)) !important;width:min(330px,46vw) !important;font-size:6.5px !important;}
  body.inspecting .orbit-help{padding:4px 7px;font-size:6px;}
}
'''
write('styles.css', styles)

# -----------------------------------------------------------------------------
# Source-level regressions for the presentation split and interaction layout
# -----------------------------------------------------------------------------
test = r'''import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const scene = fs.readFileSync(new URL('../scene.js', import.meta.url), 'utf8');
const main = fs.readFileSync(new URL('../main.js', import.meta.url), 'utf8');
const acquisition = fs.readFileSync(new URL('../acquisitionUI.js', import.meta.url), 'utf8');
const mount = fs.readFileSync(new URL('../garageMountUI.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('world shadows keep coherent source resolution while the world stays pixelated', () => {
    assert.match(scene, /sun\.shadow\.mapSize\.set\(512, 512\)/);
    assert.match(main, /THREE\.PCFShadowMap/);
    assert.match(main, /const renderScales = \[\.42, \.55, \.70\]/);
});

test('combiner HUD has an independent high-resolution render path', () => {
    assert.match(scene, /combinerHud\.traverse\(object => object\.layers\.set\(1\)\)/);
    assert.match(main, /const hudRenderer = new THREE\.WebGLRenderer/);
    assert.match(main, /arena\.camera\.layers\.set\(1\)/);
});

test('garage is an isolated service-bay presentation at a stable origin', () => {
    assert.match(scene, /function buildGarageBay\(\)/);
    assert.match(scene, /arenaRoot\.visible = !enabled/);
    assert.match(scene, /garageRoot\.visible = enabled/);
    assert.match(scene, /exterior\.root\.position\.set\(0, 0, 0\)/);
});

test('post-bout flow exposes compact two-card layouts and explicit page arrows', () => {
    assert.match(acquisition, /score-layout/);
    assert.match(acquisition, /salvage-layout/);
    assert.match(acquisition, /scheduleGarageReturn/);
    assert.match(html, /id="debrief-prev"/);
    assert.match(html, /id="debrief-next"/);
});

test('all garage adapters consume the canonical active arena singleton', () => {
    assert.match(mount, /from '\.\/scene\.js'/);
    assert.doesNotMatch(mount, /from '\.\/sceneAssembly\.js'/);
});
'''
write('tests/k3l3Presentation.test.mjs', test)

print('k.3l.3 patch applied')
