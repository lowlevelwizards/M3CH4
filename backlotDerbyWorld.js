/** Backlot Dustbowl: true compound tractor/loader steel.
 * Original obstacle group identities remain authored in maps/backlot.js.
 * The rebuilt tractor/loader receive shared physical collision sub-prisms;
 * other cover retains its existing single certified AABB.
 * Navigation, locomotion, AI LOS and ballistics all use those exact parts.
 */
import * as THREE from 'three';
import {buildBacklotTerrainAndFacilities} from './backlotEnvironmentPass.js';
import {buildBacklotObstacleKit} from './backlotObstacleKits.js';
import {buildAnatomicalTractor} from './backlotAnatomicalTractor.js';
import {buildAnatomicalLoader,MACHINE_EXHIBITS} from './backlotAnatomicalMachines.js';
import {SALVAGE_EXHIBITS} from './backlotAnatomicalSalvage.js';
import {upgradeBacklotScenery} from './backlotSceneryAnatomy.js';
import {upgradeBacklotSecondaryProps} from './backlotSecondaryAnatomy.js';
import {auditBacklotCollisionTruth,secondaryGeometryClearance} from './backlotCollisionCertificate.js';
import {auditBacklotAssembly} from './backlotAssemblyAudit.js';
import {collisionPieces,isCompoundObstacle} from './backlotCompoundGeometry.js';

const P={dirt:0x796044,darkDirt:0x443b30,rust:0x855137,rust2:0xa16d46,
  steel:0x303c3c,iron:0x4c554f,cream:0xb2a07e,yellow:0xc09a4e,
  tyre:0x282b29,wood:0x705339,rope:0x968467,canvas:0xb99a66,
  motor:0x515a52,glass:0x405d60};
const mats=new Map(),boxes=new Map(),cylinders=new Map();
function mat(c,metal=.14,emission=0){
  const key=c+':'+metal+':'+emission;
  if(!mats.has(key))mats.set(key,new THREE.MeshStandardMaterial({
    color:c,roughness:.9,metalness:metal,flatShading:true,
    emissive:emission?c:0,emissiveIntensity:emission,
  }));
  return mats.get(key);
}
function boxGeo(w,h,d){
 const key=[w,h,d].map(x=>x.toFixed(2)).join(',');
 if(!boxes.has(key))boxes.set(key,new THREE.BoxGeometry(w,h,d));
 return boxes.get(key);
}
function block(parent,name,w,h,d,x,y,z,color,metal=0.2){
 // Share a unit cube and encode dimensions into the transform. Static
 // details of unlike sizes can then be instanced as one draw batch.
 const o=new THREE.Mesh(boxGeo(1,1,1),mat(color,metal));
 o.name=name;o.position.set(x,y,z);o.scale.set(w,h,d);o.receiveShadow=true;
 o.castShadow=false;parent.add(o);return o;
}
function drum(parent,name,r,length,x,y,z,color,axis='z',segments=10){
 // Radius/length live on the instance transform so hundreds of wheels and
 // barrels can share ONE low-poly cylinder mesh (per side count).
 const key=String(segments);
 if(!cylinders.has(key))cylinders.set(key,new THREE.CylinderGeometry(1,1,1,segments));
 const o=new THREE.Mesh(cylinders.get(key),mat(color,.32));
 o.name=name;o.position.set(x,y,z);o.scale.set(r,length,r);
 if(axis==='x')o.rotation.z=Math.PI/2;
 if(axis==='z')o.rotation.x=Math.PI/2;
 o.castShadow=false;o.receiveShadow=true;parent.add(o);return o;
}
function seeded(){let n=0x56584c41;return ()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};}
let dirtTexture=null,skyTexture=null;
export function backlotGroundTexture(){
 if(dirtTexture)return dirtTexture;
 const c=document.createElement('canvas');c.width=c.height=256;
 const g=c.getContext('2d'),r=seeded();
 g.fillStyle='#786046';g.fillRect(0,0,256,256);
 for(let i=0;i<4700;i++){
  const x=r()*256,y=r()*256,s=1+r()*5;
  g.fillStyle=r()<.4?'#594736':r()<.67?'#927450':'#a48b61';
  g.globalAlpha=.11+r()*.28;g.fillRect(x,y,s,s*.52);
 }
 g.globalAlpha=.23;
 for(let i=0;i<90;i++){
  const x=r()*256,y=r()*256;
  g.fillStyle=i%3?'#47392e':'#a08a62';
  g.beginPath();g.ellipse(x,y,2+r()*7,1+r()*2,r()*Math.PI,0,Math.PI*2);g.fill();
 }
 g.globalAlpha=1;
 dirtTexture=new THREE.CanvasTexture(c);
 dirtTexture.wrapS=dirtTexture.wrapT=THREE.RepeatWrapping;
 dirtTexture.repeat.set(13,11);dirtTexture.colorSpace=THREE.SRGBColorSpace;
 dirtTexture.magFilter=dirtTexture.minFilter=THREE.NearestFilter;
 return dirtTexture;
}
export function setBacklotOpenSky(scene){
 if(!skyTexture){
  const c=document.createElement('canvas');c.width=16;c.height=256;
  const g=c.getContext('2d'),grad=g.createLinearGradient(0,0,0,256);
  grad.addColorStop(0,'#8daaad');grad.addColorStop(.48,'#bed0bd');
  grad.addColorStop(.77,'#dfbd91');grad.addColorStop(1,'#c6a575');
  g.fillStyle=grad;g.fillRect(0,0,16,256);
  skyTexture=new THREE.CanvasTexture(c);skyTexture.colorSpace=THREE.SRGBColorSpace;
  skyTexture.magFilter=THREE.LinearFilter;
 }
 scene.background=skyTexture;
 scene.fog=new THREE.FogExp2(0xc5ad8d,.0048);
}
/** Object-part geometry is what the AI and live gun rays actually collide
 * with. Every solid box is exactly the corresponding authored AABB; the
 * details are stamped on real metal faces, not floating invented cover.
 * Replacing the old four warehouse-like monoliths with real small parts is
 * what creates the new silhouette and tactical openings.
 */
function physicalScrapPart(root,o,solids){
 const w=o.maxX-o.minX,d=o.maxZ-o.minZ,h=o.height,
       x=(o.minX+o.maxX)/2,z=(o.minZ+o.maxZ)/2;
 const role=o.art;
 const wheel=/wheel|track/.test(role),cab=/cab/.test(role),
       scoop=role==='loader-scoop',
       mechanical=/engine|gearcase/.test(role),
       color=wheel?P.tyre:cab?P.rust2:scoop?P.iron:
         mechanical?P.motor:role==='tractor-bonnet'?P.yellow:P.rust;
 const mass=block(root,'certified-machine-part-'+o.id,w,h,d,x,h*.5,z,color,.38);
 mass.userData.arenaObstacleId=o.id;
 mass.userData.machineRole=role;
 solids.push(mass);
 // A narrow contrasting patch lies immediately on the true front surface;
 // unlike the former full-width false facades it remains within that AABB.
 const front=o.maxZ+.011;
 if(cab){
   // The high, rusty glazed operator cab rises above the low engine deck.
   block(root,'cab-shadow-windshield',w*.70,h*.32,.025,
     x,h*.68,front,P.glass,.19);
   block(root,'cab-bright-windshield-crossbar',w*.74,.10,.025,
     x,h*.80,front+.015,P.iron,.48);
   block(root,'cab-stripe',w*.74,.15,.027,
     x,h*.35,front+.015,P.cream,.18);
   block(root,'cab-exhaust-chimney',.19,.36,.19,
     x+w*.31,h+.17,z-d*.17,P.steel,.42);
 }else if(wheel){
   // Cut a large circular disk into the visible side of each dark rubber
   // blocker. The actual tire block is independently traversable around.
   const radius=Math.min(h*.46,d*.43);
   const face=x+(o.id.endsWith('fr')||o.id.endsWith('rr')?w*.5+.008:
     -w*.5-.008);
   drum(root,'wheel-rusty-bearing',radius*.42,.035,
      face,h*.5,z,P.rust,'x',10);
   block(root,'tyre-shoulder-crease',.05,.13,d*.78,
      x,h*.78,z,P.steel,.26);
 }else if(scoop){
   block(root,'bucket-tooth-row',w*.90,.16,.22,
      x,.17,front-.18,P.yellow,.29);
   block(root,'scoop-rim',w*.90,.13,.10,
      x,h-.14,front-.09,P.rust2,.31);
   block(root,'bucket-shadow',w*.84,h*.32,.03,
      x,h*.43,front,P.steel,.49);
 }else if(mechanical){
   block(root,'engine-joint-head',w*.70,.14,d*.62,
     x,h-.11,z,P.rust2,.38);
   const count=w>3?3:2;
   for(let i=0;i<count;i++)
     block(root,'visible-machinery-rib',w/(count*3),h*.66,.08,
       x+w*((i+.5)/count-.5),h*.48,front,P.steel,.45);
 }else{
   block(root,'steel-scrap-edge',w*.80,.13,.09,
     x,h-.11,front-.13,P.cream,.18);
   block(root,'machinery-service-hatch',w*.50,h*.22,.025,
     x,h*.48,front,P.steel,.35);
 }
 return mass;
}
/** Exactly the same compound prisms consumed by locomotion, AI and
 * coverTruth are raycast directly. They are kept OUT of the scene graph:
 * no invisible render geometry, no unnecessary WebGL calls, no shadows.
 * The beautifully detailed models supply the visible surface.
 */
function physicalCompoundPart(o,solids){
 for(const prism of collisionPieces(o)){
  const w=prism.maxX-prism.minX,d=prism.maxZ-prism.minZ,
    h=prism.maxY-(prism.minY??0);
  const hit=new THREE.Mesh(boxGeo(1,1,1),mat(P.iron,.26));
  hit.name='real-compound-collider-'+prism.partId;
  hit.position.set((prism.minX+prism.maxX)/2,
    (prism.minY??0)+h/2,(prism.minZ+prism.maxZ)/2);
  hit.scale.set(w,h,d);
  hit.userData.arenaObstacleId=o.id;
  hit.userData.compoundPartId=prism.partId;
  hit.userData.physicalOnly=true;
  hit.updateMatrixWorld(true);
  // Deliberately DO NOT add to root. The scene's solids[] raycaster
  // continues to test this object without rendering phantom surfaces.
  solids.push(hit);
 }
}
function addLiveMechanicalAnatomy(root){
 const tractor=buildAnatomicalTractor(root);
 tractor.name='LIVE compound rebuilt tractor';
 tractor.position.set(-4.07,0,-1.65);
 tractor.scale.set(1.32,1,1.23);
 const loader=buildAnatomicalLoader(root);
 loader.name='LIVE compound rebuilt tracked loader';
 loader.position.set(5.08,0,.43);
 loader.scale.set(1.12,1,.92);
 return {tractor,loader};
}
/** Visible metal/wood mass intentionally fills each gameplay obstacle prism:
 * none of the ornament changes cover, routes, or hit tests.
 */
function createWreck(parent,o,solids){
 if(o.artKit){
   buildBacklotObstacleKit(parent,o,solids,{block,drum,mat,P});
   return;
 }
 if(o.art){physicalScrapPart(parent,o,solids);return;}
 const w=o.maxX-o.minX,d=o.maxZ-o.minZ,h=o.height??1.1;
 const x=(o.minX+o.maxX)/2,z=(o.minZ+o.maxZ)/2,id=o.id;
 const pillar=o.kind==='pillar';
 const tractor=/tractor/.test(id),loader=/loader|implement/.test(id),
       engine=/engine|flywheel/.test(id),tyres=/tyres|axles/.test(id);
 let baseColor=pillar?P.iron:tractor?P.rust:loader?P.yellow:
   engine?P.motor:tyres?P.tyre:id.includes('plate')?P.rust2:P.wood;
 // The full certified prism remains exactly where navigation and ballistics
 // expect it; detailed hull geometry replaces the former giant opaque cube.
 // Its invisible raycast proxy is NOT a second collider or fake cover.
 const mass=block(parent,'physical-wreck-'+id,w,h,d,x,h/2,z,baseColor,.34);
 mass.userData.arenaObstacleId=id;
 solids.push(mass);
 if(tractor||loader||engine||tyres){
   // All bullet-stopping surface area stays *visible*. A hidden oversized
   // prism would let shots spark against thin air between wheels or cab struts.
   // Each face is a patchwork salvaged-metal surface; the raised machinery
   // detail over it supplies the distinct vehicle silhouette.
   const main=mat(baseColor,.32),worn=mat(tractor?P.rust2:loader?P.rust:P.iron,.28);
   const oil=mat(P.steel,.35),scuffed=mat(tractor?P.iron:P.rust,.3);
   mass.material=[worn,main,scuffed,main,oil,worn];
   mass.userData.certifiedVisibleShell=true;
 }
 if(tractor||loader){
   // Wheel arch, raised bonnet, asymmetric cab and blunt armored radiator
   // form a recognizable drivable machinery profile at first-person height.
   const bodyH=Math.min(h*.56,1.75);
   const chassis=block(parent,'wreck-mass-chassis',w*.96,bodyH,d*.86,
     x,bodyH*.50,z,tractor?P.rust:P.yellow,.27);
   chassis.castShadow=true;
   block(parent,'crushed-cab-body',w*.68,h*.44,d*.44,
     x,h*.75,z+d*.22,P.iron,.32).castShadow=true;
   block(parent,'grille-slat-bed',w*.76,h*.34,.16,
     x,h*.35,z-d*.423,P.steel,.43);
   for(let k=-2;k<=2;k++){
     block(parent,'vertical-radiator-slat',w*.084,h*.28,.052,
       x+k*w*.125,h*.36,z-d*.435,P.rust2,.35);
   }
   for(const side of [-1,1]){
     block(parent,'broken-side-skirting',.12,bodyH*.74,d*.78,
       x+side*w*.47,bodyH*.43,z,P.steel,.44);
     block(parent,'cab-opaque-armored-window',.08,h*.25,d*.25,
       x+side*w*.34,h*.79,z+d*.235,P.glass,.20);
     drum(parent,'agricultural-axle-joint',.24,.15,
       x+side*w*.43,.49,z-d*.14,P.iron,'x',8);
   }
   block(parent,'dented-overhung-cab-roof',w*.76,.17,d*.57,
     x,h-.08,z+d*.18,tractor?P.rust2:P.iron,.34).rotation.z=.035;
   if(tractor)for(const side of [-1,1]){
     drum(parent,'tractor-hydraulic-riser',.10,h*.22,
       x+side*w*.23,h*.87,z,P.steel,'y',7);
   }
 }else if(engine||id==='coupling-spine'){
   block(parent,'heavy-cast-engine-core',w*.9,h*.80,d*.82,
     x,h*.4,z,P.motor,.44).castShadow=true;
   for(let k=-2;k<=2;k++)
     block(parent,'external-cylinder-bank',w*.10,h*.64,d*.53,
       x+k*w*.17,h*.56,z,P.rust,.40);
 }else if(tyres){
   block(parent,'axle-rack-chassis',w*.91,h*.43,d*.81,
     x,h*.31,z,P.iron,.39).castShadow=true;
   for(const dz of [-d*.30,d*.30]){
     drum(parent,'scrap-rack-rolling-tyre',Math.min(.72,h*.26),.48,
       x,h*.72,z+dz,P.tyre,'z',9);
   }
 }


 if(pillar){
   // Four actual in-arena collision columns: preserve their opaque AABBs.
   // Compose believable floodlight towers on those certified columns, not
   // on the o.art-only machine path (the pillars do not carry art tags).
   for(const yy of [h*.29,h*.63,h*.87])
    block(parent,'arena-light-structural-mast-collar',w*.91,.19,d*.91,
      x,yy,z,P.rust2,.36);
   block(parent,'arena-light-maintenance-junction-box',w*.72,.75,d*.70,
      x,1.45,z+d*.39,P.steel,.29);
   for(const dx of [-.72,.72]){
    const strut=block(parent,'arena-light-outboard-brace',.16,1.12,.20,
      x+dx*.71,h-.34,z,P.rust,.35);
    strut.rotation.z=dx>0?-.38:.38;
   }
   block(parent,'welded-lamp-mast',w*.48,h*.95,d*.48,x,h*.51,z,P.iron,.54);
   block(parent,'lamp-head',2.05,.25,.45,x,h+.30,z,P.steel,.42);
   for(const dx of [-.69,0,.69])
     block(parent,'lamp-lens',.5,.20,.07,x+dx,h+.31,z+.25,P.cream,.05);
   return;
 }
 // An articulated silhouette is clearer than the original anonymous crate.
 const coverTop=h+.01;
 const faceZ=o.minZ+.045;
 if(tractor||loader){
   const rr=Math.min(.82,h*.24,d*.19),wheelZ=Math.min(d*.28,d/2-rr*.8);
   for(const side of [-1,1])for(const dz of [-wheelZ,wheelZ]){
      const wx=x+side*(w*.5-.10);
      drum(parent,'exposed-wreck-wheel',rr,.16,wx,rr+.03,z+dz,P.tyre,'x',10);
      drum(parent,'rusty-wheel-hub',rr*.4,.17,
        wx+side*.025,rr+.03,z+dz,P.iron,'x',8);
   }
   block(parent,'dented-bonnet',w*.61,Math.min(.25,h*.1),d*.55,
      x,Math.min(h-.11,rr*2+.38),z-d*.10,tractor?P.rust2:P.yellow,.34)
      .rotation.x=-.12;
   block(parent,'cab-sill',w*.62,.15,d*.28,x,h-.12,z+d*.24,P.steel,.45);
   for(const side of [-1,1])
     block(parent,'broken-cab-upright',.10,Math.min(h*.53,1.0),.10,
       x+side*w*.24,h-.48,z+d*.27,P.iron,.43);
   block(parent,'scrapyard-rollbar',w*.55,.10,.13,x,h-.07,z+d*.26,P.iron,.46);
   if(loader){
     const bucket=block(parent,'heavy-loader-bucket',w*.85,h*.27,.42,
       x,h*.31,o.minZ+.29,P.iron,.51);
     bucket.rotation.x=-.22;
     for(let t=-2;t<=2;t++)block(parent,'bucket-tooth',.21,.18,.28,
       x+t*w*.14,h*.23,o.minZ+.23,P.rust2,.36);
   }else{
     drum(parent,'tractor-smokestack',.13,.46,x+w*.20,h-.06,z-d*.16,P.steel,'y',8);
   }
 }else if(engine||id==='coupling-spine'){
   for(let i=-1;i<=1;i++){
     drum(parent,'scrap-flywheel',Math.min(h*.27,w*.17,d*.28),.15,
       x+i*w*.26,h*.55,faceZ+.15,P.iron,'z',10);
     drum(parent,'flywheel-spindle',Math.min(h*.09,.20),.20,
       x+i*w*.26,h*.55,faceZ+.04,P.rust2,'z',8);
   }
   for(const j of [-1,0,1]){
     block(parent,'engine-head',w*.18,.17,d*.43,x+j*w*.25,h-.12,z,P.steel,.38);
   }
 }else if(tyres){
   for(const t of [-1,0,1]){
     const r=Math.min(h*.3,w*.20,d*.22);
     const cx=x+t*w*.24;
     drum(parent,'spare-tyre',r,.38,cx,h*.45,faceZ+.23,P.tyre,'z',10);
     drum(parent,'rust-axle',r*.36,.4,cx,h*.45,faceZ+.015,P.rust,'z',8);
   }
 }else{
   const n=Math.max(2,Math.floor(w/1.7)),step=w/n;
   for(let k=0;k<n;k++){
     const xx=o.minX+step*(k+.5);
     const shade=[P.rust,P.iron,P.wood,P.rust2,P.steel][k%5];
     block(parent,'welded-derby-barricade',step*.82,h*.79,.11,
       xx,h*.52,faceZ,shade,.26).rotation.z=(k%2?-.08:.07);
     if(k%2===0)block(parent,'exposed-brace',step*.18,h*.81,.14,
        xx+step*.17,h*.51,faceZ-.005,P.steel,.41).rotation.z=.12;
   }
   block(parent,'plate-top-rim',w*.91,.13,d*.68,x,coverTop-.09,z,P.wood,.15);
 }
 // Always preserve the certified width, height, and depth of the original cover.
}
function perimeter(root,w){
 // A rounded earth berm and timber ring OUTSIDE world bounds; no square walls.
 return buildBacklotTerrainAndFacilities(root,w);
}
function spectatorYard(root,w){
 const r=seeded();
 // Two rickety wooden bleachers behind the northern fence.
 for(const cx of [w.minX+11,w.maxX-11]){
   for(let tier=0;tier<4;tier++){
     block(root,'spectator-bleacher',11,.20,1.07,
       cx,1.04+tier*.70,w.minZ-3.25-tier*1.09,P.wood);
     for(const dx of [-4.7,0,4.7])
       block(root,'bleacher-support',.23,1+tier*.67,.23,
         cx+dx,(1+tier*.67)/2,w.minZ-3.25-tier*1.09,P.steel,.33);
   }
   // Patchwork canvas roofs above the standing room, distinct against open sky.
   const roof=block(root,'patched-awning',12,.16,4.9,cx,5.05,w.minZ-6.35,P.canvas);
   roof.rotation.x=-.09;
   for(const dx of [-5.4,5.4])
     block(root,'awning-post',.18,4.9,.18,cx+dx,2.45,w.minZ-5.2,P.wood);
   for(let i=0;i<16;i++){
     const xx=cx-4.9+(i%8)*1.4;
     const zz=w.minZ-4.2-Math.floor(i/8)*1.65;
     const yy=1.65+Math.floor(i/8)*.67;
     drum(root,'scrapyard-spectator',.23,.7,xx,yy,zz,
        i%3?P.steel:P.rust,'y',6);
   }
 }
 // Farm trailers, wrecked utility sheds and dustbanks beyond the playable ring.
 for(const side of [-1,1]){
   const xx=side*(Math.max(Math.abs(w.minX),Math.abs(w.maxX))+7);
   for(let k=0;k<4;k++){
     const z=-19+k*13;
     const body=block(root,'outside-scrap-trailer',3.3,2.8,6.5,xx,1.4,z,
       k%2?P.iron:P.rust,.28);
     body.rotation.y=side*(.09+.08*r());
     for(const wz of [-2.1,2.1])
       drum(root,'outside-trailer-tyre',.77,.28,xx-side*1.62,.76,z+wz,
         P.tyre,'x',9);
   }
 }
 // Bent gate arch and numbered race banner at the entrance.
 const z=w.maxZ+5.5;
 for(const dx of [-4.6,4.6])
   block(root,'entry-gate-column',.23,5.6,.23,dx,2.8,z,P.iron,.46);
 block(root,'entry-gate-crossbar',9.4,.30,.20,0,5.48,z,P.rust2,.43);
 const canvas=document.createElement('canvas');canvas.width=512;canvas.height=96;
 const g=canvas.getContext('2d');g.fillStyle='#493b2c';g.fillRect(0,0,512,96);
 g.fillStyle='#d6b275';g.font='bold 49px monospace';g.textAlign='center';
 g.fillText('BACKLOT DERBY',256,62,495);
 const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;
 tex.magFilter=THREE.NearestFilter;
 const banner=new THREE.Mesh(new THREE.PlaneGeometry(8.8,1.65),
   new THREE.MeshBasicMaterial({map:tex,side:THREE.DoubleSide}));
 banner.name='outdoor-derby-gate-sign';banner.position.set(0,4.68,z+.14);
 root.add(banner);
}
function dirtMarks(root,w){
 const trackMat=new THREE.MeshBasicMaterial({color:P.darkDirt,transparent:true,
   opacity:.19,depthWrite:false,side:THREE.DoubleSide});
 const dusty=new THREE.MeshBasicMaterial({color:0xc2a174,transparent:true,
   opacity:.14,depthWrite:false,side:THREE.DoubleSide});
 // Two genuinely-instanced transparent decal batches replace 55 individual
 // draw objects. They remain flat, visual-only marks with zero collision.
 const rut=new THREE.InstancedMesh(new THREE.PlaneGeometry(.29,3.1),trackMat,36);
 rut.name='churned-wheel-ruts';rut.userData.visualOnly=true;
 const circles=new THREE.InstancedMesh(new THREE.CircleGeometry(1,9),dusty,19);
 circles.name='sunbleached-dirt-patches';circles.userData.visualOnly=true;
 const dummy=new THREE.Object3D();
 for(let i=0;i<36;i++){
   const angle=i*.53,rad=11+(i%7)*2.18;
   dummy.position.set(Math.cos(angle)*rad*.92,.025,Math.sin(angle)*rad*.76);
   dummy.rotation.set(-Math.PI/2,0,angle+.6);
   dummy.scale.set(1,(3.1+i%4)/3.1,1);dummy.updateMatrix();
   rut.setMatrixAt(i,dummy.matrix);
 }
 for(let i=0;i<19;i++){
   const angle=i*1.94,rad=9+(i%8)*2.3;
   dummy.position.set(Math.cos(angle)*rad,.02,Math.sin(angle)*rad*.7);
   dummy.rotation.set(-Math.PI/2,0,0);
   const scale=1.9+(i%4);
   dummy.scale.set(scale,scale,1);dummy.updateMatrix();
   circles.setMatrixAt(i,dummy.matrix);
 }
 rut.instanceMatrix.needsUpdate=true;circles.instanceMatrix.needsUpdate=true;
 root.add(rut,circles);
}
/** Static outdoor scenery is aggressively instanced on mobile. The 21 real
 * collider meshes are NEVER batched: raycast hits must retain obstacle IDs,
 * while the repeated planks, tyres, spectators and scrap stay purely visual.
 */
export function batchBacklotDerbyDecorations(root){
 // Secondary scenery is *entirely* visual and permanently static.
 // First instance the 18 rebuilt offsite assemblies ACROSS objects, not
 // separately inside each wagon/pole/shack. Without this, replacing eight
 // plain trailer boxes would cost many dozens of additional iPhone draws.
 // This happens only in the live render graph; the source gallery retains
 // the true unbatched, named component hierarchy for inspection.
 const completed=[...root.children].filter(node=>node.isGroup&&
   /^secondary-(?:trailer-|fuel-counter-|mechanic-|working-grain-|power-pole-|derby-gate|hog-pen-)/.test(node.name));
 let secondaryInstances=0,secondaryBatches=0;
 if(completed.length){
  root.updateWorldMatrix(true,true);
  const inverse=root.matrixWorld.clone().invert();
  const buckets=new Map();
  for(const group of completed){
   group.traverse(node=>{
    if(!node.isMesh||node.isInstancedMesh||node.material?.transparent)return;
    const key=node.geometry.uuid+':'+node.material.uuid;
    if(!buckets.has(key))buckets.set(key,[]);
    buckets.get(key).push({node,matrix:inverse.clone().multiply(node.matrixWorld)});
    secondaryInstances++;
   });
  }
  for(const group of completed)root.remove(group);
  const merged=new THREE.Group();merged.name='batch-completed-secondary-scenery';
  root.add(merged);
  for(const items of buckets.values()){
   if(items.length===1){
    const {node,matrix}=items[0];
    const one=node.clone();
    matrix.decompose(one.position,one.quaternion,one.scale);
    merged.add(one);
    continue;
   }
   const batch=new THREE.InstancedMesh(items[0].node.geometry,
     items[0].node.material,items.length);
   batch.name='instanced-secondary-scenery';
   batch.userData.visualOnly=true;
   batch.castShadow=false;batch.receiveShadow=true;
   items.forEach((item,i)=>batch.setMatrixAt(i,item.matrix));
   batch.instanceMatrix.needsUpdate=true;
   merged.add(batch);secondaryBatches++;
  }
 }
 // Batch static siblings at EVERY authored hierarchy level, not just the
 // world root. All instances use local transforms, so rotated rails, scaled
 // cladding, distant barns and bleachers remain exactly where built.
 const groups=[];
 root.traverse(node=>{if(node.isGroup)groups.push(node);});
 let sourceMeshes=0,batches=0,instances=0;
 for(const group of groups){
   const buckets=new Map();
   for(const node of [...group.children]){
     if(!node.isMesh||node.isInstancedMesh||node.userData?.arenaObstacleId||
        node.material?.transparent||!node.visible)continue;
     sourceMeshes++;
     const key=node.geometry.uuid+':'+node.material.uuid;
     if(!buckets.has(key))buckets.set(key,[]);
     buckets.get(key).push(node);
   }
   for(const items of buckets.values()){
     if(items.length<2)continue;
     const mesh=new THREE.InstancedMesh(items[0].geometry,items[0].material,items.length);
     mesh.name='batched-outdoor-props';
     mesh.userData.visualOnly=true;
     mesh.castShadow=false;mesh.receiveShadow=true;
     for(let i=0;i<items.length;i++){
       const item=items[i];
       item.updateMatrix();
       mesh.setMatrixAt(i,item.matrix);
       group.remove(item);
     }
     mesh.instanceMatrix.needsUpdate=true;
     group.add(mesh);batches++;instances+=items.length;
   }
 }
 return Object.freeze({sourceMeshes,batches,instances,
   secondaryAssemblies:completed.length,secondaryInstances,secondaryBatches,
   callsSaved:instances-batches+secondaryInstances-secondaryBatches});
}
export function buildBacklotDerbyWorld(scene,world,solids){
 const root=new THREE.Group();root.name='backlot-outdoor-derby-world';
 root.userData.venue='open-sky-scrap-derby';
 perimeter(root,world);
 for(const obstacle of world.obstacles)
  if(isCompoundObstacle(obstacle))physicalCompoundPart(obstacle,solids);
  else createWreck(root,obstacle,solids);
 addLiveMechanicalAnatomy(root);
 dirtMarks(root,world);spectatorYard(root,world);
 upgradeBacklotScenery(root,world);
 upgradeBacklotSecondaryProps(root,world);
 // Certify named geometry before static instancing consumes scene groups.
 const collisionCertificate=auditBacklotCollisionTruth(root,world,solids);
 const fixtureBatch=batchBacklotDerbyDecorations(root);
 root.userData.backlotStats={
   fixtureBatch,collisionCertificate,
   environment:root.userData.backlotReactivity? 'reactive-dustbowl':'static',
   obstacleCount:world.obstacles.length,collisionSolids:solids.filter(x=>x.userData?.arenaObstacleId!=='floor').length,
   enclosingWarehouseWalls:0,overheadWarehouseFixtures:0,
   perimeter:'two-metre-stockyard-rails',sky:'open',
   detailedCoverCount:world.obstacles.filter(o=>o.artKit||o.art).length,
   kitFamilies:[...new Set(world.obstacles.map(o=>o.artKit).filter(Boolean))],
 };
 scene.add(root);
 return root;
}

/** Real Backlot exhibition specimens, not approximation/stand-in models.
 * Each current authored obstacle is rebuilt with its production builder.
 * Every additional distinct scenery mesh archetype is taken from the SAME
 * authored scenery graph, before batching, for forensic art inspection.
 * No combat, persistence, or collision systems participate in this gallery.
 */
export function buildBacklotPropCatalog(world){
 const catalog=[],seenIds=new Set(),collisionMeshes=[];
 // Experimental preview deliberately does NOT change the production
 // Backlot. The same live seven-part tractor is attached as a BEFORE view.
 // Collision overlay displays current authoritative map AABBs, not an
 // invented future physics shape.
 const currentTractor=world.obstacles.filter(o=>o.id.startsWith('tractor-'));
 const oldTractor=new THREE.Group();oldTractor.name='LIVE k5q3 tractor';
 for(const o of currentTractor)createWreck(oldTractor,o,collisionMeshes);
 const oldB=new THREE.Box3().setFromObject(oldTractor);
 const oldC=oldB.getCenter(new THREE.Vector3());
 const oldPart=new THREE.Group();
 oldTractor.position.set(-oldC.x,-oldB.min.y,-oldC.z);
 oldPart.add(oldTractor);oldPart.visible=false;
 const newPart=new THREE.Group();
 buildAnatomicalTractor(newPart);
 const collisionOverlay=new THREE.Group();
 collisionOverlay.name='AUTHORITATIVE OLD BACKLOT AABBs — reference only';
 const colliderMaterial=new THREE.LineBasicMaterial({
   color:0xffc57c,transparent:true,opacity:.9,depthTest:false,
 });
 for(const o of currentTractor)for(const part of collisionPieces(o)){
   const height=(part.maxY??part.height)-(part.minY??0);
   const shell=new THREE.LineSegments(
     new THREE.EdgesGeometry(new THREE.BoxGeometry(
       part.maxX-part.minX,height,part.maxZ-part.minZ)),colliderMaterial);
   shell.name='live-compound-collider-'+(part.partId??o.id);
   shell.position.set((part.minX+part.maxX)/2-oldC.x,
     (part.minY??0)+height*.5,(part.minZ+part.maxZ)/2-oldC.z);
   shell.userData.colliderOverlay=true;collisionOverlay.add(shell);
 }
 collisionOverlay.visible=false;
 const tractorAudit=auditBacklotAssembly(newPart,'tractor');
 const comparison=new THREE.Group();comparison.name='experimental-versus-production-tractor';
 comparison.add(newPart,oldPart,collisionOverlay);
 catalog.push({id:'experiment-tractor-anatomy',category:'experiment',
   label:'TRACTOR ANATOMY · FINISH V6',
   detail:'THIS MODEL IS NOW LIVE · compare with LEGACY AABB machinery',
   group:comparison,
   experiment:{newPart,oldPart,collisionOverlay,audit:tractorAudit}});

 // Every family receives the very same A/B controls used by the tractor.
 // We deliberately use production constructors for the OLD half, and
 // do not pretend the inherited AABBs describe the new hollow machines.
 const extraExhibits=[...MACHINE_EXHIBITS,...SALVAGE_EXHIBITS];
 for(const exhibit of extraExhibits){
  const parts=world.obstacles.filter(exhibit.match);
  if(!parts.length)throw Error('Missing live Backlot reference: '+exhibit.id);
  const oldRoot=new THREE.Group();
  oldRoot.name='LIVE BACKLOT '+exhibit.id;
  for(const o of parts)createWreck(oldRoot,o,collisionMeshes);
  const bounds=new THREE.Box3().setFromObject(oldRoot);
  const center=bounds.getCenter(new THREE.Vector3());
  oldRoot.position.set(-center.x,-bounds.min.y,-center.z);
  const oldPart=new THREE.Group();oldPart.add(oldRoot);oldPart.visible=false;
  const newPart=new THREE.Group();exhibit.build(newPart);
  const assemblyAudit=auditBacklotAssembly(newPart,exhibit.id);
  const collisionOverlay=new THREE.Group();
  collisionOverlay.name='EXISTING LIVE COLLIDERS ONLY '+exhibit.id;
  for(const o of parts)for(const part of collisionPieces(o)){
   const height=(part.maxY??part.height)-(part.minY??0);
   const edges=new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(
     part.maxX-part.minX,height,part.maxZ-part.minZ)),
    new THREE.LineBasicMaterial({
     color:0xffc57c,transparent:true,opacity:.9,depthTest:false,
    }));
   edges.position.set((part.minX+part.maxX)/2-center.x,
      (part.minY??0)+height*.5,(part.minZ+part.maxZ)/2-center.z);
   edges.name='live-compound-collider-'+(part.partId??o.id);
   edges.userData.colliderOverlay=true;
   collisionOverlay.add(edges);
  }
  collisionOverlay.visible=false;
  const group=new THREE.Group();
  group.name='EXPERIMENT '+exhibit.id;
  group.add(newPart,oldPart,collisionOverlay);
  catalog.push({id:'experiment-'+exhibit.id+'-anatomy',category:'experiment',
   label:exhibit.label,detail:exhibit.details+(exhibit.id==='loader'?' · THIS MODEL IS NOW LIVE':' · DEV-ONLY'),
   group,experiment:{newPart,oldPart,collisionOverlay,audit:assemblyAudit,front:exhibit.front||'+z'}});
 }
 const describe=o=>o.artKit||o.art||(
   o.kind==='pillar'?'floodlight mast':'salvage cover');
 // Hero composites: all component colliders exactly as assembled in a real
 // match, displayed BEFORE their separately inspectable part entries.
 const featured=[
   {id:'tractor-complete',label:'COMPLETE WRECKED TRACTOR',
      matches:o=>o.id.startsWith('tractor-')},
   {id:'loader-complete',label:'COMPLETE INDUSTRIAL LOADER',
      matches:o=>o.id.startsWith('loader-')},
   {id:'engine-complete',label:'EXPOSED ENGINE ASSEMBLY',
      matches:o=>o.id.startsWith('exposed-engine-')},
   {id:'coupling-complete',label:'CENTRAL COUPLING MACHINE',
      matches:o=>o.id.startsWith('coupling-')},
 ];
 for(const feature of featured){
   const group=new THREE.Group();
   const parts=world.obstacles.filter(feature.matches);
   for(const o of parts)createWreck(group,o,collisionMeshes);
   catalog.push({id:'assembly-'+feature.id,category:'showcase',
     label:feature.label,detail:parts.length+' LIVE PHYSICAL PIECES · ASSEMBLED',group});
 }
 for(const o of world.obstacles){
   const group=new THREE.Group();
   group.name='GALLERY '+o.id;
   createWreck(group,o,collisionMeshes);
   catalog.push({id:o.id,category:'cover',label:o.id.toUpperCase().replace(/-/g,' '),
     detail:describe(o).toUpperCase().replace(/-/g,' '),group});
   seenIds.add(o.id);
 }
 // Source scenery graph is generated by the same builders used on the live
 // Backlot. We display one physical example of EVERY named scenic detail,
 // instead of blindly repeating 72 identical fence segments.
 const source=new THREE.Group();
 buildBacklotTerrainAndFacilities(source,world);
 spectatorYard(source,world);
 upgradeBacklotScenery(source,world);
 upgradeBacklotSecondaryProps(source,world);
 source.updateWorldMatrix(true,true);
 const secondaryCollisionClearance=secondaryGeometryClearance(source,world);
 // Scenic assemblies from the original venue's own generation pass.
 const scenicShows=[
   {id:'announcer',label:'ANNOUNCER BOOTH & MARQUEE',
     match:o=>/^(announcer-|booth-|derby-announcer-sign|station-|scaffold-|speaker-|real-booth-window|raised-booth|individual-platform|rear-booth|rear-ladder)/.test(o.name)},
   {id:'bleachers',label:'WOODEN BLEACHERS & AWNING',
     match:o=>/^(individual-wooden-bleacher|bleacher-|diagonal-stadium-|canopy-|seamed-faded-canvas|scrapyard-spectator)/.test(o.name)
       && Math.abs(o.matrixWorld.elements[12]-(world.minX+11))<8},
   {id:'hoist',label:'SALVAGE CRANE & HOIST',
     match:o=>/^(crane-|steel-lattice-|jib-truss-|vertical-hoist-|lifting-hook-|winch-heavy-|functional-scrapyard-crane)/.test(o.name)},
   {id:'scoreboard',label:'MANUAL DERBY SCOREBOARD',
     match:o=>/^(manual-scoreboard-leg|patched-steel-scoreboard|backlot-manual-scoreboard)$/.test(o.name)},
 ];
 for(const feature of scenicShows){
   const group=new THREE.Group();
   source.traverse(o=>{
     if(!o.isMesh||!feature.match(o))return;
     const clone=o.clone();
     clone.matrix.copy(o.matrixWorld);
     clone.matrix.decompose(clone.position,clone.quaternion,clone.scale);
     group.add(clone);
   });
   if(group.children.length)catalog.push({id:'assembly-'+feature.id,category:'scenery',
     label:feature.label,detail:group.children.length+' REAL VENUE COMPONENTS · ASSEMBLED',group});
 }
 // Inspect complete connected secondary objects, not individual spokes.
 const secondary=[
  ['farm-wagon','FARM WAGON · STRUCTURAL REBUILD','secondary-trailer-farm-wagon-0'],
  ['salvage-flatbed','OFFSITE SALVAGE WAGON · REBUILD','secondary-trailer-salvage-flatbed-1'],
  ['fuel-shack','FUEL SERVICE SHACK · REBUILD','secondary-fuel-counter-shack'],
  ['mechanic-shed','OPEN REPAIR BAY · REBUILD','secondary-mechanic-service-shed'],
  ['grain-silo','GRAIN SILO · CHUTES / LADDER','secondary-working-grain-silo-0'],
  ['power-pole','POWER POLE · TRANSFORMER / BRACES','secondary-power-pole-0'],
  ['yard-entry','YARD GATE · BRACED STEEL ARCH','secondary-derby-gate'],
  ['main-entrance','HOG PEN MARQUEE · TRUSSED GATE','secondary-hog-pen-entry-gantry'],
 ];
 for(const [id,label,nodeName] of secondary){
  const src=source.getObjectByName(nodeName);
  if(!src)throw Error('Secondary Backlot exhibit missing '+nodeName);
  const group=new THREE.Group();
  src.traverse(o=>{
   if(!o.isMesh)return;
   const clone=o.clone();
   clone.matrix.copy(o.matrixWorld);
   clone.matrix.decompose(clone.position,clone.quaternion,clone.scale);
   group.add(clone);
  });
  catalog.push({id:'secondary-'+id,category:'scenery',label,
    detail:group.children.length+' REAL ASSEMBLED SECONDARY PROP PARTS',group});
 }
 const scenicNames=new Set(),scenicComponents=[];
 const exclude=/^(offsite-farm-earth|uneven-oval-dirt-berm|random-scraped-earth|continuous-churned-oval-rut|sunbleached-dirt-patches|churned-wheel-ruts|airborne-dust|impact-dirt-puff|real-cover-impact-scar|worn-objective-track|distant-earth-ridge)/;
 source.traverse(o=>{
   if(!o.isMesh||!o.name||exclude.test(o.name)||scenicNames.has(o.name)||
      !o.visible||o.material?.opacity===0)return;
   // The nearest suitable component of each scenic family; every candidate
   // is cloned from the actual authored source graph and retains its material.
   scenicNames.add(o.name);
   const group=new THREE.Group(),copy=o.clone();
   copy.matrix.copy(o.matrixWorld);
   copy.matrix.decompose(copy.position,copy.quaternion,copy.scale);
   copy.userData={...copy.userData,visualOnly:true};
   group.add(copy);
   scenicComponents.push({id:'scenery-'+o.name,category:'scenery',
     label:o.name.toUpperCase().replace(/-/g,' '),
     detail:'LIVE BACKLOT SCENERY COMPONENT',group});
 });
 const prominence=e=>/barn|grain-silo|tree-crown|scoreboard|bleacher|awni|utility|shack|trailer|floodlight|sign|marquee|crane|pole|rail/.test(e.id)?0:1;
 scenicComponents.sort((a,b)=>prominence(a)-prominence(b)||a.label.localeCompare(b.label));
 catalog.push(...scenicComponents);
 for(const specimen of catalog){
   const g=specimen.group;
   g.updateMatrixWorld(true);
   const b=new THREE.Box3().setFromObject(g);
   if(b.isEmpty())continue;
   const center=b.getCenter(new THREE.Vector3());
   g.position.x-=center.x;
   g.position.y-=b.min.y;
   g.position.z-=center.z;
   specimen.width=Math.max(.25,b.max.x-b.min.x);
   specimen.depth=Math.max(.25,b.max.z-b.min.z);
   specimen.height=Math.max(.25,b.max.y-b.min.y);
 }
 return {specimens:catalog,coverCount:world.obstacles.length,
   experimentCount:1+extraExhibits.length,showcaseCount:featured.length,sceneryAssemblyCount:scenicShows.length,
   sceneryArchetypes:scenicNames.size,secondaryCollisionClearance};
}
