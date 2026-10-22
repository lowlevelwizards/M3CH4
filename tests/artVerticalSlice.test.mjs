import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {artHash,artRandom} from '../artStyleSeed.js';

const source=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');

test('art seeds produce stable identity hashes across game reloads',()=>{
  assert.equal(artHash('M3CH4'),3951444842);
  assert.equal(artHash('legs-yard'),3356198443);
  assert.notEqual(artHash('legs-yard'),artHash('legs-hauler'));
  const a=artRandom(12345),b=artRandom(12345),c=artRandom(12346);
  const first=Array.from({length:40},()=>a());
  assert.deepEqual(first,Array.from({length:40},()=>b()));
  assert.notDeepEqual(first,Array.from({length:40},()=>c()));
  assert.ok(first.every(value=>Number.isFinite(value)&&value>=0&&value<1));
});

test('procedural terrain and workshop finish stay cosmetic, deterministic and off combat paths',()=>{
  const p=source('artStyleProcedural.js');
  assert.match(p,/createYardGroundTexture/);
  assert.match(p,/createWorkshopFloorTexture/);
  assert.match(p,/artRandom\(0x4d334348\)/);
  assert.match(p,/applyArtWeathering/);
  assert.match(p,/dirtyRoles/);
  assert.doesNotMatch(p,/saveMachine|storeMachine|DEFAULT_WORLD|damagePart|adjustIntegrity/);
  const scene=source('scene.js');
  assert.match(scene,/map:createYardGroundTexture\(\)/);
  assert.match(scene,/map:createWorkshopFloorTexture\(\)/);
  assert.match(scene,/development-only-arena-grid/);
  assert.match(scene,/grid\.visible = false/);
  assert.match(scene,/solids\.push\(floor\)/);
  assert.match(scene,/for \(const obstacle of DEFAULT_WORLD\.obstacles\)/);
});

test('Art Lab uses identical real rig builders and never persists into machine inventory',()=>{
  const lab=source('artLab.js');
  const markup=source('art-lab.html');
  assert.match(lab,/buildExteriorRig\(assembly\)/);
  assert.match(lab,/equip\(assembly,slots\[i\],id\)/);
  assert.match(lab,/applyArtWeathering\(stages\[1\]\.model,s\.wear\)/);
  assert.match(lab,/camera\.position\.copy/);
  assert.match(lab,/renderer\.setScissor\(/);
  assert.match(lab,/m3ch4-art-lab-v1/);
  assert.doesNotMatch(lab,/storeMachine|storeStable|repaintSerializedParts/);
  for(const id of ['art-canvas','rig','wear','contrast','terrain','export'])
    assert.match(markup,new RegExp('id="'+id+'"'));
});
