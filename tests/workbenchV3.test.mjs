import test from 'node:test';
import assert from 'node:assert/strict';
import {createDocument,newShape,addNode,makeAsset} from '../workbench/blueprint.js';
import {selectedInRectangle,rectFromPoints,selectedCentroid} from '../workbench/selectionGeometry.js';
import {transformMeshGroups,transformProfilePoints} from '../workbench/vertexTransforms.js';
import {validateStandaloneAsset} from '../workbench/assetImport.js';
import {inspectBlueprint} from '../workbench/geometryAudit.js';
const rect=rectFromPoints({x:80,y:60},{x:20,y:10});
test('box selection uses entire candidate collection and true visible/through policy',()=>{
 const pts=[{id:'a',x:25,y:15,visible:true},{id:'b',x:25,y:15,visible:false},
 {id:'c',x:45,y:35,visible:true},{id:'out',x:101,y:15,visible:true}];
 assert.deepEqual([...selectedInRectangle(pts,rect)],['a','c']);
 assert.deepEqual([...selectedInRectangle(pts,rect,{through:true})],['a','b','c']);
 assert.deepEqual([...selectedInRectangle(pts,rect,{through:true,operation:'subtract',previous:['a','out']})],['out']);
 assert.deepEqual([...selectedInRectangle(pts,rect,{operation:'add',previous:['out']})],['out','a','c']);
});
test('relative grouped move preserves offsets and untouched welded vertices',()=>{
 const mesh={type:'mesh',positions:[0,0,0,1,0,0,0,1,0,0,0,0,1,0,0,0,1,1],
  indices:[0,1,2,3,4,5]};
 const original=JSON.parse(JSON.stringify(mesh));
 const changed=transformMeshGroups(mesh,[0,1],{delta:[.1,.2,0]});
 assert.equal(changed.positions[0],.1);
 assert.equal(changed.positions[9],.1);
 assert.equal(changed.positions[3],1.1);
 assert.equal(changed.positions[6],0);
 assert.deepEqual(mesh,original);
 assert.throws(()=>transformMeshGroups(mesh,[99],{delta:[0,0,0]}),/Invalid selected/);
});
test('profile group edits preserve unselected vertices and reject crossed faces',()=>{
 const plate=newShape('plate').geometry;
 const moved=transformProfilePoints(plate,[1,2],{delta:[.07,0,0]});
 assert.equal(moved.profile[1][0],plate.profile[1][0]+.07);
 assert.deepEqual(moved.profile[0],plate.profile[0]);
 assert.deepEqual(plate,newShape('plate').geometry);
});
test('strict asset import roundtrips existing Workbench V2 schema and rejects bad graphs',()=>{
 const n=newShape('plate');
 const doc=addNode(createDocument('Draft'),n);
 const asset=makeAsset(doc,n.id,'part','Workshop plate');
 const copy=validateStandaloneAsset(asset);
 assert.equal(copy.name,'Workshop plate');
 assert.notEqual(copy,asset);
 assert.throws(()=>validateStandaloneAsset({...asset,format:'javascript'}),/Expected/);
 assert.throws(()=>validateStandaloneAsset({...asset,nodes:[{...asset.nodes[0],geometry:{type:'unknown'}}]}));
});
test('audit reports only advisory model details and leaves blueprint unchanged',()=>{
 const doc=addNode(createDocument('Demo'),newShape('box'));const before=JSON.stringify(doc);
 const audit=inspectBlueprint(doc);
 assert.equal(audit.shapes,1);assert.equal(audit.vertices,0);
 assert.match(audit.note,/Advisory/);assert.equal(JSON.stringify(doc),before);
 assert.deepEqual(selectedCentroid([[0,0,0],[2,4,6]]),[1,2,3]);
});
