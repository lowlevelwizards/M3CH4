/** Garage servicing is deliberately a single assembly-level operation in 0.0.1e.1.
 * The existing unique owned part is restored; it is not replaced or re-created.
 * No shop, currencies, wear reset, or persistence in this stage. */
import { installedPart } from './components.js';
const clamp01 = (value) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
/** Both sections of the paired leg unit belong to the same owned assembly.
 * This is deliberately NOT two new equipment slots. */
export function driveCondition(assembly, state) {
    const part = installedPart(assembly, 'mobility');
    if (!part)
        return null;
    const drive = state.drives[part.instance.serial];
    return drive
        ? { left: clamp01(drive.left), right: clamp01(drive.right) }
        : { left: clamp01(part.instance.condition), right: clamp01(part.instance.condition) };
}
/** Repairs only the selected installed serial. Worn-but-undamaged parts are unchanged.
 * A returned part remains the same owned object, including its serial and wear. */
export function repairInstalledPart(assembly, state, slot) {
    const part = installedPart(assembly, slot);
    if (!part)
        return { repaired: false, serial: null, previousCondition: 0, condition: 0, repairs: 0 };
    const owned = part.instance;
    const previousCondition = clamp01(owned.condition);
    const sections = slot === 'mobility' ? driveCondition(assembly, state) : null;
    const damaged = previousCondition < 1 - 1e-6 || !!sections && (sections.left < 1 - 1e-6 || sections.right < 1 - 1e-6);
    if (damaged) {
        owned.condition = 1;
        if (slot === 'mobility')
            state.drives[owned.serial] = { left: 1, right: 1 };
        owned.repairs += 1;
    }
    return { repaired: damaged, serial: owned.serial, previousCondition, condition: clamp01(owned.condition), repairs: owned.repairs };
}
