import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createLabMachine, labEquip, labInspection, labBlueprint, loadLabBlueprint,
  labNodeList, labSetGeneratorMount
} from '../constructionLabCore.js';

test('default lab rig is an authentic, graph-valid five-station machine',()=>{
  const rig=createLabMachine();
  assert.equal(labInspection(rig).valid,true);
  assert.equal(labNodeList(rig).filter(n=>!n.virtual).length,5);
});
test('catalogue swaps use actual definitions and maintain graph consistency',()=>{
  const rig=createLabMachine();
  assert.equal(labEquip(rig,'mobility','legs-compact').ok,true);
  assert.equal(labEquip(rig,'command','cab-armored').ok,true);
  assert.equal(labInspection(rig).valid,true);
  assert.equal(labBlueprint(rig).stations.mobility,'legs-compact');
});
test('H2 installs its real adapter and graph remains valid',()=>{
  const rig=createLabMachine();
  assert.equal(labEquip(rig,'mobility','legs-hauler').ok,true);
  assert.equal(labNodeList(rig).some(n=>n.definitionId==='hip-h2-u1'),true);
  assert.equal(labInspection(rig).valid,true);
});
test('impossible slot/definition combinations cannot change machine',()=>{
  const rig=createLabMachine(),before=JSON.stringify(labBlueprint(rig));
  assert.equal(labEquip(rig,'power','legs-yard').ok,false);
  assert.equal(JSON.stringify(labBlueprint(rig)),before);
});
test('generator offset uses real child mounting and survives station swap',()=>{
  const rig=createLabMachine();
  assert.equal(labSetGeneratorMount(rig,'offset').ok,true);
  assert.equal(labEquip(rig,'combat','gun-short').ok,true);
  assert.equal(labBlueprint(rig).generatorMount,'offset');
  assert.equal(labInspection(rig).valid,true);
});
test('blueprint roundtrip is isolated and validated',()=>{
  const a=createLabMachine();
  assert.equal(labEquip(a,'mobility','legs-compact').ok,true);
  assert.equal(labSetGeneratorMount(a,'offset').ok,true);
  const blueprint=labBlueprint(a);
  const b=loadLabBlueprint(blueprint);
  assert.deepEqual(labBlueprint(b),blueprint);
  assert.notStrictEqual(a,b);
  assert.throws(()=>loadLabBlueprint({...blueprint,stations:{...blueprint.stations,mobility:'fake'}}));
});
