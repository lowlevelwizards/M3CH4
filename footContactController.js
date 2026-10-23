/** A.2–A.3: physically referenced *presentation* foot-placement controller.
 * Roots are authoritative body dynamics from stepRig. Anchors remain fixed in
 * world X/Z through support; a swinging foot commits to its next placement.
 * Never pushes the rig, changes collision, serial state or grants traction.
 * No Three.js, DOM, allocations per simulation step beyond returned snapshots.
 */
import {createImpactCatchState,impactCatchEvidence,injectImpactCatch,
  advanceImpactCatch,commitImpactCatchStep,impactCatchProfile} from './impactCatch.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const profiles=Object.freeze({
  'legs-yard':Object.freeze({halfWidth:.65,neutralZ:0,reach:.28,lateralReach:.21,lift:.17,stepSeconds:.36,prepareSeconds:.105,compression:.021}),
  'legs-compact':Object.freeze({halfWidth:.51,neutralZ:-.02,reach:.38,lateralReach:.27,lift:.25,stepSeconds:.28,prepareSeconds:.072,compression:.014}),
  'legs-hauler':Object.freeze({halfWidth:.84,neutralZ:0,reach:.22,lateralReach:.15,lift:.12,stepSeconds:.46,prepareSeconds:.14,compression:.036}),
});
export const footContactProfile=id=>profiles[id]??profiles['legs-yard'];
const offsets=(state,side,p)=>{
  const yaw=state.yaw??0,c=Math.cos(yaw),s=Math.sin(yaw);
  const x=side*p.halfWidth,z=p.neutralZ;
  const wx=(state.x??0)+c*x-s*z,wz=(state.z??0)+s*x+c*z;
  return {x:wx,z:wz,y:typeof state.terrainHeightAt==='function'?state.terrainHeightAt(wx,wz):0};
};
const foot=(side,world)=>({side,mode:'stance',x:world.x,z:world.z,
  startX:world.x,startZ:world.z,targetX:world.x,targetZ:world.z,
  y:world.y??0,startY:world.y??0,targetY:world.y??0,
  swing:0,impact:0,landingCount:0,lift:0,load:.5,compression:0,preparing:false});
export function createFootContacts(state={x:0,z:0,yaw:0},family='legs-yard'){
  const p=footContactProfile(family);
  return {family,feet:[foot(-1,offsets(state,-1,p)),foot(1,offsets(state,1,p))],
    nextSide:-1,landings:0,lastLandingSide:0,lastLandingStrength:0,
    lastX:state.x??0,lastZ:state.z??0,lastYaw:state.yaw??0,
    lastSpeed:0,pivot:false,stanceCount:2,slipM:0,
    preparingSide:0,prepareLeft:0,weightShift:0,actuatorEffort:0,bodyCompression:0,
    gaitMode:'IDLE',recovery:0,maneuver:'STANDING',bodyGroundHeight:state.groundHeightM??0,
    recoveryStepCooldown:0,catchStepCount:0,flow:0,
    hitCatch:createImpactCatchState()};
}
const angleDelta=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
/** Actual shot contact has already been resolved by the scene. Attach the
 * visual support recovery to the SAME per-rig foot state used for foot IK.
 */
export function registerFootImpact(state,hit={}){
 if(!state)return null;
 if(!state.hitCatch)state.hitCatch=createImpactCatchState();
 const evidence=impactCatchEvidence(hit,state.family);
 if(evidence)injectImpactCatch(state.hitCatch,evidence);
 return evidence;
}
/** Update once per rendered state. Output feet[*].localX/localZ are deltas
 * from the nominal authored foot rest positions (not absolute rig positions).
 * 'heel plant' can occur during active turning even if linear speed is zero.
 */
export function advanceFootContacts(state,rig,family='legs-yard',dt=1/60,{disabled=false}={}){
  if(!state||state.family!==family)state=createFootContacts(rig,family);
  const p=footContactProfile(family);
  const hit=state.hitCatch??(state.hitCatch=createImpactCatchState());
  const safeDt=clamp(Number.isFinite(dt)?dt:0,0,.10);
  advanceImpactCatch(hit,safeDt);
  const x=rig.x??0,z=rig.z??0,yaw=rig.yaw??0;
  const speed=Math.hypot(rig.vx??0,rig.vz??0);
  const yawDelta=angleDelta(yaw,state.lastYaw);
  const turning=Math.abs(yawDelta)/Math.max(safeDt,.001);
  const travel=Math.hypot(x-state.lastX,z-state.lastZ);
  // Teleports, redeploys and large correction steps replant rather than
  // stretching feet across the entire arena.
  if(travel>2.5||Math.abs(yawDelta)>1.3)return createFootContacts(rig,family);
  const regularMotion=!disabled&&(speed>.16||turning>.14||travel>.015);
  // Gait vocabulary follows *achieved* velocity rather than assigning new
  // speed or motor authority. Hysteresis avoids rapid family state flicker.
  const nextMode=!regularMotion?'IDLE':speed<.65?'CREEP':speed<2.55?'WALK':'HUSTLE';
  state.gaitMode=nextMode;
  const recoveryTarget=clamp((rig.footSlipMps??0)*.38+
    Math.max(0,(rig.tractionUse??0)-.91)*1.8+
    Math.max(0,rig.impact??0)*.50,0,1);
  state.recovery+=(recoveryTarget-state.recovery)*(1-Math.exp(-safeDt*8));
  state.recoveryStepCooldown=Math.max(0,state.recoveryStepCooldown-safeDt);
  const slipCatch=!disabled&&state.recovery>.34&&speed<.95&&
    state.recoveryStepCooldown<=0;
  // An actual side impact can request a corrective step WHILE running.
  // Only commit when both world-anchored feet are supporting the machine.
  const impactStep=!disabled&&hit.pending&&hit.cooldown<=0&&hit.window>0;
  const catchStep=slipCatch||impactStep;
  const inMotion=regularMotion||catchStep;
  // Flow is a descriptive, non-rewarding measure of clean, efficient steps.
  // No invisible boost, combo meter or damage bonus is awarded.
  const flowTarget=regularMotion&&speed>.65&&state.recovery<.12&&
    (rig.tractionUse??0)<.87?.95:0;
  state.flow+=(flowTarget-state.flow)*(1-Math.exp(-safeDt*2.7));
  state.maneuver=impactStep?'IMPACT CATCH':catchStep?'CATCH STEP':(speed<.55&&turning>.20)?'PIVOT':nextMode==='IDLE'?'SETTLE':
    (Math.abs(rig.lateralSpeed??0)>Math.abs(rig.forwardSpeed??0)*1.4
       ?'SIDESTEP':nextMode);
  if(!inMotion||disabled){state.preparingSide=0;state.prepareLeft=0;}
  if(state.preparingSide){state.prepareLeft=Math.max(0,state.prepareLeft-safeDt);}
  state.pivot=inMotion&&speed<.55&&turning>.20;
  state.landings=0;state.lastLandingStrength=0;
  state.stanceCount=0;state.slipM=0;
  for(const f of state.feet){
    const nominal=offsets(rig,f.side,p);
    if(f.mode==='swing'){
      // Fast locomotion is a quicker higher-energy transfer; precision
      // creep takes shorter, deliberate time with reliable ground support.
      const gaitTime=f.impactCatch?.78:state.gaitMode==='HUSTLE'?.82:
        state.gaitMode==='CREEP'?1.24:1;
      f.swing=clamp(f.swing+safeDt/(p.stepSeconds*gaitTime),0,1);
      // A swing aims toward where the body will be when the foot lands.
      // Target remains committed after step initiation, so it cannot chase
      // the machine and appear to hover/skate.
      const t=f.swing*f.swing*(3-2*f.swing);
      f.x=f.startX+(f.targetX-f.startX)*t;
      f.z=f.startZ+(f.targetZ-f.startZ)*t;
      f.y=f.startY+(f.targetY-f.startY)*t;
      f.lift=Math.sin(Math.PI*t)*p.lift*(state.gaitMode==='HUSTLE'?1.12:1);
      if(f.swing>=1){
        f.mode='stance';f.x=f.targetX;f.z=f.targetZ;f.y=f.targetY;f.lift=0;f.swing=0;
        f.impactCatch=false;
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
    f.preparing=state.preparingSide===f.side&&state.prepareLeft>0;
  }
  if(inMotion && state.feet.every(f=>f.mode==='stance')){
    let candidate=null,largest=0;
    // Relative displacement measures the *actual* step required, including
    // a yaw-in-place rotation that old distance-based footsteps ignored.
    for(const f of state.feet){
      const distance=Math.hypot(f.localZ/p.reach,f.localX/p.lateralReach);
      if(distance>largest){largest=distance;candidate=f;}
    }
    // A loss-of-footing correction can begin even when both feet happen
    // to be at nominal rest positions (zero positional error).
    if(catchStep&&!candidate)candidate=state.feet.find(f=>f.side===state.nextSide);
    const threshold=state.pivot?.44:.62;
    if((largest>threshold||catchStep)&&candidate){
      if(impactStep){
        candidate=state.feet.find(f=>f.side===hit.side)??candidate;
      }else{
        if(catchStep)candidate=state.feet.find(f=>f.side===state.nextSide)??candidate;
        const preferred=state.feet.find(f=>f.side===state.nextSide);
        if(preferred){
          const wanted=Math.hypot(preferred.localZ/p.reach,preferred.localX/p.lateralReach);
          if(wanted>threshold*.70)candidate=preferred;
        }
      }
      const nominal=offsets(rig,candidate.side,p);
      // Look ahead only a modest distance in the measured motion direction.
      // Limit relative placement by the family-specific available reach.
      const leadTime=clamp(p.stepSeconds*(state.gaitMode==='HUSTLE'?.45:.33),.06,.18);
      // A real unstable rig catches itself by widening its support polygon
      // by at most half the family lateral reach. This is a planted step,
      // not a translation/turn of the authoritative body physics.
      const yawCos=Math.cos(yaw),yawSin=Math.sin(yaw);
      const widen=catchStep?candidate.side*p.lateralReach*.45:0;
      const profile=impactCatchProfile(family);
      // Put the recovering foot down in the real local impulse direction,
      // constrained by each family's authored foot reach. World-anchored
      // stance feet are never teleported or slid toward the event.
      const shiftX=impactStep?hit.x*p.lateralReach*profile.stepReach*hit.force:0;
      const shiftZ=impactStep?hit.z*p.reach*profile.stepReach*hit.force:0;
      const localX=widen+shiftX;
      const leadX=clamp((rig.vx??0)*leadTime,-p.reach*.48,p.reach*.48)+
          localX*yawCos-shiftZ*yawSin;
      const leadZ=clamp((rig.vz??0)*leadTime,-p.reach*.48,p.reach*.48)+
          localX*yawSin+shiftZ*yawCos;
      // Transfer load to the future support leg before committing the step.
      // Only transition to swing when the preparatory interval has elapsed;
      // a change in travel direction may cancel preparation without a snap.
      if(!state.preparingSide || state.preparingSide!==candidate.side){
        state.preparingSide=candidate.side;
        state.prepareLeft=p.prepareSeconds;
      }else if(state.prepareLeft<=0){
        candidate.mode='swing';candidate.swing=0;
        candidate.impactCatch=impactStep;
        candidate.startX=candidate.x;candidate.startZ=candidate.z;
        candidate.startY=candidate.y;candidate.targetY=nominal.y;
        candidate.targetX=nominal.x+leadX;
        candidate.targetZ=nominal.z+leadZ;
        state.nextSide=-candidate.side;
        state.preparingSide=0;
        if(catchStep){
          state.recoveryStepCooldown=.95;state.catchStepCount++;
          if(impactStep)commitImpactCatchStep(hit);
        }
      }
    }
  }
  // Stance load is real contact availability, not a canned phase sine. The
  // swing foot carries no support force. During anticipation unload the
  // next foot and shift weight across the supporting hip.
  let total=0;
  for(const f of state.feet){
    const swing=f.mode==='swing';
    const preparing=f.side===state.preparingSide&&state.prepareLeft>0;
    const target=swing?0:preparing?.10:1;
    f.load+=(target-f.load)*(1-Math.exp(-safeDt*15));
    total+=f.load;
  }
  const loadL=state.feet[0].load/Math.max(.001,total);
  const loadR=state.feet[1].load/Math.max(.001,total);
  const targetShift=clamp(loadR-loadL+hit.force*hit.side*.22,-1,1);
  state.weightShift+=(targetShift-state.weightShift)*(1-Math.exp(-safeDt*11));
  const effort=clamp((rig.driveLoad??0)*.70+(rig.tractionUse??0)*.3,0,1);
  state.actuatorEffort+=(effort-state.actuatorEffort)*(1-Math.exp(-safeDt*9));
  state.bodyCompression=0;
  for(const f of state.feet){
    f.load/=Math.max(.001,total);
    f.compression=f.mode==='stance'
      ?p.compression*f.load*(.4+.6*state.actuatorEffort+state.recovery*.12)+
         impactCatchProfile(family).loadCompression*hit.force*f.load
      :0;
    state.bodyCompression+=f.compression;
  }
  state.bodyGroundHeight=rig.groundHeightM??0;
  state.lastX=x;state.lastZ=z;state.lastYaw=yaw;state.lastSpeed=speed;
  return state;
}
export function footPresentation(state,side){
  const f=state?.feet.find(f=>f.side===side);
  return f?{x:f.localX,y:f.lift+(f.y??0)-(state?.bodyGroundHeight??0),z:f.localZ,
    planted:f.mode==='stance',swing:f.swing,load:f.load,
    preparing:f.preparing,compression:f.compression,
    catchStep:!!f.impactCatch,hitLoad:state?.hitCatch?.force??0}:null;
}
