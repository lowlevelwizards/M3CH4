/** Production Naked Yardwalker based on the approved Industrial Strider study.
 * Preserves the legacy legs-yard catalogue ID, U1 contact, saved serials,
 * physics and live hip/knee/ankle/foot articulation contract.
 * Armor variants belong in the research lab and are intentionally excluded.
 */
import * as THREE from 'three';
import {candidateById,deriveSilhouette} from './research/yardwalkerSilhouetteDesign.js';
import {createSilhouetteMachine} from './research/yardwalkerSilhouetteGeometry.js';
import {groupAt,finishMobilityVisual} from './mobilityVisualKit.js';

const diff=(a,b)=>a.map((v,i)=>v-b[i]);
const paintRoles=new Map([
 [0xb38a37,'primary-paint'],[0x75816a,'secondary-paint'],
 [0xa66d4f,'accent'],[0xc9c2a8,'protective-paint']
]);
function ownedMaterial(mesh){
 const color=mesh.material.color?.getHex();
 const mat=mesh.material.clone();
 const role=paintRoles.get(color);
 if(role){mat.userData.materialRole=role;mesh.userData.materialRole=role;}
 mesh.material=mat;
}
function parentFor(name,side,groups){
 const lead=side+'/';
 if(!name.startsWith(lead))return groups.carriage;
 const tail=name.slice(lead.length);
 if(/load spreading boot|single replaceable toe shoe|heel stabilizer/.test(tail))return groups.foot;
 if(/ankle clevis|ankle boot root/.test(tail))return groups.ankle;
 if(/shin load member|visible steel knee pin|recessed fastener|actuator lower boss/.test(tail))
  return groups.knee;
 if(/upper principal casting|knee fork|mounted hydraulic body|actuator upper boss/.test(tail))
  return groups.hip;
 return groups.carriage;
}
/** The lab and live model use the *same* naked primitive source.
 * Only the hierarchy changes: fixed body -> hip -> knee -> ankle -> foot.
 */
export function buildIndustrialStriderYardwalker(fixture,layout){
 const p=deriveSilhouette(candidateById('strider'));
 const study=createSilhouetteMachine(candidateById('strider'),{tier:0});
 const root=new THREE.Group();root.name='fit-fixture:legs-yard';
 root.userData={
  fitFixtureId:fixture.id,previewOnly:true,engineeredMobility:true,
  singleFunctionalMobilityInput:true,restPoseOnly:true,
  silhouetteFamily:'utility-walker',visualDesign:'industrial-strider-naked-v1',
  armorTier:0,prototypeSource:'yardwalkerSilhouetteDesign:strider'
 };
 const carriage=groupAt(root,'YARDWALKER / WORK-CARRIAGE',[0,0,0]);
 const legGroups=new Map();
 for(const leg of p.legs){
  const side=leg.side<0?'left':'right';
  const hip=groupAt(carriage,side+'Hip',leg.hip);
  const knee=groupAt(hip,side+'Knee',diff(leg.knee,leg.hip));
  const ankle=groupAt(knee,side+'Ankle',diff(leg.ankle,leg.knee));
  const foot=groupAt(ankle,side+'Foot',diff(leg.foot,leg.ankle));
  for(const [joint,g] of Object.entries({hip,knee,ankle,foot}))
   g.userData={joint,side:leg.side,restPose:0};
  legGroups.set(leg.side<0?'L':'R',{carriage,hip,knee,ankle,foot,leg});
 }
 // All study geometry starts in the carriage coordinate system. Reparent to
 // animated joints with exact rest-world transforms, preserving every visible
 // chamfer, angle, boot and hydraulic detail.
 for(const item of [...study.root.children]){
  if(!item.isMesh)continue;
  const side=item.name.startsWith('L/')?'L':
   item.name.startsWith('R/')?'R':null;
  const groups=side?legGroups.get(side):{carriage};
  const parent=parentFor(item.name,side,groups);
  study.root.remove(item);
  parent.add(item);
  let centre=[0,0,0];
  if(parent!==carriage){
   const l=groups.leg;
   if(parent===groups.hip)centre=l.hip;
   else if(parent===groups.knee)centre=l.knee;
   else if(parent===groups.ankle)centre=l.ankle;
   else centre=l.foot;
  }
  item.position.sub(new THREE.Vector3(...centre));
  ownedMaterial(item);
  item.userData.productionYardwalker=true;
 }
 // Preserve the declared U1 crown contact exactly. The experimental
 // source was 2.5 mm proud of the catalogue mating plane.
 const top=carriage.getObjectByName('U1 top mount');
 if(!top)throw Error('Industrial Strider top interface missing');
 top.scale.y=.965;top.position.y-=.0005;
 // Two unobtrusive fixed receiver faces complete the existing U1 frame fit.
 for(const guide of layout.guideReceivers){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(.085,.088,.17),
    new THREE.MeshStandardMaterial({color:0x48574f,flatShading:true,roughness:.88}));
  mesh.name='STRIDER / '+(guide.side<0?'L':'R')+' U1 frame guide';
  mesh.position.set(...guide.center);
  mesh.castShadow=true;mesh.receiveShadow=true;
  carriage.add(mesh);
 }
 return finishMobilityVisual(root,fixture,layout);
}
