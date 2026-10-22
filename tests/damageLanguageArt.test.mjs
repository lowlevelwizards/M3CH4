import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {surfaceDamageLanguage,physicalFailurePose} from '../surfaceDamageLanguage.js';
const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const event=(armor,internal,extra={})=>({
  surfaceId:'legs-yard/left-shin/outer-guard',
  armorAbsorbed:armor,internalDamage:internal,...extra,
});
test('a real armor absorption is a thin scrape, never a round black hole',()=>{
  const scrape=surfaceDamageLanguage(event(28,0));
  const breach=surfaceDamageLanguage(event(7,26));
  assert.equal(scrape.kind,'armor-scrape');
  assert.equal(scrape.shape,'directional');
  assert.equal(breach.kind,'breach');
  assert.equal(breach.shape,'round');
  assert.ok(breach.height>scrape.height*2);
  assert.ok(breach.width>scrape.width);
});
test('catastrophic breach grows only when internal damage actually occurs',()=>{
  const catastrophic=surfaceDamageLanguage(event(5,35,{destroyed:true}));
  const armor=surfaceDamageLanguage(event(90,0,{destroyed:false}));
  const power=surfaceDamageLanguage({...event(3,25),surfaceId:'power-forge/top-vent'});
  assert.equal(catastrophic.kind,'destroyed-breach');
  assert.equal(armor.kind,'armor-scrape');
  assert.equal(power.kind,'power-breach');
  assert.equal(power.soot,true);
});
test('functional disablement changes pose independently from bullet punctures',()=>{
  assert.deepEqual(physicalFailurePose('combat',{maxIntegrity:100,integrity:60}),{
    y:0,x:0,z:0,deadOptic:false,
  });
  const weapon=physicalFailurePose('combat',{maxIntegrity:100,integrity:0});
  const frame=physicalFailurePose('structure',{maxIntegrity:100,integrity:0});
  const cab=physicalFailurePose('command',{maxIntegrity:100,integrity:0});
  assert.ok(weapon.x>.1);
  assert.ok(frame.z>0);
  assert.equal(cab.deadOptic,true);
});
test('damage art uses one shared family material, keeps actual hit anchors and avoids extra targets',()=>{
  const renderer=source('surfaceDamageRenderer.js'),scene=source('scene.js');
  assert.match(renderer,/surfaceDamageLanguage\(event\)/);
  assert.match(renderer,/const P=32/);
  assert.match(renderer,/g\.fillRect\(12,12,8,8\)/);
  assert.match(renderer,/perSerialLimit=4/);
  assert.match(scene,/poseDamagedMachineInGarage\(\)/);
  assert.match(scene,/inspectionBaseParts=capturePartTransforms\(exterior\)/);
  assert.match(scene,/function refreshInspectionBase\(\)/);
  assert.match(source('sceneAssembly.js'),/arena\.refreshInspectionBase\?\.\(\)/);
  assert.doesNotMatch(scene,/new THREE\.IcosahedronGeometry\(\.065, 0\)/);
  assert.match(scene,/recordDamageWound\(actorId, slot, worldPoint\)/);
});
