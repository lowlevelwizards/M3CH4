/** k5r.2 — bounded impact inertia for visual machines, never hitboxes/physics.
 * An authoritative armor/core hit injects impulse. Critically damped degrees
 * of freedom then return the cab, frame and gun to their existing pose.
 */
const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,Number.isFinite(n)?n:lo));
export const HIT_REACTION_LIMITS=Object.freeze({pitch:.10,roll:.11,mount:.13,translation:.045});
export function createHitResponse(){
  return {pitch:0,roll:0,mount:0,translation:0,
    vPitch:0,vRoll:0,vMount:0,vTranslation:0};
}
export function injectHitResponse(state,{
  impulseNs=0,massKg=2400,brace=0,
  directionX=0,directionZ=-1,pointX=0,pointY=2,
  armorAbsorbed=0,internalDamage=0,disabled=false,
  slot='structure',
}={}){
  if(!state)return state;
  const impulse=clamp(impulseNs,0,7200);
  // Arc-cut/thermal ticks communicate heating through scars, not explosions.
  if(impulse<=0)return state;
  const mass=clamp(massKg,800,10000),grounded=1-.60*clamp(brace,0,1);
  const load=clamp(impulse/mass,0,3.5)*grounded;
  const penetration=internalDamage>0?1.18:armorAbsorbed>0?.90:.65;
  const failure=disabled?1.14:1;
  const strength=load*penetration*failure;
  const side=clamp(directionX,-1,1),fore=clamp(directionZ,-1,1);
  const leverage=clamp(pointY/2.1,.40,1.6);
  // Lateral strike rolls the hull; fore/aft strike pitches it. The struck
  // mount flexes separately. No fake movement, accuracy changes or stun.
  state.vRoll=clamp(state.vRoll+side*strength*1.65*leverage+
    clamp(pointX,-2,2)*strength*.22,-2.2,2.2);
  state.vPitch=clamp(state.vPitch-fore*strength*1.28*leverage,-2.2,2.2);
  state.vMount=clamp(state.vMount+strength*(slot==='combat'?2.0:.68),-2.4,2.4);
  state.vTranslation=clamp(state.vTranslation+strength*.26,-.9,.9);
  return state;
}
export function advanceHitResponse(state,dt){
  if(!state||!Number.isFinite(dt)||dt<=0)return state;
  const t=Math.min(.065,dt);
  // Damped spring. Sub-stepping keeps the impulse well-behaved on dropped
  // mobile frames, even if 60 Hz physics temporarily renders at 20–30 fps.
  const segments=Math.max(1,Math.ceil(t/(1/120))),h=t/segments;
  for(let i=0;i<segments;i++){
    // Unrolled: no tuple-array allocation in the hot 60 Hz rendering loop.
    state.vPitch+=(-state.pitch*98-state.vPitch*19)*h;
    state.pitch+=state.vPitch*h;
    state.vRoll+=(-state.roll*93-state.vRoll*18)*h;
    state.roll+=state.vRoll*h;
    state.vMount+=(-state.mount*146-state.vMount*23)*h;
    state.mount+=state.vMount*h;
    state.vTranslation+=(-state.translation*132-state.vTranslation*24)*h;
    state.translation+=state.vTranslation*h;
  }
  state.pitch=clamp(state.pitch,-HIT_REACTION_LIMITS.pitch,HIT_REACTION_LIMITS.pitch);
  state.roll=clamp(state.roll,-HIT_REACTION_LIMITS.roll,HIT_REACTION_LIMITS.roll);
  state.mount=clamp(state.mount,-HIT_REACTION_LIMITS.mount,HIT_REACTION_LIMITS.mount);
  state.translation=clamp(state.translation,-HIT_REACTION_LIMITS.translation,HIT_REACTION_LIMITS.translation);
  return state;
}
/** Surface outcomes alone decide which language is shown; never infer a
 * penetration or a fracture from the damage number or muzzle velocity. */
export function hitMaterialLanguage(hit){
  if(!hit)return 'world';
  if(hit.justDestroyed||hit.justDisabled)return 'catastrophic';
  if(hit.wreckHit)return 'wreck';
  if((hit.internalDamage??0)>0)return hit.slot==='power'?'electric':
    hit.slot==='mobility'?'hydraulic':'breach';
  if((hit.armorAbsorbed??0)>0)return (hit.remainingArmor??1)<=.001?'armor-break':'armor';
  return 'world';
}
