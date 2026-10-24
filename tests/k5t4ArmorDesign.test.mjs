import test from 'node:test';
import assert from 'node:assert/strict';
import {ARMOR_PROTOTYPES,installedArmorPlates} from '../armorPlan.js';
test('Cyclops remains a flank / mask / front-helmet progression',()=>{
  const tiers=[0,1,2,3].map(t=>installedArmorPlates('cab-cyclops',t));
  assert.deepEqual(tiers.map(p=>p.length),[0,2,4,8]);
  assert.ok(tiers[1].every(p=>p.id.endsWith('cheek')),'level one only side guards');
  assert.ok(tiers[2].some(p=>p.id.endsWith('brow')));
  assert.ok(tiers[2].some(p=>p.id.endsWith('chin')));
  assert.ok(tiers[3].some(p=>p.id.endsWith('crown')));
  assert.ok(tiers[3].some(p=>p.id.endsWith('rear')));
  assert.equal(new Set(ARMOR_PROTOTYPES['cab-cyclops'].plates.map(x=>x.id)).size,8);
});
test('Kestrel has joint clearances by DESIGN rather than independent pivot shells',()=>{
  const tiers=[0,1,2,3].map(t=>installedArmorPlates('legs-compact',t));
  assert.deepEqual(tiers.map(p=>p.length),[0,2,4,8]);
  assert.ok(tiers[1].every(p=>p.id.endsWith('shin')));
  assert.ok(tiers[2].every(p=>p.id.endsWith('shin')||p.id.endsWith('thigh')));
  assert.ok(tiers[3].every(p=>!/knee|ankle|groin|saddle/.test(p.id)));
  assert.equal(tiers[3].filter(p=>p.id.endsWith('flank')).length,2);
  assert.equal(tiers[3].filter(p=>p.id.endsWith('boot')).length,2);
});
