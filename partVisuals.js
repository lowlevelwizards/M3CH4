/** First shared M3CH4 part model. Gameplay and preview use the same authored
 * Yardwalker geometry. Other parts deliberately retain their existing paths.
 * This is a small registry, not a procedural generator or a new assembly graph.
 */
import { fitFixtureFor } from './chassisFitFixtures.js';
import { buildYardwalkerVisual } from './yardwalkerVisual.js';

const BUILDERS = Object.freeze({
    'legs-yard': buildYardwalkerVisual,
});

export const SHARED_PART_IDS = Object.freeze(Object.keys(BUILDERS));

/** Build an unpositioned part in catalogue-envelope-local coordinates.
 * Return null for parts not yet migrated. Every call returns fresh geometry.
 * A gameplay instance owns its material clones so damage and selection cannot
 * recolor another machine or a preview; preview retains the kit's materials.
 */
export function buildPartVisual(definitionId, { mode = 'preview' } = {}) {
    const builder = BUILDERS[definitionId];
    if (!builder) return null;
    if (mode !== 'preview' && mode !== 'gameplay')
        throw new Error(`Unknown part visual mode: ${mode}`);

    // The live catalogue, rather than an additional visual balance sheet,
    // supplies the envelope and mounting facts to the authored constructor.
    const fixture = fitFixtureFor(definitionId);
    if (!fixture) throw new Error(`Missing catalogue-backed fixture: ${definitionId}`);
    const root = builder(fixture);
    if (mode === 'preview') return root;

    // Selection wireframes are editor-only, not meshes for shots or inspection.
    const outline = root.userData.outline;
    if (outline) {
        root.remove(outline);
        outline.geometry.dispose();
        delete root.userData.outline;
    }

    const ownedMaterials = new Map();
    const isolate = material => {
        if (!ownedMaterials.has(material)) ownedMaterials.set(material, material.clone());
        return ownedMaterials.get(material);
    };
    root.traverse(node => {
        if (!node.isMesh) return;
        node.material = Array.isArray(node.material)
            ? node.material.map(isolate)
            : isolate(node.material);
    });
    root.userData.previewOnly = false;
    root.userData.gameplayVisual = true;
    return root;
}
