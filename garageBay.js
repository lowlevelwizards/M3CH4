/** k.3s.0 — stable bay presentation and mutations independent of the live combat projection.
 * The viewed bay is NOT the combat-active rig. Any bay may be incomplete.
 */
import { BY_ID, SLOTS, inspectAssembly } from './components.js';
import { graphFromStations } from './assemblyGraph.js';
import { createTargetCondition, restoreTargetPart } from './combat.js';
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
export const SLOT_LABELS = Object.freeze({
    structure:'FRAME',mobility:'MOVE',power:'PWR',command:'CMD',combat:'ARMS',
});
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
        return { slot, serial: serial || null, part: part || null, condition,
            destroyed: !!part?.destroyed || !!partState?.destroyed,
            label: !part ? 'EMPTY' : part.destroyed || partState?.destroyed ? 'DESTROYED'
                : condition <= .001 ? 'DISABLED' : condition < .38 ? 'CRITICAL'
                : condition < .78 ? 'DAMAGED' : 'READY' };
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
            : readiness.fieldable ? (health.some(s => s.condition < .78) ? 'DAMAGED · FIELDABLE' : 'READY')
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
    if (!rig.playerCondition?.parts) rig.playerCondition = createTargetCondition(assembly, true);
    if (!rig.damage?.drives) rig.damage = createFunctionalDamage();
    const condition = rig.playerCondition.parts[slot];
    const destroyed = !!part.destroyed || !!condition?.destroyed;
    const quote = destroyed ? rebuildQuote(condition) : repairQuote(condition);
    if (quote <= 0 && part.condition >= 1) return { ok:false, reason:'NO SERVICE REQUIRED' };
    if (!destroyed && quote > credits) return { ok:false, reason:'INSUFFICIENT CREDITS' };
    const charged = destroyed ? Math.min(quote, credits) : quote;
    repairInstalledPart(assembly, rig.damage, slot);
    restoreTargetPart(rig.playerCondition, assembly, slot);
    stable.inventory = assembly.owned.map(p => ({ serial:p.serial, definitionId:p.definitionId,
        condition:p.condition, destroyed:!!p.destroyed, wear:p.wear, repairs:p.repairs }));
    if (!storeStable(storage, stable)) return { ok:false, reason:'STABLE SAVE FAILED' };
    return { ok:true, charged, serial:part.serial, rebuilt:destroyed };
}
export function bayModuleQuote(stable, rigId, slot) {
    const rig = rigById(stable, rigId);
    const owned = stable.inventory.find(p => p.serial === rig?.installed?.[slot]);
    if (!owned) return null;
    const assembly = bayAssembly(stable, rigId);
    const snapshot = rig.playerCondition?.parts?.[slot] ??
        createTargetCondition(assembly, true).parts[slot];
    const destroyed = !!snapshot?.destroyed || !!owned.destroyed;
    return { amount: destroyed ? rebuildQuote(snapshot) : repairQuote(snapshot),
        destroyed, serial:owned.serial };
}
