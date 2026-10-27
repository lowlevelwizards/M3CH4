import test from 'node:test';
import assert from 'node:assert/strict';
import {createDocument,newShape,addNode,clone,defaultGeometry} from '../workbench/blueprint.js';
import {createEditTransaction} from '../workbench/editTransactions.js';
import {freezeLogicalVertexGroups,deriveLogicalVertexGroups,meshAdjacency,insertProfilePoint,insertLoftSection} from '../workbench/meshTopology.js';
import {meshPointGroups,updateMeshPoint} from '../workbench/editableMesh.js';
import {transformMeshGroups} from '../workbench/vertexTransforms.js';
import {moveLoftControls} from '../workbench/loftTransforms.js';
import {bakeXReflection} from '../workbench/mirrorGeometry.js';
import {selectableElements,modifyElementVertexSelection} from '../workbench/elementSelection.js';
import {deepMeshAudit} from '../workbench/geometryAudit.js';

test('cancelled transaction restores a validated document without mutating initial',()=>{
 const d=addNode(createDocument('Fixture'),newShape('box'));
 const session=createEditTransaction(d,'Drag');
 const changed=clone(d);changed.nodes[1].transform.position[0]=1;
 session.update(changed);const original=session.cancel();
 assert.deepEqual(original,d);assert.deepEqual(d.nodes[1].transform.position,[0,0,0]);
 assert.throws(()=>session.commit(),/already cancelled/);
});
test('transaction commits one valid complete snapshot',()=>{
 const d=addNode(createDocument('Fixture'),newShape('box'));
 const transaction=createEditTransaction(d);const edited=clone(d);
 edited.nodes[1].transform.scale=[1.5,1,1];transaction.update(edited);
 assert.deepEqual(transaction.commit().nodes[1].transform.scale,[1.5,1,1]);
 assert.throws(()=>transaction.update(edited),/already committed/);
});
test('stable vertex groups stay numbered when coincident points move away',()=>{
 const mesh={type:'mesh',positions:[0,0,0,1,0,0,0,1,0,0,0,0,1,0,0,0,1,1],indices:[0,1,2,3,4,5]};
 const snap=freezeLogicalVertexGroups(mesh),count=meshPointGroups(snap).length;
 assert.equal(count,4);
 const displaced=updateMeshPoint(snap,0,[.4,.3,0]);
 assert.equal(meshPointGroups(displaced).length,count);
 assert.deepEqual(meshPointGroups(displaced)[0].indices,[0,3]);
 assert.deepEqual(snap.positions,mesh.positions);
 assert.throws(()=>freezeLogicalVertexGroups({...mesh,pointGroups:[[0],[0,1,2,3,4,5]]}),/Overlapping/);
 const grouped=transformMeshGroups(mesh,[0],{delta:[.2,0,0]});
 assert.deepEqual(grouped.pointGroups[0],[0,3]);
});
test('edge topology and contextual profile insertion validate',()=>{
 const mesh={type:'mesh',positions:[0,0,0,1,0,0,0,1,0],indices:[0,1,2]};
 assert.equal(meshAdjacency(mesh).edges.length,3);
 const profile=defaultGeometry('plate'),next=insertProfilePoint(profile,1,.25);
 assert.equal(next.profile.length,5);assert.equal(profile.profile.length,4);
 assert.throws(()=>insertProfilePoint(profile,99),/Invalid/);
});
test('loft inserts at chosen interval and group move updates shared section only once',()=>{
 const loft=defaultGeometry('loft');const inserted=insertLoftSection(loft,1);
 assert.equal(inserted.sections.length,5);assert.equal(loft.sections.length,4);
 const before=clone(loft);
 const moved=moveLoftControls(loft,[{kind:'front',index:2},{kind:'back',index:2},{kind:'width',index:2}],{delta:[.01,.02,.01]});
 assert.equal(moved.sections[2].y,Number((before.sections[2].y+.02).toFixed(5)));
 assert.equal(moved.sections[2].width,Number((before.sections[2].width-.02).toFixed(5)));
 assert.deepEqual(loft,before);
 assert.throws(()=>moveLoftControls(loft,[{kind:'front',index:2}],{delta:[0,-.3,0]}),/ascend/);
});

test('mirror unlink bakes reflected profile and reverses mesh winding',()=>{
 const profile=defaultGeometry('plate');profile.profile[0][0]-=.03;
 const inverted=bakeXReflection(profile);
 assert.equal(inverted.profile.length,profile.profile.length);
 assert.equal(Math.min(...inverted.profile.map(p=>p[0])),-Math.max(...profile.profile.map(p=>p[0])));
 const mesh={type:'mesh',positions:[0,0,0,1,0,0,0,1,0],indices:[0,1,2],
  normals:[0,0,1,0,0,1,0,0,1]};
 const m=bakeXReflection(mesh);assert.deepEqual(m.indices,[0,2,1]);
 assert.deepEqual(m.positions,[0,0,0,-1,0,0,0,1,0]);
 assert.deepEqual(mesh.indices,[0,1,2]);
});

test('edge and face selection edits the same stable vertex groups as Point mode',()=>{
 const mesh={type:'mesh',positions:[0,0,0,1,0,0,0,1,0],indices:[0,1,2]};
 const edges=selectableElements(mesh,'edge'),faces=selectableElements(mesh,'face');
 assert.equal(edges.length,3);assert.equal(faces.length,1);
 assert.equal(faces[0].members.length,3);
 const selected=modifyElementVertexSelection([],faces,{operation:'replace'});
 assert.equal(selected.size,3);
 assert.equal(modifyElementVertexSelection(selected,[edges[0]],{operation:'subtract'}).size,1);
 const moved=transformMeshGroups(mesh,[0,1,2],{delta:[.1,0,0]});
 assert.equal(moved.positions[0],.1);
 const plate=defaultGeometry('plate');
 assert.equal(selectableElements(plate,'edge').length,4);
 assert.equal(selectableElements(plate,'face').length,1);
});

test('mesh audit is advisory and does not modify original geometry',()=>{
 const mesh={type:'mesh',positions:[0,0,0,1,0,0,0,1,0,0,0,0,0,0,0,0,0,0],
 indices:[0,1,2,3,4,5]};
 const original=clone(mesh),result=deepMeshAudit(mesh);
 assert.equal(result.degenerateTriangles,1);
 assert.equal(result.renderIslands,2);
 assert.ok(result.boundaryEdges>0);
 assert.deepEqual(mesh,original);
});
