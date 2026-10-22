/** 0.0.1c: fixed-step range weapon and localized target condition.
 * Pure data and math: Three.js decides which physical mesh was hit; this module
 * resolves only the owned component serial behind that mesh. No AI or repairs. */
import { equip, installedPart, makeTestAssembly, SLOTS } from './components.js';
import { createWeaponActionState, advanceWeaponAction, recordWeaponEmission } from './weaponController.js';
import { mobilityPerformance } from './mobilityPerformance.js';
import { contractById, selectedContract } from './contracts.js';
import { applyDestructionOverflow, hydrateDamageFate } from './damageFate.js';
export const WEAPONS = {
    'gun-cannon': { id: 'gun-cannon', label: 'TRAINING CANNON', magazine: 12, spareRounds: 60, roundsPerSecond: 2.4, reloadSeconds: 2.5, damage: 38, recoilImpulseNs: 1725, spread: .004, muzzleZ: -1.90, visualRecoil: .92, visualRecovery: 3.05, muzzleFlashSeconds: .095, handling: 'UTILITY / BALANCED' },
    'gun-short': { id: 'gun-short', label: 'STUMP CANNON', magazine: 8, spareRounds: 48, roundsPerSecond: 2.0, reloadSeconds: 2.1, damage: 47, recoilImpulseNs: 2550, spread: .012, muzzleZ: -1.31, visualRecoil: 1.38, visualRecovery: 2.25, muzzleFlashSeconds: .135, handling: 'CLUNKY / HEAVY KICK' },
    'gun-light': { id: 'gun-light', label: 'NEEDLE CANNON', magazine: 16, spareRounds: 80, roundsPerSecond: 3.5, reloadSeconds: 2.8, damage: 28, recoilImpulseNs: 1050, spread: .002, muzzleZ: -2.73, visualRecoil: .56, visualRecovery: 4.8, muzzleFlashSeconds: .065, handling: 'LIGHT / FAST RECOVERY' },
    'gun-scatter': { id: 'gun-scatter', label: 'S-6 SCATTERGUN', magazine: 4, spareRounds: 28, roundsPerSecond: 1.0, reloadSeconds: 3.0, pellets: 6, damage: 21, recoilImpulseNs: 3550, spread: .115, muzzleZ: -1.46, visualRecoil: 1.60, visualRecovery: 2.0, muzzleFlashSeconds: .20, handling: 'CLOSE / SIX PHYSICAL PELLETS' },
    'gun-rivet': { id: 'gun-rivet', label: 'RR-4 RIVET REPEATER', fireMode: 'automatic', magazine: 60, spareRounds: 216, roundsPerSecond: 8.5, reloadSeconds: 4.2, damage: 10, recoilImpulseNs: 470, spread: .014, sustainedSpread: .034, muzzleZ: -1.60, visualRecoil: .26, visualRecovery: 9.0, muzzleFlashSeconds: .045, handling: 'AUTOMATIC / LANE PRESSURE' },
};
export function weaponFor(assembly) {
    const id = installedPart(assembly, 'combat')?.definition.id;
    return id ? (WEAPONS[id] ?? null) : null;
}
export function createWeaponState(spec) {
    return { loaded: spec.magazine, reserve: spec.spareRounds, cooldown: 0, reloadLeft: 0, firingCount: 0, action: createWeaponActionState(spec) };
}
export function startReload(state, spec) {
    if (state.reloadLeft > 0 || state.loaded >= spec.magazine || state.reserve <= 0)
        return false;
    state.reloadLeft = spec.reloadSeconds;
    return true;
}
export function advanceWeapon(state, spec, dt) {
    if (!Number.isFinite(dt) || dt <= 0)
        return;
    state.cooldown = Math.max(0, state.cooldown - dt);
    advanceWeaponAction(state, spec, dt);
    if (state.reloadLeft > 0) {
        state.reloadLeft = Math.max(0, state.reloadLeft - dt);
        if (state.reloadLeft === 0) {
            const transferred = Math.min(spec.magazine - state.loaded, state.reserve);
            state.loaded += transferred;
            state.reserve -= transferred;
        }
    }
}
/** Return shot index when a round is actually consumed; never invent a shot during reload. */
export function fireWeapon(state, spec) {
    if (state.reloadLeft > 0 || state.cooldown > 0 || state.loaded <= 0)
        return null;
    state.loaded--;
    state.cooldown = 1 / spec.roundsPerSecond;
    recordWeaponEmission(state, spec);
    return ++state.firingCount;
}
/** Deterministic spread allows a failed target test to be reproduced. */
export function shotSpread(index, spread) {
    const a = ((index * 0.6180339887498949) % 1) * Math.PI * 2;
    const r = Math.sqrt((index * 0.7548776662466927) % 1) * spread;
    return [Math.cos(a) * r, Math.sin(a) * r];
}
/** Newtonian recoil translated directly into the existing horizontal physics state.
 * The weapon sits on rig-right; recoil also yaws the chassis, not just the camera. */
export function applyRecoil(rig, config, aimX, aimZ, impulseNs, mountX = 1.17, mountZ = -0.65) {
    const length = Math.hypot(aimX, aimZ);
    if (length < 1e-6 || impulseNs <= 0)
        return;
    // A planted drive passes some impulse into the ground through its actual
    // available lateral grip. Never overwrite velocity already on the rig.
    // Unbraced shots remain exactly the original Newtonian recoil.
    const gripToWeight = Math.max(0, Math.min(1, config.lateralGripNsPerM / (config.massKg * 4)));
    const stance = Math.max(0, Math.min(1, rig.brace ?? 0));
    const absorbed = stance * (.18 + .38 * gripToWeight);
    const transmittedImpulseNs = impulseNs * (1 - absorbed);
    const backwardsX = -aimX / length * transmittedImpulseNs;
    const backwardsZ = -aimZ / length * transmittedImpulseNs;
    rig.vx += backwardsX / config.massKg;
    rig.vz += backwardsZ / config.massKg;
    // Rotate the local weapon offset by -physicsYaw into world space.
    const c = Math.cos(rig.yaw), s = Math.sin(rig.yaw);
    const rx = mountX * c - mountZ * s;
    const rz = mountX * s + mountZ * c;
    const yTorqueImpulse = rz * backwardsX - rx * backwardsZ;
    rig.yawRate -= yTorqueImpulse / config.yawInertiaKgM2;
    // This transmitted recoil must be caught by the feet on subsequent
    // physics ticks. Small-grip legs stay loaded longer than planted loaders.
    // It consumes temporary contact capacity; it never removes linear momentum.
    rig.recoilLoad = Math.min(1, (rig.recoilLoad ?? 0) +
        transmittedImpulseNs / Math.max(1, config.lateralGripNsPerM * .75));
    rig.impact = Math.min(1, rig.impact + impulseNs / (config.massKg * 4));
}
/** Build one authored opponent from the selected contract. The target still uses
 * the same real catalogue definitions, mounting validation and localized damage
 * as the player's machine; only the recipe changes between contracts. */
export function makeRangeTarget(contractId = selectedContract().id) {
    const contract = contractById(contractId);
    const target = makeTestAssembly();
    for (const slot of SLOTS) {
        const definitionId = contract.loadout[slot];
        if (definitionId)
            equip(target, slot, definitionId);
    }
    target.serial = contract.opponentSerial;
    target.name = contract.name;
    target.contractId = contract.id;
    target.salvagePriority = [...contract.salvagePriority];

    // Rename after the recipe is fully mounted, then let graph consumers rebuild
    // from those final physical serials rather than carrying the test-rig graph.
    const serials = new Map();
    target.owned.forEach((part, index) => {
        const next = `${contract.serialPrefix}-${String(index + 1).padStart(3, '0')}`;
        serials.set(part.serial, next);
        part.serial = next;
    });
    for (const slot of SLOTS) {
        const current = target.installed[slot];
        if (current)
            target.installed[slot] = serials.get(current);
    }
    delete target.graph;
    return target;
}
/**
 * k.3j.1 durability normalization.
 *
 * Armor now carries most of the fresh-machine survivability so combat has a real
 * housing -> breach -> degraded internals arc instead of simply inflating internal
 * HP. At full condition the three current weapons require roughly three seconds of
 * perfect focused fire to mission-kill a critical subsystem. Center-mass frame
 * kills exceed every current magazine and therefore force a reload (about 7-8 s
 * of mathematically perfect held fire). Mobility keeps its family damage scale,
 * making Kestrel meaningfully fragile and Hauler meaningfully stubborn.
 */
export const TARGET_RESILIENCE = {
    structure: [260, 250],
    mobility: [170, 185],
    power: [110, 190],
    command: [120, 185],
    combat: [130, 180],
};
function targetPartFor(assembly, slot, useOwnedCondition = false) {
    const installed = installedPart(assembly, slot);
    if (!installed)
        throw new Error(`Target requires ${slot} to use physical hit volumes.`);
    const [maxIntegrity, maxArmor] = TARGET_RESILIENCE[slot];
    const condition = useOwnedCondition ? Math.max(0, Math.min(1, installed.instance.condition)) : 1;
    const damageTakenScale = slot === 'mobility'
        ? mobilityPerformance(installed.definition.id).damageTakenScale
        : 1;
    const part = {
        serial: installed.instance.serial, slot, name: installed.definition.name,
        integrity: maxIntegrity * condition, maxIntegrity, armor: maxArmor, maxArmor, impacts: 0,
        damageTakenScale, destruction: 0, destroyed: false,
    };
    if (useOwnedCondition && installed.instance.destroyed) {
        part.integrity = 0;
        hydrateDamageFate(part, { destroyed: true });
    }
    return part;
}
/** One installed part can be inspected or serviced in an unfinished garage bay.
 * Full createTargetCondition deliberately remains strict for fieldable combat rigs. */
export function createTargetPartCondition(assembly, slot, useOwnedCondition = false) {
    return targetPartFor(assembly, slot, useOwnedCondition);
}
export function createTargetCondition(assembly, useOwnedCondition = false) {
    const parts = {};
    for (const slot of SLOTS)
        parts[slot] = targetPartFor(assembly, slot, useOwnedCondition);
    return { parts, shotsHit: 0 };
}
/** Preserve combat wear for unchanged serials while accepting a newly fitted owned module. */
export function reconcileTargetCondition(target, assembly) {
    for (const slot of SLOTS) {
        const installed = installedPart(assembly, slot);
        if (!installed)
            continue;
        if (target.parts[slot]?.serial !== installed.instance.serial)
            target.parts[slot] = targetPartFor(assembly, slot, true);
    }
}
/** A garage repair restores this module's local housing and internal integrity without replacing its serial. */
export function restoreTargetPart(target, assembly, slot) {
    target.parts[slot] = targetPartFor(assembly, slot, true);
}
/** The target's underlying unique owned component records the same acute condition.
 * Damage is not persisted to storage yet; this is one internal authority per session. */
export function mirrorTargetCondition(assembly, target) {
    for (const slot of SLOTS) {
        const part = target.parts[slot];
        const owned = assembly.owned.find(item => item.serial === part.serial);
        if (owned) {
            owned.condition = part.integrity / part.maxIntegrity;
            owned.destroyed = !!part.destroyed;
        }
    }
}
/** One hit resolves one physically selected assembly: armor first, then underlying condition. */
export function applyTargetHit(target, slot, damage) {
    const part = target.parts[slot];
    if (!part || !Number.isFinite(damage) || damage < 0)
        throw new Error('Invalid physical hit.');
    const effectiveDamage = damage * (part.damageTakenScale ?? 1);
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
    };
}