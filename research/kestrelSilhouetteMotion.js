/** Kestrel V2 – a lab-only, rigid-link pose/step solver.
 * All distances are in metres; +Z is backward. Nothing here touches
 * production IK, the catalogue, collision or saved rig formats.
 */
import * as THREE from 'three';
import {createSilhouetteMachine} from './kestrelSilhouetteGeometry.js';

import {calculateKestrelPose,STANCE_IDS,STANCES} from './kestrelSilhouetteKinematics.js';
export {calculateKestrelPose,solveRearHock,STANCE_IDS,STANCES,BASE_FLOOR,GAIT} from './kestrelSilhouetteKinematics.js';
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
