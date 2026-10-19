/** k.3v.0 — reproducible, headless identity measurements.
 * This calls actual assembled legality, locomotion, recoil and weapon authority.
 * No renderer, browser, fictitious hit/LOS simulation or gameplay mutation.
 * Run: node research/partIdentityBaseline.mjs
 *      node research/partIdentityBaseline.mjs --json
 */
import { pathToFileURL } from 'node:url';
import { CATALOG, SLOTS, makeTestAssembly, equip, inspectAssembly } from '../components.js';
import { deriveRigConfig } from '../assemblyPhysics.js';
import { createRigState, stepRig } from '../locomotion.js';
import { WEAPONS, applyRecoil, createWeaponState, fireWeapon, advanceWeapon, startReload } from '../combat.js';
import { basePartValue } from '../partEconomy.js';
import { createFunctionalDamage, functionalOutput } from '../functionalDamage.js';

const DT = 1 / 60;
const WORLD = Object.freeze({ minX: -1000, maxX: 1000, minZ: -1000, maxZ: 1000, obstacles: [] });
const STOP = Object.freeze({ throttle: 0, strafe: 0, steer: 0, brake: 0 });
const FRAMES = ['frame-sr', 'frame-utility', 'frame-wedge'];
const LEGS = ['legs-yard', 'legs-compact', 'legs-hauler'];
const GUNS = ['gun-cannon', 'gun-short', 'gun-light', 'gun-scatter'];
const GENERATORS = ['power-dynamo', 'power-air'];
const CABS = ['cab-cyclops', 'cab-utility', 'cab-armored'];
const DEFAULT_RECIPE = Object.freeze({
    structure: 'frame-sr', mobility: 'legs-yard', power: 'power-dynamo',
    command: 'cab-cyclops', combat: 'gun-cannon',
});

export function buildMeasuredAssembly(changes = {}) {
    const recipe = { ...DEFAULT_RECIPE, ...changes };
    const assembly = makeTestAssembly();
    for (const slot of SLOTS) if (recipe[slot] !== DEFAULT_RECIPE[slot])
        equip(assembly, slot, recipe[slot]);
    return { assembly, inspection: inspectAssembly(assembly), recipe };
}

function advanceFor(config, seconds, input, initial = {}) {
    const rig = Object.assign(createRigState({ x: 0, z: 0, yaw: 0 }), initial);
    for (let step = 0; step < Math.round(seconds / DT); step++)
        stepRig(rig, input, DT, config, WORLD);
    return rig;
}

function brakeDistance(config) {
    const rig = Object.assign(createRigState({ x: 0, z: 0, yaw: 0 }), { vz: -5 });
    for (let i = 0; i < 600; i++) {
        stepRig(rig, { ...STOP, brake: 1 }, DT, config, WORLD);
        if (Math.abs(rig.forwardSpeed) <= .05)
            return Math.hypot(rig.x, rig.z);
    }
    return null; // Report a missing stop rather than inventing a distance.
}
function turnTime(config) {
    const rig = createRigState({ x: 0, z: 0, yaw: 0 });
    for (let i = 0; i < 1200; i++) {
        stepRig(rig, { ...STOP, steer: 1 }, DT, config, WORLD);
        if (rig.yaw >= Math.PI / 2) return (i + 1) * DT;
    }
    return null;
}
function recoilResponse(config, weapon) {
    const rig = createRigState({ x: 0, z: 0, yaw: 0 });
    applyRecoil(rig, config, 0, -1, weapon.recoilImpulseNs);
    const impulseVelocityMps = Math.hypot(rig.vx, rig.vz);
    const impulseYawRateRadS = Math.abs(rig.yawRate);
    for (let i = 0; i < 30; i++) stepRig(rig, STOP, DT, config, WORLD);
    return { impulseVelocityMps, impulseYawRateRadS, driftAfterHalfSecondM: Math.hypot(rig.x, rig.z), yawAfterHalfSecondRad: rig.yaw };
}
function gunCycle(spec) {
    const state = createWeaponState(spec);
    let shots = 0, reloadsStarted = 0;
    for (let i = 0; i < 8 * 60; i++) {
        if (state.loaded === 0 && state.reloadLeft === 0 && startReload(state, spec))
            reloadsStarted++;
        if (fireWeapon(state, spec) !== null) shots++;
        advanceWeapon(state, spec, DT);
    }
    return { shotsInEightSeconds: shots, reloadsStarted, loaded: state.loaded, reserve: state.reserve, nominalRoundsPerSecond: spec.roundsPerSecond, magazine: spec.magazine, nominalDamage: spec.damage, recoilImpulseNs: spec.recoilImpulseNs, spreadRadians: spec.spread };
}
function measure(recipe) {
    const { inspection, assembly } = buildMeasuredAssembly(recipe);
    const id = { frame: recipe.structure, legs: recipe.mobility, gun: recipe.combat, generator: recipe.power, cab: recipe.command };
    const base = { ...id, ready: inspection.ready, massKg: inspection.massKg,
        demandKw: inspection.powerUsedKw, availableKw: inspection.powerAvailableKw,
        headroomKw: inspection.powerAvailableKw - inspection.powerUsedKw,
        adaptersKg: inspection.adapters.reduce((sum, a) => sum + a.massKg, 0) };
    if (!inspection.ready)
        return { ...base, reasons: inspection.checks.filter(c => !c.passes).map(c => c.id + ': ' + c.reason) };
    const config = deriveRigConfig(assembly);
    const accelerated = advanceFor(config, 1, { ...STOP, throttle: 1 });
    const sideways = advanceFor(config, 1, { ...STOP, strafe: 1 });
    return { ...base,
        speedAfterOneSecondMps: accelerated.forwardSpeed,
        distanceAfterOneSecondM: Math.hypot(accelerated.x, accelerated.z),
        strafeAfterOneSecondMps: sideways.lateralSpeed,
        brakeFromFiveMpsDistanceM: brakeDistance(config),
        remainingSpeedAfterHalfSecondBrakingMps: Math.abs(advanceFor(config, .5, { ...STOP, brake: 1 }, { vz: -5 }).forwardSpeed),
        turnNinetySeconds: turnTime(config),
        recoil: recoilResponse(config, WEAPONS[recipe.combat]) };
}

export function runPartIdentityBaseline() {
    const mechanical = [];
    for (const structure of FRAMES) for (const mobility of LEGS) for (const combat of GUNS) {
        const recipe = { structure, mobility, combat, power: 'power-dynamo', command: 'cab-cyclops' };
        try { mechanical.push(measure(recipe)); }
        catch (error) {
            mechanical.push({ frame: structure, legs: mobility, gun: combat, ready: false, reasons: ['mount: ' + error.message] });
        }
    }
    const powerAndCab = [];
    for (const mobility of LEGS) for (const power of GENERATORS) for (const command of CABS) {
        const recipe = { structure: 'frame-sr', mobility, power, command, combat: 'gun-short' };
        try {
            const { assembly, inspection } = buildMeasuredAssembly(recipe);
            const functional = functionalOutput(assembly, createFunctionalDamage());
            powerAndCab.push({ legs: mobility, generator: power, cab: command,
                ready: inspection.ready, massKg: inspection.massKg,
                demandKw: inspection.powerUsedKw, availableKw: inspection.powerAvailableKw,
                effectivePowerFactorAtFullHealth: functional.powerFactor,
                reasons: inspection.checks.filter(c => !c.passes).map(c => c.reason) });
        }
        catch (error) {
            powerAndCab.push({ legs: mobility, generator: power, cab: command, ready: false, reasons: ['mount: ' + error.message] });
        }
    }
    const catalogue = CATALOG.map(p => ({
        id: p.id, slot: p.slot, massKg: p.massKg, ratedLoadKg: p.loadLimitKg ?? null,
        nominalPowerKw: p.powerKw, yardValueCredits: basePartValue(p.id),
        mount: p.accepts,
    }));
    const weapons = Object.fromEntries(GUNS.map(id => [id, gunCycle(WEAPONS[id])]));
    return { sourceMainSha: '9716f9546d7d522be1a03a7dcfc258e36fcf9ba8',
        hz: 60, world: 'unobstructed measurement plane (not the live warehouse)',
        measurementRules: 'legality checked before every physical metric; no modeled bullet travel, sightline or player touch inputs',
        catalogue, mechanical, powerAndCab, weapons };
}
const round = value => value == null ? '—' : Number(value).toFixed(3);
export function formatPartIdentityBaseline(r) {
    const lines = [
        '# k.3v.0 — measured part identity baseline',
        'Source main: ' + r.sourceMainSha + ' · fixed step ' + r.hz + ' Hz',
        'Measured with shipped inspectAssembly, deriveRigConfig, stepRig, applyRecoil, fireWeapon, and functionalOutput.',
        'This is an unobstructed, full-condition headless proxy; NOT a warehouse, phone, or human playtest.',
        'A dash in full-stop distance means that brake input did NOT converge below 0.05 m/s in 10 seconds; the measured half-second speed remains reported.',
        '',
        '## Frame × mobility × weapon (Dynamo + Cyclops)',
        '| Frame | Legs | Weapon | Deployable | kg | kW headroom | 1s speed m/s | brake 5m/s distance m | 0.5s brake speed m/s | 90° turn s | 0.5s recoil drift m |',
        '|---|---|---|---:|---:|---:|---:|---:|---:|---:|',
    ];
    for (const x of r.mechanical) lines.push('| ' + [x.frame,x.legs,x.gun,x.ready ? 'yes':'NO',
        x.massKg ?? '—',x.headroomKw ?? '—',round(x.speedAfterOneSecondMps),
        round(x.brakeFromFiveMpsDistanceM),round(x.remainingSpeedAfterHalfSecondBrakingMps),round(x.turnNinetySeconds),
        round(x.recoil?.driftAfterHalfSecondM)].join(' | ') + ' |' + (x.ready ? '' : ' — ' + x.reasons.join('; ')));
    lines.push('', '## Generator × cab viability (Bruiser + Stump)',
        '| Legs | Power | Cab | Deployable | kg | kW demand / available |',
        '|---|---|---|---:|---:|---:|');
    for (const x of r.powerAndCab) lines.push('| ' +
        [x.legs,x.generator,x.cab,x.ready ? 'yes' : 'NO',x.massKg ?? '—',
            x.demandKw == null ? '—' : x.demandKw + ' / ' + x.availableKw].join(' | ') +
        ' |' + (x.ready ? '' : ' — ' + x.reasons.join('; ')));
    lines.push('', '## Unobstructed held-trigger, 8-second real weapon state cycles',
        '| Weapon | 8s shots | reloads started | remaining loaded / reserve | per-shot damage | recoil Ns | spread radians |',
        '|---|---:|---:|---:|---:|---:|---:|');
    for (const [id, x] of Object.entries(r.weapons))
        lines.push('| ' + [id,x.shotsInEightSeconds,x.reloadsStarted,x.loaded + ' / ' + x.reserve,
            x.nominalDamage,x.recoilImpulseNs,x.spreadRadians].join(' | ') + ' |');
    return lines.join('\n');
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const report = runPartIdentityBaseline();
    process.stdout.write((process.argv.includes('--json') ? JSON.stringify(report, null, 2) : formatPartIdentityBaseline(report)) + '\n');
}
