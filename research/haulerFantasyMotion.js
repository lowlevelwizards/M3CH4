/** Hauler H2 V2 support-foot art rig; no production gait/IK dependency.
 * Full rigid lengths for Crane, compressive transfer for Dockyard,
 * axial travel for Strider. Attached two-piece hydraulic cylinders
 * recompute against their actual moving model anchors every frame.
 */
import * as THREE from 'three';
import {createHaulerConcept,updateHaulerActuators} from './haulerFantasyGeometry.js';

const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
const distance=(a,b)=>Math.hypot(a[1]-b[1],a[2]-b[2]);
const heading=(a,b)=>Math.atan2(b[2]-a[2],b[1]-a[1]);
const diff=(a,b)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));

/** Rigid 2-link IK: choose knee solution nearest the authored mechanism
 * and never scale either physical beam. The exposed barrel/rod is an actual
 * telescopic pair updated from anchored endpoints by updateHaulerActuators.
 */
export function solveHeavyLinks(hip,knee,ankle,target){
 const upper=distance(hip,knee),lower=distance(knee,ankle);
 const dy=target[1]-hip[1],dz=target[2]-hip[2],requested=Math.hypot(dy,dz);
 const d=clamp(requested,Math.abs(upper-lower)+.00001,upper+lower-.00001);
 const along=(upper*upper-lower*lower+d*d)/(2*d);
 const h=Math.sqrt(Math.max(0,upper*upper-along*along));
 const vy=dy/(requested||1),vz=dz/(requested||1);
 const cy=hip[1]+vy*along,cz=hip[2]+vz*along;
 const variants=[
  [hip[0],cy-vz*h,cz+vy*h],
  [hip[0],cy+vz*h,cz-vy*h]
 ];
 const selected=distance(variants[0],knee)<distance(variants[1],knee)?
  variants[0]:variants[1];
 return {knee:selected,ankle:[hip[0],hip[1]+vy*d,hip[2]+vz*d],
  reachError:Math.abs(d-requested),reachable:Math.abs(d-requested)<.002,
  upper,lower};
}
export const HAULER_MOTIONS=Object.freeze(['idle','walk','turn','brace']);
export function createMovingHauler(config){
 const study=createHaulerConcept(config),id=study.params.id;
 const p=study.params;
 const mechanism={
  dock:{stanceFraction:.76,step:.73,swivel:.033,lean:.007,compression:.022},
  strider:{stanceFraction:.62,step:1.0,swivel:.050,lean:.018,compression:.013},
  crane:{stanceFraction:.68,step:.90,swivel:.061,lean:.015,compression:.016}
 }[id];
 if(!mechanism)throw Error('Unknown articulated Hauler type '+id);
 function pose({motion='idle',phase=0,contacts=false}={}){
  if(!HAULER_MOTIONS.includes(motion))throw Error('Unknown heavy motion '+motion);
  const t=((phase%1)+1)%1,walking=motion==='walk',turning=motion==='turn',
   bracing=motion==='brace';
  const bodyYaw=turning?Math.sin(t*Math.PI*2)*.047:0;
  const bodyZ=walking?Math.sin(t*Math.PI*2)*mechanism.lean:0;
  const bodyY=bracing?-.045:walking?
   -mechanism.compression*(.35+.65*Math.sin(t*Math.PI*4)**2):0;
  const feet=[];
  let maximumReachError=0;
  for(const limb of study.limbs){
   const {leg,hip,knee,ankle,foot,marker}=limb;
   const offset=leg.side>0?.5:0,f=(t+offset)%1;
   const support=f<mechanism.stanceFraction;
   const stride=p.strideDistance*mechanism.step;
   const transfer=support?
    stride*(.5-f/mechanism.stanceFraction):
    stride*(-.5+smooth((f-mechanism.stanceFraction)/(1-mechanism.stanceFraction)));
   const lift=walking&&!support?
    p.lift*Math.sin(Math.PI*smooth((f-mechanism.stanceFraction)/(1-mechanism.stanceFraction))):0;
   const target=[...leg.ankle];
   // Support feet compensate for chassis offset instead of sliding under it.
   target[1]+=(walking?lift:0)-bodyY;
   target[2]+=(walking?transfer:0)-bodyZ;
   if(bracing)target[1]+=.045;
   const solution=solveHeavyLinks(leg.hip,leg.knee,leg.ankle,target);
   maximumReachError=Math.max(maximumReachError,solution.reachError);
   const upper=diff(heading(leg.hip,solution.knee),heading(leg.hip,leg.knee));
   const lower=diff(heading(solution.knee,solution.ankle),heading(leg.knee,leg.ankle))-upper;
   hip.rotation.set(upper,0,0);
   knee.rotation.set(lower,0,0);
   ankle.rotation.set(-upper-lower,0,0);
   foot.rotation.set(0,0,0);
   if(turning){
    const twist=leg.side*mechanism.swivel*Math.sin(t*Math.PI*2);
    hip.rotation.z=twist;
    knee.rotation.z=-twist*.62;
    ankle.rotation.z=-twist*.38;
    foot.rotation.y=-bodyYaw*.25;
   }else{
    hip.rotation.z=knee.rotation.z=ankle.rotation.z=0;
    foot.rotation.y=0;
   }
   marker.visible=contacts;
   marker.material.emissive?.setHex(!walking||support?0x15392a:0x51351e);
   feet.push({side:leg.side,contact:!walking||support?'SUPPORT':'SWING',
    lift,reachError:solution.reachError,clearance:lift,load:!walking||support?1:0});
  }
  updateHaulerActuators(study);
  const actuatorTravel=study.actuators.map(a=>({
   side:a.side,type:a.type,length:a.travel,headAttached:!!a.start.parent,
   rodAttached:!!a.end.parent,
   barrelError:a.barrel.userData.anchorError||0
  }));
  const result={motion,phase:t,bodyY,bodyZ,bodyYaw,
   mechanism:id,maxReachError:maximumReachError,reachError:maximumReachError,
   feet,actuators:actuatorTravel};
  study.root.userData.lastPose=result;
  return result;
 }
 pose();
 return {...study,pose};
}
