import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {VISUAL_LIGHTING,lightingProfile} from '../visualLightingLanguage.js';
const scene=readFileSync(new URL('../scene.js',import.meta.url),'utf8');
test('warm and cool lighting increase physical readability with fixed cost',()=>{
  const a=lightingProfile('arena'),w=lightingProfile('workshop');
  assert.ok(a.ambient>.64&&a.ambient<1.25);
  assert.ok(a.rim>1&&a.rim<2);
  assert.ok(w.ambient>.86&&w.ambient<1.35);
  assert.ok(w.rim>1&&w.rim<2);
  assert.equal(a.shadowSize,512);
  assert.equal(w.shadowSize,256);
  assert.equal(lightingProfile('invalid'),a);
  assert.ok(Object.isFrozen(VISUAL_LIGHTING));
});
test('actual arena and workshop reuse light sources and shadow resources',()=>{
  assert.match(scene,/new THREE\.HemisphereLight\(arenaLight\.ambientSky,arenaLight\.ambientGround,arenaLight\.ambient\)/);
  assert.match(scene,/new THREE\.DirectionalLight\(0xffd09c,arenaLight\.key\)/);
  assert.match(scene,/sun\.shadow\.mapSize\.set\(arenaLight\.shadowSize,arenaLight\.shadowSize\)/);
  assert.match(scene,/new THREE\.HemisphereLight\(shopLight\.ambientSky,shopLight\.ambientGround,shopLight\.ambient\)/);
  assert.match(scene,/new THREE\.DirectionalLight\(0x70a9a4,shopLight\.rim\)/);
  assert.match(scene,/new THREE\.PointLight\(0xffc178,shopLight\.fixtureIntensity,10,2\.0\)/);
  assert.match(scene,/arenaHemisphere\.visible = !enabled/);
  assert.match(scene,/sun\.visible = !enabled/);
  assert.match(scene,/coolRim\.visible = !enabled/);
});
