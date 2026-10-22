/** Shared M3CH4 mobility, weapon and command models. Gameplay and preview use the same authored
 * geometry for every current mobility family. This remains a deliberately tiny
 * registry, not a procedural generator or a second assembly graph.
 */
import { fitFixtureFor } from './chassisFitFixtures.js';
import { applyPartFinish } from './partFinish.js';
import { buildYardwalkerVisual } from './yardwalkerVisual.js';
import { buildKestrelVisual } from './kestrelVisual.js';
import { buildHaulerVisual } from './haulerVisual.js';
import { buildTrainingCannonVisual } from './trainingCannonVisual.js';
import { buildStumpCannonVisual } from './stumpCannonVisual.js';
import { buildNeedleCannonVisual } from './needleCannonVisual.js';
import { buildScattergunVisual } from './scattergunVisual.js';
import { buildRivetRepeaterVisual } from './rivetRepeaterVisual.js';
import { buildBreakerDriverVisual } from './breakerDriverVisual.js';
import { buildScrapRocketVisual } from './scrapRocketVisual.js';
import { buildArcCutterVisual } from './arcCutterVisual.js';
import { buildCyclopsVisual } from './cyclopsVisual.js';
import { buildVistaVisual } from './vistaVisual.js';
import { buildHearthVisual } from './hearthVisual.js';
import { buildBruiserFrameVisual } from './bruiserFrameVisual.js';
import { buildSkeletonFrameVisual } from './skeletonFrameVisual.js';
import { buildWedgeFrameVisual } from './wedgeFrameVisual.js';
import { buildForgePowerVisual } from './forgePowerVisual.js';

const BUILDERS = Object.freeze({
    'frame-sr': buildBruiserFrameVisual,
    'frame-utility': buildSkeletonFrameVisual,
    'frame-wedge': buildWedgeFrameVisual,
    'legs-yard': buildYardwalkerVisual,
    'legs-compact': buildKestrelVisual,
    'legs-hauler': buildHaulerVisual,
    'gun-cannon': buildTrainingCannonVisual,
    'gun-short': buildStumpCannonVisual,
    'gun-light': buildNeedleCannonVisual,
    'gun-scatter': buildScattergunVisual,
    'gun-rivet': buildRivetRepeaterVisual,
    'gun-breaker': buildBreakerDriverVisual,
    'gun-rocket': buildScrapRocketVisual,
    'gun-arc': buildArcCutterVisual,
    'cab-cyclops': buildCyclopsVisual,
    'cab-utility': buildVistaVisual,
    'cab-armored': buildHearthVisual,
    'power-forge': buildForgePowerVisual,
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
    // supplies envelope, mass and mounting facts to the authored constructor.
    const fixture = fitFixtureFor(definitionId);
    if (!fixture) throw new Error(`Missing catalogue-backed fixture: ${definitionId}`);
    const root = builder(fixture);
    root.userData.definitionId = definitionId;
    // Preview models must show their actual individual factory finish too.
    // Repainting clones only eligible surfaces; the kit's shared templates stay intact.
    if (mode === 'preview') return applyPartFinish(root, definitionId);

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
