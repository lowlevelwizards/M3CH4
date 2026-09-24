import * as THREE from 'three';
import { framingOffsetWorld, orbitAzimuthAfterDrag, panInRigSpace } from './inspectionCamera.js?v=b51';
import { DEFAULT_WORLD, physicsYawToViewYaw } from './locomotion.js';
import { adapterFor, installedPart, SLOT_CENTERS, SLOTS } from './components.js';
const C = {
    concrete: 0x777267, concreteDark: 0x4d4b45,
    yellow: 0xa9822f, teal: 0x2f7473, metal: 0x343a39,
    dark: 0x151816, rust: 0x8a4d2d, amber: 0xe0a44c, green: 0x6ea778,
};
export function createArenaScene(initial) {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x171915);
    scene.fog = new THREE.FogExp2(0x171915, 0.018);
    const camera = new THREE.PerspectiveCamera(68, 1, 0.06, 95);
    camera.rotation.order = 'YXZ';
    scene.add(new THREE.HemisphereLight(0xb2b59d, 0x26231d, 1.1));
    const sun = new THREE.DirectionalLight(0xffd69a, 2.1);
    sun.position.set(-7, 12, 8);
    scene.add(sun);
    buildWarehouse(scene);
    const cockpit = buildCockpit(scene);
    const debugColliders = buildDebugColliders(scene);
    debugColliders.visible = false;
    let exterior = buildExteriorRig(initial);
    scene.add(exterior.root);
    exterior.root.visible = false;
    const raycaster = new THREE.Raycaster();
    let selected = null;
    let inspecting = false;
    let azimuth = 0.57;
    let elevation = 0.31;
    let radius = 5.85;
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
        cockpit.position.set(visualX, 0, visualZ);
        cockpit.rotation.set(cockpitPitch, renderYaw, cockpitRoll, 'YXZ');
        exterior.root.position.set(visualX, 0, visualZ);
        exterior.root.rotation.y = renderYaw;
        if (inspecting) {
            // Orbit the machine, not the background. The camera target follows selected modules.
            orbitTarget.lerp(desiredTarget, 1 - Math.exp(-9 * dt));
            const around = new THREE.Vector3(radius * Math.sin(azimuth) * Math.cos(elevation), radius * Math.sin(elevation), -radius * Math.cos(azimuth) * Math.cos(elevation)).applyAxisAngle(THREE.Object3D.DEFAULT_UP, renderYaw);
            const center = orbitTarget.clone().applyAxisAngle(THREE.Object3D.DEFAULT_UP, renderYaw);
            center.x += visualX;
            center.z += visualZ;
            camera.position.copy(center).add(around);
            // The panel occupies real screen pixels; aim at the middle of the remaining visible area.
            // Raycasting uses this same camera, so tap-to-pick stays accurate at every panel width/zoom.
            const right = new THREE.Vector3(Math.cos(azimuth), 0, Math.sin(azimuth))
                .applyAxisAngle(THREE.Object3D.DEFAULT_UP, renderYaw);
            const shift = framingOffsetWorld(panelRightPx, viewportWidth, viewportHeight, radius, camera.fov);
            // +rig-right is actual CAMERA SCREEN-left at our negative-Z inspection angle.
            // Looking further +rig-right therefore positions the mech to the right of the panel.
            camera.lookAt(center.addScaledVector(right, shift));
        }
        else {
            camera.position.set(visualX, 2.42 + cockpitHeave, visualZ);
            camera.rotation.set(lookPitch + cockpitPitch * 0.35, renderYaw + lookYaw, cockpitRoll * 0.25, 'YXZ');
        }
    }
    function setInspection(enabled) {
        inspecting = enabled;
        exterior.root.visible = enabled;
        cockpit.visible = !enabled;
    }
    function rebuildAssembly(assembly) {
        const oldRoot = exterior.root;
        exterior = buildExteriorRig(assembly);
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
        if (!slot || !exterior.partGroups.has(slot))
            desiredTarget.set(0, 1.85, 0);
        else
            desiredTarget.set(...SLOT_CENTERS[slot]);
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
            radius = THREE.MathUtils.clamp(radius / scale, 2.7, 11.2);
    }
    function resetOrbit() {
        azimuth = 0.57;
        elevation = 0.31;
        radius = 5.85;
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
    selectPart(selected);
    return {
        scene, camera, cockpit, debugColliders,
        updateRigVisual, setInspection, rebuildAssembly, selectPart, focusPart,
        orbitBy, panBy, setInspectorLayout, zoomBy, resetOrbit, pickPart,
    };
}
function mat(color, roughness = 0.82, metalness = 0.18) {
    return new THREE.MeshStandardMaterial({ color, roughness, metalness, flatShading: true });
}
function box(w, h, d, material) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d, 1, 1, 1), material);
    return mesh;
}
function buildWarehouse(scene) {
    const floor = box(50, 0.35, 36, mat(C.concreteDark, 1, 0));
    floor.position.y = -0.18;
    scene.add(floor);
    const grid = new THREE.GridHelper(48, 24, 0x4d4a3e, 0x34342f);
    grid.position.y = 0.01;
    scene.add(grid);
    const wallMat = mat(C.concrete, 0.98, 0.02);
    const wallThickness = 0.55;
    const wallHeight = 8;
    const north = box(50, wallHeight, wallThickness, wallMat);
    north.position.set(0, wallHeight / 2, -17);
    scene.add(north);
    const south = box(50, wallHeight, wallThickness, wallMat);
    south.position.set(0, wallHeight / 2, 17);
    scene.add(south);
    const west = box(wallThickness, wallHeight, 34, wallMat);
    west.position.set(-24, wallHeight / 2, 0);
    scene.add(west);
    const east = west.clone();
    east.position.x = 24;
    scene.add(east);
    const stripeMat = mat(C.yellow, 0.9, 0.08);
    for (let x = -20; x <= 20; x += 8) {
        const stripe = box(3.5, 0.03, 0.22, stripeMat);
        stripe.position.set(x, 0.03, -15.4);
        scene.add(stripe);
    }
    for (const obstacle of DEFAULT_WORLD.obstacles) {
        const w = obstacle.maxX - obstacle.minX;
        const d = obstacle.maxZ - obstacle.minZ;
        const h = obstacle.id.startsWith('crate') ? 1.8 : 1.1;
        const material = obstacle.id.startsWith('crate') ? mat(C.rust) : mat(C.concreteDark);
        const object = box(w, h, d, material);
        object.position.set((obstacle.minX + obstacle.maxX) / 2, h / 2, (obstacle.minZ + obstacle.maxZ) / 2);
        scene.add(object);
        if (!obstacle.id.startsWith('crate')) {
            const cap = box(w * 0.8, 0.08, d * 1.03, stripeMat);
            cap.position.set(object.position.x, h + 0.04, object.position.z);
            scene.add(cap);
        }
    }
    const columnMat = mat(C.metal, 0.7, 0.65);
    for (const x of [-18, -6, 6, 18]) {
        for (const z of [-13, 13]) {
            const column = box(0.55, 7.5, 0.55, columnMat);
            column.position.set(x, 3.75, z);
            scene.add(column);
        }
    }
    const lightMaterial = new THREE.MeshStandardMaterial({ color: 0xffcf8a, emissive: 0xffa43a, emissiveIntensity: 2.4 });
    for (const x of [-16, -8, 0, 8, 16]) {
        const fixture = box(3.6, 0.12, 0.28, lightMaterial);
        fixture.position.set(x, 7.2, 0);
        scene.add(fixture);
        const light = new THREE.PointLight(0xffb65f, 14, 12, 1.8);
        light.position.set(x, 6.8, 0);
        scene.add(light);
    }
    const signCanvas = document.createElement('canvas');
    signCanvas.width = 256;
    signCanvas.height = 64;
    const ctx = signCanvas.getContext('2d');
    if (ctx) {
        ctx.fillStyle = '#161a18';
        ctx.fillRect(0, 0, 256, 64);
        ctx.fillStyle = '#d6a64a';
        ctx.font = 'bold 24px monospace';
        ctx.fillText('SCRAPYARD BAY 03', 18, 39);
    }
    const texture = new THREE.CanvasTexture(signCanvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(6.4, 1.6), new THREE.MeshBasicMaterial({ map: texture }));
    sign.position.set(0, 5, -16.68);
    scene.add(sign);
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
            group.add(mesh);
            meshes.push(mesh);
            pickMeshes.push(mesh);
            return mesh;
        };
        const cyl = (radiusTop, radiusBottom, height, material, sides = 10) => new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, sides), m(material));
        const round = (radius, material) => new THREE.Mesh(new THREE.SphereGeometry(radius, 10, 6), m(material));
        switch (def.id) {
            case 'frame-sr': {
                // A shallow structural monocoque supported by a visible, substantial hip bridge.
                add(plate(1.8, 0.8, 1.26, m(yellow)), 0, 0.15, -0.06);
                add(plate(1.34, 0.36, .93, m(steel)), 0, -.42, .08);
                const front = add(plate(1.48, .63, .14, m(0xc9a04f)), 0, .05, -.72);
                front.rotation.x = -.18;
                const hipBeam = add(cyl(.23, .23, 1.85, steel), 0, -.45, .11);
                hipBeam.rotation.z = Math.PI / 2;
                for (const side of [-1, 1]) {
                    const shoulder = add(cyl(.37, .37, .21, steel), side * .95, .14, -.03);
                    shoulder.rotation.z = Math.PI / 2;
                    const hip = add(cyl(.35, .35, .25, brightSteel), side * .75, -.45, .11);
                    hip.rotation.z = Math.PI / 2;
                    add(plate(.42, .43, .68, m(teal)), side * .85, .15, -.08);
                }
                break;
            }
            case 'frame-utility': {
                // A narrower lower-capacity chassis with an external right shoulder outrigger.
                add(plate(1.38, .66, 1.17, m(steel)), 0, .12, -.02);
                const nose = add(plate(1.14, .51, .29, m(0xbb923f)), 0, .02, -.64);
                nose.rotation.x = -.20;
                add(plate(1.08, .24, .93, m(yellow)), 0, .41, -.03);
                add(plate(1.08, .28, .70, m(steel)), 0, -.36, .08);
                const bridge = add(cyl(.20, .20, 1.54, brightSteel), 0, -.44, .09);
                bridge.rotation.z = Math.PI / 2;
                for (const side of [-1, 1]) {
                    const hip = add(cyl(.30, .30, .22, steel), side * .68, -.43, .11);
                    hip.rotation.z = Math.PI / 2;
                    add(plate(.14, .37, .75, m(teal)), side * .67, .09, .04);
                }
                const outrigger = add(plate(.65, .23, .42, m(0x72776e)), .82, .12, -.22);
                outrigger.rotation.z = -.12;
                const collar = add(cyl(.31, .31, .20, steel), 1.05, .13, -.44);
                collar.rotation.z = Math.PI / 2;
                break;
            }
            case 'legs-yard':
            case 'legs-hauler': {
                const wide = def.id === 'legs-hauler';
                const spread = wide ? .86 : .69;
                const thick = wide ? 1.23 : 1;
                // Each limb has a load path: hip pivot → canted thigh → knee → shin → ankle → broad foot.
                for (const side of [-1, 1]) {
                    const hip = add(cyl(.34 * thick, .34 * thick, .32 * thick, steel), side * spread, .51, .03);
                    hip.rotation.z = Math.PI / 2;
                    const thigh = add(plate(.49 * thick, .64, .45 * thick, m(0x525750)), side * spread, .12, .08);
                    thigh.rotation.z = side * -.075;
                    const piston = add(cyl(.092, .12, .58, brightSteel), side * (spread + .25 * thick), -.07, .13);
                    piston.rotation.z = side * .19;
                    const knee = add(cyl(.27 * thick, .27 * thick, .25 * thick, steel), side * spread, -.25, .04);
                    knee.rotation.z = Math.PI / 2;
                    const kneeArmor = add(plate(.55 * thick, .50, .20, m(wide ? yellow : teal)), side * spread, -.27, -.23);
                    kneeArmor.rotation.x = -.10;
                    add(plate(.46 * thick, .55, .42 * thick, m(steel)), side * spread, -.51, .15);
                    const ankle = add(round(.20 * thick, brightSteel), side * spread, -.75, .14);
                    ankle.scale.set(1.0, .75, .8);
                    const foot = add(plate(.74 * thick, .23, 1.08 * thick, m(0x55584c)), side * spread, -.89, -.24);
                    foot.rotation.x = -.025;
                    add(plate(.52 * thick, .11, .36, m(yellow)), side * spread, -.78, -.60);
                }
                if (wide) {
                    const brace = add(plate(1.78, .23, .38, m(steel)), 0, .52, .17);
                    brace.rotation.x = -.08;
                }
                if (adapterFor(assembly, 'mobility')) {
                    add(cyl(.39, .39, .18, 0xd8ad60), 0, .58, .04);
                    for (const side of [-1, 1]) {
                        const flange = add(cyl(.39, .39, .13, 0xb7bcb1), side * spread, .53, .05);
                        flange.rotation.z = Math.PI / 2;
                    }
                }
                break;
            }
            case 'legs-compact': {
                // Inboard hip, reverse-canted knees and short piston pairs: a genuinely narrower stance.
                for (const side of [-1, 1]) {
                    const hip = add(cyl(.28, .28, .26, steel), side * .57, .49, .04);
                    hip.rotation.z = Math.PI / 2;
                    const thigh = add(plate(.36, .52, .40, m(0x77766b)), side * .68, .12, -.08);
                    thigh.rotation.z = side * -.24;
                    const rearLink = add(plate(.22, .58, .26, m(steel)), side * .80, -.30, .26);
                    rearLink.rotation.z = side * .18;
                    const knee = add(cyl(.25, .25, .23, brightSteel), side * .83, -.21, .03);
                    knee.rotation.z = Math.PI / 2;
                    const kneecap = add(plate(.42, .38, .14, m(teal)), side * .83, -.24, -.19);
                    kneecap.rotation.x = -.16;
                    const shin = add(plate(.35, .58, .35, m(steel)), side * .64, -.57, .19);
                    shin.rotation.z = side * .22;
                    const piston = add(cyl(.065, .10, .50, brightSteel), side * .76, -.49, -.03);
                    piston.rotation.z = side * .30;
                    const ankle = add(round(.17, brightSteel), side * .59, -.79, .17);
                    ankle.scale.set(1, .8, .8);
                    const foot = add(plate(.56, .17, .90, m(0x555c57)), side * .59, -.88, -.25);
                    foot.rotation.y = side * -.07;
                    add(plate(.36, .08, .34, m(yellow)), side * .59, -.77, -.55);
                }
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
            case 'cab-cyclops':
            case 'cab-armored': {
                // Vehicle-like pilot modules, not robot faces. Cab shells overlap the hull's
                // shoulder line: armor carries load, a recessed glazing slit provides sight.
                const armored = def.id === 'cab-armored';
                if (armored) {
                    // Heavy Hearth: broad wedge, armored flanks, flush horizontal observation slit.
                    add(plate(1.28, .68, 1.04, m(steel)), 0, -.07, .04);
                    for (const side of [-1, 1]) {
                        const cheek = add(plate(.18, .62, .91, m(yellow)), side * .65, -.05, -.02);
                        cheek.rotation.z = side * -.075;
                    }
                    const lower = add(plate(1.30, .36, .32, m(0xc19848)), 0, -.30, -.47);
                    lower.rotation.x = -.17;
                    add(plate(.92, .105, .045, m(0x142326)), 0, .055, -.508);
                    add(plate(.52, .045, .025, m(0x609a91)), -.12, .055, -.536);
                    const visorBrow = add(plate(1.38, .19, .42, m(teal)), 0, .23, -.42);
                    visorBrow.rotation.x = -.08;
                    add(plate(1.30, .16, .84, m(0x6f7164)), 0, .32, .16);
                    add(plate(.32, .08, .46, m(0x957139)), .43, .42, .23);
                }
                else {
                    // Scrapyard Cyclops: an integrated pilot tub with ONE offset optics window.
                    add(plate(1.04, .59, 1.00, m(steel)), 0, -.07, .06);
                    for (const side of [-1, 1]) {
                        const rail = add(plate(.16, .41, .83, m(yellow)), side * .53, -.08, .04);
                        rail.rotation.z = side * -.08;
                    }
                    const hood = add(plate(1.09, .29, .40, m(yellow)), 0, -.30, -.37);
                    hood.rotation.x = -.14;
                    add(plate(.78, .17, .075, m(0x142628)), 0, .035, -.481);
                    // Asymmetric rectangular optical insert avoids a humanoid eyeball read.
                    add(plate(.29, .105, .032, m(0x5ba39a)), -.21, .046, -.531);
                    add(plate(.90, .13, .80, m(0x6b7065)), 0, .28, .07);
                    add(plate(.26, .12, .31, m(teal)), .31, .34, -.13);
                }
                break;
            }
            case 'cab-utility': {
                // Tall offset observation enclosure with ONE broad glazing band, not humanoid eyes.
                add(plate(.83, .89, .92, m(steel)), -.08, .03, .06);
                const skirt = add(plate(1.02, .33, 1.00, m(yellow)), 0, -.40, -.07);
                skirt.rotation.x = -.12;
                add(plate(.95, .15, .30, m(0x8b8e81)), 0, -.03, -.46);
                const window = add(plate(.70, .23, .065, m(0x243c3f)), .08, .20, -.415);
                window.rotation.y = -.10;
                add(plate(.64, .08, .028, m(0x548e87)), .08, .21, -.464);
                const canopy = add(plate(.88, .20, .96, m(teal)), -.04, .54, .05);
                canopy.rotation.x = -.08;
                add(plate(.18, .56, .62, m(yellow)), -.50, .17, .07);
                add(plate(.28, .11, .31, m(0x888b77)), .32, .65, .11);
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
    // Mount subassemblies to the real hull group. The adapter is a derived physical
    // object on the heavy leg geometry; its mass is added by the mechanical inspector.
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
    return new THREE.Mesh(geometry, material);
}
