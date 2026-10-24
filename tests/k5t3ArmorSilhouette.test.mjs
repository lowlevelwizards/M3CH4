import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {ARMOR_PROTOTYPES,armorMassKg,installedArmorPlates} from '../armorPlan.js';
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
test('tier ladder expresses a true coverage progression, not a few additional boxes',()=>{
  for(const id of ['cab-cyclops','legs-compact']){
    const counts=[0,1,2,3].map(n=>installedArmorPlates(id,n).length);
    assert.equal(counts[0],0);
    assert.ok(counts[1]>=2);
    assert.ok(counts[2]>=counts[1]*2);
    assert.ok(counts[3]>=counts[2]*1.5);
    assert.ok([0,1,2].every(n=>armorMassKg(id,n+1)>armorMassKg(id,n)));
  }
  assert.equal(installedArmorPlates('legs-compact',1).length,2,'keep original bare/light Kestrel');
  assert.equal(installedArmorPlates('legs-compact',2).length,4,'two fitted upper thighs and two shins; exposed knee bearings');
  assert.equal(installedArmorPlates('legs-compact',3).length,8,'heavy thickens four spars and adds outer thigh facets plus forked boots');
  assert.equal(installedArmorPlates('cab-cyclops',3).length,8,'eye shielded on all sides by independent panels');
  const kestrel=ARMOR_PROTOTYPES['legs-compact'].plates;
  assert.ok(kestrel.filter(p=>p.tier===2&&p.id.endsWith('thigh')).length===2);
  assert.ok(kestrel.every(p=>!/knee|ankle|hock/.test(p.id)),
    'moving pivot bearings are deliberately left exposed, not boxed in');
  assert.ok(kestrel.filter(p=>p.tier===3&&p.id.endsWith('flank')).length===2);
  assert.ok(kestrel.filter(p=>p.tier===3&&p.id.endsWith('boot')).length===2);
  assert.ok(kestrel.every(p=>!/groin|saddle|skirt/.test(p.id)),'skirting belongs to structure');
  assert.ok(kestrel.filter(p=>p.id.endsWith('boot')).every(p=>p.label.includes('SPLIT')),
    'heavy boot protection must preserve the original two toe prongs');
});
test('authored plates follow physically real moving joints and remain independently removable',()=>{
  const src=read('armorPrototype.js');
  assert.match(src,/function sparGuard/);
  assert.match(src,/function splitBootGuardGeometry/);
  assert.match(src,/shape\.lineTo\(-slot,slotEnd\)/);
  assert.match(src,/startFraction,endFraction/);
  assert.match(src,/endFraction>startFraction/);
  assert.match(src,/\.crossVectors\(long,normal\)/);
  assert.match(src,/sparAxis:long\.toArray\(\)/);
  assert.match(src,/mountParent:parent\.name/);
  assert.match(src,/if\(tier===1\) return originalShin/);
  assert.match(src,/root\.getObjectByName\(side\+'Foot'\)/);
  assert.match(src,/root\.getObjectByName\(side\+'Ankle'\)/);
  assert.match(src,/geometry:splitBootGuardGeometry\(\)/);
  assert.match(src,/clearFactoryCheeks\(root\)/);
  assert.match(src,/cyclops-crown/);
  assert.doesNotMatch(src,/localStorage|setItem|applyTargetHit/);
});
