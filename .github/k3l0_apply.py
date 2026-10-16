from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f'anchor missing in {path}: {old[:160]!r}')
    p.write_text(text.replace(old, new, 1))

# combat.js — integrity zero is disabled; excess damage can destroy the hardware.
replace_once('combat.js',
"import { contractById, selectedContract } from './contracts.js';",
"import { contractById, selectedContract } from './contracts.js';\nimport { applyDestructionOverflow, hydrateDamageFate } from './damageFate.js';")

replace_once('combat.js',
"""    return {
        serial: installed.instance.serial, slot, name: installed.definition.name,
        integrity: maxIntegrity * condition, maxIntegrity, armor: maxArmor, maxArmor, impacts: 0,
        damageTakenScale,
    };""",
"""    const part = {
        serial: installed.instance.serial, slot, name: installed.definition.name,
        integrity: maxIntegrity * condition, maxIntegrity, armor: maxArmor, maxArmor, impacts: 0,
        damageTakenScale, destruction: 0, destroyed: false,
    };
    if (useOwnedCondition && installed.instance.destroyed) {
        part.integrity = 0;
        hydrateDamageFate(part, { destroyed: true });
    }
    return part;""")

replace_once('combat.js',
"""        if (owned)
            owned.condition = part.integrity / part.maxIntegrity;""",
"""        if (owned) {
            owned.condition = part.integrity / part.maxIntegrity;
            owned.destroyed = !!part.destroyed;
        }""")

replace_once('combat.js',
"""    const effectiveDamage = damage * (part.damageTakenScale ?? 1);
    const absorbed = Math.min(part.armor, effectiveDamage);
    const internalDamage = Math.min(part.integrity, effectiveDamage - absorbed);
    part.armor -= absorbed;
    part.integrity -= internalDamage;
    part.impacts++;
    target.shotsHit++;
    return {
        slot, serial: part.serial, armorAbsorbed: absorbed, internalDamage,
        remainingArmor: part.armor, remainingIntegrity: part.integrity,
        disabled: part.integrity <= 0,
    };""",
"""    const effectiveDamage = damage * (part.damageTakenScale ?? 1);
    const absorbed = Math.min(part.armor, effectiveDamage);
    const afterArmor = Math.max(0, effectiveDamage - absorbed);
    const internalDamage = Math.min(part.integrity, afterArmor);
    const overflowDamage = Math.max(0, afterArmor - internalDamage);
    part.armor -= absorbed;
    part.integrity -= internalDamage;
    const fate = applyDestructionOverflow(part, overflowDamage);
    part.impacts++;
    target.shotsHit++;
    return {
        slot, serial: part.serial, armorAbsorbed: absorbed, internalDamage, overflowDamage,
        remainingArmor: part.armor, remainingIntegrity: part.integrity,
        disabled: part.integrity <= 0,
        destroyed: fate.destroyed,
        justDestroyed: fate.justDestroyed,
        destructionProgress: fate.progress,
    };""")

# functionalDamage.js — DEV restoration also clears rebuild-required flags.
replace_once('functionalDamage.js',
"""        part.instance.condition = 1;
        if (slot === 'mobility')""",
"""        part.instance.condition = 1;
        part.instance.destroyed = false;
        if (slot === 'mobility')""")

# garage.js — rebuilding retains serial but clears wrecked state.
replace_once('garage.js',
"""    const previousCondition = clamp01(owned.condition);
    const sections = slot === 'mobility' ? driveCondition(assembly, state) : null;
    const damaged = previousCondition < 1 - 1e-6 || !!sections && (sections.left < 1 - 1e-6 || sections.right < 1 - 1e-6);
    if (damaged) {
        owned.condition = 1;
        if (slot === 'mobility')
            state.drives[owned.serial] = { left: 1, right: 1 };
        owned.repairs += 1;
    }
    return { repaired: damaged, serial: owned.serial, previousCondition, condition: clamp01(owned.condition), repairs: owned.repairs };""",
"""    const previousCondition = clamp01(owned.condition);
    const destroyedBefore = !!owned.destroyed;
    const sections = slot === 'mobility' ? driveCondition(assembly, state) : null;
    const damaged = destroyedBefore || previousCondition < 1 - 1e-6 || !!sections && (sections.left < 1 - 1e-6 || sections.right < 1 - 1e-6);
    if (damaged) {
        owned.condition = 1;
        owned.destroyed = false;
        if (slot === 'mobility')
            state.drives[owned.serial] = { left: 1, right: 1 };
        owned.repairs += 1;
    }
    return { repaired: damaged, rebuilt: destroyedBefore, serial: owned.serial, previousCondition, condition: clamp01(owned.condition), repairs: owned.repairs };""")

# economy.js — destruction is a rebuild, not a normal repair.
replace_once('economy.js',
"export const AMMO_COST_PER_ROUND = 1;",
"export const AMMO_COST_PER_ROUND = 1;\nexport const REBUILD_MULTIPLIER = 1.65;")
replace_once('economy.js',
"""export function totalRepairQuote(condition) {
    if (!condition?.parts)
        return 0;
    return Object.values(condition.parts).reduce((sum, part) => sum + repairQuote(part), 0);
}""",
"""export function rebuildQuote(part) {
    const repair = repairQuote(part);
    return part?.destroyed ? Math.max(1, Math.ceil(repair * REBUILD_MULTIPLIER)) : repair;
}

export function totalRepairQuote(condition) {
    if (!condition?.parts)
        return 0;
    return Object.values(condition.parts).reduce((sum, part) => sum + rebuildQuote(part), 0);
}""")

# acquisition.js — real wreck draft preserves source identity when safe.
replace_once('acquisition.js',
"""    const instance = {
        serial: nextRecoveredSerial(assembly),
        definitionId: offer.definitionId,
        condition: clamp01(offer.condition),
        wear: Math.min(.35, (1 - clamp01(offer.condition)) * .12),
        repairs: 0,
    };""",
"""    const preserve = offer.preserveSourceSerial === true && typeof offer.sourceSerial === 'string' &&
        offer.sourceSerial.length > 0 && !assembly.owned.some(part => part.serial === offer.sourceSerial);
    const instance = {
        serial: preserve ? offer.sourceSerial : nextRecoveredSerial(assembly),
        definitionId: offer.definitionId,
        condition: clamp01(offer.condition),
        wear: Math.min(.35, (1 - clamp01(offer.condition)) * .12),
        repairs: 0,
        destroyed: false,
    };""")

# persistence.js — v7 stores component destruction while preserving v6 progression.
replace_once('persistence.js',
"import { createEconomyState } from './economy.js';",
"import { createEconomyState } from './economy.js';\nimport { hydrateDamageFate } from './damageFate.js';")
replace_once('persistence.js',
"""export const MACHINE_SAVE_V6_KEY = 'mech-arena-machine-v6';
export const MACHINE_SAVE_VERSION = 6; // Read v1-v5; write v6 separately for rollback.""",
"""export const MACHINE_SAVE_V6_KEY = 'mech-arena-machine-v6';
export const MACHINE_SAVE_V7_KEY = 'mech-arena-machine-v7';
export const MACHINE_SAVE_VERSION = 7; // Read v1-v6; write v7 separately for rollback.""")
replace_once('persistence.js',
"const clonePart = ({ serial, definitionId, condition, wear, repairs }) => ({ serial, definitionId, condition, wear, repairs });",
"const clonePart = ({ serial, definitionId, condition, wear, repairs, destroyed = false }) => ({ serial, definitionId, condition, wear, repairs, destroyed: !!destroyed });")
replace_once('persistence.js',
"""        !fraction(saved.condition) || !fraction(saved.wear) || !integer(saved.repairs))
        throw new Error('Invalid part');""",
"""        !fraction(saved.condition) || !fraction(saved.wear) || !integer(saved.repairs) ||
        (saved.destroyed !== undefined && typeof saved.destroyed !== 'boolean'))
        throw new Error('Invalid part');""")
replace_once('persistence.js',
"""function restoreProgression(data) {
    if (data.version < MACHINE_SAVE_VERSION)
        return createLegacyProgressionState();""",
"""function restoreProgression(data) {
    if (data.version < 6)
        return createLegacyProgressionState();""")
replace_once('persistence.js',
"!object(data) || ![1, 2, 3, 4, 5, MACHINE_SAVE_VERSION].includes(data.version)",
"!object(data) || ![1, 2, 3, 4, 5, 6, MACHINE_SAVE_VERSION].includes(data.version)")
replace_once('persistence.js',
"""            hitPart.integrity = saved.integrity;
            hitPart.armor = saved.armor;
            hitPart.impacts = saved.impacts;
        }
        playerCondition.shotsHit""",
"""            hitPart.integrity = saved.integrity;
            hitPart.armor = saved.armor;
            hitPart.impacts = saved.impacts;
            if (data.version >= 7) {
                if ((saved.destroyed !== undefined && typeof saved.destroyed !== 'boolean') ||
                    (saved.destruction !== undefined && (!Number.isFinite(saved.destruction) || saved.destruction < 0)))
                    throw new Error('Invalid destruction state');
                hydrateDamageFate(hitPart, { destruction: saved.destruction ?? 0, destroyed: saved.destroyed ?? false });
                owned.destroyed = !!saved.destroyed;
            } else {
                hydrateDamageFate(hitPart);
                owned.destroyed = false;
            }
        }
        playerCondition.shotsHit""")
replace_once('persistence.js',
"""            return [slot, { serial, integrity, armor, impacts }];""",
"""            const { destruction = 0, destroyed = false } = state.playerCondition.parts[slot];
            return [slot, { serial, integrity, armor, impacts, destruction, destroyed: !!destroyed }];""")
replace_once('persistence.js',
"""        const v6 = storage.getItem(MACHINE_SAVE_V6_KEY);
        const v5 = storage.getItem(MACHINE_SAVE_V5_KEY);""",
"""        const v7 = storage.getItem(MACHINE_SAVE_V7_KEY);
        const v6 = storage.getItem(MACHINE_SAVE_V6_KEY);
        const v5 = storage.getItem(MACHINE_SAVE_V5_KEY);""")
replace_once('persistence.js',
"return decodeMachine(v6 ?? v5 ?? v4 ?? v3 ?? storage.getItem(MACHINE_SAVE_KEY));",
"return decodeMachine(v7 ?? v6 ?? v5 ?? v4 ?? v3 ?? storage.getItem(MACHINE_SAVE_KEY));")
replace_once('persistence.js',
"storage.setItem(MACHINE_SAVE_V6_KEY, encodeMachine({ ...state, progression }));",
"storage.setItem(MACHINE_SAVE_V7_KEY, encodeMachine({ ...state, progression }));")
replace_once('persistence.js',
"for (const key of [MACHINE_SAVE_V6_KEY, MACHINE_SAVE_V5_KEY, MACHINE_SAVE_V4_KEY, MACHINE_SAVE_V3_KEY, MACHINE_SAVE_KEY])",
"for (const key of [MACHINE_SAVE_V7_KEY, MACHINE_SAVE_V6_KEY, MACHINE_SAVE_V5_KEY, MACHINE_SAVE_V4_KEY, MACHINE_SAVE_V3_KEY, MACHINE_SAVE_KEY])")

# progression.js — v7 is current, but v6 progression is real and must migrate intact.
replace_once('progression.js',
"""export const MACHINE_PROGRESS_V6_KEY = 'mech-arena-machine-v6';
const LEGACY_MACHINE_KEYS = Object.freeze([
    'mech-arena-machine-v5',""",
"""export const MACHINE_PROGRESS_V7_KEY = 'mech-arena-machine-v7';
export const MACHINE_PROGRESS_V6_KEY = 'mech-arena-machine-v6';
const LEGACY_MACHINE_KEYS = Object.freeze([
    'mech-arena-machine-v5',""")
replace_once('progression.js',
"""        const current = storage.getItem(MACHINE_PROGRESS_V6_KEY);
        if (current) {
            const data = JSON.parse(current);
            if (data?.version === 6 && data.progression)
                return createProgressionState(data.progression);
        }
        if (LEGACY_MACHINE_KEYS.some(key => storage.getItem(key) !== null))""",
"""        const current = storage.getItem(MACHINE_PROGRESS_V7_KEY);
        if (current) {
            const data = JSON.parse(current);
            if (data?.version === 7 && data.progression)
                return createProgressionState(data.progression);
        }
        const v6 = storage.getItem(MACHINE_PROGRESS_V6_KEY);
        if (v6) {
            const data = JSON.parse(v6);
            if (data?.version === 6 && data.progression)
                return createProgressionState(data.progression);
        }
        if (LEGACY_MACHINE_KEYS.some(key => storage.getItem(key) !== null))""")
replace_once('progression.js',
"""        const raw = storage.getItem(MACHINE_PROGRESS_V6_KEY);
        if (!raw) return false;
        const data = JSON.parse(raw);
        if (data?.version !== 6) return false;""",
"""        const raw = storage.getItem(MACHINE_PROGRESS_V7_KEY);
        if (!raw) return false;
        const data = JSON.parse(raw);
        if (data?.version !== 7) return false;""")
replace_once('progression.js',
"storage.setItem(MACHINE_PROGRESS_V6_KEY, JSON.stringify(data));",
"storage.setItem(MACHINE_PROGRESS_V7_KEY, JSON.stringify(data));")

# damageVisuals.js — catastrophic destruction is much louder than disable.
replace_once('damageVisuals.js',
"""    if (outcome.wreckHit)
        return { kind: outcome.cleared ? 'wreck-break' : 'wreck-hit', sparkCount: outcome.cleared ? 18 : 10, chipCount: outcome.cleared ? 12 : 7, smokeCount: outcome.cleared ? 5 : 2, markScale: 1.45, flashScale: outcome.cleared ? 1.65 : 1.12 };
    if (outcome.justDisabled)""",
"""    if (outcome.justDestroyed)
        return {
            kind: outcome.slot === 'power' ? 'power-destroy' : 'destroy',
            sparkCount: outcome.slot === 'power' ? 38 : 30,
            chipCount: outcome.slot === 'mobility' ? 22 : 18,
            smokeCount: outcome.slot === 'power' ? 11 : 8,
            markScale: 2.0,
            flashScale: outcome.slot === 'power' ? 2.35 : 1.95,
        };
    if (outcome.wreckHit)
        return { kind: outcome.cleared ? 'wreck-break' : 'wreck-hit', sparkCount: outcome.cleared ? 20 : 12, chipCount: outcome.cleared ? 14 : 8, smokeCount: outcome.cleared ? 6 : 3, markScale: 1.45, flashScale: outcome.cleared ? 1.65 : 1.12 };
    if (outcome.justDisabled)""")
replace_once('damageVisuals.js',
"sparkStart = .42; smokeStart = .62; sparkMax = 7.5; smokeMax = 1.35;",
"sparkStart = .38; smokeStart = .56; sparkMax = 9.0; smokeMax = 1.75;")
replace_once('damageVisuals.js',
"sparkStart = .55; smokeStart = .78; sparkMax = 5.0; smokeMax = .75;",
"sparkStart = .50; smokeStart = .72; sparkMax = 6.2; smokeMax = 1.0;")
replace_once('damageVisuals.js',
"sparkStart = .64; smokeStart = .86; sparkMax = 4.2; smokeMax = .55;",
"sparkStart = .59; smokeStart = .80; sparkMax = 5.2; smokeMax = .8;")

# acquisitionUI.js — explicit insertion order; Element.after returns undefined.
replace_once('acquisitionUI.js',
"    sheet.querySelector('.bout-score')?.after(panel) ?? lines.after(panel);",
"    const scoreBox = sheet.querySelector('.bout-score');\n    if (scoreBox) scoreBox.after(panel);\n    else lines.after(panel);")

# garageMountUI.js loads the new authoritative post-bout adapter.
replace_once('garageMountUI.js',
"import './acquisitionUI.js';",
"import './acquisitionUI.js?v=k3l0';")

# sceneAssembly.js cache bridge.
replace_once('sceneAssembly.js',
"import { createArenaScene as createBaseArenaScene } from './scene.js?source=k3k4';",
"import { createArenaScene as createBaseArenaScene } from './scene.js?source=k3l0';")
