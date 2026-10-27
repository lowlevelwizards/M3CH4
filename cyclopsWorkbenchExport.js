/** Deterministic, pure Workbench V2 export of the approved Cyclops concept master.
 * JSON is an editable visual asset, not authoritative armor/damage/collision data.
 */
import {CYCLOPS_CORE,CYCLOPS_ARMOR,CYCLOPS_GROUPS,CYCLOPS_REFERENCE_COLORS,
 cyclopsVariantShapes} from './cyclopsDesign.js';
import {validateStandaloneAsset} from './workbench/assetImport.js';
const identity=()=>({position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]});
const ROLES={ochre:'ochre',cream:'armor',teal:'teal',iron:'iron',
 loadSteel:'iron',optic:'teal',opticRecess:'dark',recess:'dark',
 glass:'dark',raw:'bright',bright:'bright'};
export const CYCLOPS_VARIANT_NAMES=Object.freeze(['naked','light','armored','encased']);
export function makeCyclopsWorkbenchAsset(tier){
 if(!Number.isInteger(tier)||tier<0||tier>3)throw Error('Cyclops tier must be 0–3');
 const rootId='cyclops-master';
 const nodes=[{id:rootId,name:'Cyclops / Concept Reconstruction',kind:'group',
   parentId:null,transform:identity(),visible:true,locked:false,mirrorOf:null}];
 const groups=new Map();
 for(const s of cyclopsVariantShapes(tier)){
   if(!groups.has(s.group)){
     const id='grp-'+groups.size;
     groups.set(s.group,id);
     nodes.push({id,name:CYCLOPS_GROUPS[s.group]||s.group,
       kind:'group',parentId:rootId,transform:identity(),
       visible:true,locked:false,mirrorOf:null});
   }
   nodes.push({
     id:'c-'+s.id,name:s.name,kind:'shape',parentId:groups.get(s.group),
     geometry:s.geometry,transform:{position:s.position,rotation:s.rotation,scale:[1,1,1]},
     materialRole:ROLES[s.material]||'iron',
     materialColor:CYCLOPS_REFERENCE_COLORS[s.material],
     visible:true,locked:false,mirrorOf:null,
     ...(s.armorId?{armorPlateId:s.armorId}:{})
   });
 }
 return validateStandaloneAsset({
   format:'m3ch4.workbench.asset',version:2,id:'cyclops-concept-tier-'+tier,revision:1,
   type:'part',name:'Cyclops / '+tier+' '+CYCLOPS_VARIANT_NAMES[tier][0].toUpperCase()+CYCLOPS_VARIANT_NAMES[tier].slice(1),
   rootId,nodes,
   metadata:{definitionId:'cab-cyclops',
     reference:'2026-10-27 approved Cyclops 4-tier concept sheet',
     armorTier:tier,source:'cyclopsDesign.js',visualOnly:true,
     notes:'Editable visual draft; gameplay durability, collision and mass remain production-authoritative.'}
 });
}
export function assertCyclopsDesignConsistency(){
 if(CYCLOPS_CORE.length<30)throw Error('Incomplete Cyclops naked core');
 const ids=new Set();
 for(const shape of CYCLOPS_CORE){
   if(ids.has(shape.id))throw Error('Duplicate core shape ID '+shape.id);
   ids.add(shape.id);
 }
 if(Object.keys(CYCLOPS_ARMOR).length!==8)throw Error('Expected 8 armor identities');
 const expected=[0,2,4,8];
 for(let tier=0;tier<=3;tier++){
   const actual=cyclopsVariantShapes(tier).filter(s=>s.armorId).length;
   if(actual!==expected[tier])throw Error('Unexpected Cyclops armor count at tier '+tier);
 }
 return true;
}
