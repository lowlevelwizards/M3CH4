import test from 'node:test';
import assert from 'node:assert/strict';
import { makeTestAssembly, equip, inspectAssembly } from '../components.js';
import { deriveRigConfig } from '../assemblyPhysics.js';
import { createRigState, stepRig, PLANTED_PIVOT } from '../locomotion.js';
import { createFunctionalDamage, damageInstalledPart, functionalOutput, derateRigConfig } from '../functionalDamage.js';
import { createEnemyMotion, advanceEnemyMotion, headingError } from '../enemyMotion.js';
import { contractById } from '../contracts.js';

const DT = 1 / 60;
const world = { minX: -100, maxX: 100, minZ: -100, maxZ: 100, obstacles: [] };
const neutral = { throttle: 0, strafe: 0, steer: 0, brake: 0 };
function equipped(legs, frame='frame-wedge', gun='gun-short') {
    const assembly=makeTestAssembly();
    equip(assembly,'structure',frame);
    equip(assembly,'mobility',legs);
    equip(assembly,'combat',gun);
    const inspection=inspectAssembly(assembly);
    assert.equal(inspection.ready,true,JSON.stringify(inspection.checks.filter(c=>!c.passes)));
    return { assembly, base: deriveRigConfig(assembly) };
}
function evolve(config, input, count=60, start={}) {
    const state=Object.assign(createRigState({ x: 0,z:0,yaw:0 }),start);
    for(let i=0;i<count;i++) stepRig(state,input,DT,config,world);
    return state;
}

test('Hauler alone has a bounded real planted-turn torque; no new equipment or cheat capability',()=>{
    const hauler=equipped('legs-hauler').base;
    const yard=equipped('legs-yard').base;
    const kestrel=equipped('legs-compact').base;
    assert.ok(hauler.pivotTorqueNm>hauler.turnTorqueNm);
    assert.ok(hauler.pivotLeverArmM>1);
    assert.equal(yard.pivotTorqueNm,0);
    assert.equal(kestrel.pivotTorqueNm,0);
    assert.equal(PLANTED_PIVOT.transitionSeconds,.32);
    assert.ok(hauler.pivotTorqueNm < hauler.massKg*9.81*hauler.pivotLeverArmM);
});

test('Hauler defensive stationary turn approaches the 15–20 degree tuning band; moving turn stays heavy',()=>{
    const heavy=equipped('legs-hauler').base;
    const yard=equipped('legs-yard').base;
    const runner=equipped('legs-compact').base;
    const planted=evolve(heavy,{...neutral,steer:1});
    assert.ok(planted.yaw*180/Math.PI>=15,planted.yaw.toString());
    assert.ok(planted.yaw*180/Math.PI<=23,planted.yaw.toString());
    assert.ok(planted.plantedPivot>=.99);
    assert.equal(planted.braced,false);
    const movingHeavy=evolve(heavy,{...neutral,steer:1,throttle:.8},60,{vz:-4});
    const movingYard=evolve(yard,{...neutral,steer:1,throttle:.8},60,{vz:-4});
    const movingRunner=evolve(runner,{...neutral,steer:1,throttle:.8},60,{vz:-4});
    assert.equal(movingHeavy.plantedPivot,0);
    assert.ok(movingRunner.yaw>movingYard.yaw);
    assert.ok(movingYard.yaw>movingHeavy.yaw);
});
test('brace and pivot cannot stack; steering cancels pivot and moving input cuts extra torque',()=>{
    const heavy=equipped('legs-hauler').base;
    const braced=evolve(heavy,{...neutral,brake:1},60);
    assert.equal(braced.braced,true);
    assert.equal(braced.plantedPivot,0);
    const turning=evolve(heavy,{...neutral,brake:1,steer:1},60);
    assert.ok(turning.plantedPivot>.99);
    assert.equal(turning.brace,0);
    assert.equal(turning.braced,false);
    stepRig(turning,{...neutral,throttle:1,steer:1},DT,heavy,world);
    assert.equal(turning.pivotActive,false);
    const held=turning.plantedPivot;
    for(let i=0;i<15;i++) stepRig(turning,{...neutral,throttle:1,steer:1},DT,heavy,world);
    assert.ok(turning.plantedPivot<held);
    assert.equal(turning.braced,false);
});
test('drive damage, unilateral failure and generator condition reduce actual pivot authority',()=>{
    const {assembly,base}=equipped('legs-hauler');
    const fresh=evolve(base,{...neutral,steer:1}).yaw;
    const damage=createFunctionalDamage();
    damageInstalledPart(assembly,damage,'mobility',.7,'left');
    const unequal=derateRigConfig(base,functionalOutput(assembly,damage));
    const asymmetric=evolve(unequal,{...neutral,steer:1}).yaw;
    assert.ok(asymmetric<fresh,'lost left drive must impair right-hand pivot');
    const brokenDrive=createFunctionalDamage();
    damageInstalledPart(assembly,brokenDrive,'mobility',.95);
    const nearBroken=derateRigConfig(base,functionalOutput(assembly,brokenDrive));
    const wounded=evolve(nearBroken,{...neutral,steer:1}).yaw;
    assert.ok(wounded<fresh);
    const next=equipped('legs-hauler');
    damageInstalledPart(next.assembly,createFunctionalDamage(),'power',.45);
    const reduced=derateRigConfig(next.base,functionalOutput(next.assembly,createFunctionalDamage()));
    assert.ok(evolve(reduced,{...neutral,steer:1}).yaw<fresh);
    assert.equal(evolve(derateRigConfig(base,{left:0,right:0,powerFactor:0}),
        {...neutral,steer:1}).pivotActive,false);
});
test('heavy AI defender requests pivot through shared input and returns to travel on reassignment',()=>{
    const {base}=equipped('legs-hauler');
    const behavior=contractById('mule').behavior;
    const motion=createEnemyMotion(behavior);
    const rig=createRigState({x:0,z:0,yaw:0});
    const sideThreat={x:9,z:0,yaw:0};
    let order={mode:'ANCHOR',point:{x:0,z:0},brakeBias:1,note:'HOLD'};
    let initiated=false;
    for(let i=0;i<50;i++){
        const command=advanceEnemyMotion(motion,rig,sideThreat,DT,true,world,base.collisionRadiusM,
            behavior,order,base);
        if (motion.phase==='PIVOT') {
            initiated=true;
            assert.ok(Math.abs(command.throttle)<.001);
            assert.ok(Math.abs(command.strafe)<.001);
        }
        stepRig(rig,command,DT,base,world);
    }
    assert.ok(initiated,'defender can initiate a planted turn');
    assert.ok(rig.yaw>.08,'pilot uses real yaw to face the flanker');
    order={mode:'ORDER',point:{x:0,z:-20},throttleScale:1,note:'REPOSITION'};
    const noThreat=null;
    let advancing=false;
    for(let i=0;i<80;i++){
        const command=advanceEnemyMotion(motion,rig,noThreat,DT,true,world,base.collisionRadiusM,
            behavior,order,base);
        if(Math.abs(command.throttle)>.25)advancing=true;
        stepRig(rig,command,DT,base,world);
    }
    assert.ok(advancing,'pilot can abandon stance and move');
    assert.equal(rig.braced,false);
    assert.ok(Math.hypot(rig.vx,rig.vz)>.2);
});
