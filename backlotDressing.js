/** Backlot Dustbowl visual dressing. No new cover, physics, pathing, target
 * meshes, obstacle IDs, shadow-casting lights or extra WebGL renderer.
 * Everything is bolted onto existing geometry or beyond certified arena walls.
 */
import * as THREE from 'three';
import {backlotVisualPlan} from './backlotVisualPlan.js';
import {artRandom} from './artStyleSeed.js';

const MAT=Object.freeze({
  rust:0x684431,patina:0x4c6560,sheet:0x444f49,steel:0x272f2c,
  pale:0x9c9880,amber:0xbd8b42,warning:0x9c6932,dark:0x1d2724,
});
const materials=new Map(),geometries=new Map();
function material(hex,metalness=.22,glow=0){
  const key=[hex,metalness,glow].join(':');
  if(!materials.has(key))materials.set(key,new THREE.MeshStandardMaterial({
    color:hex,metalness,roughness:.87,flatShading:true,
    emissive:glow?hex:0,emissiveIntensity:glow,
  }));
  return materials.get(key);
}
function geometry(w,h,d){
  const key=[w,h,d].map(v=>v.toFixed(3)).join(':');
  if(!geometries.has(key))geometries.set(key,new THREE.BoxGeometry(w,h,d));
  return geometries.get(key);
}
function block(parent,w,h,d,hex,x,y,z,metalness=.22,glow=0) {
  const mesh=new THREE.Mesh(geometry(w,h,d),material(hex,metalness,glow));
  mesh.position.set(x,y,z);
  mesh.castShadow=false;mesh.receiveShadow=true;
  mesh.userData.backlotVisualOnly=true;
  parent.add(mesh);
  return mesh;
}
function signMaterial(heading,subline){
  const canvas=document.createElement('canvas');
  canvas.width=256;canvas.height=96;
  const g=canvas.getContext('2d');
  g.fillStyle='#192521';g.fillRect(0,0,256,96);
  g.fillStyle='#4b645b';g.fillRect(2,2,252,92);
  g.fillStyle='#202e28';g.fillRect(6,6,244,84);
  g.fillStyle='#b68a47';g.fillRect(13,15,229,4);g.fillRect(13,76,229,3);
  g.fillStyle='#e6ca8f';g.font='bold 27px monospace';
  g.fillText(heading,16,47,224);
  g.font='bold 13px monospace';g.fillStyle='#98b6aa';
  g.fillText(subline,17,69,224);
  const map=new THREE.CanvasTexture(canvas);
  map.colorSpace=THREE.SRGBColorSpace;
  map.magFilter=THREE.NearestFilter;map.minFilter=THREE.NearestFilter;
  return new THREE.MeshStandardMaterial({map,roughness:.92,metalness:.02,
    side:THREE.DoubleSide});
}
function panel(parent,mat,w,h,x,y,z,reverse=false){
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w,h),mat);
  mesh.position.set(x,y,z);
  if(reverse)mesh.rotation.y=Math.PI;
  mesh.castShadow=false;mesh.receiveShadow=true;
  mesh.userData.backlotVisualOnly=true;
  parent.add(mesh);
  return mesh;
}
function instancedPosts(parent,sites,shape,hex){
  if(!sites.length)return;
  const mesh=new THREE.InstancedMesh(geometry(...shape),material(hex,.41),sites.length);
  const dummy=new THREE.Object3D();
  sites.forEach(([x,y,z],i)=>{
    dummy.position.set(x,y,z);
    dummy.updateMatrix();
    mesh.setMatrixAt(i,dummy.matrix);
  });
  mesh.instanceMatrix.needsUpdate=true;
  mesh.castShadow=false;mesh.receiveShadow=true;
  mesh.userData.backlotVisualOnly=true;
  parent.add(mesh);
}
/** Instance only identical, noninteractive pieces of visual-only
 * fixtures. Preserves their actual world transform, texture, material, and
 * appearance. Does not touch scenario collider meshes or the arena map.
 */
export function batchBacklotFixtures(root){
  const groups=new Map();
  let boxes=0;
  for(const node of [...root.children]){
    if(!node.isMesh||node.isInstancedMesh||node.geometry?.type!=='BoxGeometry'||
      !node.userData?.backlotVisualOnly)continue;
    boxes++;
    const key=node.geometry.uuid+':'+node.material.uuid;
    if(!groups.has(key))groups.set(key,[]);
    groups.get(key).push(node);
  }
  let batchedMeshes=0,instances=0;
  for(const items of groups.values()){
    if(items.length<2)continue;
    const mesh=new THREE.InstancedMesh(items[0].geometry,items[0].material,items.length);
    for(let i=0;i<items.length;i++){
      const original=items[i];
      original.updateMatrix();
      mesh.setMatrixAt(i,original.matrix);
      root.remove(original);
    }
    mesh.instanceMatrix.needsUpdate=true;
    mesh.castShadow=false;mesh.receiveShadow=true;
    mesh.userData.backlotVisualOnly=true;
    root.add(mesh);
    batchedMeshes++;
    instances+=items.length;
  }
  return Object.freeze({sourceBoxMeshes:boxes,batchedMeshes,instances,
    callsSaved:instances-batchedMeshes});
}
export function buildBacklotDressing(world){
  const plan=backlotVisualPlan(world),group=new THREE.Group();
  group.name='backlot-dustbowl-visuals';
  group.userData.backlotVisualOnly=true;
  const rand=artRandom(0x43524f50);

  // Irregular donor sheets and scuffed safety rails stay flush to the fronts
  // of real, certified cover. Thin plates do not extend into the firing lanes.
  const patched=[MAT.patina,MAT.rust,MAT.sheet,MAT.steel,MAT.pale];
  for(const [i,f] of plan.obstacleFacades.entries()){
    const color=patched[Math.floor(rand()*patched.length)];
    const w=f.width*.93,h=f.height*.73;
    if(f.kind==='building'){
      for(const side of [-1,1]){
        const z=side<0?f.faceZ:f.backZ;
        const plate=panel(group,material(color,.19),w,h,
          f.centerX,f.baseHeight*.52,z,side>0);
        plate.userData.backlotFacadeOf=f.id;
        // Horizontal welded reinforcement at a plausible structural joint.
        block(group,w,.08,.05,MAT.steel,f.centerX,f.baseHeight*.31,z, .56);
      }
    }else{
      const z=f.faceZ;
      const sheetWidth=Math.max(.18,w*.49);
      for(const side of [-1,1]){
        panel(group,material(side<0?color:patched[(i+3)%patched.length],.18),
          sheetWidth,h,
          f.centerX+side*w*.23,f.baseHeight*.51,z);
      }
      block(group,w,.055,.065,MAT.steel,f.centerX,f.baseHeight*.27,z,.56);
      block(group,w,.045,.065,MAT.warning,f.centerX,f.baseHeight*.79,z,.15);
    }
  }

  // Repetition is instanced. This makes a readable perimeter fence with only
  // a few draw calls, not dozens of individually moving high-poly posts.
  const northZ=world.minZ-.675,southZ=world.maxZ+.675;
  for(const z of [northZ,southZ]){
    for(const y of [2.3,5.7])
      block(group,world.maxX-world.minX-2,.11,.095,MAT.steel,
        (world.minX+world.maxX)/2,y,z,.48);
  }
  for(const x of [world.minX-.675,world.maxX+.675]){
    for(const y of [2.3,5.7])
      block(group,.095,.11,world.maxZ-world.minZ-2,MAT.steel,
        x,y,(world.minZ+world.maxZ)/2,.48);
  }
  instancedPosts(group,[
    ...plan.northPosts.map(x=>[x,3.9,northZ]),
    ...plan.southPosts.map(x=>[x,3.9,southZ]),
  ],[.12,4.1,.12],MAT.patina);
  instancedPosts(group,plan.sidePosts.flatMap(z=>[
    [world.minX-.675,3.9,z],[world.maxX+.675,3.9,z],
  ]),[.12,4.1,.12],MAT.patina);

  // Venue floodlights are anchored to real existing giant pillar bodies;
  // their luminous painted faces reuse the current arena's actual lighting.
  for(const p of plan.floodlightBases){
    block(group,.18,1.18,.18,MAT.steel,p.x,p.y+.56,p.z,.56);
    block(group,2.25,.22,.36,MAT.patina,p.x,p.y+1.18,p.z,.42);
    for(const dx of [-.76,-.25,.25,.76]){
      block(group,.34,.19,.26,MAT.dark,p.x+dx,p.y+1.2,p.z+.23,.45);
      block(group,.28,.11,.02,MAT.amber,p.x+dx,p.y+1.2,p.z+.375,.1,.35);
    }
  }
  // Primitive spectator/service decks beyond the existing north wall (not
  // accessible arena space). Their high silhouettes break the dead black sky.
  for(const deck of plan.spectatorDecks){
    for(let i=0;i<3;i++){
      block(group,deck.width, .17,.60,i===2?MAT.patina:MAT.rust,
        deck.x,8.10+i*.48,deck.z-.48*i,.25);
    }
    for(const dx of [-deck.width*.41,deck.width*.41]){
      block(group,.16,1.75,.16,MAT.steel,deck.x+dx,8.25,deck.z-.5,.48);
    }
  }
  panel(group,signMaterial('YARD 01','UNLICENSED RIG RACING'),
    5.9,2.18,world.minX+14,5.05,world.minZ-.655);
  panel(group,signMaterial('NO REFUNDS','HIT HARD / DRIVE HOME'),
    5.9,2.18,world.maxX-14,5.05,world.minZ-.655);
  panel(group,signMaterial('BACKLOT','SCRAPYARD MOTOR CLUB'),
    6.6,2.4,(world.minX+world.maxX)/2,5,world.maxZ+.655,true);

  const fixtureBatch=batchBacklotFixtures(group);
  group.userData.backlotStats={
    fixtureBatch,
    facades:plan.obstacleFacades.length,
    floodlights:plan.floodlightBases.length,
    deckCount:plan.spectatorDecks.length,
    gameplayCollidersAdded:0,
    lightSourcesAdded:0,
  };
  return group;
}
