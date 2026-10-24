import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {WEAPONS,createWeaponState,startReload,advanceWeapon,fireWeapon} from '../combat.js';
import {RELOAD_STAGES,RELOAD_MECHANISMS,reloadPhase,
 createReloadCueState,advanceReloadCue} from '../reloadMechanism.js';
const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('all eight mounted weapons have a named machine-powered feed origin and six cues',()=>{
 assert.equal(Object.keys(RELOAD_MECHANISMS).length,8);
 assert.deepEqual(RELOAD_STAGES,['unlock','extract','feed','chamber','lock','charge']);
 for(const id of Object.keys(WEAPONS)){
   const recipe=RELOAD_MECHANISMS[id],state=createReloadCueState();
   assert.ok(recipe?.source.includes('>'),id+' no onboard feed origin');
   const cues=[];
   for(let frame=0;frame<=240;frame++){
      const left=WEAPONS[id].reloadSeconds*(1-frame/241);
      const phase=reloadPhase(left,WEAPONS[id].reloadSeconds,id);
      assert.ok(phase.progress>=0&&phase.progress<=1);
      const cue=advanceReloadCue(state,left,WEAPONS[id].reloadSeconds,id);
      if(cue)cues.push(cue);
   }
   assert.deepEqual(cues,RELOAD_STAGES,id);
   assert.equal(advanceReloadCue(state,0,WEAPONS[id].reloadSeconds,id),'ready');
 }
});
test('autoloader physically opens before indexing then closes before its final rack',()=>{
 for(const [id,w] of Object.entries(WEAPONS)){
   const pose=p=>reloadPhase(w.reloadSeconds*(1-p),w.reloadSeconds,id);
   const open=pose(.24),feed=pose(.55),closed=pose(.87),rack=pose(.94),ready=pose(1);
   assert.ok(open.open>.95,id+' failed to open');
   assert.ok(feed.open>.95&&feed.indexMotion>.90,id+' feed without open chamber');
   assert.ok(closed.open<.08&&closed.close>.9,id+' must lock before rack');
   assert.ok(rack.charge>.5&&rack.close>.95,id+' charging too early');
   assert.equal(ready.rack,0,id);
   assert.equal(ready.feedTravel,0,id);
   assert.equal(ready.open,0,id);
 }
});
test('gun ownership, shot lockout and reserves stay authoritative throughout reload',()=>{
 for(const [id,w] of Object.entries(WEAPONS)){
  const s=createWeaponState(w);s.loaded=0;
  assert.ok(startReload(s,w),id);
  let beforeLastStep=0;
  // Use 120 equal increments but guard float rounding on last tick.
  for(let i=0;i<120;i++){
    const p=reloadPhase(s.reloadLeft,w.reloadSeconds,id);
    assert.ok(p.active,id);
    assert.equal(s.loaded,0,id);
    assert.equal(fireWeapon(s,w),null,id);
    beforeLastStep=s.reserve;
    advanceWeapon(s,w,w.reloadSeconds/121);
  }
  assert.equal(s.loaded,0,id);
  advanceWeapon(s,w,w.reloadSeconds/120);
  assert.equal(s.reloadLeft,0,id);
  assert.equal(s.loaded,w.magazine,id);
  assert.equal(s.reserve,beforeLastStep-w.magazine,id);
 }
});
test('the full rig has no invisible hands or detached replacement magazine',()=>{
 const geometry=source('weaponVisualKit.js'),scene=source('scene.js');
 assert.ok(!geometry.includes('RELOAD / withdrawn'));
 assert.ok(!geometry.includes('RELOAD / fixed ammunition feed track'));
 assert.ok(!geometry.includes('RELOAD / battery locking jaw'));
 assert.match(geometry,/const loader=cassette\?null:attachReloadHardware/);
 assert.match(geometry,/RELOAD \/ powered casing ejector/);
 assert.match(geometry,/poseExistingReloadMagazine/);
 assert.match(geometry,/magazine.rotation.x=motion\*\.72/);
 assert.match(geometry,/phase\.indexMotion/);
 assert.match(scene,/reload\.rack/);
 assert.match(scene,/mechanism\.carriage\.rotation\.x/);
 assert.match(scene,/poseReloadHardware\(activeKit\.userData\.reloadMechanism,reload\)|poseReloadHardware\(mech,reload\)/);
});
