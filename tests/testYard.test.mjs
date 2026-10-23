import test from 'node:test';
import assert from 'node:assert/strict';
import {TEST_YARD,readTestYardAssembly,storeTestYardAssembly,clearTestYardAssembly} from '../testYard.js';
import {CATALOG,SLOTS,equip,installedPart,inspectAssembly} from '../components.js';
import {MAPS} from '../maps/mapRegistry.js';
import {pointClear} from '../maps/mapValidation.js';

test('test yard is not part of the paid campaign venue rotation',()=>{
  assert.equal(TEST_YARD.id,'test-yard');
  assert.equal(MAPS.some(map=>map.id===TEST_YARD.id),false);
  assert.equal(TEST_YARD.spawns.hostile.length,3);
  assert.equal(TEST_YARD.spawns.friendly.length,3);
  for(const team of ['friendly','hostile']) for(const start of TEST_YARD.spawns[team]){
    assert.ok(pointClear(TEST_YARD,start,1.55),JSON.stringify({team,start}));
  }
  const first=TEST_YARD.spawns.friendly[0];
  assert.deepEqual(TEST_YARD.spawns.hostile.map(p=>first.z-p.z),[18,31,51]);
});
test('range rig starts with every actually implemented catalogue definition available',()=>{
  const old=globalThis.window;
  globalThis.window={localStorage:{getItem:()=>null}};
  try{
    const rig=readTestYardAssembly();
    assert.equal(rig.owned.length,CATALOG.length);
    assert.equal(new Set(rig.owned.map(p=>p.definitionId)).size,CATALOG.length);
    assert.deepEqual(SLOTS.filter(slot=>!installedPart(rig,slot)),[]);
    assert.ok(inspectAssembly(rig).ready,'range default must be fieldable');
    for(const part of CATALOG) assert.ok(rig.owned.some(p=>p.definitionId===part.id),part.id);
  }finally{globalThis.window=old;}
});
test('range loadout uses one separate storage key and can restore full catalogue selections',()=>{
  const writes=new Map();
  const old=globalThis.window;
  globalThis.window={localStorage:{
    getItem:key=>writes.get(key)||null,
    setItem:(key,value)=>writes.set(key,value),
    removeItem:key=>writes.delete(key),
  }};
  try{
    const rig=readTestYardAssembly();
    equip(rig,'combat','gun-arc');
    assert.equal(storeTestYardAssembly(rig),true);
    assert.deepEqual([...writes.keys()],['m3ch4-test-yard-loadout-v1']);
    const restored=readTestYardAssembly();
    assert.equal(installedPart(restored,'combat')?.definition.id,'gun-arc');
    assert.ok(restored.owned.some(p=>p.definitionId==='gun-rocket'));
    assert.ok(inspectAssembly(restored).ready);
    clearTestYardAssembly();
    assert.equal(writes.size,0);
  }finally{globalThis.window=old;}
});
