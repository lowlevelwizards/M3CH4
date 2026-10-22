import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CATALOG, BY_ID, makeTestAssembly, equip, inspectAssembly } from '../components.js';
import { makeStarterAssembly } from '../acquisition.js';
import { WEAPONS,createWeaponState,advanceWeapon,fireWeapon,startReload,shotSpread } from '../combat.js';
import { createWeaponActionState,advanceWeaponAction,recordWeaponEmission,weaponActionSpreadRadians } from '../weaponController.js';
import {basePartValue} from '../partEconomy.js';
const source=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const spec=WEAPONS['gun-rivet'];
test('new rivet serial appends after sixteen historical definitions without giving new pilots free hardware',()=>{
  assert.ok(CATALOG.length>=17,'subsequent weapons may append after the repeater');
  assert.equal(CATALOG[16].id,'gun-rivet');
  assert.equal(makeTestAssembly().owned[16].serial,'SR01-017');
  assert.equal(BY_ID.get('gun-rivet').slot,'combat');
  assert.equal(basePartValue('gun-rivet'),1470);
  assert.equal(makeStarterAssembly().owned.some(p=>p.definitionId==='gun-rivet'),false);
  const a=makeTestAssembly();equip(a,'combat','gun-rivet');
  assert.equal(inspectAssembly(a).ready,true);
});
test('legacy weapons remain the same and new automatic feed consumes one round per real emitted ray',()=>{
  const old=['gun-cannon','gun-short','gun-light','gun-scatter'];
  assert.deepEqual(Object.keys(WEAPONS).slice(0,4),old);
  for(const id of old)assert.equal(createWeaponState(WEAPONS[id]).action,null);
  const w=createWeaponState(spec);
  assert.equal(w.loaded,60);
  assert.equal(w.reserve,216);
  for(let i=1;i<=60;i++){
    const emitted=fireWeapon(w,spec);
    assert.equal(emitted,i);
    assert.equal(fireWeapon(w,spec),null,'cannot emit twice in the same fixed-step');
    advanceWeapon(w,spec,1/spec.roundsPerSecond+.001);
  }
  assert.equal(w.loaded,0);
  assert.equal(fireWeapon(w,spec),null);
  assert.equal(startReload(w,spec),true);
  advanceWeapon(w,spec,spec.reloadSeconds+.1);
  assert.equal(w.loaded,60);
  assert.equal(w.reserve,156);
});
test('accurate first rivet gives way to sustained bore wander; stopping lets mechanism settle',()=>{
  const a=createWeaponState(spec);
  const base=weaponActionSpreadRadians(spec,a,0);
  assert.ok(base>0);
  for(let i=0;i<15;i++) {
    assert.notEqual(fireWeapon(a,spec),null);
    advanceWeapon(a,spec,1/spec.roundsPerSecond+.001);
  }
  const sustained=weaponActionSpreadRadians(spec,a,0);
  const planted=weaponActionSpreadRadians(spec,a,1);
  assert.ok(sustained>base*2,'sustained stream has meaningful physical spread');
  assert.ok(planted<sustained&&planted>=base,'brace reduces only mounting wander');
  advanceWeapon(a,spec,1.2);
  assert.equal(weaponActionSpreadRadians(spec,a),base);
  assert.deepEqual(shotSpread(13,sustained),shotSpread(13,sustained),'shot directions are deterministic');
  assert.equal(createWeaponActionState(WEAPONS['gun-cannon']),null);
  // Controller can be exercised independently of the match loop.
  const state={action:createWeaponActionState(spec)};
  recordWeaponEmission(state,spec);
  advanceWeaponAction(state,spec,.2);
  assert.ok(state.action.sinceLastEmission>.19);
});
test('same realtime rays, audio, catalogue backed geometry and power impulse for AI and player',()=>{
  const main=source('main.js'),scene=source('scene.js'),registry=source('partVisuals.js');
  assert.match(main,/weaponActionSpreadRadians\(weaponSpec,weaponState/);
  assert.match(main,/weaponActionSpreadRadians\(actor.weaponSpec,actor.weaponState/);
  assert.match(main,/arena\.traceShot\(baseX,baseY,weaponSpec\.muzzleZ\)/);
  assert.match(main,/arena\.traceCombatantShot\(actor\.id,target\.id,aimSlot/);
  assert.match(main,/registerPowerShot\(actor\.powerSystem, actor\.assembly\)/);
  assert.match(registry,/'gun-rivet': buildRivetRepeaterVisual/);
  assert.match(source('rivetRepeaterVisual.js'),/finishWeapon\(r,\{carriage,bolt,cassette\}\)/);
  assert.match(scene,/weaponId === 'gun-rivet'/);
  assert.match(source('liveWeaponAudio.js'),/'gun-rivet':Object\.freeze/);
  assert.match(source('chassisFitFixtures.js'),/'gun-rivet'/);
});
