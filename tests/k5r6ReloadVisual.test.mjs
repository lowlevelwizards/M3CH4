import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {WEAPONS} from '../combat.js';
import {reloadPhase} from '../reloadMechanism.js';
const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const builders={
 'gun-cannon':'trainingCannonVisual.js','gun-short':'stumpCannonVisual.js',
 'gun-light':'needleCannonVisual.js','gun-scatter':'scattergunVisual.js',
 'gun-rivet':'rivetRepeaterVisual.js','gun-breaker':'breakerDriverVisual.js',
 'gun-rocket':'scrapRocketVisual.js','gun-arc':'arcCutterVisual.js',
};
test('all eight shared authored gun meshes bind the actual reload mechanism metadata',()=>{
 const kit=source('weaponVisualKit.js'),scene=source('scene.js');
 assert.match(kit,/export function attachReloadHardware/);
 assert.match(kit,/export function poseReloadHardware/);
 assert.match(kit,/feed\.visible=false/);
 assert.match(kit,/spent\.visible=false/);
 assert.ok(kit.includes('RELOAD / withdrawn'));
 assert.match(kit,/node\.userData\.visualOnly=true/);
 assert.match(kit,/root\.userData\.weaponMechanism=/);
 assert.match(scene,/poseReloadHardware\(mechanism,reload\)/);
 assert.match(scene,/poseReloadHardware\(activeKit\.userData\.reloadMechanism,reload\)/);
 assert.match(scene,/node\.userData\.visualOnly/);
 for(const [id,file] of Object.entries(builders)){
   assert.ok(WEAPONS[id],id);
   const body=source(file);
   assert.match(body,/finishWeapon\(r,\{carriage,bolt(?:,cassette)?\}\)/);
   assert.ok(reloadPhase(WEAPONS[id].reloadSeconds*.5,
     WEAPONS[id].reloadSeconds,id).feedVisible,id);
 }
});
test('inspection reset and disabled reload hide service carriers without moving hit meshes',()=>{
 const kit=source('weaponVisualKit.js'),scene=source('scene.js');
 assert.match(kit,/feed\.visible=!!phase\?\.feedVisible/);
 assert.match(kit,/latch\.position\.copy\(rest\.latch\)/);
 assert.match(scene,/poseReloadHardware\(mechanism,null\)/);
 // Real Three.js rendering is validated by the browser/art-lab smoke tests.
});
