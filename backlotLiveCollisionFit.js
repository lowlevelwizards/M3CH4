/** Harvest real world-space collision from visible Backlot structural steel.
 * A canopy, uprights, floor and bucket walls are individually physical:
 * the rectangular parent obstacle never becomes an invisible hit surface.
 * The result is shared by AI, movement, LOS, bullets and Three.js raycasts.
 */
import * as THREE from 'three';
import {registerLiveCompoundPieces,COMPOUND_FAMILY_IDS} from './backlotCompoundGeometry.js';
const STRUCTURAL=Object.freeze({
 'tractor-chassis':['tractor-integrated-clutch-bellhousing',
  'tractor-lower-sump-and-frame-web','tractor-rear-gearbox-backbone',
  'rear-differential-housing','crossmember-revealing-open-undercarriage'],
 'tractor-cab':['operator-foot-platform','operator-cage-vertical-post',
  'midheight-rear-rollcage-screen','cab-floating-canopy-roof',
  'canopy-front-crossrail','canopy-rear-crossrail'],
 'tractor-bonnet':['cast-engine-crankcase','tapered-bonnet-top',
  'left-angled-bonnet-shoulder','right-angled-bonnet-shoulder',
  'hood-radiator-side','tractor-bellhousing-upper-crown'],
 'tractor-wheel-fl':['rear-drive-tyre--1'],
 'tractor-wheel-fr':['rear-drive-tyre-1'],
 'tractor-wheel-rl':['front-steered-wheel--1'],
 'tractor-wheel-rr':['front-steered-wheel-1'],
 'loader-scoop':['welded-hollow-bucket-floor','welded-bucket-backplate',
  'bucket-open-end-plate','individual-bucket-teeth',
  'damaged-bucket-reinforcement'],
 'loader-engine':['loader-main-transmission-belly','loader-front-bulkhead',
  'loader-forward-clutch-side-housing','rear-diesel-crankcase',
  'loader-hood-forward-shoulder'],
 'loader-cab':['loader-operator-pedestal','cab-floor',
  'rollover-cage-upright','roof-canopy-panel','front-cage-crossbar'],
});
const TRACKS=Object.freeze({
 'loader-track-left':'crawler-track-assembly--1',
 'loader-track-right':'crawler-track-assembly-1',
});
function bounds(nodes,label){
 const box=new THREE.Box3();
 for(const node of nodes){
  node.updateWorldMatrix(true,true);
  box.union(new THREE.Box3().setFromObject(node));
 }
 if(box.isEmpty())throw Error('Missing physical geometry '+label);
 return {minX:box.min.x,maxX:box.max.x,minY:box.min.y,maxY:box.max.y,
  minZ:box.min.z,maxZ:box.max.z,source:label};
}
function namedMeshes(group,name){
 const found=[];
 group.traverse(n=>{if(n.name===name&&(n.isMesh||n.isGroup))found.push(n);});
 return found;
}
function trackSections(group,id){
 const sections={lower:[],upper:[],front:[],rear:[]};
 group.traverse(mesh=>{
  if(!mesh.isMesh)return;
  const n=mesh.name;
  if(!/connected-crawler-track-shoe|raised-track-cleat|track-drive-rim|track-sprocket|sprocket-tooth|track-road-wheel/.test(n))return;
  const rolling=/connected-crawler-track-shoe|raised-track-cleat/.test(n);
  const section=rolling&&mesh.position.y<.38?'lower':
   rolling&&mesh.position.y>1.27?'upper':
   mesh.position.z<0?'front':'rear';
  sections[section].push(mesh);
 });
 return Object.entries(sections).map(([section,nodes])=>{
  if(!nodes.length)throw Error('Missing '+id+' '+section+' structural steel');
  return {nodes,box:bounds(nodes,id+':'+section)};
 });
}
export function fitLiveBacklotMachineCollisions({tractor,loader},world){
 const sources=new Map();
 let visibleStructuralMeshes=0;
 for(const obstacle of world.obstacles){
  if(!COMPOUND_FAMILY_IDS.includes(obstacle.id))continue;
  const model=obstacle.id.startsWith('tractor-')?tractor:loader;
  let selected=[];
  if(TRACKS[obstacle.id]){
   const track=model.getObjectByName(TRACKS[obstacle.id]);
   if(!track)throw Error('Missing live track '+obstacle.id);
   selected=trackSections(track,obstacle.id);
  }else{
   for(const name of STRUCTURAL[obstacle.id]??[]){
    const nodes=namedMeshes(model,name);
    if(!nodes.length)throw Error('Missing real model '+obstacle.id+'/'+name);
    for(const node of nodes)
     selected.push({nodes:[node],box:bounds([node],obstacle.id+'/'+name)});
   }
  }
  if(!selected.length)throw Error('No hit shapes for '+obstacle.id);
  const parts=registerLiveCompoundPieces(obstacle,selected.map(s=>s.box));
  selected.forEach((entry,index)=>{
   sources.set(parts[index].partId,entry.nodes);
   visibleStructuralMeshes+=entry.nodes.length;
  });
 }
 if(sources.size<30||[...world.obstacles].filter(o=>
  COMPOUND_FAMILY_IDS.includes(o.id)).length!==12)
  throw Error('Incomplete live collision certificate');
 return {sources,physicalPieces:sources.size,visibleStructuralMeshes};
}
