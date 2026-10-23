import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {shotDistanceGain,makeLiveWeaponAudio,LIVE_WEAPON_RECIPES} from '../liveWeaponAudio.js';
import {systemDistanceGain} from '../liveSystemsEvents.js';
import {makeLiveSystemsAudio} from '../liveSystemsAudio.js';
import {renderSystemSound} from '../audioSystemsSynth.js';
import {beginAudioWarmup,warmupStatus,warmPCM,cacheWarmPCM} from '../audioWarmup.js';

test('armor glance no longer has tuned handpan partials',()=>{
  const src=readFileSync(new URL('../audioSystemsSynth.js',import.meta.url),'utf8');
  const glance=src.slice(src.indexOf("case 'glance':"),src.indexOf("case 'armor':"));
  assert.doesNotMatch(glance,/metal\(t,/);
  assert.match(glance,/broadband|broad|HARD/i);
  for(let variant=0;variant<3;variant++){
    const pcm=renderSystemSound('glance',variant,16000);
    assert.ok(pcm.some(s=>Math.abs(s)>.03));
    assert.ok(pcm.every(Number.isFinite));
  }
});
test('background distance curves fall much faster while near sounds retain presence',()=>{
  const ds=[0,3,8,12,20,40].map(d=>[systemDistanceGain(d),shotDistanceGain(d)]);
  for(let n=1;n<ds.length;n++){
    assert.ok(ds[n][0]<ds[n-1][0]);
    assert.ok(ds[n][1]<ds[n-1][1]);
  }
  assert.ok(systemDistanceGain(20)<.12);
  assert.ok(systemDistanceGain(40)<.03);
  assert.ok(shotDistanceGain(20)<.20);
  assert.equal(systemDistanceGain(0),1);
});
test('one shared room reverb graph per bus instead of many per hit',()=>{
  const built={delay:0,buffer:0,start:0},links=[];
  class Param{value=0;}
  class Node{
    constructor(type){this.type=type;this.gain=new Param();this.frequency=new Param();
      this.threshold=new Param();this.knee=new Param();this.ratio=new Param();
      this.attack=new Param();this.release=new Param();this.delayTime=new Param();
      this.playbackRate=new Param();}
    connect(other){links.push([this.type,other.type]);return other;}
    disconnect(){}
    start(){built.start++;}
    stop(){}
  }
  const ctx={sampleRate:16000,currentTime:0,state:'running',destination:new Node('destination'),
    createGain:()=>new Node('gain'),createBiquadFilter:()=>new Node('filter'),
    createDynamicsCompressor:()=>new Node('compressor'),
    createDelay:()=>{built.delay++;return new Node('delay');},
    createBuffer:(_,n,rate)=>{built.buffer++;return {duration:n/rate,getChannelData:()=>new Float32Array(n)};},
    createBufferSource:()=>new Node('source'),
  };
  const systems=makeLiveSystemsAudio(()=>ctx),weapon=makeLiveWeaponAudio(()=>ctx);
  const me=systems.play('part',{cockpit:true,variant:2,strength:.8});
  const other=systems.play('part',{distance:12,strength:.8,variant:2});
  const chosen=systems.play('part',{distance:12,focus:true,variant:2,strength:.8});
  assert.ok(me.gain>chosen.gain&&chosen.gain>other.gain*2,
    'my hits and my chosen target outrank ambient impacts');
  assert.equal(me.earlyReflections,4);
  assert.equal(built.delay,4,'one four-tap room for all system hits');
  systems.play('destruction',{cockpit:true});
  systems.play('glance',{cockpit:true});
  assert.equal(built.delay,4,'each hit reuses the same dark room');
  const mine=weapon.play('gun-cannon',{cockpit:true,shotIndex:1});
  const their=weapon.play('gun-cannon',{distance:25,shotIndex:2});
  assert.ok(mine.gain>their.gain*8,'own fire dominates distant shots');
  assert.equal(mine.reflectionCount,4);
  assert.equal(built.delay,8,'a second fixed reverb bus serves all gunfire');
  weapon.play('gun-scatter',{cockpit:true});
  weapon.play('gun-cannon',{distance:3});
  assert.equal(built.delay,8,'no per-shot delay networks');
  assert.equal(systems.bufferCount(),3);
  assert.equal(weapon.cachedCount(),2);
  assert.ok(built.start>=9);
});
test('worker can supply already-rendered PCM before audio starts; sample rate remains valid',()=>{
  const old=globalThis.Worker;
  let constructed=false,terminated=false;
  class FakeWorker{
    constructor(url,opts){constructed=true;assert.match(String(url),/audioWarmWorker\.js\?v=k4w4/);assert.equal(opts.type,'module');}
    terminate(){terminated=true;}
  }
  try{
    globalThis.Worker=FakeWorker;
    beginAudioWarmup();
    assert.equal(constructed,true);
    assert.equal(warmupStatus().started,true);
    const pcm=new Float32Array([0,.2,.5,0]);
    cacheWarmPCM('system','glance',0,pcm,24000);
    assert.deepEqual(warmPCM('system','glance',0)?.pcm,pcm);
    assert.equal(warmPCM('system','glance',0)?.rate,24000);
  }finally{
    if(old===undefined)delete globalThis.Worker;
    else globalThis.Worker=old;
  }
  assert.equal(terminated,false,'worker not stopped before delivering final done signal');
});
test('startup gesture prepares sound, worker boot does not corrupt machine save or reload sound',()=>{
  const audio=readFileSync(new URL('../audio.js',import.meta.url),'utf8');
  const worker=readFileSync(new URL('../audioWarmWorker.js',import.meta.url),'utf8');
  const main=readFileSync(new URL('../main.js',import.meta.url),'utf8');
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.match(audio,/beginAudioWarmup\(\)/);
  assert.match(audio,/addEventListener\('pointerdown'/);
  assert.match(audio,/userActivated/);
  assert.match(audio,/function unlockAudio\(\)/);
  assert.match(audio,/if \(!userActivated\) return null/);
  assert.doesNotMatch(audio,/resumePending/,'no resume promise should be pending before a user gesture');
  assert.match(worker,/renderSystemSound/);
  assert.match(worker,/renderPressureForgePCM/);
  assert.match(worker,/pcm\.buffer/);
  assert.match(main,/focus:true/);
  assert.match(main,/distance>17/);
  assert.match(audio,/export function soundReload\(\)/);
  assert.doesNotMatch(worker,/localStorage|storeMachine/);
  assert.doesNotMatch(audio,/storeMachine/);
  assert.match(html,/audioWarmup\.js\?v=k4w4/);
  assert.match(html,/audioRoom\.js\?v=k3w11/);
  assert.match(html,/0\.0\.1k\.5a\.7 — Physical Footing and Terrain Lab/);
  assert.equal(Object.keys(LIVE_WEAPON_RECIPES).length,8);
});
