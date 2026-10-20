/** Stump experimental material synthesis — no oscillators, downloads or
 * recorded assets. Deterministic mono PCM buffers, rendered once and reused.
 * Sound is deliberately NOT integrated into live combat or persisted presets.
 */
export const STUMP_EXPERIMENTS=Object.freeze([
  Object.freeze({id:'pressure',label:'A · PRESSURE BLAST',detail:'Low transient / saturated blast'}),
  Object.freeze({id:'steel',label:'B · STEEL COLLISION',detail:'Inharmonic plates / massive breech'}),
  Object.freeze({id:'hybrid',label:'C · HYBRID',detail:'Pressure wave / mechanical slam'}),
]);
const validIds=new Set(STUMP_EXPERIMENTS.map(x=>x.id));
const TAU=2*Math.PI;
const impact=(t,at,duration)=>t<at?0:Math.exp(-(t-at)/duration);
const mode=(t,at,frequency,decay,phase=0)=>t<at?0:
  Math.sin(TAU*frequency*(t-at)+phase)*impact(t,at,decay);
const thump=(t,at,frequency,decay)=>t<at?0:
  Math.sin(TAU*frequency*(t-at))*impact(t,at,decay);
const envelope=(t,at,decay)=>impact(t,at,decay)*(1-Math.exp(-Math.max(0,t-at)/.0016));

/** Returns normalized Float32 PCM, safe to feed directly to an AudioBuffer.
 * The three constructions differ by their source material and event times:
 *  A: compressed, filtered broadband impulse + upper bass pressure
 *  B: hammer strike + short inharmonic steel modes + heavy secondary contact
 *  C: combined explosive attack, dense rattling/return and iron breech slam
 * Frequencies do not sweep, so there are no Pong-like pitched chirps.
 */
export function renderStumpExperiment(kind,sampleRate=44100){
  if(!validIds.has(kind))throw new Error('Unknown Stump material experiment');
  if(!Number.isFinite(sampleRate)||sampleRate<8000||sampleRate>96000)
    throw new Error('Unsupported sound lab sample rate');
  const duration=kind==='hybrid'?.83:kind==='steel'?.71:.55;
  const samples=new Float32Array(Math.ceil(sampleRate*duration));
  let seed=0x8b7d1fe^kind.length*171;
  let low=0,mid=0,lastNoise=0;
  const lowAlpha=1-Math.exp(-TAU*140/sampleRate);
  const midAlpha=1-Math.exp(-TAU*1150/sampleRate);
  for(let i=0;i<samples.length;i++){
    const t=i/sampleRate;
    seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;
    const white=(seed>>>0)/2147483647.5-1;
    low+=lowAlpha*(white-low);
    mid+=midAlpha*(white-mid);
    const high=white-mid;
    const rough=white-.52*lastNoise;
    lastNoise=white;
    // The bass lasts less than one tenth of a second; no long tuned note.
    const physicalBass=thump(t,0,93,.062)+.48*thump(t,.005,158,.060);
    let v;
    if(kind==='pressure'){
      // Dense explosive pressure and sharp cutoff, NO ringing or bolt tones.
      const pressure=envelope(t,0,.084);
      const muzzle=envelope(t,.002,.020);
      v=.51*physicalBass+.85*low*pressure+
        .34*high*muzzle+.30*rough*impact(t,0,.021);
      // Short gas-like decay, slightly granular not tonal.
      v+=.14*mid*impact(t,.034,.105);
    }else if(kind==='steel'){
      // Steel sound comes from fixed, intentionally inharmonic structural
      // modes; they are quickly damped, excited by sharp noisy collisions.
      const steel=t<.009?0:
        .23*mode(t,.009,219,.087)+
        .19*mode(t,.009,376,.068,.7)+
        .13*mode(t,.009,611,.047,1.2)+
        .09*mode(t,.009,1019,.030,2);
      const breech=t<.185?0:
        .19*mode(t,.185,176,.085)+
        .10*mode(t,.185,337,.062,.4)+
        .08*mode(t,.185,547,.040,1.6);
      v=.39*physicalBass+.65*rough*impact(t,0,.016)+steel+breech+
        .47*mid*impact(t,.009,.045)+
        .38*low*impact(t,.187,.085)+
        .27*rough*impact(t,.18,.020);
    }else{
      // Physical blast, loose iron vibration, double-stage breech return.
      const first=.60*physicalBass+
        .64*low*envelope(t,0,.105)+
        .34*high*impact(t,0,.025)+
        .26*rough*impact(t,.022,.04);
      const rattle=.22*rough*impact(t,.145,.025)+
        .16*mid*impact(t,.20,.049)+
        .20*rough*impact(t,.257,.026);
      const slam=.40*low*impact(t,.37,.084)+
        .34*rough*impact(t,.37,.017)+
        .16*mode(t,.374,198,.086)+
        .11*mode(t,.375,398,.045);
      const latch=.17*mid*impact(t,.515,.029)+
        .15*rough*impact(t,.520,.013);
      v=first+rattle+slam+latch;
    }
    // Soft clipping adds grit without introducing pitched filter sweeps.
    const shaped=Math.tanh(2.3*v)*.77;
    const fade=Math.min(1,(duration-t)/.024);
    samples[i]=shaped*Math.max(0,fade);
  }
  return samples;
}
