import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {BY_ID} from '../components.js';
import {fitFixtureFor} from '../chassisFitFixtures.js';
const source=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const names={
  'gun-cannon':['trainingCannonVisual.js','buildTrainingCannonVisual'],
  'gun-short':['stumpCannonVisual.js','buildStumpCannonVisual'],
  'gun-light':['needleCannonVisual.js','buildNeedleCannonVisual'],
  'gun-scatter':['scattergunVisual.js','buildScattergunVisual'],
};

test('every installed weapon has a dedicated catalogue-backed visual builder',()=>{
  const registry=source('partVisuals.js');
  for(const [id,[file,fn]] of Object.entries(names)){
    assert.match(registry,new RegExp("'"+id+"': "+fn));
    const fixture=fitFixtureFor(id),part=BY_ID.get(id);
    assert.ok(fixture&&part);
    assert.deepEqual(fixture.envelope,part.envelope);
    assert.equal(fixture.massKg,part.massKg);
    assert.equal(fixture.slot,'combat');
    assert.match(source(file),new RegExp("export function "+fn));
    assert.match(source(file),/finishWeapon\(r,\{carriage,bolt/);
  }
});
test('concept-defining geometry is not four instances of a single adjustable gun',()=>{
  const training=source('trainingCannonVisual.js');
  const stump=source('stumpCannonVisual.js');
  const needle=source('needleCannonVisual.js');
  const scatter=source('scattergunVisual.js');
  assert.match(training,/rectangular two-port brake/);
  assert.match(training,/separate underslung recoil cylinder/);
  assert.match(stump,/giant mustard breech/);
  assert.match(stump,/A-frame forward thick leg/);
  assert.match(needle,/extraordinarily narrow free barrel/);
  assert.match(needle,/main open long underbrace/);
  assert.match(scatter,/huge cream eight-sided flared choke/);
  assert.match(scatter,/horizontal red industrial shell/);
  assert.match(scatter,/movable side cassette/);
});
test('the exterior uses real shared physical meshes without legacy or extra hitbox',()=>{
  const s=source('scene.js'),kit=source('weaponVisualKit.js');
  for(const id of Object.keys(names))
    assert.doesNotMatch(s,new RegExp("case '"+id+"'"));
  assert.match(s,/const sharedVisual = buildPartVisual\(def\.id, \{ mode: 'gameplay' \}\)/);
  assert.match(s,/group\.userData\.weaponMechanism = sharedVisual\.userData\.weaponMechanism/);
  assert.match(s,/node\.userData\.slot = slot/);
  assert.match(s,/pickMeshes\.push\(node\)/);
  assert.match(kit,/root\.userData\.weaponMechanism/);
  assert.match(kit,/rest:\{/);
  assert.doesNotMatch(kit,/new THREE\.MeshBasicMaterial|new THREE\.Box3\(/);
});
test('articulation always returns each authored action and cassette to its own rest',()=>{
  const s=source('scene.js');
  assert.match(s,/mechanism\.carriage\.position\.copy\(mechanism\.rest\.carriage\)/);
  assert.match(s,/mechanism\.bolt\.position\.copy\(mechanism\.rest\.bolt\)/);
  assert.match(s,/mechanism\.cassette\.position\.copy\(mechanism\.rest\.cassette\)/);
  assert.match(s,/rest\.carriage\.z\+reload\.slide/);
  assert.match(s,/rest\.bolt\.z\+reload\.bolt/);
  assert.match(s,/rest\.cassette\.y-reload\.cassette/);
});
test('the browser comparison renders exact shared parts in color and flat gray',()=>{
  const html=source('weapon-anatomy.html'),lab=source('weaponAnatomyLab.js');
  assert.match(lab,/buildPartVisual\(id\)/);
  assert.match(lab,/scene\.overrideMaterial=grayMode\?gray:null/);
  assert.match(lab,/renderer\.setScissor\(/);
  for(const id of Object.keys(names))assert.ok(html.includes('data-id="'+id+'"'));
  assert.ok(['hero','side','front','top'].every(s=>lab.includes(s+':[')));
});
