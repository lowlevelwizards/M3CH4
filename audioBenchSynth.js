/** k.3w.3 - code-only audition instrument. No sounds ship as files.
 * This is deliberately separate from combat audio until a sound is approved
 * by the person listening to it. No random device-dependent settings saved.
 */
export const BENCH_WEAPONS = Object.freeze([
  Object.freeze({ id:'gun-cannon', label:'TRAINING CANNON', identity:'BALANCED / WORKHORSE', body:105, metal:275, cycle:.18, length:.30, force:.85 }),
  Object.freeze({ id:'gun-short', label:'STUMP CANNON', identity:'SHORT / BRUTAL', body:71, metal:205, cycle:.30, length:.40, force:1.05 }),
  Object.freeze({ id:'gun-light', label:'NEEDLE CANNON', identity:'NARROW / FAST', body:145, metal:470, cycle:.105, length:.20, force:.62 }),
  Object.freeze({ id:'gun-scatter', label:'S-6 SCATTERGUN', identity:'SIX PELLETS / ONE SHELL', body:62, metal:160, cycle:.39, length:.51, force:1.12 }),
]);
export const BENCH_VARIATIONS = Object.freeze([
  Object.freeze({ id:'A', label:'LOW & HEAVY', low:1.34, crack:.65, ring:.74, action:.80, pitch:.84 }),
  Object.freeze({ id:'B', label:'SHARP & METALLIC', low:.76, crack:1.30, ring:1.42, action:.84, pitch:1.13 }),
  Object.freeze({ id:'C', label:'ROUGH & MECHANICAL', low:.96, crack:.85, ring:1.02, action:1.50, pitch:.94 }),
]);
const clamp=(value, lo, hi)=>Math.max(lo,Math.min(hi, Number.isFinite(Number(value))?Number(value):lo));
export function benchRecipe(weaponId='gun-cannon', variationId='A', mix={}) {
  const weapon=BENCH_WEAPONS.find(x=>x.id===weaponId);
  const variation=BENCH_VARIATIONS.find(x=>x.id===variationId);
  if(!weapon || !variation) throw new Error('Unknown sound bench recipe');
  const controls={
    body:clamp(mix.body??50,0,100),
    metal:clamp(mix.metal??50,0,100),
    action:clamp(mix.action??50,0,100),
  };
  // 50 is neutral; each slider changes that particular layer in real time.
  return Object.freeze({
    weaponId,variationId,controls,weapon,variation,
    bassHz:weapon.body*variation.pitch,
    metalHz:weapon.metal*variation.pitch,
    bodyLevel:variation.low*(.28+controls.body/100*1.44)*weapon.force,
    crackLevel:variation.crack*(.28+controls.metal/100*1.44)*weapon.force,
    ringLevel:variation.ring*(.28+controls.metal/100*1.44),
    cycleLevel:variation.action*(.28+controls.action/100*1.44),
  });
}

/** AudioContext is created only by a user's PLAY tap (required on iPhone).
 * Self-contained one-shot graphs. The compressor is a safety limiter rather
 * than an instruction to increase volume; start with device audio low.
 */
export function makeBenchAudioEngine() {
  let context=null, noise=null, master=null;
  const active=new Set();
  let disabled=false;
  const getContext=()=>{
    if(context) return context;
    const Constructor=globalThis.AudioContext||globalThis.webkitAudioContext;
    if(!Constructor) { disabled=true; return null; }
    context=new Constructor();
    const count=Math.ceil(context.sampleRate*1.25);
    noise=context.createBuffer(1,count,context.sampleRate);
    const samples=noise.getChannelData(0);
    let seed=0x1492ab7;
    for(let i=0;i<count;i++) {
      seed=(Math.imul(seed,1664525)+1013904223)>>>0;
      samples[i]=(seed/4294967295)*2-1;
    }
    const limiter=context.createDynamicsCompressor();
    limiter.threshold.value=-19;limiter.knee.value=9;limiter.ratio.value=12;
    limiter.attack.value=.004;limiter.release.value=.16;
    master=context.createGain();master.gain.value=.38;
    master.connect(limiter);limiter.connect(context.destination);
    return context;
  };
  const envelope=(ctx,start,length,gainAmount)=>{
    const gain=ctx.createGain(), t=Math.max(ctx.currentTime+.001,start), end=t+Math.max(.014,length);
    gain.gain.setValueAtTime(.0001,t);
    gain.gain.exponentialRampToValueAtTime(Math.max(.0002,gainAmount),t+.003);
    gain.gain.exponentialRampToValueAtTime(.0001,end);
    gain.connect(master);
    return gain;
  };
  const register=(node,end)=>{
    active.add(node);
    node.onended=()=>{active.delete(node);node.disconnect();};
    node.start(end.start);node.stop(end.stop);
  };
  const tone=(ctx,time,length,startHz,endHz,amount,type)=>{
    const oscillator=ctx.createOscillator();
    oscillator.type=type;
    oscillator.frequency.setValueAtTime(Math.max(20,startHz),time);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20,endHz),time+length);
    oscillator.connect(envelope(ctx,time,length,amount));
    register(oscillator,{start:time,stop:time+length+.012});
  };
  const burst=(ctx,time,length,filterHz,q,volume,mode)=>{
    const source=ctx.createBufferSource();
    source.buffer=noise;
    const filter=ctx.createBiquadFilter();
    filter.type=mode;filter.frequency.setValueAtTime(Math.max(40,filterHz),time);
    filter.Q.value=q;
    source.connect(filter);filter.connect(envelope(ctx,time,length,volume));
    register(source,{start:time,stop:time+length+.012});
  };
  const stop=()=>{
    for(const node of active){try{node.stop();}catch{/* already ended */}}
    active.clear();
  };
  const play=(weaponId,variationId,mix={})=>{
    let recipe;
    try {recipe=benchRecipe(weaponId,variationId,mix);}
    catch(error){return {ok:false,reason:error.message};}
    try {
      const ctx=getContext();
      if(!ctx) return {ok:false,reason:'WEB AUDIO NOT AVAILABLE'};
      // Call resume directly in the tap handler, without awaiting anything.
      if(ctx.state==='suspended') void ctx.resume().catch(()=>{});
      stop();
      const w=recipe.weapon;
      const t=ctx.currentTime+.025;
      // Each fire event is one blast, never a separate simulated sound per pellet.
      // Detonation/body: low piston-like fall and a short noisy pressure wave.
      tone(ctx,t,w.length,recipe.bassHz*1.45,recipe.bassHz*.34,
        .19*recipe.bodyLevel,'sawtooth');
      tone(ctx,t+.004,w.length*.58,recipe.bassHz*.77,recipe.bassHz*.29,
        .11*recipe.bodyLevel,'triangle');
      burst(ctx,t,.048,1750, .55,.14*recipe.crackLevel,'highpass');
      burst(ctx,t+.012,w.length*.55,370,.72,.095*recipe.bodyLevel,'lowpass');
      // Clanging steel resonance is a separate event from the projectile crack.
      tone(ctx,t+.016,.20,recipe.metalHz*2.27,recipe.metalHz*.82,
        .043*recipe.ringLevel,'triangle');
      tone(ctx,t+.019,.13,recipe.metalHz*3.37,recipe.metalHz*2.67,
        .025*recipe.ringLevel,'sine');
      // Mechanical return/cassette/lever movement is delayed and individually tunable.
      const cycle=t+w.cycle;
      burst(ctx,cycle,.057,w.metal*4,2,.080*recipe.cycleLevel,'bandpass');
      tone(ctx,cycle,.095,w.metal*1.5,w.metal*.59,
        .055*recipe.cycleLevel,'square');
      burst(ctx,cycle+.070,.047,w.metal*3.0,1.5,.054*recipe.cycleLevel,'bandpass');
      if(weaponId==='gun-scatter') {
        // A delayed ironwork shudder after one large shot, not six pellet sounds.
        burst(ctx,cycle+.133,.075,950,.75,.055*recipe.cycleLevel,'bandpass');
      }
      if(weaponId==='gun-light') {
        // The needle cannon is intentionally sharper and shorter.
        burst(ctx,t+.036,.032,2800,1,.056*recipe.crackLevel,'highpass');
      }
      return {ok:true,recipe,state:ctx.state};
    }catch(error){return {ok:false,reason:String(error?.message||error)};}
  };
  return {play,stop,getState:()=>disabled?'unavailable':context?.state??'locked'};
}
