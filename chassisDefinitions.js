/** M3CH4 k.3a — audited, PREVIEW-ONLY chassis descriptors.
 * No writes to CATALOG, assembly graph, live mounts, owned inventory or saves.
 * All existing socket positions are copied from the authoritative game definitions.
 */
import { CATALOG } from './components.js';

export const CHASSIS_PREVIEW_VERSION = 1;
export const SOCKET_STANDARDS = Object.freeze(['light', 'medium', 'heavy']);
export const REQUIRED_FUNCTIONS = Object.freeze(['mobility', 'power', 'command', 'combat']);

// Concept families are design targets, NOT purchasable or implemented game parts.
export const PLANNED_FAMILIES = Object.freeze([
    { id: 'central-hub', name: 'Central Hub', structure: 'Concentrated load-bearing core' },
    { id: 'backbone', name: 'Backbone / Spine', structure: 'Longitudinal or upright structural column' },
    { id: 'twin-rail', name: 'Twin-Rail / Ladder', structure: 'Paired rails and transverse crossmembers' },
    { id: 'spaceframe', name: 'Spaceframe / Truss', structure: 'Open triangulated load paths' },
    { id: 'monocoque', name: 'Structural Tub / Monocoque', structure: 'A load-bearing enclosed shell' },
    { id: 'cradle', name: 'Cradle / Saddle', structure: 'U-shaped supporting frame with an internal bay' },
    { id: 'gantry', name: 'Offset Gantry / Cantilever', structure: 'An asymmetric, braced projecting support' },
    { id: 'distributed', name: 'Distributed / Bridged', structure: 'Two major load-bearing masses connected by a bridge' },
]);

// These are the three EXISTING playable frames. The preview's very simple
// schematic profile is NOT a replacement for their current scene.js artwork.
const EXISTING_PROFILES = Object.freeze({
    'frame-sr': 'block',
    'frame-utility': 'open-rails',
    'frame-wedge': 'wedge',
});

export const SOCKET_ROLE_COLORS = Object.freeze({
    command: 0xe2b13f, power: 0x829a66, mobility: 0xc47e5a,
    combat: 0x579a9c, utility: 0x858e94,
});
export const SOCKET_RADII = Object.freeze({ light: 0.095, medium: 0.15, heavy: 0.215 });

const xyz = p => Array.isArray(p) ? p.slice() : p;
export function previewDescriptorFor(frame) {
    if (!frame || frame.slot !== 'structure' || !EXISTING_PROFILES[frame.id])
        throw new Error('This build previews only the three existing chassis definitions.');
    return {
        previewVersion: CHASSIS_PREVIEW_VERSION,
        id: frame.id, name: frame.name, profile: EXISTING_PROFILES[frame.id],
        massKg: frame.massKg, loadLimitKg: frame.loadLimitKg,
        origin: xyz(frame.center), bounds: xyz(frame.envelope),
        sockets: frame.sockets.map(s => ({
            id: s.id, standard: s.standard, roleHint: s.roleHint,
            position: xyz(s.position), rotation: xyz(s.rotation),
            maxLoadKg: s.maxLoadKg,
            ...(s.rotationQuarterTurns !== undefined ? { rotationQuarterTurns: s.rotationQuarterTurns } : {}),
        })),
        // One old paired-leg installation node; separate hip bosses in the
        // preview are ILLUSTRATIVE, not independent playable sockets.
        mobilityController: 'paired-legacy',
        implementation: 'existing-game-frame-preview-only',
    };
}

export const EXISTING_CHASSIS = Object.freeze(
    CATALOG.filter(part => part.slot === 'structure').map(previewDescriptorFor)
);

export function validatePreviewChassis(frame) {
    const errors = [];
    if (!frame || !Array.isArray(frame.bounds) || frame.bounds.length !== 3 ||
        !frame.bounds.every(v => Number.isFinite(v) && v > 0))
        errors.push('Chassis envelope must have three positive finite dimensions.');
    if (!Array.isArray(frame?.origin) || frame.origin.length !== 3 || !frame.origin.every(Number.isFinite))
        errors.push('Chassis origin must be a finite XYZ position.');
    if (!Number.isFinite(frame?.massKg) || frame.massKg <= 0 ||
        !Number.isFinite(frame?.loadLimitKg) || frame.loadLimitKg <= 0)
        errors.push('Chassis mass and rated load must be positive.');
    if (frame?.mobilityController !== 'paired-legacy')
        errors.push('k.3a supports only the current paired-leg controller.');
    if (!Array.isArray(frame?.sockets)) return { valid: false, errors: [...errors, 'Sockets must be an array.'] };
    const ids = new Set();
    for (const s of frame.sockets) {
        if (!s || typeof s.id !== 'string' || !s.id || ids.has(s.id))
            errors.push(`Duplicate or missing socket identity: ${s?.id}.`);
        if (s?.id) ids.add(s.id);
        if (!SOCKET_STANDARDS.includes(s?.standard)) errors.push(`Unknown mounting standard: ${s?.id}.`);
        if (!Array.isArray(s?.position) || s.position.length !== 3 || !s.position.every(Number.isFinite))
            errors.push(`Non-finite position at ${s?.id}.`);
        if (!Number.isFinite(s?.maxLoadKg) || s.maxLoadKg <= 0)
            errors.push(`Invalid load rating at ${s?.id}.`);
        if (!Object.hasOwn(SOCKET_ROLE_COLORS, s?.roleHint))
            errors.push(`Unknown socket role at ${s?.id}.`);
    }
    for (const role of REQUIRED_FUNCTIONS)
        if (!frame.sockets.some(s => s.roleHint === role)) errors.push(`Missing ${role} attachment interface.`);
    return { valid: errors.length === 0, errors };
}

export function getExistingChassis(id) {
    return EXISTING_CHASSIS.find(frame => frame.id === id) ?? null;
}
