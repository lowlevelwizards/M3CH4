/** k.3w.11 / Mixed, spatial live systems sound from pre-rendered PCM.
 * Soundscape priority: cockpit blast > local damage / focused hit > other
 * weapons > distant effects > nearby machinery > distant machinery.
 * A single shared room graph replaces four fresh delay nodes per hit.
 */
import {renderSystemSound} from './audioSystemsSynth.js';
import {systemDistanceGain} from './liveSystemsEvents.js';
import {warmPCM,cacheWarmPCM} from './audioWarmup.js';
import {buildIndustrialRoom} from './audioRoom.js';

const LEVEL=Object.freeze({
  glance:.53,armor:.88,part:1.02,destruction:1.29,
  sparks:.25,zap:.30,recharge:.23,engine:.20,hydraulics:.22,
  yardwalker:.65,kestrel:.44,hauler:.91,
});
const LOW_BODY=new Set(['part','destruction','hauler','yardwalker','armor']);
const MACHINERY=new Set(['engine','hydraulics','kestrel','yardwalker','hauler']);
export function makeLiveSystemsAudio(getContext){
  let ctx=null,bus=null,room=null;
  const buffers=new Map();
  const active=new Set();
  const initialize=()=>{
    const c=getContext();
    if(!c)return null;
    if(c===ctx&&bus)return c;
    ctx=c;
    buffers.clear();
    bus=c.createGain();bus.gain.value=.235;
    const limiter=c.createDynamicsCompressor();
    limiter.threshold.value=-21;limiter.knee.value=7;limiter.ratio.value=11;
    limiter.attack.value=.003;limiter.release.value=.18;
    room=buildIndustrialRoom(c,limiter,{bassDb:3.4});
    bus.connect(room.dry);
    limiter.connect(c.destination);
    return c;
  };
  const stopAll=()=>{
    for(const item of [...active]){try{item.source.stop();}catch{}}
  };
  const play=(id,{variant=0,distance=0,cockpit=false,focus=false,strength=1}={})=>{
    if(!Object.hasOwn(LEVEL,id))return {ok:false,reason:'Unknown live system effect'};
    const d=Math.max(0,Number.isFinite(distance)?distance:0);
    const intensity=Math.max(0,Math.min(1.35,Number.isFinite(strength)?strength:1));
    if(!intensity||d>68||(MACHINERY.has(id)&&!cockpit&&d>20))
      return {ok:true,skipped:true,id};
    // Prevent far-off machinery from masking an actual damaging hit.
    if(MACHINERY.has(id)&&!cockpit&&active.size>=8)
      return {ok:true,skipped:true,id};
    try{
      const c=initialize();
      if(!c)return {ok:false,reason:'Web Audio unavailable'};
      if(c.state==='suspended')return {ok:true,skipped:true,id};
      const v=Math.max(0,Math.min(2,Math.floor(variant)));
      const key=id+'/'+v;
      let buffer=buffers.get(key);
      if(!buffer){
        const cached=warmPCM('system',id,v);
        // No big synchronous synthesis from six combatants. Important hits
        // use audio.js's tiny fallback while the worker primes this recipe.
        if(!cached&&typeof Worker!=='undefined')return {ok:false,pending:true,id};
        const rate=cached?.rate??c.sampleRate;
        const pcm=cached?.pcm??renderSystemSound(id,v,rate);
        if(!cached)cacheWarmPCM('system',id,v,pcm,rate);
        buffer=c.createBuffer(1,pcm.length,rate);
        buffer.getChannelData(0).set(pcm);
        buffers.set(key,buffer);
      }
      const engines=[...active].filter(v=>v.id==='engine');
      if(id==='engine'&&engines.length>=2)return {ok:true,skipped:true,id};
      if(active.size>=10){
        const oldest=active.values().next().value;
        try{oldest.source.stop();}catch{}
        active.delete(oldest);
      }
      const source=c.createBufferSource();source.buffer=buffer;
      const filter=c.createBiquadFilter();filter.type='lowpass';
      filter.frequency.value=cockpit?11500:Math.max(850,6600/(1+d/8));
      const volume=cockpit?.88:focus
        ?.83/(1+Math.pow(d/13,1.65))
        :.30*systemDistanceGain(d);
      const gain=LEVEL[id]*intensity*volume;
      const dry=c.createGain();dry.gain.value=gain;
      source.connect(filter);filter.connect(dry);dry.connect(bus);
      const nodes=[source,filter,dry];
      const roomEnabled=!MACHINERY.has(id)&&
        (cockpit||focus||d<10);
      if(roomEnabled){
        // More bloom for serious damage than for a small metal tick; dark
        // reflections are spatial support, never repeated full-volume shots.
        const wet=LOW_BODY.has(id)? .69:.35;
        const send=c.createGain();
        send.gain.value=gain*wet*(cockpit?1:focus?.83:.45)*bus.gain.value;
        filter.connect(send);send.connect(room.send);
        nodes.push(send);
      }
      const item={source,id};
      active.add(item);
      source.onended=()=>{
        active.delete(item);
        for(const node of nodes)try{node.disconnect();}catch{}
      };
      source.start(c.currentTime+.002);
      return {ok:true,id,variant:v,gain,distance:d,
        earlyReflections:roomEnabled?room.taps:0,focus:!!focus};
    }catch(error){return {ok:false,reason:String(error?.message??error)};}
  };
  return {play,stopAll,activeCount:()=>active.size,bufferCount:()=>buffers.size};
}
