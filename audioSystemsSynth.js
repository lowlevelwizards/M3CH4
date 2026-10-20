/** k.3w.11 / Industrial systems materials for auditions and live combat.
 * No remote samples and no runtime combat changes. Each category has its own
 * physically motivated envelope/event arrangement, NOT one pitched formula.
 */
export const SYSTEM_SOUND_GROUPS=Object.freeze([
  Object.freeze({id:'damage',label:'IMPACT & DAMAGE'}),
  Object.freeze({id:'electrical',label:'ELECTRICAL & POWER'}),
  Object.freeze({id:'machinery',label:'MACHINERY & MOBILITY'}),
]);
export const SYSTEM_SOUNDS=Object.freeze([
  {id:'glance',group:'damage',label:'ARMOR GLANCE',subtitle:'Surface contact, no penetration',
    variants:['Dull ricochet','Bright metal clink','Quiet skidding scrape']},
  {id:'armor',group:'damage',label:'ARMOR BREAK',subtitle:'Plate cracking or shearing',
    variants:['Plate shear','Brittle split','Crushed sheet']},
  {id:'part',group:'damage',label:'INTERNAL PART HIT',subtitle:'Mechanism behind the armor',
    variants:['Housing slam','Jam & grind','Broken internals']},
  {id:'destruction',group:'damage',label:'PART DISABLE / DESTRUCTION',subtitle:'A major hardware failure',
    variants:['Heavy rupture','Pressure burst','Structural collapse']},
  {id:'sparks',group:'electrical',label:'SPARKS',subtitle:'Spitting metal and shorts',
    variants:['Quick shower','Sustained sizzle','Intermittent spit']},
  {id:'zap',group:'electrical',label:'ELECTRICAL ARC',subtitle:'Exposed electrical contact',
    variants:['Sharp snap','Rough sputter','Deep short']},
  {id:'recharge',group:'electrical',label:'RECHARGE / POWER READY',subtitle:'Power restoring to a system',
    variants:['Contactor ready','Capacitor charge','Alternator recovering']},
  {id:'engine',group:'machinery',label:'ENGINE / DRIVE MOTOR',subtitle:'Low mechanical load and vibration',
    variants:['Slow industrial idle','Uneven old diesel','High-load whirr']},
  {id:'hydraulics',group:'machinery',label:'HYDRAULICS',subtitle:'Cylinders, valves and pressure',
    variants:['Piston stroke','Pressure release','Valve clunk']},
  {id:'yardwalker',group:'machinery',label:'YARDWALKER FOOTFALL',subtitle:'Ordinary two-stage work boot',
    variants:['Heel and toe','Workman stride','Loose linkage']},
  {id:'kestrel',group:'machinery',label:'KESTREL FOOTFALL',subtitle:'Light digitigrade runner',
    variants:['Split toes','Quick runner','Spring ankle']},
  {id:'hauler',group:'machinery',label:'HAULER H2 FOOTFALL',subtitle:'Broad loaded shoes and pods',
    variants:['Heavy pad','Load transfer','Compression slam']},
  {id:'reload',group:'machinery',label:'RELOAD / CHAMBER',subtitle:'Mechanical ammunition handling',
    variants:['Slide and lock','Magazine slap','Heavy breech']},
].map(s=>Object.freeze({...s,variants:Object.freeze(s.variants)})));
const definitions=new Map(SYSTEM_SOUNDS.map(s=>[s.id,s]));
const TAU=Math.PI*2;
const exp=(t,at,life)=>t<at?0:Math.exp(-(t-at)/life);
const pulse=(t,at,hz,life)=>t<at?0:Math.sin(TAU*hz*(t-at))*exp(t,at,life);
const metal=(t,at,hz,life)=>t<at?0:exp(t,at,life)*(
    Math.sin(TAU*hz*(t-at))*.53+
    Math.sin(TAU*hz*1.67*(t-at)+.9)*.30+
    Math.sin(TAU*hz*2.43*(t-at)+1.7)*.17);
const fast=(t,at,life,noise)=>noise*exp(t,at,life);
const fade=(t,length)=>Math.min(1,Math.max(0,(length-t)/.026));
const lengths={
  glance:.33,armor:.53,part:.66,destruction:1.15,sparks:.70,zap:.58,
  recharge:1.18,engine:1.60,hydraulics:.97,yardwalker:.75,kestrel:.65,
  hauler:.96,reload:1.03,
};
export function renderSystemSound(id,variant=0,sampleRate=44100){
  const def=definitions.get(id);
  if(!def)throw Error('Unknown system sound: '+id);
  if(!Number.isInteger(variant)||variant<0||variant>2)throw Error('Unknown system sound variation');
  if(!Number.isFinite(sampleRate)||sampleRate<8000||sampleRate>96000)throw Error('Invalid sample rate');
  const length=lengths[id]+(variant===1?.035:variant===2?.075:0);
  const out=new Float32Array(Math.ceil(sampleRate*length));
  const key=[...id].reduce((n,c)=>(Math.imul(n,33)+c.charCodeAt(0))|0,0);
  let seed=(0x87a1443^key^(variant*2317))>>>0;
  let low=0,middle=0,upper=0;
  const aLow=1-Math.exp(-TAU*155/sampleRate);
  const aMiddle=1-Math.exp(-TAU*830/sampleRate);
  const aUpper=1-Math.exp(-TAU*2900/sampleRate);
  const weight=[1,.77,1.16][variant],edge=[.85,1.21,1.02][variant];
  for(let i=0;i<out.length;i++){
    const t=i/sampleRate;
    seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;
    const n=(seed>>>0)/2147483647.5-1;
    low+=aLow*(n-low);
    middle+=aMiddle*(n-middle);
    upper+=aUpper*(n-upper);
    const sharp=n-upper,rasp=n-.46*middle;
    let x=0;
    switch(id){
    case 'glance':
      // An armor deflection is a HARD, broadband surface contact, not
      // a pitched bell / handpan. The two live variants have a dry, very
      // short metallic click with distinct low shell weight and grit.
      // C stays a soft skid for optional penetration/ricochet texture.
      x=variant===2
        ?(.15*low*exp(t,0,.048)+.16*sharp*exp(t,0,.012)
          +.13*middle*exp(t,.025,.11))
        :(.36*low*exp(t,0,variant===0?.078:.044)
          +.32*rasp*exp(t,0,variant===0?.014:.009)
          +.30*sharp*exp(t,.002,variant===0?.008:.014)
          +.15*middle*exp(t,.015,variant===0?.029:.050)
          +.10*low*exp(t,.054,.044));
      break;
    case 'armor':
      x=.38*weight*pulse(t,0,96,.090)+.23*sharp*exp(t,0,.017)
        +.37*rasp*exp(t,.023,variant===1?.072:.140)
        +.21*middle*exp(t,variant===2?.085:.060,.095)
        +.15*low*exp(t,.110,.100);
      break;
    case 'part': {
      // Broad, low-mid resonant machinery, without the pitched handpan.
      const housing=.40*weight*pulse(t,0,116,.050)+
        .43*low*exp(t,0,.15)+.29*middle*exp(t,.007,.10)+
        .28*rasp*exp(t,0,.033);
      const secondary=(variant===1?.32:.24)*low*exp(t,.155,.105)+
        .23*middle*exp(t,variant===2?.182:.152,.062)+
        .24*rasp*exp(t,.19,variant===1?.13:.042);
      const fragments=.16*sharp*exp(t,variant===2?.235:.220,.018)+
        .12*middle*exp(t,.275,variant===2?.14:.055);
      x=housing+secondary+fragments;
      break;
    }
    case 'destruction':
      // A broken part, not a cartoon grenade: dirty pressure and collapsing iron.
      x=.58*weight*pulse(t,0,64,.16)+.40*low*exp(t,0,.30)
        +.34*sharp*exp(t,0,.033)
        +.36*rasp*exp(t,.057,.20+variant*.05)
        +.29*middle*exp(t,variant===2?.31:.20,.18)
        +.31*low*exp(t,variant===1?.35:.43,.15)
        +.12*sharp*exp(t,.46,.065);
      break;
    case 'sparks':{
      const sputter=Math.max(0,Math.sin(TAU*(variant===1?33:variant===2?16:42)*t))**5;
      x=(.10+.44*sputter)*sharp*exp(t,.011,variant===1?.45:.26)
        +.22*rasp*exp(t,variant===2?.19:.038,.14)
        +.12*sharp*exp(t,variant===2?.34:.20,.052);
      break;
    }
    case 'zap':{
      const snap=(at,amp)=>amp*(.5*sharp+.35*middle)*exp(t,at,.018);
      x=snap(0,.72)+snap(variant===1?.092:.047,.35)
        +snap(variant===2?.235:.177,.32)
        +.24*low*exp(t,.015,variant===2?.21:.072)
        +.17*sharp*exp(t,.08,.19);
      break;
    }
    case 'recharge':{
      const rise=Math.min(1,t/.8),hz=(variant===1?140:variant===2?85:110);
      const hum=Math.sin(TAU*(hz*t+(variant===1?170:variant===2?80:110)*t*t*.5));
      // Preserve the good recovery sweep. A short electrical relay SNAP
      // replaces the offending tuned metal-drum strike.
      x=.14*hum*rise*(1-Math.max(0,(t-.86)/.17))
        +.15*middle*rise*exp(t,0,1.6)
        +.20*low*exp(t,.72,.13)
        +.16*rasp*exp(t,.91,.014)
        +.12*middle*exp(t,.902,.020)
        +.07*low*exp(t,.91,.044);
      break;
    }
    case 'engine':{
      // Weighted upper-bass hum and lumpy combustion, not TV-static fizz.
      const rpm=[10,7.8,17][variant],spin=Math.sin(TAU*(rpm*t+.17*t*t));
      const loading=.74+.26*spin*spin;
      const base=[68,57,96][variant];
      const rotor=.285*weight*Math.sin(TAU*base*t)+
        .145*Math.sin(TAU*(base*1.92)*t)+
        .072*Math.sin(TAU*(base*.5)*t);
      const combustion=(.20+.085*(variant===1))*low*(.50+.50*Math.max(0,spin));
      const chassis=.055*middle*(.55+.45*spin*spin)+
        .014*rasp*(variant===2?1.2:1);
      x=rotor*loading+combustion+chassis;
      const ramp=Math.min(1,t/.085,Math.max(0,(length-t)/.095));
      x*=Math.max(0,ramp);
      break;
    }
    case 'hydraulics':{
      // Hiss, piston pressure, and a NON-TONAL valve closure.
      const stroke=.22*pulse(t,0,110,.049)+.26*low*exp(t,0,.085);
      const hiss=.25*middle*exp(t,.050,variant===1?.41:.23)+
        .095*sharp*exp(t,.055,.17);
      const stopAt=variant===2?.35:.49;
      const valve=.31*low*exp(t,stopAt,.062)+
        .23*rasp*exp(t,stopAt,.020)+
        .14*middle*exp(t,stopAt+.006,.043);
      x=stroke+hiss+valve+.12*middle*exp(t,.57,.07);
      break;
    }
    case 'yardwalker':
      // Bigger work-boot heel / toe, with phone-audible low-mid mass.
      x=.44*weight*pulse(t,0,118,.062)+.42*low*exp(t,0,.11)
        +.22*middle*exp(t,.009,.038)
        +.31*pulse(t,.104,135,.054)+.27*low*exp(t,.106,.076)
        +.19*rasp*exp(t,.116,.043)
        +(variant===2?.13*middle*exp(t,.183,.060):0);
      break;
    case 'kestrel':
      // Split runner toes and flex; no struck-steel handpan note.
      x=.18*pulse(t,0,145,.034)+.28*sharp*exp(t,0,.010)
        +.16*middle*exp(t,.025,.027)
        +.21*low*exp(t,.110,.035)+.21*rasp*exp(t,.125,.023)
        +.14*pulse(t,.155,155,.027)
        +(variant===1?.12*sharp*exp(t,.210,.013):0);
      break;
    case 'hauler':
      // Retain the satisfying low loaded-pad body. Remove the secondary
      // pitched sine decay so compression sounds broad instead of tuned.
      x=.49*weight*pulse(t,0,98,.070)+.41*low*exp(t,0,.19)
        +.25*rasp*exp(t,.027,.047)
        +.36*low*exp(t,.155,.13)
        +.26*middle*exp(t,.18,.095)
        +.23*low*exp(t,.32,.13)
        +.15*rasp*exp(t,.33,.040);
      break;
    case 'reload': {
      // Three physical actions, not a generic clink:
      // pull friction / housing collision / short catch. No modal steel drum.
      const slide=(from,to,amount)=>t<from||t>to?0:
        amount*(.42*middle+.30*rasp+.23*low)*
        (1-Math.exp(-(t-from)/.008))*
        Math.min(1,Math.max(0,(to-t)/.032));
      const thunk=(at,mass)=>mass*(.58*low+.26*middle+.23*rasp)*exp(t,at,.037);
      const latch=(at,strength)=>strength*(.52*sharp+.28*middle)*exp(t,at,.013);
      if(variant===0) {
        // A / Slide & lock: draw back, weighty forward return, hard lock.
        x=thunk(0,.35)+slide(.075,.365,.48)+thunk(.40,.86)+latch(.545,.60);
      }else if(variant===1) {
        // B / Magazine slap: removal, seating, short rack and latch.
        x=slide(.02,.16,.26)+latch(.165,.38)+
          thunk(.335,1.00)+slide(.415,.59,.31)+latch(.625,.75);
      }else {
        // C / Heavy breech: unlatch, drag massive block, slam, final catch.
        x=thunk(.015,.67)+slide(.112,.48,.51)+
          .33*low*exp(t,.535,.083)+thunk(.548,1.36)+
          latch(.714,.62)+.15*low*exp(t,.72,.048);
      }
      break;
    }
    }
    // Limit peaks; the sound engine provides a second output limiter.
    out[i]=Math.tanh(x*2.1)*.72*fade(t,length);
  }
  return out;
}
export function makeSystemSoundPlayer(){
  let ctx=null,bus=null,current=null;
  const cache=new Map();
  const startContext=()=>{
    if(ctx)return ctx;
    const ctor=globalThis.AudioContext||globalThis.webkitAudioContext;
    if(!ctor)return null;
    ctx=new ctor();
    const limiter=ctx.createDynamicsCompressor();
    limiter.threshold.value=-24;limiter.knee.value=8;limiter.ratio.value=12;
    limiter.attack.value=.003;limiter.release.value=.13;
    bus=ctx.createGain();bus.gain.value=.30;
    bus.connect(limiter);limiter.connect(ctx.destination);
    return ctx;
  };
  const stop=()=>{if(current){try{current.stop();}catch{}current=null;}};
  const play=(id,variant=0)=>{
    try{
      if(!definitions.has(id)||![0,1,2].includes(variant))return {ok:false,reason:'UNKNOWN SOUND'};
      const c=startContext();
      if(!c)return {ok:false,reason:'WEB AUDIO UNAVAILABLE'};
      if(c.state==='suspended')void c.resume().catch(()=>{});
      const key=id+'/'+variant;
      let buffer=cache.get(key);
      if(!buffer){
        const pcm=renderSystemSound(id,variant,c.sampleRate);
        buffer=c.createBuffer(1,pcm.length,c.sampleRate);
        buffer.getChannelData(0).set(pcm);
        if(cache.size>=18)cache.delete(cache.keys().next().value);
        cache.set(key,buffer);
      }
      stop();
      const src=c.createBufferSource();
      src.buffer=buffer;
      src.connect(bus);
      current=src;
      src.onended=()=>{if(current===src)current=null;try{src.disconnect();}catch{}};
      src.start(c.currentTime+.01);
      return {ok:true,id,variant,duration:buffer.duration};
    }catch(error){stop();return {ok:false,reason:String(error?.message??error)};}
  };
  return {play,stop,getState:()=>ctx?.state??'locked',cacheSize:()=>cache.size};
}
