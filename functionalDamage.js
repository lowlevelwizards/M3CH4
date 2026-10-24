/** 0.0.1d: Acute internal damage, keyed by physical owned serial.
 * The existing five assembly slots stay intact: the paired locomotion module
 * contains independently damaged left/right drive sections, not new shop slots.
 * No rendering, randomness, persistence, repairs or enemy AI in this module. */
import { inspectAssembly, installedPart } from './components.js';
import {weaponDamageResponse} from './woundResponse.js';
const clamp01 = (n) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));
export function createFunctionalDamage() { return { drives: {} }; }
function driveSections(assembly, state) {
    const part = installedPart(assembly, 'mobility');
    if (!part)
        return null;
    const serial = part.instance.serial;
    return state.drives[serial] ??= { left: clamp01(part.instance.condition), right: clamp01(part.instance.condition) };
}
/** Directly damage internals during a controlled training test (armor is not simulated here).
 * Mutates the actual owned part, so swapping another module doesn't heal it. */
export function damageInstalledPart(assembly, state, slot, amount, side) {
    const installed = installedPart(assembly, slot);
    if (!installed || !Number.isFinite(amount) || amount < 0)
        return 0;
    if (slot === 'mobility') {
        const sections = driveSections(assembly, state);
        if (side)
            sections[side] = clamp01(sections[side] - amount);
        else {
            sections.left = clamp01(sections.left - amount);
            sections.right = clamp01(sections.right - amount);
        }
        installed.instance.condition = (sections.left + sections.right) / 2;
    }
    else
        installed.instance.condition = clamp01(installed.instance.condition - amount);
    return installed.instance.condition;
}
/** DEV-only reset. It does not count as a garage repair or alter history. */
export function resetInstalledDamage(assembly, state) {
    for (const slot of ['mobility', 'power', 'combat']) {
        const part = installedPart(assembly, slot);
        if (!part)
            continue;
        part.instance.condition = 1;
        part.instance.destroyed = false;
        if (slot === 'mobility')
            state.drives[part.instance.serial] = { left: 1, right: 1 };
    }
}
export function functionalOutput(assembly, state) {
    const sections = driveSections(assembly, state) ?? { left: 0, right: 0 };
    const powerPart = installedPart(assembly, 'power');
    const weaponPart = installedPart(assembly, 'combat');
    const power = clamp01(powerPart?.instance.condition ?? 0);
    const weapon = clamp01(weaponPart?.instance.condition ?? 0);
    const structure=clamp01(installedPart(assembly,'structure')?.instance.condition??0);
    const command=clamp01(installedPart(assembly,'command')?.instance.condition??0);
    const nominalDemandKw = inspectAssembly(assembly).powerUsedKw;
    const powerAvailableKw = Math.max(0, powerPart?.definition.powerKw ?? 0) * power;
    const powerFactor = nominalDemandKw > 0 ? Math.min(1, powerAvailableKw / nominalDemandKw) : 0;
    // Even a battered drive can limp along on remaining structure; a destroyed
    // drive or zero available electrical power cannot generate new motion.
    const left = clamp01(sections.left);
    const right = clamp01(sections.right);
    return {
        left, right, power, powerAvailableKw, nominalDemandKw, powerFactor, weapon, structure, command,
        drive: (left + right) / 2 * powerFactor,
        weaponOperational: weapon > 0 && structure>0 && command>0 && powerAvailableKw >= Math.max(4, Math.abs(weaponPart?.definition.powerKw ?? 0)),
    };
}
/** Translate actual component performance to the *existing* force-based model.
 * Different leg condition makes unequal traction-force / yaw moment, not a generic speed penalty. */
export function derateRigConfig(base, output) {
    const legMean = (output.left + output.right) / 2;
    const pairedAuthority = Math.sqrt(output.left * output.right);
    // Compromised load paths and unreliable controls derate actual actuator
    // authority instead of changing only warning colors or AI willingness.
    const frame=Math.max(0,output.structure??1);
    const control=Math.max(0,output.command??1);
    const support=frame>0 ? .25+.75*Math.sqrt(frame) : 0;
    const commands=control>0 ? .35+.65*Math.sqrt(control) : 0;
    const driveFactor = legMean * output.powerFactor * support * commands;
    return {
        ...base,
        driveForceN: base.driveForceN * driveFactor,
        reverseForceN: base.reverseForceN * driveFactor,
        lateralDriveForceN: base.lateralDriveForceN * pairedAuthority * output.powerFactor * support * commands,
        maxLateralSpeedMps: base.maxLateralSpeedMps * (.2 + .8 * pairedAuthority) * output.powerFactor * support,
        turnTorqueNm: base.turnTorqueNm,
        // A right turn leans more heavily on the left drive and vice versa. The
        // opposite drive still contributes, so one bad leg degrades rather than binary-disables yaw.
        turnRightScale: (.65 * output.left + .35 * output.right) * output.powerFactor * support * commands,
        turnLeftScale: (.65 * output.right + .35 * output.left) * output.powerFactor * support * commands,
        lateralGripNsPerM: base.lateralGripNsPerM * (.5 + .5 * legMean) * (.45+.55*frame),
        // Positive bias turns right: left drive stronger than right; reversible in reverse.
        driveAsymmetryTorqueNm: (output.left - output.right) * base.driveForceN *
            Math.max(.45, base.collisionRadiusM) * .7 * output.powerFactor * support,
    };
}
export function weaponSpreadMultiplier(output) {
    return weaponDamageResponse(output.weapon).spreadMultiplier;
}
export function weaponCycleMultiplier(output) {
    return weaponDamageResponse(output.weapon).cycleMultiplier;
}

/** Reconcile a legitimate mobility field restart with the two physical drives.
 * Preserve stronger surviving drive health; never conjure armor or remove wear.
 */
export function restoreFieldServicedDrive(assembly,state,ratio) {
    const sections=driveSections(assembly,state);
    const installed=installedPart(assembly,'mobility');
    if(!sections||!installed)return;
    const floor=clamp01(ratio);
    sections.left=Math.max(sections.left,floor);
    sections.right=Math.max(sections.right,floor);
    installed.instance.condition=(sections.left+sections.right)/2;
}
