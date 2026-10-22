/** Pixel damage decals attached to actual moving physical meshes.
 * The full per-serial journal is stored separately. Here only a few marks per
 * serial are drawn. All marks share one geometry and one material per family.
 */
import * as THREE from 'three';
import {normalizeSurfaceEvent} from './partServiceJournal.js';
import {surfaceDamageLanguage} from './surfaceDamageLanguage.js';

let shared=null;
const P=32;
function pixelTexture(kind) {
  const c=document.createElement('canvas');c.width=c.height=P;
  const g=c.getContext('2d');
  g.clearRect(0,0,P,P);
  if(kind==='armor-scrape'){
    // Exposed steel and a directional paint-chip tail, NOT a puncture.
    g.fillStyle='#242a26';
    g.fillRect(3,17,24,3);g.fillRect(7,14,20,4);
    g.fillRect(11,12,12,2);g.fillRect(20,20,7,2);
    g.fillStyle='#777b6f';g.fillRect(6,15,19,2);
    g.fillRect(15,13,10,1);
    g.fillStyle='#c0ae85';g.fillRect(8,14,13,1);g.fillRect(19,19,8,1);
    g.fillStyle='#474c43';g.fillRect(10,18,17,2);
  } else {
    const destroyed=kind==='destroyed-breach';
    const hot=kind==='power-breach';
    // Intentionally broad blocked pixels: a real black cavity, surrounded by
    // torn primer/steel. At default phone resolution it reads as a hole.
    g.fillStyle=hot?'#34271d':'#514b3c';
    g.fillRect(8,4,16,24);g.fillRect(5,8,22,16);
    g.fillRect(3,12,26,8);
    if(destroyed){g.fillRect(2,9,8,13);g.fillRect(23,11,7,13);}
    g.fillStyle=hot?'#896044':'#929184';
    g.fillRect(8,6,15,3);g.fillRect(5,10,4,12);
    g.fillRect(9,23,14,3);g.fillRect(24,11,3,11);
    g.fillStyle='#202421';
    g.fillRect(9,8,13,17);g.fillRect(6,12,20,9);
    if(destroyed){g.fillRect(4,11,23,13);}
    g.fillStyle='#080c0c';
    g.fillRect(10,10,12,12);g.fillRect(8,13,16,6);
    if(destroyed){g.fillRect(7,11,18,13);}
    g.fillStyle='#050808';
    g.fillRect(12,12,8,8);g.fillRect(10,14,12,4);
    // A few white exposed-metal chips preserve depth without glow.
    g.fillStyle=hot?'#ad8663':'#c0baa0';
    g.fillRect(10,6,8,2);g.fillRect(6,12,2,5);g.fillRect(22,23,3,2);
    if(hot){g.fillStyle='#423129';g.fillRect(0,13,5,8);g.fillRect(26,16,6,10);}
  }
  const map=new THREE.CanvasTexture(c);
  map.colorSpace=THREE.SRGBColorSpace;
  map.magFilter=THREE.NearestFilter;map.minFilter=THREE.NearestFilter;
  return map;
}
function resources(){
  if(shared)return shared;
  const geometry=new THREE.PlaneGeometry(1,1);
  const materials=new Map();
  for(const kind of ['armor-scrape','breach','power-breach','destroyed-breach']){
    materials.set(kind,new THREE.MeshBasicMaterial({
      map:pixelTexture(kind),transparent:false,alphaTest:.3,
      polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-2,
      side:THREE.DoubleSide,depthWrite:false,
    }));
  }
  shared={geometry,materials};return shared;
}
export function createSurfaceScarRenderer({perSerialLimit=4}={}){
  const displayed=new Map(), keys=new Set();
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
    if(!event||keys.has(event.eventId))return false;
    const target=locate(exterior,event);
    if(!target)return false;
    const r=resources(),profile=surfaceDamageLanguage(event);
    const mark=new THREE.Mesh(r.geometry,r.materials.get(profile.kind)||r.materials.get('breach'));
    const origin=new THREE.Vector3(...event.localPoint);
    const normal=new THREE.Vector3(...event.localNormal).normalize();
    mark.position.copy(origin).addScaledVector(normal,.012);
    mark.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),normal);
    mark.scale.set(profile.width,profile.height,1);
    mark.renderOrder=1;
    mark.userData.surfaceScarEvent=event.eventId;
    mark.userData.surfaceDamageKind=profile.kind;
    // A decal belongs to the specific struck moving physical mesh, not its slot.
    target.add(mark);keys.add(event.eventId);
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
