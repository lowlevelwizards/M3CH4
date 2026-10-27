/** Non-destructive parent operations in the editor's real Three.js hierarchy.
 * Throw if a TRS-only blueprint cannot represent the required world matrix.
 */
import * as THREE from 'three';
import {clone,identity,validateDocument} from './blueprint.js';
const EPS=2e-4;
function worldMatrix(nodes,id,map=new Map(nodes.map(n=>[n.id,n]))){
 const node=map.get(id);if(!node)throw Error('Missing object '+id);
 const t=node.transform,scale=t.scale.slice();
 if(node.mirrorOf)scale[0]*=-1;
 const local=new THREE.Matrix4().compose(
  new THREE.Vector3(...t.position),
  new THREE.Quaternion().setFromEuler(new THREE.Euler(...t.rotation,'XYZ')),
  new THREE.Vector3(...scale)
 );
 return node.parentId?worldMatrix(nodes,node.parentId,map).multiply(local):local;
}
function localTransform(world,parent,node){
 const relative=parent.clone().invert().multiply(world);
 const position=new THREE.Vector3(),rotation=new THREE.Quaternion(),scale=new THREE.Vector3();
 relative.decompose(position,rotation,scale);
 const rebuilt=new THREE.Matrix4().compose(position,rotation,scale);
 if(relative.elements.some((v,i)=>Math.abs(v-rebuilt.elements[i])>EPS))throw Error('Cannot preserve pose: nonuniform scale and rotation introduce shear');
 if(node.mirrorOf)scale.x*=-1;
 const result={position:position.toArray(),rotation:new THREE.Euler().setFromQuaternion(rotation,'XYZ').toArray().slice(0,3),scale:scale.toArray()};
 if(result.scale.some(x=>x<=.001||x>30))throw Error('A mirrored or negative-scale parent would distort this part');
 return result;
}
export function moveNodeToParent(document,nodeId,parentId){
 const doc=clone(document),node=doc.nodes.find(n=>n.id===nodeId),parent=doc.nodes.find(n=>n.id===parentId);
 if(!node||!parent||nodeId==='root'||node.locked)throw Error('Select an unlocked object');
 if(!['group','anchor'].includes(parent.kind))throw Error('Choose a group or anchor as parent');
 let cursor=parent,seen=new Set();
 while(cursor){if(cursor.id===nodeId)throw Error('Cannot parent a node to its descendant');
  if(seen.has(cursor.id))throw Error('Cyclic hierarchy');seen.add(cursor.id);
  cursor=doc.nodes.find(n=>n.id===cursor.parentId);
 }
 const originalWorld=worldMatrix(doc.nodes,nodeId),newParentWorld=worldMatrix(doc.nodes,parentId);
 node.transform=localTransform(originalWorld,newParentWorld,node);node.parentId=parentId;
 return validateDocument(doc);
}
export function ungroupPreservingPose(document,groupId){
 const doc=clone(document),group=doc.nodes.find(n=>n.id===groupId);
 if(!group||group.kind!=='group'||groupId==='root'||group.locked)throw Error('Select an unlocked group');
 // Use unmodified document world matrices for all children before deleting group.
 const original=clone(document);
 for(const child of doc.nodes.filter(n=>n.parentId===groupId)){
  const before=worldMatrix(original.nodes,child.id),parentWorld=worldMatrix(original.nodes,group.parentId);
  child.transform=localTransform(before,parentWorld,child);child.parentId=group.parentId;
 }
 doc.nodes=doc.nodes.filter(n=>n.id!==groupId);
 return validateDocument(doc);
}
export function groupPreservingPose(document,nodeIds){
 const ids=[...new Set(nodeIds)].filter(id=>id!=='root');
 if(!ids.length)throw Error('Select nodes to group');
 let doc=clone(document);
 const groupId='wb-group-'+(globalThis.crypto?.randomUUID?.()||Date.now().toString(36));
 doc.nodes.push({id:groupId,name:'New group',kind:'group',parentId:'root',
  transform:identity(),visible:true,locked:false,mirrorOf:null});
 for(const id of ids)doc=moveNodeToParent(doc,id,groupId);
 return {document:validateDocument(doc),selectedId:groupId};
}
