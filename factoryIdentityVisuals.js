/** One small, physically lit maker/model plate on the largest available
 * painted service panel of an authored module. Uses its actual local polygon
 * envelope and inherits joint motion. Model artwork is shared (not 1 texture
 * per serial), and this marker never enters combat raycasting or persistence.
 */
import * as THREE from 'three';
import {factoryGraphic} from './factoryIdentityPolicy.js';
const textures=new Map();
function modelTexture(id){
  if(textures.has(id))return textures.get(id);
  const mark=factoryGraphic(id);
  if(!mark)return null;
  const canvas=document.createElement('canvas');
  canvas.width=128;canvas.height=48;
  const g=canvas.getContext('2d');
  g.fillStyle='#28342f';g.fillRect(0,0,128,48);
  g.fillStyle='#929a83';g.fillRect(1,1,126,2);
  g.fillRect(1,45,126,2);g.fillRect(1,1,2,46);g.fillRect(125,1,2,46);
  g.fillStyle='#c7ae77';g.fillRect(6,6,34,4);
  g.fillStyle='#c8c9a6';g.font='bold 11px monospace';
  g.fillText(mark.maker,6,23,118);
  g.fillStyle='#e9bf70';g.font='bold 11px monospace';
  g.fillText(mark.model,6,37,118);
  g.fillStyle='#5c7467';g.fillRect(115,7,5,5);
  const map=new THREE.CanvasTexture(canvas);
  map.colorSpace=THREE.SRGBColorSpace;
  map.magFilter=THREE.NearestFilter;map.minFilter=THREE.NearestFilter;
  textures.set(id,map);
  return map;
}
function modelMaterial(id){
  const map=modelTexture(id);
  return map?new THREE.MeshStandardMaterial({
    map,metalness:.18,roughness:.87,side:THREE.DoubleSide,
    depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-2,
  }):null;
}
function eligiblePanel(node) {
  if(!node?.isMesh)return null;
  const role=node.userData?.surface?.role||'';
  if(node.userData?.surface?.exposure==='optical' ||
    /optical|dark-mechanism|joint/.test(role))return null;
  const geo=node.geometry;
  if(!['BoxGeometry','ExtrudeGeometry'].includes(geo?.type))return null;
  geo.computeBoundingBox();
  const b=geo.boundingBox;
  const w=b.max.x-b.min.x,h=b.max.y-b.min.y,d=b.max.z-b.min.z;
  if(w<.55||h<.34||d<.03||d>1.5)return null;
  return {node,b,w,h,d,score:w*h};
}
export function addFactoryIdentityPlate(root,definitionId){
  if(!root || root.userData.factoryIdentityPlate || !factoryGraphic(definitionId))
    return false;
  let selected=null;
  root.traverse(node=>{
    const panel=eligiblePanel(node);
    if(!panel)return;
    if(!selected||panel.score>selected.score)selected=panel;
  });
  if(!selected)return false;
  const {node,b,w,h}=selected;
  const width=Math.min(.43,w*.43),height=Math.min(.18,h*.30);
  // Each temporary rig can be disposed by the shared thumbnail preview
  // cleanup. Geometry and material ownership MUST be private to that rig;
  // only the small immutable per-definition texture is shared.
  const plate=new THREE.Mesh(new THREE.PlaneGeometry(width,height),
    modelMaterial(definitionId));
  // The stenciled plate is inset from corners rather than hovering across a
  // bounding-box edge. A real flat face of the selected primitive supports it.
  const cx=b.min.x+Math.max(width*.64,w*.25);
  const cy=b.min.y+Math.max(height*.72,h*.25);
  plate.position.set(cx,cy,b.min.z-.007);
  plate.userData.factoryIdentity={definitionId,model:factoryGraphic(definitionId).model};
  plate.castShadow=false;plate.receiveShadow=true;
  node.add(plate);
  root.userData.factoryIdentityPlate=true;
  return true;
}
