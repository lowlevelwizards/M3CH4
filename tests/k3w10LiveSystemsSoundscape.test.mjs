import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  hitSoundPlan,soundFamilyFor,createMotionSoundState,
  advanceMotionSound,systemDistanceGain,
} from '../liveSystemsEvents.js';
import {makeLiveSystemsAudio} from '../liveSystemsAudio.js';
import {renderSystemSound} from '../audioSystemsSynth.js';

test('real armor, breach, disable and destruction outcomes select grounded sounds',()=>{
  assert.deepEqual(hitSoundPlan({armorAbsorbed:25,internalDamage:0,remainingArmor:90},{ordinal:0}),
    [{id:'glance',variant:0,strength:.60}]);
  assert.equal(hitSoundPlan({armorAbsorbed:10,internalDamage:0,remainingArmor:50},{ordinal:1})[0].variant,1);
  assert.equal(hitSoundPlan({armorAbsorbed:18,remainingArmor:0,internalDamage:0})[0].id,'armor');
  assert.equal(hitSoundPlan({armorAbsorbed:0,internalDamage:13,remainingArmor:0})[0].id,'part');
  const breached=hitSoundPlan({armorAbsorbed:10,internalDamage:4,remainingArmor:0});
  assert.deepEqual(breached.map(s=>s.id),['part','armor']);
  const power=hitSoundPlan({internalDamage:20,armorAbsorbed:0},{slot:'power'});
  assert.deepEqual(power.map(s=>s.id),['part','sparks']);
  assert.deepEqual(hitSoundPlan({internalDamage:20,armorAbsorbed:0},{slot:'power',ordinal:1})
    .map(s=>s.id),['part','zap']);
  assert.deepEqual(hitSoundPlan({justDestroyed:true},{slot:'power',ordinal:1})
    .map(s=>s.id),['destruction','zap']);
  assert.deepEqual(hitSoundPlan({justDisabled:true,internalDamage:23},{slot:'combat'}).map(s=>s.id),['destruction']);
  assert.deepEqual(hitSoundPlan({justDestroyed:true,internalDamage:40},{slot:'power'}).map(s=>s.id),['destruction','sparks']);
  assert.equal(hitSoundPlan({internalDamage:0,armorAbsorbed:0},{shielded:true})[0].id,'glance');
  assert.deepEqual(hitSoundPlan({armorAbsorbed:0,internalDamage:0}),[]);
  assert.deepEqual(hitSoundPlan(null),[]);
});
test('three mobility systems have distinct real-displacement strides and cadence caps',()=>{
  const yard=soundFamilyFor('legs-yard');
  const kestrel=soundFamilyFor('legs-compact');
  const hauler=soundFamilyFor('legs-hauler');
  assert.deepEqual([yard.id,kestrel.id,hauler.id],['yardwalker','kestrel','hauler']);
  assert.ok(kestrel.strideM<yard.strideM&&yard.strideM<hauler.strideM);
  assert.ok(kestrel.minimumSeconds<hauler.minimumSeconds);
  const state=createMotionSoundState();
  const all=[];
  for(let i=0;i<180;i++)all.push(...advanceMotionSound(state,yard,3,.02));
  const footsteps=all.filter(x=>x==='yardwalker');
  const machines=all.filter(x=>x==='engine');
  const valves=all.filter(x=>x==='hydraulics');
  assert.ok(footsteps.length>=4&&footsteps.length<=10);
  assert.ok(machines.length>=2&&machines.length<=4,'one engine sample per ~1.35s');
  assert.ok(valves.length>=1&&valves.length<=4,'hydraulics every three contacts');
  const settled=advanceMotionSound(state,yard,0,.1);
  assert.ok(!settled.includes('yardwalker'),'stationary mechs do not stamp indefinitely');
  assert.ok(settled.filter(x=>x==='engine').length<=1);
  const resumed=advanceMotionSound(state,yard,4,.02);
  assert.ok(!resumed.includes('yardwalker'),'movement starts from measured displacement');
});
test('distance attenuation is monotonic, with true acoustic dynamic range',()=>{
  const gains=[0,3,10,20,40,80].map(systemDistanceGain);
  assert.equal(gains[0],1);
  for(let i=1;i<gains.length;i++)assert.ok(gains[i]<gains[i-1]);
  assert.ok(gains[4]<.2);
  assert.ok(gains[5]<.08);
  assert.equal(systemDistanceGain(NaN),1);
  assert.equal(systemDistanceGain(-5),1);
});
test('production system player caches selected PCM, limits polyphony and provides short cabin reflections',()=>{
  const connections=[];
  let buffers=0,starts=0,stops=0;
  class Param{value=0;}
  class Node{
    constructor(type){this.type=type;this.gain=new Param();this.frequency=new Param();
      this.threshold=new Param();this.knee=new Param();this.ratio=new Param();
      this.attack=new Param();this.release=new Param();this.delayTime=new Param();}
    connect(dest){connections.push([this.type,dest.type]);return dest;}
    disconnect(){}
    start(){starts++;}
    stop(){stops++;}
  }
  const ctx={
    sampleRate:16000,currentTime:1,destination:new Node('destination'),
    createGain:()=>new Node('gain'),createDynamicsCompressor:()=>new Node('compressor'),
    createBiquadFilter:()=>new Node('filter'),createDelay:()=>new Node('delay'),
    createBuffer:(_,n,rate)=>{buffers++;return {duration:n/rate,getChannelData:()=>new Float32Array(n)};},
    createBufferSource:()=>new Node('source'),
  };
  const player=makeLiveSystemsAudio(()=>ctx);
  assert.equal(player.bufferCount(),0,'no precalculation before audio unlock');
  const own=player.play('destruction',{cockpit:true,variant:2});
  assert.equal(own.ok,true,own.reason);
  assert.equal(own.earlyReflections,4);
  const far=player.play('destruction',{distance:32,variant:2});
  assert.equal(far.earlyReflections,0);
  assert.ok(far.gain<own.gain);
  assert.equal(buffers,1,'reused sample for distance and cockpit');
  assert.equal(player.play('yardwalker',{distance:60}).skipped,true,'distant footfalls are culled');
  assert.equal(player.play('reload').ok,false,'bad reload audio must not be promoted');
  assert.equal(player.play('sparks',{variant:2,cockpit:true}).ok,true);
  assert.equal(player.play('engine',{distance:4}).ok,true);
  assert.equal(player.bufferCount(),3);
  for(let n=0;n<24;n++)player.play('glance',{variant:n%2,cockpit:false});
  assert.ok(stops>0,'voice safety cap activates in a firefight');
  assert.ok(starts>=20);
  assert.ok(connections.some(x=>x[0]==='delay'),'actual filtered indoor early reflections are wired');
  player.stopAll();
});
test('every production event has real PCM and retains previous weapon, reload and save behavior',()=>{
  for(const id of ['glance','armor','part','destruction','sparks','zap','recharge',
    'engine','hydraulics','yardwalker','kestrel','hauler']){
    assert.ok(renderSystemSound(id,0,16000).some(x=>x!==0),id+' must sound');
  }
  const audio=readFileSync(new URL('../audio.js',import.meta.url),'utf8');
  const main=readFileSync(new URL('../main.js',import.meta.url),'utf8');
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  assert.match(main,/soundCombatImpact\(visualHit/);
  assert.match(main,/emitMachineMotionSound\(actor\.assembly,actor\.rig/);
  assert.match(main,/emitMachineMotionSound\(assembly,rig/);
  assert.match(main,/!powerWasReady&&playerPower\.weaponReady/);
  assert.match(audio,/export function soundSystemEvent/);
  assert.match(audio,/export function soundCombatImpact/);
  assert.match(audio,/export function soundReload\(\)/);
  assert.doesNotMatch(main,/soundImpact\(|soundShield\(/);
  assert.doesNotMatch(main,/audioSystemsPresets|systems-sound-lab-v1/);
  assert.match(html,/liveSystemsAudio\.js\?v=k4i/);
  assert.match(html,/liveSystemsEvents\.js\?v=k5a5/);
  assert.match(html,/main\.js\?v=k6m1/);
  assert.match(html,/audio\.js\?v=k4i/);
  assert.match(html,/0\.0\.1k\.5b\.5 — Catch Steps and Mechanical Flow/);
});
