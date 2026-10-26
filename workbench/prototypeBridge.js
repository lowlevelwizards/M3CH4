/** Explicit, sandbox-only V2 visual prototype bridge into M3CH4's REAL Test Yard.
 * No career saves, component definitions, combat selection or damage stats changed.
 */
import {validateDocument} from './blueprint.js';
import {compileBlueprint} from './geometry.js';
export const PROTOTYPE_KEY='m3ch4-workbench-yard-visual-v2';
export const PROTOTYPE_MAX_BYTES=180000;
const yardPath=()=>typeof location!=='undefined'&&/\/test-yard\.html$/.test(location.pathname);
export function readPrototype(){
 if(!yardPath()||new URLSearchParams(location.search).get('wb-prototype')!=='1')return null;
 try{
  const raw=sessionStorage.getItem(PROTOTYPE_KEY);
  if(!raw||raw.length>PROTOTYPE_MAX_BYTES)return null;
  const pkg=JSON.parse(raw);
  if(pkg?.format!=='m3ch4.workbench.prototype'||pkg.version!==1||pkg.target!=='legs-yard')return null;
  return validateDocument(pkg.blueprint);
 }catch(e){console.warn('Invalid Workbench Test Yard prototype ignored:',e);return null;}
}
/** Called only for the player, never for AI actors, inventory thumbnails, or other bays. */
export function attachPrototypeToPlayerExterior(exterior,assemblyId){
 if(assemblyId!=='legs-yard')return {ok:false,reason:'Prototype currently supports Yardwalker only.'};
 const doc=readPrototype();
 if(!doc)return {ok:false,reason:'No active Workbench prototype.'};
 let knee=null;
 exterior.root.traverse(n=>{if(n.name==='leftKnee')knee=n;});
 if(!knee)return {ok:false,reason:'The authentic Yardwalker knee joint was not found.'};
 try{
  const compiled=compileBlueprint(doc);
  compiled.root.name='WORKBENCH V2 / LEFT KNEE SANDBOX PROTOTYPE';
  compiled.root.traverse(n=>{
   if(!n.isMesh)return;
   n.userData.visualOnly=true;
   n.userData.workbenchPrototype=true;
   n.raycast=()=>{}; // cosmetic prototype is never a projectile or selection target
   n.castShadow=true;
  });
  knee.add(compiled.root);
  return {ok:true,nodeCount:doc.nodes.length-1};
 }catch(e){console.warn('Workbench prototype rejected:',e);return {ok:false,reason:e.message};}
}
export function packagePrototype(doc){
 const validated=validateDocument(doc);
 const pkg={format:'m3ch4.workbench.prototype',version:1,target:'legs-yard',blueprint:validated};
 const encoded=JSON.stringify(pkg);
 if(encoded.length>PROTOTYPE_MAX_BYTES)throw Error('Prototype too large for sandbox handoff. Export an asset bundle instead.');
 return encoded;
}
