import { renderStumpExperiment } from './audioBenchStumpMaterials.js';
/** k.3w.4 / Distinct industrial weapon sound architectures.
 * Audition-only: live weapon gameplay/audio stays unchanged until approved.
 * Browser Web Audio only: no downloads or recorded samples.
 */
export const BENCH_WEAPONS=Object.freeze([
  Object.freeze({id:'gun-cannon',label:'TRAINING CANNON',identity:'BALANCED / DRY WORKHORSE',body:115,metal:320,cycle:.205,length:.24,force:.84}),
  Object.freeze({id:'gun-short',label:'STUMP CANNON',identity:'LOW / DEEP IRON THUD',body:66,metal:155,cycle:.43,length:.46,force:1.06}),
  Object.freeze({id:'gun-light',label:'NEEDLE CANNON',identity:'SHARP SHOT / SLOW VIVID ACTION',body:170,metal:560,cycle:.47,length:.12,force:.70}),
  Object.freeze({id:'gun-scatter',label:'S-6 SCATTERGUN',identity:'ROUGH / MECHANICAL SHUDDER',body:89,metal:235,cycle:.265,length:.29,force:1}),
]);
export const BENCH_VARIATIONS=Object.freeze([
  Object.freeze({id:'A',label:'LOW & HEAVY',low:1.34,crack:.65,ring:.74,action:.80,pitch:.84}),
  Object.freeze({id:'B',label:'SHARP & METALLIC',low:.76,crack:1.30,ring:1.42,action:.84,pitch:1.13}),
  Object.freeze({id:'C',label:'ROUGH & MECHANICAL',low:.96,crack:.85,ring:1.02,action:1.50,pitch:.94}),
]);
const clamp=(v,low,high)=>Math.max(low,Math.min(high,Number.isFinite(Number(v))?Number(v):low));
export function benchRecipe(weaponId='gun-cannon',variationId='A',mix={}){
  const weapon=BENCH_WEAPONS.find(w=>w.id===weaponId);
  const variation=BENCH_VARIATIONS.find(v=>v.id===variationId);
  if(!weapon||!variation)throw Error('Unknown sound bench recipe');
  const controls={body:clamp(mix.body??50,0,100),
    metal:clamp(mix.metal??50,0,100),action:clamp(mix.action??50,0,100)};
  const amount=value=>.28+value/100*1.44;
  return Object.freeze({
    weaponId,variationId,weapon,variation,controls,
    bassHz:weapon.body*variation.pitch,
    metalHz:weapon.metal*variation.pitch,
    bodyLevel:variation.low*amount(controls.body)*weapon.force,
    crackLevel:variation.crack*amount(controls.metal)*weapon.force,
    ringLevel:variation.ring*amount(controls.metal),
    cycleLevel:variation.action*amount(controls.action),
    architecture:weaponId==='gun-short'?'heavy-breech-and-tail':
      weaponId==='gun-scatter'?'grit-rattle-and-pump':
      weaponId==='gun-light'?'needle-crack-delayed-bolt':'balanced-report-short-cycle',
  });
}

/** AudioContext is created only during a direct PLAY tap (iPhone Safari).
 * Sources are one-shot, gated and disconnected. Output is intentionally
 * quiet, with a safety compressor and no continuous background loops.
 */
export function makeBenchAudioEngine(){
  let ctx=null,noise=null,master=null;
  const active=new Set();
  const stumpBuffers=new Map();
  let unavailable=false;
  const context=()=>{
    if(ctx)return ctx;
    const Constructor=globalThis.AudioContext||globalThis.webkitAudioContext;
    if(!Constructor){unavailable=true;return null;}
    ctx=new Constructor();
    noise=ctx.createBuffer(1,Math.ceil(ctx.sampleRate*1.5),ctx.sampleRate);
    const samples=noise.getChannelData(0);
    let seed=0x1492ab7;
    for(let i=0;i<samples.length;i++){
      seed=(Math.imul(seed,1664525)+1013904223)>>>0;
      samples[i]=seed/4294967295*2-1;
    }
    const limiter=ctx.createDynamicsCompressor();
    limiter.threshold.value=-21;limiter.knee.value=8;limiter.ratio.value=13;
    limiter.attack.value=.003;limiter.release.value=.18;
    master=ctx.createGain();master.gain.value=.28;
    master.connect(limiter);limiter.connect(ctx.destination);
    return ctx;
  };
  const envelope=(time,length,volume,attack=.003)=>{
    const gain=ctx.createGain();
    const begin=Math.max(time,ctx.currentTime+.001);
    const duration=Math.max(.015,length);
    gain.gain.setValueAtTime(.0001,begin);
    gain.gain.exponentialRampToValueAtTime(Math.max(.0002,volume),begin+Math.min(attack,duration*.35));
    gain.gain.exponentialRampToValueAtTime(.0001,begin+duration);
    gain.connect(master);
    return gain;
  };
  const add=(node,time,duration)=>{
    active.add(node);
    node.onended=()=>{active.delete(node);try{node.disconnect();}catch{}};
    node.start(time);node.stop(time+duration+.01);
  };
  const tone=(t,d,from,to,amount,type='triangle')=>{
    const osc=ctx.createOscillator();
    osc.type=type;
    osc.frequency.setValueAtTime(Math.max(22,from),t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(22,to),t+d);
    osc.connect(envelope(t,d,amount));
    add(osc,t,d);
  };
  const burst=(t,d,hz,endHz,q,volume,filterType='bandpass')=>{
    const source=ctx.createBufferSource();
    source.buffer=noise;
    const filter=ctx.createBiquadFilter();
    filter.type=filterType;
    filter.Q.value=q;
    filter.frequency.setValueAtTime(Math.max(45,hz),t);
    filter.frequency.exponentialRampToValueAtTime(Math.max(45,endHz),t+d);
    source.connect(filter);
    filter.connect(envelope(t,d,volume,.0015));
    add(source,t,d);
  };
  const playTraining=(t,r)=>{
    // Dry, centered cannon: short punch, shell snap, simple crisp bolt return.
    tone(t,.20,r.bassHz*1.20,r.bassHz*.55,.105*r.bodyLevel,'triangle');
    burst(t,.033,1500,740,.7,.12*r.crackLevel,'highpass');
    burst(t+.009,.118,420,190,.65,.065*r.bodyLevel,'lowpass');
    tone(t+.014,.10,r.metalHz*1.7,r.metalHz*.93,.030*r.ringLevel,'sine');
    burst(t+.195,.035,1300,810,1.8,.058*r.cycleLevel);
    tone(t+.227,.075,390,205,.033*r.cycleLevel,'square');
  };
  const playStump=(t,r)=>{
    // A low chamber whomp, heavy piston mass, two distinct delayed iron impacts.
    // No long buzzy high-frequency laser tail.
    tone(t,.43,r.bassHz*2.20,r.bassHz*.55,.16*r.bodyLevel,'triangle');
    tone(t+.012,.34,r.bassHz*1.6,r.bassHz*.72,.090*r.bodyLevel,'sine');
    burst(t,.095,520,135,.62,.105*r.bodyLevel,'lowpass');
    burst(t+.014,.044,1040,500,.50,.040*r.crackLevel,'bandpass');
    tone(t+.185,.12,r.metalHz*1.38,r.metalHz*.55,.058*r.ringLevel,'triangle');
    burst(t+.245,.09,405,145,1.7,.074*r.cycleLevel,'lowpass');
    tone(t+.44,.17,205,74,.075*r.cycleLevel,'triangle');
    burst(t+.49,.065,590,250,2.0,.065*r.cycleLevel);
  };
  const playScatter=(t,r)=>{
    // One shell: broad gritty breakup and pronounced irregular three-stage
    // metalwork, rough grind, pump, finally a latch catching.
    burst(t,.125,2250,360,.42,.132*r.crackLevel,'bandpass');
    burst(t+.006,.24,770,135,.62,.125*r.bodyLevel,'lowpass');
    tone(t+.012,.15,r.bassHz*1.85,r.bassHz*.52,.092*r.bodyLevel,'sawtooth');
    burst(t+.064,.16,1650,520,.76,.077*r.crackLevel,'bandpass');
    burst(t+.245,.075,1700,590,2.0,.092*r.cycleLevel);
    tone(t+.286,.095,300,145,.050*r.cycleLevel,'square');
    burst(t+.36,.105,990,270,1.15,.087*r.cycleLevel);
    tone(t+.434,.13,r.metalHz*1.55,r.metalHz*.59,.068*r.ringLevel,'triangle');
    burst(t+.555,.052,1900,880,2.8,.080*r.cycleLevel);
  };
  const playNeedle=(t,r)=>{
    // Needle: almost no bass and a piercing dry snap. The bolt movement is
    // intentionally SLOWER and more vivid than the actual shot.
    burst(t,.028,3600,2100,.60,.158*r.crackLevel,'highpass');
    burst(t+.004,.043,1650,780,1.4,.075*r.crackLevel);
    tone(t,.074,r.bassHz*2.2,r.bassHz*.80,.048*r.bodyLevel,'triangle');
    tone(t+.018,.17,r.metalHz*4.4,r.metalHz*1.8,.037*r.ringLevel,'sine');
    // Three separated actions: slide/back -> clack -> slide/forward -> lock.
    burst(t+.35,.068,2700,1120,3.5,.075*r.cycleLevel,'bandpass');
    tone(t+.36,.13,920,300,.052*r.cycleLevel,'triangle');
    burst(t+.49,.058,840,420,2.2,.067*r.cycleLevel,'bandpass');
    tone(t+.55,.19,390,155,.063*r.cycleLevel,'square');
    burst(t+.72,.034,3400,1460,4.2,.080*r.cycleLevel,'bandpass');
  };
  const stop=()=>{
    for(const node of active){try{node.stop();}catch{}}
    active.clear();
  };
  const play=(weaponId,variationId,mix={})=>{
    let r;
    try{r=benchRecipe(weaponId,variationId,mix);}
    catch(error){return {ok:false,reason:error.message};}
    try{
      const live=context();
      if(!live)return {ok:false,reason:'WEB AUDIO NOT AVAILABLE'};
      if(live.state==='suspended')void live.resume().catch(()=>{});
      stop();
      const t=live.currentTime+.025;
      // Weapon-specific event arrangements, not just a shared pitched formula.
      switch(weaponId){
        case 'gun-short':playStump(t,r);break;
        case 'gun-scatter':playScatter(t,r);break;
        case 'gun-light':playNeedle(t,r);break;
        default:playTraining(t,r);break;
      }
      return {ok:true,recipe:r,state:live.state};
    }catch(error){stop();return {ok:false,reason:String(error?.message||error)};}
  };
  /** Material PCM uses the SAME tapped AudioContext, limiter and stop path
   * as the saved-reference shot. It never touches the per-weapon A/B/C presets.
   */
  const playStumpExperiment=(kind)=>{
    try{
      const live=context();
      if(!live)return {ok:false,reason:'WEB AUDIO NOT AVAILABLE'};
      if(live.state==='suspended')void live.resume().catch(()=>{});
      let buffer=stumpBuffers.get(kind);
      if(!buffer){
        const samples=renderStumpExperiment(kind,live.sampleRate);
        buffer=live.createBuffer(1,samples.length,live.sampleRate);
        buffer.getChannelData(0).set(samples);
        stumpBuffers.set(kind,buffer);
      }
      stop();
      const source=live.createBufferSource();
      source.buffer=buffer;
      source.connect(master);
      active.add(source);
      source.onended=()=>{active.delete(source);try{source.disconnect();}catch{}};
      const t=live.currentTime+.014;
      source.start(t);
      source.stop(t+buffer.duration+.005);
      return {ok:true,kind,state:live.state};
    }catch(error){
      stop();
      return {ok:false,reason:String(error?.message||error)};
    }
  };
  return {play,playStumpExperiment,stop,getState:()=>unavailable?'unavailable':ctx?.state??'locked'};
}
