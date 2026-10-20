import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BENCH_WEAPONS, BENCH_VARIATIONS, benchRecipe, makeBenchAudioEngine } from '../audioBenchSynth.js';

test('four actual shipped weapons have A/B/C auditions but no additional combat part definitions',()=>{
  assert.deepEqual(BENCH_WEAPONS.map(w=>w.id),['gun-cannon','gun-short','gun-light','gun-scatter']);
  assert.deepEqual(BENCH_VARIATIONS.map(x=>x.id),['A','B','C']);
  const values=new Set();
  for(const w of BENCH_WEAPONS)for(const variation of BENCH_VARIATIONS) {
    const a=benchRecipe(w.id,variation.id);
    assert.ok(a.bassHz>0 && a.metalHz>0 && a.bodyLevel>0);
    values.add(w.id+':'+variation.id+':'+a.bassHz);
  }
  assert.equal(values.size,12);
  assert.throws(()=>benchRecipe('not-a-gun','A'),/Unknown/);
  assert.throws(()=>benchRecipe('gun-cannon','D'),/Unknown/);
});

test('body/metal/action sliders independently affect corresponding procedural sound layers',()=>{
  const base=benchRecipe('gun-scatter','C');
  const low=benchRecipe('gun-scatter','C',{body:0,metal:50,action:50});
  assert.ok(low.bodyLevel<base.bodyLevel);
  assert.equal(low.crackLevel,base.crackLevel);
  assert.equal(low.cycleLevel,base.cycleLevel);
  const metal=benchRecipe('gun-scatter','C',{metal:100});
  assert.ok(metal.ringLevel>base.ringLevel);
  assert.equal(metal.bodyLevel,base.bodyLevel);
  const action=benchRecipe('gun-scatter','C',{action:100});
  assert.ok(action.cycleLevel>base.cycleLevel);
  assert.equal(action.ringLevel,base.ringLevel);
  assert.equal(benchRecipe('gun-light','A',{metal:999,body:-9}).controls.metal,100);
  assert.equal(benchRecipe('gun-light','A',{metal:999,body:-9}).controls.body,0);
});

test('audio uses a lazy mobile-unlocked one-shot graph, bounded master gain, and no stored sounds',()=>{
  const was=globalThis.AudioContext;
  class Param{
    value=0;
    setValueAtTime(v){this.value=v;}
    exponentialRampToValueAtTime(v){this.value=v;}
  }
  class Node{
    connect(){return this;}
    disconnect(){}
    start(){Node.starts++;}
    stop(){Node.stops++;}
    onended=null;
    gain=new Param();frequency=new Param();Q=new Param();
    threshold=new Param();knee=new Param();ratio=new Param();
    attack=new Param();release=new Param();
  }
  Node.starts=0;Node.stops=0;
  class FakeContext{
    static made=0;
    constructor(){FakeContext.made++;this.state='suspended';this.currentTime=1;this.sampleRate=48000;this.destination=new Node();}
    resume(){this.state='running';return Promise.resolve();}
    createBuffer(_,count){return { getChannelData:()=>new Float32Array(count) };}
    createDynamicsCompressor(){return new Node();}
    createGain(){return new Node();}
    createOscillator(){return new Node();}
    createBiquadFilter(){return new Node();}
    createBufferSource(){return new Node();}
  }
  try {
    globalThis.AudioContext=FakeContext;
    const engine=makeBenchAudioEngine();
    assert.equal(FakeContext.made,0,'no audio initializes at page startup');
    assert.equal(engine.getState(),'locked');
    const result=engine.play('gun-scatter','B');
    assert.equal(result.ok,true,result.reason);
    assert.equal(FakeContext.made,1,'one AudioContext per bench, not one per pellet');
    assert.equal(engine.getState(),'running');
    assert.ok(Node.starts>=7,'layered impact and cycling are scheduled');
    engine.play('gun-short','A');
    assert.equal(FakeContext.made,1);
    engine.stop();
    assert.ok(Node.stops>0);
  } finally {
    if(was===undefined) delete globalThis.AudioContext;
    else globalThis.AudioContext=was;
  }
});

test('bench remains DEV-only, user initiated, and does not write gameplay storage',()=>{
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const ui=readFileSync(new URL('../audioBenchUI.js',import.meta.url),'utf8');
  const synth=readFileSync(new URL('../audioBenchSynth.js',import.meta.url),'utf8');
  assert.match(html,/<section id="dev-panel"/);
  assert.match(html,/id="audio-bench-open"/);
  assert.match(html,/audioBenchUI\.js\?v=k3w5/);
  assert.match(html,/audioBenchSynth\.js\?v=k3w5/);
  assert.match(html,/audioBench\.css\?v=k3w5/);
  assert.match(ui,/opener\.addEventListener\('click',open\)/);
  assert.match(ui,/engine\.play\(weaponId,variationId,mix\)/);
  assert.match(ui,/engine\.stop\(\)/);
  assert.match(ui,/readBenchPresets\(storage\)/);
  assert.match(ui,/formatAllBenchRecipes\(presets\)/);
  assert.doesNotMatch(synth,/localStorage|sessionStorage|storeMachine|setItem\(/);
  assert.doesNotMatch(ui,/storeMachine|clearMachineSave|mech-arena-machine-v8/);
  assert.match(html,/0\.0\.1k\.3w\.11 — Soundscape Mix & Performance/);
});
