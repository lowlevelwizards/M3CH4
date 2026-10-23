/** Tiny in-world racing-paddock identity, attached to real armored sheet.
 * There is only one per machine (on its installed structure) and every texture
 * is owned by the rig so disposing a thumbnail never invalidates another one.
 */
import * as THREE from 'three';
import {rigCrewGraphic} from './rigCrewGraphics.js';
function paintedFace(node){
 if(!node.isMesh)return null;
 const role=node.userData?.surface?.role||'';
 if(node.userData?.surface?.exposure==='optical'||role==='optical'||
    /dark-mechanism|machined/.test(role))return null;
 if(!['BoxGeometry','ExtrudeGeometry'].includes(node.geometry?.type))return null;
 node.geometry.computeBoundingBox();
 const b=node.geometry.boundingBox;
 const w=b.max.x-b.min.x,h=b.max.y-b.min.y,d=b.max.z-b.min.z;
 if(w<.82||h<.48||d<.05||d>1.5)return null;
 return {node,b,w,h,score:w*h};
}
export function addRigCrewPlate(structureGroup,assembly){
 const identity=rigCrewGraphic(assembly);
 if(!identity||!structureGroup||structureGroup.userData.crewMarked)return false;
 // Headless geometry studies have no canvas/document. The crew marking is
 // purely decorative, not a collider or shield, so skip it outside browsers.
 if(typeof document==='undefined')return false;
 let best=null;
 structureGroup.traverse(node=>{
   const face=paintedFace(node);
   if(face&&(!best||face.score>best.score))best=face;
 });
 if(!best)return false;
 const canvas=document.createElement('canvas');canvas.width=128;canvas.height=64;
 const g=canvas.getContext('2d');
 g.fillStyle='#20302a';g.fillRect(0,0,128,64);
 g.fillStyle='#77633d';g.fillRect(1,1,126,3);g.fillRect(1,60,126,3);
 g.fillStyle='#b4ac85';g.fillRect(5,8,2,48);
 g.fillStyle='#d0c5a3';g.font='bold 10px monospace';
 g.fillText(identity.crewName,11,18,105);
 g.fillStyle='#e5bd77';g.font='bold 32px monospace';
 g.fillText(identity.unitCode,12,50,64);
 g.fillStyle='#6f8d7e';g.fillRect(76,27,44,5);
 g.fillRect(76,38,33,5);g.fillRect(76,48,22,5);
 const map=new THREE.CanvasTexture(canvas);
 map.colorSpace=THREE.SRGBColorSpace;
 map.magFilter=THREE.NearestFilter;map.minFilter=THREE.NearestFilter;
 const mat=new THREE.MeshStandardMaterial({map,metalness:.18,roughness:.9,
   depthWrite:false,side:THREE.DoubleSide,
   polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-2});
 const width=Math.min(.36,best.w*.34),height=Math.min(.19,best.h*.32);
 const plate=new THREE.Mesh(new THREE.PlaneGeometry(width,height),mat);
 plate.position.set(best.b.max.x-width*.72,best.b.max.y-height*.75,best.b.min.z-.011);
 plate.userData.crewIdentity={serial:identity.sourceSerial,unit:identity.unitCode};
 plate.castShadow=false;plate.receiveShadow=true;
 best.node.add(plate);
 structureGroup.userData.crewMarked=true;
 return true;
}
