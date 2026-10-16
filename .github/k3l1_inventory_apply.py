from pathlib import Path
import re


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'missing pattern in {path}: {old[:120]!r}')
    p.write_text(text.replace(old, new, 1))


def regex_once(path, pattern, replacement):
    p = Path(path)
    text = p.read_text()
    next_text, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f'expected one regex match in {path}, got {count}: {pattern[:120]!r}')
    p.write_text(next_text)

# acquisition.js — physical duplicates are real inventory; only serial identity must be unique.
replace_once('acquisition.js',
"/** Add the offered physical component to ownership. This first acquisition slice\n * intentionally refuses duplicate definitions because the existing garage chooser\n * is definition-based rather than serial-based. */",
"/** Add one physical recovered component to ownership. Definition IDs describe a model;\n * serials identify possessions, so multiple Yardwalkers/cannons/etc. are legitimate. */")
replace_once('acquisition.js',
"    if (assembly.owned.some(part => part.definitionId === offer.definitionId))\n        return { ok: false, reason: 'ALREADY OWNED' };\n",
"")

# components.js — keep definition-based equip for authored recipes, add serial-authoritative garage mounting.
components = Path('components.js')
text = components.read_text()
pattern = r"export function equip\(assembly, slot, definitionId\) \{.*?\n\}\n/\*\* A parent with children"
replacement = r'''function equipOwnedInstance(assembly, slot, owned) {
    const definition = owned && BY_ID.get(owned.definitionId);
    if (!definition || definition.slot !== slot)
        throw new Error(`Cannot fit ${owned?.definitionId ?? owned?.serial ?? 'unknown'} in ${slot}`);
    const current = ensureAssemblyGraph(assembly, BY_ID);
    if (assembly.installed[slot] === owned.serial) {
        const check = validateGraph(current, assembly, BY_ID);
        if (!check.valid) throw new Error(check.errors.join(' '));
        return { ok: true, serial: owned.serial, unchanged: true };
    }
    assertLegacyLayout(assembly, current);
    const oldSerial = assembly.installed[slot];
    if (oldSerial && oldSerial !== owned.serial && slot !== 'structure') {
        const removal = proposeRemoval(current, oldSerial);
        if (!removal.ok) throw new Error(removal.reason);
    }
    if (slot === 'structure' && oldSerial && oldSerial !== owned.serial) {
        const nodes = Object.values(current.nodes);
        const expected = new Set(Object.values(assembly.installed));
        const adapters = new Set(nodes.filter(n => n.virtual).map(n => n.serial));
        if (nodes.some(n => !expected.has(n.serial) && !adapters.has(n.serial)))
            throw new Error('This frame supports custom assemblies; remove or rehome them before swapping frames.');
    }
    const installed = { ...assembly.installed, [slot]: owned.serial };
    const candidate = { ...assembly, installed };
    const graph = graphFromStations(candidate, BY_ID);
    const verdict = validateGraph(graph, candidate, BY_ID);
    if (!verdict.valid) throw new Error(verdict.errors.join(' '));
    assembly.installed = installed;
    assembly.graph = graph;
    delete assembly.mountNotice;
    return { ok: true, serial: owned.serial };
}

/** Garage/inventory mounting is serial-authoritative so duplicate definitions remain distinct. */
export function equipSerial(assembly, slot, serial) {
    const owned = assembly?.owned?.find(part => part.serial === serial);
    if (!owned) throw new Error(`Not owned: ${serial}`);
    return equipOwnedInstance(assembly, slot, owned);
}

/** Definition-based mounting remains for authored recipes/debug construction. When the
 * player owns duplicates, prefer the already-installed copy, then the first matching
 * physical instance. UI code should call equipSerial instead. */
export function equip(assembly, slot, definitionId) {
    const fitted = installedPart(assembly, slot);
    const owned = fitted?.definition.id === definitionId
        ? fitted.instance
        : assembly?.owned?.find(part => part.definitionId === definitionId);
    if (!owned) throw new Error(`Not owned: ${definitionId}`);
    return equipOwnedInstance(assembly, slot, owned);
}
/** A parent with children'''
next_text, count = re.subn(pattern, replacement, text, count=1, flags=re.S)
if count != 1:
    raise SystemExit(f'components equip block match count {count}')
components.write_text(next_text)

# persistence.js — v8 is the rollback-safe duplicate-instance generation.
replace_once('persistence.js',
"export const MACHINE_SAVE_V7_KEY = 'mech-arena-machine-v7';\nexport const MACHINE_SAVE_VERSION = 7; // Read v1-v6; write v7 separately for rollback.",
"export const MACHINE_SAVE_V7_KEY = 'mech-arena-machine-v7';\nexport const MACHINE_SAVE_V8_KEY = 'mech-arena-machine-v8';\nexport const MACHINE_SAVE_VERSION = 8; // Read v1-v7; write v8 separately for rollback-safe duplicate inventory.")
replace_once('persistence.js', "const MAX_OWNED_PARTS = 100;", "const MAX_OWNED_PARTS = 250;")
replace_once('persistence.js',
"    const seenSerials = new Set();\n    const seenDefinitions = new Set();\n    const owned = [];\n    for (const part of saved) {\n        validateSavedPart(part, seenSerials, seenDefinitions);\n        owned.push(clonePart(part));\n    }",
"    const seenSerials = new Set();\n    // v5-v7 never wrote duplicate definitions. v8 intentionally does: serial identity\n    // is authoritative, so several physical copies of the same model are valid.\n    const seenDefinitions = data.version >= 8 ? null : new Set();\n    const owned = [];\n    for (const part of saved) {\n        validateSavedPart(part, seenSerials, seenDefinitions);\n        owned.push(clonePart(part));\n    }")
replace_once('persistence.js',
"if (!object(data) || ![1, 2, 3, 4, 5, 6, MACHINE_SAVE_VERSION].includes(data.version)",
"if (!object(data) || ![1, 2, 3, 4, 5, 6, 7, MACHINE_SAVE_VERSION].includes(data.version)")
replace_once('persistence.js',
"        const v7 = storage.getItem(MACHINE_SAVE_V7_KEY);\n        const v6 = storage.getItem(MACHINE_SAVE_V6_KEY);",
"        const v8 = storage.getItem(MACHINE_SAVE_V8_KEY);\n        const v7 = storage.getItem(MACHINE_SAVE_V7_KEY);\n        const v6 = storage.getItem(MACHINE_SAVE_V6_KEY);")
replace_once('persistence.js',
"        return decodeMachine(v7 ?? v6 ?? v5 ?? v4 ?? v3 ?? storage.getItem(MACHINE_SAVE_KEY));",
"        return decodeMachine(v8 ?? v7 ?? v6 ?? v5 ?? v4 ?? v3 ?? storage.getItem(MACHINE_SAVE_KEY));")
replace_once('persistence.js',
"        storage.setItem(MACHINE_SAVE_V7_KEY, encodeMachine({ ...state, progression }));",
"        storage.setItem(MACHINE_SAVE_V8_KEY, encodeMachine({ ...state, progression }));")
replace_once('persistence.js',
"        for (const key of [MACHINE_SAVE_V7_KEY, MACHINE_SAVE_V6_KEY, MACHINE_SAVE_V5_KEY, MACHINE_SAVE_V4_KEY, MACHINE_SAVE_V3_KEY, MACHINE_SAVE_KEY])",
"        for (const key of [MACHINE_SAVE_V8_KEY, MACHINE_SAVE_V7_KEY, MACHINE_SAVE_V6_KEY, MACHINE_SAVE_V5_KEY, MACHINE_SAVE_V4_KEY, MACHINE_SAVE_V3_KEY, MACHINE_SAVE_KEY])")

# salvageDraft.js — every physical copy is a valid claim; sanctioned claims are already earned and free.
replace_once('salvageDraft.js',
"import { partFate } from './damageFate.js';",
"import { partFate } from './damageFate.js';\nimport { partCreditValue } from './partEconomy.js';")
replace_once('salvageDraft.js',
"            recoveryFee: salvageRecoveryFee(fitted.definition, condition),",
"            recoveryFee: 0,\n            value: partCreditValue(fitted.definition, condition, { destroyed: status === 'destroyed', wear: fitted.instance.wear ?? 0 }),")
replace_once('salvageDraft.js',
"export function playerClaimChoices(draft, ownedDefinitions = new Set()) {\n    return availableClaims(draft).filter(entry => !ownedDefinitions.has(entry.definitionId));\n}",
"export function playerClaimChoices(draft) {\n    return availableClaims(draft);\n}")

# main.js imports + instance-grid garage.
replace_once('main.js',
"import { equip, inspectAssembly, installedPart, partsFor, remove, SLOTS, } from './components.js';",
"import { BY_ID, equipSerial, inspectAssembly, installedPart, remove, SLOTS, } from './components.js';")
replace_once('main.js',
"import { resetDamageFate } from './damageFate.js';",
"import { resetDamageFate } from './damageFate.js';\nimport { partCreditValue } from './partEconomy.js';\nimport { createPartCard, createPartDetail, installPartGridStyles } from './partGridUI.js';")
replace_once('main.js',
"const selectionButtons = new Map();",
"const selectionButtons = new Map();\nlet inventoryPreviewSerial = null;\ninstallPartGridStyles();")
replace_once('main.js',
"function selectPart(slot, focus = true) {\n    selectedPart = slot;",
"function selectPart(slot, focus = true) {\n    if (slot !== selectedPart) inventoryPreviewSerial = null;\n    selectedPart = slot;")
old_options = '''    const options = document.createElement('div');
    options.className = 'swap-options';
    for (const def of partsFor(selectedPart)) {
        const button = document.createElement('button');
        button.type = 'button';
        const fittedHere = fitted?.definition.id === def.id;
        button.className = `swap-option ${fittedHere ? 'installed-option' : ''}`;
        const title = document.createElement('span');
        title.textContent = `${fittedHere ? '✓ ' : 'FIT '}${def.name} · ${def.massKg} kg`;
        const specs = document.createElement('small');
        specs.textContent = specLine(def);
        button.append(title, specs);
        button.disabled = fittedHere;
        button.addEventListener('click', () => {
            equip(assembly, def.slot, def.id);
            refreshAssembly(true);
            selectPart(def.slot);
        });
        options.appendChild(button);
    }
    partInfo.append(options);'''
new_options = '''    const ownedInstances = assembly.owned.filter(instance => BY_ID.get(instance.definitionId)?.slot === selectedPart);
    if (!inventoryPreviewSerial || !ownedInstances.some(instance => instance.serial === inventoryPreviewSerial))
        inventoryPreviewSerial = fitted?.instance.serial ?? ownedInstances[0]?.serial ?? null;
    const options = document.createElement('div');
    options.className = 'swap-options part-grid';
    for (const instance of ownedInstances) {
        const def = BY_ID.get(instance.definitionId);
        const fittedHere = fitted?.instance.serial === instance.serial;
        const entry = {
            id: `garage:${instance.serial}`, serial: instance.serial, sourceSerial: instance.serial,
            slot: def.slot, definitionId: def.id, name: def.name,
            condition: instance.condition, destroyed: !!instance.destroyed,
            status: instance.destroyed ? 'destroyed' : instance.condition <= .001 ? 'disabled' : instance.condition < .38 ? 'critical' : instance.condition < .78 ? 'damaged' : 'operational',
        };
        const value = partCreditValue(def, instance.condition, { destroyed: instance.destroyed, wear: instance.wear });
        const thumbnailUrl = arena.partThumbnailDataUrl?.(def.id, entry) ?? null;
        const button = createPartCard({
            entry, thumbnailUrl, value, selected: inventoryPreviewSerial === instance.serial,
            source: fittedHere ? 'INSTALLED' : instance.serial,
            onSelect: () => { inventoryPreviewSerial = instance.serial; renderPartInfo(); },
        });
        button.classList.add('swap-option');
        if (fittedHere) button.classList.add('installed-option');
        button.dataset.serial = instance.serial;
        options.appendChild(button);
    }
    partInfo.append(options);
    const preview = ownedInstances.find(instance => instance.serial === inventoryPreviewSerial);
    if (preview) {
        const def = BY_ID.get(preview.definitionId);
        const fittedHere = fitted?.instance.serial === preview.serial;
        const entry = {
            id: `garage:${preview.serial}`, serial: preview.serial, sourceSerial: preview.serial,
            slot: def.slot, definitionId: def.id, name: def.name,
            condition: preview.condition, destroyed: !!preview.destroyed,
            status: preview.destroyed ? 'destroyed' : preview.condition <= .001 ? 'disabled' : preview.condition < .38 ? 'critical' : preview.condition < .78 ? 'damaged' : 'operational',
        };
        const value = partCreditValue(def, preview.condition, { destroyed: preview.destroyed, wear: preview.wear });
        const thumbnailUrl = arena.partThumbnailDataUrl?.(def.id, entry) ?? null;
        const detail = createPartDetail({
            entry, thumbnailUrl, value,
            meta: `${def.massKg} kg · WEAR ${Math.round((preview.wear ?? 0) * 100)}% · REPAIRS ${preview.repairs ?? 0}\n${specLine(def)}`,
            actionLabel: fittedHere ? 'INSTALLED' : `INSTALL · ${preview.serial}`,
            actionDisabled: fittedHere,
            onAction: () => {
                equipSerial(assembly, def.slot, preview.serial);
                refreshAssembly(true);
                selectPart(def.slot);
            },
        });
        partInfo.append(detail);
    }'''
replace_once('main.js', old_options, new_options)
# Live external salvage claims mutate the same assembly object; refresh without page reload.
insert_after = "refreshAssembly();\nselectPart(null, false);"
replace_once('main.js', insert_after,
insert_after + "\ndocument.addEventListener('m3ch4:inventory-changed', () => {\n    refreshAssembly(true);\n    renderPartInfo();\n    showStatus('SALVAGE SECURED · OWNED INVENTORY UPDATED');\n});")

# scene.js — expose cached thumbnails built from the exact gameplay geometry.
replace_once('scene.js',
"import { installedPart, SLOT_CENTERS, SLOTS } from './components.js';",
"import { BY_ID, installedPart, SLOT_CENTERS, SLOTS } from './components.js';")
scene = Path('scene.js')
scene_text = scene.read_text()
marker = "const C = {\n    concrete: 0x777267, concreteDark: 0x4d4b45,\n    yellow: 0xa9822f, teal: 0x2f7473, metal: 0x343a39,\n    dark: 0x151816, rust: 0x8a4d2d, amber: 0xe0a44c, green: 0x6ea778,\n};\n"
if marker not in scene_text:
    raise SystemExit('scene color marker missing')
thumb_code = r'''
const partThumbnailCache = new Map();
let partThumbnailRenderer = null;
function disposePreviewObject(root) {
    root.traverse(object => {
        if (!object.isMesh) return;
        object.geometry?.dispose?.();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) material?.dispose?.();
    });
}
/** Render the same authored gameplay mesh used in the arena into a cached visual
 * inventory card. Condition is quantized so a phone never grows an unbounded cache. */
export function partThumbnailDataUrl(definitionId, state = {}) {
    if (typeof document === 'undefined') return null;
    const definition = BY_ID.get(definitionId);
    if (!definition) return null;
    const condition = Math.max(0, Math.min(1, Number(state.condition) || 0));
    const destroyed = !!state.destroyed || state.status === 'destroyed';
    const key = `${definitionId}:${destroyed ? 'x' : Math.round(condition * 10)}`;
    if (partThumbnailCache.has(key)) return partThumbnailCache.get(key);
    if (!partThumbnailRenderer) {
        partThumbnailRenderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, preserveDrawingBuffer: true, powerPreference: 'low-power' });
        partThumbnailRenderer.outputColorSpace = THREE.SRGBColorSpace;
        partThumbnailRenderer.toneMapping = THREE.ACESFilmicToneMapping;
        partThumbnailRenderer.toneMappingExposure = 1.18;
        partThumbnailRenderer.setSize(180, 132, false);
        partThumbnailRenderer.setPixelRatio(1);
    }
    const serial = 'PREVIEW-001';
    const assembly = { serial: 'PREVIEW', name: 'PREVIEW', owned: [{ serial, definitionId, condition: 1, wear: 0, repairs: 0 }], installed: { [definition.slot]: serial } };
    const exterior = buildExteriorRig(assembly);
    exterior.root.position.set(-definition.center[0], -definition.center[1], -definition.center[2]);
    const damageTint = new THREE.Color(0x6f2d24);
    for (const mesh of exterior.pickMeshes) {
        const material = mesh.material;
        if (!(material instanceof THREE.MeshStandardMaterial)) continue;
        if (destroyed) {
            material.color.multiplyScalar(.09);
            material.emissive.setHex(0);
        } else if (condition < .999) {
            const severity = 1 - condition;
            material.color.lerp(damageTint, Math.min(.48, severity * .46));
            material.color.multiplyScalar(Math.max(.42, 1 - severity * .36));
            if (condition <= .001) { material.emissive.setHex(0x3b130b); material.emissiveIntensity = .28; }
        }
    }
    const previewScene = new THREE.Scene();
    previewScene.background = new THREE.Color(0x0b100e);
    previewScene.add(exterior.root);
    previewScene.add(new THREE.HemisphereLight(0xa6b9ad, 0x201c18, .78));
    const keyLight = new THREE.DirectionalLight(0xffd49a, 2.5); keyLight.position.set(-4, 6, 5); previewScene.add(keyLight);
    const rim = new THREE.DirectionalLight(0x78aaa5, 1.1); rim.position.set(4, 2, -5); previewScene.add(rim);
    const bounds = new THREE.Box3().setFromObject(exterior.root);
    const sphere = bounds.getBoundingSphere(new THREE.Sphere());
    const camera = new THREE.PerspectiveCamera(36, 180 / 132, .03, 40);
    const radius = Math.max(.35, sphere.radius);
    camera.position.set(radius * 1.65, radius * .92, radius * 2.25);
    camera.lookAt(0, 0, 0);
    partThumbnailRenderer.render(previewScene, camera);
    const url = partThumbnailRenderer.domElement.toDataURL('image/png');
    partThumbnailCache.set(key, url);
    disposePreviewObject(exterior.root);
    return url;
}
'''
scene.write_text(scene_text.replace(marker, marker + thumb_code, 1))
replace_once('scene.js',
"        updateCockpitInstruments, updateCockpitMotion, triggerCockpitHit, resetCockpitTransientFeedback, combatantVisualAudit,\n",
"        updateCockpitInstruments, updateCockpitMotion, triggerCockpitHit, resetCockpitTransientFeedback, combatantVisualAudit, partThumbnailDataUrl,\n")

# sceneAssembly cache key so browsers fetch the integrated renderer.
replace_once('sceneAssembly.js', "./scene.js?source=k3l0", "./scene.js?source=k3l1")

print('k3l1 inventory integration applied')
