/** Deterministic 60Hz physical handling audit. Identical frame/power/cab/gun;
 * only the installed mobility is exchanged. No renderer, scripted outcome or AI.
 * Usage: node research/mobilityTemperamentStudy.mjs [--json]
 */
import { pathToFileURL } from 'node:url';
import { equip, inspectAssembly, makeTestAssembly } from '../components.js';
import { deriveRigConfig } from '../assemblyPhysics.js';
import { createRigState, stepRig } from '../locomotion.js';
import { WEAPONS, applyRecoil } from '../combat.js';

const DT = 1 / 60;
const WORLD = Object.freeze({ minX: -1000, maxX: 1000, minZ: -1000, maxZ: 1000, obstacles: [] });
const idle = { throttle: 0, strafe: 0, steer: 0, brake: 0 };
const familyList = [
    ['Kestrel','legs-compact'],['Yardwalker','legs-yard'],['Hauler','legs-hauler'],
];
function run(config, phases, preset = {}) {
    const rig = Object.assign(createRigState({ x: 0, z: 0, yaw: 0 }), preset);
    let saturationTicks = 0, peakSlip = 0, maxFootingLoad = 0, traveled = 0, previousX = rig.x, previousZ = rig.z;
    for (const [seconds, input] of phases) {
        for (let step = 0; step < Math.round(seconds / DT); step++) {
            stepRig(rig, input, DT, config, WORLD);
            saturationTicks += Number(rig.tractionSaturated);
            peakSlip = Math.max(peakSlip, rig.footSlipMps);
            maxFootingLoad = Math.max(maxFootingLoad, rig.footingLoad);
            traveled += Math.hypot(rig.x - previousX, rig.z - previousZ);
            previousX = rig.x;
            previousZ = rig.z;
        }
    }
    return { rig, saturationTicks, peakSlip, maxFootingLoad, traveled };
}
export function runMobilityTemperamentStudy() {
    return familyList.map(([name,id]) => {
        const assembly = makeTestAssembly();
        equip(assembly, 'mobility', id);
        const inspection = inspectAssembly(assembly);
        if (!inspection.ready) throw new Error(id + ' not legal: ' + JSON.stringify(inspection));
        const config = deriveRigConfig(assembly);
        const launch = run(config, [[1,{ ...idle, throttle: 1 }]]);
        const reverse = run(config, [
            [1.0,{ ...idle, throttle: 1 }],
            [1.5,{ ...idle, throttle: -1 }],
        ]);
        const turning = run(config, [[1.2,{ ...idle, steer: 1, throttle: 1 }]], { vz: -5 });
        const hardCorner = run(config, [[1.5,{ ...idle, steer: 1, strafe: 1, throttle: 1 }]], { vz: -6 });
        const brakingTurn = run(config, [[1.0,{ ...idle, steer: 1, brake: 1 }]], { vz: -5 });
        const recoil = createRigState({ x: 0, z: 0, yaw: 0 });
        recoil.vz = -4; recoil.vx = .4;
        applyRecoil(recoil, config, 0, -1, WEAPONS['gun-short'].recoilImpulseNs);
        const initialRecoil = recoil.recoilLoad;
        const recovered = run(config, [[.25,{ ...idle, throttle: 1 }]], recoil);
        const round = x => Math.round(x * 10000) / 10000;
        return {
            name,id, massKg:config.massKg, ready:inspection.ready,
            launchMps:round(launch.rig.forwardSpeed),
            reverseMps:round(reverse.rig.forwardSpeed),
            turnDegrees:round(turning.rig.yaw * 180 / Math.PI),
            hardCornerSaturationFrames:hardCorner.saturationTicks,
            hardCornerPeakSlipMps:round(hardCorner.peakSlip),
            hardCornerDistanceM:round(hardCorner.traveled),
            brakeTurnDegrees:round(brakingTurn.rig.yaw * 180 / Math.PI),
            brakeRemainingMps:round(Math.hypot(brakingTurn.rig.vx,brakingTurn.rig.vz)),
            recoilInitialLoad:round(initialRecoil),
            recoilLoadAtQuarterSecond:round(recovered.rig.recoilLoad),
            recoilResidualLateralMps:round(recovered.rig.lateralSpeed),
        };
    });
}
export function formatMobilityTemperamentStudy(results = runMobilityTemperamentStudy()) {
    const lines = ['# k.3v.2 — Three mobility temperaments',
        'All values from 60Hz stepRig, real legal installed components and Stump cannon recoil.',
        'No scene or AI proxies; same reference rig except legs.',
        '',
        '| Family | Mass kg | Launch m/s (1s) | Reverse m/s (1+1.5s) | Turn ° (1.2s) | Grip saturated ticks (hard corner) | Peak slip m/s | Brake+turn ° | Recoil footing load after .25s |',
        '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |'];
    for (const p of results) lines.push(
        `| ${p.name} | ${p.massKg} | ${p.launchMps} | ${p.reverseMps} | ${p.turnDegrees} | ${p.hardCornerSaturationFrames} | ${p.hardCornerPeakSlipMps} | ${p.brakeTurnDegrees} | ${p.recoilLoadAtQuarterSecond} |`);
    return lines.join('\n') + '\n';
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
    const results = runMobilityTemperamentStudy();
    process.stdout.write(process.argv.includes('--json') ?
        JSON.stringify(results, null, 2) + '\n' : formatMobilityTemperamentStudy(results));
}
