/** k.3a.4 -- source-backed, PREVIEW-ONLY equipment envelopes and mounting faces.
 * These are simple fit maquettes, not copied game meshes or new owned parts.
 * Coordinates are component-local metres: +X right, +Y up, -Z forward.
 */
import { BY_ID } from './components.js';

export const DEFAULT_MOBILITY_FIXTURE_ID='legs-yard';
export const AVAILABLE_MOBILITY_FIXTURE_IDS=Object.freeze(['legs-yard','legs-compact']);
export const STANDARD_FIT_IDS = Object.freeze([
    DEFAULT_MOBILITY_FIXTURE_ID, 'cab-cyclops', 'power-dynamo', 'gun-cannon',
]);

const MOUNT_FACES = Object.freeze({
    'legs-yard': { socketId: 'mobility', faceNormal: [0, 1, 0], face: 'upper paired-mobility input', forward: [0, 0, -1] },
    'legs-compact': { socketId: 'mobility', faceNormal: [0, 1, 0], face: 'upper paired-mobility input', forward: [0, 0, -1] },
    'cab-cyclops': { socketId: 'command', faceNormal: [0, -1, 0], face: 'cab underside', forward: [0, 0, -1] },
    'power-dynamo': { socketId: 'power', faceNormal: [0, 0, -1], face: 'generator forward mounting plate', forward: [0, 0, -1] },
    'gun-cannon': { socketId: 'combat', faceNormal: [-1, 0, 0], face: 'weapon left-side trunnion mount', forward: [0, 0, -1] },
});

function faceCenter(normal, bounds) {
    return normal.map((direction, axis) => direction * bounds[axis] / 2);
}

/** No duplicated envelope or mass constants: catalog data is authoritative. */
export function fitFixtureFor(definitionId) {
    const physical = BY_ID.get(definitionId);
    const face = MOUNT_FACES[definitionId];
    if (!face || !physical || !['mobility', 'command', 'power', 'combat'].includes(physical.slot)) return null;
    const envelope = physical.envelope.slice();
    return {
        id: definitionId, name: physical.name, slot: physical.slot,
        envelope, massKg: physical.massKg,
        standard: physical.mountSize,
        socketId: face.socketId,
        face: face.face,
        mountNormal: face.faceNormal.slice(),
        mountPoint: faceCenter(face.faceNormal, envelope),
        forward: face.forward.slice(),
        construction: 'envelope-based concept fixture, not the live detailed model',
    };
}

export function standardFitIds({mobilityId=DEFAULT_MOBILITY_FIXTURE_ID}={}){
    const picked=AVAILABLE_MOBILITY_FIXTURE_IDS.includes(mobilityId)?mobilityId:DEFAULT_MOBILITY_FIXTURE_ID;
    return [picked,'cab-cyclops','power-dynamo','gun-cannon'];
}
export function standardFitFixtures(options={}) {
    return standardFitIds(options).map(fitFixtureFor);
}
