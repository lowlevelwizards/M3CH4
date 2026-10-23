/** k5r.5 — truthful support-catch impulse policy.
 * All coefficients are PRESENTATION only. The authoritative chassis velocity,
 * yaw, hitboxes, armor, recoil and player/AI steering are never changed here.
 */
const clamp=(x,a,b)=>Math.max(a,Math.min(b,Number.isFinite(x)?x:a));
export const IMPACT_CATCH_PROFILES=Object.freeze({
 'legs-yard':Object.freeze({transmission:1,stepThreshold:.42,loadCompression:.016,stepReach:.55,lean:.026}),
 'legs-compact':Object.freeze({transmission:1.35,stepThreshold:.35,loadCompression:.013,stepReach:.85,lean:.042}),
 'legs-hauler':Object.freeze({transmission:.59,stepThreshold:.50,loadCompression:.035,stepReach:.32,lean:.014}),
});
export const impactCatchProfile=id=>IMPACT_CATCH_PROFILES[id]??IMPACT_CATCH_PROFILES['legs-yard'];
/** Works directly from real hit impulse, struck mass, actual direction in
 * chassis coordinates, armor event and brace. Exactly one shared policy for
 * player and NPC visual feet. Never infer a hit from cosmetic screen shake.
 */
export function impactCatchEvidence({
 impulseNs=0,massKg=2400,brace=0,directionX=0,directionZ=0,
 pointX=0,damageHealth=1,
}={},family='legs-yard'){
 const impulse=clamp(impulseNs,0,7200);
 if(impulse<=0)return null;
 const p=impactCatchProfile(family);
 const support=1-.58*clamp(brace,0,1);
 const integrity=1+.18*(1-clamp(damageHealth,0,1));
 const force=clamp(impulse/clamp(massKg,800,10000)*.69*
    p.transmission*support*integrity,0,1);
 if(force<.055)return null;
 const x=clamp(directionX,-1,1),z=clamp(directionZ,-1,1);
 // A frontal impact still needs a deterministic preferred support side.
 // Prefer an outboard hit-side if shot is mostly fore/aft.
 const side=Math.abs(x)>.21?(x>0?1:-1):pointX>=0?1:-1;
 return {force,side,x,z,requiresStep:force>=p.stepThreshold,
   compression:force*p.loadCompression,lean:force*p.lean};
}
export function createImpactCatchState(){
 return {force:0,x:0,z:0,side:0,pending:false,window:0,cooldown:0,
    hitCount:0,stepCount:0,compression:0};
}
export function injectImpactCatch(state,evidence){
 if(!state||!evidence)return state;
 // Coalesce pellets into one corrective opportunity. Repeated hits can
 // increase leg load, but cannot enqueue dozens of procedural footsteps.
 const incoming=evidence.force;
 if(incoming>=state.force*.75){
  state.side=evidence.side;state.x=evidence.x;state.z=evidence.z;
 }
 state.force=clamp(state.force+incoming*.68,0,1);
 state.window=Math.max(state.window,.9);
 if(evidence.requiresStep&&state.cooldown<=0)state.pending=true;
 state.hitCount=(state.hitCount??0)+1;
 return state;
}
export function advanceImpactCatch(state,dt){
 if(!state||!Number.isFinite(dt)||dt<=0)return state;
 const t=Math.min(.10,dt);
 state.force=Math.max(0,state.force*Math.exp(-2.75*t));
 state.compression=state.force;
 state.cooldown=Math.max(0,state.cooldown-t);
 state.window=Math.max(0,state.window-t);
 if(state.window<=0){state.pending=false;state.x=state.z=0;}
 return state;
}
export function commitImpactCatchStep(state){
 if(!state?.pending)return false;
 state.pending=false;state.window=0;state.cooldown=.85;
 state.stepCount=(state.stepCount??0)+1;
 return true;
}
