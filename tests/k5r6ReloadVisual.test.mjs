import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {WEAPONS} from '../combat.js';
import {reloadPhase,reloadVisualLayout} from '../reloadMechanism.js';
const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const builders={
 'gun-cannon':'trainingCannonVisual.js','gun-short':'stumpCannonVisual.js',
 'gun-light':'needleCannonVisual.js','gun-scatter':'scattergunVisual.js',
 'gun-rivet':'rivetRepeaterVisual.js','gun-breaker':'breakerDriverVisual.js',
 'gun-rocket':'scrapRocketVisual.js','gun-arc':'arcCutterVisual.js',
};
test('all authored guns keep their physical action and one integrated reload identity',()=>{
 const kit=source('weaponVisualKit.js'),scene=source('scene.js');
 assert.match(kit,/export function attachReloadHardware/);
 assert.match(kit,/export function poseReloadHardware/);
 assert.match(kit,/export function poseExistingReloadMagazine/);
 assert.match(kit,/const loader=cassette\?null:attachReloadHardware/);
 assert.match(kit,/node\.userData\.visualOnly=true/);
 assert.match(kit,/root\.userData\.weaponMechanism=/);
 assert.match(scene,/poseReloadHardware\(mechanism,reload\)/);
 assert.match(scene,/poseReloadHardware\(activeKit\.userData\.reloadMechanism,reload\)/);
 assert.match(scene,/node\.userData\.visualOnly/);
 for(const [id,file] of Object.entries(builders)){
   assert.ok(WEAPONS[id],id);
   assert.match(source(file),/finishWeapon\(r,\{carriage,bolt(?:,cassette)?\}\)/);
   assert.ok(reloadPhase(WEAPONS[id].reloadSeconds*.5,
     WEAPONS[id].reloadSeconds,id).feedVisible,id);
   assert.ok(reloadVisualLayout(id).travel<=.22,id);
 }
});
test('the physical socket and carrier replace all detached extraction props',()=>{
 const kit=source('weaponVisualKit.js'),scene=source('scene.js');
 assert.match(kit,/const socket=group\(root,'RELOAD \/ receiver socket'/);
 assert.match(kit,/const carrier=group\(root,'RELOAD \/ single integrated '/);
 assert.match(kit,/feed\.position\.copy\(rest\.feed\)/);
 assert.match(kit,/socket\.position\.copy\(rest\.socket\)/);
 assert.ok(!kit.includes('RELOAD / withdrawn'));
 assert.ok(!kit.includes('RELOAD / battery locking jaw'));
 assert.ok(!kit.includes('RELOAD / fixed ammunition feed track'));
 assert.match(scene,/poseReloadHardware\(mechanism,null\)/);
});
