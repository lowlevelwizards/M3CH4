/** k5r.1 — cosmetic gun/carriage/cab firing response.
 * A round is consumed and ballistics resolved by combat.js BEFORE calling here.
 * This module never changes aim, cooldown, spread, damage, or physical impulse.
 * 5 fixed slots maximum: no per-frame unbounded effects on iPhone.
 */
const clamp=(n,a,b)=>Math.min(b,Math.max(a,Number.isFinite(n)?n:a));
const make=(travel,recovery,stop,bolt,cycle,tilt,blast)=>Object.freeze({
  travel,recovery,stop,bolt,cycle,tilt,blast,
  duration:Math.max(.42,recovery*4.2,cycle+.16),
});
export const FIRING_PROFILES=Object.freeze({
  'gun-cannon':make(.66,.125,.060,.100,.205,.017,4),
  'gun-short': make(1.32,.200,.082,.165,.350,.034,7),
  'gun-light': make(.38,.070,.035,.061,.136,.009,2),
  'gun-scatter':make(1.44,.242,.092,.185,.390,.035,8),
  'gun-rivet': make(.19,.044,.022,.032,.077,.005,1),
  'gun-breaker':make(1.75,.290,.108,.225,.520,.044,10),
  'gun-rocket': make(.49,.126,.065,.142,.300,.014,6),
  'gun-arc': make(.09,.042,.021,.043,.081,.002,0),
});
export function firingProfile(id){return FIRING_PROFILES[id]??FIRING_PROFILES['gun-cannon'];}
const EMPTY=Object.freeze({travel:0,mount:0,cab:0,bolt:0,stop:0,feeder:0,active:false});
export function createFiringEventState(){return {pulses:[],pose:{...EMPTY}};}
export function triggerFiringEvent(state,weaponId,{brace=0,condition=1}={}){
  if(!state)return;
  if(state.pulses.length>=5)state.pulses.shift();
  state.pulses.push({
    age:0,id:weaponId,brace:clamp(brace,0,1),
    wear:1-clamp(condition,0,1),
  });
  return firingProfile(weaponId);
}
export function advanceFiringEvent(state,dt){
  if(!state||!Number.isFinite(dt)||dt<0)return {...EMPTY};
  // Reuse the same small pose object: no allocations in the 60 Hz render path.
  const result=state.pose;
  result.travel=0;result.mount=0;result.cab=0;
  result.bolt=0;result.stop=0;result.feeder=0;result.active=false;
  for(let i=state.pulses.length-1;i>=0;i--){
    const p=state.pulses[i],profile=firingProfile(p.id);
    p.age+=Math.min(dt,.12);
    if(p.age>=profile.duration){state.pulses.splice(i,1);continue;}
    const t=p.age;
    // Main rearward stroke, hard stop and a secondary spring-damper return.
    // Unlike a camera shake these are separate gun, mount and cab responses.
    const stroke=Math.exp(-t/profile.recovery);
    const stop=Math.exp(-Math.pow((t-profile.stop)/.024,2));
    const returnPulse=Math.exp(-Math.pow((t-profile.cycle)/.050,2));
    const cyclePhase=clamp((t-profile.bolt)/Math.max(.02,profile.cycle-profile.bolt),0,1);
    const bolt=Math.sin(Math.PI*cyclePhase);
    const looseness=1+p.wear*.28;
    const footed=1-p.brace*.56;
    result.travel+=profile.travel*stroke*looseness;
    result.mount+=profile.tilt*(stroke+.30*stop-.20*returnPulse)*looseness;
    // Bracing changes the presentation of load transfer, not shot accuracy.
    result.cab+=profile.tilt*(.38*stroke+.62*stop+.25*returnPulse)*footed;
    result.bolt+=Math.max(0,bolt)*(1+p.wear*.16);
    result.stop+=stop;
    result.feeder+=Math.max(0,Math.sin(cyclePhase*Math.PI))*Math.min(1,profile.cycle/.24);
    result.active=true;
  }
  result.travel=clamp(result.travel,0,2);
  result.mount=clamp(result.mount,-.12,.12);
  result.cab=clamp(result.cab,-.045,.045);
  result.bolt=clamp(result.bolt,0,1.6);
  result.stop=clamp(result.stop,0,2.2);
  result.feeder=clamp(result.feeder,0,1.5);
  state.pose=result;
  return result;
}
