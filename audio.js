import { makeLiveWeaponAudio } from './liveWeaponAudio.js';
import { makeLiveSystemsAudio } from './liveSystemsAudio.js';
import { hitSoundPlan } from './liveSystemsEvents.js';
import { beginAudioWarmup } from './audioWarmup.js';
/** Small synthesized industrial range feedback, no downloaded audio assets. */
let audio = null;
let userActivated = false;
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
    if (ctx?.state === 'suspended') void ctx.resume().catch(() => {});
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

/** Live systems soundscape. The same unlocked audio context services weapons,
 * impacts and machinery. This bus never touches the old laboratory presets. */
const systemsBus=makeLiveSystemsAudio(context);
let acousticOrdinal=0;
export function soundSystemEvent(id,options={}) {
    const result=systemsBus.play(id,options);
    if(result.pending && ['armor','part','destruction','glance','yardwalker','kestrel','hauler'].includes(id))
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
        if(!event.target.closest('button,summary,[role="button"]'))return;
        soundWorkshop('select');
    },{capture:true});
}
