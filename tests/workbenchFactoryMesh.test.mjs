import test from 'node:test';
import assert from 'node:assert/strict';
import {createDocument,addNode,newShape,validateDocument} from '../workbench/blueprint.js';
import {meshPointGroups,meshPointPage,updateMeshPoint} from '../workbench/editableMesh.js';

const mesh=()=>({type:'mesh',
 positions:[
  0,0,0, 1,0,0, 0,1,0,
  0,0,0, 0,1,0, 0,0,1
 ],
 indices:[0,1,2,3,4,5],
 normals:[0,0,1,0,0,1,0,0,1,1,0,0,1,0,0,1,0,0]});
test('imported triangle geometry retains source normals, indexed faces and paint',()=>{
 const node=newShape();node.geometry=mesh();node.materialColor=0x78866b;
 const doc=addNode(createDocument('Factory sample'),node);
 assert.equal(validateDocument(doc).nodes[1].geometry.indices.length,6);
 assert.equal(doc.nodes[1].materialColor,0x78866b);
});
test('editing duplicate hard-edge vertices moves the shared physical corner',()=>{
 const src=mesh(),groups=meshPointGroups(src);
 assert.equal(groups.length,4);
 const v=updateMeshPoint(src,0,[.125,.05,-.1]);
 assert.deepEqual(v.positions.slice(0,3),[.125,.05,-.1]);
 assert.deepEqual(v.positions.slice(9,12),[.125,.05,-.1]);
 assert.equal(v.normals,undefined,'Edited geometry should regenerate face normals');
 assert.deepEqual(src.positions.slice(0,3),[0,0,0],'Editor never mutates authored source mesh');
});
test('control-point paging is stable and clamps out-of-range pages',()=>{
 const base=mesh();
 assert.equal(meshPointPage(base,999).page,0);
 assert.ok(meshPointPage(base).points.length===4);
 assert.throws(()=>updateMeshPoint(base,99,[0,0,0]),/index/);
});
test('invalid mesh topology, nonfinite positions and unsafe colors are rejected',()=>{
 const bad=mesh();bad.indices=[0,1,900];assert.throws(()=>addNode(createDocument(),{...newShape(),geometry:bad}));
 const nan=mesh();nan.positions[0]=NaN;assert.throws(()=>meshPointGroups(nan));
 const shape=newShape();shape.geometry=mesh();shape.materialColor=0x1000000;
 assert.throws(()=>addNode(createDocument(),shape),/color/);
});
