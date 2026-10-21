/** k.3w.7 — four selected Pressure Forge recipes, now fixed live weapon assets.
 * Kept separate from editable audition presets. Machine/audio saves are untouched.
 */
import { renderPressureForgePCM } from './audioPressureForgeSynth.js';
import { warmPCM,cacheWarmPCM } from './audioWarmup.js';
import { buildIndustrialRoom } from './audioRoom.js';

const settings=(bass,punch,treble,grit,tail,actionLevel,delay,mass,scrape)=>Object.freeze({
  bass,punch,treble,grit,tail,actionLevel,delay,mass,scrape,
});
export const LIVE_WEAPON_RECIPES=Object.freeze({
  'gun-cannon':Object.freeze({template:'bark',action:'none',
    settings:settings(70,95,76,56,8,46,37,63,32)}),
  'gun-short':Object.freeze({template:'custom',action:'bolt',
    settings:settings(100,76,22,30,58,73,50,25,20)}),
  'gun-light':Object.freeze({template:'custom',action:'bolt',
    settings:settings(54,100,94,40,12,65,60,85,30)}),
  'gun-scatter':Object.freeze({template:'custom',action:'breech',
    settings:settings(88,100,45,95,90,95,80,95,95)}),
});
const finite=(value,fallback=0)=>Number.isFinite(value)?value:fallback;

/** Stable small variations avoid the same digital gunshot every pull.
 * Oscillator-esque pitch sweeps would reintroduce the chirp the user rejected;
 * instead we alter buffer playback speed by less than 2.5%.
 */
export function shotPitchRate(shotIndex=0,weaponId='gun-cannon'){
  const n=Math.max(0,Math.floor(finite(shotIndex)));
  const seed=Object.keys(LIVE_WEAPON_RECIPES).indexOf(weaponId)+1;
  const fract=x=>x-Math.floor(x);
  return 1+(fract(n*.7548776662466927+seed*.3819660112501051)*2-1)*.023;
}
/** World coordinates use meters. A shot twenty meters away is significantly
 * softer than one a few meters away. Never increase distant fire volume.
 */
export function shotDistanceGain(distance=0){
  const d=Math.max(0,finite(distance,0));
  return 1/(1+Math.pow(d/8,1.85));
}
/** A single limiter/low-pass bus for weapon audio, with very small cockpit
 * early reflections (not an arena-sized echo). The current ambient/tone
 * feedback stays owned by audio.js.
 */
export function makeLiveWeaponAudio(getContext){
  const buffers=new Map();
  const voices=new Set();
  let ctx=null,bus=null,room=null;
  const ensureBus=()=>{
    const next=getContext();
    if(!next)return null;
    if(ctx===next&&bus)return ctx;
    // One bus and small capped cache for the same WebAudio context.
    ctx=next;
    bus=ctx.createGain();
    bus.gain.value=.37;
    const limiter=ctx.createDynamicsCompressor();
    limiter.threshold.value=-21;limiter.knee.value=8;limiter.ratio.value=10;
    limiter.attack.value=.003;limiter.release.value=.13;
    room=buildIndustrialRoom(ctx,limiter,{bassDb:3.7});
    bus.connect(room.dry);limiter.connect(ctx.destination);
    buffers.clear();
    return ctx;
  };
  function stopAll(){
    for(const v of [...voices]){try{v.source.stop();}catch{}}
  }
  function play(weaponId,{distance=0,cockpit=false,shotIndex=0}={}){
    if(!Object.hasOwn(LIVE_WEAPON_RECIPES,weaponId))return {ok:false,reason:'Unknown live weapon'};
    try{
      const c=ensureBus();
      if(!c)return {ok:false,reason:'Web Audio unavailable'};
      if(c.state==='suspended')return {ok:true,skipped:true,weaponId};
      let buffer=buffers.get(weaponId);
      if(!buffer){
        const cached=warmPCM('weapon',weaponId,0);
        // Never run the expensive Pressure Forge renderer on the main thread
        // during combat. audio.js plays a small immediate fallback impulse until
        // the off-thread buffer arrives.
        if(!cached)return {ok:false,pending:true,weaponId};
        const {rate,pcm}=cached;
        buffer=c.createBuffer(1,pcm.length,rate);
        buffer.getChannelData(0).set(pcm);
        buffers.set(weaponId,buffer);
      }
      // Keep the newest relevant hits in a busy six-rig firefight, not
      // dozens of lingering gunshot graphs when sustained fire overlaps.
      if(voices.size>=9){
        const oldest=voices.values().next().value;
        try{oldest.source.stop();}catch{}
      }
      const source=c.createBufferSource();
      source.buffer=buffer;
      const playbackRate=shotPitchRate(shotIndex,weaponId);
      source.playbackRate.value=playbackRate;
      const lowpass=c.createBiquadFilter();
      lowpass.type='lowpass';
      const d=Math.max(0,finite(distance));
      lowpass.frequency.value=cockpit?11000:Math.max(1050,8500/(1+d/9));
      source.connect(lowpass);
      const dry=c.createGain();
      const gain=cockpit?.88:(.45*shotDistanceGain(d));
      dry.gain.value=gain;
      lowpass.connect(dry);dry.connect(bus);
      const release=[source,lowpass,dry];
      const inRoom=cockpit||d<12;
      if(inRoom){
        // The whole gun bus shares four dark warehouse reflections.
        // Only a single send node is needed per shot, rather than a pair
        // of expensive per-trigger delay/filter chains.
        const send=c.createGain();
        send.gain.value=gain*(cockpit?.82:.37)*bus.gain.value;
        lowpass.connect(send);send.connect(room.send);
        release.push(send);
      }
      const voice={source};
      voices.add(voice);
      source.onended=()=>{
        voices.delete(voice);
        for(const node of release){try{node.disconnect();}catch{}}
      };
      source.start(c.currentTime+.002);
      return {ok:true,weaponId,playbackRate,gain,cockpit,reflectionCount:inRoom?room.taps:0};
    }catch(error){
      return {ok:false,reason:String(error?.message??error)};
    }
  }
  return {play,stopAll,activeCount:()=>voices.size,cachedCount:()=>buffers.size};
}
