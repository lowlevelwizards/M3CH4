/** Joint-aware, deterministic Workbench V2 asset exports for Yardwalker.
 * Production uses the same canonical shapes, placed under original joint anchors.
 */
import {YARDWALKER_DESIGN as design} from './yardwalkerDesignData.js';
import {validateStandaloneAsset} from './workbench/assetImport.js';
export const YARDWALKER_TIERS=Object.freeze(['naked','guarded','heavy','encased']);
const materialRoles={ochre:'ochre',cream:'armor',charcoal:'dark',iron:'iron',
  olive:'olive',orange:'orange',teal:'teal',bright:'bright',dark:'dark'};
const colors={ochre:0xb48c37,cream:0xcac4ae,charcoal:0x535d56,
  iron:0x4c5a56,olive:0x78866b,orange:0xb9684c,
  teal:0x60999a,bright:0x9ba6a3,dark:0x293431};
const identity=()=>({position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]});
export function armorVariant(armor,tier){
 return [...armor.variants].reverse().find(v=>v.tier<=tier)||null;
}
export function yardwalkerShapes(tier){
 if(!Number.isInteger(tier)||tier<0||tier>3)throw Error('Invalid Yardwalker tier');
 return [...design.core.map(s=>({...s,armorId:null})),
 ...design.armor.flatMap(s=>{
   if(s.tier>tier)return [];
   const v=armorVariant(s,tier);
   if(!v)throw Error('Armor without a valid geometry variant: '+s.id);
   return [{
    id:s.id,parent:s.parent,name:s.id,material:s.material,
    geometry:v.geometry,position:v.position,rotation:v.rotation,
    armorId:s.id
   }];
 })];
}
export function makeYardwalkerWorkbenchAsset(tier){
 const labels=['Naked','Guarded','Heavy','Encased'];
 const rootId='yardwalker-master';
 const nodes=[{id:rootId,name:'YARDWALKER / ARTICULATED MASTER',kind:'group',
  parentId:null,transform:identity(),visible:true,locked:false,mirrorOf:null}];
 for(const a of design.anchors){
  nodes.push({
    id:'yw-'+a.id,name:a.id==='carriage'?'YARDWALKER / WORK-CARRIAGE':a.id,
    kind:a.joint?'anchor':'group',
    parentId:a.parent?'yw-'+a.parent:rootId,
    transform:{position:a.position,rotation:a.rotation,scale:[1,1,1]},
    visible:true,locked:!!a.joint,mirrorOf:null,
    ...(a.joint?{anchorRole:a.joint,side:a.side}:{})
  });
 }
 for(const s of yardwalkerShapes(tier)){
  nodes.push({
   id:'yw-'+s.id,name:s.name,kind:'shape',parentId:'yw-'+s.parent,
   geometry:s.geometry,
   transform:{position:s.position,rotation:s.rotation,scale:[1,1,1]},
   materialRole:materialRoles[s.material]||'iron',
   materialColor:colors[s.material]||colors.iron,
   visible:true,locked:false,mirrorOf:null,
   ...(s.armorId?{armorPlateId:s.armorId}:{})
  });
 }
 return validateStandaloneAsset({
  format:'m3ch4.workbench.asset',version:2,id:'yardwalker-concept-'+tier,
  revision:1,type:'part',name:'Yardwalker / '+tier+' '+labels[tier],
  rootId,nodes,metadata:{definitionId:'legs-yard',
   reference:design.reference,
   armorTier:tier,source:'yardwalker-design/master.json',version:'Yardwalker-V2',
   visualOnly:true,articulated:true,
   note:'Edit joint-relative geometry; full production IK/damage requires yardwalkerVisual.js adapter.'}
 });
}
export function assertYardwalkerDesign(){
 if(design.format!=='m3ch4.yardwalker.design'||design.version!==2||
   design.definitionId!=='legs-yard')throw Error('Invalid Yardwalker master header');
 if(design.core.length<32||design.core.length>54)throw Error('Yardwalker exceeds intended clean anatomy shape budget');
 const ids=new Set();
 for(const s of [...design.anchors,...design.core,...design.armor]){
  if(ids.has(s.id))throw Error('Duplicate Yardwalker ID '+s.id);
  ids.add(s.id);
 }
 for(const s of [...design.core,...design.armor])
  if(!design.anchors.some(a=>a.id===s.parent))throw Error('Orphan geometry '+s.id);
 const expected=[0,4,6,8];
 for(let tier=0;tier<4;tier++){
  const count=yardwalkerShapes(tier).filter(s=>s.armorId).length;
  if(count!==expected[tier])throw Error('Invalid tier '+tier+' count '+count);
 }
 return true;
}
