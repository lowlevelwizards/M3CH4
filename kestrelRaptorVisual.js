/** Production Kestrel: approved Naked Raptor Scout geometry.
 * Uses the immutable fantasy-first Raptor preset, not the tunable lab state.
 * Preserve the existing legs-compact ID, U1 mount, weight, gameplay IK and saves.
 * Field Kestrel, Perch Runner and all armor recipes remain in the dev lab.
 */
import * as THREE from 'three';
import {candidateById,deriveSilhouette} from './research/kestrelSilhouetteDesign.js';
import {createSilhouetteMachine} from './research/kestrelSilhouetteGeometry.js';
import {groupAt,finishMobilityVisual} from './mobilityVisualKit.js';

const relative=(a,b)=>a.map((n,i)=>n-b[i]);
const paintRoles=new Map([
 [0xab8438,'primary-paint'],[0x6c7861,'secondary-paint'],
 [0xc7baa0,'protective-paint'],[0x579887,'secondary-paint'],
 [0x9d704d,'accent']
]);
function ownFinish(mesh){
 const original=mesh.material;
 const material=original.clone();
 const role=paintRoles.get(original.color?.getHex());
 if(role){
  material.userData.materialRole=role;
  mesh.userData.materialRole=role;
 }
 mesh.material=material;
}
function animatedParent(mesh,side,joints){
 if(!side)return joints.carriage;
 const name=mesh.name.slice(2);
 // Bridge, motor and hip housing stay on the stationary saddle.
 if(/load transfer arm|hip motor nacelle|hip pivot|inset hip bushing/.test(name))
  return joints.carriage;
 // The knee pin and suspension travel with the upper swinging link.
 if(/single swept thigh|rear suspension|knee bearing|knee fastener/.test(name))
  return joints.hip;
 // Shin and outboard ankle bearing follow the lower link.
 if(/primary forward shin|secondary shin rib|ankle turn bearing|ankle inset pivot/.test(name))
  return joints.knee;
 // The ankle-to-foot clevis moves under the ankle pivot.
 if(/foot swivel stalk|ankle fork/.test(name))return joints.ankle;
 if(/landing sole|heel brake|talon|toe/.test(name))return joints.foot;
 throw Error('Unassigned Raptor Scout geometry: '+mesh.name);
}
/** Exact lab Naked meshes, placed in real named live limb pivots.
 * Parenting is the only geometric transformation: rest-world appearance is
 * identical to the approved study, while live animation can drive the joints.
 */
export function buildRaptorScoutKestrel(fixture,layout){
 const design=candidateById('raptor');
 const params=deriveSilhouette(design);
 const study=createSilhouetteMachine(design);
 const root=new THREE.Group();root.name='fit-fixture:legs-compact';
 root.userData={
  fitFixtureId:fixture.id,previewOnly:true,engineeredMobility:true,
  singleFunctionalMobilityInput:true,restPoseOnly:true,
  silhouetteFamily:'reverse-knee-runner',visualDesign:'raptor-scout-naked-v1',
  armorTier:0,prototypeSource:'kestrelSilhouetteDesign:raptor',
 };
 const carriage=groupAt(root,'KESTREL / RAPTOR SCOUT CARRIAGE',[0,0,0]);
 const chain=new Map();
 for(const leg of params.legs){
  const word=leg.side<0?'left':'right';
  const hip=groupAt(carriage,word+'Hip',leg.hip);
  const knee=groupAt(hip,word+'Knee',relative(leg.knee,leg.hip));
  const ankle=groupAt(knee,word+'Ankle',relative(leg.ankle,leg.knee));
  const foot=groupAt(ankle,word+'Foot',relative(leg.foot,leg.ankle));
  for(const [joint,g] of Object.entries({hip,knee,ankle,foot}))
   g.userData={joint,side:leg.side,restPose:0};
  chain.set(leg.side<0?'L':'R',{carriage,hip,knee,ankle,foot,leg});
 }
 for(const item of [...study.root.children]){
  if(!item.isMesh)continue;
  const side=item.name.startsWith('L/')?'L':
    item.name.startsWith('R/')?'R':null;
  const joints=side?chain.get(side):{carriage};
  const parent=animatedParent(item,side,joints);
  study.root.remove(item);
  parent.add(item);
  const leg=joints.leg;
  const origin=parent===joints.hip?leg.hip:
   parent===joints.knee?leg.knee:
   parent===joints.ankle?leg.ankle:
   parent===joints.foot?leg.foot:[0,0,0];
  item.position.sub(new THREE.Vector3(...origin));
  ownFinish(item);
  item.userData.productionKestrel=true;
 }
 // Small static guide receivers preserve the existing U1 secondary location
 // while leaving every approved Raptor body mesh and its silhouette untouched.
 for(const guide of layout.guideReceivers){
  const mesh=new THREE.Mesh(
   new THREE.BoxGeometry(...guide.size),
   new THREE.MeshStandardMaterial({color:0x46564e,roughness:.86,flatShading:true})
  );
  mesh.name='RAPTOR / '+(guide.side<0?'L':'R')+' U1 guide receiver';
  mesh.position.set(...guide.center);
  mesh.castShadow=true;mesh.receiveShadow=true;
  carriage.add(mesh);
 }
 return finishMobilityVisual(root,fixture,layout);
}
