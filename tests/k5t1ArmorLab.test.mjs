import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ARMOR_PROTOTYPES,installedArmorPlates,armorMassKg,armorHit,armorCrewPatch,armorCrewCanPatch} from '../armorPlan.js';
const source=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Cyclops and Kestrel have individually addressed symmetry and authentic tier progressions',()=>{
  assert.equal(installedArmorPlates('cab-cyclops',0).length,0);
  assert.deepEqual([0,1,2,3].map(n=>installedArmorPlates('cab-cyclops',n).length),[0,2,4,8]);
  assert.deepEqual([0,1,2,3].map(n=>installedArmorPlates('legs-compact',n).length),[0,2,6,12]);
  for(const entry of Object.values(ARMOR_PROTOTYPES)){
    assert.equal(new Set(entry.plates.map(p=>p.id)).size,entry.plates.length);
    assert.ok(entry.plates.every(p=>p.massKg>0&&p.hp>0&&p.region));
  }
  assert.equal(armorMassKg('cab-cyclops',0),0);
  assert.ok(armorMassKg('cab-cyclops',3)>armorMassKg('cab-cyclops',1));
  assert.ok(armorMassKg('legs-compact',3)>armorMassKg('legs-compact',1));
});
test('per-plate damage and the proposed pit job never fabricate whole-module repair',()=>{
  assert.equal(armorHit(1,35,70),.5);
  assert.equal(armorHit(.5,80,70),0);
  assert.equal(armorCrewPatch(0),.25);
  assert.equal(armorCrewPatch(.25),.5);
  assert.equal(armorCrewPatch(.5),.5);
  assert.equal(armorCrewCanPatch(.65),false);
  assert.equal(armorMassKg('unknown',2),0);
  assert.deepEqual(installedArmorPlates('unknown',3),[]);
});
test('lab uses real registered part constructors and moving joint nodes; no live-save changes',()=>{
  const visuals=source('armorPrototype.js'),lab=source('armorLab.js'),page=source('armor-lab.html');
  assert.match(visuals,/buildPartVisual\(partId,\{mode:'gameplay'\}\)/);
  assert.match(visuals,/getObjectByName\(side\+'Knee'\)/);
  assert.match(visuals,/getObjectByName\(side\+'Hip'\)/);
  assert.match(visuals,/CYCLOPS \/ DETACHABLE CHEEKS/);
  assert.match(visuals,/armorPlateId/);
  assert.match(lab,/Raycaster/);
  assert.match(lab,/patchPrototypePlate/);
  assert.match(lab,/renderer\.setScissor\(/);
  assert.match(page,/armorLab\.js/);
  assert.match(source('index.html'),/armor-lab\.html/);
  assert.doesNotMatch(lab,/storeMachine|storeStable|localStorage|applyTargetHit/);
});
