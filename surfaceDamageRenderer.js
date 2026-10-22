/** Lightweight authored pixel scar patches attached to named moving surfaces.
 * Full exact history lives in IndexedDB; the renderer keeps only a few visible
 * marks per serial. Reuses one plane geometry, one texture and one material.
 */
import * as THREE from 'three';
import {normalizeSurfaceEvent} from './partServiceJournal.js';
let shared=null;
function resources(){
  if(shared)return shared;
  const canvas=document.createElement('canvas');
  canvas.width=canvas.height=32;
  const g=canvas.getContext('2d');
  g.clearRect(0,0,32,32);
  g.fillStyle='#171d1b';
  g.fillRect(5,13,22,6);g.fillRect(8,10,17,11);
  g.fillRect(12,8,11,13);g.fillRect(3,15,27,4);
  g.fillStyle='#707970';
  g.fillRect(7,14,17,3);g.fillRect(12,11,13,2);g.fillRect(18,18,7,2);
  g.fillStyle='#b3a78a';
  g.fillRect(9,13,12,1);g.fillRect(18,17,7,1);
  g.fillStyle='#3a423e';
  g.fillRect(5,19,17,2);
  const map=new THREE.CanvasTexture(canvas);
  map.colorSpace=THREE.SRGBColorSpace;
  map.magFilter=THREE.NearestFilter;
  map.minFilter=THREE.NearestFilter;
  const geometry=new THREE.PlaneGeometry(1,1);
  const material=new THREE.MeshBasicMaterial({
    map,transparent:false,alphaTest:.25,
    polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1,
    side:THREE.DoubleSide,depthWrite:false,
  });
  shared={geometry,material};return shared;
}
const bySeverity=e=>Math.min(1,Math.max(.13,
  ((e.armorAbsorbed||0)+(e.internalDamage||0)*1.8)/65));
export function createSurfaceScarRenderer({perSerialLimit=4}={}){
  const displayed=new Map();
  const keys=new Set();
  function locate(exterior,event){
    if(!exterior?.partGroups)return null;
    for(const group of exterior.partGroups.values()){
      if(group.userData?.appearance?.serial!==event.serial)continue;
      let target=null;
      group.traverse(node=>{
        if(!target&&node.isMesh&&node.userData?.surface?.id===event.surfaceId)
          target=node;
      });
      if(target)return target;
    }
    return null;
  }
  function apply(exterior,raw){
    const event=normalizeSurfaceEvent(raw);
    if(!event || keys.has(event.eventId))return false;
    const target=locate(exterior,event);
    if(!target)return false;
    const r=resources(),mark=new THREE.Mesh(r.geometry,r.material);
    const size=bySeverity(event);
    const origin=new THREE.Vector3(...event.localPoint);
    const normal=new THREE.Vector3(...event.localNormal).normalize();
    mark.position.copy(origin).addScaledVector(normal,.009);
    mark.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),normal);
    mark.scale.set(.11+size*.19,.045+size*.08,1);
    mark.renderOrder=1;
    mark.userData.surfaceScarEvent=event.eventId;
    // Marks are children of the genuinely struck moving mesh.
    target.add(mark);
    keys.add(event.eventId);
    const list=displayed.get(event.serial)||[];
    list.push(mark);
    if(list.length>perSerialLimit){
      const oldest=list.shift();
      keys.delete(oldest.userData.surfaceScarEvent);
      oldest.parent?.remove(oldest);
    }
    displayed.set(event.serial,list);
    return true;
  }
  function clear(){
    for(const list of displayed.values())
      for(const mark of list)mark.parent?.remove(mark);
    displayed.clear();keys.clear();
  }
  return {apply,clear,counts:()=>Object.fromEntries([...displayed]
    .map(([serial,list])=>[serial,list.length]))};
}
