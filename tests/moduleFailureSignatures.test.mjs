import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {moduleFailureSignature,failureSurfaceFactor} from '../moduleFailureSignatures.js';
const src=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const part=(integrity,destroyed=false)=>({integrity,maxIntegrity:100,destroyed});
test('every real module has a distinct authentic failure visual signature',()=>{
  const slots=['structure','mobility','power','command','combat'];
  const effects=slots.map(slot=>moduleFailureSignature(slot,part(0)));
  assert.equal(new Set(effects.map(e=>e.effect)).size,5);
  for(const signal of effects){
    assert.equal(signal.disabled,true);
    assert.equal(signal.lightEnabled,false);
    assert.ok(signal.surfaceFactor>0&&signal.surfaceFactor<.65);
  }
});
test('working and repaired parts never receive fake mechanical distress',()=>{
 for(const slot of ['structure','mobility','power','command','combat']){
  assert.equal(moduleFailureSignature(slot,part(100)).surfaceFactor,1);
  assert.equal(moduleFailureSignature(slot,part(100)).effect,'operational');
  assert.equal(moduleFailureSignature(slot,part(20)).stressed,true);
  assert.equal(moduleFailureSignature(slot,part(0)).disabled,true);
  assert.equal(moduleFailureSignature(slot,part(80)).disabled,false);
 }
 assert.equal(moduleFailureSignature('invalid',part(0)),null);
});
test('optical loss is attached only to actual exposed optical faces',()=>{
 const sig=moduleFailureSignature('command',part(0));
 assert.ok(failureSurfaceFactor(sig,{role:'optical'})<1);
 assert.equal(failureSurfaceFactor(sig,{role:'structure',exposure:'painted-panel'}),1);
 const power=moduleFailureSignature('power',part(0));
 assert.ok(failureSurfaceFactor(power,{exposure:'hot-mechanism'})<1);
 assert.equal(failureSurfaceFactor(power,{exposure:'optical'}),1);
});
test('both garage and combat refresh failure material signals from current condition',()=>{
 const scene=src('scene.js');
 assert.match(scene,/function signalPhysicalModuleFailures\(exterior,parts\)/);
 assert.match(scene,/signalPhysicalModuleFailures\(record\.exterior,condition\.parts\)/);
 assert.match(scene,/signalPhysicalModuleFailures\(exterior,condition\.parts\)/);
 assert.match(scene,/material\.color\.multiplyScalar\(factor\)/);
 assert.match(scene,/material\.emissiveIntensity=0/);
 assert.doesNotMatch(src('moduleFailureSignatures.js'),/localStorage|requestAnimationFrame|new THREE|Math\.random/);
});
