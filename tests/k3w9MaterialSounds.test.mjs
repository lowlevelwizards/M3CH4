import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {renderSystemSound,SYSTEM_SOUNDS} from '../audioSystemsSynth.js';
import {SYSTEMS_SOUND_KEY,defaultSystemsSelection,selectSystemsVariant,
  normalizeSystemsSelection,formatSystemsSelection} from '../audioSystemsPresets.js';

const source=readFileSync(new URL('../audioSystemsSynth.js',import.meta.url),'utf8');
const energy=a=>a.reduce((n,v)=>n+v*v,0)/a.length;
const intervalEnergy=(a,sr,from,to)=>energy(a.slice(Math.floor(from*sr),Math.floor(to*sr)));
const section=(a,b)=>source.slice(source.indexOf("case '"+a+"'"),source.indexOf("case '"+b+"'"));
test('handpan modal synthesis is no longer used even for armor glances',()=>{
  assert.equal((source.match(/metal\(t,/g)??[]).length,0,
    'after shared modal declaration only one call remains, within glance');
  assert.doesNotMatch(section('glance','armor'),/metal\(t,/);
  for(const [a,b] of [['part','destruction'],['recharge','engine'],['hydraulics','yardwalker'],
    ['kestrel','hauler']]){
    assert.doesNotMatch(section(a,b),/metal\(t,/,'no pitched steel drum in '+a);
  }
  const reload=source.slice(source.indexOf("case 'reload':"),source.indexOf('// Limit peaks'));
  assert.doesNotMatch(reload,/metal\(t,/,'no metal handpan in reload');
  assert.match(section('glance','armor'),/\.13\*middle/,'the background skidding scrape remains subdued');
  assert.match(SYSTEM_SOUNDS.find(x=>x.id==='glance').variants[2],/Quiet/);
});
test('low body sound family is valid and no longer uses identical ringing contacts',()=>{
  const sr=22050;
  for(const id of ['part','recharge','hydraulics','yardwalker','kestrel','hauler','engine']){
    const traces=[0,1,2].map(v=>renderSystemSound(id,v,sr));
    assert.equal(new Set(traces.map(a=>a.length+':'+energy(a).toFixed(8))).size,3,id+' variants remain different');
    for(const a of traces){
      assert.ok(a.every(Number.isFinite),id+' finite audio');
      assert.ok(a.every(x=>Math.abs(x)<=.73),id+' limited PCM');
      assert.ok(energy(a)>.000008,id+' audible');
    }
  }
  const e=renderSystemSound('engine',0,sr);
  // Strong harmonic rotation and less hiss: a running, sustained rumble.
  assert.ok(intervalEnergy(e,sr,.24,.6)>.0005);
  assert.ok(intervalEnergy(e,sr,.85,1.3)>.0005);
  assert.ok(source.includes('const chassis=.055*middle'));
  assert.ok(source.includes('.014*rasp'));
});
test('reload variations are three materially different multi-step mechanical actions',()=>{
  const sr=22050;
  const examples=[0,1,2].map(v=>renderSystemSound('reload',v,sr));
  assert.equal(new Set(examples.map(a=>energy(a).toFixed(7))).size,3);
  assert.ok(intervalEnergy(examples[0],sr,.38,.44)>.000004,'slide-and-lock has heavy forward return');
  assert.ok(intervalEnergy(examples[1],sr,.32,.38)>.000004,'magazine seats audibly');
  assert.ok(intervalEnergy(examples[2],sr,.54,.61)>.000004,'breech block slams shut');
  assert.match(source,/Slide & lock/);
  assert.match(source,/Magazine slap/);
  assert.match(source,/Heavy breech/);
});
test('approved sounds and per-event choices remain present and game audio untouched',()=>{
  const s=defaultSystemsSelection();
  const changed=selectSystemsVariant(selectSystemsVariant(s,'glance',1),'sparks',2);
  assert.equal(changed.choices.glance,1);
  assert.equal(changed.choices.sparks,2);
  assert.deepEqual(normalizeSystemsSelection(changed),changed);
  assert.match(formatSystemsSelection(changed),/ARMOR GLANCE \[glance\] \| B/);
  assert.equal(SYSTEMS_SOUND_KEY,'m3ch4-systems-sound-lab-v1');
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const main=readFileSync(new URL('../main.js',import.meta.url),'utf8');
  assert.match(html,/audioSystemsSynth\.js\?v=k3w11/);
  assert.match(html,/audioSystemsUI\.js\?v=k3w9/);
  assert.match(html,/0\.0\.1k\.3w\.16 — Foot Contact & Lateral Gait/);
  assert.doesNotMatch(main,/audioSystemsUI/);
  assert.match(main,/soundCombatImpact\(/);
  assert.match(main,/soundWeaponShot\(weaponSpec\.id/);
});
