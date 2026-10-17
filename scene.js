import * as THREE from 'three';
import { buildPartVisual } from './partVisuals.js';
import { framingOffsetWorld, orbitAzimuthAfterDrag, panInRigSpace } from './inspectionCamera.js';
import { DEFAULT_WORLD, HOSTILE_SPAWN, PLAYER_SPAWN, physicsYawToViewYaw } from './locomotion.js';
import { BY_ID, installedPart, SLOT_CENTERS, SLOTS } from './components.js';
import { impactProfile, integrityRatio, persistentFailureProfile } from './damageVisuals.js';
import { combinerTetherFromLook } from './cockpitView.js';
import { firstCoverHit } from './coverTruth.js';
const C = {
    concrete: 0x777267, concreteDark: 0x4d4b45,
    yellow: 0xa9822f, teal: 0x2f7473, metal: 0x343a39,
    dark: 0x151816, rust: 0x8a4d2d, amber: 0xe0a44c, green: 0x6ea778,
};

const partThumbnailCache = new Map();
let partThumbnailRenderer = null;
function disposePreviewObject(root) {
    root.traverse(object => {
        if (!object.isMesh) return;
        object.geometry?.dispose?.();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) material?.dispose?.();
    });
}
/** Render the same authored gameplay mesh used in the arena into a cached visual
 * inventory card. Condition is quantized so a phone never grows an unbounded cache. */
export function partThumbnailDataUrl(definitionId, state = {}) {
    if (typeof document === 'undefined') return null;
    const definition = BY_ID.get(definitionId);
    if (!definition) return null;
    const condition = Math.max(0, Math.min(1, Number(state.condition) || 0));
    const destroyed = !!state.destroyed || state.status === 'destroyed';
    const key = `${definitionId}:${destroyed ? 'x' : Math.round(condition * 10)}`;
    if (partThumbnailCache.has(key)) return partThumbnailCache.get(key);
    if (!partThumbnailRenderer) {
        partThumbnailRenderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, preserveDrawingBuffer: true, powerPreference: 'low-power' });
        partThumbnailRenderer.outputColorSpace = THREE.SRGBColorSpace;
        partThumbnailRenderer.toneMapping = THREE.ACESFilmicToneMapping;
        partThumbnailRenderer.toneMappingExposure = 1.18;
        partThumbnailRenderer.setSize(96, 72, false);
        partThumbnailRenderer.setPixelRatio(1);
    }
    const serial = 'PREVIEW-001';
    const assembly = { serial: 'PREVIEW', name: 'PREVIEW', owned: [{ serial, definitionId, condition: 1, wear: 0, repairs: 0 }], installed: { [definition.slot]: serial } };
    const exterior = buildExteriorRig(assembly);
    exterior.root.position.set(-definition.center[0], -definition.center[1], -definition.center[2]);
    const damageTint = new THREE.Color(0x6f2d24);
    for (const mesh of exterior.pickMeshes) {
        const material = mesh.material;
        if (!(material instanceof THREE.MeshStandardMaterial)) continue;
        if (destroyed) {
            material.color.multiplyScalar(.09);
            material.emissive.setHex(0);
        } else if (condition < .999) {
            const severity = 1 - condition;
            material.color.lerp(damageTint, Math.min(.48, severity * .46));
            material.color.multiplyScalar(Math.max(.42, 1 - severity * .36));
            if (condition <= .001) { material.emissive.setHex(0x3b130b); material.emissiveIntensity = .28; }
        }
    }
    const previewScene = new THREE.Scene();
    previewScene.background = new THREE.Color(0x0b100e);
    previewScene.add(exterior.root);
    previewScene.add(new THREE.HemisphereLight(0xa6b9ad, 0x201c18, .78));
    const keyLight = new THREE.DirectionalLight(0xffd49a, 2.5); keyLight.position.set(-4, 6, 5); previewScene.add(keyLight);
    const rim = new THREE.DirectionalLight(0x78aaa5, 1.1); rim.position.set(4, 2, -5); previewScene.add(rim);
    const bounds = new THREE.Box3().setFromObject(exterior.root);
    const sphere = bounds.getBoundingSphere(new THREE.Sphere());
    const camera = new THREE.PerspectiveCamera(36, 96 / 72, .03, 40);
    const radius = Math.max(.35, sphere.radius);
    camera.position.set(radius * 1.65, radius * .92, radius * 2.25);
    camera.lookAt(0, 0, 0);
    partThumbnailRenderer.render(previewScene, camera);
    const url = partThumbnailRenderer.domElement.toDataURL('image/png');
    partThumbnailCache.set(key, url);
    disposePreviewObject(exterior.root);
    return url;
}
export function createArenaScene(initial, targetAssembly) {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x171915);
    scene.fog = new THREE.FogExp2(0x171915, 0.0125);
    const camera = new THREE.PerspectiveCamera(68, 1, 0.06, 125);
    camera.rotation.order = 'YXZ';
    scene.add(camera);
    // Lower broad ambient wash and let shaped warm/cool sources describe the forms.
    const arenaHemisphere = new THREE.HemisphereLight(0x9dafaa, 0x171511, .56);
    scene.add(arenaHemisphere);
    const sun = new THREE.DirectionalLight(0xffd29a, 3.15);
    sun.position.set(-10, 17, 11);
    sun.castShadow = true;
    // Keep the shadow silhouette coherent at source; the deliberately low-res world
    // framebuffer does the final pixelation instead of destroying the shadow shape first.
    sun.shadow.mapSize.set(512, 512);
    sun.shadow.camera.left = -38; sun.shadow.camera.right = 38;
    sun.shadow.camera.top = 34; sun.shadow.camera.bottom = -34;
    sun.shadow.camera.near = 2; sun.shadow.camera.far = 65;
    sun.shadow.bias = -.0007; sun.shadow.normalBias = .035;
    scene.add(sun);
    const coolRim = new THREE.DirectionalLight(0x79a9a8, .90);
    coolRim.position.set(12, 6, -16);
    scene.add(coolRim);
    const arenaRoot = new THREE.Group();
    arenaRoot.name = 'arena-environment';
    scene.add(arenaRoot);
    const arenaPresentationRoot = new THREE.Group();
    arenaPresentationRoot.name = 'arena-presentation';
    scene.add(arenaPresentationRoot);
    const worldSolids = buildWarehouse(arenaRoot);
    const garageRoot = buildGarageBay();
    garageRoot.name = 'garage-bay';
    garageRoot.visible = false;
    scene.add(garageRoot);
    const GARAGE_RIG_YAW = -0.10;
    const cockpit = buildCockpit(scene);
    // The information display is still a real Three.js cockpit layer, but it rides the
    // windshield/combiner perimeter instead of sitting as three perspective-skewed blocks
    // on top of the dashboard. Cracks and blackouts remain physically in front of it.
    const combinerHud = new THREE.Group();
    combinerHud.name = 'cockpit-combiner-hud';
    camera.add(combinerHud);
    const combinerLayout = {
        // Keep persistent information on the bezel. The middle of the windshield is
        // reserved for the world, reticle and genuinely transient combat events.
        systems: { position: [-.091, .004, -.105], scale: .066 },
        team:    { position: [ 0.000, .057, -.105], scale: .052 },
        weapon:  { position: [ .091,-.004, -.105], scale: .064 },
        motion:  { position: [-.056,-.052, -.105], scale: .053 },
        drive:   { position: [ .020,-.054, -.105], scale: .053 },
    };
    for (const [name, screen] of Object.entries(cockpit.userData.instrumentScreens)) {
        cockpit.remove(screen.mesh);
        combinerHud.add(screen.mesh);
        const layout = combinerLayout[name];
        screen.mesh.position.set(...layout.position);
        screen.mesh.rotation.set(0, 0, 0);
        screen.mesh.scale.setScalar(layout.scale);
        screen.mesh.renderOrder = 90;
        screen.mesh.material.depthTest = false;
        screen.mesh.material.depthWrite = false;
    }
    const debugColliders = buildDebugColliders(scene);
    debugColliders.visible = false;
    const navMarker = new THREE.Mesh(new THREE.RingGeometry(.42, .52, 16), new THREE.MeshBasicMaterial({ color: 0x73dfc8, side: THREE.DoubleSide, depthTest: false }));
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
    }
    function updateHostileNavigation(point) {
        navMarker.visible = point !== null;
        if (point)
            navMarker.position.set(point.x, .09, point.z);
    }
    // The moving target is assembled from the SAME definitions and geometry
    // as the player. It has its own installed serials and never inherits player swaps.
    let targetExterior = buildExteriorRig(targetAssembly);
    targetExterior.root.position.set(HOSTILE_SPAWN.x, 0, HOSTILE_SPAWN.z);
    targetExterior.root.rotation.y = Math.PI; // Look back toward the pilot.
    arenaPresentationRoot.add(targetExterior.root);
    const rangeMarks = new THREE.Group();
    targetExterior.root.add(rangeMarks);
    const sootMarks = [];
    const transientFX = [];
    const targetColors = new WeakMap();
    for (const mesh of targetExterior.pickMeshes) {
        mesh.userData.actorId = 'enemy-0';
        const material = mesh.material;
        if (material instanceof THREE.MeshStandardMaterial)
            targetColors.set(mesh, material.color.clone());
    }
    const makeEmitterBudget = () => new Map(SLOTS.map(slot => [slot, { spark: 0, smoke: 0, arc: 0 }]));
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
        arenaPresentationRoot.add(marker);
        return marker;
    }
    const capturePartTransforms = exterior => new Map([...exterior.partGroups].map(([slot, group]) => [slot, {
        position: group.position.clone(), rotation: group.rotation.clone(), scale: group.scale.clone(), parent: group.parent,
    }]));
    const captureArticulation = exterior => {
        const joints = [];
        exterior.partGroups.get('mobility')?.traverse(object => {
            if (!object.userData?.joint) return;
            joints.push({ object, joint: object.userData.joint, side: Number(object.userData.side) || 0, base: object.rotation.clone() });
        });
        return { joints, phase: 0 };
    };
    const primaryMarker = makeSquadMarker('hostile');
    squadCombatants.set('enemy-0', {
        id: 'enemy-0', team: 'hostile', assembly: targetAssembly, exterior: targetExterior,
        colors: targetColors, marker: primaryMarker, active: true, condition: null,
        emitterBudget: makeEmitterBudget(), disabledSlots: new Set(), destroyedSlots: new Set(), wrecked: false, cleared: false,
        wounds: new Map(SLOTS.map(slot => [slot, []])), woundMarks: [],
        baseParts: capturePartTransforms(targetExterior), articulation: captureArticulation(targetExterior),
        recoilKick: 0, recoilRecovery: 3.2,
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
        arenaPresentationRoot.add(actorExterior.root);
        const record = {
            id, team, assembly, exterior: actorExterior, colors: colorsFor(actorExterior),
            marker: makeSquadMarker(team), active: true, condition: null,
            emitterBudget: makeEmitterBudget(), disabledSlots: new Set(), destroyedSlots: new Set(), wrecked: false, cleared: false,
            wounds: new Map(SLOTS.map(slot => [slot, []])), woundMarks: [],
            baseParts: capturePartTransforms(actorExterior), articulation: captureArticulation(actorExterior),
            recoilKick: 0, recoilRecovery: 3.2,
        };
        squadCombatants.set(id, record);
        return record;
    }
    function setCombatantActive(id, active) {
        const record = squadCombatants.get(id);
        if (!record) return;
        const wasActive = record.active;
        record.active = !!active;
        if (wasActive && !record.active)
            wreckCombatantVisual(record);
        else if (record.active && (!wasActive || record.wrecked || record.destroyedSlots.size || record.disabledSlots.size))
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
    }
    function updateSquadMarkers() {
        for (const record of squadCombatants.values()) {
            record.marker.visible = !inspecting && !record.cleared;
            if (inspecting || record.cleared) continue;
            const point = new THREE.Vector3();
            record.exterior.root.getWorldPosition(point);
            point.y += 3.55;
            record.marker.position.copy(point);
            record.marker.quaternion.copy(camera.quaternion);
        }
    }
    function combatPickMeshes(excludeId = null) {
        const meshes = [];
        for (const record of squadCombatants.values()) {
            if (record.id !== excludeId && !record.cleared)
                meshes.push(...record.exterior.pickMeshes);
        }
        return meshes;
    }
    // 0.0.1f: a deliberately small pooled pixel-particle system. Particles are
    // reused instead of allocated per shot so sustained fire stays friendly to phones.
    const particleRoot = new THREE.Group();
    arenaPresentationRoot.add(particleRoot);
    const particleStates = [];
    function makePool(count, geometry, color, transparent = false) {
        const pool = [];
        for (let i = 0; i < count; i++) {
            const material = new THREE.MeshBasicMaterial({ color, transparent, opacity: transparent ? .55 : 1, depthWrite: !transparent });
            const mesh = new THREE.Mesh(geometry, material);
            mesh.visible = false;
            particleRoot.add(mesh);
            const state = { mesh, velocity: new THREE.Vector3(), life: 0, duration: 0, gravity: 0, grow: 0, baseScale: 1, smoke: false };
            particleStates.push(state);
            pool.push(state);
        }
        return pool;
    }
    const sparkPool = makePool(88, new THREE.BoxGeometry(.042, .042, .18), 0xffc968, true);
    const chipPool = makePool(52, new THREE.BoxGeometry(.085, .060, .11), 0x4a4d46, true);
    // Soft low-resolution billboards read as smoke plumes instead of floating cubes.
    const smokePool = makePool(56, new THREE.PlaneGeometry(.24, .24), 0x252a26, true);
    let sparkCursor = 0, chipCursor = 0, smokeCursor = 0;
    const fallingParts = new Map();
    const impactLights = Array.from({ length: 5 }, () => {
        const light = new THREE.PointLight(0xffbf6c, 0, 5.5, 2);
        light.visible = false; light.castShadow = false; scene.add(light);
        return { light, life: 0, duration: 0 };
    });
    let impactLightCursor = 0;
    function flashDamageLight(position, color = 0xffbf6c, intensity = 7, duration = .10, distance = 5.5) {
        const state = impactLights[impactLightCursor++ % impactLights.length];
        state.light.position.copy(position); state.light.color.setHex(color);
        state.light.intensity = intensity; state.light.distance = distance; state.light.visible = true;
        state.life = state.duration = duration;
    }

    const glassCanvas = document.createElement('canvas');
    glassCanvas.width = 512; glassCanvas.height = 300;
    const glassTexture = new THREE.CanvasTexture(glassCanvas);
    glassTexture.magFilter = THREE.NearestFilter; glassTexture.minFilter = THREE.NearestFilter;
    const glassMaterial = new THREE.MeshBasicMaterial({ map: glassTexture, transparent: true, opacity: .82, depthTest: false, depthWrite: false, toneMapped: false });
    const glassDamage = new THREE.Mesh(new THREE.PlaneGeometry(.195, .114), glassMaterial);
    glassDamage.position.set(0, 0, -.086); glassDamage.renderOrder = 100; combinerHud.add(glassDamage);
    const blackoutMaterial = new THREE.MeshBasicMaterial({ color: 0x010201, transparent: true, opacity: 0, depthTest: false, depthWrite: false, toneMapped: false });
    const blackout = new THREE.Mesh(new THREE.PlaneGeometry(.205, .12), blackoutMaterial);
    blackout.position.set(0, 0, -.068); blackout.renderOrder = 101; camera.add(blackout);
    // Layer 1 is rendered by a tiny second renderer at display resolution. The world
    // remains intentionally low-res while cockpit telemetry stays legible.
    combinerHud.traverse(object => object.layers.set(1));
    blackout.layers.set(1);
    let hitPitchKick = 0, hitRollKick = 0, hitYawKick = 0, hitShakeKick = 0, gunDamageKick = 0;
    let powerBlackout = 0, powerFlicker = 0, cockpitWarningLevel = 0;
    let persistentPowerHealth = 1, persistentCommandHealth = 1;
    let driveLeftHealth = 1, driveRightHealth = 1, powerArcCooldown = 1.8;
    let cockpitInstrumentKey = '', cockpitMotionKey = '';
    let crackKey = -1;
    function redrawCracks(commandPercent) {
        const level = Math.max(0, Math.min(1, (72 - commandPercent) / 72));
        const key = Math.round(level * 8);
        if (key === crackKey) return;
        crackKey = key;
        const ctx = glassCanvas.getContext('2d');
        ctx.clearRect(0, 0, glassCanvas.width, glassCanvas.height);
        if (key <= 0) { glassTexture.needsUpdate = true; return; }
        const branches = [
            [[.78,.18],[.72,.29],[.76,.39],[.66,.48],[.69,.61]],
            [[.72,.29],[.61,.25],[.55,.31],[.47,.27]],
            [[.66,.48],[.57,.52],[.49,.63],[.39,.66]],
            [[.69,.61],[.77,.70],[.74,.82]],
            [[.34,.14],[.39,.25],[.36,.35],[.44,.44]],
            [[.39,.25],[.29,.31],[.23,.42]],
            [[.44,.44],[.51,.50],[.48,.58]],
            [[.23,.42],[.18,.55],[.24,.68]],
        ];
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        for (let i = 0; i < Math.min(key, branches.length); i++) {
            const points = branches[i];
            ctx.beginPath();
            ctx.moveTo(points[0][0] * 512, points[0][1] * 300);
            for (const [x,y] of points.slice(1)) ctx.lineTo(x * 512, y * 300);
            ctx.strokeStyle = i < 3 ? 'rgba(235,225,190,.72)' : 'rgba(185,205,185,.48)';
            ctx.lineWidth = i < 3 ? 2.0 : 1.25; ctx.stroke();
            ctx.strokeStyle = 'rgba(20,25,22,.58)'; ctx.lineWidth = .7; ctx.stroke();
        }
        glassTexture.needsUpdate = true;
    }
    function panelBase(screen, tone = 'green', alpha = .72) {
        const ctx = screen?.ctx; if (!ctx) return null;
        const w = screen.canvas.width, h = screen.canvas.height;
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = `rgba(7,16,13,${alpha})`; ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = tone === 'red' ? '#d56753' : tone === 'amber' ? '#cba45d' : '#6e9d7b';
        ctx.lineWidth = 3; ctx.strokeRect(1.5, 1.5, w - 3, h - 3);
        return ctx;
    }
    const systemGlyphs = { structure: '⬡', mobility: '⋀', power: 'ϟ', command: '◉', combat: '✦' };
    function conditionColor(value) {
        const n = Number(value) || 0;
        return n <= 0 ? '#ff6554' : n < 38 ? '#f08a66' : n < 72 ? '#e2bc70' : '#a8d8ac';
    }
    function drawSystemScreen(screen, systems) {
        const values = ['structure','mobility','power','command','combat'].map(slot => Number(systems?.[slot] ?? 0));
        const tone = Math.min(...values) < 38 ? 'red' : Math.min(...values) < 72 ? 'amber' : 'green';
        const ctx = panelBase(screen, tone, .68); if (!ctx) return;
        const w = screen.canvas.width, h = screen.canvas.height;
        const slots = ['structure','mobility','power','command','combat'];
        const row = h / slots.length;
        slots.forEach((slot, index) => {
            const value = Math.max(0, Math.min(100, Math.round(Number(systems?.[slot] ?? 0))));
            const y = row * index;
            if (index) { ctx.strokeStyle = 'rgba(120,154,126,.20)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(7,y); ctx.lineTo(w-7,y); ctx.stroke(); }
            ctx.fillStyle = conditionColor(value);
            ctx.font = 'bold 25px monospace'; ctx.textBaseline = 'middle';
            ctx.fillText(systemGlyphs[slot], 10, y + row * .48);
            ctx.font = 'bold 16px monospace';
            ctx.textAlign = 'right'; ctx.fillText(String(value).padStart(3,' '), w - 9, y + row * .48); ctx.textAlign = 'left';
            ctx.fillStyle = 'rgba(150,196,158,.20)'; ctx.fillRect(9, y + row - 7, w - 18, 3);
            ctx.fillStyle = conditionColor(value); ctx.fillRect(9, y + row - 7, (w - 18) * value / 100, 3);
        });
        screen.texture.needsUpdate = true;
    }
    function drawTeamScreen(screen, team = {}) {
        const friendly = Math.max(0, Math.min(3, Number(team.friendly) || 0));
        const hostile = Math.max(0, Math.min(3, Number(team.hostile) || 0));
        const ctx = panelBase(screen, friendly <= 1 ? 'amber' : 'green', .54); if (!ctx) return;
        const drawPip = (x, y, alive, color) => {
            ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4);
            ctx.fillStyle = alive ? color : 'rgba(90,101,91,.16)'; ctx.strokeStyle = alive ? color : 'rgba(120,125,116,.38)';
            ctx.lineWidth = 3; ctx.fillRect(-8,-8,16,16); ctx.strokeRect(-8,-8,16,16);
            if (!alive) { ctx.beginPath(); ctx.moveTo(-7,-7); ctx.lineTo(7,7); ctx.stroke(); }
            ctx.restore();
        };
        for (let i = 0; i < 3; i++) drawPip(29 + i * 28, 22, i < friendly, '#79d89a');
        for (let i = 0; i < 3; i++) drawPip(screen.canvas.width - 29 - (2-i) * 28, 22, i < hostile, '#e2a158');
        ctx.strokeStyle = 'rgba(187,187,151,.22)'; ctx.beginPath(); ctx.moveTo(screen.canvas.width/2,8); ctx.lineTo(screen.canvas.width/2,34); ctx.stroke();
        screen.texture.needsUpdate = true;
    }
    function weaponAbbrev(label) {
        const text = String(label ?? '').toUpperCase();
        if (text.includes('TRAINING')) return 'TRN-CAN';
        if (text.includes('STUMP')) return 'STP-CAN';
        if (text.includes('NEEDLE')) return 'NDL-CAN';
        return text.replace(/[^A-Z0-9]/g,'').slice(0,7) || 'NO-GUN';
    }
    function drawWeaponScreen(screen, data) {
        const state = String(data.weaponState ?? 'READY');
        const tone = state === 'LOST' ? 'red' : state === 'DAMAGED' || state === 'FAULT' ? 'amber' : 'green';
        const ctx = panelBase(screen, tone, .66); if (!ctx) return;
        ctx.fillStyle = tone === 'red' ? '#f08a70' : tone === 'amber' ? '#e4bd70' : '#a6d7ad';
        ctx.font = 'bold 14px monospace'; ctx.textBaseline = 'middle'; ctx.fillText(weaponAbbrev(data.weapon), 9, 16);
        ctx.font = 'bold 29px monospace'; ctx.fillText(String(data.ammo ?? '—'), 9, 43);
        ctx.font = 'bold 10px monospace'; ctx.fillStyle = tone === 'green' ? '#789c80' : ctx.fillStyle; ctx.fillText(state, 10, 66);
        screen.texture.needsUpdate = true;
    }
    function drawMotionScreen(screen, data) {
        const ctx = panelBase(screen, 'green', .54); if (!ctx) return;
        ctx.fillStyle = '#a8d5ad'; ctx.textBaseline = 'middle';
        ctx.font = 'bold 18px monospace'; ctx.fillText(`${data.speed ?? '0.0'} m/s`, 9, 18);
        ctx.font = 'bold 12px monospace'; ctx.fillStyle = '#d5b66d'; ctx.fillText(String(data.direction ?? 'IDLE'), 132, 18);
        ctx.fillStyle = '#83a68a'; ctx.fillText(`TURN ${data.turnRate ?? 0}°/s`, 9, 43);
        screen.texture.needsUpdate = true;
    }
    function drawDriveScreen(screen, load = 0) {
        const value = Math.max(0, Math.min(1, Number(load) || 0));
        const ctx = panelBase(screen, value > .9 ? 'amber' : 'green', .48); if (!ctx) return;
        const w = screen.canvas.width;
        ctx.fillStyle = '#789a7e'; ctx.font = 'bold 10px monospace'; ctx.textBaseline = 'middle'; ctx.fillText('DRIVE', 9, 12);
        ctx.fillStyle = 'rgba(132,163,136,.18)'; ctx.fillRect(9, 23, w - 18, 10);
        ctx.fillStyle = value > .9 ? '#e2ae59' : '#89c492'; ctx.fillRect(9, 23, (w - 18) * value, 10);
        ctx.fillStyle = '#a9c7ac'; ctx.textAlign = 'right'; ctx.fillText(`${Math.round(value * 100)}%`, w - 9, 12); ctx.textAlign = 'left';
        screen.texture.needsUpdate = true;
    }
    function updateCockpitInstruments(data = {}) {
        const key = JSON.stringify(data);
        if (key === cockpitInstrumentKey) return;
        cockpitInstrumentKey = key;
        const s = data.systems ?? {};
        drawSystemScreen(cockpit.userData.instrumentScreens.systems, s);
        drawWeaponScreen(cockpit.userData.instrumentScreens.weapon, data);
        drawTeamScreen(cockpit.userData.instrumentScreens.team, data.team);
        const values = Object.values(s).map(value => Number(value) || 0);
        const lowest = values.length ? Math.min(...values) : 100;
        cockpitWarningLevel = Math.max(0, Math.min(2, Number(data.warning) || 0));
        persistentPowerHealth = Math.max(0, Math.min(1, Number(s.power ?? 100) / 100));
        persistentCommandHealth = Math.max(0, Math.min(1, Number(s.command ?? 100) / 100));
        driveLeftHealth = Math.max(0, Math.min(1, Number(data.drive?.left ?? 1)));
        driveRightHealth = Math.max(0, Math.min(1, Number(data.drive?.right ?? 1)));
        if (lowest >= 72) cockpitWarningLevel = Math.min(cockpitWarningLevel, 0);
        redrawCracks(Number(s.command ?? 100));
    }
    function updateCockpitMotion(data = {}) {
        const normalized = {
            speed: Number(data.speed ?? 0).toFixed(1),
            direction: String(data.direction ?? 'IDLE'),
            turnRate: Math.round(Number(data.turnRate) || 0),
            driveLoad: Math.round(Math.max(0, Math.min(1, Number(data.driveLoad) || 0)) * 100) / 100,
        };
        const key = JSON.stringify(normalized);
        if (key === cockpitMotionKey) return;
        cockpitMotionKey = key;
        drawMotionScreen(cockpit.userData.instrumentScreens.motion, normalized);
        drawDriveScreen(cockpit.userData.instrumentScreens.drive, normalized.driveLoad);
    }
    function spawnCockpitPowerArc(strength = 1) {
        cockpit.updateWorldMatrix(true, true);
        const anchors = [
            [-.58,1.88,-.93],[.55,2.10,-.82],[-.72,2.46,-.64],[.67,2.56,-.62],[.18,1.78,-1.04]
        ];
        const a = anchors[Math.floor(Math.random() * anchors.length)];
        let b = anchors[Math.floor(Math.random() * anchors.length)];
        if (b === a) b = anchors[(anchors.indexOf(a) + 1) % anchors.length];
        const start = cockpit.localToWorld(new THREE.Vector3(...a));
        const end = cockpit.localToWorld(new THREE.Vector3(...b));
        const points = [start.clone()];
        const segments = 6;
        for (let i = 1; i < segments; i++) {
            const t = i / segments;
            const p = start.clone().lerp(end, t);
            p.x += (Math.random() - .5) * .12 * strength;
            p.y += (Math.random() - .5) * .10 * strength;
            p.z += (Math.random() - .5) * .08 * strength;
            points.push(p);
        }
        points.push(end.clone());
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({ color: Math.random() > .35 ? 0xc8fff2 : 0xffe58d, transparent: true, opacity: 1, depthTest: false });
        const line = new THREE.Line(geometry, material); line.renderOrder = 30; scene.add(line);
        transientFX.push({ object: line, remaining: .09 + Math.random() * .09, duration: .18, material });
        for (let i = 1; i < points.length - 1; i += 2)
            activateParticle(sparkPool, 'spark', points[i], new THREE.Vector3((Math.random()-.5)*1.5, -.2-Math.random()*1.8, (Math.random()-.5)*1.2), 1.4 * strength, .28 + Math.random()*.24, -3.2, 0, 0xe6fff1);
    }
    function triggerCockpitHit(slot, profile = {}) {
        const severity = Math.max(0, Math.min(1, Number(profile.severity) || 0));
        hitPitchKick += Number(profile.pitch) || 0;
        hitRollKick += Number(profile.roll) || 0;
        hitYawKick += Number(profile.yaw) || 0;
        hitShakeKick = Math.max(hitShakeKick, Number(profile.shake) || 0);
        gunDamageKick = Math.max(gunDamageKick, Number(profile.gunShake) || 0);
        powerBlackout = Math.max(powerBlackout, Number(profile.blackoutSeconds) || 0);
        powerFlicker = Math.max(powerFlicker, Number(profile.flickerSeconds) || 0);
        cockpit.updateWorldMatrix(true, true);
        const localBySlot = {
            structure: [0, 2.05, -.82], mobility: [-.62, 1.58, -.82], power: [-.32, 1.83, -1.02],
            command: [0, 2.72, -.61], combat: [.86, 2.08, -.72],
        };
        const origin = cockpit.localToWorld(new THREE.Vector3(...(localBySlot[slot] ?? [0,2,-.8])));
        const count = Math.max(1, Math.min(18, Math.round(profile.sparkCount ?? 1)));
        const sparkScale = Math.max(.6, Number(profile.sparkScale) || 1);
        for (let i = 0; i < count; i++) {
            const downward = i % 3 === 0;
            const velocity = new THREE.Vector3((Math.random() - .5) * 4.0, downward ? -.4 - Math.random() * 2.0 : .5 + Math.random() * 3.4, (Math.random() - .5) * 3.0);
            activateParticle(sparkPool, 'spark', origin, velocity, sparkScale * (.75 + severity * .95), .24 + Math.random() * .42, -4.7, 0, i % 4 ? 0xffc866 : 0xfff4c2);
        }
        const arcs = Math.max(0, Math.min(5, Math.round(profile.arcCount ?? 0)));
        for (let i = 0; i < arcs; i++) spawnCockpitPowerArc(.85 + severity * .7);
    }
    function resetCockpitTransientFeedback() {
        hitPitchKick = hitRollKick = hitYawKick = hitShakeKick = gunDamageKick = 0;
        powerBlackout = powerFlicker = 0;
        powerArcCooldown = 1.8;
        combinerHud.position.set(0, 0, 0);
        blackoutMaterial.opacity = 0;
    }
    function activateParticle(pool, cursorName, position, velocity, scale, duration, gravity = 0, grow = 0, color = null, smoke = false) {
        let cursor = cursorName === 'spark' ? sparkCursor : cursorName === 'chip' ? chipCursor : smokeCursor;
        const state = pool[cursor % pool.length];
        if (cursorName === 'spark')
            sparkCursor = (cursor + 1) % pool.length;
        else if (cursorName === 'chip')
            chipCursor = (cursor + 1) % pool.length;
        else
            smokeCursor = (cursor + 1) % pool.length;
        state.mesh.position.copy(position);
        state.velocity.copy(velocity);
        state.life = state.duration = duration;
        state.gravity = gravity;
        state.grow = grow;
        state.baseScale = scale;
        state.smoke = smoke;
        state.mesh.scale.setScalar(scale);
        state.mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        if (color !== null)
            state.mesh.material.color.setHex(color);
        state.mesh.material.opacity = smoke ? .48 : 1;
        state.mesh.visible = true;
    }
    function randomBurstDirection(normal, spread = .9) {
        const random = new THREE.Vector3(Math.random() - .5, Math.random() * .8, Math.random() - .5).normalize();
        return normal.clone().multiplyScalar(1.1).addScaledVector(random, spread).normalize();
    }
    function spawnImpactParticles(position, normal, outcome) {
        const profile = impactProfile(outcome);
        if (outcome?.internalDamage > 0)
            flashDamageLight(position, outcome.slot === 'power' ? 0xc8fff2 : 0xffb56b, outcome.slot === 'power' ? 10 : 5.5, .075, 4.6);
        activateParticle(sparkPool, 'spark', position, normal.clone().multiplyScalar(.18), profile.flashScale * 1.25, .085, 0, 0, profile.kind === 'power-disable' ? 0xffe199 : 0xffcf70);
        for (let i = 0; i < profile.sparkCount; i++) {
            const direction = randomBurstDirection(normal, 1.15);
            const speed = 1.8 + Math.random() * 3.4;
            activateParticle(sparkPool, 'spark', position, direction.multiplyScalar(speed), .7 + Math.random() * .7, .18 + Math.random() * .22, -4.2, 0, Math.random() > .2 ? 0xffc35f : 0xfff0a2);
        }
        for (let i = 0; i < profile.chipCount; i++) {
            const direction = randomBurstDirection(normal, 1.35);
            const speed = .8 + Math.random() * 2.1;
            activateParticle(chipPool, 'chip', position, direction.multiplyScalar(speed), .7 + Math.random() * .8, .45 + Math.random() * .45, -7.2, 0, Math.random() > .35 ? 0x3c403b : 0x78684d);
        }
        for (let i = 0; i < profile.smokeCount; i++) {
            const drift = new THREE.Vector3((Math.random() - .5) * .25, .28 + Math.random() * .28, (Math.random() - .5) * .25);
            activateParticle(smokePool, 'smoke', position, drift, .72 + Math.random() * .5, .75 + Math.random() * .55, 0, .8, 0x242824, true);
        }
        return profile;
    }
    function recordDamageWound(actorId, slot, worldPoint) {
        const record = squadCombatants.get(actorId);
        const group = record?.exterior.partGroups.get(slot);
        if (!record || !group || !worldPoint) return;
        group.updateWorldMatrix(true, false);
        const local = group.worldToLocal(worldPoint.clone());
        const wounds = record.wounds.get(slot) ?? [];
        wounds.push(local.clone());
        if (wounds.length > 2) wounds.shift();
        record.wounds.set(slot, wounds);
        const mark = new THREE.Mesh(new THREE.IcosahedronGeometry(.065, 0), new THREE.MeshBasicMaterial({ color: 0x0d100e }));
        mark.position.copy(local); mark.scale.set(1.35, .32, 1.35); group.add(mark);
        record.woundMarks.push(mark);
        if (record.woundMarks.length > 10) {
            const oldest = record.woundMarks.shift(); oldest.parent?.remove(oldest); oldest.geometry.dispose(); oldest.material.dispose();
        }
    }
    function partWorldPoint(record, slot) {
        const group = record?.exterior.partGroups.get(slot);
        const wounds = record?.wounds?.get(slot) ?? [];
        const point = new THREE.Vector3();
        if (group && wounds.length && Math.random() < .82) {
            point.copy(wounds[Math.floor(Math.random() * wounds.length)]);
            group.localToWorld(point);
            point.x += (Math.random() - .5) * .10;
            point.y += (Math.random() - .5) * .08;
            point.z += (Math.random() - .5) * .10;
        } else {
            if (group) group.getWorldPosition(point); else record?.exterior.root.getWorldPosition(point);
            point.x += (Math.random() - .5) * .26;
            point.y += (Math.random() - .5) * .20;
            point.z += (Math.random() - .5) * .26;
        }
        return point;
    }
    function spawnDisableBurst(position, normal, outcome) {
        const flashMat = new THREE.MeshBasicMaterial({ color: outcome?.slot === 'power' ? 0xffd27a : 0xffa75b, transparent: true, opacity: .94, depthWrite: false });
        const flash = new THREE.Mesh(new THREE.IcosahedronGeometry(outcome?.slot === 'power' ? .36 : .27, 0), flashMat);
        flashDamageLight(position, outcome?.slot === 'power' ? 0xd9fff1 : 0xffa75b, outcome?.slot === 'power' ? 13 : 8, .12, 6);
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
    function spawnWorldPowerArc(origin, strength = 1) {
        const end = origin.clone().add(new THREE.Vector3((Math.random()-.5)*1.5, .35+Math.random()*1.25, (Math.random()-.5)*1.5));
        const points = [origin.clone()];
        for (let i = 1; i < 7; i++) {
            const p = origin.clone().lerp(end, i / 7);
            p.x += (Math.random()-.5) * .22 * strength;
            p.y += (Math.random()-.5) * .18 * strength;
            p.z += (Math.random()-.5) * .22 * strength;
            points.push(p);
        }
        points.push(end);
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({ color: Math.random() > .3 ? 0xc8fff2 : 0xffe58d, transparent: true, opacity: 1 });
        const line = new THREE.Line(geometry, material); scene.add(line);
        if (Math.random() < .45) flashDamageLight(origin, 0xc8fff2, 7 * strength, .08, 5.5);
        transientFX.push({ object: line, remaining: .12 + Math.random()*.12, duration: .24, material });
    }
    function spawnCatastrophicBurst(position, normal, outcome) {
        const power = outcome?.slot === 'power';
        const flashMat = new THREE.MeshBasicMaterial({ color: power ? 0xf4ffd9 : 0xffbd70, transparent: true, opacity: 1, depthWrite: false });
        const flash = new THREE.Mesh(new THREE.IcosahedronGeometry(power ? .58 : .46, 0), flashMat);
        flashDamageLight(position, power ? 0xc8fff2 : 0xffbd70, power ? 22 : 14, .18, power ? 8 : 6.5);
        flash.position.copy(position); scene.add(flash);
        transientFX.push({ object: flash, remaining: .22, duration: .22, material: flashMat });
        for (let i = 0; i < (power ? 28 : 22); i++) {
            const direction = randomBurstDirection(normal, 2.0);
            activateParticle(sparkPool, 'spark', position, direction.multiplyScalar(2.2 + Math.random()*5.0), 1.2 + Math.random()*1.5, .28 + Math.random()*.48, -4.5, 0, i % 4 ? 0xffcf70 : 0xfff6c9);
        }
        for (let i = 0; i < (outcome?.slot === 'mobility' ? 18 : 14); i++) {
            const direction = randomBurstDirection(normal, 2.1);
            activateParticle(chipPool, 'chip', position, direction.multiplyScalar(1.4 + Math.random()*3.8), 1.8 + Math.random()*2.3, .75 + Math.random()*.95, -8.2, 0, i % 3 ? 0x30332f : 0x9b7542);
        }
        for (let i = 0; i < (power ? 9 : 6); i++) {
            const drift = new THREE.Vector3((Math.random()-.5)*.42, .35+Math.random()*.52, (Math.random()-.5)*.42);
            activateParticle(smokePool, 'smoke', position, drift, 1.15+Math.random()*.75, 1.5+Math.random()*1.2, 0, 1.45, 0x171a17, true);
        }
        if (power) for (let i = 0; i < 3; i++) spawnWorldPowerArc(position, .9 + Math.random()*.6);
    }
    function settleAttachedPartToFloor(group, clearance = .025) {
        group.updateWorldMatrix(true, true);
        const bounds = new THREE.Box3().setFromObject(group);
        if (Number.isFinite(bounds.min.y) && bounds.min.y > clearance)
            group.position.y -= bounds.min.y - clearance;
    }
    function markPartDestroyedVisual(actorId, slot) {
        const record = squadCombatants.get(actorId);
        if (!record || record.destroyedSlots.has(slot)) return;
        record.destroyedSlots.add(slot);
        const group = record.exterior.partGroups.get(slot);
        if (!group) return;
        const side = actorId.length % 2 ? 1 : -1;
        if (slot === 'combat' || slot === 'power') {
            group.updateWorldMatrix(true, true);
            arenaPresentationRoot.attach(group);
            group.rotation.x += slot === 'combat' ? .46 : .31;
            group.rotation.z += side * (slot === 'combat' ? .78 : .58);
            fallingParts.set(`${actorId}:${slot}`, {
                actorId, slot, record, group, settled: false,
                velocity: new THREE.Vector3(side * (.28 + Math.random() * .30), .35 + Math.random() * .48, (Math.random() - .5) * .65),
                spin: new THREE.Vector3((Math.random() - .5) * 1.4, (Math.random() - .5) * .65, side * (.8 + Math.random() * 1.1)),
            });
        } else if (slot === 'mobility') {
            group.rotation.z += side * .42; group.rotation.x += .19;
            settleAttachedPartToFloor(group, .02);
        } else if (slot === 'command') {
            group.position.y -= .18; group.rotation.z += side * .27; group.rotation.x += .14;
        } else if (slot === 'structure') {
            record.exterior.root.rotation.z += side * .13;
            record.exterior.root.position.y -= .09;
        }
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
        record.recoilKick = 0;
        if (record.articulation) {
            record.articulation.phase = 0;
            for (const joint of record.articulation.joints) joint.object.rotation.copy(joint.base);
        }
        record.disabledSlots.clear();
        record.destroyedSlots.clear();
        record.exterior.root.position.y = 0;
        record.exterior.root.rotation.x = 0;
        record.exterior.root.rotation.z = 0;
        for (const slot of SLOTS) {
            fallingParts.delete(`${record.id}:${slot}`);
            const group = record.exterior.partGroups.get(slot);
            const base = record.baseParts.get(slot);
            if (!group || !base) continue;
            if (base.parent && group.parent !== base.parent) base.parent.add(group);
            group.position.copy(base.position);
            group.rotation.copy(base.rotation);
            group.scale.copy(base.scale);
            record.wounds.set(slot, []);
        }
        while (record.woundMarks.length) {
            const mark = record.woundMarks.pop(); mark.parent?.remove(mark); mark.geometry.dispose(); mark.material.dispose();
        }
    }
    function clearPooledParticles() {
        for (const state of particleStates) {
            state.life = 0;
            state.mesh.visible = false;
        }
        for (const record of squadCombatants.values()) {
            for (const budget of record.emitterBudget.values()) {
                budget.spark = 0;
                budget.smoke = 0;
                budget.arc = 0;
            }
        }
    }
    // Ring, not another obstacle or an invisible hit volume.
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.75, 1.84, 32), new THREE.MeshBasicMaterial({ color: 0xcf9750, side: THREE.DoubleSide, transparent: true, opacity: .52 }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(HOSTILE_SPAWN.x, .035, HOSTILE_SPAWN.z);
    arenaPresentationRoot.add(ring);
    const pilotRing = new THREE.Mesh(new THREE.RingGeometry(1.75, 1.84, 32), new THREE.MeshBasicMaterial({ color: C.green, side: THREE.DoubleSide, transparent: true, opacity: .26 }));
    pilotRing.rotation.x = -Math.PI / 2;
    pilotRing.position.set(PLAYER_SPAWN.x, .034, PLAYER_SPAWN.z);
    arenaPresentationRoot.add(pilotRing);
    const objectiveMaterial = new THREE.MeshBasicMaterial({ color: 0xd7a24b, side: THREE.DoubleSide, transparent: true, opacity: .58, depthWrite: false });
    const objectiveRing = new THREE.Mesh(new THREE.RingGeometry(.90, 1, 48), objectiveMaterial);
    objectiveRing.rotation.x = -Math.PI / 2;
    objectiveRing.position.y = .045;
    objectiveRing.visible = false;
    arenaPresentationRoot.add(objectiveRing);
    function updateObjectivePresentation(presentation) {
        objectiveRing.visible = !!presentation?.visible;
        if (!presentation?.visible) return;
        objectiveRing.position.set(presentation.point?.x ?? 0, .045, presentation.point?.z ?? 0);
        const radius = Math.max(1, Number(presentation.radius) || 5);
        objectiveRing.scale.set(radius, radius, radius);
        objectiveMaterial.color.setHex(presentation.contested ? 0xe16d4e : 0xd7a24b);
        objectiveMaterial.opacity = presentation.contested ? .82 : .58;
    }
    let muzzleKick = 0;
    let muzzleFlash = 0;
    let pilotWeaponPresentation = { visualRecoil: 1, visualRecovery: 3.6, muzzleFlashSeconds: .10 };
    let exterior = buildExteriorRig(initial);
    for (const mesh of exterior.pickMeshes)
        mesh.userData.actorId = 'player';
    scene.add(exterior.root);
    exterior.root.visible = false;
    const captureColors = (meshes) => {
        const colors = new WeakMap();
        for (const mesh of meshes) {
            const material = mesh.material;
            if (material instanceof THREE.MeshStandardMaterial)
                colors.set(mesh, material.color.clone());
        }
        return colors;
    };
    let pilotColors = captureColors(exterior.pickMeshes);
    const raycaster = new THREE.Raycaster();
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
    let selected = null;
    let inspecting = false;
    let azimuth = 0.68;
    let elevation = 0.25;
    let radius = 7.20;
    const orbitTarget = new THREE.Vector3(0, 1.85, 0);
    const desiredTarget = orbitTarget.clone();
    let panelRightPx = 0;
    let viewportWidth = 1;
    let viewportHeight = 1;
    let visualYaw = 0;
    let visualX = 0;
    let visualZ = 8;
    let cockpitHeave = 0;
    let cockpitRoll = 0;
    let cockpitPitch = 0;
    const gunPivot = cockpit.userData.gunPivot;
    const flashMesh = cockpit.userData.flashMesh;
    function updateRigVisual(state, lookYaw, lookPitch, dt) {
        const smoothing = 1 - Math.exp(-16 * dt);
        visualX += (state.x - visualX) * smoothing;
        visualZ += (state.z - visualZ) * smoothing;
        const yawDelta = Math.atan2(Math.sin(state.yaw - visualYaw), Math.cos(state.yaw - visualYaw));
        visualYaw += yawDelta * smoothing;
        const targetPitch = THREE.MathUtils.clamp(-state.longitudinalAcceleration * 0.012, -0.035, 0.035);
        const targetRoll = THREE.MathUtils.clamp(-state.yawRate * Math.abs(state.forwardSpeed) * 0.008, -0.035, 0.035);
        const footfall = Math.sin(performance.now() * 0.009 + state.forwardSpeed) * Math.min(Math.abs(state.forwardSpeed) / 7.4, 1) * 0.012;
        const impactKick = state.impact * 0.045;
        cockpitPitch += (targetPitch - cockpitPitch) * (1 - Math.exp(-8 * dt));
        cockpitRoll += (targetRoll - cockpitRoll) * (1 - Math.exp(-9 * dt));
        cockpitHeave += ((footfall - impactKick) - cockpitHeave) * (1 - Math.exp(-12 * dt));
        const renderYaw = physicsYawToViewYaw(visualYaw);
        const nowMs = performance.now();
        const damageWave = Math.sin(nowMs * .043);
        const impactJitter = hitShakeKick * Math.sin(nowMs * .117);
        const driveDamage = 1 - Math.min(driveLeftHealth, driveRightHealth);
        const sustainedDriveRoll = (driveRightHealth - driveLeftHealth) * .032 +
            Math.sin(nowMs * .017) * driveDamage * Math.min(Math.abs(state.forwardSpeed) / 2.2, 1) * .008;
        const mobilityStumble = Math.sin(nowMs * .026) * driveDamage * Math.min(Math.abs(state.forwardSpeed) / 2.8, 1) * .008;
        // The camera is the pilot's head; the combiner belongs to the mech. Inverse
        // free-look keeps the display on the windshield until chassis body-follow catches up.
        const tether = combinerTetherFromLook(lookYaw, lookPitch);
        combinerHud.rotation.set(
            tether.pitch + cockpitPitch * .65 - hitPitchKick * .35,
            tether.yaw - hitYawKick * .10,
            cockpitRoll * .75 - hitRollKick * .25 + sustainedDriveRoll * .28,
            'YXZ');
        gunPivot.rotation.set(lookPitch * .85 + muzzleKick * .042, lookYaw * .85, gunDamageKick * damageWave * .16, 'YXZ');
        gunPivot.position.x = 1.16 + gunDamageKick * damageWave * .045;
        gunPivot.position.z = -0.62 + muzzleKick * .19;
        flashMesh.visible = muzzleFlash > 0;
        cockpit.position.set(visualX + impactJitter * .35, impactJitter * .18 + mobilityStumble, visualZ + impactJitter * .12);
        cockpit.rotation.set(cockpitPitch + hitPitchKick, renderYaw + hitYawKick, cockpitRoll + hitRollKick + sustainedDriveRoll, 'YXZ');
        exterior.root.position.set(visualX, 0, visualZ);
        exterior.root.rotation.y = renderYaw;
        if (inspecting) {
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
            const shift = framingOffsetWorld(panelRightPx, viewportWidth, viewportHeight, radius, camera.fov) * .78;
            camera.lookAt(center.addScaledVector(right, shift));
        }
        else {
            camera.position.set(visualX + impactJitter * .62, 2.42 + cockpitHeave - Math.abs(hitPitchKick) * .2 + impactJitter * .28, visualZ + impactJitter * .18);
            camera.rotation.set(lookPitch + cockpitPitch * 0.35 + hitPitchKick * 1.35, renderYaw + lookYaw + hitYawKick * 1.1, cockpitRoll * 0.25 + hitRollKick * 1.25 + sustainedDriveRoll * .72, 'YXZ');
        }
        updateSquadMarkers();
    }
    function updateCombatantRig(id, state, visual = null) {
        const record = squadCombatants.get(id);
        if (!record) return;
        record.exterior.root.position.set(state.x, record.cleared ? -.14 : record.wrecked ? -.06 : 0, state.z);
        record.exterior.root.rotation.y = physicsYawToViewYaw(state.yaw);
        if (record.active && !record.wrecked && !record.cleared) {
            const dt = Math.max(0, visual?.dt ?? 1 / 60);
            const health = THREE.MathUtils.clamp(visual?.posture?.animationHealth ?? 1, .08, 1);
            const speed = Math.hypot(state.vx ?? 0, state.vz ?? 0);
            const movement = Math.min(1, speed / 2.8);
            const articulation = record.articulation;
            if (articulation) {
                articulation.phase += dt * (1.5 + speed * 1.45) * (.52 + health * .48);
                const amplitude = movement * (.075 + health * .11);
                for (const joint of articulation.joints) {
                    const sidePhase = joint.side > 0 ? Math.PI : 0;
                    const wave = Math.sin(articulation.phase + sidePhase);
                    const magnitude = joint.joint === 'hip' ? .42 : joint.joint === 'knee' ? -.62 : joint.joint === 'ankle' ? .32 : -.16;
                    joint.object.rotation.x = joint.base.x + wave * amplitude * magnitude;
                    joint.object.rotation.z = joint.base.z + (1 - health) * joint.side * Math.sin(articulation.phase * .53) * .035;
                }
            }
            const target = visual?.target;
            if (target) {
                const desired = Math.atan2(target.x - state.x, -(target.z - state.z));
                const error = Math.atan2(Math.sin(desired - state.yaw), Math.cos(desired - state.yaw));
                const command = record.exterior.partGroups.get('command');
                const combat = record.exterior.partGroups.get('combat');
                const commandBase = record.baseParts.get('command');
                const combatBase = record.baseParts.get('combat');
                const smoothing = 1 - Math.exp(-dt * (5.2 * (.45 + health * .55)));
                if (command && commandBase) command.rotation.y = THREE.MathUtils.lerp(command.rotation.y, commandBase.rotation.y - THREE.MathUtils.clamp(error, -.48, .48) * .42, smoothing);
                if (combat && combatBase) {
                    combat.rotation.y = THREE.MathUtils.lerp(combat.rotation.y, combatBase.rotation.y - THREE.MathUtils.clamp(error, -.72, .72) * .72, smoothing);
                    combat.position.z = combatBase.position.z + (record.recoilKick ?? 0);
                }
            }
            const damage = 1 - health;
            record.exterior.root.position.y += Math.sin((record.articulation?.phase ?? 0) * .5) * damage * movement * .035;
            record.exterior.root.rotation.x = THREE.MathUtils.clamp(-(state.longitudinalAcceleration ?? 0) * .007 + Math.sin((record.articulation?.phase ?? 0) * .47) * damage * .018, -.065, .065);
            record.exterior.root.rotation.z = THREE.MathUtils.clamp(-(state.lateralSpeed ?? 0) * .012 - (state.yawRate ?? 0) * speed * .008 + Math.sin((record.articulation?.phase ?? 0) * .61) * damage * .022, -.075, .075);
        }
        record.exterior.root.updateWorldMatrix(true, true);
    }
    function updateTargetRigVisual(state) {
        // Backwards-compatible wrapper for the selected contract leader.
        updateCombatantRig('enemy-0', state);
    }
    function setInspection(enabled) {
        inspecting = enabled;
        exterior.root.visible = enabled;
        cockpit.visible = !enabled;
        combinerHud.visible = !enabled;
        blackout.visible = !enabled;
        arenaRoot.visible = !enabled;
        arenaPresentationRoot.visible = !enabled;
        garageRoot.visible = enabled;
        arenaHemisphere.visible = !enabled;
        sun.visible = !enabled;
        coolRim.visible = !enabled;
        debugColliders.visible = false;
        scene.background.setHex(enabled ? 0x0d1210 : 0x171915);
        scene.fog.color.setHex(enabled ? 0x0d1210 : 0x171915);
        scene.fog.density = enabled ? 0.0075 : 0.0125;
        if (enabled) {
            exterior.root.position.set(0, 0, 0);
            exterior.root.rotation.y = GARAGE_RIG_YAW;
        }
        for (const record of squadCombatants.values()) {
            record.exterior.root.visible = !enabled;
            record.marker.visible = !enabled;
        }
    }
    function rebuildAssembly(assembly) {
        const oldRoot = exterior.root;
        exterior = buildExteriorRig(assembly);
        for (const mesh of exterior.pickMeshes)
            mesh.userData.actorId = 'player';
        pilotColors = captureColors(exterior.pickMeshes);
        exterior.root.position.copy(oldRoot.position);
        exterior.root.rotation.copy(oldRoot.rotation);
        exterior.root.visible = inspecting;
        scene.add(exterior.root);
        scene.remove(oldRoot);
        oldRoot.traverse(object => {
            if (object instanceof THREE.Mesh) {
                object.geometry.dispose();
                const materials = Array.isArray(object.material) ? object.material : [object.material];
                for (const material of materials)
                    material.dispose();
            }
        });
        selectPart(selected && installedPart(assembly, selected) ? selected : null);
        const command = installedPart(assembly, 'command')?.definition.id;
        cockpit.userData.armoredCab.visible = command === 'cab-armored';
        cockpit.userData.utilityCab.visible = command === 'cab-utility';
    }
    function selectPart(slot) {
        selected = slot;
        for (const [groupSlot, meshes] of exterior.partMeshes) {
            for (const mesh of meshes) {
                const material = mesh.material;
                if (!(material instanceof THREE.MeshStandardMaterial))
                    continue;
                material.emissive.setHex(groupSlot === slot ? 0xb78b35 : 0);
                material.emissiveIntensity = groupSlot === slot ? 0.30 : 0;
            }
        }
    }
    function focusPart(slot) {
        const machineCenter = new THREE.Vector3(0, 1.85, 0);
        if (!slot || !exterior.partGroups.has(slot)) {
            desiredTarget.copy(machineCenter);
            return;
        }
        // Bias toward the selected module rather than turning it into the entire shot.
        // The machine remains legible as an owned object while the selected part is favored.
        const partCenter = new THREE.Vector3(...SLOT_CENTERS[slot]);
        desiredTarget.copy(machineCenter).lerp(partCenter, .40);
        radius = Math.max(radius, 6.85);
    }
    function orbitBy(dx, dy) {
        azimuth = orbitAzimuthAfterDrag(azimuth, dx);
        elevation = THREE.MathUtils.clamp(elevation + dy * 0.006, -0.18, 1.05);
    }
    function panBy(dx, dy, screenHeight) {
        const delta = panInRigSpace(dx, dy, radius, azimuth, elevation, screenHeight, camera.fov);
        desiredTarget.x = THREE.MathUtils.clamp(desiredTarget.x + delta.x, -3, 3);
        desiredTarget.y = THREE.MathUtils.clamp(desiredTarget.y + delta.y, 0.45, 3.8);
        desiredTarget.z = THREE.MathUtils.clamp(desiredTarget.z + delta.z, -3, 3);
    }
    function setInspectorLayout(panelRight, width, height) {
        panelRightPx = panelRight;
        viewportWidth = width;
        viewportHeight = height;
    }
    function zoomBy(scale) {
        if (Number.isFinite(scale) && scale > 0)
            radius = THREE.MathUtils.clamp(radius / scale, 4.0, 11.2);
    }
    function resetOrbit() {
        azimuth = 0.68;
        elevation = 0.25;
        radius = 7.20;
        focusPart(null);
    }
    function pickPart(clientX, clientY, canvas) {
        if (!inspecting)
            return null;
        const rect = canvas.getBoundingClientRect();
        const pointer = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
        exterior.root.updateWorldMatrix(true, true);
        camera.updateMatrixWorld();
        raycaster.setFromCamera(pointer, camera);
        const first = raycaster.intersectObjects(exterior.pickMeshes, false)[0];
        return first?.object.userData.slot ?? null;
    }
    function setPilotWeapon(spec) {
        const barrel = cockpit.userData.gunBarrel;
        const breech = cockpit.userData.gunBreech;
        gunPivot.visible = !!spec;
        pilotWeaponPresentation = spec ?? { visualRecoil: 1, visualRecovery: 3.6, muzzleFlashSeconds: .10 };
        if (!spec)
            return;
        const extension = Math.max(.48, Math.abs(spec.muzzleZ + .62));
        barrel.scale.y = Math.max(.3, (extension - .23) / 1.13);
        barrel.position.z = -(extension + .23) / 2;
        flashMesh.position.z = -extension;
        breech.scale.setScalar(spec.id === 'gun-short' ? 1.14 : spec.id === 'gun-light' ? .75 : 1);
    }
    function traceShot(spreadX, spreadY, muzzleZ) {
        camera.updateMatrixWorld();
        cockpit.updateMatrixWorld(true);
        targetExterior.root.updateWorldMatrix(true, true);
        // A sighting ray finds what the pilot sees; the second ray starts at the
        // gun's actual off-center muzzle and is allowed to be obstructed.
        const sightDir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
        const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
        sightDir.addScaledVector(right, spreadX).addScaledVector(up, spreadY).normalize();
        raycaster.set(camera.position, sightDir);
        raycaster.far = 100;
        const visible = raycaster.intersectObjects([...combatPickMeshes(), ...worldSolids], false)[0];
        const aimPoint = visible ? visible.point : camera.position.clone().addScaledVector(sightDir, 100);
        const muzzle = gunPivot.localToWorld(new THREE.Vector3(0, -.04, muzzleZ + .62));
        const bore = aimPoint.clone().sub(muzzle).normalize();
        raycaster.set(muzzle, bore);
        raycaster.far = 100;
        const actual = raycaster.intersectObjects([...combatPickMeshes(), ...worldSolids], false)[0];
        const cover = certifiedCoverHit(muzzle, bore, 100, actual);
        const point = cover ? cover.point : actual ? actual.point.clone() : muzzle.clone().addScaledVector(bore, 100);
        const surfaceNormal = cover ? cover.normal : actual?.face
            ? actual.face.normal.clone().transformDirection(actual.object.matrixWorld)
            : bore.clone().negate();
        const slot = cover ? null : actual?.object.userData.slot;
        const actorId = cover ? null : actual?.object.userData.actorId ?? null;
        const blockedBy = cover?.id ?? actual?.object.userData.arenaObstacleId ?? null;
        return { actorId: slot ? actorId : null, slot: slot ?? null, blockedBy, point, normal: surfaceNormal, muzzle, distance: muzzle.distanceTo(point) };
    }
    function traceCombatantShot(shooterId, targetId, aimSlot, spreadX, spreadY) {
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
        const blockers = [...combatPickMeshes(shooterId), ...exterior.pickMeshes, ...worldSolids];
        const actual = raycaster.intersectObjects(blockers, false)[0];
        const cover = certifiedCoverHit(muzzle, bore, 100, actual);
        const point = cover ? cover.point : actual ? actual.point.clone() : muzzle.clone().addScaledVector(bore, 100);
        const surfaceNormal = cover ? cover.normal : actual?.face
            ? actual.face.normal.clone().transformDirection(actual.object.matrixWorld)
            : bore.clone().negate();
        const slot = cover ? null : actual?.object.userData.slot;
        const actorId = cover ? null : actual?.object.userData.actorId ?? null;
        const blockedBy = cover?.id ?? actual?.object.userData.arenaObstacleId ?? null;
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
        };
    }
    function traceHostileShot(state, aimSlot, spreadX, spreadY) {
        return traceCombatantShot('enemy-0', 'player', aimSlot, spreadX, spreadY);
    }
    function showShot(contact, outcome) {
        muzzleKick = Math.min(1.6, muzzleKick + (pilotWeaponPresentation.visualRecoil ?? 1));
        muzzleFlash = pilotWeaponPresentation.muzzleFlashSeconds ?? .10;
        const hit = outcome !== null;
        const track = new THREE.BufferGeometry().setFromPoints([contact.muzzle, contact.point]);
        const trackMat = new THREE.LineBasicMaterial({ color: hit ? 0xf4c77e : 0xc7a76f, transparent: true, opacity: .92 });
        const tracer = new THREE.Line(track, trackMat);
        tracer.frustumCulled = false;
        scene.add(tracer);
        transientFX.push({ object: tracer, remaining: .14, duration: .14, material: trackMat });
        const impactPoint = contact.point.clone().addScaledVector(contact.normal, .045);
        const profile = spawnImpactParticles(impactPoint, contact.normal, outcome);
        if (outcome?.internalDamage > 0 && contact.actorId) recordDamageWound(contact.actorId, outcome.slot, impactPoint);
        if (outcome?.justDestroyed) {
            spawnCatastrophicBurst(impactPoint, contact.normal, outcome);
            markPartDestroyedVisual(contact.actorId, outcome.slot);
        } else if (outcome?.justDisabled || outcome?.wreckHit) {
            spawnDisableBurst(impactPoint, contact.normal, outcome);
            if (outcome.justDisabled) markPartDisabledVisual(contact.actorId, outcome.slot);
        }
        if (hit && contact.actorId === 'enemy-0') {
            // Keep persistent soot on the selected contract leader; auxiliary rigs
            // still receive damage tinting and particles without growing mark pools.
            // A dark local scar belongs to the struck machine. Breaches and disable events
            // leave larger marks, but we do not invent mesh fracture or generic explosions.
            const soot = new THREE.Mesh(new THREE.IcosahedronGeometry(.075 * profile.markScale, 0), new THREE.MeshBasicMaterial({ color: profile.kind === 'penetration' || profile.kind.includes('disable') ? 0x111512 : 0x252720, depthWrite: false }));
            targetExterior.root.updateWorldMatrix(true, false);
            soot.position.copy(targetExterior.root.worldToLocal(impactPoint));
            rangeMarks.add(soot);
            sootMarks.push(soot);
            if (sootMarks.length > 32) {
                const oldest = sootMarks.shift();
                rangeMarks.remove(oldest);
                oldest.geometry.dispose();
                oldest.material.dispose();
            }
        }
    }
    function showHostileShot(contact, outcome) {
        const hit = outcome !== null;
        const track = new THREE.BufferGeometry().setFromPoints([contact.muzzle, contact.point]);
        const trackMat = new THREE.LineBasicMaterial({ color: hit ? 0xff9e62 : 0xb97955, transparent: true, opacity: .88 });
        const tracer = new THREE.Line(track, trackMat);
        tracer.frustumCulled = false;
        scene.add(tracer);
        transientFX.push({ object: tracer, remaining: .17, duration: .17, material: trackMat });
        // A tiny muzzle flash identifies the hostile rig's firing point without adding a bespoke weapon renderer.
        activateParticle(sparkPool, 'spark', contact.muzzle, new THREE.Vector3(0, .08, 0), 1.15, .09, 0, 0, 0xffd79a);
        const impactPoint = contact.point.clone().addScaledVector(contact.normal, .045);
        spawnImpactParticles(impactPoint, contact.normal, outcome);
    }
    function updateCombatantDamage(id, condition) {
        const record = squadCombatants.get(id);
        if (!record || !condition?.parts) return;
        record.condition = condition;
        for (const [slot, meshes] of record.exterior.partMeshes) {
            const state = condition.parts[slot];
            if (!state) continue;
            const damage = 1 - state.integrity / state.maxIntegrity;
            const stripped = 1 - state.armor / state.maxArmor;
            for (const mesh of meshes) {
                const material = mesh.material;
                const color = record.colors.get(mesh);
                if (!(material instanceof THREE.MeshStandardMaterial) || !color) continue;
                if (state.destroyed) {
                    material.color.copy(color).multiplyScalar(.075);
                    material.emissive.setHex(0); material.emissiveIntensity = 0;
                    markPartDestroyedVisual(id, slot);
                } else {
                    material.color.copy(color).multiplyScalar(Math.max(.24, 1 - damage * .68 - stripped * .18));
                    const severe = state.integrity / Math.max(1, state.maxIntegrity) < .32;
                    material.emissive.setHex(state.integrity === 0 ? 0x4b1609 : severe ? 0x241008 : 0);
                    material.emissiveIntensity = state.integrity === 0 ? .58 : severe ? .16 : 0;
                }
            }
        }
    }
    function updateTargetDamage(condition) {
        updateCombatantDamage('enemy-0', condition);
    }
    function showCombatantShot(shooterId, contact, outcome) {
        const shooter = squadCombatants.get(shooterId);
        const friendly = shooter?.team === 'friendly';
        if (shooter) {
            const weaponId = installedPart(shooter.assembly, 'combat')?.definition.id;
            const profile = weaponId === 'gun-short' ? { kick: .24, recovery: 1.9 } : weaponId === 'gun-light' ? { kick: .085, recovery: 4.2 } : { kick: .15, recovery: 2.8 };
            shooter.recoilKick = Math.min(.42, (shooter.recoilKick ?? 0) + profile.kick);
            shooter.recoilRecovery = profile.recovery;
        }
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
            if (outcome.internalDamage > 0 && contact.actorId) recordDamageWound(contact.actorId, outcome.slot, impactPoint);
            if (outcome.justDestroyed) {
                spawnCatastrophicBurst(impactPoint, contact.normal, outcome);
                markPartDestroyedVisual(contact.actorId, outcome.slot);
            } else if (outcome.justDisabled || outcome.wreckHit) {
                spawnDisableBurst(impactPoint, contact.normal, outcome);
                if (outcome.justDisabled) markPartDisabledVisual(contact.actorId, outcome.slot);
            }
        }
    }
    function updatePilotDamage(condition) {
        for (const [slot, meshes] of exterior.partMeshes) {
            const state = condition.parts[slot];
            if (!state)
                continue;
            const damage = 1 - state.integrity / state.maxIntegrity;
            const stripped = 1 - state.armor / state.maxArmor;
            for (const mesh of meshes) {
                const material = mesh.material;
                const color = pilotColors.get(mesh);
                if (!(material instanceof THREE.MeshStandardMaterial) || !color)
                    continue;
                if (state.destroyed) {
                    material.color.copy(color).multiplyScalar(.075);
                    material.emissive.setHex(0); material.emissiveIntensity = 0;
                } else {
                    material.color.copy(color).multiplyScalar(1 - damage * .56 - stripped * .11);
                    material.emissive.setHex(state.integrity === 0 ? 0x30150b : 0);
                    material.emissiveIntensity = state.integrity === 0 ? .35 : 0;
                }
            }
        }
    }
    function resetTargetDamage(condition) {
        clearPooledParticles();
        while (sootMarks.length) {
            const mark = sootMarks.pop();
            rangeMarks.remove(mark);
            mark.geometry.dispose();
            mark.material.dispose();
        }
        updateTargetDamage(condition);
    }
    function updateCombatEffects(dt) {
        muzzleKick = Math.max(0, muzzleKick - dt * (pilotWeaponPresentation.visualRecovery ?? 3.6));
        muzzleFlash = Math.max(0, muzzleFlash - dt);
        for (const record of squadCombatants.values()) record.recoilKick = Math.max(0, (record.recoilKick ?? 0) - dt * (record.recoilRecovery ?? 3.2));
        const hitDecay = Math.exp(-8.5 * dt);
        hitPitchKick *= hitDecay; hitRollKick *= hitDecay; hitYawKick *= hitDecay; hitShakeKick *= Math.exp(-10.5 * dt); gunDamageKick *= Math.exp(-5.2 * dt);
        powerBlackout = Math.max(0, powerBlackout - dt);
        powerFlicker = Math.max(0, powerFlicker - dt);
        powerArcCooldown = Math.max(0, powerArcCooldown - dt);
        if (!inspecting && persistentPowerHealth < .52 && powerArcCooldown <= 0) {
            const severity = 1 - persistentPowerHealth;
            spawnCockpitPowerArc(.72 + severity * .75);
            powerFlicker = Math.max(powerFlicker, .08 + severity * .11);
            powerArcCooldown = 1.25 + Math.random() * (2.7 - severity);
        }
        const now = performance.now();
        const flickerWave = Math.abs(Math.sin(now * .105));
        const flicker = powerFlicker > 0 ? (flickerWave > .67 ? .68 : .16 + flickerWave * .16) : 0;
        blackoutMaterial.opacity = powerBlackout > 0 ? .995 : flicker;
        const screenOpacity = powerBlackout > 0 ? .01 : powerFlicker > 0 ? (flickerWave > .67 ? .12 : .74) : .92;
        for (const screen of Object.values(cockpit.userData.instrumentScreens)) screen.mesh.material.opacity = screenOpacity;
        const commandDamage = Math.max(0, .62 - persistentCommandHealth) / .62;
        combinerHud.position.x = Math.sin(now * .089) * commandDamage * .00085;
        combinerHud.position.y = Math.sin(now * .071 + 1.8) * commandDamage * .00055;
        for (const state of fallingParts.values()) {
            if (state.settled) continue;
            state.velocity.y -= 7.8 * dt;
            state.group.position.addScaledVector(state.velocity, dt);
            state.group.rotation.x += state.spin.x * dt;
            state.group.rotation.y += state.spin.y * dt;
            state.group.rotation.z += state.spin.z * dt;
            state.group.updateWorldMatrix(true, true);
            const bounds = new THREE.Box3().setFromObject(state.group);
            if (bounds.min.y <= .025 && state.velocity.y <= 0) {
                state.group.position.y += .025 - bounds.min.y;
                state.velocity.set(0, 0, 0); state.spin.multiplyScalar(.18); state.settled = true;
                const hit = state.group.getWorldPosition(new THREE.Vector3()); hit.y = .05;
                for (let i = 0; i < 5; i++) activateParticle(chipPool, 'chip', hit, new THREE.Vector3((Math.random()-.5)*1.1, .35+Math.random()*.65, (Math.random()-.5)*1.1), .8, .45+Math.random()*.3, -6.5, 0, 0x4b4a42);
            }
        }
        for (const state of impactLights) {
            if (state.life <= 0) continue;
            state.life = Math.max(0, state.life - dt);
            state.light.intensity *= Math.exp(-16 * dt);
            if (state.life <= 0) { state.light.intensity = 0; state.light.visible = false; }
        }
        const pulse = .55 + .45 * Math.abs(Math.sin(performance.now() * .008));
        const lamps = cockpit.userData.warningLamps;
        lamps.amberLampMat.emissiveIntensity = cockpitWarningLevel >= 1 ? 1.4 * pulse : .08;
        lamps.redLampMat.emissiveIntensity = cockpitWarningLevel >= 2 ? 2.8 * pulse : .03;
        lamps.amberWash.intensity = cockpitWarningLevel >= 1 ? 1.8 * pulse : 0;
        lamps.redWash.intensity = cockpitWarningLevel >= 2 ? 3.4 * pulse : 0;
        for (let index = transientFX.length - 1; index >= 0; index--) {
            const fx = transientFX[index];
            fx.remaining -= dt;
            if (fx.remaining <= 0) {
                scene.remove(fx.object);
                fx.object.geometry.dispose();
                fx.material.dispose();
                transientFX.splice(index, 1);
            }
            else if ('opacity' in fx.material) {
                fx.material.opacity = fx.remaining / fx.duration;
            }
        }
        for (const state of particleStates) {
            if (!state.mesh.visible)
                continue;
            state.life -= dt;
            if (state.life <= 0) {
                state.mesh.visible = false;
                continue;
            }
            state.velocity.y += state.gravity * dt;
            state.mesh.position.addScaledVector(state.velocity, dt);
            state.mesh.rotation.x += dt * 4.1;
            state.mesh.rotation.z += dt * 3.2;
            const t = state.life / state.duration;
            if (state.smoke) {
                state.mesh.quaternion.copy(camera.quaternion);
                const scale = state.baseScale * (1 + (1 - t) * state.grow);
                state.mesh.scale.setScalar(scale);
                state.mesh.material.opacity = .52 * t;
            }
            else
                state.mesh.material.opacity = Math.min(1, t * 1.8);
        }
        // Every damaged combatant can now communicate distress; the old build only emitted
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
                const destroyedSpark = part.destroyed ? (slot === 'power' ? 2.8 : 1.2) : 0;
                const destroyedSmoke = part.destroyed ? (slot === 'power' ? 1.15 : .62) : 0;
                budget.spark += (profile.sparkRate + destroyedSpark) * dt * (record.wrecked ? .82 : 1);
                budget.smoke += (profile.smokeRate + wreckSmoke + destroyedSmoke) * dt;
                budget.arc += (profile.arcRate + (part.destroyed && slot === 'power' ? .85 : 0)) * dt;
                while (budget.spark >= 1) {
                    budget.spark -= 1;
                    const origin = partWorldPoint(record, slot);
                    const velocity = new THREE.Vector3((Math.random() - .5) * 1.8, .5 + Math.random() * 1.6, (Math.random() - .5) * 1.8);
                    activateParticle(sparkPool, 'spark', origin, velocity, .55 + Math.random() * .5, .18 + Math.random() * .22, -3.8, 0, 0xffb951);
                }
                while (budget.smoke >= 1) {
                    budget.smoke -= 1;
                    const origin = partWorldPoint(record, slot);
                    const velocity = new THREE.Vector3((Math.random() - .5) * .18, .30 + Math.random() * .30, (Math.random() - .5) * .18);
                    activateParticle(smokePool, 'smoke', origin, velocity, 1.0 + profile.severity * .85, 1.45 + Math.random() * 1.15, 0, 1.65, slot === 'power' ? 0x171b18 : 0x252823, true);
                }
                while (budget.arc >= 1) {
                    budget.arc -= 1;
                    spawnWorldPowerArc(partWorldPoint(record, slot), .65 + profile.severity * .65);
                }
            }
        }
    }
    function combatantVisualAudit() {
        const misplaced = [];
        for (const record of squadCombatants.values()) {
            for (const [slot, group] of record.exterior.partGroups) {
                let node = group, owned = false;
                while (node) { if (node === record.exterior.root) { owned = true; break; } node = node.parent; }
                const legitimatelyDetached = record.destroyedSlots.has(slot) && (slot === 'combat' || slot === 'power') && group.parent === scene;
                if (!owned && !legitimatelyDetached) misplaced.push(`${record.id}:${slot}`);
            }
        }
        return { ok: misplaced.length === 0, actors: squadCombatants.size, misplaced };
    }
    selectPart(selected);
    return {
        scene, camera, cockpit, debugColliders,
        updateRigVisual, updateTargetRigVisual, updateHostileNavigation, setInspection, rebuildAssembly, selectPart, focusPart,
        orbitBy, panBy, setInspectorLayout, zoomBy, resetOrbit, pickPart,
        traceShot, showShot, traceHostileShot, showHostileShot, updateTargetDamage, updatePilotDamage, resetTargetDamage, updateCombatEffects, setPilotWeapon,
        addCombatant, setCombatantActive, setCombatantCleared, updateCombatantRig, updateCombatantDamage, traceCombatantShot, showCombatantShot, updateShotAudit, updateObjectivePresentation,
        updateCockpitInstruments, updateCockpitMotion, triggerCockpitHit, resetCockpitTransientFeedback, combatantVisualAudit, partThumbnailDataUrl,
    };
}
function mat(color, roughness = 0.82, metalness = 0.18) {
    return new THREE.MeshStandardMaterial({ color, roughness, metalness, flatShading: true });
}
function box(w, h, d, material) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d, 1, 1, 1), material);
    mesh.castShadow = true; mesh.receiveShadow = true;
    return mesh;
}

function buildGarageBay() {
    const root = new THREE.Group();
    const steel = mat(0x2d3431, .72, .55);
    const darkSteel = mat(0x222a27, .84, .44);
    const concrete = mat(0x535248, .98, .02);
    const padMat = mat(0x343a34, .92, .08);
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

    // Lower fixture glare while raising broad fill: the bay should be dim, not black.
    const lampMat = new THREE.MeshStandardMaterial({ color: 0xffdfad, emissive: 0xffb454, emissiveIntensity: 2.25, roughness: .45 });
    for (const x of [-2.7, 0, 2.7]) {
        const fixture = box(1.55, .10, .25, lampMat);
        fixture.position.set(x, 5.45, -.3);
        root.add(fixture);
        const lamp = new THREE.PointLight(0xffc178, 11.5, 10, 2.0);
        lamp.position.set(x, 5.15, -.3);
        root.add(lamp);
    }
    const hemi = new THREE.HemisphereLight(0xa9c0b4, 0x2b241b, .86);
    root.add(hemi);
    const key = new THREE.DirectionalLight(0xffd19b, 1.95);
    key.position.set(-5, 8, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(256, 256);
    key.shadow.camera.left = -9; key.shadow.camera.right = 9;
    key.shadow.camera.top = 8; key.shadow.camera.bottom = -4;
    key.shadow.camera.near = 1; key.shadow.camera.far = 24;
    key.shadow.bias = -.0006; key.shadow.normalBias = .045;
    root.add(key);
    const rim = new THREE.DirectionalLight(0x70a9a4, 1.15);
    rim.position.set(6, 4, -5);
    root.add(rim);
    const fill = new THREE.DirectionalLight(0x8fa99f, .72);
    fill.position.set(5, 5, 6);
    root.add(fill);

    return root;
}

function buildWarehouse(scene) {
    const solids = [];
    const width = DEFAULT_WORLD.maxX - DEFAULT_WORLD.minX;
    const depth = DEFAULT_WORLD.maxZ - DEFAULT_WORLD.minZ;
    const floor = box(width + 3, 0.35, depth + 3, mat(C.concreteDark, 1, 0));
    floor.position.set((DEFAULT_WORLD.minX + DEFAULT_WORLD.maxX) / 2, -0.18, (DEFAULT_WORLD.minZ + DEFAULT_WORLD.maxZ) / 2);
    floor.userData.arenaObstacleId = 'floor';
    scene.add(floor);
    solids.push(floor);
    const gridSize = Math.max(width, depth);
    const grid = new THREE.GridHelper(gridSize, Math.max(16, Math.round(gridSize / 2)), 0x4d4a3e, 0x34342f);
    grid.position.y = 0.01;
    scene.add(grid);

    const wallMat = mat(C.concrete, 0.98, 0.02);
    const wallThickness = 0.6;
    const wallHeight = 8;
    const wallOffset = 1.0;
    const centerX = (DEFAULT_WORLD.minX + DEFAULT_WORLD.maxX) / 2;
    const centerZ = (DEFAULT_WORLD.minZ + DEFAULT_WORLD.maxZ) / 2;
    const north = box(width + 2, wallHeight, wallThickness, wallMat);
    north.position.set(centerX, wallHeight / 2, DEFAULT_WORLD.minZ - wallOffset);
    north.userData.arenaObstacleId = 'wall-north';
    scene.add(north);
    solids.push(north);
    const south = box(width + 2, wallHeight, wallThickness, wallMat);
    south.position.set(centerX, wallHeight / 2, DEFAULT_WORLD.maxZ + wallOffset);
    south.userData.arenaObstacleId = 'wall-south';
    scene.add(south);
    solids.push(south);
    const west = box(wallThickness, wallHeight, depth + 2, wallMat);
    west.position.set(DEFAULT_WORLD.minX - wallOffset, wallHeight / 2, centerZ);
    west.userData.arenaObstacleId = 'wall-west';
    scene.add(west);
    solids.push(west);
    const east = box(wallThickness, wallHeight, depth + 2, wallMat);
    east.position.set(DEFAULT_WORLD.maxX + wallOffset, wallHeight / 2, centerZ);
    east.userData.arenaObstacleId = 'wall-east';
    scene.add(east);
    solids.push(east);

    const stripeMat = mat(C.yellow, 0.9, 0.08);
    for (const z of [PLAYER_SPAWN.z + 2.6, HOSTILE_SPAWN.z - 2.6]) {
        for (let x = DEFAULT_WORLD.minX + 4; x <= DEFAULT_WORLD.maxX - 4; x += 8) {
            const stripe = box(3.5, 0.03, 0.22, stripeMat);
            stripe.position.set(x, 0.03, z);
            scene.add(stripe);
        }
    }

    const obstacleMaterial = obstacle => {
        if (obstacle.kind === 'pillar') return mat(C.metal, .70, .65);
        if (obstacle.kind === 'container') return mat(obstacle.id.endsWith('east') ? C.teal : C.rust, .82, .20);
        if (obstacle.kind === 'building') return mat(0x565750, .96, .05);
        return mat(C.concreteDark, .98, .02);
    };
    for (const obstacle of DEFAULT_WORLD.obstacles) {
        const w = obstacle.maxX - obstacle.minX;
        const d = obstacle.maxZ - obstacle.minZ;
        const h = Number.isFinite(obstacle.height) ? obstacle.height : 1.1;
        const object = box(w, h, d, obstacleMaterial(obstacle));
        object.position.set((obstacle.minX + obstacle.maxX) / 2, h / 2, (obstacle.minZ + obstacle.maxZ) / 2);
        object.userData.arenaObstacleId = obstacle.id;
        scene.add(object);
        solids.push(object);
        if (obstacle.kind === 'barrier' || obstacle.kind === 'barrier-low' || obstacle.kind === 'building') {
            const cap = box(w * .88, .08, d * 1.02, stripeMat);
            cap.position.set(object.position.x, h + .04, object.position.z);
            cap.userData.arenaObstacleId = obstacle.id;
            scene.add(cap);
            solids.push(cap);
        }
        if (obstacle.kind === 'container') {
            for (const side of [-1, 1]) {
                const rib = box(.08, h * .86, d * .92, mat(0x303734, .84, .32));
                rib.position.set(object.position.x + side * (w / 2 - .10), h * .5, object.position.z);
                rib.userData.arenaObstacleId = obstacle.id;
                scene.add(rib);
                solids.push(rib);
            }
        }
    }

    const lightMaterial = new THREE.MeshStandardMaterial({ color: 0xffd39a, emissive: 0xffa43a, emissiveIntensity: 3.2, roughness: .5 });
    for (const z of [-14, 14]) {
        for (const x of [-22, 0, 22]) {
            const fixture = box(3.6, 0.12, 0.28, lightMaterial);
            fixture.position.set(x, 7.2, z);
            scene.add(fixture);
            const light = new THREE.PointLight(0xffb565, 26, 14, 2.15);
            light.position.set(x, 6.65, z);
            scene.add(light);
        }
    }

    const signCanvas = document.createElement('canvas');
    signCanvas.width = 384;
    signCanvas.height = 64;
    const ctx = signCanvas.getContext('2d');
    if (ctx) {
        ctx.fillStyle = '#161a18';
        ctx.fillRect(0, 0, signCanvas.width, signCanvas.height);
        ctx.fillStyle = '#d6a64a';
        ctx.font = 'bold 23px monospace';
        ctx.fillText('SCRAPYARD BEGINNER YARD', 20, 39);
    }
    const texture = new THREE.CanvasTexture(signCanvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(8.4, 1.4), new THREE.MeshBasicMaterial({ map: texture }));
    sign.position.set(centerX, 5, DEFAULT_WORLD.minZ - .67);
    scene.add(sign);
    return solids;
}
function buildCockpit(scene) {
    const cockpit = new THREE.Group();
    scene.add(cockpit);
    const metal = mat(C.metal, 0.62, 0.72);
    const yellow = mat(C.yellow, 0.85, 0.18);
    const teal = mat(C.teal, 0.82, 0.22);
    const dark = mat(C.dark, 0.9, 0.15);
    const dash = box(1.7, 0.36, 0.62, dark);
    dash.position.set(0, 1.72, -0.88);
    dash.rotation.x = -0.14;
    cockpit.add(dash);
    const hood = box(1.18, 0.24, 1.15, yellow);
    hood.position.set(0, 1.42, -1.42);
    hood.rotation.x = -0.08;
    cockpit.add(hood);
    const leftShoulder = box(0.48, 0.44, 1.05, teal);
    leftShoulder.position.set(-0.94, 1.56, -1.25);
    leftShoulder.rotation.z = 0.08;
    cockpit.add(leftShoulder);
    const rightShoulder = box(0.48, 0.44, 1.05, yellow);
    rightShoulder.position.set(0.94, 1.56, -1.25);
    rightShoulder.rotation.z = -0.08;
    cockpit.add(rightShoulder);
    const strutGeo = new THREE.CylinderGeometry(0.075, 0.09, 1.7, 8);
    for (const side of [-1, 1]) {
        const strut = new THREE.Mesh(strutGeo, metal);
        strut.position.set(side * 0.78, 2.35, -0.62);
        strut.rotation.z = side * 0.18;
        strut.rotation.x = 0.12;
        cockpit.add(strut);
    }
    const roof = box(1.55, 0.12, 0.55, metal);
    roof.position.set(0, 3.06, -0.5);
    cockpit.add(roof);
    const gaugeMat = new THREE.MeshStandardMaterial({ color: C.green, emissive: C.green, emissiveIntensity: 1.8, roughness: 0.8 });
    for (const x of [-0.44, -0.16, 0.16, 0.44]) {
        const gauge = box(0.18, 0.08, 0.025, gaugeMat);
        gauge.position.set(x, 1.93, -1.17);
        cockpit.add(gauge);
    }
    const armoredCab = box(1.23, .20, .23, teal);
    armoredCab.position.set(0, 2.94, -.71);
    armoredCab.visible = false;
    cockpit.add(armoredCab);
    cockpit.userData.armoredCab = armoredCab;
    // Utility cab has an asymmetric high windshield; this is a visual differentiation only.
    const utilityCab = plate(0.60, .20, .08, teal);
    utilityCab.position.set(.34, 2.98, -.68);
    utilityCab.rotation.z = -.10;
    utilityCab.visible = false;
    cockpit.add(utilityCab);
    cockpit.userData.utilityCab = utilityCab;
    // Pilot-view weapon is a moving physical silhouette, not a HUD sprite.
    const gunPivot = new THREE.Group();
    gunPivot.position.set(1.16, 2.04, -.62);
    const breech = box(.43, .34, .65, metal);
    breech.position.set(0, 0, -.19);
    gunPivot.add(breech);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(.105, .13, 1.13, 8), metal);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, -.04, -.79);
    gunPivot.add(barrel);
    const muzzleFlashMat = new THREE.MeshBasicMaterial({ color: 0xffce7e, transparent: true, opacity: .9 });
    const flashMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(.18, 0), muzzleFlashMat);
    flashMesh.position.set(0, -.04, -1.27);
    flashMesh.visible = false;
    gunPivot.add(flashMesh);
    cockpit.add(gunPivot);
    cockpit.userData.gunPivot = gunPivot;
    cockpit.userData.gunBarrel = barrel;
    cockpit.userData.gunBreech = breech;
    cockpit.userData.flashMesh = flashMesh;

    const makeScreen = (name, width, height, x, y, z, rotationX = -.18) => {
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        const texture = new THREE.CanvasTexture(canvas);
        texture.magFilter = THREE.NearestFilter; texture.minFilter = THREE.NearestFilter;
        const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: .94, toneMapped: false });
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width / 250, height / 250), material);
        mesh.name = `cockpit-screen:${name}`;
        mesh.position.set(x, y, z); mesh.rotation.x = rotationX;
        cockpit.add(mesh);
        return { canvas, texture, mesh, ctx: canvas.getContext('2d') };
    };
    const screens = {
        systems: makeScreen('systems', 88, 220, -.43, 1.94, -1.195),
        weapon: makeScreen('weapon', 180, 78, .43, 1.94, -1.195),
        team: makeScreen('team', 200, 44, 0, 2.20, -1.02, -.10),
        motion: makeScreen('motion', 220, 56, -.28, 1.80, -1.19),
        drive: makeScreen('drive', 180, 40, .25, 1.80, -1.19),
    };
    const amberLampMat = new THREE.MeshStandardMaterial({ color: 0x6b572a, emissive: 0xe0a44c, emissiveIntensity: .08, roughness: .65 });
    const redLampMat = new THREE.MeshStandardMaterial({ color: 0x5b281f, emissive: 0xff4938, emissiveIntensity: .03, roughness: .65 });
    const amberLamp = box(.12, .08, .04, amberLampMat); amberLamp.position.set(-.69, 2.14, -1.03); cockpit.add(amberLamp);
    const redLamp = box(.12, .08, .04, redLampMat); redLamp.position.set(.69, 2.14, -1.03); cockpit.add(redLamp);
    const amberWash = new THREE.PointLight(0xe0a44c, 0, 2.8, 2); amberWash.position.set(-.62, 2.22, -.86); cockpit.add(amberWash);
    const redWash = new THREE.PointLight(0xff4938, 0, 3.0, 2); redWash.position.set(.62, 2.22, -.86); cockpit.add(redWash);
    cockpit.userData.instrumentScreens = screens;
    cockpit.userData.warningLamps = { amberLampMat, redLampMat, amberWash, redWash };
    return cockpit;
}
function buildDebugColliders(scene) {
    const group = new THREE.Group();
    const material = new THREE.MeshBasicMaterial({ color: 0x65ff91, wireframe: true, transparent: true, opacity: 0.7, depthTest: false });
    for (const obstacle of DEFAULT_WORLD.obstacles) {
        const w = obstacle.maxX - obstacle.minX;
        const d = obstacle.maxZ - obstacle.minZ;
        const mesh = box(w + 1.9, 0.4, d + 1.9, material);
        mesh.position.set((obstacle.minX + obstacle.maxX) / 2, 0.25, (obstacle.minZ + obstacle.maxZ) / 2);
        group.add(mesh);
    }
    scene.add(group);
    return group;
}
/** The exterior is rebuilt entirely from the five fitted assembly definitions.
 * Each model is intentionally an uncomplicated, complete serviceable assembly.
 * Nested meshes have ownership tags for inspection; there are no arbitrary visual limbs. */
function buildExteriorRig(assembly) {
    const root = new THREE.Group();
    const partGroups = new Map();
    const partMeshes = new Map();
    const pickMeshes = [];
    const yellow = 0xb28a39;
    const teal = 0x417f81;
    const steel = 0x363f41;
    const brightSteel = 0x7b827b;
    const m = (color) => mat(color, .82, .31);
    for (const slot of SLOTS) {
        const fitted = installedPart(assembly, slot);
        if (!fitted)
            continue;
        const def = fitted.definition;
        const group = new THREE.Group();
        group.name = `${slot}: ${def.name} (${fitted.instance.serial})`;
        group.position.set(...def.center);
        root.add(group);
        partGroups.set(slot, group);
        const meshes = [];
        partMeshes.set(slot, meshes);
        const add = (mesh, x = 0, y = 0, z = 0) => {
            mesh.position.set(x, y, z);
            mesh.userData.slot = slot;
            mesh.castShadow = true; mesh.receiveShadow = true;
            group.add(mesh);
            meshes.push(mesh);
            pickMeshes.push(mesh);
            return mesh;
        };
        const cyl = (radiusTop, radiusBottom, height, material, sides = 10) => new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, sides), m(material));
        const sharedVisual = buildPartVisual(def.id, { mode: 'gameplay' });
        if (sharedVisual) {
            group.add(sharedVisual);
            sharedVisual.traverse(node => {
                if (!node.isMesh) return;
                node.userData.slot = slot;
                node.castShadow = true; node.receiveShadow = true;
                meshes.push(node);
                pickMeshes.push(node);
            });
            continue;
        }
        switch (def.id) {
            case 'frame-sr': {
                // BRUISER: deep shoulder sockets, a layered armored belly and one obvious
                // horizontal load path from trunnions through the frame to the hip bridge.
                add(plate(1.74, .77, 1.38, m(steel)), 0, .13, .03);
                add(plate(1.86, .42, 1.37, m(yellow)), 0, .35, .08);
                const belly = add(plate(1.38, .33, 1.08, m(0x575b52)), 0, -.35, .02);
                belly.rotation.x = -.10;
                const glacis = add(plate(1.53, .48, .22, m(0xc29a49)), 0, -.015, -.72);
                glacis.rotation.x = -.22;
                const lowerLip = add(plate(1.40, .20, .21, m(yellow)), 0, -.34, -.76);
                lowerLip.rotation.x = -.15;
                add(plate(1.12, .11, .88, m(0x646558)), 0, .58, .03);
                for (const side of [-1, 1]) {
                    const socket = add(cyl(.39, .39, .30, steel), side * .95, .15, -.02);
                    socket.rotation.z = Math.PI / 2;
                    const cap = add(cyl(.24, .24, .055, brightSteel), side * 1.10, .15, -.02);
                    cap.rotation.z = Math.PI / 2;
                    const shoulder = add(plate(.34, .59, .94, m(yellow)), side * .84, .20, .02);
                    shoulder.rotation.z = side * -.09;
                    add(plate(.18, .40, .60, m(teal)), side * 1.02, .13, -.01);
                    const hip = add(cyl(.32, .32, .23, steel), side * .72, -.47, .15);
                    hip.rotation.z = Math.PI / 2;
                }
                const hipBridge = add(cyl(.24, .24, 1.78, brightSteel), 0, -.47, .15);
                hipBridge.rotation.z = Math.PI / 2;
                add(plate(.43, .26, .54, m(steel)), 0, -.50, -.09);
                break;
            }
            case 'frame-utility': {
                // SKELETON: the existing U-2's 1,290 kg and 4,120 kg rating are unchanged.
                // Its voids are intentional: an exposed spine and open equipment rails,
                // not a light hull merely colored black.
                const spine = add(plate(.38, .73, 1.47, m(steel)), 0, .05, .03);
                spine.rotation.x = -.035;
                add(plate(.52, .20, 1.37, m(brightSteel)), 0, -.28, .02);
                for (const side of [-1, 1]) {
                    const rail = add(plate(.17, .16, 1.47, m(yellow)), side * .59, .35, .02);
                    rail.rotation.z = side * -.035;
                    const bellyRail = add(plate(.15, .14, 1.32, m(0x74766b)), side * .60, -.31, .03);
                    bellyRail.rotation.z = side * .025;
                    add(plate(.12, .58, .18, m(brightSteel)), side * .59, .01, -.48);
                    add(plate(.12, .58, .18, m(brightSteel)), side * .59, .01, .49);
                    const hip = add(cyl(.30, .30, .25, steel), side * .65, -.43, .14);
                    hip.rotation.z = Math.PI / 2;
                    const triangleBrace = add(plate(.16, .56, .18, m(0x727e76)), side * .42, .05, .05);
                    triangleBrace.rotation.z = side * .53;
                }
                // Forward/rear crossmembers are visual evidence of load-bearing width.
                add(plate(1.34, .17, .21, m(yellow)), 0, .34, -.49);
                add(plate(1.28, .16, .23, m(yellow)), 0, .34, .52);
                const bridge = add(cyl(.20, .20, 1.51, brightSteel), 0, -.44, .11);
                bridge.rotation.z = Math.PI / 2;
                // A standardized command mounting saddle spans the open frame.
                add(plate(.78, .11, .81, m(steel)), 0, .46, -.29);
                // Original U-2 weapon outrigger; its extra reach remains visible.
                add(plate(.62, .19, .29, m(brightSteel)), .81, .13, -.31);
                const trunnion = add(cyl(.31, .31, .19, steel), 1.07, .12, -.45);
                trunnion.rotation.z = Math.PI / 2;
                add(plate(.27, .32, .58, m(teal)), -.68, .10, .13);
                break;
            }
            case 'frame-wedge': {
                // WEDGE: shape itself is structural. A lower armored shell rises toward
                // the rear command saddle and connects to the very same U1 stations.
                add(wedgeHull(1.12, 1.80, .06, .44, 1.88, m(0xc69a43)), 0, .10, -.08);
                add(plate(1.56, .23, 1.63, m(steel)), 0, -.35, .10);
                const nose = add(plate(1.03, .15, .24, m(0xa17d37)), 0, -.15, -1.01);
                nose.rotation.x = -.24;
                // No window or sensor on this hull: those are separate command modules.
                add(plate(.90, .09, .77, m(steel)), 0, .54, .29);
                for (const side of [-1, 1]) {
                    const cheek = add(wedgeHull(.20, .34, .07, .46, 1.61, m(yellow)), side * .72, .06, .03);
                    cheek.rotation.z = side * -.07;
                    add(plate(.16, .34, .70, m(teal)), side * .91, -.03, .18);
                    const mount = add(cyl(.31, .31, .28, steel), side * .91, .17, -.20);
                    mount.rotation.z = Math.PI / 2;
                    const hip = add(cyl(.33, .33, .24, brightSteel), side * .72, -.48, .20);
                    hip.rotation.z = Math.PI / 2;
                }
                const crossbar = add(cyl(.23, .23, 1.74, steel), 0, -.46, .17);
                crossbar.rotation.z = Math.PI / 2;
                // Low-slung front crash hoop reads as chassis, not a second cockpit.
                add(plate(1.04, .12, .14, m(0x5b645d)), 0, -.31, -.92);
                break;
            }
            case 'power-dynamo': {
                // Rear-mounted generator/cooling pack: fans and exposed teal radiator fins.
                add(plate(1.06, .85, .76, m(steel)), 0, 0, 0);
                add(plate(1.24, .85, .18, m(teal)), 0, -.03, .38);
                for (let i = -4; i <= 4; i++)
                    add(box(.064, .63, .085, m(0x1c3537)), i * .12, -.03, .50);
                const fan = add(cyl(.28, .28, .10, brightSteel, 12), 0, .12, .56);
                fan.rotation.x = Math.PI / 2;
                add(box(.43, .08, .08, m(0x283434)), 0, .12, .65);
                add(box(.08, .43, .08, m(0x283434)), 0, .12, .65);
                break;
            }
            case 'power-air': {
                // Compact power core + tall open radiator stack; geometry explains the exposed tradeoff.
                add(plate(.93, .60, .74, m(steel)), 0, -.20, -.02);
                add(plate(1.04, .21, .71, m(yellow)), 0, .10, .00);
                for (const side of [-1, 1]) {
                    add(plate(.10, .75, .66, m(teal)), side * .43, .27, .04);
                    for (let fin = -2; fin <= 2; fin++) {
                        add(plate(.28, .58, .065, m(0x6a7970)), side * .39, .31, fin * .13);
                    }
                }
                const pipe = add(cyl(.09, .09, .55, brightSteel, 8), -.14, .44, -.17);
                pipe.rotation.z = .17;
                const fan = add(cyl(.24, .24, .10, brightSteel, 10), 0, .35, .38);
                fan.rotation.x = Math.PI / 2;
                add(plate(.45, .09, .08, m(steel)), 0, .35, .47);
                add(plate(.09, .45, .08, m(steel)), 0, .35, .47);
                break;
            }
            case 'cab-cyclops': {
                // CYCLOPS: the single protected optical lens is a distinct serviceable
                // camera carried by a low, visibly pilot-sized industrial enclosure.
                add(plate(1.12, .61, .99, m(steel)), 0, -.13, .06);
                const tub = add(plate(1.16, .26, .66, m(yellow)), 0, -.35, -.25);
                tub.rotation.x = -.11;
                // A central armored camera cassette; no paired face-like 'eyes'.
                add(plate(.73, .66, .27, m(0x7a8279)), -.06, .13, -.38);
                add(plate(.59, .52, .17, m(0x1a2626)), -.06, .13, -.53);
                const bezel = add(cyl(.255, .255, .10, steel, 12), -.06, .11, -.64);
                bezel.rotation.x = Math.PI / 2;
                const lens = add(cyl(.182, .182, .032, 0x4b9f9a, 12), -.06, .11, -.713);
                lens.rotation.x = Math.PI / 2;
                const lensGlass = add(cyl(.103, .103, .035, 0x244649, 10), -.06, .11, -.736);
                lensGlass.rotation.x = Math.PI / 2;
                for (const side of [-1, 1]) {
                    add(plate(.14, .77, .80, m(yellow)), side * .52, -.03, -.04);
                    add(plate(.18, .20, .45, m(teal)), side * .51, -.30, .04);
                }
                add(plate(.78, .12, .79, m(0x827d66)), -.05, .51, .02);
                add(plate(.35, .15, .38, m(steel)), .28, .49, .11);
                break;
            }
            case 'cab-armored': {
                // INTEGRATED: a shallow armored crew cell merging into the front deck.
                // The slit is a separate visible glazing insert, NOT a smile/robot face.
                add(plate(1.36, .53, 1.06, m(steel)), 0, -.17, .07);
                const roof = add(plate(1.35, .19, .95, m(0x626357)), 0, .22, .15);
                roof.rotation.x = -.07;
                for (const side of [-1, 1]) {
                    const cheek = add(plate(.25, .53, 1.06, m(yellow)), side * .65, -.14, -.04);
                    cheek.rotation.z = side * -.09;
                    add(plate(.17, .23, .63, m(teal)), side * .72, .04, .12);
                }
                const brow = add(plate(1.20, .14, .28, m(yellow)), 0, .15, -.47);
                brow.rotation.x = -.10;
                add(plate(.93, .105, .053, m(0x142326)), 0, .045, -.526);
                add(plate(.79, .040, .023, m(0x538c85)), 0, .050, -.566);
                const lower = add(plate(1.36, .35, .33, m(0xbf9141)), 0, -.38, -.46);
                lower.rotation.x = -.26;
                add(plate(.94, .09, .59, m(steel)), 0, -.48, .18);
                break;
            }
            case 'cab-utility': {
                // OBSERVATION: a distinctly taller utility cab with one broad windshield
                // and two SIDE windows; their arrangement is vehicle-like, not humanoid.
                add(plate(.93, .91, .98, m(steel)), -.06, .01, .05);
                const sill = add(plate(1.08, .30, 1.02, m(yellow)), -.02, -.42, -.06);
                sill.rotation.x = -.10;
                add(plate(.86, .41, .064, m(0x20353a)), 0, .20, -.465);
                add(plate(.71, .055, .022, m(0x548d88)), 0, .08, -.513);
                for (const side of [-1, 1]) {
                    const window = add(plate(.42, .28, .06, m(0x253e40)), side * .494, .18, -.10);
                    window.rotation.y = side * Math.PI / 2;
                    const pillar = add(plate(.16, .80, .83, m(yellow)), side * .50, .10, .06);
                    pillar.rotation.z = side * -.05;
                    add(plate(.19, .14, .42, m(teal)), side * .49, -.29, .20);
                }
                const canopy = add(plate(1.04, .17, 1.06, m(teal)), -.06, .53, .055);
                canopy.rotation.x = -.06;
                add(plate(.32, .11, .37, m(0x898d79)), .26, .65, .11);
                break;
            }
            case 'gun-light': {
                // Long narrow barrel + open support rail, smaller breech, exposed recoil path.
                const mount = add(cyl(.27, .27, .43, steel), -.10, .01, .12);
                mount.rotation.z = Math.PI / 2;
                add(plate(.62, .42, .73, m(yellow)), 0, .02, .02);
                add(plate(.45, .13, 1.18, m(teal)), 0, .28, -.39);
                add(plate(.18, .25, 1.50, m(0x747970)), -.24, -.13, -.51);
                const barrel = add(cyl(.105, .14, 2.03, brightSteel, 10), 0, -.05, -1.09);
                barrel.rotation.x = Math.PI / 2;
                const muzzle = add(cyl(.17, .17, .20, steel), 0, -.05, -2.12);
                muzzle.rotation.x = Math.PI / 2;
                // Two opposed slots visibly distinguish the lightweight muzzle brake.
                add(plate(.30, .035, .12, m(0x181e1d)), 0, .10, -2.12);
                add(plate(.31, .24, .29, m(0x54574f)), 0, -.01, .49);
                break;
            }
            case 'gun-cannon':
            case 'gun-short': {
                const short = def.id === 'gun-short';
                const mount = add(cyl(.35, .35, .51, steel), -.10, .01, .13);
                mount.rotation.z = Math.PI / 2;
                add(plate(.81, .55, .85, m(yellow)), 0, .05, -.04);
                add(plate(.66, .28, .62, m(teal)), 0, .25, .05);
                const length = short ? .73 : 1.46;
                const barrel = add(cyl(short ? .20 : .135, short ? .26 : .20, length, brightSteel), 0, -.05, -.45 - length * .25);
                barrel.rotation.x = Math.PI / 2;
                const muzzle = add(cyl(short ? .27 : .22, short ? .27 : .22, .12, steel), 0, -.05, -.45 - length * .75);
                muzzle.rotation.x = Math.PI / 2;
                add(plate(.66, .46, .37, m(0x5a5b4d)), 0, .05, .53);
                break;
            }
        }
    }
    // Mount subassemblies to the real hull group. Shared mobility visuals carry
    // their authored interface hardware; mass and compatibility remain graph data.
    const hull = partGroups.get('structure');
    if (hull) {
        for (const [slot, group] of partGroups) {
            if (slot === 'structure')
                continue;
            hull.add(group);
            const c = SLOT_CENTERS[slot];
            const parent = SLOT_CENTERS.structure;
            group.position.set(c[0] - parent[0], c[1] - parent[1], c[2] - parent[2]);
        }
    }
    return { root, partGroups, partMeshes, pickMeshes };
}
/** Eight-corner tapered low-poly hull. Front (-Z) is lower and narrower;
 * broad rear carries load into the chassis. Pure geometry: no builder-specific
 * special cases or fake 'universal' adapters. */
function wedgeHull(frontWidth, rearWidth, frontHeight, rearHeight, depth, material) {
    const f = -depth / 2;
    const b = depth / 2;
    const bottom = -.40;
    const vertices = new Float32Array([
        -frontWidth / 2, bottom, f, frontWidth / 2, bottom, f,
        frontWidth / 2, frontHeight, f, -frontWidth / 2, frontHeight, f,
        -rearWidth / 2, bottom, b, rearWidth / 2, bottom, b,
        rearWidth / 2, rearHeight, b, -rearWidth / 2, rearHeight, b,
    ]);
    const indices = [
        0, 2, 1, 0, 3, 2, // forward armored nose
        4, 5, 6, 4, 6, 7, // rear bulkhead
        0, 4, 7, 0, 7, 3, // left cheek
        1, 2, 6, 1, 6, 5, // right cheek
        3, 7, 6, 3, 6, 2, // upper sloped deck
        0, 1, 5, 0, 5, 4, // structural belly
    ];
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    // Non-indexed normals keep the wedge faceted at mobile render resolutions.
    const faceted = geometry.toNonIndexed();
    faceted.computeVertexNormals();
    geometry.dispose();
    return new THREE.Mesh(faceted, material);
}
/** Chamfered polygon, deliberately low-poly; avoid the cuboid-only silhouette. */
function plate(width, height, depth, material) {
    const cut = Math.min(.13, width * .15, height * .17);
    const shape = new THREE.Shape();
    shape.moveTo(-width / 2 + cut, -height / 2);
    shape.lineTo(width / 2 - cut, -height / 2);
    shape.lineTo(width / 2, -height / 2 + cut);
    shape.lineTo(width / 2, height / 2 - cut);
    shape.lineTo(width / 2 - cut, height / 2);
    shape.lineTo(-width / 2 + cut, height / 2);
    shape.lineTo(-width / 2, height / 2 - cut);
    shape.closePath();
    const bevel = Math.min(.024, depth / 4);
    const geometry = new THREE.ExtrudeGeometry(shape, {
        depth: depth - bevel * 2, bevelEnabled: true, bevelThickness: bevel,
        bevelSize: bevel, bevelSegments: 1, curveSegments: 1,
    });
    geometry.translate(0, 0, -depth / 2 + bevel);
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true; mesh.receiveShadow = true;
    return mesh;
}
