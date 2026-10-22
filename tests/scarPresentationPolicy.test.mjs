import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {scarPriority,keepPhysicalScars} from '../scarPresentationPolicy.js';
const src=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const mark=(id,event)=>({userData:{surfaceScarEvent:id,sourceSurfaceEvent:event}});
test('welded history is retained even after repeated superficial scratches',()=>{
  const patch=mark('patch',{event:'service',coveredEventId:'hit',timestamp:1});
  const scratches=Array.from({length:8},(_,i)=>mark('scratch-'+i,{
    event:'impact',armorAbsorbed:10,internalDamage:0,timestamp:i+2,
  }));
  const kept=keepPhysicalScars([patch,...scratches],4);
  assert.equal(kept.length,4);
  assert.ok(kept.includes(patch));
  assert.ok(kept.includes(scratches[7]));
  assert.ok(!kept.includes(scratches[0]));
});
test('catastrophic and penetrating damage outranks regular wear',()=>{
  const marks=[
    mark('scratch',{event:'impact',internalDamage:0,timestamp:8}),
    mark('catastrophic',{event:'impact',internalDamage:50,destroyed:true,timestamp:1}),
    mark('penetration',{event:'impact',internalDamage:20,timestamp:2}),
    mark('service',{event:'service',coveredEventId:'old',timestamp:3}),
  ];
  assert.deepEqual(keepPhysicalScars(marks,2).map(m=>m.userData.surfaceScarEvent),['catastrophic','service']);
  assert.equal(scarPriority(marks[3].userData.sourceSurfaceEvent),100);
});
test('bounded and stable with no journal mutation, including empty input',()=>{
  const list=Array.from({length:11},(_,i)=>mark(String(i),{event:'impact',internalDamage:4,timestamp:i}));
  assert.equal(keepPhysicalScars(list,4).length,4);
  assert.equal(list.length,11);
  assert.deepEqual(keepPhysicalScars(list,0),[]);
});
test('source wiring keeps exact physical scene and 3D projected nameplate visibility',()=>{
  assert.match(src('surfaceDamageRenderer.js'),/keepPhysicalScars\(list,perSerialLimit\)/);
  assert.match(src('scene.js'),/function victoryNameplateAnchors\(\)/);
  assert.match(src('scene.js'),/entry\.visual\.root\.localToWorld/);
  assert.match(src('main.js'),/arena\.victoryNameplateAnchors\(\)/);
  assert.match(src('main.js'),/winnerTableau\.classList\.toggle\('spatial'/);
  assert.match(src('winnerTableau.css'),/\.winner-tableau\.spatial/);
});

test('covered penetrations release scar slots for visible machine evidence',()=>{
  const hidden=mark('covered-hole',{event:'impact',internalDamage:90,destroyed:true,timestamp:1000});
  hidden.visible=false;
  const visible=Array.from({length:4},(_,i)=>mark('surviving-'+i,{
    event:i===0?'service':'impact',
    coveredEventId:i===0?'covered-hole':undefined,
    internalDamage:i===0?undefined:4+i,timestamp:100+i,
  }));
  assert.deepEqual(keepPhysicalScars([hidden,...visible],4),visible);
  assert.equal(keepPhysicalScars([hidden],4).length,0);
});
