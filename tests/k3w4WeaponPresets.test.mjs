import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BENCH_WEAPONS, benchRecipe, makeBenchAudioEngine } from '../audioBenchSynth.js';
import {
  AUDIO_BENCH_STORAGE_KEY,AUDIO_BENCH_PRESET_VERSION,defaultBenchPresets,
  normalizeBenchPresets,readBenchPresets,saveBenchPresets,updateBenchPreset,
  formatAllBenchRecipes,
} from '../audioBenchPresets.js';

class Storage {
  items=new Map();
  getItem(k){return this.items.get(k)??null;}
  setItem(k,v){this.items.set(k,String(v));}
  removeItem(k){this.items.delete(k);}
}
test('each gun has a fully independent A/B/C selection and three sliders',()=>{
  let p=defaultBenchPresets();
  assert.equal(p.version,AUDIO_BENCH_PRESET_VERSION);
  p=updateBenchPreset(p,'gun-short',{variation:'C',mix:{body:95,metal:20,action:75}});
  p=updateBenchPreset(p,'gun-light',{variation:'B',mix:{body:20,metal:90,action:90}});
  p=updateBenchPreset(p,'gun-scatter',{variation:'C',mix:{metal:10}});
  assert.deepEqual(p.weapons['gun-short'],{variation:'C',mix:{body:95,metal:20,action:75}});
  assert.deepEqual(p.weapons['gun-light'],{variation:'B',mix:{body:20,metal:90,action:90}});
  assert.deepEqual(p.weapons['gun-cannon'],{variation:'A',mix:{body:50,metal:50,action:50}});
  assert.deepEqual(p.weapons['gun-scatter'],{variation:'C',mix:{body:50,metal:10,action:50}});
  assert.throws(()=>updateBenchPreset(p,'gun-invalid',{variation:'C'}));
  assert.equal(updateBenchPreset(p,'gun-light',{variation:'Z',mix:{body:999,metal:-50}}).weapons['gun-light'].variation,'A');
  assert.equal(updateBenchPreset(p,'gun-light',{mix:{body:999,metal:-50}}).weapons['gun-light'].mix.body,100);
  assert.equal(updateBenchPreset(p,'gun-light',{mix:{body:999,metal:-50}}).weapons['gun-light'].mix.metal,0);
});

test('the selected A/B/C and sliders survive real storage round-trips without writing game keys',()=>{
  const storage=new Storage();
  let p=updateBenchPreset(defaultBenchPresets(),'gun-short',{variation:'B',mix:{body:90}});
  p=updateBenchPreset(p,'gun-light',{variation:'C',mix:{action:85}});
  assert.equal(saveBenchPresets(storage,p),true);
  assert.deepEqual([...storage.items.keys()],[AUDIO_BENCH_STORAGE_KEY]);
  assert.deepEqual(readBenchPresets(storage),p);
  storage.setItem(AUDIO_BENCH_STORAGE_KEY,'{bad json');
  assert.deepEqual(readBenchPresets(storage),defaultBenchPresets());
  assert.deepEqual(readBenchPresets(null),defaultBenchPresets());
  assert.equal(saveBenchPresets({setItem(){throw Error('storage blocked')}},p),false);
  assert.deepEqual(normalizeBenchPresets({version:900,weapons:{}}),defaultBenchPresets());
});

test('export lists exactly all four current decisions with human-readable slider values',()=>{
  let presets=defaultBenchPresets();
  presets=updateBenchPreset(presets,'gun-cannon',{variation:'A',mix:{body:45}});
  presets=updateBenchPreset(presets,'gun-short',{variation:'B',mix:{body:95,metal:10,action:75}});
  presets=updateBenchPreset(presets,'gun-light',{variation:'C',mix:{metal:90,action:85}});
  presets=updateBenchPreset(presets,'gun-scatter',{variation:'C',mix:{metal:70}});
  const text=formatAllBenchRecipes(presets);
  assert.match(text,/TRAINING CANNON \[gun-cannon\] — A/);
  assert.match(text,/STUMP CANNON \[gun-short\] — B/);
  assert.match(text,/NEEDLE CANNON \[gun-light\] — C/);
  assert.match(text,/S-6 SCATTERGUN \[gun-scatter\] — C/);
  assert.match(text,/STUMP CANNON.*BODY 95.*METAL 10.*ACTION 75/);
  assert.match(text,/NEEDLE CANNON.*METAL 90.*ACTION 85/);
  assert.equal(text.split('[').length-1,4);
  assert.ok(text.indexOf('TRAINING CANNON')<text.indexOf('STUMP CANNON'));
});

test('sound families schedule genuinely different attacks and mechanical action timings',()=>{
  const r=BENCH_WEAPONS.map(x=>benchRecipe(x.id,'C'));
  assert.equal(new Set(r.map(x=>x.architecture)).size,4);
  assert.ok(r.find(x=>x.weaponId==='gun-short').bassHz <
    r.find(x=>x.weaponId==='gun-cannon').bassHz);
  assert.ok(r.find(x=>x.weaponId==='gun-light').weapon.cycle >
    r.find(x=>x.weaponId==='gun-cannon').weapon.cycle);
  const original=globalThis.AudioContext;
  const events=[];
  class Param {
    setValueAtTime(){}
    exponentialRampToValueAtTime(){}
    value=0;
  }
  class Node {
    connect(){return this;}
    disconnect(){}
    start(t){events.push({t,kind:this.kind});}
    stop(){}
    gain=new Param();frequency=new Param();Q=new Param();threshold=new Param();
    knee=new Param();ratio=new Param();attack=new Param();release=new Param();
  }
  class Context {
    constructor(){this.state='running';this.currentTime=1;this.sampleRate=22050;this.destination=new Node();}
    createBuffer(_,n){return {getChannelData:()=>new Float32Array(n)};}
    createDynamicsCompressor(){return new Node();}
    createGain(){return new Node();}
    createOscillator(){const x=new Node();x.kind='osc';return x;}
    createBiquadFilter(){return new Node();}
    createBufferSource(){const x=new Node();x.kind='noise';return x;}
  }
  try {
    globalThis.AudioContext=Context;
    const timelines={};
    for(const w of BENCH_WEAPONS){
      events.length=0;
      const engine=makeBenchAudioEngine();
      const result=engine.play(w.id,'C');
      assert.equal(result.ok,true,result.reason);
      timelines[w.id]=events.map(x=>[Number((x.t-1).toFixed(3)),x.kind]);
      engine.stop();
    }
    assert.equal(new Set(Object.values(timelines).map(x=>JSON.stringify(x))).size,4);
    assert.ok(Math.max(...timelines['gun-light'].map(x=>x[0]))>.70,'needle has deliberately delayed bolt');
    assert.ok(timelines['gun-scatter'].length>=8,'scatter has several separate clanks');
    assert.ok(timelines['gun-short'].some(x=>x[0]>.4),'stump has a heavy delayed mass return');
  } finally {
    if(original===undefined)delete globalThis.AudioContext;
    else globalThis.AudioContext=original;
  }
});

test('UI wiring scopes saved presets to bench and leaves combat audio untouched',()=>{
  const ui=readFileSync(new URL('../audioBenchUI.js',import.meta.url),'utf8');
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const main=readFileSync(new URL('../main.js',import.meta.url),'utf8');
  assert.match(ui,/readBenchPresets\(storage\)/);
  assert.match(ui,/remember\(\{variation:item\.id\}\)/);
  assert.match(ui,/remember\(\{mix:\{\[key\]:Number\(input\.value\)\}\}\)/);
  assert.match(ui,/formatAllBenchRecipes\(presets\)/);
  assert.match(ui,/audio-bench-export/);
  assert.match(html,/audioBenchUI\.js\?v=k3w5/);
  assert.match(html,/audioBenchPresets\.js\?v=k3w4/);
  assert.match(html,/audioBenchSynth\.js\?v=k3w5/);
  assert.match(html,/audioBench\.css\?v=k3w5/);
  assert.doesNotMatch(ui,/clearMachineSave|storeMachine|mech-arena-machine-v8/);
  assert.doesNotMatch(main,/audioBenchPresets/);
});
