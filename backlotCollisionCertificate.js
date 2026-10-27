/** Backlot k5s2 - shared collision/display certificate.
 *
 * Offsite wagons, silos, poles, gates and shacks are set dressing, outside
 * the combat bounds. Deliberately DO NOT manufacture AABBs for them:
 * adding solid cover outside the yard is not a physical promotion.
 *
 * These checks run on the actual authored render graph, before decoration
 * instancing, and on the actual solids used by the firing raycaster.
 */
import * as THREE from 'three';
import {collisionPieces,COMPOUND_FAMILY_IDS,hasLiveCompoundPieces} from './backlotCompoundGeometry.js';

const SECONDARY=/^secondary-(?:trailer-|fuel-counter-|mechanic-|working-grain-|power-pole-|derby-gate|hog-pen-)/;
const EPS=.035,SAFE_MARGIN=.65;
const rounded=n=>Math.round(n*1000)/1000;
function boundaryClearance(box,world){
 // Positive = gap between the outside object and nearest PLAYABLE rectangle.
 // A model that touches or intrudes into the actual combat bounds is negative.
 const left=world.minX-box.max.x,right=box.min.x-world.maxX;
 const near=world.minZ-box.max.z,far=box.min.z-world.maxZ;
 return Math.max(left,right,near,far);
}
export function secondaryGeometryClearance(root,world,{margin=SAFE_MARGIN}={}){
 root.updateMatrixWorld(true);
 const items=[];
 for(const group of root.children){
  if(!group.isGroup||!SECONDARY.test(group.name))continue;
  const box=new THREE.Box3().setFromObject(group);
  const gap=boundaryClearance(box,world);
  items.push(Object.freeze({id:group.name,
    clearance:rounded(gap),
    minX:rounded(box.min.x),maxX:rounded(box.max.x),
    minZ:rounded(box.min.z),maxZ:rounded(box.max.z),
    safe:gap>=margin}));
 }
 const bad=items.filter(item=>!item.safe);
 return Object.freeze({expected:18,count:items.length,requiredClearance:margin,
  pass:items.length===18&&bad.length===0,
  offsiteWithoutCollider:items.length,
  errors:[...(items.length===18?[]:['Expected eighteen rebuilt offsite props']),
    ...bad.map(item=>item.id+' intersects or approaches the playable yard')],
  items});
}
export function auditBacklotCollisionTruth(root,world,solids,visibleSources=new Map()){
 const secondary=secondaryGeometryClearance(root,world);
 const parents=new Map((world.obstacles||[]).map(o=>[o.id,o]));
 const expectedParts=new Map();
 for(const o of parents.values())for(const part of collisionPieces(o)){
  const key=part.partId??o.id;
  if(expectedParts.has(key))throw Error('Duplicate physical part '+key);
  expectedParts.set(key,{parent:o,part});
 }
 const hits=new Map();
 const errors=[...secondary.errors];
 for(const o of parents.values())if(COMPOUND_FAMILY_IDS.includes(o.id)&&
    !hasLiveCompoundPieces(o))errors.push('No real visible-metal fit '+o.id);
 // Compare independently against each real transformed structural mesh.
 // This catches model movement/scale drift, not just collider self-consistency.
 for(const [key,nodes] of visibleSources){
  const entry=expectedParts.get(key);
  if(!entry){errors.push('Unknown visible part '+key);continue;}
  const actual=new THREE.Box3();
  for(const node of nodes)actual.union(new THREE.Box3().setFromObject(node));
  const p=entry.part;
  for(const [have,want,axis] of [
   [actual.min.x,p.minX,'minX'],[actual.max.x,p.maxX,'maxX'],
   [actual.min.y,p.minY,'minY'],[actual.max.y,p.maxY,'maxY'],
   [actual.min.z,p.minZ,'minZ'],[actual.max.z,p.maxZ,'maxZ']])
   if(Math.abs(have-want)>EPS)
    errors.push(key+' visible steel differs from hit prism '+axis);
 }
 for(const key of expectedParts.keys())if(key.includes('::')&&!visibleSources.has(key))
  errors.push('Unwitnessed compound collider '+key);
 for(const solid of solids||[]){
  const id=solid.userData?.arenaObstacleId;
  if(!id||id==='floor')continue;
  const key=solid.userData?.compoundPartId??id;
  const expected=expectedParts.get(key);
  if(!expected||expected.parent.id!==id){
   errors.push('Unexpected physical collider '+key);continue;
  }
  hits.set(key,(hits.get(key)||0)+1);
  const p=expected.part;
  solid.updateWorldMatrix(true,false);
  const actual=new THREE.Box3().setFromObject(solid);
  for(const [have,want,axis] of [
   [actual.min.x,p.minX,'minX'],[actual.max.x,p.maxX,'maxX'],
   [actual.min.z,p.minZ,'minZ'],[actual.max.z,p.maxZ,'maxZ'],
   [actual.min.y,p.minY??0,'minY'],[actual.max.y,p.maxY??p.height,'maxY']]){
   if(Math.abs(have-want)>EPS)
    errors.push(key+' hit prism differs from physical '+axis+
      ' (render '+rounded(have)+', rule '+rounded(want)+')');
  }
 }
 for(const key of expectedParts.keys())
  if(hits.get(key)!==1)
   errors.push(key+' must have exactly one raycast prism; got '+(hits.get(key)||0));
 const artGroups=root.children.filter(group=>SECONDARY.test(group.name));
 for(const group of artGroups)
  group.traverse(o=>{
   if(o.userData?.arenaObstacleId)
    errors.push('Offsite scenery incorrectly marked as a projectile/AI solid: '+group.name);
  });
 return Object.freeze({
  pass:errors.length===0,
  gameplayObstacleCount:parents.size,
  compoundFamilyCount:COMPOUND_FAMILY_IDS.length,
  visuallyCertifiedParts:visibleSources.size,
  expectedPhysicalParts:expectedParts.size,
  authoritativeRaycastSolids:[...hits.values()].reduce((a,b)=>a+b,0),
  uncollidableOffsiteAssets:secondary.count,
  secondary,
  errors,
 });
}
/** Explicit disposition of existing gallery anatomy.
 * These still require compound shape fitting BEFORE their live box blockers
 * can be deleted. Treating OPEN cab, track or tyre voids as fully opaque
 * would preserve invisible hits and is not an acceptable promotion.
 */
export const ANATOMY_COLLISION_PROMOTION=Object.freeze({
  currentPolicy:'tractor-and-loader-compound-live; other-families-await-fit',
  galleryOnly:false,
  promotedFamilies:Object.freeze(['tractor','loader']),
  plannedFamilies:Object.freeze([
   'combine','pickup','engine','coupling','generator',
   'turbine','tyres','drums','flatbed','barricade','container','concrete',
  ]),
});
