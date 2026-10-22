import test from 'node:test';
import assert from 'node:assert/strict';
import {familyFailureAnatomy,conditionFailureFlags} from '../familyFailureAnatomy.js';
import {readFileSync} from 'node:fs';
const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('working mechs keep their exact neutral geometry without pose offsets',()=>{
  for(const family of ['legs-yard','legs-compact','legs-hauler']){
    const pose=familyFailureAnatomy(family);
    assert.equal(pose.rootDrop,0);
    assert.equal(pose.rootPitch,0);
    assert.equal(pose.rootRoll,0);
    assert.ok(pose.legs.every(l=>l.hip===0&&l.knee===0&&l.ankle===0&&l.foot===0));
  }
});
test('disabled Kestrel folds forward, Hauler compresses heavily and Yardwalker slumps',()=>{
  const k=familyFailureAnatomy('legs-compact',{mobilityDisabled:true});
  const h=familyFailureAnatomy('legs-hauler',{mobilityDisabled:true});
  const y=familyFailureAnatomy('legs-yard',{mobilityDisabled:true});
  assert.ok(k.rootPitch>y.rootPitch && y.rootPitch>h.rootPitch);
  assert.ok(h.rootDrop>y.rootDrop);
  assert.ok(k.legs[0].knee>y.legs[0].knee);
  assert.ok(y.rootRoll>h.rootRoll);
  assert.equal(k.name,'folded runner, broken digitigrade stance');
  assert.notDeepEqual(k.legs,h.legs);
});
test('destroyed state deepens failure and exact repair restores neutral, no hidden combat change',()=>{
  const dead=familyFailureAnatomy('legs-hauler',{mobilityDestroyed:true});
  const disabled=familyFailureAnatomy('legs-hauler',{mobilityDisabled:true});
  assert.ok(dead.rootDrop>=disabled.rootDrop);
  assert.ok(dead.legs[1].knee>disabled.legs[1].knee);
  const flags=conditionFailureFlags({
    mobility:{integrity:0,maxIntegrity:100,destroyed:false},
    structure:{integrity:55,maxIntegrity:100,destroyed:false},
  });
  assert.equal(flags.mobilityDisabled,true);
  assert.equal(flags.structureDisabled,false);
  assert.equal(familyFailureAnatomy('legs-hauler',flags).rootDrop,disabled.rootDrop);
  assert.equal(familyFailureAnatomy('legs-hauler',conditionFailureFlags({
    mobility:{integrity:75,maxIntegrity:100,destroyed:false}
  })).rootDrop,0);
});
test('real scene binds family failure to true combat conditions and neutral joint recovery',()=>{
  const scene=source('scene.js');
  assert.match(scene,/familyFailureAnatomy\(mobility,conditionFailureFlags\(latestPilotParts\)\)/);
  assert.match(scene,/joint\.object\.rotation\.copy\(joint\.base\)/);
  assert.match(scene,/inspectionJoints=captureArticulation\(exterior\)\.joints/);
  assert.match(scene,/root\.position\.y-=failed\.rootDrop/);
  assert.match(scene,/root\.rotation\.x\+=failed\.rootPitch/);
  assert.match(scene,/root\.rotation\.z\+=failed\.rootRoll/);
  assert.match(scene,/familyFailureAnatomy\(family,\{mobilityDestroyed:true\}\)/);
});
