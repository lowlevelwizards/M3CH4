/** k.3a isolated greybox and debug visual kit. No game scene or physics imports.
 * Schematic shapes are placeholders; the actual old in-game models remain intact.
 */
import * as THREE from 'three';
import { SOCKET_ROLE_COLORS, SOCKET_RADII } from './chassisDefinitions.js';

const material = (color, metalness = .18) => new THREE.MeshStandardMaterial({
    color, metalness, roughness: .83, flatShading: true,
});
const IRON = material(0x414a49, .37);
const STEEL = material(0x768079, .30);
const PAINT = material(0xb18d42);
const PALE = material(0xc2c0ac);

function cuboid(parent, dimensions, center, mat = IRON) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...dimensions), mat);
    mesh.position.set(...center);
    parent.add(mesh);
    return mesh;
}
function beam(parent, start, end, width = .14, mat = IRON) {
    const a = new THREE.Vector3(...start), b = new THREE.Vector3(...end);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, a.distanceTo(b), width), mat);
    mesh.position.copy(a.clone().add(b).multiplyScalar(.5));
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.sub(a).normalize());
    parent.add(mesh);
    return mesh;
}

/** First greybox renderer contract: descriptor in, named group out.
 * It renders ONLY the central structure, never attached legs/cab/generator/gun.
 */
export function buildChassisProxy(frame) {
    const root = new THREE.Group();
    root.name = `preview-chassis:${frame.id}`;
    const [w, h, d] = frame.bounds;
    if (frame.profile === 'block') {
        cuboid(root, [w * .82, h * .76, d * .82], [0, 0, 0], IRON);
        cuboid(root, [w * .83, h * .19, d * .78], [0, h * .31, 0], PAINT);
        cuboid(root, [w * .9, h * .16, d * .72], [0, -h * .34, 0], STEEL);
    } else if (frame.profile === 'open-rails') {
        for (const x of [-w * .33, w * .33])
            cuboid(root, [.17, h * .52, d * .95], [x, 0, 0], IRON);
        for (const z of [-d * .38, 0, d * .38])
            cuboid(root, [w * .75, .14, .16], [0, h * .18, z], PAINT);
        cuboid(root, [.34, h * .8, .30], [0, 0, 0], STEEL);
        for (const x of [-w * .32, w * .32])
            beam(root, [x, h * .24, -d * .40], [x * .53, -h * .30, d * .39], .10, STEEL);
    } else if (frame.profile === 'wedge') {
        // Intentionally primitive sloped structural volume, NOT revised armor art.
        const geo = new THREE.BufferGeometry();
        const wf = w * .39, wr = w * .47, front = -d * .45, rear = d * .45;
        const verts = new Float32Array([
            -wf,-h*.37,front, wf,-h*.37,front, wf,h*.03,front, -wf,h*.03,front,
            -wr,-h*.37,rear, wr,-h*.37,rear, wr,h*.37,rear, -wr,h*.37,rear,
        ]);
        const indices = [0,2,1,0,3,2,4,5,6,4,6,7,0,4,7,0,7,3,1,2,6,1,6,5,3,7,6,3,6,2,0,1,5,0,5,4];
        geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
        geo.setIndex(indices);
        const faceted = geo.toNonIndexed(); faceted.computeVertexNormals(); geo.dispose();
        root.add(new THREE.Mesh(faceted, PALE));
        cuboid(root, [w * .70, .10, d * .70], [0, -h * .34, 0], IRON);
    } else throw new Error(`Unknown chassis preview shape: ${frame.profile}`);
    // Tiny illustrative paired hip bosses are visual-only. Their lateral positions
    // are derived from the envelope, and are NOT extra attachment sockets.
    const boss = new THREE.CylinderGeometry(.19, .19, .16, 10);
    for (const side of [-1, 1]) {
        const mesh = new THREE.Mesh(boss, STEEL);
        mesh.rotation.z = Math.PI / 2;
        mesh.position.set(side * (w * .43), -h * .30, 0);
        root.add(mesh);
    }
    root.userData.kind = 'schematic-preview-only';
    return root;
}

export function buildSocketGizmos(frame) {
    const root = new THREE.Group();
    root.name = `preview-sockets:${frame.id}`;
    for (const socket of frame.sockets) {
        const marker = new THREE.Group();
        marker.name = `socket:${socket.id}`;
        marker.position.set(...socket.position);
        marker.userData.socketId = socket.id;
        const color = SOCKET_ROLE_COLORS[socket.roleHint];
        const radius = SOCKET_RADII[socket.standard];
        const mat = new THREE.MeshBasicMaterial({ color, depthTest: false });
        // A simple 3D band reads from every angle, without arbitrary machinery.
        const sphere = new THREE.Mesh(new THREE.SphereGeometry(radius * .54, 10, 6), mat);
        sphere.userData.socketId = socket.id;
        const band = new THREE.Mesh(new THREE.TorusGeometry(radius, radius * .17, 5, 12), mat);
        band.userData.socketId = socket.id;
        band.rotation.y = Math.PI / 4;
        // Large transparent pick volume: mobile taps should not require aiming
        // precisely at the visible small mounting marker.
        const pick = new THREE.Mesh(
            new THREE.SphereGeometry(Math.max(.24, radius * 1.6), 10, 6),
            new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
        );
        pick.userData.socketId = socket.id;
        marker.add(sphere, band, pick);
        root.add(marker);
    }
    return root;
}
