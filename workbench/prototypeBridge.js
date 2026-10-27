/** Explicit, sandbox-only V2 visual prototype bridge into M3CH4's REAL Test Yard.
 * No career saves, component definitions, combat selection or damage stats changed.
 */
import * as THREE from 'three';
import {validateDocument} from './blueprint.js';
import {compileBlueprint} from './geometry.js';
export const PROTOTYPE_KEY='m3ch4-workbench-yard-visual-v2';
export const PROTOTYPE_MAX_BYTES=180000;
export const YARDWALKER_VISUAL_SLOTS=Object.freeze({
 left:{joint:'leftKnee',visual:'Y7-left-shaped-olive-calf'},
 right:{joint:'rightKnee',visual:'Y7-right-shaped-olive-calf'}
});
const yardPath=()=>typeof location!=='undefined'&&/\/test-yard\.html$/.test(location.pathname);
export function readPrototype(){
 return readPrototypePackage()?.blueprint||null;
}
function readPrototypePackage(){
 if(!yardPath()||new URLSearchParams(location.search).get('wb-prototype')!=='1')return null;
 try{
  const raw=sessionStorage.getItem(PROTOTYPE_KEY);
  if(!raw||raw.length>PROTOTYPE_MAX_BYTES)return null;
  const pkg=JSON.parse(raw);
  if(pkg?.format!=='m3ch4.workbench.prototype'||pkg.version!==1||pkg.target!=='legs-yard')return null;
  return {blueprint:validateDocument(pkg.blueprint),mode:pkg.mode==='replace-calf'?'replace-calf':'overlay',
  side:pkg.side==='right'?'right':'left'};
 }catch(e){console.warn('Invalid Workbench Test Yard prototype ignored:',e);return null;}
}
/** Called only for the player, never for AI actors, inventory thumbnails, or other bays. */
export function attachPrototypeToPlayerExterior(exterior,assemblyId){
 if(assemblyId!=='legs-yard')return {ok:false,reason:'Prototype currently supports Yardwalker only.'};
 const pkg=readPrototypePackage();
 if(!pkg)return {ok:false,reason:'No active Workbench prototype.'};
 const doc=pkg.blueprint;
 const slot=YARDWALKER_VISUAL_SLOTS[pkg.side];
 let knee=null;
 exterior.root.traverse(n=>{if(n.name===slot.joint)knee=n;});
 if(!knee)return {ok:false,reason:'The authentic Yardwalker knee joint was not found.'};
 try{
  const compiled=compileBlueprint(doc);
  compiled.root.name=pkg.side==='left'?'WORKBENCH V2 / LEFT KNEE SANDBOX PROTOTYPE':
   'WORKBENCH 3 / RIGHT KNEE SANDBOX PROTOTYPE';
  compiled.root.traverse(n=>{
   if(!n.isMesh)return;
   n.userData.visualOnly=true;
   n.userData.workbenchPrototype=true;
   n.raycast=()=>{}; // cosmetic prototype is never a projectile or selection target
   n.castShadow=true;
  });
  let shell=null;
  if(pkg.mode==='replace-calf'){
   knee.traverse(n=>{if(n.name===slot.visual)shell=n;});
   if(!shell){disposePrototype(compiled.root);return {ok:false,reason:'Original Yardwalker '+pkg.side+' calf visual not found.'};}
  }
  knee.add(compiled.root);knee.updateMatrixWorld(true);
  const candidate=new THREE.Box3().setFromObject(compiled.root);
  const original=shell?new THREE.Box3().setFromObject(shell):null;
  if(shell){
   shell.visible=false;
   compiled.root.userData.replacesVisual=slot.visual;
  }
  const originalSize=original?.getSize(new THREE.Vector3()),candidateSize=candidate.getSize(new THREE.Vector3());
  const fitReport={side:pkg.side,visualOnly:true,
   candidateSizeM:candidateSize.toArray().map(v=>+v.toFixed(3)),
   originalSizeM:originalSize?.toArray().map(v=>+v.toFixed(3))||null,
   note:'Broad-phase sizes only. Joint sweep and collision/hitzones are not certified.'};
  return {ok:true,nodeCount:doc.nodes.length-1,mode:pkg.mode,fitReport,
   warning:'Visual-only prototype; mass, collision and durability are factory-authored.'};
 }catch(e){console.warn('Workbench prototype rejected:',e);return {ok:false,reason:e.message};}
}
function disposePrototype(root){
 root.traverse(n=>{if(n.isMesh)n.geometry?.dispose?.();});
}
export function packagePrototype(doc,{mode='overlay',side='left'}={}){
 if(!YARDWALKER_VISUAL_SLOTS[side])throw Error('Unsupported Yardwalker visual preview side');
 if(!['overlay','replace-calf'].includes(mode))throw Error('Unsupported visual prototype mode');
 const validated=validateDocument(doc);
 const pkg={format:'m3ch4.workbench.prototype',version:1,target:'legs-yard',mode,side,blueprint:validated};
 const encoded=JSON.stringify(pkg);
 if(encoded.length>PROTOTYPE_MAX_BYTES)throw Error('Prototype too large for sandbox handoff. Export an asset bundle instead.');
 return encoded;
}
