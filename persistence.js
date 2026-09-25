/** 0.0.1h.1: one locally owned rig, persisted without coupling storage to physics/rendering.
 * Save the physical part identities, installed configuration, acute drive faults and
 * actual player armor/integrity. The hostile training rig remains disposable.
 * Export/import, historical logs and recovery UI belong to later builds. */
import { BY_ID, installedPart, makeTestAssembly, SLOTS } from './components.js';
import { createFunctionalDamage } from './functionalDamage.js';
import { createTargetCondition } from './combat.js';
export const MACHINE_SAVE_KEY = 'mech-arena-machine-v1';
export const MACHINE_SAVE_VERSION = 1;
const object = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const fraction = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1;
const integer = (value) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= 1_000_000;
const validSlot = (value) => SLOTS.includes(value);
const ownKeys = (value, allowed) => Object.keys(value).every(key => allowed.includes(key));
function fresh() {
    const assembly = makeTestAssembly();
    return { assembly, damage: createFunctionalDamage(), playerCondition: createTargetCondition(assembly, true) };
}
/** The baseline catalogue provides names, max health and future default parts;
 * saved input only supplies mutable data for known physical serials. */
export function decodeMachine(json) {
    const blank = fresh();
    if (json === null)
        return { ...blank, status: 'fresh' };
    if (json.length > 100_000)
        return { ...blank, status: 'invalid' };
    try {
        const data = JSON.parse(json);
        if (!object(data) || data.version !== MACHINE_SAVE_VERSION || !object(data.assembly) ||
            !object(data.drives) || !object(data.housing))
            throw new Error('Unknown save format');
        const savedAssembly = data.assembly;
        const assembly = blank.assembly;
        if (savedAssembly.serial !== assembly.serial || !Array.isArray(savedAssembly.owned) ||
            !object(savedAssembly.installed) || savedAssembly.owned.length < 1 ||
            savedAssembly.owned.length > assembly.owned.length)
            throw new Error('Unknown rig');
        const baselineBySerial = new Map(assembly.owned.map(p => [p.serial, p]));
        const seen = new Set();
        for (const saved of savedAssembly.owned) {
            if (!object(saved) || typeof saved.serial !== 'string' || typeof saved.definitionId !== 'string' ||
                seen.has(saved.serial) || !fraction(saved.condition) || !fraction(saved.wear) || !integer(saved.repairs))
                throw new Error('Invalid part');
            const part = baselineBySerial.get(saved.serial);
            if (!part || part.definitionId !== saved.definitionId)
                throw new Error('Unrecognized part identity');
            seen.add(saved.serial);
            part.condition = saved.condition;
            part.wear = saved.wear;
            part.repairs = saved.repairs;
        }
        // Missing keys mean deliberately uninstalled modules, never the default loadout.
        if (!ownKeys(savedAssembly.installed, SLOTS))
            throw new Error('Invalid station');
        const installed = {};
        const installedSerials = new Set();
        for (const [slot, serial] of Object.entries(savedAssembly.installed)) {
            const part = typeof serial === 'string' ? baselineBySerial.get(serial) : undefined;
            if (!validSlot(slot) || !part || BY_ID.get(part.definitionId)?.slot !== slot || installedSerials.has(serial))
                throw new Error('Invalid installed reference');
            installedSerials.add(serial);
            installed[slot] = serial;
        }
        assembly.installed = installed;
        const damage = createFunctionalDamage();
        for (const [serial, value] of Object.entries(data.drives)) {
            if (!object(value) || !fraction(value.left) || !fraction(value.right) ||
                BY_ID.get(baselineBySerial.get(serial)?.definitionId ?? '')?.slot !== 'mobility')
                throw new Error('Invalid drive sections');
            damage.drives[serial] = { left: value.left, right: value.right };
        }
        // The hit representation requires five parts even when a garage station is empty.
        // Fill only the temporary hit-volume scaffold, never the owner's actual loadout.
        const scaffold = { ...assembly, installed: { ...makeTestAssembly().installed, ...assembly.installed } };
        const playerCondition = createTargetCondition(scaffold, true);
        if (!ownKeys(data.housing, SLOTS) || Object.keys(data.housing).length !== SLOTS.length)
            throw new Error('Incomplete armor data');
        for (const slot of SLOTS) {
            const saved = data.housing[slot];
            if (!object(saved) || typeof saved.serial !== 'string' || !integer(saved.impacts) ||
                typeof saved.integrity !== 'number' || typeof saved.armor !== 'number')
                throw new Error('Invalid armor');
            const owned = baselineBySerial.get(saved.serial);
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
        return { assembly, damage, playerCondition, status: 'restored' };
    }
    catch {
        // Never partially restore a corrupt save or crash the mobile game at startup.
        return { ...fresh(), status: 'invalid' };
    }
}
/** Pure encode: useful in tests and independent of browser availability. */
export function encodeMachine(state) {
    return JSON.stringify({
        version: MACHINE_SAVE_VERSION,
        assembly: {
            serial: state.assembly.serial,
            owned: state.assembly.owned.map(({ serial, definitionId, condition, wear, repairs }) => ({ serial, definitionId, condition, wear, repairs })),
            installed: { ...state.assembly.installed },
        },
        drives: Object.fromEntries(Object.entries(state.damage.drives).map(([serial, sides]) => [serial, { left: sides.left, right: sides.right }])),
        housing: Object.fromEntries(SLOTS.map(slot => {
            const { serial, integrity, armor, impacts } = state.playerCondition.parts[slot];
            return [slot, { serial, integrity, armor, impacts }];
        })),
        shotsHit: state.playerCondition.shotsHit,
    });
}
export function loadMachine(storage) {
    if (!storage)
        return { ...fresh(), status: 'unavailable' };
    try {
        return decodeMachine(storage.getItem(MACHINE_SAVE_KEY));
    }
    catch {
        return { ...fresh(), status: 'unavailable' };
    }
}
export function storeMachine(storage, state) {
    if (!storage)
        return false;
    try {
        storage.setItem(MACHINE_SAVE_KEY, encodeMachine(state));
        return true;
    }
    catch {
        return false;
    } // Private mode, disabled site storage or quota exceeded.
}
