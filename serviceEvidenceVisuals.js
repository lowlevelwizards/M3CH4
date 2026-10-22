/** Physical service tally, derived only from known real repair counts.
 * A workshop inspection stamp is NOT an invented repair location or a
 * replacement for actual weld/patch events. Fits authored painted flat panels.
 */
import * as THREE from 'three';
const plates=new Map();
function stampTexture(count) {
  const key=count>99?'99+':Math.max(1,Math.floor(count));
  if(plates.has(key))return plates.get(key);
  const c=document.createElement('canvas');c.width=64;c.height=32;
  const g=c.getContext('2d');
  g.fillStyle='#292d27';g.fillRect(0,0,64,32);
  g.fillStyle='#898878';
  g.fillRect(1,1,62,2);g.fillRect(1,29,62,2);
  g.fillRect(1,1,2,30);g.fillRect(61,1,2,30);
  g.fillStyle='#c5b18a';g.font='bold 10px monospace';
  g.fillText('SERVICE',7,13);
  g.fillStyle='#e0b36d';g.font='bold 12px monospace';
  g.fillText('R-'+(key==='99+'?'99+':String(key).padStart(2,'0')),15,26);
  g.fillStyle='#576156';g.fillRect(4,4,3,3);g.fillRect(57,25,3,3);
  const map=new THREE.CanvasTexture(c);
  map.colorSpace=THREE.SRGBColorSpace;
  map.magFilter=THREE.NearestFilter;map.minFilter=THREE.NearestFilter;
  plates.set(key,map);return map;
}
export function serviceStampCount(part) {
  const repairs=Number(part?.repairs);
  return Number.isSafeInteger(repairs)&&repairs>0?repairs:0;
}
export function addPhysicalServiceStamp(root,part) {
  const repairs=serviceStampCount(part);
  if(!root||repairs<1||root.userData.serviceStamped)return false;
  let selected=null,area=0;
  root.traverse(node=>{
    if(!node.isMesh||node.userData?.surface?.role==='optical')return;
    const role=node.userData?.surface?.role;
    if(!/paint|accent/.test(role||''))return;
    const dimensions=node.geometry?.parameters;
    if(node.geometry?.type!=='BoxGeometry'||!(dimensions?.width>.38)||
       !(dimensions?.height>.26)||!(dimensions?.depth>.035))return;
    const score=dimensions.width*dimensions.height;
    if(score>area){selected=node;area=score;}
  });
  if(!selected)return false;
  const d=selected.geometry.parameters;
  const scale=Math.min(1,d.width/.68,d.height/.35);
  const mark=new THREE.Mesh(new THREE.PlaneGeometry(.29*scale,.145*scale),
    new THREE.MeshBasicMaterial({map:stampTexture(repairs),side:THREE.DoubleSide,
      depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}));
  // The label is physically printed on an existing flat box-facing service
  // panel; it follows any articulation, never enters the raycast pick list.
  mark.position.set(Math.max(0,d.width*.12),0,-d.depth/2-.008);
  mark.userData.serviceEvidence={serial:part.serial,repairs:Math.floor(repairs)};
  selected.add(mark);
  root.userData.serviceStamped=true;
  return true;
}
