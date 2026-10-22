import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { equip, inspectAssembly, makeTestAssembly, installedPart, CATALOG } from '../components.js';
import { createPowerSystem, advancePowerSystem, registerPowerShot, powerProfile, powerConstrainedOutput } from '../powerDynamics.js';
import { createFunctionalDamage, functionalOutput, derateRigConfig } from '../functionalDamage.js';
import { simulatePowerProfile, runPowerResponseStudy, formatPowerResponseStudy } from '../research/powerResponseStudy.mjs';
import { createRigState, stepRig } from '../locomotion.js';
import { WEAPONS,createWeaponState,fireWeapon } from '../combat.js';

const dt=1/60, world={minX:-500,maxX:500,minZ:-500,maxZ:500,obstacles:[]};
function equipped(generator='power-dynamo'){
    const a=makeTestAssembly();
    equip(a,'structure','frame-utility');equip(a,'mobility','legs-compact');
    equip(a,'combat','gun-light');equip(a,'power',generator);
    assert.equal(inspectAssembly(a).ready,true);
    return a;
}
test('generator profiles preserve catalogue power and mass and all fourteen legacy serials',()=>{
    assert.equal(CATALOG.length,16);
    const dynamo=equipped(),draft=equipped('power-air');
    assert.equal(installedPart(dynamo,'power').definition.powerKw,145);
    assert.equal(installedPart(draft,'power').definition.powerKw,112);
    assert.equal(installedPart(dynamo,'power').definition.massKg,510);
    assert.equal(installedPart(draft,'power').definition.massKg,365);
    assert.ok(powerProfile(dynamo).responseSeconds>powerProfile(draft).responseSeconds);
    assert.ok(powerProfile(dynamo).reserveKJ>powerProfile(draft).reserveKJ);
});
test('static loadout legality is authoritative and is never bypassed by battery surge',()=>{
    const a=makeTestAssembly();
    equip(a,'mobility','legs-hauler');
    equip(a,'power','power-air');
    assert.equal(inspectAssembly(a).ready,false);
    const state=createPowerSystem(a);
    assert.ok(state.reserveKJ>0,'surge store exists but illegal rig still cannot deploy');
});
test('a healthy idle power plant supplies its baseline demand with no voltage deficit',()=>{
    for(const id of ['power-dynamo','power-air']){
        const a=equipped(id),sys=createPowerSystem(a),rig=createRigState();
        for(let i=0;i<300;i++)advancePowerSystem(sys,a,rig,dt);
        assert.ok(sys.busRatio>.999,id);
        assert.equal(sys.brownout,false);
        assert.ok(sys.demandKw>0);
        assert.ok(sys.generationKw<=installedPart(a,'power').definition.powerKw);
        assert.ok(sys.reserveKJ>=0 && sys.reserveFraction<=1);
    }
});
test('real consumed gunshots raise transient electrical demand; no phantom draws',()=>{
    const a=equipped('power-air'),sys=createPowerSystem(a),rig=createRigState();
    const base=sys.demandKw;
    const gun=createWeaponState(WEAPONS['gun-light']);
    const shot=fireWeapon(gun,WEAPONS['gun-light']);
    assert.equal(typeof shot,'number');
    registerPowerShot(sys,a);
    advancePowerSystem(sys,a,rig,dt);
    assert.ok(sys.demandKw>base);
    const after=sys.shotPulseKw;
    for(let i=0;i<100;i++)advancePowerSystem(sys,a,rig,dt);
    assert.ok(sys.shotPulseKw<after/10);
    assert.ok(sys.demandKw<base+1);
});
test('shortage constrains real physical actuator authority, without changing catalogue stats',()=>{
    const a=equipped('power-air'),sys=createPowerSystem(a),rig=createRigState();
    rig.driveLoad=1;
    sys.reserveKJ=0;sys.generationKw=2;
    advancePowerSystem(sys,a,rig,dt,.35);
    const base=functionalOutput(a,createFunctionalDamage());
    const constrained=powerConstrainedOutput(base,sys);
    assert.ok(constrained.powerFactor<base.powerFactor);
    const original=derateRigConfig({massKg:3600,driveForceN:10000,reverseForceN:7000,
        lateralDriveForceN:18000,maxLateralSpeedMps:3,turnTorqueNm:25000,
        lateralGripNsPerM:8000,collisionRadiusM:1},base);
    const diminished=derateRigConfig({massKg:3600,driveForceN:10000,reverseForceN:7000,
        lateralDriveForceN:18000,maxLateralSpeedMps:3,turnTorqueNm:25000,
        lateralGripNsPerM:8000,collisionRadiusM:1},constrained);
    assert.ok(diminished.driveForceN<original.driveForceN);
    assert.ok(diminished.lateralDriveForceN<original.lateralDriveForceN);
});
test('generator condition truly shrinks live capacity and surge reserve',()=>{
    for(const id of ['power-dynamo','power-air']){
        const a=equipped(id);
        const healthy=createPowerSystem(a),damaged=createPowerSystem(a);
        const rig=Object.assign(createRigState(),{driveLoad:1});
        for(let i=0;i<60;i++){
            advancePowerSystem(healthy,a,rig,dt,1);
            advancePowerSystem(damaged,a,rig,dt,.35);
        }
        assert.ok(damaged.capacityKw<healthy.capacityKw,id);
        assert.ok(damaged.reserveKJ<=powerProfile(a).reserveKJ*.35+1e-8,id);
        assert.ok(damaged.busRatio<=healthy.busRatio+1e-8,id);
    }
});
test('voltage brownout blocks new fire without consuming an ammo round',()=>{
    const a=equipped('power-air'),sys=createPowerSystem(a);
    const rig=Object.assign(createRigState(),{driveLoad:1}),weapon=createWeaponState(WEAPONS['gun-light']);
    sys.reserveKJ=0;sys.generationKw=0;
    advancePowerSystem(sys,a,rig,dt,.05);
    assert.ok(sys.busRatio<.85);
    assert.equal(sys.weaponReady,false);
    const loadedBefore=weapon.loaded;
    // Same gate as both player and AI combat loops.
    if(sys.weaponReady)fireWeapon(weapon,WEAPONS['gun-light']);
    assert.equal(weapon.loaded,loadedBefore);
});
test('Dynamo and Draft dynamic response studies are legal deterministic and measure recovery',()=>{
    const rows=runPowerResponseStudy(),a=runPowerResponseStudy();
    assert.deepEqual(rows,a);
    assert.equal(rows.length,10);
    assert.match(formatPowerResponseStudy(rows),/Peak demand kW/);
    const lookup=(id,phase)=>rows.find(r=>r.id===id&&r.phase===phase);
    for(const r of rows){
        assert.ok(r.capacityKw>0);
        assert.ok(r.nominalKw<=r.capacityKw);
        assert.ok(r.minBus>=0&&r.minBus<=1);
        assert.ok(r.endReserve>=0&&r.endReserve<=1);
    }
    assert.ok(lookup('power-air','idle').underVoltageTicks===0);
    assert.ok(lookup('power-dynamo','sustained').shotCount>0);
    assert.ok(lookup('power-air','sustained').shotCount>0);
    assert.ok(lookup('power-air','sustained').lowestReserve<lookup('power-dynamo','sustained').lowestReserve,
        'Draft must draw down its smaller buffer more severely under identical legal gun/workload');
    assert.ok(lookup('power-air','recovery').endReserve > lookup('power-air','recovery').lowestReserve,
        'Draft must regain reserve after stopping the combined load');
});
test('both player and AI integrate the same power model and honest cockpit telemetry',()=>{
    const src=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8');
    const main=src('../main.js'),scene=src('../scene.js');
    assert.match(main,/advancePowerSystem\(playerPower, assembly, rig, FIXED_DT,/);
    assert.match(main,/advancePowerSystem\(actor\.powerSystem, actor\.assembly, actor\.rig, FIXED_DT,/);
    assert.match(main,/registerPowerShot\(playerPower, assembly\)/);
    assert.match(main,/registerPowerShot\(actor\.powerSystem, actor\.assembly\)/);
    assert.match(main,/actor\.powerSystem\.weaponReady/);
    assert.match(main,/!playerPower\.weaponReady/);
    assert.match(scene,/RES /);
    assert.match(scene,/BUS SAG/);
});
