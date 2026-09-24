import * as THREE from 'three';
import { DEFAULT_WORLD } from './locomotion.js';
const C = {
    concrete: 0x777267,
    concreteDark: 0x4d4b45,
    yellow: 0xa9822f,
    teal: 0x2f7473,
    metal: 0x343a39,
    dark: 0x151816,
    rust: 0x8a4d2d,
    amber: 0xe0a44c,
    green: 0x6ea778,
};
export function createArenaScene() {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x171915);
    scene.fog = new THREE.FogExp2(0x171915, 0.018);
    const camera = new THREE.PerspectiveCamera(72, 1, 0.06, 95);
    camera.rotation.order = 'YXZ';
    const hemi = new THREE.HemisphereLight(0xb2b59d, 0x26231d, 1.1);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffd69a, 2.1);
    sun.position.set(-7, 12, 8);
    scene.add(sun);
    buildWarehouse(scene);
    const cockpit = buildCockpit(scene);
    const debugColliders = buildDebugColliders(scene);
    debugColliders.visible = false;
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
        cockpit.position.set(visualX, 0, visualZ);
        cockpit.rotation.set(cockpitPitch, visualYaw, cockpitRoll, 'YXZ');
        camera.position.set(visualX, 2.42 + cockpitHeave, visualZ);
        camera.rotation.set(lookPitch + cockpitPitch * 0.35, visualYaw + lookYaw, cockpitRoll * 0.25, 'YXZ');
    }
    return { scene, camera, cockpit, debugColliders, updateRigVisual };
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
