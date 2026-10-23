/** A.2–A.3: physically referenced *presentation* foot-placement controller.
 * Roots are authoritative body dynamics from stepRig. Anchors remain fixed in
 * world X/Z through support; a swinging foot commits to its next placement.
 * Never pushes the rig, changes collision, serial state or grants traction.
 * No Three.js, DOM, allocations per simulation step beyond returned snapshots.
 */
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const profiles=Object.freeze({
  'legs-yard':Object.freeze({halfWidth:.65,neutralZ:0,reach:.28,lateralReach:.21,lift:.17,stepSeconds:.36}),
  'legs-compact':Object.freeze({halfWidth:.51,neutralZ:-.02,reach:.38,lateralReach:.27,lift:.25,stepSeconds:.28}),
  'legs-hauler':Object.freeze({halfWidth:.84,neutralZ:0,reach:.22,lateralReach:.15,lift:.12,stepSeconds:.46}),
});
export const footContactProfile=id=>profiles[id]??profiles['legs-yard'];
const offsets=(state,side,p)=>{
  const yaw=state.yaw??0,c=Math.cos(yaw),s=Math.sin(yaw);
  const x=side*p.halfWidth,z=p.neutralZ;
  return {x:(state.x??0)+c*x-s*z,z:(state.z??0)+s*x+c*z};
};
const foot=(side,world)=>({side,mode:'stance',x:world.x,z:world.z,
  startX:world.x,startZ:world.z,targetX:world.x,targetZ:world.z,
  swing:0,impact:0,landingCount:0,lift:0});
export function createFootContacts(state={x:0,z:0,yaw:0},family='legs-yard'){
  const p=footContactProfile(family);
  return {family,feet:[foot(-1,offsets(state,-1,p)),foot(1,offsets(state,1,p))],
    nextSide:-1,landings:0,lastLandingSide:0,lastLandingStrength:0,
    lastX:state.x??0,lastZ:state.z??0,lastYaw:state.yaw??0,
    lastSpeed:0,pivot:false,stanceCount:2,slipM:0};
}
const angleDelta=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
/** Update once per rendered state. Output feet[*].localX/localZ are deltas
 * from the nominal authored foot rest positions (not absolute rig positions).
 * 'heel plant' can occur during active turning even if linear speed is zero.
 */
export function advanceFootContacts(state,rig,family='legs-yard',dt=1/60,{disabled=false}={}){
  if(!state||state.family!==family)state=createFootContacts(rig,family);
  const p=footContactProfile(family);
  const safeDt=clamp(Number.isFinite(dt)?dt:0,0,.10);
  const x=rig.x??0,z=rig.z??0,yaw=rig.yaw??0;
  const speed=Math.hypot(rig.vx??0,rig.vz??0);
  const yawDelta=angleDelta(yaw,state.lastYaw);
  const turning=Math.abs(yawDelta)/Math.max(safeDt,.001);
  const travel=Math.hypot(x-state.lastX,z-state.lastZ);
  // Teleports, redeploys and large correction steps replant rather than
  // stretching feet across the entire arena.
  if(travel>2.5||Math.abs(yawDelta)>1.3)return createFootContacts(rig,family);
  const inMotion=!disabled&&(speed>.16||turning>.14||travel>.015);
  state.pivot=inMotion&&speed<.55&&turning>.20;
  state.landings=0;state.lastLandingStrength=0;
  state.stanceCount=0;state.slipM=0;
  for(const f of state.feet){
    const nominal=offsets(rig,f.side,p);
    if(f.mode==='swing'){
      f.swing=clamp(f.swing+safeDt/p.stepSeconds,0,1);
      // A swing aims toward where the body will be when the foot lands.
      // Target remains committed after step initiation, so it cannot chase
      // the machine and appear to hover/skate.
      const t=f.swing*f.swing*(3-2*f.swing);
      f.x=f.startX+(f.targetX-f.startX)*t;
      f.z=f.startZ+(f.targetZ-f.startZ)*t;
      f.lift=Math.sin(Math.PI*t)*p.lift;
      if(f.swing>=1){
        f.mode='stance';f.x=f.targetX;f.z=f.targetZ;f.lift=0;f.swing=0;
        f.landingCount++;state.landings++;
        state.lastLandingSide=f.side;
        state.lastLandingStrength=clamp(.3+speed*.12+turning*.15,0,1);
        state.nextSide=-f.side;
      }
    } else {
      f.lift=0;
      state.stanceCount++;
      // Anchors remain world fixed. We deliberately do not rebase them on
      // each frame: only a genuine new swing is allowed to move a foot.
    }
    const dx=f.x-nominal.x,dz=f.z-nominal.z;
    const c=Math.cos(yaw),s=Math.sin(yaw);
    f.localX=c*dx+s*dz;
    f.localZ=-s*dx+c*dz;
    f.impact=Math.max(0,(f.impact??0)-safeDt*3.2);
  }
  if(inMotion && state.feet.every(f=>f.mode==='stance')){
    let candidate=null,largest=0;
    // Relative displacement measures the *actual* step required, including
    // a yaw-in-place rotation that old distance-based footsteps ignored.
    for(const f of state.feet){
      const distance=Math.hypot(f.localZ/p.reach,f.localX/p.lateralReach);
      if(distance>largest){largest=distance;candidate=f;}
    }
    const threshold=state.pivot?.44:.62;
    if(largest>threshold&&candidate){
      const preferred=state.feet.find(f=>f.side===state.nextSide);
      if(preferred){
        const wanted=Math.hypot(preferred.localZ/p.reach,preferred.localX/p.lateralReach);
        if(wanted>threshold*.70)candidate=preferred;
      }
      const nominal=offsets(rig,candidate.side,p);
      // Look ahead only a modest distance in the measured motion direction.
      // Limit relative placement by the family-specific available reach.
      const leadTime=clamp(p.stepSeconds*.33,.06,.18);
      const leadX=clamp((rig.vx??0)*leadTime,-p.reach*.48,p.reach*.48);
      const leadZ=clamp((rig.vz??0)*leadTime,-p.reach*.48,p.reach*.48);
      candidate.mode='swing';candidate.swing=0;
      candidate.startX=candidate.x;candidate.startZ=candidate.z;
      candidate.targetX=nominal.x+leadX;
      candidate.targetZ=nominal.z+leadZ;
      state.nextSide=-candidate.side;
    }
  }
  state.lastX=x;state.lastZ=z;state.lastYaw=yaw;state.lastSpeed=speed;
  return state;
}
export function footPresentation(state,side){
  const f=state?.feet.find(f=>f.side===side);
  return f?{x:f.localX,y:f.lift,z:f.localZ,
    planted:f.mode==='stance',swing:f.swing}:null;
}
