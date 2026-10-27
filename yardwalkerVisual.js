/** M3CH4 Yardwalker: deliberately simple, joint-aware industrial workhorse.
 * Exact geometry source: yardwalker-design/master.json.
 * Generated runtime data: yardwalkerDesignData.js.
 * Joint positions and names are unchanged from mobilityDefinitions.js.
 */
import * as THREE from 'three';
import {YARDWALKER_DESIGN} from './yardwalkerDesignData.js';
import {compileGeometry} from './workbench/geometry.js';
import {YARDWALKER_LAYOUT,validateYardwalkerLayout} from './mobilityDefinitions.js?v=k3a8';
import {MOBILITY_MATERIALS,groupAt,disk,link,finishMobilityVisual} from './mobilityVisualKit.js?v=k3a8';
const design=YARDWALKER_DESIGN;
const coreMaterial=role=>MOBILITY_MATERIALS[role]||MOBILITY_MATERIALS.iron;
function buildShape(s,uniqueMaterial=false){
  const m=coreMaterial(s.material),mesh=new THREE.Mesh(compileGeometry(s.geometry),
    uniqueMaterial?m.clone():m);
  mesh.name=s.name;
  mesh.position.set(...s.position);
  mesh.rotation.set(...s.rotation);
  mesh.castShadow=true;mesh.receiveShadow=true;
  mesh.userData.yardwalkerShapeId=s.id;
  if(m.userData?.materialRole)mesh.userData.materialRole=m.userData.materialRole;
  return mesh;
}
function anchorMap(root,layout){
 const anchors=new Map();
 for(const a of design.anchors){
  const parent=a.parent?anchors.get(a.parent):root;
  if(!parent)throw Error('Invalid Yardwalker parent '+a.parent);
  const name=a.id==='carriage'?'YARDWALKER / WORK-CARRIAGE':a.id;
  const g=groupAt(parent,name,a.position);
  g.rotation.set(...a.rotation);
  if(a.joint)g.userData={joint:a.joint,side:a.side,restPose:0};
  anchors.set(a.id,g);
 }
 for(const leg of layout.legs){
  const word=leg.side<0?'left':'right',hip=anchors.get(word+'Hip'),
    knee=anchors.get(word+'Knee'),ankle=anchors.get(word+'Ankle'),
    foot=anchors.get(word+'Foot');
  const eq=(got,expected)=>got.every((v,i)=>Math.abs(v-expected[i])<.00001);
  const sub=(a,b)=>a.map((v,i)=>v-b[i]);
  if(!eq(hip.position.toArray(),leg.hip)||
     !eq(knee.position.toArray(),sub(leg.knee,leg.hip))||
     !eq(ankle.position.toArray(),sub(leg.ankle,leg.knee))||
     !eq(foot.position.toArray(),sub(leg.foot,leg.ankle)))
    throw Error('Authored Yardwalker anchors drift from canonical IK layout');
 }
 return anchors;
}
/** Default level 0 for the authentic live gameplay model. Armor visuals
 * are explicitly dev-only until the combat armor feature has full hit logic.
 */
export function buildYardwalkerVisual(fixture,layout=YARDWALKER_LAYOUT,{armorTier=0}={}){
 const check=validateYardwalkerLayout(layout,fixture);
 if(!check.valid)throw Error('Invalid Yardwalker engineering sheet: '+check.errors.join(' '));
 const root=new THREE.Group();root.name='fit-fixture:legs-yard';
 root.userData={fitFixtureId:fixture.id,previewOnly:true,engineeredMobility:true,
    singleFunctionalMobilityInput:true,restPoseOnly:true,silhouetteFamily:'utility-walker',
    visualDesign:'yardwalker-simplified-v1'};
 const anchors=anchorMap(root,layout);
 for(const s of design.core){
   const parent=anchors.get(s.parent);
   if(!parent)throw Error('Missing Yardwalker geometry parent '+s.parent);
   parent.add(buildShape(s));
 }
 const tier=Math.max(0,Math.min(3,Math.floor(armorTier)));
 if(tier>0){
  for(const plate of design.armor){
   if(plate.tier>tier)continue;
   const variant=[...plate.variants].reverse().find(v=>v.tier<=tier);
   anchors.get(plate.parent).add(buildShape({...plate,...variant,material:plate.material},true));
  }
 }
 return finishMobilityVisual(root,fixture,layout);
}
/** Dev-only Armor Lab: one removable, joint-parented mesh per armor ID. */
export function buildYardwalkerArmorPlate(root,entry,tier){
 const plate=design.armor.find(a=>a.id===entry.id);
 if(!plate)throw Error('Unknown Yardwalker armor plate '+entry.id);
 const variant=[...plate.variants].reverse().find(v=>v.tier<=tier);
 if(!variant)throw Error('Yardwalker armor tier unavailable: '+entry.id);
 const parent=root.getObjectByName(plate.parent==='carriage'?'YARDWALKER / WORK-CARRIAGE':plate.parent);
 if(!parent)throw Error('Missing articulated armor mount: '+plate.parent);
 const mesh=buildShape({...plate,...variant,material:plate.material},true);
 mesh.name='REMOVABLE ARMOR / '+entry.label;
 mesh.userData.armorPlateId=entry.id;
 mesh.userData.armorRegion=entry.region;
 mesh.userData.armorMaximum=entry.hp;
 mesh.userData.armorBaseColor=mesh.material.color.getHex();
 mesh.userData.armorMountParent=parent.name;
 parent.add(mesh);
 return mesh;
}
/** Preserve the existing unrated frame-side fit guide demonstration. */
export function buildYardwalkerGuideVisuals(plan){
 if(!plan?.ok||plan.bridges.length!==2)throw Error('Invalid Yardwalker guide bridge plan.');
 const root=new THREE.Group();root.name='UNRATED preview-only frame-side guide brackets';
 root.userData={previewOnly:true,unrated:true,notGameplay:true};
 for(const bridge of plan.bridges){
  const word=bridge.side<0?'left':'right',
    cap=bridge.clamp.map((n,i)=>i===0?n+bridge.side*.012:n),
    start=bridge.clamp.map((n,i)=>i===0?n+bridge.side*.025:n);
  disk(root,word+'-boss-clamp',cap,bridge.clampRadius,.025,'bright','x');
  link(root,word+'-fixed-drop-guide',start,bridge.receiver,.088,.105,'charcoal');
 }
 return root;
}
