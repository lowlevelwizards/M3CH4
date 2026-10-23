import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createFootContacts,advanceFootContacts,footContactProfile,footPresentation} from '../footContactController.js';
const ids=['legs-yard','legs-compact','legs-hauler'];
const rig=(x=0,z=0,yaw=0)=>({x,z,yaw,vx:.9,vz:0,driveLoad:.48,tractionUse:.64});
const src=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('all three machines shift support before the swing and never float on zero feet',()=>{
 for(const id of ids){
  let state=createFootContacts(rig(),id);
  let observedPrep=false,firstSwing=false,seenLanding=false,maxShift=0;
  for(let i=0;i<260;i++){
   state=advanceFootContacts(state,rig(i*.015,0),id,1/60);
   if(state.preparingSide){
    observedPrep=true;
    assert.ok(state.feet.every(f=>f.mode==='stance'),id+' preparation plants both feet');
   }
   if(state.feet.some(f=>f.mode==='swing')){
    firstSwing=true;
    assert.ok(observedPrep,id+' must prepare before lift');
   }
   seenLanding ||=state.landings>0;
   assert.ok(state.feet.some(f=>f.mode==='stance'),id+' always has a support foot');
   const loads=state.feet.reduce((sum,f)=>sum+f.load,0);
   assert.ok(Math.abs(loads-1)<.00001,id+' support load sums to 1');
   maxShift=Math.max(maxShift,Math.abs(state.weightShift));
   for(const f of state.feet){
    assert.ok(f.load>=0&&f.load<=1,id+' positive load');
    assert.ok(f.compression>=0&&f.compression<=footContactProfile(id).compression+.0001);
    assert.ok(Number.isFinite(footPresentation(state,f.side).y));
   }
  }
  assert.ok(observedPrep&&firstSwing&&seenLanding,id+' full step preparation cycle');
  assert.ok(maxShift>.07,id+' visible shifting under support');
 }
});
test('neutral planted stance remains symmetric and effort cannot invent movement',()=>{
 const r={x:0,z:0,yaw:0,vx:0,vz:0,driveLoad:0,tractionUse:0};
 const state=createFootContacts(r,'legs-yard');
 for(let i=0;i<200;i++)advanceFootContacts(state,r,'legs-yard',1/60);
 assert.equal(state.landings,0);
 assert.ok(Math.abs(state.weightShift)<.0001);
 assert.equal(state.actuatorEffort,0);
 assert.ok(state.feet.every(f=>f.mode==='stance'));
});
test('load and compression are bounded even under impossible extreme input',()=>{
 let r={x:0,z:0,yaw:0,vx:.7,vz:0,driveLoad:100,tractionUse:100};
 let state=createFootContacts(r,'legs-hauler');
 for(let i=0;i<300;i++){
  r={...r,x:i*.01};
  state=advanceFootContacts(state,r,'legs-hauler',1/60);
  assert.ok(state.actuatorEffort>=0&&state.actuatorEffort<=1);
  assert.ok(Number.isFinite(state.weightShift));
  assert.ok(state.bodyCompression>=0&&state.bodyCompression<.05);
 }
});
test('the full-body and cockpit presentation read the same load state',()=>{
 const scene=src('scene.js');
 assert.match(scene,/record\.footContacts\?\.weightShift/);
 assert.match(scene,/record\.footContacts\?\.bodyCompression/);
 assert.match(scene,/pilotFeet\?\.weightShift/);
 assert.match(scene,/pilotFeet\?\.bodyCompression/);
 assert.doesNotMatch(src('locomotion.js'),/footContactController/);
});
