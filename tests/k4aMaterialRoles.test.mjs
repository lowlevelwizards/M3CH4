import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('physical roles are explicit and future paint never includes optics or machined pivots',()=>{
 const p=read('partMaterialPalette.js');
 for(const role of ['structure','primary-paint','secondary-paint','protective-paint',
  'machined','dark-mechanism','optical','accent'])assert.ok(p.includes(role),role);
 for(const k of ['mustard','teal','cream','oxide','glazing','optic','heatSteel'])
  assert.match(p,new RegExp('\\b'+k+':'));
 assert.match(read('weaponVisualKit.js'),/mesh\.userData\.materialRole=materialRoleOf/);
 assert.match(read('commandVisualKit.js'),/mesh\.userData\.materialRole=materialRoleOf/);
});
test('mobility uses its exact original vocabulary, never inherits non-leg recolors',()=>{
 const mobility=read('mobilityVisualKit.js');
 assert.doesNotMatch(mobility,/partMaterialPalette|PART_MATERIALS/);
 for(const name of ['yardwalkerVisual.js','kestrelVisual.js','haulerVisual.js'])
  assert.doesNotMatch(read(name),/partMaterialPalette/);
});
test('legacy power geometry stays in its existing scene constructor with isolated paint',()=>{
 const s=read('scene.js');
 for(const name of ["case 'power-dynamo'","case 'power-air'"])
  assert.ok(s.includes(name));
 assert.match(s,/const pm = key => partMaterial\(key\)\.clone\(\)/);
 assert.match(s,/mesh\.userData\.materialRole = materialRoleOf/);
 assert.match(s,/k4a:\$\{definitionId\}/);
 assert.match(s,/const sharedVisual = buildPartVisual\(def\.id, \{ mode: 'gameplay' \}\)/);
});
test('comparison suite uses real builders at baseline and updated origins',()=>{
 const script=read('research/k4aBrowserComparison.mjs');
 assert.match(script,/buildPartVisual/);
 assert.match(script,/buildExteriorRig/);
 assert.match(script,/geometryUnchanged/);
 assert.match(script,/mobilityUnchanged/);
 assert.match(script,/Cross-instance tint leak/);
 assert.match(read('colorMaterialGallery.js'),/inspectAssembly/);
});
