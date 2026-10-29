/** Three deliberately different, low-detail Kestrel bird-runner prototypes.
 * Sculpted from their mechanical fantasy, not from the old Kestrel mesh.
 * Ground and U1 contacts fixed; NONE of this is a gameplay part or IK.
 */
import * as THREE from 'three';
import {ringGeometry} from './yardwalkerSilhouetteGeometry.js';
import {deriveSilhouette} from './kestrelSilhouetteDesign.js';

const inks={
 yellow:0xab8438,olive:0x6c7861,metal:0x65756d,
 dark:0x303d35,bone:0xc7baa0,foot:0x46564e,
 teal:0x579887,rust:0x9d704d,
};
const mats=Object.fromEntries(Object.entries(inks).map(([name,color])=>[
 name,new THREE.MeshStandardMaterial({color,flatShading:true,roughness:.86,metalness:.12})
]));
const up=new THREE.Vector3(0,1,0),v=a=>new THREE.Vector3(...a);
function add(root,name,geo,mat,pos){
 const mesh=new THREE.Mesh(geo,mats[mat]);mesh.name=name;
 mesh.position.fromArray(pos);mesh.castShadow=true;mesh.receiveShadow=true;
 root.add(mesh);return mesh;
}
function block(root,name,pos,w,h,d,mat,bevel=.05){
 return add(root,name,ringGeometry(w,w,d,d,h,bevel),mat,pos);
}
function beam(root,name,from,to,w1,w2,d1,d2,mat){
 const a=v(from),b=v(to),delta=a.clone().sub(b);
 const obj=add(root,name,
  ringGeometry(w2,w1,d2,d1,delta.length(),.06),mat,
  a.add(b).multiplyScalar(.5).toArray());
 obj.quaternion.setFromUnitVectors(up,delta.normalize());
 return obj;
}
function pin(root,name,pos,r,depth,mat,faces=10){
 const m=add(root,name,new THREE.CylinderGeometry(r,r,depth,faces,1),mat,pos);
 m.rotation.z=Math.PI/2;return m;
}
function footParts(root,name,p,leg){
 const side=leg.side,point=leg.foot;
 const fw=p.footWidth,fd=p.footDepth;
 block(root,name+'/tapered landing sole',point,fw,p.footHeight,fd,'foot',.045);
 // A heel shoe is one narrow functional stabilizer, not a pile of blocks.
 block(root,name+'/heel brake',
  [point[0],point[1]+.012,point[2]+fd*.31],
  fw*.72,.07,fd*.20,'metal',.025);
 const toeFront=point[2]-fd*.54;
 if(p.id==='raptor'){
  // One split wedge with an obvious center slot, pointed without claws.
  for(const sign of [-1,1]){
   const x=point[0]+sign*fw*.22;
   beam(root,name+'/sharp field talon '+sign,
    [x,point[1]+.056,point[2]-fd*.19],
    [x+sign*.012,point[1]+.043,toeFront],
    fw*.34,fw*.27,fd*.27,fd*.20,'bone');
  }
 }else if(p.id==='field'){
  for(const sign of [-1,1]){
   const x=point[0]+sign*fw*.24;
   beam(root,name+'/split traction toe '+sign,
    [x,point[1]+.06,point[2]-fd*.19],
    [x+sign*p.toeSplay*.24,point[1]+.042,toeFront],
    fw*.39,fw*.32,fd*.25,fd*.19,'bone');
  }
 }else{
  // Perch Runner has more splayed landing points, with an open central cut.
  for(const sign of [-1,1]){
   const heel=[point[0]+sign*fw*.17,point[1]+.06,point[2]-fd*.16];
   const tip=[point[0]+sign*(fw*.32+p.toeSplay*.24),
    point[1]+.046,toeFront-.02];
   beam(root,name+'/wide perching toe '+sign,heel,tip,
    fw*.30,fw*.23,fd*.29,fd*.19,'bone');
  }
 }
}
export function createSilhouetteMachine(raw){
 const p=deriveSilhouette(raw),root=new THREE.Group();
 root.name='KESTREL STUDY / '+p.id;
 root.userData={prototypeOnly:true,noSave:true,notGameplay:true,armorTier:0,
  id:p.id,mount:p.mount,ground:p.floor};
 // Original compact receiver: same interface for all three concepts.
 block(root,'U1 compact mounting pad',[0,.7575,0],.34,.035,.24,'metal',.02);
 block(root,'single compact transmission case',[0,.666,.025],.39,.16,.245,'dark',.05);
 block(root,'thin cross-carriage',[0,.601,.03],
  Math.min(1.07,p.hipSpan+.16),.108,p.carriageDepth,'yellow',.035);
 for(const leg of p.legs){
  const side=leg.side,tag=side<0?'L':'R';
  const hip=leg.hip,knee=leg.knee,ankle=leg.ankle;
  const hWidth=p.thighMass,shinW=p.shinMass;
  // An engineered compact rotary carrier, NOT a huge cylindrical bucket.
  beam(root,tag+'/load transfer arm',
    [side*.205,.604,.025],[hip[0],hip[1]+.095,hip[2]],
    .15,.18,.17,.20,'yellow');
  block(root,tag+'/hip motor nacelle',
   [hip[0],hip[1]+.035,hip[2]],
   hWidth*1.03,.215,p.carriageDepth*.90,'olive',.046);
  pin(root,tag+'/hip pivot',hip,p.id==='field'?.112:.102,.045,'dark',10);
  pin(root,tag+'/inset hip bushing',
    [hip[0]+side*(hWidth*.53+.020),hip[1],hip[2]],
    .057,.019,'teal',10);
  // One shaped main thigh beam following the exaggerated backward hock.
  const a=[hip[0],hip[1]-.068,hip[2]+.015];
  const b=[knee[0],knee[1]+.055,knee[2]-.027];
  const hi=p.id==='field'?hWidth*1.08:p.id==='perch'?hWidth*.88:hWidth*.92;
  beam(root,tag+'/single swept thigh',a,b,hi,hWidth*.69,
   p.id==='raptor'?.245:.275,.19,'olive');
  // A single exposed linkage to explain the compression/spring action.
  // Keep it offset at the BACK of thigh, so it does not z-fight with casting.
  const shaftTop=[hip[0]+side*hWidth*.40,hip[1]-.09,hip[2]+.185];
  const shaftBot=[knee[0]+side*hWidth*.36,knee[1]+.095,knee[2]+.10];
  beam(root,tag+'/rear suspension rod',shaftTop,shaftBot,
   .044,.039,.048,.044,'metal');
  pin(root,tag+'/rear suspension clevis',shaftBot,.050,.040,'dark',8);
  // Compact two-cheek knee. Keep visual gap to preserve bent-leg silhouette.
  pin(root,tag+'/knee bearing',knee,p.id==='field'?.108:.100,
   hWidth*.78,'dark',10);
  pin(root,tag+'/knee fastener',
    [knee[0]+side*(hWidth*.39+.017),knee[1],knee[2]],
    .047,.018,'rust',8);
  // The long, powerful forward-reaching shin is the dominant avian line.
  const shina=[knee[0],knee[1]-.073,knee[2]-.025];
  const shinb=[ankle[0],ankle[1]+.054,ankle[2]+.015];
  const topW=shinW*(p.id==='perch'?1.13:1.08);
  beam(root,tag+'/primary forward shin',shina,shinb,
    topW,shinW*.78,.225,.155,'bone');
  // Side cheek is a separate bolted extrusion, with intentionally open space.
  if(p.id==='field'){
   const upper=[knee[0]+side*shinW*.48,knee[1]-.095,knee[2]-.055];
   const lower=[ankle[0]+side*shinW*.46,ankle[1]+.16,ankle[2]+.045];
   beam(root,tag+'/secondary shin rib',upper,lower,
    .042,.036,.075,.070,'metal');
  }
  pin(root,tag+'/ankle turn bearing',ankle,.072,.14,'dark',10);
  pin(root,tag+'/ankle inset pivot',
    [ankle[0]+side*.080,ankle[1],ankle[2]],.038,.017,'teal',8);
  beam(root,tag+'/foot swivel stalk',
    [ankle[0],ankle[1]-.033,ankle[2]],
    [leg.foot[0],leg.foot[1]+.070,leg.foot[2]+.005],
    .115,.133,.12,.16,'metal');
  // A pair of exposed ankle cheeks explains where the foot actually pivots.
  // Small, separated from the central swivel stalk, and deliberately not armor.
  for(const sign of [-1,1]){
   const offset=sign*(.070+shinW*.13);
   beam(root,tag+'/ankle fork '+sign,
    [ankle[0]+offset,ankle[1]-.025,ankle[2]-.014],
    [leg.foot[0]+offset,leg.foot[1]+.077,leg.foot[2]+.015],
    .033,.028,.058,.050,'dark');
  }
  footParts(root,tag,p,leg);
 }
 return {root,params:p};
}
