import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SYSTEM_SOUND_GROUPS,SYSTEM_SOUNDS,renderSystemSound,makeSystemSoundPlayer} from '../audioSystemsSynth.js';
import {SYSTEMS_SOUND_KEY,defaultSystemsSelection,selectSystemsVariant,
  readSystemsSelection,saveSystemsSelection,formatSystemsSelection} from '../audioSystemsPresets.js';
class Storage{
  data=new Map();
  getItem(k){return this.data.get(k)??null;}
  setItem(k,v){this.data.set(k,String(v));}
}
const energy=a=>a.reduce((n,v)=>n+v*v,0)/a.length;
test('all user-requested sound families have distinct A/B/C material concepts',()=>{
  assert.deepEqual(SYSTEM_SOUND_GROUPS.map(x=>x.id),['damage','electrical','machinery']);
  assert.equal(SYSTEM_SOUNDS.length,13);
  assert.equal(new Set(SYSTEM_SOUNDS.map(x=>x.id)).size,13);
  assert.equal(SYSTEM_SOUNDS.filter(x=>x.group==='damage').length,4);
  assert.equal(SYSTEM_SOUNDS.filter(x=>x.group==='electrical').length,3);
  assert.equal(SYSTEM_SOUNDS.filter(x=>x.group==='machinery').length,6);
  for(const s of SYSTEM_SOUNDS){
    assert.equal(s.variants.length,3);
    assert.equal(new Set(s.variants).size,3);
    assert.ok(s.subtitle.length>5);
  }
  for(const id of ['glance','armor','part','destruction','sparks','zap','recharge',
    'engine','hydraulics','yardwalker','kestrel','hauler','reload'])
    assert.ok(SYSTEM_SOUNDS.find(x=>x.id===id));
});
test('39 synthesized waveforms are deterministic, bounded and audibly energetic',()=>{
  let count=0;
  for(const sound of SYSTEM_SOUNDS){
    const fingerprints=[];
    for(let version=0;version<3;version++){
      const a=renderSystemSound(sound.id,version,16000);
      const b=renderSystemSound(sound.id,version,16000);
      assert.deepEqual(a,b,sound.id+' version '+version+' must be repeatable');
      assert.ok(a.length>4000&&a.length<28000,sound.id+' reasonable duration');
      assert.ok(a.every(Number.isFinite),sound.id+' finite');
      assert.ok(a.every(v=>Math.abs(v)<=.73),sound.id+' safe PCM samples');
      assert.ok(energy(a)>.000008,sound.id+' '+version+' audible body');
      fingerprints.push([a.length,a[353],a[1012],energy(a).toFixed(6)].join(':'));
      count++;
    }
    assert.equal(new Set(fingerprints).size,3,sound.id+' variants materially different');
  }
  assert.equal(count,39);
  assert.throws(()=>renderSystemSound('garbage'));
  assert.throws(()=>renderSystemSound('glance',3));
  assert.throws(()=>renderSystemSound('glance',0,7000));
});
test('separate Kestrel Yardwalker and Hauler footfalls are materially different',()=>{
  const kestrel=renderSystemSound('kestrel',0,22050);
  const yard=renderSystemSound('yardwalker',0,22050);
  const hauler=renderSystemSound('hauler',0,22050);
  assert.ok(kestrel.length<yard.length&&yard.length<hauler.length);
  assert.ok(energy(hauler)>0);
  assert.ok(kestrel.some(x=>x!==0)&&yard.some(x=>x!==0));
});
test('a separate selected letter persists for each of all 13 events without touching saves',()=>{
  const storage=new Storage();
  let state=defaultSystemsSelection();
  state=selectSystemsVariant(state,'glance',1);
  state=selectSystemsVariant(state,'sparks',2);
  state=selectSystemsVariant(state,'hauler',2);
  assert.equal(saveSystemsSelection(storage,state),true);
  assert.deepEqual([...storage.data.keys()],[SYSTEMS_SOUND_KEY]);
  assert.deepEqual(readSystemsSelection(storage),state);
  assert.equal(state.choices.yardwalker,0);
  assert.equal(state.choices.hauler,2);
  assert.equal(state.choices.sparks,2);
  const exportText=formatSystemsSelection(state);
  assert.equal((exportText.match(/ \[/g)||[]).length,13);
  assert.match(exportText,/ARMOR GLANCE \[glance\] \| B — Bright metal clink/);
  assert.match(exportText,/SPARKS \[sparks\] \| C — Intermittent spit/);
  assert.match(exportText,/HAULER H2 FOOTFALL \[hauler\] \| C — Compression slam/);
  storage.setItem(SYSTEMS_SOUND_KEY,'bad{');
  assert.deepEqual(readSystemsSelection(storage),defaultSystemsSelection());
  assert.deepEqual(readSystemsSelection(null),defaultSystemsSelection());
  assert.equal(saveSystemsSelection({setItem(){throw Error('blocked')}},state),false);
  assert.throws(()=>selectSystemsVariant(state,'invalid',1));
  assert.throws(()=>selectSystemsVariant(state,'glance',3));
});
test('iOS lazy audio context, one triggered buffer, stop, and capped cache',()=>{
  const saved=globalThis.AudioContext;
  let contexts=0,buffers=0,starts=0,stops=0;
  class Param{value=0;}
  class Node{
    gain=new Param();threshold=new Param();knee=new Param();ratio=new Param();
    attack=new Param();release=new Param();
    connect(){return this;}disconnect(){}
    start(){starts++;}stop(){stops++;}
  }
  class Ctx{
    sampleRate=16000;state='running';currentTime=1;destination=new Node();
    constructor(){contexts++;}
    createDynamicsCompressor(){return new Node();}
    createGain(){return new Node();}
    createBuffer(_,len,rate){buffers++;return {duration:len/rate,getChannelData:()=>new Float32Array(len)};}
    createBufferSource(){return new Node();}
  }
  try{
    globalThis.AudioContext=Ctx;
    const engine=makeSystemSoundPlayer();
    assert.equal(contexts,0);
    assert.equal(engine.play('glance',0).ok,true);
    assert.equal(contexts,1);
    assert.equal(engine.play('glance',0).ok,true);
    assert.equal(buffers,1);
    assert.equal(engine.play('armor',2).ok,true);
    for(const event of SYSTEM_SOUNDS)for(let i=0;i<3;i++)engine.play(event.id,i);
    assert.equal(contexts,1);
    assert.ok(engine.cacheSize()<=18,'bounded sound memory');
    assert.equal(engine.play('invalid',0).ok,false);
    engine.stop();
    assert.ok(starts>=39&&stops>=39);
  }finally{
    if(saved===undefined)delete globalThis.AudioContext;
    else globalThis.AudioContext=saved;
  }
});
test('sound UI remains DEV-only, landscape grouped and disconnected from gameplay systems',()=>{
  const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const ui=readFileSync(new URL('../audioSystemsUI.js',import.meta.url),'utf8');
  const css=readFileSync(new URL('../audioSystems.css',import.meta.url),'utf8');
  const main=readFileSync(new URL('../main.js',import.meta.url),'utf8');
  assert.match(index,/id="systems-sound-open"/);
  assert.match(index,/audioSystemsUI\.js\?v=k3w9/);
  assert.match(index,/audioSystemsSynth\.js\?v=k3w11/);
  assert.match(index,/audioSystemsPresets\.js\?v=k3w8/);
  assert.match(index,/audioSystems\.css\?v=k3w8/);
  assert.match(index,/0\.0\.1k\.4r — Physical Workshop/);
  assert.match(ui,/audio\.play\(item\.id,i\)/);
  assert.match(ui,/formatSystemsSelection\(saved\)/);
  assert.match(ui,/audio\.stop\(\)/);
  assert.match(css,/\.systems-lab-list\{[^}]*overflow-y:auto/);
  assert.match(css,/\.systems-lab-footer/);
  assert.doesNotMatch(main,/audioSystemsSynth|audioSystemsPresets|audioSystemsUI/);
  assert.doesNotMatch(ui,/storeMachine|clearMachineSave|mech-arena-machine-v8/);
});
