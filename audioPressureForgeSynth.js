/** k.3w.6 / A configurable pressure-shot instrument with NO long tonal
 * resonances or sweeping pitch. PCM generated per chosen recipe, in memory.
 */
import {FORGE_WEAPONS,FORGE_ACTIONS} from './audioPressureForgePresets.js';
const PI2=Math.PI*2;
const known=new Set([...FORGE_WEAPONS.map(w=>w.id),'gun-rivet','gun-breaker','gun-rocket','gun-arc']);
const actionIds=new Set(FORGE_ACTIONS.map(a=>a.id));
const decay=(t,at,tau)=>t<at?0:Math.exp(-(t-at)/tau);
const swell=(t,at,tau)=>decay(t,at,tau)*(1-Math.exp(-Math.max(0,t-at)/.0018));
const pulse=(t,at,hz,tau)=>t<at?0:Math.sin(PI2*hz*(t-at))*decay(t,at,tau);
const limit=v=>Math.tanh(v*1.9)*.72;
const scal=(v)=>Math.min(100,Math.max(0,Number.isFinite(Number(v))?Number(v):50))/100;
export function renderPressureForgePCM(weaponId,recipe,sampleRate=44100,mode='full'){
  if(!known.has(weaponId))throw Error('Unknown Pressure Forge weapon');
  if(!Number.isFinite(sampleRate)||sampleRate<8000||sampleRate>96000)
    throw Error('Invalid sample rate');
  if(!['full','blast','action'].includes(mode))throw Error('Invalid sound mode');
  const action=recipe?.action??'bolt';
  if(!actionIds.has(action))throw Error('Invalid mechanism');
  const s=recipe?.settings??{};
  const bass=scal(s.bass),punch=scal(s.punch),treble=scal(s.treble);
  const grit=scal(s.grit),tail=scal(s.tail),level=scal(s.actionLevel);
  const delay=scal(s.delay),mass=scal(s.mass),scrape=scal(s.scrape);
  const weapon=({
    'gun-cannon':{body:1,pitch:1,edge:1,dry:.92},
    'gun-short':{body:1.26,pitch:.77,edge:.76,dry:.82},
    'gun-light':{body:.65,pitch:1.40,edge:1.48,dry:1.10},
    'gun-scatter':{body:1.13,pitch:.90,edge:1.20,dry:1.16},
    'gun-rivet':{body:.64,pitch:1.24,edge:1.45,dry:1.35},
    'gun-breaker':{body:1.52,pitch:.65,edge:.97,dry:.92},
    'gun-rocket':{body:1.10,pitch:.82,edge:1.30,dry:1.20},
    'gun-arc':{body:.28,pitch:1.4,edge:1.7,dry:1.6},
  })[weaponId];
  const shotTail=.048+.255*tail;
  const actionAt=.13+.34*delay;
  const length=Math.max(.28+shotTail,actionAt+(action==='none'?0:.39))+.055;
  const pcm=new Float32Array(Math.ceil(length*sampleRate));
  let seed=(0x6d3a1557^([...weaponId].reduce((n,c)=>Math.imul(n,31)+c.charCodeAt(0)|0,0)))>>>0;
  let lo=0,mid=0,midLow=0,last=0;
  const aLo=1-Math.exp(-PI2*150/sampleRate);
  const aMid=1-Math.exp(-PI2*(650+2100*treble)/sampleRate);
  const aMetal=1-Math.exp(-PI2*(160+370*(1-mass))/sampleRate);
  for(let i=0;i<pcm.length;i++){
    const t=i/sampleRate;
    seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;
    const white=(seed>>>0)/2147483647.5-1;
    lo+=aLo*(white-lo); mid+=aMid*(white-mid); midLow+=aMetal*(white-midLow);
    const high=white-mid;
    const rasp=white-.58*last;
    last=white;
    let blast=0;
    if(mode!=='action'){
      const bottom=(.31+.70*bass)*weapon.body*
        (pulse(t,0,95*weapon.pitch,.065+.035*tail)+
         .48*pulse(t,.004,163*weapon.pitch,.057+.025*tail));
      const pressure=(.21+.80*punch)*weapon.body*
        (1.75*lo*swell(t,0,shotTail)+
         .44*rasp*decay(t,0,.017+.014*tail));
      const crack=(.06+.46*treble)*weapon.edge*high*
        swell(t,0,.014+.030*(1-treble));
      const gritNoise=(.012+.39*grit)*weapon.dry*
        (rasp*decay(t,.008,.018+.085*tail)+
         .36*mid*decay(t,.028,.025+.105*tail));
      blast=bottom+pressure+crack+gritNoise;
    }
    let mechanic=0;
    if(mode!=='blast'&&action!=='none'&&level>0){
      const u=t-actionAt;
      const dry=Math.max(0,1-mass);
      const clack=(at,amp,dur=.022)=>
        (1.2*midLow+.50*rasp*(.50+.50*dry)+.38*lo*mass)*
        decay(t,actionAt+at,dur)*amp;
      const slide=(at,duration,amp)=>u<at||u>at+duration?0:
        (mid*(.22+.48*scrape)+rasp*(.06+.32*scrape)+lo*.20)*
        (1-Math.exp(-(u-at)/.008))*Math.exp(-(u-at)/(duration*.75))*amp;
      if(action==='bolt')mechanic=slide(0,.18,.46)+clack(.20,.83,.020);
      else if(action==='pump')mechanic=clack(0,.35,.017)+slide(.033,.19,.77)+clack(.24,.96,.025);
      else if(action==='breech')mechanic=clack(0,1.10,.050)+slide(.07,.080,.24)+clack(.18,.75,.045);
      else if(action==='piston')mechanic=clack(0,.89,.039)+clack(.112,1.02,.042);
      mechanic*=level*(.62+.64*mass);
    }
    const fade=Math.min(1,(length-t)/.020);
    pcm[i]=limit(blast+mechanic)*Math.max(0,fade);
  }
  return pcm;
}
/** Construct and unlock the WebAudio context only after a direct user tap.
 * A rolling, capped cache avoids regenerating when auditioning the same mix.
 * This engine owns no gameplay state and never reads/writes localStorage.
 */
export function makePressureForgePlayer(){
  let ctx=null,master=null,voice=null;
  const cache=new Map();
  const context=()=>{
    if(ctx)return ctx;
    const Constructor=globalThis.AudioContext||globalThis.webkitAudioContext;
    if(!Constructor)return null;
    ctx=new Constructor();
    const comp=ctx.createDynamicsCompressor();
    comp.threshold.value=-22;comp.knee.value=9;comp.ratio.value=12;
    comp.attack.value=.004;comp.release.value=.12;
    master=ctx.createGain();master.gain.value=.33;
    master.connect(comp);comp.connect(ctx.destination);
    return ctx;
  };
  const stop=()=>{
    if(voice){const node=voice;voice=null;try{node.stop();}catch{}}
  };
  const play=(weaponId,recipe,mode='full')=>{
    try{
      const c=context();
      if(!c)return {ok:false,reason:'WEB AUDIO UNAVAILABLE'};
      if(c.state==='suspended')void c.resume().catch(()=>{});
      const key=JSON.stringify([weaponId,recipe,mode,c.sampleRate]);
      let buffer=cache.get(key);
      if(!buffer){
        const pcm=renderPressureForgePCM(weaponId,recipe,c.sampleRate,mode);
        buffer=c.createBuffer(1,pcm.length,c.sampleRate);
        buffer.getChannelData(0).set(pcm);
        if(cache.size>=16)cache.delete(cache.keys().next().value);
        cache.set(key,buffer);
      }
      stop();
      const node=c.createBufferSource();
      node.buffer=buffer;
      node.connect(master);
      voice=node;
      node.onended=()=>{if(voice===node)voice=null;try{node.disconnect();}catch{}};
      node.start(c.currentTime+.012);
      return {ok:true,state:c.state,duration:buffer.duration};
    }catch(error){stop();return {ok:false,reason:String(error?.message??error)};}
  };
  return {play,stop,getState:()=>ctx?.state??'locked'};
}
