/** Three disposable low-poly walkers for side-by-side scale evaluation.
 * These are NOT runtime mobility builders, IK, hitboxes or replacement JSON.
 */
import * as THREE from 'three';
import {deriveSilhouette} from './yardwalkerSilhouetteDesign.js';
import {addArmorToLeg,normalizeArmor} from './yardwalkerSilhouetteArmor.js';
const palette={
 ochre:0xb38a37,olive:0x75816a,iron:0x48574f,steel:0x899089,
 dark:0x26332e,rust:0xa66d4f,cream:0xc9c2a8,foot:0x556157,
};
const materials=Object.fromEntries(Object.entries(palette).map(([name,color])=>[name,
  new THREE.MeshStandardMaterial({color,flatShading:true,roughness:.88,metalness:.13})]));
const v=a=>new THREE.Vector3(...a),middle=(a,b)=>a.clone().add(b).multiplyScalar(.5);
function meshAt(parent,name,geom,role,position){
 const mesh=new THREE.Mesh(geom,materials[role]);
 mesh.name=name;mesh.position.copy(position);mesh.castShadow=true;mesh.receiveShadow=true;
 parent.add(mesh);return mesh;
}
/** Closed bevelled octagonal prism, winding OUTWARD on every face.
 * Default FrontSide culling should reveal the exterior, never the inside.
 * Exposed for browser geometry regression checks.
 */
export function ringGeometry(bottomW,topW,depthB,depthT,length,cut=.13){
 const pts=[],idx=[];
 for(const [y,w,d] of [[-length/2,bottomW,depthB],[length/2,topW,depthT]]){
  const x=w/2,z=d/2,c=Math.min(w*.22,d*.22,cut);
  pts.push(...[
   [-x+c,y,-z],[x-c,y,-z],[x,y,-z+c],[x,y,z-c],
   [x-c,y,z],[-x+c,y,z],[-x,y,z-c],[-x,y,-z+c]
  ].flat());
 }
 // Ring order runs from front-left to front-right around X/Z.
 // With Y as the up axis, the old a,b,d winding pointed INTO the prism.
 // Reverse both wall triangles and the top/bottom cap fans (not DoubleSide).
 for(let k=0;k<8;k++){const a=k,b=(k+1)%8,c=k+8,d=(k+1)%8+8;
  idx.push(a,d,b,a,c,d);}
 for(let k=1;k<7;k++){idx.push(0,k,k+1);idx.push(8,8+k+1,8+k);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pts,3));
 g.setIndex(idx);g.computeVertexNormals();g.userData.yardwalkerPrism=true;return g;
}
function link(parent,name,a,b,wTop,wBottom,dTop,dBottom,role){
 const top=v(a),bottom=v(b),dir=top.clone().sub(bottom),len=dir.length();
 const m=meshAt(parent,name,ringGeometry(wBottom,wTop,dBottom,dTop,len),
  role,middle(top,bottom));m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir.normalize());
 return m;
}
function block(parent,name,pos,size,role,cut=.10){
 const [w,h,d]=size;return meshAt(parent,name,ringGeometry(w,w,d,d,h,cut),
  role,v(pos));
}
function disk(parent,name,pos,r,length,role,axis='x',sides=10){
 const obj=meshAt(parent,name,new THREE.CylinderGeometry(r,r,length,sides,1),
  role,v(pos));
 if(axis==='x')obj.rotation.z=Math.PI/2;
 if(axis==='z')obj.rotation.x=Math.PI/2;
 return obj;
}
function contact(parent,name,pos,w,d,role){
 const g=ringGeometry(w*.92,w,d*.98,d,.085,.04);
 return meshAt(parent,name,g,role,v(pos));
}
/** Returns isolated, preview-only assembly rooted at the nominal Yardwalker slot
 * center. No production shape reuse, making these three *actual* fresh studies.
 */
export function createSilhouetteMachine(raw,armorSettings={}){
 const p=deriveSilhouette(raw),armor=normalizeArmor(armorSettings.tier??armorSettings.armorTier,armorSettings.style??armorSettings.armorStyle,armorSettings.bootPlate);
 const root=new THREE.Group();root.name='STUDY / '+p.title;
 root.userData={prototypeOnly:true,noSave:true,notGameplay:true,id:p.id,
  mount:p.mount,ground:p.floor,armorTier:armor.tier,armorStyle:armor.style};
 // Substantial central load knot + diverging cast transfer arms (not goalposts).
 block(root,'U1 top mount',[0,.770,0],[.44,.115,.35],'steel');
 block(root,'deep load knuckle',[0,.645,.005],[.72,.23,p.carriageDepth],'iron');
 for(const leg of p.legs){
  const side=leg.side,s=side<0?'L':'R';
  const hip=leg.hip,knee=leg.knee,ankle=leg.ankle,foot=leg.foot;
  const branch=[hip[0]*.57,.58,.025];
  link(root,s+'/diagonal load return',branch,hip,
    .21,.25,p.carriageDepth*.76,p.carriageDepth*.93,'ochre');
  block(root,s+'/root shoulder',[hip[0],hip[1]+.052,hip[2]],
    [p.thighMass*1.15,.29,p.carriageDepth*1.17],'iron',.065);
  // The thigh is ONE dominant load-bearing casting, not a stack of boxes.
  const thigh=link(root,s+'/upper principal casting',
    [hip[0],hip[1]-.07,hip[2]],
    [knee[0],knee[1]+.037,knee[2]],
    p.thighMass*1.16,p.thighMass*.80,
    p.id==='bruiser'?.52:p.id==='hound'?.36:.34,
    p.id==='bruiser'?.38:p.id==='hound'?.27:.28,'olive');
  // Two real clevis cheek faces flank the knee axle.
  const kx=knee[0],kr=p.id==='bruiser'?.15:p.id==='strider'?.13:.125;
  for(const sign of [-1,1]){
   disk(root,s+'/knee fork '+sign,[kx+sign*(p.thighMass*.40),knee[1],knee[2]],
     kr,.038,'iron');
  }
  disk(root,s+'/visible steel knee pin',[kx+side*(p.thighMass*.46),knee[1],knee[2]],
    kr*.61,.047,'steel');
  disk(root,s+'/recessed fastener',[kx+side*(p.thighMass*.49+.024),knee[1],knee[2]],
    kr*.27,.016,'rust');
  // An intentionally different lower structure for each family.
  const shin=link(root,s+'/shin load member',
    [knee[0],knee[1]-.058,knee[2]],
    [ankle[0],ankle[1]+.044,ankle[2]],
    p.shinMass*(p.id==='bruiser'?1.35:1.11),p.shinMass*.94,
    p.id==='bruiser'?.36:.25,p.id==='hound'?.31:.25,'olive');
  disk(root,s+'/ankle clevis',ankle,.092,.20,'iron');
  const ankleTop=[ankle[0],ankle[1]-.032,ankle[2]];
  link(root,s+'/ankle boot root',ankleTop,[foot[0],foot[1]+.082,foot[2]],
   .19,.25,.18,.21,'steel');
  // One large boot, broad heel and integrated top toe; no two slipper bars.
  const footWidth=p.footWidth,footDepth=p.footDepth;
  const boot=block(root,s+'/load spreading boot',foot,
    [footWidth,p.footHeight,footDepth],'foot',.07);
  const toe=[foot[0],foot[1]+.030,foot[2]-footDepth*.39];
  contact(root,s+'/single replaceable toe shoe',toe,footWidth*.82,footDepth*.21,'cream');
  if(p.id==='bruiser'){
    block(root,s+'/heel stabilizer',
      [foot[0],foot[1]+.054,foot[2]+footDepth*.37],
      [footWidth*.83,.12,.18],'iron',.035);
  }
  // A visible, believable hydraulic stage aligned to a continuous upper member.
  const top=[hip[0]+side*(p.thighMass*.52),hip[1]-.12,hip[2]+.16];
  const bottom=[knee[0]+side*(p.thighMass*.47),knee[1]+.105,knee[2]+.12];
  link(root,s+'/mounted hydraulic body',top,bottom,
    .085,.067,.087,.069,'dark');
  disk(root,s+'/actuator upper boss',top,.072,.065,'steel');
  disk(root,s+'/actuator lower boss',bottom,.070,.065,'steel');
  // Armor is constructed AFTER the Naked assembly, mounted to each actual
  // canted limb rather than to independent world-space positions.
  const thighProfile={length:v([hip[0],hip[1]-.07,hip[2]]).distanceTo(v([knee[0],knee[1]+.037,knee[2]])),
    topW:p.thighMass*1.16,bottomW:p.thighMass*.80,
    topD:p.id==='bruiser'?.52:p.id==='hound'?.36:.34,
    bottomD:p.id==='bruiser'?.38:p.id==='hound'?.27:.28};
  const shinProfile={length:v([knee[0],knee[1]-.058,knee[2]]).distanceTo(v([ankle[0],ankle[1]+.044,ankle[2]])),
    topW:p.shinMass*(p.id==='bruiser'?1.35:1.11),bottomW:p.shinMass*.94,
    topD:p.id==='bruiser'?.36:.25,bottomD:p.id==='hound'?.31:.25};
  addArmorToLeg({leg,thigh,shin,boot,thighProfile,shinProfile,footWidth,footDepth},armor);
 }
 return {root,params:p};
}
