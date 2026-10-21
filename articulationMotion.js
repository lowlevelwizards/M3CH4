/** M3CH4 k.3w.12–15: deterministic *presentation only* articulated motion.
 * Mobility meshes carry real hip/knee/ankle pivots. No pose modifies
 * acceleration, collisions, ammunition, hit points or serialization.
 */
const TAU=Math.PI*2;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const fract=v=>v-Math.floor(v);
export const ANIMATION_FAMILIES=Object.freeze({
  'legs-yard':Object.freeze({stride:1.30,reach:.27,lift:.17,lateralReach:.145,stepRate:1,waist:.19,compression:.045}),
  'legs-compact':Object.freeze({stride:1.08,reach:.36,lift:.25,lateralReach:.185,stepRate:1,waist:.25,compression:.025}),
  'legs-hauler':Object.freeze({stride:1.66,reach:.19,lift:.11,lateralReach:.105,stepRate:1,waist:.12,compression:.070}),
});
export const familyAnimation=id=>ANIMATION_FAMILIES[id]??ANIMATION_FAMILIES['legs-yard'];
export const shortestAngle=r=>Math.atan2(Math.sin(r),Math.cos(r));
/** One gait cycle has TWO foot strikes, separated by PI. Phase is distance
 * travelled/stride (not wall clock time); audio events share that distance.
 */
export function footTrajectory(phase,side,weight,definition='legs-yard',backward=false){
  const f=familyAnimation(definition);
  const p=fract(phase/TAU+(side>0?.5:0));
  const planted=p<.58, u=planted?p/.58:(p-.58)/.42;
  // Relative foot moves rearward while planted and returns in an arc.
  const z=(planted?-1+2*u:1-2*u)*f.reach*(backward?-1:1)*weight;
  const y=planted?0:Math.sin(Math.PI*u)*f.lift*weight;
  const pitch=(planted?-.06+u*.08:-.17*Math.sin(Math.PI*u))*weight;
  return {z,y,pitch,planted,phase:p};
}
/** Analytic 2-segment sagittal IK. Angles are deviations from the authored
 * static links, so Kestrel's backwards knee survives rather than becoming
 * a conventional biped. Return finite, reach-clamped joints at all inputs.
 */
export function solveLegIK(upper,lower,deltaY,deltaZ){
  const [uy,uz]=upper,[ly,lz]=lower;
  const l1=Math.hypot(uy,uz),l2=Math.hypot(ly,lz);
  if(l1<.05||l2<.05)return {hip:0,knee:0,reach:0};
  let dy=uy+ly+deltaY,dz=uz+lz+deltaZ;
  const original=Math.hypot(dy,dz);
  const reach=clamp(original,Math.abs(l1-l2)+.003,l1+l2-.004);
  if(original>1e-5){dy*=reach/original;dz*=reach/original;}
  else {dy=-reach;dz=0;}
  const phi=Math.atan2(dz,dy);
  const elbow=Math.acos(clamp((l1*l1+reach*reach-l2*l2)/(2*l1*reach),-1,1));
  const upperRest=Math.atan2(uz,uy),lowerRest=Math.atan2(lz,ly);
  let best=null;
  for(const sign of [-1,1]){
    const upperWorld=phi+sign*elbow;
    const ky=dy-l1*Math.cos(upperWorld),kz=dz-l1*Math.sin(upperWorld);
    const lowerWorld=Math.atan2(kz,ky);
    const hip=shortestAngle(upperWorld-upperRest);
    const knee=shortestAngle(lowerWorld-lowerRest-hip);
    const score=hip*hip*.9+knee*knee*.7;
    if(!best||score<best.score)best={hip,knee,reach,score};
  }
  return {hip:clamp(best.hip,-.85,.85),knee:clamp(best.knee,-1.20,1.20),reach};
}
/** Sideways travel uses the same planted/swing timing as forward motion.
 * Each swing foot reaches in X while the planted foot pushes sideways, with
 * upper/knee/ankle Z rotations to reach the new lateral contact point.
 * No root translation, collision or physics changes.
 */
export function legPose(upper,lower,{phase=0,side=-1,weight=0,family='legs-yard',
  backward=false,strafe=0,forward=0,brace=0,health=1,disabled=false,
  upperX=0,lowerX=0}={}){
  const f=familyAnimation(family);
  const working=clamp(weight,0,1)*clamp(health,.08,1)*(disabled?.035:1);
  const strafeSigned=clamp(strafe,-1,1),fwd=Math.abs(clamp(forward,-1,1));
  // Full lateral steps only when strafing predominates. Forward diagonal
  // movement transitions continuously instead of abruptly switching gaits.
  const lateral=clamp(Math.abs(strafeSigned)*1.12-fwd*.56,0,1);
  const p=footTrajectory(phase,side,working,family,backward);
  const u=p.planted?p.phase/.58:(p.phase-.58)/.42;
  const strideShift=p.planted?1-2*u:-1+2*u;
  const reachX=Math.sign(strafeSigned)*strideShift*f.lateralReach*
    working*lateral;
  // Strong side strafing should not look like a forward march.
  const forwardTravel=p.z*(1-lateral*.88);
  const ik=solveLegIK(upper,lower,p.y,forwardTravel);
  const lateralIK=lateral>.001?solveLegIK(
    [upper[0],upperX],[lower[0],lowerX],
    p.y*.50,reachX
  ):{hip:0,knee:0};
  // Three-axis foot counter-rotation keeps the pads comparatively flat
  // even though the hip moves them laterally.
  const hipRoll=clamp(-lateralIK.hip,-.35,.35);
  const kneeRoll=clamp(-lateralIK.knee,-.43,.43);
  const ankleRoll=clamp(-(hipRoll+kneeRoll)*.68,-.32,.32);
  const footRoll=clamp(-(hipRoll+kneeRoll+ankleRoll)*.72,-.25,.25);
  const braceBend=clamp(brace,0,1)*.09;
  return {
    hip:ik.hip,
    knee:ik.knee-braceBend-(disabled?.33:0),
    ankle:-(ik.hip+ik.knee)*.65+p.pitch*.35+(disabled?.13:0),
    foot:-(ik.hip+ik.knee)*.22-p.pitch*.70,
    hipRoll,kneeRoll,ankleRoll,footRoll,spread:hipRoll,
    lateralReach:reachX,lift:p.y,planted:p.planted,phase:p.phase,
  };
}

/** Motor-driven upper hull motion. Visual waist rotation never changes rig
 * yaw or physics. Gun offset compensates for waist, preserving world aim.
 */
export function aimArticulation(targetYaw,targetPitch,dt,previous={
  waist:0,gun:0,elevation:0},{health=1,fault=false}={}){
  const h=clamp(health,.1,1),s=Math.max(0,dt);
  const rate=1-Math.exp(-s*(fault?1.8:4.8)*(.55+.45*h));
  const waistTarget=clamp(targetYaw,-.39,.39)*.67;
  const gunTarget=clamp(targetYaw,-1.05,1.05)-waistTarget;
  const elevationTarget=clamp(targetPitch,-.32,.46);
  const waist=previous.waist+(waistTarget-previous.waist)*rate;
  const gun=previous.gun+(gunTarget-previous.gun)*rate*(fault?.24:1);
  const elevation=previous.elevation+(elevationTarget-previous.elevation)*rate*(fault?.20:1);
  return {waist,gun,elevation};
}
export function reloadArticulation(remaining,total,kind='gun-cannon'){
  if(!Number.isFinite(total)||total<=0||!(remaining>0))return {slide:0,bolt:0,cassette:0};
  const progress=clamp(1-remaining/total,0,1);
  const smooth=(a,b,x)=>{let t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
  const stroke=(a,b,c,d)=>smooth(a,b,progress)*(1-smooth(c,d,progress));
  // Physical stages follow actual reloadSeconds; the animation cannot make
  // a weapon fire earlier or create a fictional round.
  if(kind==='gun-scatter')return {
    slide:stroke(.08,.27,.65,.84)*.27,
    bolt:stroke(.26,.43,.69,.86)*.12,
    cassette:stroke(.16,.33,.69,.90)*.25,
  };
  if(kind==='gun-short')return {
    slide:stroke(.10,.35,.67,.86)*.30,
    bolt:stroke(.35,.48,.72,.90)*.22,cassette:0,
  };
  if(kind==='gun-light')return {
    slide:stroke(.09,.30,.66,.88)*.20,
    bolt:stroke(.17,.39,.72,.93)*.13,cassette:0,
  };
  return {
    slide:stroke(.15,.40,.62,.85)*.20,
    bolt:stroke(.30,.48,.70,.91)*.13,cassette:0,
  };
}
