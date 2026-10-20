/** k.3w.10 / Production effects from the auditioned k3w9 PCM library.
 * No new timing or gameplay state: a playback-only voice bus sharing audio.js
 * user-unlocked AudioContext. No editable demo preset/save writes.
 */
import {renderSystemSound} from './audioSystemsSynth.js';
import {systemDistanceGain} from './liveSystemsEvents.js';

const LEVEL=Object.freeze({
  glance:.52,armor:.81,part:.91,destruction:1.23,
  sparks:.36,zap:.38,recharge:.34,engine:.34,hydraulics:.35,
  yardwalker:.68,kestrel:.48,hauler:.96,
});
const LOW_BODY=new Set(['part','destruction','hauler','yardwalker','armor']);
const QUIET_DISTANCE=new Set(['engine','hydraulics','kestrel','yardwalker','hauler']);
export function makeLiveSystemsAudio(getContext){
  let ctx=null,bus=null;
  const samples=new Map();
  const active=new Set();
  const initialize=()=>{
    const c=getContext();
    if(!c)return null;
    if(c===ctx&&bus)return c;
    ctx=c;
    samples.clear();
    bus=c.createGain();
    bus.gain.value=.27;
    const limiter=c.createDynamicsCompressor();
    limiter.threshold.value=-22;limiter.knee.value=7;limiter.ratio.value=11;
    limiter.attack.value=.003;limiter.release.value=.17;
    bus.connect(limiter);limiter.connect(c.destination);
    return c;
  };
  const stopAll=()=>{for(const item of [...active]){try{item.source.stop();}catch{}}};
  const play=(id,{variant=0,distance=0,cockpit=false,strength=1}={})=>{
    if(!Object.hasOwn(LEVEL,id))return {ok:false,reason:'Unknown live system effect'};
    const d=Math.max(0,Number.isFinite(distance)?distance:0);
    const intensity=Math.max(0,Math.min(1.5,Number.isFinite(strength)?strength:1));
    if(!intensity||(QUIET_DISTANCE.has(id)&&d>38)||d>85)
      return {ok:true,skipped:true,id};
    try{
      const c=initialize();
      if(!c)return {ok:false,reason:'Web Audio unavailable'};
      const v=Math.max(0,Math.min(2,Math.floor(variant)));
      const key=id+'/'+v;
      let buffer=samples.get(key);
      if(!buffer){
        const pcm=renderSystemSound(id,v,c.sampleRate);
        buffer=c.createBuffer(1,pcm.length,c.sampleRate);
        buffer.getChannelData(0).set(pcm);
        samples.set(key,buffer);
      }
      if(active.size>=16){
        const oldest=active.values().next().value;
        try{oldest.source.stop();}catch{}
        active.delete(oldest);
      }
      const source=c.createBufferSource();source.buffer=buffer;
      const filter=c.createBiquadFilter();filter.type='lowpass';
      filter.frequency.value=cockpit?10200:Math.max(1180,7600/(1+d/16));
      const dry=c.createGain();
      const gain=LEVEL[id]*intensity*(cockpit?.90:.75*systemDistanceGain(d));
      dry.gain.value=gain;
      source.connect(filter);filter.connect(dry);dry.connect(bus);
      const nodes=[source,filter,dry];
      let earlyReflections=0;
      // Short early indoor slap and dark cavity reflection. A large impact
      // has more bloom; soft electrical ticks and motors do NOT get reverb.
      if(cockpit||(!QUIET_DISTANCE.has(id)&&d<16)){
        const low=LOW_BODY.has(id);
        const wet=cockpit?(low?.095:.034):(low?.062:.025);
        const coloration=c.createBiquadFilter();
        coloration.type='lowpass';coloration.frequency.value=low?1700:2500;
        filter.connect(coloration);nodes.push(coloration);
        for(const [seconds,scale] of [[.033,1],[.087,.42]]){
          const delay=c.createDelay(.16);delay.delayTime.value=seconds;
          const echo=c.createGain();echo.gain.value=gain*wet*scale;
          coloration.connect(delay);delay.connect(echo);echo.connect(bus);
          nodes.push(delay,echo);earlyReflections++;
        }
      }
      const item={source};
      active.add(item);
      source.onended=()=>{
        active.delete(item);
        for(const node of nodes)try{node.disconnect();}catch{}
      };
      source.start(c.currentTime+.002);
      return {ok:true,id,variant:v,gain,earlyReflections,distance:d};
    }catch(e){return {ok:false,reason:String(e?.message??e)};}
  };
  return {play,stopAll,activeCount:()=>active.size,bufferCount:()=>samples.size};
}
