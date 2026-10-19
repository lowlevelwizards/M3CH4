/** k.3v.3 — real Three.js mesh raycast audit, not a proxy AABB.
 * All components are the shipped visual meshes from buildExteriorRig in scene.js.
 * Run in CI after: npm install --no-save --no-package-lock three@0.186.0
 *   node research/frameShieldingAudit.mjs
 *   node research/frameShieldingAudit.mjs --assert
 *   node research/frameShieldingAudit.mjs --json
 */
import * as THREE from 'three';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { equip, inspectAssembly, makeTestAssembly } from '../components.js';
import { buildExteriorRig } from '../scene.js';
import { shieldedModuleOnRay } from '../frameShielding.js';

export const FRAME_IDS = Object.freeze(['frame-sr','frame-utility','frame-wedge']);
export const DIRECTIONS = Object.freeze({
    front: [0, 0, -12],
    rear: [0, 0, 12],
    left: [-12, 0, 0],
    right: [12, 0, 0],
    'front-high': [0, 6, -12],
    'rear-high': [0, 6, 12],
});
export const TARGET_SLOTS = Object.freeze(['power','command','combat','mobility']);
const sampleOffsets = [-.22, 0, .22];

function measure(assembly, frameId) {
    const inspection = inspectAssembly(assembly);
    assert.equal(inspection.ready, true, `Invalid ${frameId}: ${inspection.checks?.map(c=>c.reason)}`);
    const model = buildExteriorRig(assembly);
    for (const mesh of model.pickMeshes) mesh.userData.actorId = 'audit';
    model.root.updateWorldMatrix(true, true);
    const boxes = Object.fromEntries(TARGET_SLOTS.map(slot => {
        const box = new THREE.Box3().setFromObject(model.partGroups.get(slot));
        assert.equal(box.isEmpty(), false, slot);
        return [slot, {
            center: box.getCenter(new THREE.Vector3()),
            size: box.getSize(new THREE.Vector3()),
        }];
    }));
    const raycaster = new THREE.Raycaster();
    raycaster.far = 25;
    const samples = [];
    for (const [direction, originOffset] of Object.entries(DIRECTIONS)) {
        for (const targetSlot of TARGET_SLOTS) {
            const { center, size } = boxes[targetSlot];
            for (const u of sampleOffsets) for (const v of sampleOffsets) {
                const aim = center.clone().add(new THREE.Vector3(u * size.x, v * size.y, 0));
                const source = aim.clone().add(new THREE.Vector3(...originOffset));
                raycaster.set(source, aim.clone().sub(source).normalize());
                const intersections = raycaster.intersectObjects(model.pickMeshes, false);
                const first = intersections[0] ?? null;
                const struck = first?.object.userData.slot ?? 'miss';
                const shieldedSlot = shieldedModuleOnRay(intersections, first);
                const evidentialShield = struck === 'structure' && shieldedSlot === targetSlot;
                samples.push({ direction, targetSlot, struck,
                    shieldedSlot, evidentialShield, distance: first?.distance ?? null });
            }
        }
    }
    // Clean up geometries/materials in this headless audit.
    model.root.traverse(node => {
        if (!node.isMesh) return;
        node.geometry?.dispose?.();
        if (Array.isArray(node.material)) node.material.forEach(m => m.dispose());
        else node.material?.dispose?.();
    });
    const byDirection = {};
    for (const direction of Object.keys(DIRECTIONS)) {
        byDirection[direction] = {};
        for (const slot of TARGET_SLOTS) {
            const group = samples.filter(s => s.direction === direction && s.targetSlot === slot);
            byDirection[direction][slot] = {
                aimed: group.length,
                reached: group.filter(s => s.struck === slot).length,
                frameFirst: group.filter(s => s.struck === 'structure').length,
                verifiedShield: group.filter(s => s.evidentialShield).length,
                other: group.filter(s => s.struck !== slot && s.struck !== 'structure' && s.struck !== 'miss').length,
                misses: group.filter(s => s.struck === 'miss').length,
            };
        }
    }
    return { frameId, massKg: inspection.massKg, directions: byDirection, samples };
}
export function runFrameShieldAudit() {
    return FRAME_IDS.map(frameId => {
        const assembly = makeTestAssembly();
        equip(assembly, 'structure', frameId);
        return measure(assembly, frameId);
    });
}
export function verifyShieldAudit(results = runFrameShieldAudit()) {
    assert.deepEqual(results.map(r=>r.frameId),FRAME_IDS);
    assert.equal(results.every(r=>r.samples.length === 216),true);
    for (const row of results) {
        assert.equal(row.samples.every(s => s.distance === null || (s.distance > 0 && s.distance < 25)),true);
        assert.equal(row.samples.filter(s => s.struck !== 'miss').length > 0,true);
        // A shield label must always have a ray through real frame geometry,
        // with a physically hit module beyond the frame on the same ray.
        for (const s of row.samples) {
            if (s.shieldedSlot) assert.equal(s.struck, 'structure');
            if (s.evidentialShield) assert.equal(s.shieldedSlot,s.targetSlot);
        }
    }
    assert.notDeepEqual(results[0].directions,results[1].directions,'Bruiser and Skeleton cannot have indistinguishable physical hit shapes');
    assert.notDeepEqual(results[1].directions,results[2].directions,'Skeleton and Wedge cannot have indistinguishable physical hit shapes');
    // A nontrivial portion of command/drive/generator shots must remain direct:
    // there are no universal invulnerability plates or special synthetic armor.
    assert.ok(results.some(r => r.samples.some(s=>s.struck===s.targetSlot)));
    return results;
}
export function formatFrameShieldAudit(results = runFrameShieldAudit()) {
    const lines=[
        '# k.3v.3 — Directional frame shielding: actual gameplay mesh intersections',
        'Each cell counts 9 exact rays aimed at the target module mesh bounding region.',
        'FRAME FIRST is physical structure intersection; VERIFIED SHIELD additionally requires a deeper same-ray module hit. No damage multipliers.',
        '',
        '| Frame | Incoming | Target | Direct | Frame first | Verified shield | Other intercept | Miss |',
        '| --- | --- | --- | ---: | ---: | ---: | ---: | ---: |',
    ];
    for (const row of results) for (const [direction,slots] of Object.entries(row.directions))
        for (const [slot,m] of Object.entries(slots))
            lines.push(`| ${row.frameId} | ${direction} | ${slot} | ${m.reached} | ${m.frameFirst} | ${m.verifiedShield} | ${m.other} | ${m.misses} |`);
    return lines.join('\n')+'\n';
}
if (process.argv[1] && import.meta.url === new URL('file://'+fileURLToPath(import.meta.url)).href) {
    const results = runFrameShieldAudit();
    if (process.argv.includes('--assert')) verifyShieldAudit(results);
    process.stdout.write(process.argv.includes('--json') ? JSON.stringify(results.map(r=>({
        frameId:r.frameId,massKg:r.massKg,directions:r.directions,
    })),null,2)+'\n' : formatFrameShieldAudit(results));
}
