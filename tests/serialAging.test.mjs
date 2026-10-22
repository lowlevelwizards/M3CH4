import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {appearanceForPart} from '../partAppearance.js';
const source=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('older recorded real service usage visibly ages the same serial without changing mechanics',()=>{
  const part={serial:'SR01-002',definitionId:'legs-yard',condition:1,wear:0,repairs:0};
  const newFinish=appearanceForPart(part,{deployments:0,distanceTravelledM:0});
  const veteran=appearanceForPart(part,{deployments:36,distanceTravelledM:25000});
  assert.equal(newFinish.seed,veteran.seed);
  assert.ok(veteran.abrasion>newFinish.abrasion);
  assert.ok(veteran.grime>newFinish.grime);
  assert.equal(part.condition,1);
  assert.equal(part.wear,0);
});
test('active-rig appearance includes stable part history without modifying v8 serialization',()=>{
  const main=source('main.js'),scene=source('scene.js'),persistence=source('persistence.js');
  assert.match(main,/assembly\.partHistory = loadStable\(saveStorage\)\.stable\.partHistory/);
  assert.match(scene,/assembly\.partHistory\?\.\[fitted\.instance\.serial\]/);
  assert.doesNotMatch(persistence,/partHistory:\s*state\.assembly\.partHistory/);
});
test('preview cache accounts for serialized appearance and Art Lab simulates age independently',()=>{
  const scene=source('scene.js'),lab=source('artLab.js'),html=source('art-lab.html');
  assert.match(scene,/state\.serial\|\|'PREVIEW'/);
  assert.match(scene,/state\.history\?\.deployments/);
  assert.match(scene,/state\.history\?\{\[serial\]:state\.history\}:\{\}/);
  assert.match(lab,/if\(candidate\)/);
  assert.match(lab,/stage\.model=makeRig\(\$\('rig'\)\.value,stage\.candidate\)/);
  assert.match(html,/COMPONENT HISTORY \(SIMULATED\)/);
  assert.doesNotMatch(lab,/storeMachine|storeStable|repaintSerializedParts/);
});
