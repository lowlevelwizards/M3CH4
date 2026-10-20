import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {renderStumpExperiment,STUMP_EXPERIMENTS} from '../audioBenchStumpMaterials.js';
import {makeBenchAudioEngine} from '../audioBenchSynth.js';
import {defaultBenchPresets,AUDIO_BENCH_STORAGE_KEY} from '../audioBenchPresets.js';

const rms=(a,start,end)=>{
  let sum=0,count=0;
  for(let i=start;i<end;i++){sum+=a[i]*a[i];count++;}
  return Math.sqrt(sum/Math.max(1,count));
};
test('Stump experiments are deterministic, bounded, different PCM waveforms without tone sweeps',()=>{
  assert.deepEqual(STUMP_EXPERIMENTS.map(x=>x.id),['pressure','steel','hybrid']);
  const fingerprints=[];
  for(const {id} of STUMP_EXPERIMENTS){
    const a=renderStumpExperiment(id,22050);
    const again=renderStumpExperiment(id,22050);
    assert.deepEqual(a,again,'same device rate should produce an identical stable waveform');
    assert.ok(a.length>10000&&a.length<24000);
    assert.ok(a.every(Number.isFinite));
    assert.ok(Math.max(...a)<.78&&Math.min(...a)>-.78);
    assert.ok(rms(a,0,Math.floor(.08*22050))>.018,'audible transient at start');
    assert.ok(rms(a,0,Math.floor(.08*22050))>rms(a,a.length-700,a.length-50)*5,
      'transient naturally dies away');
    fingerprints.push(JSON.stringify([...a.slice(400,425)]));
  }
  assert.equal(new Set(fingerprints).size,3,'different waveform construction, not merely frequency shift');
  assert.throws(()=>renderStumpExperiment('old-oscillator'),/Unknown/);
  assert.throws(()=>renderStumpExperiment('pressure',3000),/Unsupported/);
});
test('experiment builds an AudioBuffer only on tap, reuses buffer, shares source stop and one context',()=>{
  const existing=globalThis.AudioContext;
  let starts=0,stops=0,buffers=0,contexts=0;
  class Param{value=0;setValueAtTime(){}exponentialRampToValueAtTime(){}}
  class Node{
    gain=new Param();frequency=new Param();Q=new Param();
    threshold=new Param();knee=new Param();ratio=new Param();attack=new Param();release=new Param();
    connect(){return this;}disconnect(){}start(){starts++;}stop(){stops++;}
  }
  class Context{
    state='running';currentTime=1;sampleRate=24000;destination=new Node();
    constructor(){contexts++;}
    createBuffer(_,n,rate){buffers++;const data=new Float32Array(n);
      return {duration:n/rate,getChannelData(){return data;}};}
    createDynamicsCompressor(){return new Node();}
    createGain(){return new Node();}
    createBufferSource(){return new Node();}
    createOscillator(){return new Node();}
    createBiquadFilter(){return new Node();}
  }
  try{
    globalThis.AudioContext=Context;
    const engine=makeBenchAudioEngine();
    assert.equal(contexts,0);
    assert.equal(engine.playStumpExperiment('pressure').ok,true);
    const initial=buffers;
    assert.equal(engine.playStumpExperiment('pressure').ok,true);
    assert.equal(buffers,initial,'same PCM is cached per session');
    assert.equal(engine.playStumpExperiment('steel').ok,true);
    assert.equal(engine.playStumpExperiment('hybrid').ok,true);
    assert.equal(contexts,1,'one tapped context shared with saved reference');
    assert.ok(starts>=4&&stops>=4);
    assert.equal(engine.play('gun-short','A',{body:80,metal:50,action:70}).ok,true);
    assert.equal(contexts,1);
    engine.stop();
  }finally{
    if(existing===undefined)delete globalThis.AudioContext;else globalThis.AudioContext=existing;
  }
});
test('experiment is clearly separate from saved weapon settings, garage and combat audio',()=>{
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const ui=readFileSync(new URL('../audioBenchUI.js',import.meta.url),'utf8');
  const synth=readFileSync(new URL('../audioBenchStumpMaterials.js',import.meta.url),'utf8');
  const main=readFileSync(new URL('../main.js',import.meta.url),'utf8');
  assert.match(html,/audioBenchStumpMaterials\.js\?v=k3w5/);
  assert.match(html,/audioBenchUI\.js\?v=k3w5/);
  assert.match(ui,/data\.experiment=item\.id/);
  assert.match(ui,/engine\.playStumpExperiment\(item\.id\)/);
  assert.match(ui,/presets\.weapons\['gun-short'\]/);
  assert.doesNotMatch(synth,/localStorage|sessionStorage|setItem\(|AudioContext/);
  assert.doesNotMatch(main,/audioBenchStumpMaterials/);
  assert.equal(defaultBenchPresets().weapons['gun-short'].variation,'A');
  assert.equal(AUDIO_BENCH_STORAGE_KEY,'m3ch4-audio-bench-presets-v2');
});
