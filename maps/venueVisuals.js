/** Lightweight venue art; no independently invented collision or ballistic cover.
 * All non-colliding markings are above/behind the existing map surfaces.
 */
import * as THREE from 'three';
import {createYardGroundTexture,createWorkshopFloorTexture} from '../artStyleProcedural.js';
const cached=new Map();
function culvertTexture(){
 if(cached.has('culvert'))return cached.get('culvert');
 const c=document.createElement('canvas');c.width=c.height=128;
 const ctx=c.getContext('2d');ctx.fillStyle='#70746d';ctx.fillRect(0,0,128,128);
 let seed=0x31a20;
 const rng=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 for(let i=0;i<370;i++){
  const x=Math.floor(rng()*128),y=Math.floor(rng()*128),size=1+Math.floor(rng()*4);
  ctx.fillStyle=rng()>.5?'#5a655c':'#899083';ctx.fillRect(x,y,size,size);
 }
 ctx.fillStyle='#505951';
 for(let j=0;j<3;j++){const x=Math.floor(rng()*128);ctx.fillRect(x,0,2,128);}
 const map=new THREE.CanvasTexture(c);
 map.wrapS=map.wrapT=THREE.RepeatWrapping;map.repeat.set(12,8);
 map.colorSpace=THREE.SRGBColorSpace;
 map.magFilter=map.minFilter=THREE.NearestFilter;
 cached.set('culvert',map);return map;
}
export function venueFloorTexture(map){
 if(map.theme==='concrete')return culvertTexture();
 if(map.theme==='mill')return createWorkshopFloorTexture();
 return createYardGroundTexture();
}
const paint=(hex,metal=.15,emission=0)=>new THREE.MeshStandardMaterial({
 color:hex,roughness:.88,metalness:metal,
 emissive:emission?hex:0,emissiveIntensity:emission,
});
const rust=paint(0x72503b,.39),steel=paint(0x3c4743,.52),cream=paint(0x999782),
 dark=paint(0x2e3737,.3),water=paint(0x344b52,.06),dirt=paint(0x504b3d);
function cube(group,name,w,h,d,x,y,z,mat,rot=0){
 const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
 mesh.name=name;mesh.position.set(x,y,z);mesh.rotation.y=rot;
 mesh.receiveShadow=true;mesh.castShadow=false;mesh.userData.visualOnly=true;
 group.add(mesh);return mesh;
}
function label(group,text,x,y,z,width=6,flip=false){
 const c=document.createElement('canvas');c.width=256;c.height=64;
 const ctx=c.getContext('2d');
 ctx.fillStyle='#1c2825';ctx.fillRect(0,0,256,64);
 ctx.strokeStyle='#c0a577';ctx.lineWidth=5;ctx.strokeRect(2,2,252,60);
 ctx.fillStyle='#d8c58d';ctx.font='bold 25px monospace';
 ctx.textAlign='center';ctx.fillText(text,128,42,248);
 const tex=new THREE.CanvasTexture(c);
 tex.colorSpace=THREE.SRGBColorSpace;
 tex.magFilter=tex.minFilter=THREE.NearestFilter;
 const mesh=new THREE.Mesh(new THREE.PlaneGeometry(width,width/4),
  new THREE.MeshStandardMaterial({map:tex,roughness:.9,side:THREE.DoubleSide}));
 mesh.position.set(x,y,z);if(flip)mesh.rotation.y=Math.PI;
 mesh.userData.visualOnly=true;group.add(mesh);
}
export function buildVenueDressing(map){
 const root=new THREE.Group();
 root.name='venue-dressing-'+map.id;root.userData.visualOnly=true;
 const w=map.world;
 if(map.id==='backlot-dustbowl')return root;
  if(map.id==='test-yard') {
    // Painted range ticks and labels are deliberately non-colliding.
    for (const [distance,z] of [[18,8],[31,-5],[51,-25]]) {
      for(const x of [-26,-17,0,17,26])
        cube(root,'range-tick-'+distance+'-'+x,2.0,.022,.16,x,.032,z+3,cream);
      label(root,distance+' M',-23,2.8,z,3.4);
    }
    for(const x of [-25,25])
      cube(root,'range-lane-edge-'+x,.15,.02,65,x,.035,-8,rust);
    label(root,'M3CH4 TEST YARD',0,4.3,-43.5,11);
    return root;
  }
 if(map.id==='culvert-nine'){
  // Paint a drainage gutter down the entire channel; the crossings are
  // actually flush, flat reinforced grates (no physical depression).
  cube(root,'painted-runoff-channel',w.maxX-w.minX-.9,.025,3.55,
   0,.008,0,water);
  for(const x of [-25,0,25]){
   for(let j=0;j<8;j++){
    cube(root,'metal-crossing-grate-'+x+'-'+j,3.3,.028,.13,
      x,.046,-1.65+j*.47,steel);
   }
   cube(root,'sluice-direction-arrow-'+x,2.5,.012,.23,x,.056,4.1,cream);
  }
  // Color-only longitudinal warning rail on real culvert slab faces.
  for(const obs of w.obstacles.filter(o=>o.id.startsWith('sluice-'))){
   const x=(obs.minX+obs.maxX)/2;
   const wide=obs.maxX-obs.minX;
   cube(root,'sluice-safety-rail-'+obs.id,wide,.09,.11,
    x,obs.height+.06,obs.minZ+.13,rust);
  }
  for(const x of [-32,32]){
   for(const z of [-18,18]){
    cube(root,'service-pipe-anchor',.21,3.3,.21,x,1.65,z,steel);
    cube(root,'service-pipe-crossbar',2.2,.13,.17,x,3.15,z,rust);
   }
  }
  label(root,'CULVERT 09',0,5.2,w.minZ-.64,7);
  label(root,'FLOOD CONTROL',0,5.2,w.maxZ+.64,7,true);
 }else if(map.id==='grainhouse'){
  // Existing, real load-bearing box AABBs remain visible as industrial
  // foundations. Tanks/pipes are non-colliding dressing on those solids.
  for(const [i,id] of ['silo-north','silo-south'].entries()){
    const o=w.obstacles.find(a=>a.id===id);
    const cx=(o.minX+o.maxX)/2,cz=(o.minZ+o.maxZ)/2;
    const radius=Math.min(o.maxX-o.minX,o.maxZ-o.minZ)*.46;
    const silo=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,5.3,10,1),
      cream);
    silo.position.set(cx,4.8,cz);
    silo.userData.visualOnly=true;silo.castShadow=false;
    root.add(silo);
    for(const height of [3.1,5.8,7.1]){
      const ring=new THREE.Mesh(new THREE.TorusGeometry(radius+.025,.09,5,10),
        rust);
      ring.position.set(cx,height,cz);ring.rotation.x=Math.PI/2;
      ring.userData.visualOnly=true;root.add(ring);
    }
  }
  for(const x of [-26,-16,-6]){
    cube(root,'loading-lamp-arm',2.1,.13,.15,x,5.8,12.2,steel);
    cube(root,'loading-warm-lamp',.8,.08,.25,x,5.67,12.3,cream);
  }
  // Silhouette conveyors fixed outside active routes or directly above
  // pre-existing obstacle masses; they do not create false walking blockers.
  for(const id of ['grain-separator','packing-press','feed-conveyor']){
    const o=w.obstacles.find(a=>a.id===id);
    cube(root,'machine-service-pipe-'+id,o.maxX-o.minX,.14,.18,
      (o.minX+o.maxX)/2,o.height+.38,(o.minZ+o.maxZ)/2,steel);
    for(const side of [-1,1]){
      cube(root,'machine-support-brace-'+id,.13,.67,.16,
        (o.minX+o.maxX)/2+side*(o.maxX-o.minX)*.35,
        o.height+.2,(o.minZ+o.maxZ)/2,rust);
    }
  }
  label(root,'GRAINHOUSE',0,5.2,w.minZ-.64,7.2);
  label(root,'FEED CO-OP',0,5.2,w.maxZ+.64,6.5,true);
 }
 root.userData.venueStats={id:map.id,visualOnly:true,solidCount:w.obstacles.length};
 return root;
}
