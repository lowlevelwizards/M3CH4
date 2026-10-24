import test from 'node:test';
import assert from 'node:assert/strict';
import { makeTestAssembly, inspectAssembly, equipAuxiliary, equip } from '../components.js';
import { createFieldServiceState, advanceFieldService, beginFieldService,
  FIELD_SERVICE_SECONDS, countDisabled } from '../fieldService.js';
import { normalizeEquipment, equipmentMounts, servicePumpRate, stabilizerRecoilMultiplier } from '../equipment.js';
import { createSmokeState, deploySmoke, stepSmoke, smokeObscures } from '../tacticalSmoke.js';
import { decodeMachine, encodeMachine } from '../persistence.js';
import { standbyDemandKw,createPowerSystem } from '../powerDynamics.js';
import { createStableFromMachine, encodeStable, decodeStable } from '../stable.js';

const stopped={vx:0,vz:0,yawRate:0,brace:1};
const broken={parts:Object.fromEntries(['structure','mobility','power','command','combat']
    .map(id=>[id,{integrity:id==='mobility'?0:100,maxIntegrity:100,armor:0,maxArmor:35,destroyed:false}]))};

test('auxiliary equipment changes real load, not the five mission-kill stations',()=>{
  const assembly=makeTestAssembly();
  const before=inspectAssembly(assembly);
  assert.equal(before.ready,true);
  assert.equal(equipAuxiliary(assembly,'utilityLeft','cinder-smoke').ok,true);
  assert.equal(equipAuxiliary(assembly,'utilityRight','mule-pump').ok,true);
  assert.equal(equipAuxiliary(assembly,'armorFront','boarhide').ok,true);
  const after=inspectAssembly(assembly);
  assert.equal(after.ready,true);
  assert.equal(after.massKg-before.massKg,95+145+265);
  assert.equal(after.powerUsedKw-before.powerUsedKw,3+12);
  assert.equal(countDisabled(broken),1);
  assert.equal(Object.keys(broken.parts).length,5);
  assert.equal(servicePumpRate(assembly),1.3);
});
test('invalid mounts fail atomically and chassis limits are enforced',()=>{
  const assembly=makeTestAssembly();
  const before={...equipmentMounts(assembly)};
  assert.equal(equipAuxiliary(assembly,'secondaryWeapon','gun-light').ok,false);
  assert.deepEqual(equipmentMounts(assembly),before);
  assert.throws(()=>normalizeEquipment({utilityLeft:'cinder-smoke',utilityRight:'cinder-smoke'}));
  assert.equal(equipAuxiliary(assembly,'utilityLeft','cinder-smoke').ok,true);
  equip(assembly,'structure','frame-wedge');
  const failed=equipAuxiliary(assembly,'utilityRight','mule-pump');
  assert.equal(failed.ok,false);
  assert.equal(equipmentMounts(assembly).utilityRight,undefined);
});
test('Twin-Spar adds a second weapon mass and power without replacing primary combat',()=>{
  const assembly=makeTestAssembly();
  assert.equal(equipAuxiliary(assembly,'combatCradle','twin-spar').ok,true);
  assert.equal(equipAuxiliary(assembly,'secondaryWeapon','gun-light').ok,true);
  assert.equal(inspectAssembly(assembly).ready,true);
  assert.equal(equipmentMounts(assembly).secondaryWeapon,'gun-light');
  assert.equal(assembly.installed.combat,'SR01-007');
  assert.equal(equipAuxiliary(assembly,'combatCradle',null).ok,true);
  assert.equal(equipmentMounts(assembly).secondaryWeapon,undefined);
});
test('Mule pump accelerates one recovery, retaining standard recovery/disable rules',()=>{
  const baseline=createFieldServiceState(),fast=createFieldServiceState(1.3);
  const fresh=()=>structuredClone(broken);
  const regular=fresh(),assisted=fresh();
  assert.equal(beginFieldService(regular,baseline,stopped),true);
  assert.equal(beginFieldService(assisted,fast,stopped),true);
  const dt=FIELD_SERVICE_SECONDS/1.3 + 0.01;
  assert.equal(advanceFieldService(regular,baseline,stopped,dt).event,'progress');
  assert.equal(advanceFieldService(assisted,fast,stopped,dt).event,'completed');
  assert.equal(assisted.parts.mobility.integrity,25);
  assert.equal(assisted.parts.mobility.armor,0);
});
test('Ox-Jack only reduces kick when braced and almost stopped',()=>{
  const assembly=makeTestAssembly();
  assert.equal(equipAuxiliary(assembly,'utilityLeft','ox-jack').ok,true);
  assert.equal(stabilizerRecoilMultiplier(assembly,stopped),.45);
  assert.equal(stabilizerRecoilMultiplier(assembly,{...stopped,brace:.7}),1);
  assert.equal(stabilizerRecoilMultiplier(assembly,{...stopped,vx:1}),1);
});
test('Smoke is finite, segment-based optical cover, fading without ballistic collision',()=>{
  const state=createSmokeState();
  assert.equal(deploySmoke(state,{x:0,z:0}),true);
  stepSmoke(state,1);
  assert.equal(smokeObscures({x:-10,z:0},{x:10,z:0},state.clouds),true);
  assert.equal(smokeObscures({x:-10,z:9},{x:10,z:9},state.clouds),false);
  assert.equal(deploySmoke(state,{x:0,z:0}),true);
  assert.equal(deploySmoke(state,{x:0,z:0}),false);
  stepSmoke(state,12);
  assert.equal(state.clouds.length,0);
});
test('legacy saves without equipment remain compatible, new machine and stable roundtrip fittings',()=>{
  const machine=decodeMachine(null);
  const old=JSON.parse(encodeMachine(machine));
  delete old.assembly.equipment;
  assert.equal(decodeMachine(JSON.stringify(old)).status,'restored');
  machine.assembly.equipment={utilityLeft:'cinder-smoke'};
  const loaded=decodeMachine(encodeMachine(machine));
  assert.equal(loaded.status,'restored');
  assert.equal(equipmentMounts(loaded.assembly).utilityLeft,'cinder-smoke');
  const stable=createStableFromMachine(machine);
  const decoded=decodeStable(encodeStable(stable),machine);
  assert.equal(decoded.status,'restored');
  assert.equal(decoded.stable.rigs[0].equipment.utilityLeft,'cinder-smoke');
});

test('mounted equipment genuinely increases live idle bus load',()=>{
 const assembly=makeTestAssembly();
 const idle=standbyDemandKw(assembly);
 const basePower=createPowerSystem(assembly);
 assert.equal(equipAuxiliary(assembly,'utilityLeft','mule-pump').ok,true);
 assert.equal(standbyDemandKw(assembly)-idle,12);
 const fittedPower=createPowerSystem(assembly);
 assert.equal(fittedPower.demandKw-basePower.demandKw,12);
});
