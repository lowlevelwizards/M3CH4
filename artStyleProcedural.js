/** M3CH4 art vertical slice: seeded surface studies, never gameplay or save data.
 * Keep all randomness local so previews remain stable across reloads and devices.
 */
import * as THREE from 'three';

import {artHash,artRandom} from './artStyleSeed.js';

/** One fixed arena texture shared by every terrain view.
 * Texture affects only the presentation mesh, never walkability/collision.
 */
export function createYardGroundTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 768;
  const ctx = canvas.getContext('2d');
  const rand = artRandom(0x4d334348);
  ctx.fillStyle = '#514e43';
  ctx.fillRect(0, 0, 768, 768);
  // Large, irregularly distributed changes in soil tone.
  for (let i = 0; i < 210; i++) {
    const x = rand() * 768, y = rand() * 768, r = 12 + rand() * 105;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, i % 3 === 0 ? 'rgba(29,27,24,.30)' : 'rgba(163,139,100,.18)');
    g.addColorStop(1, 'rgba(65,60,49,0)');
    ctx.fillStyle = g; ctx.fillRect(x-r, y-r, r*2, r*2);
  }
  // Scattered aggregate; sparse enough to survive a small pixel framebuffer.
  for (let i = 0; i < 8500; i++) {
    const x = rand()*768, y = rand()*768, s = .35 + rand()*2.3;
    ctx.fillStyle = rand() > .52 ? 'rgba(196,180,144,.14)' : 'rgba(22,25,22,.17)';
    ctx.fillRect(x,y,s,s*(.5+rand()));
  }
  // Old paired track paths, not a clean game-editor grid.
  ctx.save(); ctx.globalAlpha = .20;
  for (const track of [{x:105,a:.08},{x:525,a:-.11},{x:680,a:.07}]) {
    ctx.save(); ctx.translate(track.x,384); ctx.rotate(track.a);
    for (const side of [-1,1]) {
      const x=side*19;
      ctx.strokeStyle='#211f1a';ctx.lineWidth=9;
      ctx.beginPath();ctx.moveTo(x,-460);ctx.lineTo(x,460);ctx.stroke();
      ctx.strokeStyle='#938671';ctx.lineWidth=2;
      ctx.beginPath();ctx.moveTo(x-6,-460);ctx.lineTo(x-6,460);ctx.stroke();
      for(let y=-430;y<430;y+=22) {
        ctx.strokeStyle='#141714';ctx.lineWidth=3;
        ctx.beginPath();ctx.moveTo(x-6,y);ctx.lineTo(x+6,y+4);ctx.stroke();
      }
    }
    ctx.restore();
  }
  ctx.restore();
  // Dark maintenance spills and compacted patches.
  for(let i=0;i<15;i++) {
    const x=rand()*768,y=rand()*768,r=8+rand()*30;
    const g=ctx.createRadialGradient(x,y,0,x,y,r);
    g.addColorStop(0,'rgba(17,23,21,.24)');
    g.addColorStop(1,'rgba(17,23,21,0)');
    ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);
  }
  const texture=new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.wrapS=texture.wrapT=THREE.ClampToEdgeWrapping;
  texture.minFilter=THREE.LinearMipmapLinearFilter;
  texture.magFilter=THREE.LinearFilter;
  texture.anisotropy=2;
  return texture;
}

/** Workshop slab surface, independent of the outdoor ground and its UVs. */
export function createWorkshopFloorTexture() {
  const canvas=document.createElement('canvas');
  canvas.width=canvas.height=512;
  const ctx=canvas.getContext('2d'),rand=artRandom(0x51514943);
  ctx.fillStyle='#74736b';ctx.fillRect(0,0,512,512);
  for(let i=0;i<5800;i++){
    const x=rand()*512,y=rand()*512,s=.5+rand()*2.5;
    ctx.fillStyle=rand()>.5?'rgba(232,222,193,.10)':'rgba(36,35,31,.12)';
    ctx.fillRect(x,y,s,s);
  }
  for(let i=0;i<21;i++){
    const x=rand()*512,y=rand()*512,r=6+rand()*25;
    const g=ctx.createRadialGradient(x,y,0,x,y,r);
    g.addColorStop(0,'rgba(21,28,26,.30)');
    g.addColorStop(1,'rgba(21,28,26,0)');
    ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);
  }
  ctx.lineCap='round';
  for(let i=0;i<75;i++){
    const x=rand()*512,y=rand()*512,length=4+rand()*34;
    ctx.strokeStyle=rand()>.4?'rgba(22,27,25,.21)':'rgba(218,202,164,.17)';
    ctx.lineWidth=.5+rand()*1.8;ctx.beginPath();ctx.moveTo(x,y);
    ctx.lineTo(x+length*(rand()-.5),y+length*(rand()-.5));ctx.stroke();
  }
  const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;
  t.minFilter=THREE.LinearMipmapLinearFilter;t.magFilter=THREE.LinearFilter;
  t.anisotropy=2;return t;
}

const finishMaps = new Map();
const dirtyRoles = new Set(['structure','primary-paint','secondary-paint',
  'protective-paint','accent','machined','dark-mechanism']);
function finishTexture(role, level, variation) {
  const key=role+':'+level+':'+variation;
  if(finishMaps.has(key))return finishMaps.get(key);
  const canvas=document.createElement('canvas');
  canvas.width=canvas.height=128;
  const ctx=canvas.getContext('2d');
  const rand=artRandom(artHash(key));
  const painted=role.includes('paint')||role==='accent';
  const base=255-Math.round(level*(painted?4.5:3.7));
  ctx.fillStyle='rgb('+base+','+base+','+base+')';
  ctx.fillRect(0,0,128,128);
  for(let i=0;i<100+level*50;i++){
    const x=rand()*128,y=rand()*128,s=.5+rand()*(1+level*.6);
    const v=Math.max(90,base-Math.round(rand()*(13+level*6)));
    ctx.fillStyle='rgba('+v+','+v+','+v+','+(.14+rand()*.22)+')';
    ctx.fillRect(x,y,s,s*(.45+rand()));
  }
  // Scratch direction is coherent; wear gathers near panel UV edges.
  const scratches=Math.round((painted?3:6)*level);
  for(let i=0;i<scratches;i++){
    const edge=rand()>.46;
    const x=edge ? (rand()>.5?rand()*14:114+rand()*14) : rand()*128;
    const y=rand()*128;
    ctx.strokeStyle='rgba(55,55,55,'+(.09+rand()*.25)+')';
    ctx.lineWidth=.5+rand()*1.5;
    ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+(rand()-.5)*17,y+2+rand()*22);ctx.stroke();
  }
  if(painted || role==='protective-paint'){
    for(let i=0;i<level*12;i++){
      const edge=rand()>.3;
      const x=edge?(rand()>.5?rand()*9:119+rand()*9):rand()*128;
      const y=edge?rand()*128:(rand()>.5?rand()*9:119+rand()*9);
      const s=1+rand()*2.2;
      ctx.fillStyle='rgba(72,78,76,'+(.16+rand()*.32)+')';
      ctx.fillRect(x,y,s,s*.7);
    }
  }
  if(role==='machined'){
    for(let i=0;i<level*14;i++){
      const y=rand()*128;
      ctx.fillStyle='rgba(85,85,85,.055)';
      ctx.fillRect(0,y,128,.3+rand()*.5);
    }
  }
  const texture=new THREE.CanvasTexture(canvas);
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  texture.minFilter=THREE.LinearMipmapLinearFilter;
  texture.magFilter=THREE.NearestFilter;
  finishMaps.set(key,texture);
  return texture;
}

/** Opt-in study applied ONLY to independently constructed meshes.
 * The gameplay material templates and four-channel paint data are untouched.
 * Optics and unclassified surfaces are deliberately excluded.
 */
export function applyArtWeathering(root, amount=0) {
  const level=Math.max(0,Math.min(5,Math.round(Number(amount)||0)));
  root.traverse(node=>{
    if(!node.isMesh || !node.geometry?.getAttribute('uv'))return;
    if(!node.userData.artBaseMaterials){
      node.userData.artBaseMaterials=Array.isArray(node.material)?node.material.slice():[node.material];
      node.userData.artWorkingMaterials=node.userData.artBaseMaterials.map(m=>m?.clone?.()??m);
    }
    const base=node.userData.artBaseMaterials;
    const working=node.userData.artWorkingMaterials;
    base.forEach((material,i)=>{
      const role=material?.userData?.materialRole;
      if(!dirtyRoles.has(role)||!working[i]?.isMeshStandardMaterial)return;
      working[i].map=level>0?finishTexture(role,level,artHash(node.name)%4):material.map;
      working[i].roughness=Math.min(.99,material.roughness+(level/5)*.045);
      working[i].needsUpdate=true;
    });
    node.material=level>0?(Array.isArray(node.material)?working:working[0]):
      (base.length>1?base:base[0]);
  });
  return root;
}
