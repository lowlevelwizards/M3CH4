/** One locally owned rig, persisted without coupling storage to physics/rendering.
 * Save physical part identities, installed configuration, acute drive faults,
 * player armor/integrity, operating credits, and now the genuinely owned inventory.
 * Older save keys stay untouched so cached/rolled-back builds never read v5 data.
 */
import { BY_ID, installedPart, makeTestAssembly, SLOTS } from './components.js';
import { graphFromStations, graphMatchesStations, validateGraph, GRAPH_VERSION } from './assemblyGraph.js';
import { createFunctionalDamage } from './functionalDamage.js';
import { createTargetCondition } from './combat.js';
import { createEconomyState } from './economy.js';
import { hasStarterInventory, makeStarterAssembly, STARTER_DEFINITION_IDS } from './acquisition.js';

export const MACHINE_SAVE_KEY = 'mech-arena-machine-v1';
export const MACHINE_SAVE_V3_KEY = 'mech-arena-machine-v3';
export const MACHINE_SAVE_V4_KEY = 'mech-arena-machine-v4';
export const MACHINE_SAVE_V5_KEY = 'mech-arena-machine-v5';
export const MACHINE_SAVE_VERSION = 5; // Read v1-v4; write v5 separately for rollback.

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const fraction = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
const integer = value => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= 1_000_000;
const validSlot = value => SLOTS.includes(value);
const ownKeys = (value, allowed) => Object.keys(value).every(key => allowed.includes(key));
const clonePart = ({ serial, definitionId, condition, wear, repairs }) => ({ serial, definitionId, condition, wear, repairs });
const MAX_OWNED_PARTS = 100;

function fresh() {
    const assembly = makeStarterAssembly();
    return {
        assembly,
        damage: createFunctionalDamage(),
        playerCondition: createTargetCondition(assembly, true),
        economy: createEconomyState(),
    };
}

function validateSavedPart(saved, seenSerials, seenDefinitions = null) {
    if (!object(saved) || typeof saved.serial !== 'string' || saved.serial.length < 1 || saved.serial.length > 80 ||
        typeof saved.definitionId !== 'string' || !BY_ID.has(saved.definitionId) || seenSerials.has(saved.serial) ||
        !fraction(saved.condition) || !fraction(saved.wear) || !integer(saved.repairs))
        throw new Error('Invalid part');
    if (seenDefinitions && seenDefinitions.has(saved.definitionId))
        throw new Error('Duplicate owned definition');
    seenSerials.add(saved.serial);
    seenDefinitions?.add(saved.definitionId);
}

/** v1-v4 treated every catalogue definition as owned. On migration, keep the real
 * starter set plus anything actually fitted (or still represented by a saved housing
 * state). This preserves the player's current machine without grandfathering every
 * unused developer-sandbox alternative into the progression inventory. */
function migrateLegacyOwned(data) {
    const savedAssembly = data.assembly;
    const legacy = makeTestAssembly();
    if (savedAssembly.owned.length > legacy.owned.length)
        throw new Error('Unknown legacy inventory');
    const legacyBySerial = new Map(legacy.owned.map(part => [part.serial, part]));
    const savedBySerial = new Map();
    const seen = new Set();
    for (const saved of savedAssembly.owned) {
        validateSavedPart(saved, seen);
        const baseline = legacyBySerial.get(saved.serial);
        if (!baseline || baseline.definitionId !== saved.definitionId)
            throw new Error('Unrecognized legacy part identity');
        savedBySerial.set(saved.serial, saved);
    }

    const keepSerials = new Set(Object.values(savedAssembly.installed).filter(serial => typeof serial === 'string'));
    if (object(data.housing)) {
        for (const housing of Object.values(data.housing))
            if (object(housing) && typeof housing.serial === 'string') keepSerials.add(housing.serial);
    }
    for (const definitionId of STARTER_DEFINITION_IDS) {
        const baseline = legacy.owned.find(part => part.definitionId === definitionId);
        if (baseline) keepSerials.add(baseline.serial);
    }

    const retained = [];
    for (const baseline of legacy.owned) {
        if (!keepSerials.has(baseline.serial)) continue;
        const saved = savedBySerial.get(baseline.serial);
        retained.push(saved ? clonePart(saved) : clonePart(baseline));
    }
    return retained;
}

function restoreOwned(data) {
    const saved = data.assembly.owned;
    if (!Array.isArray(saved) || saved.length < 1 || saved.length > MAX_OWNED_PARTS)
        throw new Error('Invalid owned inventory');
    if (data.version < MACHINE_SAVE_VERSION)
        return migrateLegacyOwned(data);
    const seenSerials = new Set();
    const seenDefinitions = new Set();
    const owned = [];
    for (const part of saved) {
        validateSavedPart(part, seenSerials, seenDefinitions);
        owned.push(clonePart(part));
    }
    return owned;
}

/** Pure decoder: invalid input always falls back to a clean starter rig. */
export function decodeMachine(json) {
    const blank = fresh();
    if (json === null)
        return { ...blank, status: 'fresh' };
    if (json.length > 120_000)
        return { ...blank, status: 'invalid' };
    try {
        const data = JSON.parse(json);
        if (!object(data) || ![1, 2, 3, 4, MACHINE_SAVE_VERSION].includes(data.version) || !object(data.assembly) ||
            !object(data.drives) || !object(data.housing))
            throw new Error('Unknown save format');
        const savedAssembly = data.assembly;
        if (savedAssembly.serial !== blank.assembly.serial || !Array.isArray(savedAssembly.owned) ||
            !object(savedAssembly.installed))
            throw new Error('Unknown rig');

        const assembly = makeStarterAssembly();
        assembly.owned = restoreOwned(data);
        if (!hasStarterInventory(assembly))
            throw new Error('Starter recovery inventory missing');
        const ownedBySerial = new Map(assembly.owned.map(part => [part.serial, part]));

        // Missing keys mean deliberately uninstalled modules, never the default loadout.
        if (!ownKeys(savedAssembly.installed, SLOTS))
            throw new Error('Invalid station');
        const installed = {};
        const installedSerials = new Set();
        for (const [slot, serial] of Object.entries(savedAssembly.installed)) {
            const part = typeof serial === 'string' ? ownedBySerial.get(serial) : undefined;
            if (!validSlot(slot) || !part || BY_ID.get(part.definitionId)?.slot !== slot || installedSerials.has(serial))
                throw new Error('Invalid installed reference');
            installedSerials.add(serial);
            installed[slot] = serial;
        }
        assembly.installed = installed;

        if (data.version === 1) {
            assembly.graph = graphFromStations(assembly, BY_ID);
        } else {
            // Never repair a corrupt graph by silently rebuilding it from slots.
            if (!object(savedAssembly.graph) || savedAssembly.graph.version !== GRAPH_VERSION ||
                !object(savedAssembly.graph.nodes) || Object.keys(savedAssembly.graph.nodes).length > assembly.owned.length + 2)
                throw new Error('Invalid graph payload');
            const graph = savedAssembly.graph;
            if (typeof graph.root !== 'string' && graph.root !== null)
                throw new Error('Invalid root reference');
            const allowed = ['serial', 'definitionId', 'parentSerial', 'parentSocket',
                'rotationQuarterTurns', 'virtual', 'staged'];
            for (const [key, node] of Object.entries(graph.nodes)) {
                if (!object(node) || !ownKeys(node, allowed) || node.serial !== key ||
                    typeof node.definitionId !== 'string' ||
                    !(typeof node.parentSerial === 'string' || node.parentSerial === null) ||
                    !(typeof node.parentSocket === 'string' || node.parentSocket === null) ||
                    !integer(node.rotationQuarterTurns) || node.rotationQuarterTurns > 3 ||
                    (node.virtual !== undefined && node.virtual !== true) ||
                    (node.staged !== undefined && node.staged !== true))
                    throw new Error('Invalid graph node');
            }
            if (!graphMatchesStations(assembly, graph, BY_ID))
                throw new Error('Graph and installed stations disagree');
            assembly.graph = graph;
        }
        const verdict = validateGraph(assembly.graph, assembly, BY_ID);
        if (!verdict.valid)
            throw new Error(verdict.errors.join('; '));

        const damage = createFunctionalDamage();
        for (const [serial, value] of Object.entries(data.drives)) {
            if (!object(value) || !fraction(value.left) || !fraction(value.right))
                throw new Error('Invalid drive sections');
            const owned = ownedBySerial.get(serial);
            if (!owned || BY_ID.get(owned.definitionId)?.slot !== 'mobility') {
                if (data.version < MACHINE_SAVE_VERSION) continue; // dropped sandbox-only part
                throw new Error('Drive damage references unowned mobility');
            }
            damage.drives[serial] = { left: value.left, right: value.right };
        }

        // Hit representation requires five parts even when a station is empty. Starter
        // modules are permanent owned fallbacks for that temporary scaffold only.
        const starter = makeStarterAssembly();
        const scaffold = { ...assembly, installed: { ...starter.installed, ...assembly.installed } };
        const playerCondition = createTargetCondition(scaffold, true);
        if (!ownKeys(data.housing, SLOTS) || Object.keys(data.housing).length !== SLOTS.length)
            throw new Error('Incomplete armor data');
        for (const slot of SLOTS) {
            const saved = data.housing[slot];
            if (!object(saved) || typeof saved.serial !== 'string' || !integer(saved.impacts) ||
                typeof saved.integrity !== 'number' || typeof saved.armor !== 'number')
                throw new Error('Invalid armor');
            const owned = ownedBySerial.get(saved.serial);
            const hitPart = playerCondition.parts[slot];
            if (!owned || BY_ID.get(owned.definitionId)?.slot !== slot ||
                (installedPart(assembly, slot) && installedPart(assembly, slot).instance.serial !== saved.serial) ||
                !Number.isFinite(saved.integrity) || saved.integrity < 0 || saved.integrity > hitPart.maxIntegrity ||
                !Number.isFinite(saved.armor) || saved.armor < 0 || saved.armor > hitPart.maxArmor)
                throw new Error('Impossible armor state');
            hitPart.serial = owned.serial;
            hitPart.name = BY_ID.get(owned.definitionId).name;
            hitPart.integrity = saved.integrity;
            hitPart.armor = saved.armor;
            hitPart.impacts = saved.impacts;
        }
        playerCondition.shotsHit = integer(data.shotsHit) ? data.shotsHit : 0;

        let economy = blank.economy;
        if (data.version >= 4) {
            if (!object(data.economy) || !ownKeys(data.economy, ['credits']) || !integer(data.economy.credits))
                throw new Error('Invalid economy state');
            economy = createEconomyState(data.economy.credits);
        }
        return {
            assembly, damage, playerCondition, economy,
            status: data.version < MACHINE_SAVE_VERSION ? 'migrated' : 'restored',
        };
    }
    catch {
        return { ...fresh(), status: 'invalid' };
    }
}

/** Pure encode: useful in tests and independent of browser availability. */
export function encodeMachine(state) {
    const economy = createEconomyState(state.economy?.credits);
    return JSON.stringify({
        version: MACHINE_SAVE_VERSION,
        assembly: {
            serial: state.assembly.serial,
            owned: state.assembly.owned.map(clonePart),
            installed: { ...state.assembly.installed },
            graph: state.assembly.graph || graphFromStations(state.assembly, BY_ID),
        },
        drives: Object.fromEntries(Object.entries(state.damage.drives).map(([serial, sides]) => [serial, { left: sides.left, right: sides.right }])),
        housing: Object.fromEntries(SLOTS.map(slot => {
            const { serial, integrity, armor, impacts } = state.playerCondition.parts[slot];
            return [slot, { serial, integrity, armor, impacts }];
        })),
        shotsHit: state.playerCondition.shotsHit,
        economy: { credits: economy.credits },
    });
}

export function loadMachine(storage) {
    if (!storage)
        return { ...fresh(), status: 'unavailable' };
    try {
        const v5 = storage.getItem(MACHINE_SAVE_V5_KEY);
        const v4 = storage.getItem(MACHINE_SAVE_V4_KEY);
        const v3 = storage.getItem(MACHINE_SAVE_V3_KEY);
        return decodeMachine(v5 ?? v4 ?? v3 ?? storage.getItem(MACHINE_SAVE_KEY));
    }
    catch {
        return { ...fresh(), status: 'unavailable' };
    }
}

export function storeMachine(storage, state) {
    if (!storage)
        return false;
    try {
        storage.setItem(MACHINE_SAVE_V5_KEY, encodeMachine(state));
        return true;
    }
    catch {
        return false;
    }
}
