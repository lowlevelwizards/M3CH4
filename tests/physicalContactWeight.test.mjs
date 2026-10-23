import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {physicalContactWeight} from '../physicalContactWeight.js';
const src=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('steady heavy Hauler compresses more than Yardwalker and Kestrel',()=>{
 const state={footingLoad:1,brace:1,gaitWeight:1,phase:0};
 const family=id=>{let x=null;for(let i=0;i<160;i++)x=physicalContactWeight(id,state,x,1/60);return x;};
 const h=family('legs-hauler'),y=family('legs-yard'),k=family('legs-compact');
 assert.ok(h.drop>y.drop&&y.drop>k.drop);
 assert.ok(h.drop<.121);
});
test('contact responds smoothly at frame boundaries and settles at rest',()=>{
 const active={footingLoad:.9,brace:.5,gaitWeight:.8,phase:Math.PI};
 let state=null;
 for(let i=0;i<30;i++)state=physicalContactWeight('legs-yard',active,state,1/60);
 const loaded=state.drop;
 const next=physicalContactWeight('legs-yard',{},state,1/60);
 assert.ok(next.drop<loaded&&next.drop>0);
 for(let i=0;i<180;i++)state=physicalContactWeight('legs-yard',{},state,1/60);
 assert.ok(state.drop<1e-5&&Math.abs(state.pitch)<1e-5);
});
test('kinematic poses stay finite and capped for arbitrary input',()=>{
 const state={footingLoad:Infinity,brace:-999,recoilLoad:1e14,
  gaitWeight:2,phase:1e6,longitudinalAcceleration:Infinity,
  lateralAcceleration:-1e6};
 const result=physicalContactWeight('legs-hauler',state,null,1);
 assert.ok(Number.isFinite(result.drop)&&result.drop>=0&&result.drop<=.12);
 assert.ok(Number.isFinite(result.pitch)&&Math.abs(result.pitch)<=.08);
 assert.ok(Number.isFinite(result.roll)&&Math.abs(result.roll)<=.055);
});
test('the pose is applied only to presentation scene after gameplay physics',()=>{
 const scene=src('scene.js');
 assert.match(scene,/physicalContactWeight\(mobilityId,\{/);
 assert.match(scene,/record\.contactPresentation=contact/);
 assert.match(scene,/root\.position\.y-=contact\.drop/);
 assert.match(scene,/root\.rotation\.x\+=failed\.rootPitch\+contact\.pitch/);
 assert.doesNotMatch(src('locomotion.js'),/physicalContactWeight/);
});
