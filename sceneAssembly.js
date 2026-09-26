/** 0.0.1k.2: Thin graph-to-Three bridge around the unchanged j.2 arena scene.
 * Kept separate so j.2 hostile pathfinding, weapon tracing and pooled effects
 * are not copied or forked into a second large renderer. */
import * as THREE from 'three';
import { createArenaScene as createBaseArenaScene } from './scene.js?source=j2';
import { assemblyGraph, BY_ID, graphWorldPoses, installedPart, SLOT_CENTERS } from './components.js';

let active = null;
export function activePlayerArena() { return active; }

function findPartGroup(scene, slot, serial) {
    if (!serial) return null;
    let found = null;
    scene.traverse(object => {
        if (object.type === 'Group' && object.name.startsWith(`${slot}: `) &&
            object.name.endsWith(`(${serial})`)) found = object;
    });
    return found;
}

function bar(w, h, d, material, x, y, z) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    return mesh;
}

/** Apply graph-composed poses to existing real owned component meshes. The
 * collider/picking code keeps these SAME meshes, so relocated generators really
 * occupy a new hittable position; no duplicate cosmetic model is created. */
function alignAssemblyMeshes(arena, assembly) {
    const frame = installedPart(assembly, 'structure');
    if (!frame) return;
    const graph = assemblyGraph(assembly);
    const poses = graphWorldPoses(graph, BY_ID, frame.definition.center);
    const hull = findPartGroup(arena.scene, 'structure', frame.instance.serial);
    if (!hull) throw new Error('Could not locate the rendered structural frame.');
    for (const slot of ['mobility', 'power', 'command', 'combat']) {
        const installed = installedPart(assembly, slot);
        const group = findPartGroup(arena.scene, slot, installed?.instance.serial);
        const pose = poses.get(installed?.instance.serial);
        if (!group || !pose) continue;
        if (group.parent !== hull) hull.attach(group);
        group.position.set(...pose.position.map((n, i) => n - frame.definition.center[i]));
        group.rotation.set(0, pose.rotationQuarterTurns * Math.PI / 2, 0);
    }
    // Hardware is rendered ONLY if it appears as a genuine adapter in the graph.
    // It is attached to the structural frame, not to the generator's scene mesh.
    const generator = installedPart(assembly, 'power');
    const serial = generator?.instance.serial;
    const bracketId = `BK-${serial}`;
    if (serial && graph.nodes[bracketId]) {
        const bracketPose = poses.get(bracketId);
        if (!bracketPose) throw new Error('Bracket is disconnected from its frame.');
        const bracket = new THREE.Group();
        bracket.name = `structural bracket: ${bracketId}`;
        bracket.position.set(...bracketPose.position.map((n, i) => n - frame.definition.center[i]));
        bracket.rotation.y = bracketPose.rotationQuarterTurns * Math.PI / 2;
        const iron = new THREE.MeshStandardMaterial({ color: 0x57605a, roughness: .89, metalness: .23 });
        const ochre = new THREE.MeshStandardMaterial({ color: 0x9e793c, roughness: .86, metalness: .12 });
        bracket.add(bar(.77, .13, .16, iron, -.04, -.045, -.12));
        bracket.add(bar(.77, .13, .16, iron, -.04, -.045, .12));
        bracket.add(bar(.19, .20, .43, ochre, -.31, .03, 0));
        bracket.add(bar(.19, .17, .39, iron, .21, -.02, 0));
        hull.add(bracket);
    }
    arena.scene.updateMatrixWorld(true);
}

export function createArenaScene(assembly, targetAssembly) {
    const arena = createBaseArenaScene(assembly, targetAssembly);
    const rebuild = arena.rebuildAssembly.bind(arena);
    const focus = arena.focusPart.bind(arena);
    const hostileShot = arena.traceHostileShot.bind(arena);
    function adjustedPowerCenter() {
        const power = installedPart(assembly, 'power');
        const frame = installedPart(assembly, 'structure');
        if (!power || !frame) return null;
        return graphWorldPoses(assemblyGraph(assembly), BY_ID, frame.definition.center)
            .get(power.instance.serial)?.position ?? null;
    }
    function withAccurateAimCenter(slot, callback) {
        // j.2's camera focus and hostile aiming still read SLOT_CENTERS. Temporarily
        // supply the graph pose for this one call; leave the shared baseline untouched.
        const center = slot === 'power' ? adjustedPowerCenter() : null;
        if (!center) return callback();
        const original = SLOT_CENTERS.power.slice();
        SLOT_CENTERS.power.splice(0, 3, ...center);
        try { return callback(); }
        finally { SLOT_CENTERS.power.splice(0, 3, ...original); }
    }
    arena.rebuildAssembly = next => {
        rebuild(next);
        alignAssemblyMeshes(arena, next);
    };
    arena.focusPart = slot => withAccurateAimCenter(slot, () => focus(slot));
    arena.traceHostileShot = (state, slot, ...args) => withAccurateAimCenter(slot,
        () => hostileShot(state, slot, ...args));
    // The original main.js calls rebuildAssembly before the garage is displayed.
    // Retain the original scene's complete enemy nav and combat behavior.
    active = { arena, assembly };
    return arena;
}
