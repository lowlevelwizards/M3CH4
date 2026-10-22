/** Build 0 — controlled, reproducible mechanical cohorts on LIVE legal rigs.
 * This is fixed-step Node physics, NOT a geometry raycast, tactical win-rate
 * claim, full terrain simulation or an iPhone/Safari performance result.
 *
 * node research/balanceMechanicalCohorts.mjs
 * node research/balanceMechanicalCohorts.mjs --json
 */
import { pathToFileURL } from 'node:url';
import { SLOTS, makeTestAssembly, equip, inspectAssembly } from '../components.js';
import { deriveRigConfig } from '../assemblyPhysics.js';
import { createRigState, stepRig } from '../locomotion.js';
import { createFunctionalDamage, functionalOutput, derateRigConfig } from '../functionalDamage.js';
import { createPowerSystem, advancePowerSystem, powerConstrainedOutput, registerPowerShot } from '../powerDynamics.js';
import { WEAPONS, createWeaponState, fireWeapon, advanceWeapon, startReload, applyRecoil } from '../combat.js';

const DT = 1 / 60;
const NEUTRAL = Object.freeze({ throttle: 0, strafe: 0, steer: 0, brake: 0 });
const WORLD = Object.freeze({ minX: -100, maxX: 100, minZ: -100, maxZ: 100, obstacles: [] });
const OBSTACLE = Object.freeze({ minX: -1, maxX: 1, minZ: -2, maxZ: 2 });
const WALL_WORLD = { ...WORLD, obstacles: [OBSTACLE] };
const RECIPES = Object.freeze({
    workhorse: ['frame-sr', 'legs-yard', 'power-dynamo', 'cab-cyclops', 'gun-cannon'],
    precision: ['frame-utility', 'legs-compact', 'power-air', 'cab-utility', 'gun-light'],
    anchor: ['frame-wedge', 'legs-hauler', 'power-dynamo', 'cab-cyclops', 'gun-short'],
    raider: ['frame-utility', 'legs-compact', 'power-air', 'cab-utility', 'gun-scatter'],
    protected: ['frame-sr', 'legs-hauler', 'power-dynamo', 'cab-armored', 'gun-short'],
    // Controlled heavier/light frame and weapon comparisons; legality is still
    // checked by inspectAssembly, never asserted by the cohort's name.
    yardLight: ['frame-utility', 'legs-yard', 'power-air', 'cab-utility', 'gun-short'],
    haulerLight: ['frame-utility', 'legs-hauler', 'power-dynamo', 'cab-utility', 'gun-short'],
    kestrelHeavy: ['frame-sr', 'legs-compact', 'power-dynamo', 'cab-cyclops', 'gun-cannon'],
});

const rounded = (x) => Number.isFinite(x) ? Math.round(x * 10000) / 10000 : null;
function prepared(recipeIds) {
    const recipe = Object.fromEntries(SLOTS.map((slot, i) => [slot, recipeIds[i]]));
    const assembly = makeTestAssembly();
    try {
        for (const slot of SLOTS) equip(assembly, slot, recipe[slot]);
    } catch (error) {
        return { recipe, legal: false, reasons: [{ check: 'mount', reason: error.message }] };
    }
    const inspection = inspectAssembly(assembly);
    if (!inspection.ready) {
        return { recipe, legal: false,
            reasons: inspection.checks.filter(c => !c.passes).map(c => ({
                check: c.id, reason: c.reason,
            })) };
    }
    return { recipe, legal: true, assembly, inspection, baseConfig: deriveRigConfig(assembly) };
}

function runSteps(config, phases, initial = {}, world = WORLD, shotImpulse = 0) {
    const rig = Object.assign(createRigState({ x: 0, z: 0, yaw: 0 }), initial);
    let distance = 0, collisions = 0, tractionFrames = 0, braceFrames = 0,
        maxSlip = 0, lastX = rig.x, lastZ = rig.z;
    if (shotImpulse) applyRecoil(rig, config, 0, -1, shotImpulse);
    for (const { seconds, input } of phases) {
        for (let i = 0; i < Math.round(seconds / DT); i++) {
            stepRig(rig, input, DT, config, world);
            distance += Math.hypot(rig.x - lastX, rig.z - lastZ);
            lastX = rig.x; lastZ = rig.z;
            collisions += Number(rig.impact > .005);
            tractionFrames += Number(rig.tractionSaturated);
            braceFrames += Number(rig.braced);
            maxSlip = Math.max(maxSlip, rig.footSlipMps);
        }
    }
    return {
        xM: rounded(rig.x), zM: rounded(rig.z),
        headingDeg: rounded(rig.yaw * 180 / Math.PI),
        yawRateDegPerS: rounded(rig.yawRate * 180 / Math.PI),
        speedMps: rounded(Math.hypot(rig.vx, rig.vz)),
        forwardMps: rounded(rig.forwardSpeed),
        lateralMps: rounded(rig.lateralSpeed),
        distanceM: rounded(distance),
        contactsWithImpactFrames: collisions, tractionFrames, braceFrames,
        maxSlipMps: rounded(maxSlip), braceFraction: rounded(rig.brace),
        // The actual obstacle's physical footprint may be inflated by the
        // fitted rig collision radius; check the center, not its rendering.
        outsideObstacle: !world.obstacles.some(o =>
            rig.x >= o.minX && rig.x <= o.maxX && rig.z >= o.minZ && rig.z <= o.maxZ),
    };
}

function electricalTrial(assembly, baseConfig, gunId, powerCondition, phase) {
    const rig = createRigState({ x: 0, z: 0, yaw: 0 });
    const power = createPowerSystem(assembly), damage = createFunctionalDamage();
    const spec = WEAPONS[gunId], weapon = createWeaponState(spec);
    let minBus = 1, maxDemandKw = 0, brownoutFrames = 0,
        shots = 0, powerBlockedTriggers = 0, lowReserve = 1;
    const duration = phase === 'recover' ? 8 : 4;
    for (let n = 0; n < duration / DT; n++) {
        const active = phase !== 'idle' && (phase !== 'recover' || n * DT < 4);
        const input = active ? { ...NEUTRAL, throttle: .85, steer: .30, strafe: .20 } : NEUTRAL;
        advancePowerSystem(power, assembly, rig, DT, powerCondition);
        const status = powerConstrainedOutput(functionalOutput(assembly, damage), power);
        const config = derateRigConfig(baseConfig, status);
        stepRig(rig, input, DT, config, WORLD);
        advanceWeapon(weapon, spec, DT);
        if (active && (phase === 'mixed' || phase === 'recover')) {
            if (power.weaponReady) {
                const fired = fireWeapon(weapon, spec);
                if (fired !== null) { shots++; registerPowerShot(power, assembly); }
                else if (weapon.loaded === 0 && weapon.reloadLeft === 0)
                    startReload(weapon, spec);
            } else if (weapon.loaded > 0 && weapon.reloadLeft === 0) {
                powerBlockedTriggers++;
            }
        }
        minBus = Math.min(minBus, power.busRatio);
        maxDemandKw = Math.max(maxDemandKw, power.demandKw);
        lowReserve = Math.min(lowReserve, power.reserveFraction);
        brownoutFrames += Number(power.brownout);
    }
    return { phase, powerCondition, minBus: rounded(minBus),
        maxDemandKw: rounded(maxDemandKw), brownoutFrames,
        lowReserve: rounded(lowReserve),
        endReserve: rounded(power.reserveFraction), shots, powerBlockedTriggers,
        ammoSpent: spec.magazine + spec.spareRounds - weapon.loaded - weapon.reserve };
}

function measureVariant(name, recipeIds, driveLeft, driveRight, powerCondition) {
    const base = prepared(recipeIds);
    if (!base.legal) return { name, recipe: base.recipe, legal: false, reasons: base.reasons };
    const { assembly, inspection, baseConfig, recipe } = base;
    const damage = createFunctionalDamage();
    const serial = assembly.installed.mobility;
    damage.drives[serial] = { left: driveLeft, right: driveRight };
    // The installed real module's serial condition is authoritative.
    assembly.owned.find(part => part.serial === serial).condition = (driveLeft + driveRight) / 2;
    assembly.owned.find(part => part.serial === assembly.installed.power).condition = powerCondition;
    const output = functionalOutput(assembly, damage);
    const config = derateRigConfig(baseConfig, output);
    const phase = (seconds, input) => [{ seconds, input }];
    const recoil = WEAPONS[recipe.combat].recoilImpulseNs;
    const runs = {
        launch1s: runSteps(config, phase(1, { ...NEUTRAL, throttle: 1 })),
        launch3s: runSteps(config, phase(3, { ...NEUTRAL, throttle: 1 })),
        reverseTransition: runSteps(config, [
            { seconds: 1, input: { ...NEUTRAL, throttle: 1 } },
            { seconds: 1.5, input: { ...NEUTRAL, throttle: -1 } },
        ]),
        sidestep1s: runSteps(config, phase(1, { ...NEUTRAL, strafe: 1 })),
        stationarySteer1s: runSteps(config, phase(1, { ...NEUTRAL, steer: 1 })),
        movingSteer1s: runSteps(config, phase(1, { ...NEUTRAL, steer: 1, throttle: .8 }), { vz: -4 }),
        brake1s: runSteps(config, phase(1, { ...NEUTRAL, brake: 1 }), { vz: -5 }),
        brakeAndSteer: runSteps(config, phase(1, { ...NEUTRAL, brake: 1, steer: 1 }), { vz: -5 }),
        brace1s: runSteps(config, phase(1, { ...NEUTRAL, brake: 1 })),
        recoilHalfSecond: runSteps(config, phase(.5, NEUTRAL), {}, WORLD, recoil),
        recoilBraced: runSteps(config, [
            { seconds: .5, input: { ...NEUTRAL, brake: 1 } },
            { seconds: .5, input: { ...NEUTRAL, brake: 1 } },
        ], {}, WORLD, recoil),
        wallContact: runSteps(config, phase(3, { ...NEUTRAL, throttle: 1 }),
            { x: 0, z: 5, yaw: 0 }, WALL_WORLD),
        wallReverseRecovery: runSteps(config, [
            { seconds: 2, input: { ...NEUTRAL, throttle: 1 } },
            { seconds: 1.5, input: { ...NEUTRAL, throttle: -1, steer: 1 } },
        ], { x: 0, z: 5, yaw: 0 }, WALL_WORLD),
    };
    return { name, recipe, legal: true, variant: { driveLeft, driveRight, powerCondition },
        massKg: inspection.massKg, headroomKw: inspection.powerAvailableKw - inspection.powerUsedKw,
        runs, power: ['idle', 'mixed', 'recover'].map(phaseName =>
            electricalTrial(assembly, baseConfig, recipe.combat, powerCondition, phaseName)) };
}

export function runBalanceMechanicalCohorts() {
    const cohorts = [];
    for (const [name, recipe] of Object.entries(RECIPES)) {
        cohorts.push(measureVariant(name, recipe, 1, 1, 1));
        cohorts.push(measureVariant(name + ':worn', recipe, .65, .65, .8));
        cohorts.push(measureVariant(name + ':left-drive-hit', recipe, .25, 1, 1));
        cohorts.push(measureVariant(name + ':damaged-power', recipe, 1, 1, .6));
    }
    return {
        schemaVersion: 1, sampleHz: 60, source: 'real inspectAssembly + stepRig + derateRigConfig + powerDynamics + fireWeapon',
        restrictions: 'Fixed unobstructed/one-AABB scenarios; no real Three.js hits, opponents, terrain friction, browser or human playtesting',
        namedRecipes: Object.keys(RECIPES), cohorts,
    };
}

export function formatBalanceMechanicalCohorts(report = runBalanceMechanicalCohorts()) {
    const lines = [
        '# Build 0 — Controlled Mechanical Cohorts',
        'All entries are real inspected five-station assemblies and 60Hz deterministic physics.',
        'No rendered geometry, tactical AI, real ground material or phone UX conclusions.',
        '',
        '| Cohort | kg | Headroom kW | Launch 1s m | Stationary 1s yaw ° | Moving 1s yaw ° | Brake residual m/s | Wall recovery m | Mixed bus min |',
        '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    ];
    for (const c of report.cohorts) {
        if (!c.legal) { lines.push('| ' + c.name + ' | INVALID | — | — | — | — | — | — | — |'); continue; }
        lines.push('| ' + [
            c.name, c.massKg, c.headroomKw, c.runs.launch1s.distanceM,
            c.runs.stationarySteer1s.headingDeg, c.runs.movingSteer1s.headingDeg,
            c.runs.brake1s.speedMps, c.runs.wallReverseRecovery.distanceM,
            c.power.find(p => p.phase === 'mixed').minBus,
        ].join(' | ') + ' |');
    }
    return lines.join('\n') + '\n';
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const report = runBalanceMechanicalCohorts();
    process.stdout.write(process.argv.includes('--json')
        ? JSON.stringify(report, null, 2) + '\n' : formatBalanceMechanicalCohorts(report));
}
