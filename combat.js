/** 0.0.1c: fixed-step range weapon and localized target condition.
 * Pure data and math: Three.js decides which physical mesh was hit; this module
 * resolves only the owned component serial behind that mesh. No AI or repairs. */
import { equip, installedPart, makeTestAssembly, SLOTS } from './components.js';
export const WEAPONS = {
    'gun-cannon': { id: 'gun-cannon', label: 'TRAINING CANNON', magazine: 12, spareRounds: 60, roundsPerSecond: 2.4, reloadSeconds: 2.5, damage: 38, recoilImpulseNs: 1350, spread: .004, muzzleZ: -1.90 },
    'gun-short': { id: 'gun-short', label: 'STUMP CANNON', magazine: 8, spareRounds: 48, roundsPerSecond: 2.0, reloadSeconds: 2.1, damage: 47, recoilImpulseNs: 1950, spread: .012, muzzleZ: -1.31 },
    'gun-light': { id: 'gun-light', label: 'NEEDLE CANNON', magazine: 16, spareRounds: 80, roundsPerSecond: 3.5, reloadSeconds: 2.8, damage: 28, recoilImpulseNs: 850, spread: .002, muzzleZ: -2.73 },
};
export function weaponFor(assembly) {
    const id = installedPart(assembly, 'combat')?.definition.id;
    return id ? (WEAPONS[id] ?? null) : null;
}
export function createWeaponState(spec) {
    return { loaded: spec.magazine, reserve: spec.spareRounds, cooldown: 0, reloadLeft: 0, firingCount: 0 };
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
    const backwardsX = -aimX / length * impulseNs;
    const backwardsZ = -aimZ / length * impulseNs;
    rig.vx += backwardsX / config.massKg;
    rig.vz += backwardsZ / config.massKg;
    // Rotate the local weapon offset by -physicsYaw into world space.
    const c = Math.cos(rig.yaw), s = Math.sin(rig.yaw);
    const rx = mountX * c - mountZ * s;
    const rz = mountX * s + mountZ * c;
    const yTorqueImpulse = rz * backwardsX - rx * backwardsZ;
    rig.yawRate -= yTorqueImpulse / config.yawInertiaKgM2;
    rig.impact = Math.min(1, rig.impact + impulseNs / (config.massKg * 4));
}
/** Deterministic second owned machine, not an alias of the player's serials. */
export function makeRangeTarget() {
    const target = makeTestAssembly();
    target.serial = 'TGT-01';
    target.name = 'SCRAPYARD TARGET';
    const serials = new Map();
    target.owned.forEach((part, index) => {
        const next = `TGT01-${String(index + 1).padStart(3, '0')}`;
        serials.set(part.serial, next);
        part.serial = next;
    });
    for (const slot of SLOTS) {
        const current = target.installed[slot];
        if (current)
            target.installed[slot] = serials.get(current);
    }
    equip(target, 'combat', 'gun-short');
    equip(target, 'power', 'power-air');
    return target;
}
/** Initial armor represents each installed assembly's housing; no separate armor slots yet. */
export const TARGET_RESILIENCE = {
    structure: [230, 70], mobility: [150, 38], power: [95, 24], command: [105, 32], combat: [115, 26],
};
export function createTargetCondition(assembly) {
    const parts = {};
    for (const slot of SLOTS) {
        const installed = installedPart(assembly, slot);
        if (!installed)
            throw new Error(`Target requires ${slot} to use physical hit volumes.`);
        const [maxIntegrity, maxArmor] = TARGET_RESILIENCE[slot];
        parts[slot] = {
            serial: installed.instance.serial, slot, name: installed.definition.name,
            integrity: maxIntegrity, maxIntegrity, armor: maxArmor, maxArmor, impacts: 0,
        };
    }
    return { parts, shotsHit: 0 };
}
/** The target's underlying unique owned component records the same acute condition.
 * Damage is not persisted to storage yet; this is one internal authority per session. */
export function mirrorTargetCondition(assembly, target) {
    for (const slot of SLOTS) {
        const part = target.parts[slot];
        const owned = assembly.owned.find(item => item.serial === part.serial);
        if (owned)
            owned.condition = part.integrity / part.maxIntegrity;
    }
}
/** One hit resolves one physically selected assembly: armor first, then underlying condition. */
export function applyTargetHit(target, slot, damage) {
    const part = target.parts[slot];
    if (!part || !Number.isFinite(damage) || damage < 0)
        throw new Error('Invalid physical hit.');
    const absorbed = Math.min(part.armor, damage);
    const internalDamage = Math.min(part.integrity, damage - absorbed);
    part.armor -= absorbed;
    part.integrity -= internalDamage;
    part.impacts++;
    target.shotsHit++;
    return {
        slot, serial: part.serial, armorAbsorbed: absorbed, internalDamage,
        remainingArmor: part.armor, remainingIntegrity: part.integrity,
        disabled: part.integrity <= 0,
    };
}
