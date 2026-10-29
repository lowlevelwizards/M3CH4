/** Kestrel V2 – a lab-only, rigid-link pose/step solver.
 * All distances are in metres; +Z is backward. Nothing here touches
 * production IK, the catalogue, collision or saved rig formats.
 */
import * as THREE from 'three';
import {createSilhouetteMachine} from './kestrelSilhouetteGeometry.js';

export const STANCES=Object.freeze({
 perched:Object.freeze({id:'perched',name:'HIGH-PERCHED',height:.115,footZ:-.018,description:'Extended and alert; visible rear hocks'}),
 balanced:Object.freeze({id:'balanced',name:'BALANCED',height:0,footZ:0,description:'Practical field runner and baseline anatomy'}),
 crouched:Object.freeze({id:'crouched',name:'DEEP-CROUCHED',height:-.115,footZ:.035,description:'Compressed and ready to spring'})
});
export const STANCE_IDS=Object.freeze(Object.keys(STANCES));
export const BASE_FLOOR=-.775;
export const GAIT=Object.freeze({stride:.20,swingStart:[.025,.525],swingDuration:.34,lift:.115});
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
const hypot=(a,b)=>Math.hypot(a,b);

/** Circle intersections in the sagittal Y/Z plane: the rearward (+Z)
 * solution is always selected for Kestrel's characteristic birdlike hock.
 * Unlike interpolating knee coordinates, this preserves the original
 * thigh and shin lengths at EVERY pose, including stride extremes.
 */
export function solveRearHock(hip,ankle,upper,lower){
 const dy=ankle[1]-hip[1],dz=ankle[2]-hip[2];
 const distance=hypot(dy,dz),small=Math.abs(upper-lower)+.00001;
 const large=upper+lower-.00001;
 const d=clamp(distance,small,large);
 const along=(upper*upper-lower*lower+d*d)/(2*d);
 const height=Math.sqrt(Math.max(0,upper*upper-along*along));
 const uy=distance>1e-9?dy/distance:-1,uz=distance>1e-9?dz/distance:0;
 const midY=hip[1]+uy*along,midZ=hip[2]+uz*along;
 const points=[
  [hip[0],midY-uz*height,midZ+uy*height],
  [hip[0],midY+uz*height,midZ-uy*height]
 ];
 return {knee:points[0][2]>points[1][2]?points[0]:points[1],
  reachable:distance>=small&&distance<=large,
  reachError:Math.max(0,distance-large,small-distance)};
}
function swing(phase,start){
 const progress=(phase-start)/GAIT.swingDuration;
 return {advance:smooth(progress),lift:progress>0&&progress<1?
  Math.sin(Math.PI*smooth(progress)):0,progress:clamp(progress,0,1)};
}
export function calculateKestrelPose(params,options={}){
 const stance=STANCES[options.stance||'balanced'];
 if(!stance)throw Error('Unknown Kestrel stance '+options.stance);
 const walk=options.motion==='walk'||options.motion==='inspect';
 const phase=clamp(Number(options.phase)||0,0,1);
 const bodyZ=walk?-2*GAIT.stride*phase:0;
 const bob=walk?.012*Math.sin(4*Math.PI*phase)**2:0;
 const bodyY=stance.height+bob;
 const joints=params.legs.map((leg,index)=>{
  const side=leg.side,initial=walk?
   // Start with the right foot a half-stride ahead; first swing left.
   (index===0?0:-GAIT.stride):0;
  const step=walk?swing(phase,GAIT.swingStart[index]):{advance:0,lift:0};
  const worldFootZ=leg.foot[2]+stance.footZ+initial-2*GAIT.stride*step.advance;
  const lift=GAIT.lift*step.lift;
  const hip=[leg.hip[0],leg.hip[1]+bodyY,leg.hip[2]+bodyZ];
  const ankle=[leg.ankle[0],leg.ankle[1]+lift,
   leg.ankle[2]+stance.footZ+initial-2*GAIT.stride*step.advance];
  const foot=[leg.foot[0],leg.foot[1]+lift,worldFootZ];
  const upper=hypot(leg.knee[1]-leg.hip[1],leg.knee[2]-leg.hip[2]);
  const lower=hypot(leg.ankle[1]-leg.knee[1],leg.ankle[2]-leg.knee[2]);
  const solved=solveRearHock(hip,ankle,upper,lower);
  const knee=solved.knee;
  // Rig is translated as one assembly; joints are returned in rig-local space
  // so the foot can stay world-planted while the upper mech steps forward.
  const local=p=>[p[0],p[1]-bodyY,p[2]-bodyZ];
  return {side,hip:local(hip),knee:local(knee),ankle:local(ankle),
   foot:local(foot),worldFoot:foot,worldHip:hip,
   upperLength:upper,lowerLength:lower,reachError:solved.reachError,
   reachable:solved.reachable,footLift:lift,swingProgress:step.progress||0};
 });
 return {stance:stance.id,phase,motion:walk?'walk':'stand',
  bodyY,bodyZ,footZ:stance.footZ,joints,
  reachable:joints.every(j=>j.reachable),
  maxReachError:Math.max(...joints.map(j=>j.reachError))};
}
const v=a=>new THREE.Vector3(...a);
const deltaQ=(from,to)=>{
 const a=v(from).normalize(),b=v(to).normalize();
 return new THREE.Quaternion().setFromUnitVectors(a,b);
};
function vecBetween(a,b){return a.map((q,i)=>q-b[i]);}
function attachPiece(group,mesh){
 // updateWorldMatrix and attach preserve the current authored resting appearance.
 group.attach(mesh);
}
/** Wrap existing Kestrel meshes into rigid upper/lower/foot groups without
 * changing ANY of their original local castings or shape topology.
 */
export function createArticulatedKestrel(config){
 const {root,params}=createSilhouetteMachine(config);
 root.updateMatrixWorld(true);
 const limbs=[];
 for(const leg of params.legs){
  const side=leg.side,prefix=side<0?'L/':'R/';
  const names=root.children.filter(o=>o.isMesh&&o.name.startsWith(prefix));
  const thigh=new THREE.Group(),shin=new THREE.Group(),foot=new THREE.Group();
  thigh.name=prefix+'rotary thigh';shin.name=prefix+'rotary shin';
  foot.name=prefix+'grounded foot';
  thigh.position.fromArray(leg.hip);shin.position.fromArray(leg.knee);
  foot.position.fromArray(leg.foot);
  root.add(thigh,shin,foot);
  root.updateMatrixWorld(true);
  for(const mesh of names){
   const n=mesh.name;
   if(/single swept thigh|rear suspension|knee bearing|knee fastener/.test(n))
    attachPiece(thigh,mesh);
   else if(/primary forward shin|secondary shin rib|ankle turn bearing|ankle inset pivot/.test(n))
    attachPiece(shin,mesh);
   else if(/landing sole|heel brake|talon|toe|foot swivel stalk/.test(n))
    attachPiece(foot,mesh);
  }
  limbs.push({leg,thigh,shin,foot});
 }
 root.userData.articulatedPrototype=true;
 function pose(options={}){
  const result=calculateKestrelPose(params,options);
  for(let i=0;i<limbs.length;i++){
   const limb=limbs[i],p=result.joints[i],leg=limb.leg;
   limb.thigh.position.fromArray(leg.hip);
   limb.thigh.quaternion.copy(deltaQ(
    vecBetween(leg.knee,leg.hip),vecBetween(p.knee,p.hip)));
   limb.shin.position.fromArray(p.knee);
   limb.shin.quaternion.copy(deltaQ(
    vecBetween(leg.ankle,leg.knee),vecBetween(p.ankle,p.knee)));
   limb.foot.position.fromArray(p.foot);
   limb.foot.quaternion.identity();
  }
  root.userData.lastPose={stance:result.stance,phase:result.phase,
   reachable:result.reachable,reachError:result.maxReachError};
  return result;
 }
 pose({stance:'balanced'});
 return {root,params,limbs,pose};
}
