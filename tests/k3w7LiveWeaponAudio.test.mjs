import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 LIVE_WEAPON_RECIPES,shotPitchRate,shotDistanceGain,makeLiveWeaponAudio,
} from '../liveWeaponAudio.js';
import {renderPressureForgePCM} from '../audioPressureForgeSynth.js';
import {WEAPONS} from '../combat.js';

const expected={
 'gun-cannon':['bark','none',[70,95,76,56,8,46,37,63,32]],
 'gun-short':['custom','bolt',[100,76,22,30,58,73,50,25,20]],
 'gun-light':['custom','bolt',[54,100,94,40,12,65,60,85,30]],
 'gun-scatter':['custom','breech',[88,100,45,95,90,95,80,95,95]],
};
const knobs=['bass','punch','treble','grit','tail','actionLevel','delay','mass','scrape'];
test('four approved exact pressure forge recipes become the live audio source of truth',()=>{
  assert.deepEqual(Object.keys(LIVE_WEAPON_RECIPES),Object.keys(expected));
  assert.deepEqual(Object.keys(WEAPONS),Object.keys(expected));
  for(const [id,[template,action,values]] of Object.entries(expected)){
    const r=LIVE_WEAPON_RECIPES[id];
    assert.equal(r.template,template);
    assert.equal(r.action,action);
    assert.deepEqual(knobs.map(k=>r.settings[k]),values);
    assert.equal(Object.isFrozen(r),true);
    assert.equal(Object.isFrozen(r.settings),true);
    const pcm=renderPressureForgePCM(id,r,24000);
    assert.ok(pcm.length>5000);
    assert.ok(pcm.some(v=>v!==0),'approved gun must not be silent');
  }
  assert.equal(WEAPONS['gun-scatter'].pellets,6);
});
test('subtle nonrepeating shot pitch variation stays within 2.3 percent and deterministic',()=>{
  const ids=Object.keys(LIVE_WEAPON_RECIPES);
  for(const id of ids){
    const rates=Array.from({length:12},(_,n)=>shotPitchRate(n+1,id));
    assert.ok(rates.every(x=>x>=.977&&x<=1.023));
    assert.ok(new Set(rates.map(x=>x.toFixed(4))).size>=10);
    assert.equal(rates[0],shotPitchRate(1,id));
  }
  assert.equal(shotPitchRate(NaN),shotPitchRate(0));
});
test('shots at increasing distances become quieter without falling silent immediately',()=>{
  const v=[0,3,12,25,50,100].map(shotDistanceGain);
  assert.equal(v[0],1);
  for(let i=1;i<v.length;i++)assert.ok(v[i]<v[i-1]);
  assert.ok(v[3]<.40);
  assert.ok(v[5]<.10);
  assert.equal(shotDistanceGain(-3),1);
});
test('one source per actual shot, cache PCM and protect speaker with shared compressor',()=>{
  const events=[];
  let buffers=0;
  class Param{value=0;}
  class FakeNode{
    constructor(kind='node'){this.kind=kind;this.gain=new Param();this.frequency=new Param();
      this.threshold=new Param();this.knee=new Param();this.ratio=new Param();
      this.attack=new Param();this.release=new Param();this.delayTime=new Param();this.playbackRate=new Param();}
    connect(node){events.push(['connect',this.kind,node?.kind]);return node;}
    disconnect(){}
    start(){events.push(['start',this.kind]);}
    stop(){events.push(['stop',this.kind]);}
  }
  const ctx={
    sampleRate:24000,currentTime:1,destination:new FakeNode('destination'),
    createGain:()=>new FakeNode('gain'),
    createDynamicsCompressor:()=>new FakeNode('compressor'),
    createBiquadFilter:()=>new FakeNode('filter'),
    createDelay:()=>new FakeNode('delay'),
    createBuffer:(_,n,rate)=>{buffers++;return {duration:n/rate,getChannelData:()=>new Float32Array(n)};},
    createBufferSource:()=>new FakeNode('source'),
  };
  const engine=makeLiveWeaponAudio(()=>ctx);
  assert.equal(buffers,0,'must lazy-build only when shots are fired');
  const own=engine.play('gun-short',{cockpit:true,shotIndex:7});
  assert.equal(own.ok,true,own.reason);
  assert.equal(own.reflectionCount,4);
  assert.equal(engine.cachedCount(),1);
  assert.equal(events.filter(x=>x[0]==='start'&&x[1]==='source').length,1);
  const near=engine.play('gun-short',{distance:3,shotIndex:8});
  const far=engine.play('gun-short',{distance:30,shotIndex:9});
  assert.equal(near.reflectionCount,4);
  assert.ok(far.gain<near.gain);
  assert.ok(own.gain>near.gain);
  assert.notEqual(own.playbackRate,near.playbackRate);
  assert.equal(buffers,1,'different shots reuse the same cached physical gun sound');
  for(const id of Object.keys(expected))assert.equal(engine.play(id,{shotIndex:1}).ok,true);
  assert.equal(buffers,4);
  assert.equal(engine.play('not-a-gun').ok,false);
  for(let i=0;i<20;i++)engine.play('gun-cannon',{shotIndex:i+20});
  assert.ok(events.some(x=>x[0]==='stop'),'busy AI battle bounds active voices');
  engine.stopAll();
});
test('main uses a single round-fire integration and preserves all old feedback and saves',()=>{
  const audio=readFileSync(new URL('../audio.js',import.meta.url),'utf8');
  const main=readFileSync(new URL('../main.js',import.meta.url),'utf8');
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.match(audio,/export function soundWeaponShot\(weaponId,options=\{\}\)/);
  assert.match(main,/soundWeaponShot\(actor\.weaponSpec\.id/);
  assert.match(main,/distance:Math\.hypot\(actor\.rig\.x-rig\.x,actor\.rig\.z-rig\.z\)/);
  assert.match(main,/soundWeaponShot\(weaponSpec\.id,\{shotIndex:shot,cockpit:true\}\)/);
  assert.doesNotMatch(main,/soundScatter\(|soundFire\(/);
  assert.match(main,/soundCombatImpact\(/);
  assert.match(main,/soundSystemEvent\(/);
  assert.match(main,/soundReload\(/);
  assert.match(html,/\.\/audio\.js\?v=k3w11/);
  assert.match(html,/\.\/liveWeaponAudio\.js\?v=k3w11/);
  assert.match(html,/main\.js\?v=k3x/);
  assert.match(html,/0\.0\.1k\.3x — Weapon Anatomy Rewrite/);
  assert.doesNotMatch(audio,/localStorage|storeMachine/);
});
