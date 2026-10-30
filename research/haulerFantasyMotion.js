/** Lab-only rigid two-link Hauler pose solver.
 * Each real hip/knee/ankle/foot group is rotated, never mesh-deformed.
 * A deliberately slow treadmill gait previews weight transfer; this does
 * not claim to be the game's live foot IK or a physics contact solver.
 */
import {createHaulerConcept} from './haulerFantasyGeometry.js';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
const distance=(a,b)=>Math.hypot(a[1]-b[1],a[2]-b[2]);
const heading=(a,b)=>Math.atan2(b[2]-a[2],b[1]-a[1]);
const angleDiff=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
/** Y/Z two-circle intersection with the knee solution closest to its own
 * mechanical rest pose. Segment lengths are unchanged at every frame.
 */
export function solveHeavyLinks(hip,knee,ankle,target){
 const upper=distance(hip,knee),lower=distance(knee,ankle);
 const dy=target[1]-hip[1],dz=target[2]-hip[2];
 const request=Math.hypot(dy,dz);
 const d=clamp(request,Math.abs(upper-lower)+.00001,upper+lower-.00001);
 const along=(upper*upper-lower*lower+d*d)/(2*d);
 const h=Math.sqrt(Math.max(0,upper*upper-along*along));
 const vy=dy/(request||1),vz=dz/(request||1);
 const baseY=hip[1]+vy*along,baseZ=hip[2]+vz*along;
 const choices=[
  [hip[0],baseY-vz*h,baseZ+vy*h],
  [hip[0],baseY+vz*h,baseZ-vy*h]
 ];
 const chosen=choices.reduce((a,b)=>
  distance(a,knee)<distance(b,knee)?a:b);
 return {knee:chosen,ankle:[hip[0],hip[1]+vy*d,hip[2]+vz*d],
  reachable:Math.abs(d-request)<.002,reachError:Math.abs(d-request),
  upper,lower};
}
export const HAULER_MOTIONS=Object.freeze(['idle','walk','turn','brace']);
export function createMovingHauler(config){
 const study=createHaulerConcept(config);
 function pose({motion='idle',phase=0,contacts=false}={}){
  if(!HAULER_MOTIONS.includes(motion))throw Error('Unknown Hauler motion '+motion);
  const p=study.params,t=((phase%1)+1)%1,footStates=[];
  const braced=motion==='brace',moving=motion==='walk';
  const bodyY=braced?-.055:moving?-.010*(.5+.5*Math.sin(t*Math.PI*4)**2):0;
  const bodyZ=moving ? .016*Math.sin(t*Math.PI*2) : 0;
  let maxReachError=0;
  for(const limb of study.limbs){
   const {leg,hip,knee,ankle,foot,marker}=limb;
   const f=(t+(leg.side>0?.5:0))%1;
   const stance=f<.62;
   const travel=p.strideDistance;
   const travelZ=moving?(stance?
    travel*(.5-f/.62):
    travel*(-.5+smooth((f-.62)/.38))):0;
   const lift=moving&&!stance?
    p.lift*Math.sin(Math.PI*smooth((f-.62)/.38)):0;
   const target=[...leg.ankle];
   target[2]+=travelZ-bodyZ;
   target[1]+=lift-bodyY;
   if(braced)target[1]+=.055;
   const result=solveHeavyLinks(leg.hip,leg.knee,leg.ankle,target);
   maxReachError=Math.max(maxReachError,result.reachError);
   // Moving yoke and piston castings retain their rigid geometry.
   const upperAngle=heading(leg.hip,result.knee);
   const lowerAngle=heading(result.knee,result.ankle);
   const hipAngle=angleDiff(upperAngle,heading(leg.hip,leg.knee));
   const kneeAngle=angleDiff(lowerAngle,heading(leg.knee,leg.ankle))-hipAngle;
   hip.rotation.set(hipAngle,0,0);
   knee.rotation.set(kneeAngle,0,0);
   ankle.rotation.set(-hipAngle-kneeAngle,0,0);
   foot.rotation.set(0,0,0);
   if(motion==='turn'){
    hip.rotation.z=leg.side*.065*Math.sin(t*Math.PI*2);
    knee.rotation.z=-leg.side*.042*Math.sin(t*Math.PI*2);
   }
   marker.visible=contacts;
   marker.material.emissive?.setHex(stance||!moving?0x183f2c:0x513221);
   footStates.push({side:leg.side,contact:!moving||stance?'SUPPORT':'SWING',
    lift,reachError:result.reachError});
  }
  study.root.userData.lastPose={motion,phase:t,bodyY,bodyZ,
   reachError:maxReachError,feet:footStates};
  return study.root.userData.lastPose;
 }
 pose();
 return {...study,pose};
}
