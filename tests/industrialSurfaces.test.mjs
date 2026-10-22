import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {appearanceForPart,appearanceForSurface} from '../partAppearance.js';
import {assignPartSurfaces,classifySurface} from '../partSurfaceRegistry.js';
import {installIndustrialShader} from '../industrialMaterialSystem.js';
const source=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('per-serial appearance is stable and respects usage without mutating parts',()=>{
  const first={serial:'SR01-002',definitionId:'legs-yard',condition:.31,wear:.45,repairs:3};
  const copy=structuredClone(first);
  const a=appearanceForPart(first,{deployments:25,distanceTravelledM:15000});
  const b=appearanceForPart(copy,{deployments:25,distanceTravelledM:15000});
  const c=appearanceForPart({...first,serial:'SR01-302'},{deployments:25,distanceTravelledM:15000});
  assert.deepEqual(a,b);
  assert.notEqual(a.seed,c.seed);
  assert.deepEqual(first,copy);
  assert.ok(a.abrasion>appearanceForPart({...first,wear:0},{deployments:0}).abrasion);
  assert.ok(a.oxidation>0 && a.grime>0);
});
test('named moving surfaces retain stable IDs and unknown meshes are not falsely journal-addressable',()=>{
  const fake=(name,children=[],role='primary-paint')=>({name,isMesh:!children.length,
    userData:{},material:{userData:{materialRole:role}},children});
  const left=fake('outer-guard'),right=fake('outer-guard');
  const root=fake('mobility-visual',[fake('left shin',[left]),fake('right shin',[right])]);
  const ids=assignPartSurfaces(root,'legs-yard','mobility');
  assert.equal(ids,2);
  assert.equal(left.userData.surface.id,'legs-yard/left-shin/outer-guard');
  assert.equal(right.userData.surface.id,'legs-yard/right-shin/outer-guard');
  assert.equal(left.userData.surface.exposure,'lower-exterior');
  const unnamed=fake('');
  const anonymous=fake('named',[unnamed]);
  assignPartSurfaces(anonymous,'gun-short','combat');
  assert.equal(unnamed.userData.surface.persistable,false);
  assert.equal(unnamed.userData.surface.id,null);
  assert.equal(classifySurface({name:'rear barrel vent',role:'structure',slot:'combat'}),'hot-mechanism');
});
test('optics are exempt and joints, lower legs and hot mechanisms age differently',()=>{
  const base=appearanceForPart({serial:'part-17',definitionId:'cab-cyclops',wear:.6,repairs:2});
  const glass=appearanceForSurface(base,{role:'optical',exposure:'optical'});
  const shin=appearanceForSurface(base,{role:'protective-paint',exposure:'lower-exterior'});
  const joint=appearanceForSurface(base,{role:'machined',exposure:'joint'});
  assert.equal(glass.abrasion,0);
  assert.equal(glass.oxidation,0);
  assert.equal(shin.painted,1);
  assert.ok(shin.abrasion>joint.abrasion);
  assert.ok(joint.grime>shin.grime);
});
test('shared MeshStandard shader operates in one pass after saved owner paint',()=>{
  const m={isMeshStandardMaterial:true,userData:{materialRole:'primary-paint'}};
  const visual={seed:1243,painted:1,abrasion:.4,grime:.5,oxidation:.2,heat:0};
  installIndustrialShader(m,visual);
  const shader={
    uniforms:{},
    vertexShader:'#include <common>\nvoid main(){\n#include <begin_vertex>\n}',
    fragmentShader:'#include <common>\nvoid main(){\n#include <color_fragment>\n#include <roughnessmap_fragment>\n#include <metalnessmap_fragment>\n}',
  };
  m.onBeforeCompile(shader);
  assert.match(shader.fragmentShader,/artPrimer/);
  assert.match(shader.fragmentShader,/artBare/);
  assert.match(shader.fragmentShader,/artRust/);
  assert.match(shader.vertexShader,/vArtPosition=position/);
  assert.equal(shader.uniforms.artPainted.value,1);
  assert.equal(m.customProgramCacheKey(),'m3ch4-industrial-pixel-v1');
  const scene=source('scene.js');
  assert.match(scene,/applyIndustrialFinish\(group/);
  assert.match(scene,/applyPartFinish\(group,fitted\.definition\.id,fitted\.instance\.paint\)/);
  assert.ok(scene.indexOf('applyPartFinish(group,fitted.definition.id,fitted.instance.paint)') <
    scene.indexOf('applyIndustrialFinish(group'));
});
