/** Non-executable chat-to-Workbench asset import. No production catalogue writes. */
import {clone,validateDocument} from './blueprint.js';
const allowedTypes=new Set(['shape','part','assembly']);
export function validateStandaloneAsset(input){
 if(!input||input.format!=='m3ch4.workbench.asset'||input.version!==2||!allowedTypes.has(input.type))
  throw Error('Expected a Workbench V2 Shape / Part / Assembly JSON asset');
 if(!Array.isArray(input.nodes)||!input.nodes.length||input.nodes.length>250)
  throw Error('Asset must contain 1–250 editable nodes');
 if(typeof input.name!=='string'||!input.name.trim()||input.name.length>100)throw Error('Invalid asset name');
 if(typeof input.rootId!=='string'||!input.nodes.some(n=>n.id===input.rootId))throw Error('Asset root missing');
 if(input.nodes.some(n=>n.id==='root'))throw Error('Reserved root ID in asset');
 const doc={format:'m3ch4.workbench',version:2,id:'import-validation',name:input.name,rootId:'root',nodes:[
  {id:'root',name:'Assembly',kind:'group',parentId:null,
   transform:{position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]},visible:true,locked:false,mirrorOf:null},
  ...input.nodes.map(node=>({...clone(node),parentId:node.id===input.rootId?'root':node.parentId}))
 ],references:[],metadata:{}};
 validateDocument(doc);
 if(input.nodes.filter(n=>n.kind==='shape').length===0)throw Error('Asset contains no editable geometry');
 return clone(input);
}
