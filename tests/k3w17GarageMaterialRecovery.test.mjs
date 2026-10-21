import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const scene=readFileSync(new URL('../scene.js',import.meta.url),'utf8');
const bridge=readFileSync(new URL('../sceneAssembly.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const browser=readFileSync(new URL('../research/browserStartupSmoke.mjs',import.meta.url),'utf8');

test('Scattergun underbarrel brace uses an actual steel material, not a color number',()=>{
  const scatter=readFileSync(new URL('../scattergunVisual.js',import.meta.url),'utf8');
  assert.match(scatter,/strut\(r,'S6 \/ short load cradle'/);
  assert.doesNotMatch(scene,/case 'gun-scatter'/);
  assert.doesNotMatch(scene,/add\(plate\(\.28,\.15,\.57,steel\)/);
  assert.match(scene,/const surface=typeof material==='number'\?mat\(material,\.82,\.31\):material/);
  assert.match(scene,/if\(!surface\?\.isMaterial\)throw new TypeError/);
});
test('Repeated garage rebuilds dispose valid materials once, and never call dispose on a number',()=>{
  const area=scene.slice(scene.indexOf('function rebuildAssembly('),scene.indexOf('function selectPart(',scene.indexOf('function rebuildAssembly(')));
  assert.match(area,/const releasedGeometry=new Set\(\),releasedMaterials=new Set\(\)/);
  assert.match(area,/material\?\.isMaterial/);
  assert.match(area,/typeof material\.dispose!=='function'/);
  assert.match(area,/releasedMaterials\.has\(material\)/);
  assert.match(area,/releasedMaterials\.add\(material\)/);
  assert.doesNotMatch(area,/for \(const material of materials\)\s*material\.dispose\(\)/);
  assert.match(area,/selectPart\(/);
  assert.match(area,/cockpit\.userData\.utilityCab\.visible/);
});
test('Browser regression actually swaps the owned Scattergun and other gun definitions',()=>{
  assert.match(browser,/makeTestAssembly/);
  assert.match(browser,/equipSerial/);
  for(const id of ['gun-scatter','gun-cannon','gun-short','gun-light'])
    assert.ok(browser.includes("'"+id+"'"),'must equip '+id+' in real browser');
  assert.match(browser,/arena\.rebuildAssembly\(scratch\)/);
  assert.match(browser,/\.isMaterial/);
  assert.match(browser,/SCATTERGUN SWAP: PASS/);
});
test('Safari cache and version point to the fixed scene rather than k3w15 or k3w16',()=>{
  assert.match(html,/sceneAssembly\.js\?v=k4i/);
  assert.match(bridge,/scene\.js\?source=k4i/);
  assert.match(html,/main\.js\?v=k4l/);
  assert.match(html,/0\.0\.1k\.4l — Garage & Combat QoL/);
});
