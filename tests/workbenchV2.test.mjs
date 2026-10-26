import test from 'node:test';
import assert from 'node:assert/strict';
import {FORMAT,VERSION,createDocument,newShape,addNode,updateNode,clone,validateDocument,
 validateGeometry,duplicateNode,mirrorNode,groupNodes,makeAsset,insertAsset,removeNode,migrateCalfRecipe} from '../workbench/blueprint.js';
const create=()=>{const d=createDocument('Spec test');return addNode(d,newShape('plate'));};
test('V2 project and all eight primitive recipes are strictly validated',()=>{
 const d=createDocument();assert.equal(d.format,FORMAT);assert.equal(d.version,VERSION);
 for(const name of ['box','chamfer','cylinder','tube','wedge','plate','taper','loft']){
  const n=newShape(name);validateGeometry(n.geometry);assert.equal(addNode(d,n).nodes.length,2);
 }
});
test('project detects orphan nodes, parent cycles and impossible geometry',()=>{
 const d=create(),id=d.nodes[1].id;
 const copy=clone(d);copy.nodes[1].parentId='missing';assert.throws(()=>validateDocument(copy),/Orphan/);
 const cycled=clone(d);cycled.nodes[0].parentId=id;assert.throws(()=>validateDocument(cycled));
 const nan=clone(d);nan.nodes[1].transform.position[0]=NaN;assert.throws(()=>validateDocument(nan));
 const crossed=clone(d);crossed.nodes[1].geometry.profile=[[-1,-1],[1,1],[-1,1],[1,-1]];
 assert.throws(()=>validateDocument(crossed),/Zero-area|Self-intersecting/);
});
test('duplicate creates one source and independent child identity',()=>{
 let d=create();const id=d.nodes[1].id;
 const child=newShape('box',{parentId:id});d=addNode(d,child);
 const result=duplicateNode(d,id),copy=result.document;
 assert.equal(copy.nodes.length,5);
 const newRoot=copy.nodes.find(n=>n.id===result.selectedId);
 assert.notEqual(newRoot.id,id);
 assert.equal(copy.nodes.filter(n=>n.parentId===newRoot.id).length,1);
});
test('linked mirror shares source recipe but keeps separate identities',()=>{
 let d=create(),id=d.nodes[1].id;
 let result=mirrorNode(d,id,true);
 d=result.document;
 const mirrored=d.nodes.find(n=>n.id===result.selectedId);
 assert.equal(mirrored.mirrorOf,id);
 assert.ok(mirrored.id!==id);
 const source=d.nodes.find(n=>n.id===id),newGeo=clone(source.geometry);
 newGeo.profile[0][0]-=.03;
 d=updateNode(d,id,{geometry:newGeo});
 assert.deepEqual(d.nodes.find(n=>n.id===mirrored.id).mirrorOf,id);
});
test('saved part/assembly roundtrips without changing existing node IDs',()=>{
 let d=create(),id=d.nodes[1].id;
 const group=groupNodes(d,[id]);d=group.document;
 const asset=makeAsset(d,group.selectedId,'assembly','Lower leg');
 assert.equal(asset.type,'assembly');
 const insertion=insertAsset(d,asset);
 assert.equal(insertion.document.nodes.length,d.nodes.length+2);
 assert.ok(insertion.document.nodes.find(n=>n.id===insertion.selectedId));
 d=removeNode(insertion.document,insertion.selectedId);
 assert.equal(d.nodes.length,3);
});
test('V1 calf recipe migrates as editable profile loft without modifying V1 data',()=>{
 const old={version:1,id:'legs-yard/calf-shell',stations:[
  {width:.2,front:-.09,back:.09},{width:.3,front:-.1,back:.1},
  {width:.31,front:-.1,back:.1},{width:.25,front:-.07,back:.07},
  {width:.15,front:-.05,back:.05}
 ]};
 const copied=clone(old),doc=migrateCalfRecipe(old);
 assert.deepEqual(old,copied);
 assert.equal(doc.nodes[1].geometry.type,'loft');
 assert.equal(doc.nodes[1].geometry.sections.length,5);
});
