/** Reversible, visual-only sagittal two-link pose solver for Yardwalker studies.
 * Shared across three contenders. No authoritative gameplay locomotion, terrain
 * contact or production IK. Rest pose is *exactly* the existing Naked model.
 */
export const POSE_MODES=Object.freeze([
 {id:'neutral',label:'NEUTRAL',detail:'Original unmodified design stance'},
 {id:'walk',label:'WALK TEST',detail:'Alternating planted and swinging feet'},
 {id:'crouch',label:'DEEP BEND',detail:'Both feet planted during body compression'}
]);
const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));
const length=(a,b)=>Math.hypot(a[1]-b[1],a[2]-b[2]);
const distance2=(a,b)=>(a[1]-b[1])**2+(a[2]-b[2])**2;
export function sagittalKnee(hip,ankle,restKnee){
 const upper=length(hip,restKnee),lower=length(restKnee,ankle);
 const yzDistance=Math.hypot(ankle[1]-hip[1],ankle[2]-hip[2]);
 const goal=Math.min(upper+lower-1e-5,Math.max(Math.abs(upper-lower)+1e-5,yzDistance));
 const dy=(ankle[1]-hip[1])/(yzDistance||1),dz=(ankle[2]-hip[2])/(yzDistance||1);
 const advance=(upper*upper-lower*lower+goal*goal)/(2*goal);
 const lateral=Math.sqrt(Math.max(0,upper*upper-advance*advance));
 const centerY=hip[1]+dy*advance,centerZ=hip[2]+dz*advance;
 const a=[restKnee[0],centerY-dz*lateral,centerZ+dy*lateral];
 const b=[restKnee[0],centerY+dz*lateral,centerZ-dy*lateral];
 return {knee:distance2(a,restKnee)<=distance2(b,restKnee)?a:b,
  reachLimited:Math.abs(yzDistance-goal)>1e-3};
}
const fraction=x=>((x%1)+1)%1;
export function sampleStudyPose(params,mode='neutral',phase=0){
 if(!POSE_MODES.some(m=>m.id===mode))throw Error('Unknown pose test '+mode);
 const t=fraction(phase);
 // Body is fixed in X/Z. This is a treadmill pose evaluation, not travel.
 // Neutral rest is strictly unchanged; crouch evaluates static deep clearance.
 const bodyY=mode==='walk'?.013*(1-Math.cos(t*4*Math.PI))
  :mode==='crouch'?-.17:0;
 const legs=params.legs.map(leg=>{
  let lift=0,stepZ=0,footPitch=0,planted=true;
  if(mode==='walk'){
   const cycle=fraction(t+(leg.side>0?.5:0));
   const stepLength=.125;
   if(cycle<.62){
    stepZ=stepLength*(.5-cycle/.62);
   }else{
    const progress=(cycle-.62)/.38;
    stepZ=stepLength*(-.5+progress);
    lift=.15*Math.sin(progress*Math.PI);
    footPitch=.095*Math.sin(progress*Math.PI);
    planted=false;
   }
  }
  const hip=[...leg.hip],ankle=[...leg.ankle];
  ankle[1]+=lift-bodyY;
  ankle[2]+=stepZ;
  const result=mode==='neutral'
   ?{knee:[...leg.knee],reachLimited:false}
   :sagittalKnee(hip,ankle,leg.knee);
  return {side:leg.side,hip,knee:result.knee,ankle,footPitch,
   footLift:lift,footTravel:stepZ,planted,reachLimited:result.reachLimited};
 });
 return {mode,phase:t,bodyY,legs,reachLimited:legs.some(l=>l.reachLimited)};
}
