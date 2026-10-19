/** Reproducible k.3v.4 electricity study, 60Hz, actual legal installed components,
 * actual trigger/cooldown and shared rig physics. Run: node research/powerResponseStudy.mjs */
import { pathToFileURL } from 'node:url';
import { makeTestAssembly, equip, inspectAssembly } from '../components.js';
import { createFunctionalDamage, functionalOutput, derateRigConfig } from '../functionalDamage.js';
import { deriveRigConfig } from '../assemblyPhysics.js';
import { createRigState, stepRig } from '../locomotion.js';
import { createPowerSystem, advancePowerSystem, powerConstrainedOutput, registerPowerShot } from '../powerDynamics.js';
import { createWeaponState, advanceWeapon, fireWeapon, startReload, WEAPONS } from '../combat.js';
const DT=1/60, WORLD={minX:-1e5,maxX:1e5,minZ:-1e5,maxZ:1e5,obstacles:[]};
const neutral={throttle:0,strafe:0,steer:0,brake:0};
function assemblyFor(id) {
    const a=makeTestAssembly();
    equip(a,'structure','frame-utility');
    equip(a,'mobility','legs-compact');
    equip(a,'combat','gun-light');
    equip(a,'power',id);
    const check=inspectAssembly(a);
    if(!check.ready) throw Error(id+' illegal: '+JSON.stringify(check.checks.filter(c=>!c.passes)));
    return a;
}
export function simulatePowerProfile(id,phase='idle',condition=1) {
    const assembly=assemblyFor(id),rig=createRigState({x:0,z:0,yaw:0});
    const base=deriveRigConfig(assembly),damage=createFunctionalDamage();
    const weapon=WEAPONS['gun-light'],ammo=createWeaponState(weapon);
    const power=createPowerSystem(assembly);
    let minBus=1,shotCount=0,underVoltageTicks=0,peakDemand=0,lowestReserve=1,avgBus=0,maxSaturation=0;
    const duration=phase==='idle'?4:phase==='launch'||phase==='burst'?3:phase==='recovery'?8:12;
    const stoppedAt=phase==='recovery'?4:duration+1;
    const steps=Math.round(duration/DT);
    for(let i=0;i<steps;i++){
        const moving=phase!=='idle' && i*DT<stoppedAt;
        // Sustained weapon load comes only from legitimate shots, not simulated fake fire.
        const firing=(phase==='burst'||phase==='recovery'||phase==='sustained')&&i*DT<stoppedAt;
        const input=moving?{...neutral,throttle:1,strafe: .48,steer:.38}:neutral;
        advancePowerSystem(power,assembly,rig,DT,condition);
        const functional=powerConstrainedOutput(functionalOutput(assembly,damage),power);
        stepRig(rig,input,DT,derateRigConfig(base,functional),WORLD);
        advanceWeapon(ammo,weapon,DT);
        if(firing && power.weaponReady) {
            const shot=fireWeapon(ammo,weapon);
            if(shot!==null) {
                shotCount++;registerPowerShot(power,assembly);
            } else if (ammo.loaded<=0&&ammo.reloadLeft===0) {
                // Reload from the real weapon action.
                startReload(ammo,weapon);
            }
        }
        peakDemand=Math.max(peakDemand,power.demandKw);
        lowestReserve=Math.min(lowestReserve,power.reserveFraction);
        minBus=Math.min(minBus,power.busRatio);
        avgBus+=power.busRatio;
        underVoltageTicks+=Number(power.brownout);
        maxSaturation=Math.max(maxSaturation,rig.tractionUse);
    }
    return {
        id,phase,condition,capacityKw:power.capacityKw,nominalKw:inspectAssembly(assembly).powerUsedKw,
        massKg:base.massKg,
        minBus:Math.round(minBus*10000)/10000,
        averageBus:Math.round(avgBus/steps*10000)/10000,
        underVoltageTicks,peakDemand:Math.round(peakDemand*10)/10,
        lowestReserve:Math.round(lowestReserve*1000)/1000,
        endReserve:Math.round(power.reserveFraction*1000)/1000,
        endBus:Math.round(power.busRatio*10000)/10000,
        finalGenerationKw:Math.round(power.generationKw*10)/10,
        shotCount,remainingAmmo:ammo.loaded+ammo.reserve,
        speedMps:Math.round(Math.hypot(rig.vx,rig.vz)*100)/100,
    };
}
export function runPowerResponseStudy(){
    return ['power-dynamo','power-air'].flatMap(id=>
        ['idle','launch','burst','sustained','recovery'].map(phase=>simulatePowerProfile(id,phase)));
}
export function formatPowerResponseStudy(rows=runPowerResponseStudy()){
    return [
        '# k.3v.4 — Dynamo vs Draft: real 60Hz electrical load and ammunition',
        'Identical legal Skeleton/Kestrel/Cyclops/Needle builds; only generator swapped.',
        'Bus is supplied power / requested kW, not a made-up health debuff. All measurements use 60Hz integration.',
        '| Generator | Scenario | Nominal draw kW | Peak demand kW | Min bus % | Undervoltage frames | Lowest reserve % | End reserve % | Shots |',
        '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
        ...rows.map(r=>`| ${r.id} | ${r.phase} | ${r.nominalKw} | ${r.peakDemand} | ${Math.round(r.minBus*100)} | ${r.underVoltageTicks} | ${Math.round(r.lowestReserve*100)} | ${Math.round(r.endReserve*100)} | ${r.shotCount} |`),
    ].join('\n')+'\n';
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
    const rows=runPowerResponseStudy();
    process.stdout.write(process.argv.includes('--json')?JSON.stringify(rows,null,2)+'\n':formatPowerResponseStudy(rows));
}
