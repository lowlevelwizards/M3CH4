/** k.3s.0 — stable bay presentation and mutations independent of the live combat projection.
 * The viewed bay is NOT the combat-active rig. Any bay may be incomplete.
 */
import { BY_ID, SLOTS, inspectAssembly, generatorMount, setGeneratorMount } from './components.js';
import { stationLabel } from './uiLanguage.js';
import { graphFromStations } from './assemblyGraph.js';
import { createTargetPartCondition, restoreTargetPart } from './combat.js';
import { createFunctionalDamage } from './functionalDamage.js';
import { repairInstalledPart } from './garage.js';
import { repairQuote, rebuildQuote } from './economy.js';
import {
    loadStable, storeStable, rigById, rigFieldability,
    mountPartOnRig, unmountPartFromRig,
} from './stable.js';

const clone = value => JSON.parse(JSON.stringify(value));
export const BAY_IDS = Object.freeze(['rig-01','rig-02','rig-03']);
export const BAY_SLOTS = SLOTS;
export const SLOT_LABELS = Object.freeze(Object.fromEntries(SLOTS.map(slot=>[slot,stationLabel(slot)])));
export function bayAssembly(stable, rigId) {
    const rig = rigById(stable, rigId);
    if (!rig) return null;
    const assembly = {
        serial: 'SR-01',
        name: rig.name || 'RIG ' + String(rig.bay).padStart(2,'0'),
        owned: clone(stable.inventory),
        installed: { ...rig.installed },
    };
    assembly.graph = rig.graph ? clone(rig.graph) : graphFromStations(assembly, BY_ID);
    return assembly;
}
export function bayHealth(stable, rigId) {
    const rig = rigById(stable, rigId);
    if (!rig) return [];
    return SLOTS.map(slot => {
        const serial = rig.installed[slot];
        const part = stable.inventory.find(p => p.serial === serial);
        const partState = rig.playerCondition?.parts?.[slot];
        const physical = part ? Number(part.condition) || 0 : 0;
        const internal = partState?.maxIntegrity > 0 && partState.serial === serial
            ? partState.integrity / partState.maxIntegrity : physical;
        const condition = Math.max(0, Math.min(1, physical, internal));
        // Armor is protective plating, not the serialized module's internal
        // health. Show it separately so 100% integrity never conceals a stripped
        // armor plate; wear is lifetime abrasion, not remaining health.
        const armorRatio = partState?.maxArmor > 0 && partState.serial === serial
            ? Math.max(0, Math.min(1, partState.armor / partState.maxArmor))
            : 1;
        const wear = Math.max(0, Math.min(1, Number(part?.wear) || 0));
        const destroyed = !!part?.destroyed || !!partState?.destroyed;
        const impaired = Math.min(condition, armorRatio);
        return { slot, serial: serial || null, part: part || null, condition, armorRatio, wear,
            destroyed,
            label: !part ? 'EMPTY' : destroyed ? 'DESTROYED'
                : condition <= .001 ? 'DISABLED'
                : impaired < .38 ? 'CRITICAL'
                : impaired < .995 ? (armorRatio < condition ? 'ARMOR WORN' : 'DAMAGED') : 'READY' };
    });
}
export function bayStatus(stable, rigId) {
    const rig = rigById(stable, rigId);
    const readiness = rigFieldability(stable, rigId);
    const health = bayHealth(stable, rigId);
    const missing = health.filter(s => !s.serial);
    const reasons = readiness.missing.length ? 'MISSING ' + readiness.missing.map(s => SLOT_LABELS[s]).join(' / ')
        : readiness.destroyed.length ? 'DESTROYED ' + readiness.destroyed.map(s => SLOT_LABELS[s]).join(' / ')
        : readiness.disabled.length ? 'DISABLED ' + readiness.disabled.map(s => SLOT_LABELS[s]).join(' / ')
        : readiness.inspection?.checks?.find(c => !c.passes)?.reason?.toUpperCase() || 'NOT FIELDABLE';
    return {
        rig, readiness, health,
        name: rig?.name || 'RIG ' + String(rig?.bay || 1).padStart(2,'0'),
        state: !rig?.commissioned ? (missing.length === SLOTS.length ? 'EMPTY' : readiness.fieldable ? 'READY TO COMMISSION' : 'INCOMPLETE')
            : readiness.fieldable ? (health.some(s => Math.min(s.condition, s.armorRatio) < .995) ? 'DAMAGED · FIELDABLE' : 'READY')
            : 'NOT FIELDABLE',
        reason: readiness.fieldable ? null : reasons,
        canDeploy: !!rig?.commissioned && readiness.fieldable,
    };
}
export function changeInactiveBay(storage, rigId, slot, serial) {
    const loaded = loadStable(storage);
    if (rigId === loaded.stable.activeRigId) return { ok:false, reason:'ACTIVE BAY REQUIRES LIVE MOUNT' };
    const result = serial ? mountPartOnRig(loaded.stable, rigId, slot, serial)
        : unmountPartFromRig(loaded.stable, rigId, slot);
    if (!result.ok) return result;
    return storeStable(storage, loaded.stable) ? { ok:true }
        : { ok:false, reason:'STABLE SAVE FAILED' };
}
export function serviceInactiveBay(storage, rigId, slot, credits) {
    const loaded = loadStable(storage);
    const stable = loaded.stable;
    const rig = rigById(stable, rigId);
    if (!rig || !SLOTS.includes(slot) || rigId === stable.activeRigId)
        return { ok:false, reason:'INVALID INACTIVE SERVICE STATION' };
    const assembly = bayAssembly(stable, rigId);
    const installed = rig.installed[slot];
    const part = stable.inventory.find(p => p.serial === installed);
    if (!part) return { ok:false, reason:'NO INSTALLED MODULE' };
    // An unfinished bay has no valid five-station combat snapshot. Use an
    // ephemeral single-part condition for servicing without fabricating parts
    // or serials at the missing stations.
    const target = rig.playerCondition?.parts ? rig.playerCondition : { parts: {}, shotsHit: 0 };
    if (target.parts[slot]?.serial !== part.serial)
        target.parts[slot] = createTargetPartCondition(assembly, slot, true);
    if (!rig.damage?.drives) rig.damage = createFunctionalDamage();
    const condition = target.parts[slot];
    const destroyed = !!part.destroyed || !!condition?.destroyed;
    const quote = destroyed ? rebuildQuote(condition) : repairQuote(condition);
    if (quote <= 0 && part.condition >= 1) return { ok:false, reason:'NO SERVICE REQUIRED' };
    if (!destroyed && quote > credits) return { ok:false, reason:'INSUFFICIENT CREDITS' };
    const charged = destroyed ? Math.min(quote, credits) : quote;
    repairInstalledPart(assembly, rig.damage, slot);
    restoreTargetPart(target, assembly, slot);
    stable.inventory = assembly.owned.map(p => ({ serial:p.serial, definitionId:p.definitionId,
        condition:p.condition, destroyed:!!p.destroyed, wear:p.wear, repairs:p.repairs,
        ...(p.paint ? {paint:{...p.paint}} : {}) }));
    if (!storeStable(storage, stable)) return { ok:false, reason:'STABLE SAVE FAILED' };
    return { ok:true, charged, serial:part.serial, rebuilt:destroyed,
        part:stable.inventory.find(p => p.serial === part.serial) };
}
export function bayModuleQuote(stable, rigId, slot) {
    const rig = rigById(stable, rigId);
    const owned = stable.inventory.find(p => p.serial === rig?.installed?.[slot]);
    if (!owned) return null;
    const assembly = bayAssembly(stable, rigId);
    // Missing neighboring stations are normal in the garage; only this
    // serial's real housing state matters for its own repair quote.
    const snapshot = rig.playerCondition?.parts?.[slot]?.serial === owned.serial
        ? rig.playerCondition.parts[slot]
        : createTargetPartCondition(assembly, slot, true);
    const destroyed = !!snapshot?.destroyed || !!owned.destroyed;
    return { amount: destroyed ? rebuildQuote(snapshot) : repairQuote(snapshot),
        destroyed, serial:owned.serial };
}

/** The same physical generator mount rules apply on every bay, including parked rigs.
 * This changes only the target rig's assembly graph, never its installed serials.
 */
export function setInactiveBayGeneratorMount(storage, rigId, position) {
    const loaded = loadStable(storage);
    const stable = loaded.stable;
    const rig = rigById(stable, rigId);
    if (!rig || rigId === stable.activeRigId) return { ok:false, reason:'ACTIVE BAY NEEDS LIVE MOUNT' };
    const assembly = bayAssembly(stable, rigId);
    const result = setGeneratorMount(assembly, position);
    if (!result.ok) return result;
    const inspection = inspectAssembly(assembly);
    const invalid = inspection.checks.find(c => !c.passes);
    if (invalid) return { ok:false, reason:invalid.reason };
    rig.graph = clone(assembly.graph);
    return storeStable(storage, stable) ? { ok:true, position }
        : { ok:false, reason:'STABLE SAVE FAILED' };
}
export function bayGeneratorMount(stable, rigId) {
    const assembly = bayAssembly(stable, rigId);
    return assembly ? generatorMount(assembly) : 'none';
}
