/** k.3w.10 / Pure acoustic events. Combat, movement and power remain
 * authoritative; audio only observes completed state transitions.
 */
export const SYSTEM_IMPACT_VARIANTS=Object.freeze({
  armor:2,part:2,destruction:0,sparks:2,zap:0,recharge:1,
});
export const MOBILITY_AUDIO=Object.freeze({
  'legs-yard':Object.freeze({id:'yardwalker',strideM:1.30,minimumSeconds:.34}),
  'legs-compact':Object.freeze({id:'kestrel',strideM:1.08,minimumSeconds:.28}),
  'legs-hauler':Object.freeze({id:'hauler',strideM:1.66,minimumSeconds:.43}),
});
export function soundFamilyFor(mobilityDefinitionId){
  return MOBILITY_AUDIO[mobilityDefinitionId]??MOBILITY_AUDIO['legs-yard'];
}
export function hitSoundPlan(hit,{shielded=false,slot=null,ordinal=0}={}){
  if(!hit)return [];
  const count=Math.max(0,Math.floor(Number.isFinite(ordinal)?ordinal:0));
  // Destruction is much louder than a hit. Avoid simultaneously layering
  // several full-volume clicks over a major rupture.
  if(hit.justDestroyed||hit.justDisabled){
    const sounds=[{id:'destruction',variant:count%3,strength:hit.justDestroyed?1.0:.80}];
    if(slot==='power')sounds.push({id:'sparks',variant:2,strength:.24});
    return sounds;
  }
  if((hit.internalDamage??0)>0){
    const sounds=[{id:'part',variant:2,strength:.80}];
    // Armor splitting and physical internals may be heard together, but the
    // supporting crack stays below the housing impact.
    if(hit.armorAbsorbed>0&&hit.remainingArmor<=.001)
      sounds.push({id:'armor',variant:2,strength:.35});
    else if(hit.armorAbsorbed>0)
      sounds.push({id:'glance',variant:2,strength:.17});
    if(slot==='power')sounds.push({id:'sparks',variant:2,strength:.32});
    return sounds;
  }
  if(hit.armorAbsorbed>0||shielded){
    if(hit.armorAbsorbed>0&&hit.remainingArmor<=.001)
      return [{id:'armor',variant:2,strength:.83}];
    return [{id:'glance',variant:count%2,strength:.60}];
  }
  return [];
}
export function createMotionSoundState(){
  return {travelM:0,stepLeft:0,engineLeft:0,hydraulicStep:0,active:false};
}
/** Returns a small list of actual events, not a looped "footsteps if moving"
 * timer. Each step requires real displacement, a speed gate and a cadence
 * gate. Engines pulse gently while walking; hydraulics every third contact.
 */
export function advanceMotionSound(state,family,speed,dt){
  const events=[];
  if(!state||!family||!Number.isFinite(dt)||dt<=0)return events;
  const metersPerSecond=Math.max(0,Number.isFinite(speed)?speed:0);
  if(metersPerSecond<.65){
    state.travelM=0;state.active=false;
    state.stepLeft=Math.max(0,(state.stepLeft??0)-dt);
    state.engineLeft=Math.max(0,(state.engineLeft??0)-dt);
    // Engines do not suddenly fall silent every time a pilot plants a foot.
    // The PCM fades in/out; a gentle idle pulse avoids a permanent AI loop.
    if(state.engineLeft<=0){events.push('engine');state.engineLeft=1.54;}
    return events;
  }
  state.stepLeft=Math.max(0,(state.stepLeft??0)-dt);
  state.engineLeft=Math.max(0,(state.engineLeft??0)-dt);
  state.travelM=Math.min(family.strideM*1.1,(state.travelM??0)+metersPerSecond*dt);
  if(!state.active||state.engineLeft<=0){
    events.push('engine');
    state.engineLeft=1.35;
  }
  state.active=true;
  if(state.travelM>=family.strideM&&state.stepLeft<=0){
    state.travelM-=family.strideM;
    state.stepLeft=family.minimumSeconds;
    events.push(family.id);
    state.hydraulicStep=(state.hydraulicStep??0)+1;
    if(state.hydraulicStep%3===0)events.push('hydraulics');
  }
  return events;
}
export function systemDistanceGain(meters=0){
  const d=Math.max(0,Number.isFinite(meters)?meters:0);
  return 1/(1+Math.pow(d/11,1.4));
}
