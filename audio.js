import { makeLiveWeaponAudio } from './liveWeaponAudio.js';
import { makeLiveSystemsAudio } from './liveSystemsAudio.js';
import { hitSoundPlan } from './liveSystemsEvents.js';
import { firingProfile } from './firingEvent.js';
import {reloadMechanism,RELOAD_STAGES} from './reloadMechanism.js';
import { beginAudioWarmup } from './audioWarmup.js';
/** Small synthesized industrial range feedback, no downloaded audio assets. */
let audio = null;
let userActivated = false;
/** A quiet two-oscillator rural generator bed, only while fighting at
 * Backlot. Never creates a WebAudio context until an actual user gesture.
 * The entire loop is shared by the bout, not a new oscillator per frame.
 */
let backlotAmbienceRequested=false,backlotAmbience=null;
function stopBacklotAmbience(){
 if(!backlotAmbience)return;
 const {ctx,master,oscillators}=backlotAmbience;
 master.gain.setTargetAtTime(0,ctx.currentTime,.045);
 for(const oscillator of oscillators){
  try{oscillator.stop(ctx.currentTime+.24);}catch{}
  oscillator.onended=()=>{try{oscillator.disconnect();}catch{}};
 }
 backlotAmbience=null;
}
function startBacklotAmbience(){
 if(backlotAmbience||!backlotAmbienceRequested||!userActivated)return;
 const ctx=context();
 if(!ctx||ctx.state==='suspended')return;
 const filter=ctx.createBiquadFilter();filter.type='lowpass';
 filter.frequency.value=245;
 const master=ctx.createGain();
 master.gain.setValueAtTime(0,ctx.currentTime);
 master.gain.setTargetAtTime(.018,ctx.currentTime,.14);
 filter.connect(master);master.connect(ctx.destination);
 const oscillators=[];
 for(const [type,freq,level] of [['sawtooth',48,.48],['triangle',97,.24]]){
  const oscillator=ctx.createOscillator();oscillator.type=type;
  oscillator.frequency.value=freq;
  const gain=ctx.createGain();gain.gain.value=level;
  oscillator.connect(gain);gain.connect(filter);
  oscillator.start(ctx.currentTime);oscillators.push(oscillator);
 }
 backlotAmbience={ctx,master,filter,oscillators};
}
export function setBacklotAmbienceActive(active){
 const enabled=!!active;
 if(enabled===backlotAmbienceRequested){
  if(enabled&&!backlotAmbience)startBacklotAmbience();
  return;
 }
 backlotAmbienceRequested=enabled;
 if(enabled)startBacklotAmbience();
 else stopBacklotAmbience();
}

function context() {
    // NEVER attempt to start iOS WebAudio from the physics loop. An early
    // resume() outside a gesture may stay pending for seconds and interfere
    // with the later, legitimate unlock. Return null until a real input.
    if (!userActivated) return null;
    try {
        if (!audio) audio = new AudioContext();
        return audio;
    } catch { return null; }
}
function unlockAudio() {
    userActivated = true;
    const ctx = context();
    // Must be invoked INSIDE each trusted interaction; repeating it on
    // later taps also recovers audio after Safari backgrounds the page.
    if (ctx?.state === 'suspended') void ctx.resume()
        .then(()=>{if(backlotAmbienceRequested)startBacklotAmbience();})
        .catch(() => {});
    else if(backlotAmbienceRequested)startBacklotAmbience();
}
// Prepare PCM off-thread immediately. Never create or run an AudioContext
// from this background path. Only a user gesture unlocks actual playback.
if (typeof document !== 'undefined') {
    beginAudioWarmup();
    document.addEventListener('pointerdown',unlockAudio,{capture:true});
    document.addEventListener('touchstart',unlockAudio,{capture:true,passive:true});
    document.addEventListener('keydown',unlockAudio,{capture:true});
}
function tone(frequency, endFrequency, duration, volume, kind) {
    const ctx = context();
    if (!ctx)
        return;
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = kind;
    oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(endFrequency, ctx.currentTime + duration);
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + duration);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + duration + .01);
}
export function soundFire() { tone(112, 39, .22, .21, 'sawtooth'); tone(210, 70, .08, .055, 'triangle'); }
/** One heavy shell report per trigger, not a sound per pellet. Synthesized on demand,
 * leaves no persistent nodes and gracefully ignores unavailable mobile audio. */
export function soundScatter() {
    tone(82,32,.37,.21,'sawtooth');
    tone(235,62,.17,.09,'square');
    tone(520,105,.095,.035,'triangle');
}
export function soundImpact() { tone(340, 80, .13, .09, 'square'); }
export function soundReload() { tone(480, 190, .12, .045, 'triangle'); }
export function soundEmpty() { tone(550, 370, .06, .025, 'square'); }

/** Low, short hydraulic foot-lock cue; emitted only on a real brace transition.
 * No persistent nodes, random variation, or sound needed to understand the state. */
export function soundBrace() {
    tone(94, 48, .16, .08, 'triangle');
    tone(185, 88, .08, .035, 'square');
}

/** Event sounds, not loops: audible warning at the moment traction slips and
 * on a hard drive load-up. The simulation owns all thresholds/cooldowns. */
export function soundFootScrape() {
    tone(215, 95, .10, .028, 'sawtooth');
    tone(94, 62, .15, .020, 'triangle');
}
export function soundDriveStrain() {
    tone(83, 120, .17, .035, 'sawtooth');
    tone(143, 87, .12, .018, 'triangle');
}

/** Slightly hollow welded-plate ring, only when a real structure mesh
 * intercepted a downstream fitted module on the same actual shot ray. */
export function soundShield() {
    tone(385, 145, .11, .065, 'triangle');
    tone(167, 92, .17, .044, 'square');
}

/** k3w7: selected real combat weapon sounds. Only call after a round is
 * physically consumed; blast and mechanism are ONE buffer per trigger.
 * A failed or missing browser audio device never changes weapon physics.
 */
const weaponBus=makeLiveWeaponAudio(context);
/** Always audible after gesture unlock, even when the PCM worker is still busy.
 * The temporary non-tonal pressure impulse is much cheaper than a full asset. */
function immediateImpulse({distance=0,cockpit=false,weight=1}={}){
    const ctx=context();
    if(!ctx||ctx.state==='suspended')return false;
    const n=Math.floor(ctx.sampleRate*.095);
    const buffer=ctx.createBuffer(1,n,ctx.sampleRate);
    const arr=buffer.getChannelData(0);let seed=11231;
    for(let i=0;i<n;i++){
        seed=(seed*16807)%2147483647;
        const t=i/n;
        arr[i]=((seed/2147483647)*2-1)*Math.exp(-11*t)*(1-t);
    }
    const source=ctx.createBufferSource();source.buffer=buffer;
    const filter=ctx.createBiquadFilter();filter.type='lowpass';
    filter.frequency.value=cockpit?2300:1200;
    const gain=ctx.createGain();
    gain.gain.value=weight*(cockpit?.18:.08)/(1+Math.pow(Math.max(0,distance)/9,1.7));
    source.connect(filter);filter.connect(gain);gain.connect(ctx.destination);
    source.start(ctx.currentTime);
    source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect();};
    return true;
}
export function soundWeaponShot(weaponId,options={}) {
    const result=weaponBus.play(weaponId,options);
    if(result.pending)immediateImpulse({...options,weight:weaponId==='gun-scatter'?1.6:1.1});
    return result;
}

/** A tiny shared, precomputed inharmonic steel transient played at the
 * recoil stop and return-to-battery times. No oscillator bank, per-shot PCM
 * generation or timeout; WebAudio's sample clock keeps the sound synchronized
 * even when a mobile graphics frame arrives late. The selected Pressure Forge
 * report is still authoritative for the explosive component.
 */
let mechanismContext=null,mechanismBuffer=null,mechanismVoices=0;
function mechanismNoise(ctx){
    if(mechanismBuffer&&mechanismContext===ctx)return mechanismBuffer;
    mechanismContext=ctx;
    const length=Math.floor(ctx.sampleRate*.105);
    const buffer=ctx.createBuffer(1,length,ctx.sampleRate);
    const samples=buffer.getChannelData(0);
    let seed=71593;
    for(let i=0;i<length;i++){
        seed=(seed*16807)%2147483647;
        const t=i/ctx.sampleRate;
        // Noise-rich steel edge, a low asymmetric body and damped inharmonic
        // ring. Never a single pitched sine or an arcade-like "pong".
        const noise=seed/1073741823.5-1;
        samples[i]=(noise*.74+Math.sin(t*2130)*.18+
            Math.sin(t*3675)*.08)*Math.exp(-t*49);
    }
    mechanismBuffer=buffer;
    return buffer;
}
export function soundWeaponMechanism(id,{shotIndex=0,cockpit=true}={}){
    if(id==='gun-arc'||id==='gun-rivet'&&shotIndex%2===0)return;
    const ctx=context();
    if(!ctx||ctx.state==='suspended'||mechanismVoices>=14)return;
    try{
        const profile=firingProfile(id);
        const heavy=id==='gun-short'||id==='gun-scatter'||id==='gun-breaker';
        const shots=heavy?[
            {offset:profile.stop,level:.12,frequency:1750,rate:.84},
            {offset:profile.cycle,level:.10,frequency:980,rate:1.14},
        ]:[{offset:profile.cycle,level:id==='gun-light'?.052:.065,
            frequency:id==='gun-rivet'?2600:1400,rate:1.12}];
        const buffer=mechanismNoise(ctx);
        for(const layer of shots){
            if(mechanismVoices>=14)break;
            const source=ctx.createBufferSource();
            source.buffer=buffer;source.playbackRate.value=layer.rate;
            const filter=ctx.createBiquadFilter();filter.type='bandpass';
            filter.frequency.value=layer.frequency;filter.Q.value=.58;
            const gain=ctx.createGain();
            const start=ctx.currentTime+Math.min(.60,layer.offset);
            const level=layer.level*(cockpit?1:.26);
            gain.gain.setValueAtTime(level,start);
            gain.gain.exponentialRampToValueAtTime(.001,start+.095);
            source.connect(filter);filter.connect(gain);gain.connect(ctx.destination);
            mechanismVoices++;
            source.onended=()=>{
                mechanismVoices=Math.max(0,mechanismVoices-1);
                source.disconnect();filter.disconnect();gain.disconnect();
            };
            source.start(start);source.stop(start+.105);
        }
    }catch{ /* Audio never changes the weapon or projectile state. */ }
}
/** k5r.6 physically staged reloading. A brief sampled steel edge plus a
 * low loading-ram body is cheaper and more industrial than pitched UI tones.
 * Each phase is called only by the authoritative reload timer cue gate.
 * No AudioContext construction outside a trusted gesture.
 */
let reloadVoices=0;
export function soundWeaponReloadPhase(weaponId,stage,{distance=0,pan=0,cockpit=false}={}){
 if(stage!=='ready'&&!RELOAD_STAGES.includes(stage))return {ok:false,reason:'invalid phase'};
 const ctx=context();
 if(!ctx||ctx.state==='suspended'||reloadVoices>=9)return {ok:true,skipped:true};
 const profile=reloadMechanism(weaponId);
 const d=Math.max(0,Number(distance)||0);
 if(d>23&&!cockpit)return {ok:true,skipped:true};
 const n=stage==='unlock'?0:stage==='extract'?1:stage==='feed'?2:
    stage==='chamber'?3:stage==='lock'?4:stage==='charge'?5:6;
 const heavy=profile.mass;
 try{
   const start=ctx.currentTime;
   const source=ctx.createBufferSource();
   source.buffer=mechanismNoise(ctx);
   source.playbackRate.value=[1.28,.85,.97,.70,.72,1.33,1.10][n]/
       (0.75+heavy*.23);
   const filter=ctx.createBiquadFilter();filter.type='bandpass';
   filter.frequency.value=[2000,1100,1350,830,950,1840,1450][n]/
       (0.81+heavy*.12);
   filter.Q.value=.65;
   const panner=ctx.createStereoPanner?.();
   if(panner)panner.pan.value=Math.max(-.92,Math.min(.92,Number(pan)||0));
   const gain=ctx.createGain();
   // The Stump's enormous breech lock should be heard as an iron
   // loading press, not as another quiet generic reload UI beep.
   const stumpFactor=weaponId==='gun-short'?
       (n===3||n===4?1.75:1.35):1;
   const loud=[.25,.36,.32,.48,.53,.43,.35][n]*
       Math.min(1.65,.65+heavy*.46)*stumpFactor*
       (cockpit?.50:.25/(1+Math.pow(d/11,1.6)));
   gain.gain.setValueAtTime(Math.max(.0005,loud),start);
   gain.gain.exponentialRampToValueAtTime(.001,start+.10);
   source.connect(filter);
   if(panner){filter.connect(panner);panner.connect(gain);}
   else filter.connect(gain);
   gain.connect(ctx.destination);
   reloadVoices++;
   source.onended=()=>{
     reloadVoices=Math.max(0,reloadVoices-1);
     for(const node of [source,filter,panner,gain])try{node?.disconnect();}catch{}
   };
   source.start(start);
   // A deep industrial ram body on chamber/lock. Not another shot or
   // artificially delayed reload: one tiny oscillator per mechanical event.
   if(n===3||n===4||n===5){
     const body=ctx.createOscillator();body.type='triangle';
     const low=ctx.createGain();const dur=.12+heavy*.045;
     body.frequency.setValueAtTime(165/(.6+heavy*.5),start);
     body.frequency.exponentialRampToValueAtTime(51/(.6+heavy*.35),start+dur);
     low.gain.setValueAtTime(loud*.46,start);
     low.gain.exponentialRampToValueAtTime(.001,start+dur);
     body.connect(low);low.connect(ctx.destination);
     body.onended=()=>{try{body.disconnect();low.disconnect();}catch{}};
     body.start(start);body.stop(start+dur+.008);
   }
   return {ok:true,weaponId,stage};
 }catch(error){return {ok:false,reason:String(error?.message??error)};}
}

/** Live systems soundscape. The same unlocked audio context services weapons,
 * impacts and machinery. This bus never touches the old laboratory presets. */
const systemsBus=makeLiveSystemsAudio(context);
let acousticOrdinal=0;
export function soundSystemEvent(id,options={}) {
    const result=systemsBus.play(id,options);
    if(result.pending && ['armor','part','destruction','glance','yardwalker','kestrel','hauler','engine','hydraulics','sparks','zap','recharge'].includes(id))
        immediateImpulse({...options,weight:id==='destruction'?1.1:.38});
    return result;
}
export function soundCombatImpact(hit,options={}) {
    const soundOrdinal=acousticOrdinal++;
    const plan=hitSoundPlan(hit,{...options,ordinal:soundOrdinal});
    for(const entry of plan)soundSystemEvent(entry.id,{
        variant:entry.variant,distance:options.distance??0,
        cockpit:!!options.cockpit,focus:!!options.focus,strength:entry.strength,
    });
    return plan;
}

/** Light UI sounds are synthesized instantly, independent of the background
 * industrial PCM worker. Only play after a permitted browser gesture. */
/** k5r.4 short spatial battlefield transients, synthesized only once per
 * AudioContext and rate-limited. Never unlock WebAudio from a simulation tick.
 * Pan/rolloff refer to the physical listener position and first impact.
 */
const FIELD_AUDIO_LIMIT=8;
let fieldContext=null,fieldBuffers=null,fieldActive=0,lastFieldAt=-Infinity;
function fieldBuffer(ctx,kind){
 if(fieldContext!==ctx){fieldContext=ctx;fieldBuffers=new Map();}
 if(fieldBuffers.has(kind))return fieldBuffers.get(kind);
 const seconds=kind==='heavy-flyby'?.29:kind==='flyby'?.19:kind==='cover-metal'?.22:
     kind==='cover-concrete'?.23:.18;
 const length=Math.floor(ctx.sampleRate*seconds);
 const buffer=ctx.createBuffer(1,length,ctx.sampleRate);
 const data=buffer.getChannelData(0);
 let seed=(kind.length*541+31);
 for(let i=0;i<length;i++){
    seed=(seed*16807)%2147483647;
    const t=i/ctx.sampleRate,u=i/length;
    const noise=seed/1073741823.5-1;
    const flyby=kind.includes('flyby');
    const freq=flyby?410+1300*u:kind==='ricochet'?2200-1250*u:
        kind==='cover-metal'?1150:kind==='cover-concrete'?290:120;
    const grit=Math.sin(t*freq*6.28318);
    const envelope=flyby
      ?Math.pow(Math.sin(Math.PI*u),1.5)*Math.exp(-u*1.8)
      :Math.exp(-u*(kind==='cover-metal'?13:19));
    data[i]=(noise*(flyby?.72:.84)+grit*(flyby?.25:.17))*envelope;
 }
 fieldBuffers.set(kind,buffer);
 return buffer;
}
export function soundBattlefieldEvent(kind,{distance=0,pan=0,strength=1}={}){
 const types=['flyby','heavy-flyby','cover-metal','cover-concrete',
   'cover-earth','cover-wood','cover-rubber','ricochet'];
 if(!types.includes(kind))return {ok:false,reason:'unknown battlefield sound'};
 const d=Math.max(0,Number.isFinite(distance)?distance:0);
 if(d>38||fieldActive>=FIELD_AUDIO_LIMIT)return {ok:true,skipped:true};
 const ctx=context();
 if(!ctx||ctx.state==='suspended')return {ok:true,skipped:true};
 // Burst/shotgun caps; do not flood iPhone's mixer with six identical pellets.
 if(ctx.currentTime-lastFieldAt<.065)return {ok:true,skipped:true};
 lastFieldAt=ctx.currentTime;
 try{
   const source=ctx.createBufferSource();source.buffer=fieldBuffer(ctx,kind);
   const filter=ctx.createBiquadFilter();filter.type='lowpass';
   filter.frequency.value=Math.max(550,10500/(1+d/13));
   const panner=ctx.createStereoPanner?.();
   if(panner)panner.pan.value=Math.max(-.96,Math.min(.96,Number(pan)||0));
   const volume=ctx.createGain();
   const close=kind.includes('flyby')?.24:kind==='ricochet'?.15:.27;
   volume.gain.value=close*Math.max(0,Math.min(1.2,strength))/
       (1+Math.pow(d/12,1.7));
   source.connect(filter);
   if(panner){filter.connect(panner);panner.connect(volume);}
   else filter.connect(volume);
   volume.connect(ctx.destination);
   fieldActive++;
   source.onended=()=>{fieldActive=Math.max(0,fieldActive-1);
       try{source.disconnect();filter.disconnect();panner?.disconnect();volume.disconnect();}catch{}};
   source.start();
   return {ok:true,kind,distance:d,pan:Math.max(-1,Math.min(1,Number(pan)||0))};
 }catch(error){return {ok:false,reason:String(error?.message??error)};}
}

export function soundWorkshop(kind='select'){
    const ctx=context();
    if(!ctx||ctx.state==='suspended')return false;
    if(kind==='select'){tone(510,380,.035,.009,'triangle');}
    else if(kind==='confirm'){tone(245,200,.075,.035,'triangle');tone(410,300,.075,.016,'square');}
    else if(kind==='reject'){tone(210,125,.095,.034,'triangle');tone(158,105,.085,.015,'square');}
    else if(kind==='install'){tone(185,73,.17,.084,'triangle');tone(550,190,.07,.036,'square');}
    else if(kind==='remove'){tone(210,95,.13,.04,'square');tone(100,52,.15,.042,'triangle');}
    else if(kind==='service'){tone(325,150,.09,.034,'square');tone(140,65,.22,.051,'sawtooth');}
    else if(kind==='paint'){
        // Short compressor-air rush and valve click; noise is scoped to one
        // quick apply, never generated continuously as a color picker moves.
        const length=Math.floor(ctx.sampleRate*.23);
        const buffer=ctx.createBuffer(1,length,ctx.sampleRate);
        const data=buffer.getChannelData(0);
        let seed=14681;
        for(let i=0;i<length;i++){
            seed=(seed*16807)%2147483647;
            const env=Math.sin(Math.PI*i/length);
            data[i]=((seed/2147483647)*2-1)*env*.18;
        }
        const noise=ctx.createBufferSource();noise.buffer=buffer;
        const filter=ctx.createBiquadFilter();filter.type='lowpass';filter.frequency.value=1050;
        const gain=ctx.createGain();gain.gain.value=.26;
        noise.connect(filter);filter.connect(gain);gain.connect(ctx.destination);
        noise.start();noise.onended=()=>{noise.disconnect();filter.disconnect();gain.disconnect();};
        tone(450,175,.08,.026,'triangle');
    }
    return true;
}
if(typeof document!=='undefined'){
    document.addEventListener('click',event=>{
        const control=event.target.closest('button,summary,[role="button"]');
        if(!control || control.matches('#fire,#reload,#brake'))return;
        soundWorkshop('select');
    },{capture:true});
}
