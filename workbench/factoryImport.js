/** Import *authentic* M3CH4 visual nodes into editable Workbench V2 blueprints.
 * Preserve named groups, rotations, parent joints, original indexed triangles
 * and authored paint. Imports never mutate live catalogue or gameplay stats.
 */
import * as THREE from 'three';
import {CATALOG,makeTestAssembly} from '../components.js';
import {buildPartVisual} from '../partVisuals.js';
import {buildExteriorRig} from '../scene.js';
import {readTestYardAssembly} from '../testYard.js';
import {loadStable} from '../stable.js';
import {bayAssembly,BAY_IDS} from '../garageBay.js';
import {clone,createDocument,validateDocument,identity} from './blueprint.js';

const MAX_NODES=900;
const number=n=>Math.round(n*1e5)/1e5;
const idOf=(prefix,n)=>prefix+'-'+n;
function transformFrom(object){
 const rotation=new THREE.Euler().setFromQuaternion(object.quaternion,'XYZ');
 return {
  position:object.position.toArray().map(number),
  rotation:[rotation.x,rotation.y,rotation.z].map(number),
  scale:object.scale.toArray().map(number)
 };
}
function sourceGeometry(mesh){
 const g=mesh.geometry,pos=g?.getAttribute?.('position');
 if(!pos||pos.itemSize!==3)return null;
 if(pos.count<3||pos.count>12000)throw Error('Geometry too dense to edit on phone: '+mesh.name+' ('+pos.count+' vertices)');
 const positions=[];
 for(let i=0;i<pos.count;i++)positions.push(number(pos.getX(i)),number(pos.getY(i)),number(pos.getZ(i)));
 const index=g.getIndex(),indices=index?Array.from(index.array):Array.from({length:pos.count},(_,i)=>i);
 // Many procedural primitives are indexed, but non-indexed meshes also work.
 if(indices.length%3!==0||indices.length>90000)throw Error('Invalid triangle list on '+mesh.name);
 const normals=g.getAttribute('normal'),normalArray=[];
 if(normals?.count===pos.count)for(let i=0;i<normals.count;i++){
  normalArray.push(number(normals.getX(i)),number(normals.getY(i)),number(normals.getZ(i)));
 }
 const groups=Array.isArray(mesh.material)&&mesh.material.length>1?
  g.groups.filter(a=>a.count>0).map(a=>({start:a.start,count:a.count,materialIndex:a.materialIndex})):undefined;
 return {type:'mesh',positions,indices,
  ...(normalArray.length===positions.length?{normals:normalArray}:{}),
  ...(groups?.length?{groups}:{})};
}
function materialsFor(mesh){
 const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
 const colors=materials.map(m=>m?.color?.getHex?.()??0x849275);
 return {materialColor:colors[0],...(colors.length>1?{materialColors:colors.slice(0,16)}:{})};
}
/** The root is an editable independent COPY of the actual game part. */
export function captureFactoryVisual(source,{name,kind='part',definitionId=null}={}){
 if(!source?.isObject3D)throw Error('No production 3D object to import');
 const doc=createDocument(name||source.name||'Imported game component');
 doc.metadata={...doc.metadata,source:{kind,definitionId,importedAt:Date.now()},
   warning:'Visual-only editable copy. Game mounts, dynamics and catalogue entries remain untouched.'};
 let sequence=0,count=0;
 function visit(object,parentId){
  if(object.isLine||object.isPoints||object.isSprite||object.userData?.previewOnly&&object.isLineSegments)return;
  if(object.isInstancedMesh||object.isSkinnedMesh)throw Error('Unsupported instanced/skinned mesh: '+object.name);
  const geometry=object.isMesh?sourceGeometry(object):null;
  if(object.isMesh&&!geometry)return;
  const id=idOf('factory',++sequence);
  const name=(object.name||((object.isMesh?'Mesh ':'Group ')+sequence)).slice(0,100);
  const node={
   id,name,kind:object.isMesh?'shape':(object.userData?.joint?'anchor':'group'),
   parentId,transform:transformFrom(object),visible:object.visible,
   locked:!!object.userData?.joint,mirrorOf:null
  };
  if(geometry){
   node.geometry=geometry;node.materialRole='olive';
   Object.assign(node,materialsFor(object));count++;
  }
  if(node.kind==='anchor')node.anchorRole=String(object.userData.joint);
  if(doc.nodes.length>=MAX_NODES)throw Error('This assembly exceeds the current mobile object budget. Import its parts individually.');
  doc.nodes.push(node);
  for(const child of object.children)visit(child,id);
 }
 visit(source,'root');
 if(!count)throw Error('Game component has no editable meshes');
 return {document:validateDocument(doc),meshCount:count,groupCount:doc.nodes.length-1-count};
}
function partWithFallback(definition){
 const primary=buildPartVisual(definition.id,{mode:'gameplay'});
 if(primary)return primary;
 // Legacy power packs are authored directly by the production exterior
 // renderer. Build their actual slot on a disposable factory test rig.
 const assembly=makeTestAssembly();
 const owned=assembly.owned.find(x=>x.definitionId===definition.id);
 if(!owned)throw Error('Unknown factory part '+definition.id);
 assembly.installed[definition.slot]=owned.serial;
 const exterior=buildExteriorRig(assembly);
 const part=exterior.partGroups.get(definition.slot);
 if(!part)throw Error('Factory renderer returned no group for '+definition.id);
 part.parent?.remove(part);
 part.position.set(0,0,0);
 return part;
}
export function importFactoryPart(definitionId){
 const definition=CATALOG.find(c=>c.id===definitionId);
 if(!definition)throw Error('Unknown catalogue part: '+definitionId);
 return captureFactoryVisual(partWithFallback(definition),{
  name:definition.name+' / editable copy',kind:'factory-part',definitionId
 });
}
export function importFactoryAssembly(kind='yard'){
 if(!['yard','default'].includes(kind))throw Error('Unknown factory assembly');
 const assembly=kind==='yard'?readTestYardAssembly():makeTestAssembly();
 const exterior=buildExteriorRig(assembly);
 const result=captureFactoryVisual(exterior.root,{
  name:(kind==='yard'?'TEST YARD':'FACTORY')+' / '+(assembly.name||'Mech assembly'),
  kind:'factory-assembly'
 });
 result.document.metadata.source.slots=Object.fromEntries(
  Object.entries(assembly.installed||{}).map(([slot,serial])=>
   [slot,assembly.owned.find(p=>p.serial===serial)?.definitionId||null])
 );
 return result;
}
/** Snapshot of one of the real player's saved career rigs. This is read-only:
 * never writes to the stable or career machine persistence keys.
 */
export function importSavedGarageBay(index){
 if(!Number.isInteger(index)||index<0||index>=BAY_IDS.length)
  throw Error('Invalid garage bay index');
 // loadStable normalizes/synchronizes records and calls setItem during
 // recovery. Route these writes to an ephemeral snapshot; importing a visual
 // must NEVER rewrite the player's real career inventory or stable.
 const shadow=new Map();
 const readOnlySnapshot={
  getItem:key=>shadow.has(key)?shadow.get(key):window.localStorage.getItem(key),
  setItem:(key,value)=>shadow.set(key,String(value)),
  removeItem:key=>shadow.set(key,null)
 };
 const stable=loadStable(readOnlySnapshot).stable;
 const assembly=bayAssembly(stable,BAY_IDS[index]);
 if(!assembly)throw Error('Garage bay not present in saved stable');
 if(!Object.values(assembly.installed||{}).some(Boolean))
  throw Error('This garage bay has no installed parts yet.');
 const result=captureFactoryVisual(buildExteriorRig(assembly).root,{
  name:'GARAGE BAY '+(index+1)+' / '+assembly.name,
  kind:'saved-garage-bay'
 });
 result.document.metadata.source.bay=BAY_IDS[index];
 result.document.metadata.source.slots=Object.fromEntries(
  Object.entries(assembly.installed||{}).map(([slot,serial])=>
   [slot,assembly.owned.find(p=>p.serial===serial)?.definitionId||null])
 );
 return result;
}

export function factoryCatalogueOptions(){
 return CATALOG.map(c=>({id:c.id,name:c.name,slot:c.slot}));
}
