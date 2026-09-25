import * as THREE from 'three';
import { framingOffsetWorld, orbitAzimuthAfterDrag, panInRigSpace } from './inspectionCamera.js';
import { DEFAULT_WORLD, physicsYawToViewYaw } from './locomotion.js';
import { adapterFor, installedPart, SLOT_CENTERS, SLOTS } from './components.js';
const C = {
    concrete: 0x777267, concreteDark: 0x4d4b45,
    yellow: 0xa9822f, teal: 0x2f7473, metal: 0x343a39,
    dark: 0x151816, rust: 0x8a4d2d, amber: 0xe0a44c, green: 0x6ea778,
};
export function createArenaScene(initial, targetAssembly) {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x171915);
    scene.fog = new THREE.FogExp2(0x171915, 0.018);
    const camera = new THREE.PerspectiveCamera(68, 1, 0.06, 95);
    camera.rotation.order = 'YXZ';
    scene.add(new THREE.HemisphereLight(0xb2b59d, 0x26231d, 1.1));
    const sun = new THREE.DirectionalLight(0xffd69a, 2.1);
    sun.position.set(-7, 12, 8);
    scene.add(sun);
    const worldSolids = buildWarehouse(scene);
    const cockpit = buildCockpit(scene);
    const debugColliders = buildDebugColliders(scene);
    debugColliders.visible = false;
    // The stationary target is assembled from the SAME definitions and geometry
    // as the player. It has its own installed serials and never inherits player swaps.
    let targetExterior = buildExteriorRig(targetAssembly);
    targetExterior.root.position.set(0, 0, 0);
    targetExterior.root.rotation.y = Math.PI; // Look back toward the pilot.
    scene.add(targetExterior.root);
    const rangeMarks = new THREE.Group();
    targetExterior.root.add(rangeMarks);
    const sootMarks = [];
    const transientFX = [];
    const targetColors = new WeakMap();
    for (const mesh of targetExterior.pickMeshes) {
        const material = mesh.material;
        if (material instanceof THREE.MeshStandardMaterial)
            targetColors.set(mesh, material.color.clone());
    }
    // Ring, not another obstacle or an invisible hit volume.
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.75, 1.84, 32), new THREE.MeshBasicMaterial({ color: 0xcf9750, side: THREE.DoubleSide, transparent: true, opacity: .52 }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(0, .035, 0);
    scene.add(ring);
    let muzzleKick = 0;
    let muzzleFlash = 0;
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
        gunPivot.rotation.set(lookPitch * .85, lookYaw * .85, 0, 'YXZ');
        gunPivot.position.z = -0.62 + muzzleKick * .13;
        flashMesh.visible = muzzleFlash > 0;
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
    function setPilotWeapon(spec) {
        const barrel = cockpit.userData.gunBarrel;
        const breech = cockpit.userData.gunBreech;
        gunPivot.visible = !!spec;
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
        raycaster.far = 70;
        const visible = raycaster.intersectObjects([...targetExterior.pickMeshes, ...worldSolids], false)[0];
        const aimPoint = visible ? visible.point : camera.position.clone().addScaledVector(sightDir, 70);
        const muzzle = gunPivot.localToWorld(new THREE.Vector3(0, -.04, muzzleZ + .62));
        const bore = aimPoint.clone().sub(muzzle).normalize();
        raycaster.set(muzzle, bore);
        raycaster.far = 70;
        const actual = raycaster.intersectObjects([...targetExterior.pickMeshes, ...worldSolids], false)[0];
        const point = actual ? actual.point.clone() : muzzle.clone().addScaledVector(bore, 70);
        const surfaceNormal = actual?.face
            ? actual.face.normal.clone().transformDirection(actual.object.matrixWorld)
            : bore.clone().negate();
        const slot = actual?.object.userData.slot;
        return { slot: slot ?? null, point, normal: surfaceNormal, muzzle, distance: muzzle.distanceTo(point) };
    }
    function showShot(contact, hit) {
        muzzleKick = Math.min(1, muzzleKick + .8);
        muzzleFlash = .10;
        const track = new THREE.BufferGeometry().setFromPoints([contact.muzzle, contact.point]);
        const trackMat = new THREE.LineBasicMaterial({ color: hit ? 0xf4c77e : 0xc7a76f, transparent: true, opacity: .92 });
        const tracer = new THREE.Line(track, trackMat);
        tracer.frustumCulled = false;
        scene.add(tracer);
        transientFX.push({ object: tracer, remaining: .14, duration: .14, material: trackMat });
        const sparkMat = new THREE.MeshBasicMaterial({ color: hit ? 0xffbc64 : 0xd2ad74, transparent: true, opacity: .9 });
        const spark = new THREE.Mesh(new THREE.IcosahedronGeometry(hit ? .14 : .08, 0), sparkMat);
        spark.position.copy(contact.point).addScaledVector(contact.normal, .035);
        scene.add(spark);
        transientFX.push({ object: spark, remaining: .20, duration: .20, material: sparkMat });
        if (hit) {
            // World impact converted to target-local mark, so the scar belongs to
            // the struck assembly's machine and stays put when viewed from any angle.
            const soot = new THREE.Mesh(new THREE.IcosahedronGeometry(.075, 0), new THREE.MeshBasicMaterial({ color: 0x171c19, depthWrite: false }));
            targetExterior.root.updateWorldMatrix(true, false);
            soot.position.copy(targetExterior.root.worldToLocal(contact.point.clone().addScaledVector(contact.normal, .045)));
            rangeMarks.add(soot);
            sootMarks.push(soot);
            if (sootMarks.length > 26) {
                const oldest = sootMarks.shift();
                rangeMarks.remove(oldest);
                oldest.geometry.dispose();
                oldest.material.dispose();
            }
        }
    }
    function updateTargetDamage(condition) {
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
    }
    function resetTargetDamage(condition) {
        while (sootMarks.length) {
            const mark = sootMarks.pop();
            rangeMarks.remove(mark);
            mark.geometry.dispose();
            mark.material.dispose();
        }
        updateTargetDamage(condition);
    }
    function updateCombatEffects(dt) {
        muzzleKick = Math.max(0, muzzleKick - dt * 5);
        muzzleFlash = Math.max(0, muzzleFlash - dt);
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
    }
    selectPart(selected);
    return {
        scene, camera, cockpit, debugColliders,
        updateRigVisual, setInspection, rebuildAssembly, selectPart, focusPart,
        orbitBy, panBy, setInspectorLayout, zoomBy, resetOrbit, pickPart,
        traceShot, showShot, updateTargetDamage, resetTargetDamage, updateCombatEffects, setPilotWeapon,
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
    const solids = [];
    const floor = box(50, 0.35, 36, mat(C.concreteDark, 1, 0));
    floor.position.y = -0.18;
    scene.add(floor);
    solids.push(floor);
    const grid = new THREE.GridHelper(48, 24, 0x4d4a3e, 0x34342f);
    grid.position.y = 0.01;
    scene.add(grid);
    const wallMat = mat(C.concrete, 0.98, 0.02);
    const wallThickness = 0.55;
    const wallHeight = 8;
    const north = box(50, wallHeight, wallThickness, wallMat);
    north.position.set(0, wallHeight / 2, -17);
    scene.add(north);
    solids.push(north);
    const south = box(50, wallHeight, wallThickness, wallMat);
    south.position.set(0, wallHeight / 2, 17);
    scene.add(south);
    solids.push(south);
    const west = box(wallThickness, wallHeight, 34, wallMat);
    west.position.set(-24, wallHeight / 2, 0);
    scene.add(west);
    solids.push(west);
    const east = west.clone();
    east.position.x = 24;
    scene.add(east);
    solids.push(east);
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
        solids.push(object);
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
            solids.push(column);
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
    return new THREE.Mesh(geometry, material);
}
