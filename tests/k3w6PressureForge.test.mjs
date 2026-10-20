import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
 FORGE_KEY,FORGE_WEAPONS,FORGE_TEMPLATES,FORGE_ACTIONS,FORGE_CONTROLS,
 defaultForgeState,normalizeForgeState,changeForgeWeapon,
 readForgeState,saveForgeState,exportForgeState,
} from '../audioPressureForgePresets.js';
import {renderPressureForgePCM,makePressureForgePlayer} from '../audioPressureForgeSynth.js';
class Storage{
  items=new Map();
  getItem(k){return this.items.get(k)??null;}
  setItem(k,v){this.items.set(k,String(v));}
}
const energy=a=>a.reduce((n,v)=>n+v*v,0)/a.length;
const difference=(a,b)=>a.reduce((n,v,i)=>n+Math.abs(v-b[i]??0),0)/Math.max(a.length,b.length);
test('forge contains five meaningful starting templates, four guns, distinct actions and nine controls',()=>{
  assert.equal(FORGE_WEAPONS.length,4);
  assert.equal(FORGE_TEMPLATES.length,5);
  assert.equal(FORGE_ACTIONS.length,5);
  assert.equal(FORGE_CONTROLS.blast.length,5);
  assert.equal(FORGE_CONTROLS.action.length,4);
  const state=defaultForgeState();
  assert.equal(state.weapons['gun-short'].template,'heavy');
  assert.equal(state.weapons['gun-light'].action,'bolt');
  assert.equal(state.weapons['gun-scatter'].action,'pump');
});
test('each gun remembers a different template, action and every slider independently across reload',()=>{
  const storage=new Storage();
  let state=defaultForgeState();
  state=changeForgeWeapon(state,'gun-short',{template:'heavy'});
  state=changeForgeWeapon(state,'gun-short',{settings:{bass:100,delay:85,mass:90}});
  state=changeForgeWeapon(state,'gun-short',{action:'breech'});
  state=changeForgeWeapon(state,'gun-light',{template:'dry'});
  state=changeForgeWeapon(state,'gun-light',{settings:{treble:97,punch:92}});
  state=changeForgeWeapon(state,'gun-scatter',{template:'rough',action:'pump'});
  assert.equal(state.weapons['gun-short'].template,'custom');
  assert.equal(state.weapons['gun-short'].settings.bass,100);
  assert.equal(state.weapons['gun-light'].settings.treble,97);
  assert.equal(state.weapons['gun-cannon'].template,'iron');
  assert.equal(saveForgeState(storage,state),true);
  assert.deepEqual([...storage.items.keys()],[FORGE_KEY]);
  assert.deepEqual(readForgeState(storage),state);
  assert.equal(state.weapons['gun-short'].settings.delay,85);
  storage.setItem(FORGE_KEY,'bad json');
  assert.deepEqual(readForgeState(storage),defaultForgeState());
  assert.deepEqual(normalizeForgeState({version:999,weapons:{}}),defaultForgeState());
  assert.equal(saveForgeState({setItem(){throw Error('blocked');}},state),false);
  assert.throws(()=>changeForgeWeapon(state,'invalid',{template:'dry'}));
  assert.throws(()=>changeForgeWeapon(state,'gun-short',{action:'crystal'}));
});
test('copy exports all four recipes including customized controls in catalogue order',()=>{
  let s=changeForgeWeapon(defaultForgeState(),'gun-short',{settings:{bass:100,delay:85}});
  s=changeForgeWeapon(s,'gun-light',{settings:{treble:95}});
  const text=exportForgeState(s);
  assert.equal((text.match(/\[gun-/g)||[]).length,4);
  assert.match(text,/STUMP CANNON.*BASS 100.*TIMING 85/);
  assert.match(text,/NEEDLE CANNON.*TREBLE 95/);
  assert.ok(text.indexOf('TRAINING CANNON')<text.indexOf('STUMP CANNON'));
  assert.ok(text.indexOf('STUMP CANNON')<text.indexOf('NEEDLE CANNON'));
  assert.match(text,/Not applied to live combat/);
});
test('offline blasts are finite, bounded, and differ substantially by gun and preset',()=>{
  const s=defaultForgeState();
  const sigs=FORGE_WEAPONS.map(w=>renderPressureForgePCM(w.id,s.weapons[w.id],24000,'full'));
  for(const a of sigs){
    assert.ok(a.length>5000&&a.length<29000);
    assert.ok(a.every(Number.isFinite));
    assert.ok(a.every(v=>Math.abs(v)<=.73));
    assert.ok(energy(a)>.00001);
  }
  const fingerprints=sigs.map(a=>[a.length,energy(a).toFixed(5),a[80].toFixed(4)].join(':'));
  assert.equal(new Set(fingerprints).size,4);
  const base=s.weapons['gun-short'];
  const bassLow={...base,settings:{...base.settings,bass:0}};
  const bassHigh={...base,settings:{...base.settings,bass:100}};
  const a=renderPressureForgePCM('gun-short',bassLow,24000,'blast');
  const b=renderPressureForgePCM('gun-short',bassHigh,24000,'blast');
  assert.ok(difference(a,b)>.007,'bass slider changes actual PCM');
  const trebleLow=renderPressureForgePCM('gun-short',{...base,settings:{...base.settings,treble:0}},24000,'blast');
  assert.ok(difference(a,trebleLow)>.005);
  const none=renderPressureForgePCM('gun-short',{...base,action:'none'},24000,'action');
  assert.equal(energy(none),0);
  for(const type of FORGE_ACTIONS.filter(x=>x.id!=='none')){
    const typePCM=renderPressureForgePCM('gun-short',{...base,action:type.id},24000,'action');
    assert.ok(energy(typePCM)>.000001,type.id+' must generate a mechanism');
  }
  assert.throws(()=>renderPressureForgePCM('not-gun',base));
  assert.throws(()=>renderPressureForgePCM('gun-short',base,1000));
  assert.throws(()=>renderPressureForgePCM('gun-short',base,24000,'wrong'));
});
test('iPhone WebAudio remains lazy, limited, reusable and stoppable',()=>{
  const former=globalThis.AudioContext;
  let created=0,started=0,stopped=0,buffers=0;
  class Param{value=0;}
  class Node{
    threshold=new Param();knee=new Param();ratio=new Param();attack=new Param();release=new Param();gain=new Param();
    connect(){return this;}disconnect(){}start(){started++;}stop(){stopped++;}
  }
  class Fake{
    sampleRate=24000;currentTime=1;state='running';destination=new Node();
    constructor(){created++;}
    createDynamicsCompressor(){return new Node();}
    createGain(){return new Node();}
    createBuffer(_,len,rate){buffers++;return {duration:len/rate,getChannelData:()=>new Float32Array(len)};}
    createBufferSource(){return new Node();}
  }
  try{
    globalThis.AudioContext=Fake;
    const engine=makePressureForgePlayer();
    assert.equal(created,0);
    const selection=defaultForgeState().weapons['gun-cannon'];
    assert.equal(engine.play('gun-cannon',selection,'full').ok,true);
    assert.equal(created,1);
    engine.play('gun-cannon',selection,'full');
    assert.equal(buffers,1,'same waveform should be cached for replay');
    engine.play('gun-cannon',selection,'blast');
    engine.play('gun-cannon',selection,'action');
    assert.equal(created,1);
    assert.equal(buffers,3);
    engine.stop();
    assert.ok(started>=4&&stopped>=3);
  }finally{
    if(former===undefined)delete globalThis.AudioContext;
    else globalThis.AudioContext=former;
  }
});
test('forge UI is independent and iPhone layout provides fixed audition controls',()=>{
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const ui=readFileSync(new URL('../audioPressureForgeUI.js',import.meta.url),'utf8');
  const css=readFileSync(new URL('../audioPressureForge.css',import.meta.url),'utf8');
  const main=readFileSync(new URL('../main.js',import.meta.url),'utf8');
  assert.match(html,/pressure-forge-open/);
  assert.match(html,/audioPressureForgeUI\.js\?v=k3w6/);
  assert.match(html,/audioPressureForgePresets\.js\?v=k3w6/);
  assert.match(html,/audioPressureForgeSynth\.js\?v=k3w6/);
  assert.match(html,/audioPressureForge\.css\?v=k3w6/);
  assert.match(ui,/engine\.play\(weaponId,current\(\),mode\)/);
  assert.match(ui,/exportForgeState\(saved\)/);
  assert.match(css,/\.forge-work\{[^}]*overflow:hidden/);
  assert.match(css,/\.forge-edit-pane\{[^}]*overflow-y:auto/);
  assert.match(css,/\.forge-footer/);
  assert.doesNotMatch(main,/audioPressureForge/);
  assert.doesNotMatch(ui,/storeMachine|clearMachineSave|mech-arena-machine-v8/);
});
