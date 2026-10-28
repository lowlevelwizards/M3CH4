import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DEFAULT_CALF_RECIPE,CALF_LIMITS,copyCalfRecipe,validateCalfRecipe,
  editCalfStation,calfMeshData} from '../partWorkbenchRecipe.js';

test('the default production casing is a valid strictly versioned shape',()=>{
  const copy=validateCalfRecipe(DEFAULT_CALF_RECIPE);
  assert.equal(copy.id,'legs-yard/calf-shell');
  assert.equal(copy.version,1);
  assert.equal(copy.stations.length,5);
  copy.stations[0].width=.12;
  assert.equal(DEFAULT_CALF_RECIPE.stations[0].width,.29,'defaults must not mutate');
});

test('reject incorrect, incomplete, nonfinite and impossible imported shapes',()=>{
  for(const tamper of [
    r=>r.version=99,
    r=>r.id='legs-compact/calf-shell',
    r=>r.stations.pop(),
    r=>r.stations[1].width=Infinity,
    r=>r.stations[1].front=NaN,
    r=>r.stations[2].back=.01,
    r=>r.stations[2].width=.9,
    r=>r.stations[2].front=0,
  ]){
    const recipe=copyCalfRecipe(DEFAULT_CALF_RECIPE);tamper(recipe);
    assert.throws(()=>validateCalfRecipe(recipe));
  }
});
test('direct profile edits clamp safely and never change other stations',()=>{
  const edited=editCalfStation(DEFAULT_CALF_RECIPE,2,'width',12);
  assert.equal(edited.stations[2].width,CALF_LIMITS.width[1]);
  assert.equal(edited.stations[1].width,DEFAULT_CALF_RECIPE.stations[1].width);
  assert.equal(DEFAULT_CALF_RECIPE.stations[2].width,.285);
  const face=editCalfStation(edited,2,'front',10);
  assert.ok(face.stations[2].back-face.stations[2].front>=.075-1e-6);
  assert.throws(()=>editCalfStation(edited,-1,'front',.07));
  assert.throws(()=>editCalfStation(edited,1,'vertical',.07));
});
test('extruded front and side outlines form a closed low-poly exterior',()=>{
  const length=.45,{vertices,indices}=calfMeshData(DEFAULT_CALF_RECIPE,length);
  assert.equal(vertices.length,5*4*3);
  assert.equal(indices.length,4*4*6+12);
  assert.ok(Math.min(...vertices.filter((_,i)=>i%3===1))>=0);
  assert.equal(Math.max(...vertices.filter((_,i)=>i%3===1)),length);
  for(const ix of indices)assert.ok(Number.isInteger(ix)&&ix>=0&&ix<20);
  // Every triangle is nondegenerate; face normals wind outward.
  for(let i=0;i<indices.length;i+=3){
    const p=indices.slice(i,i+3).map(index=>vertices.slice(index*3,index*3+3));
    const a=p[1].map((x,j)=>x-p[0][j]),b=p[2].map((x,j)=>x-p[0][j]);
    const n=[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
    assert.ok(Math.hypot(...n)>1e-8,'no degenerate casing triangles');
  }
});
test('edits change surface geometry without changing the section spans',()=>{
  const a=calfMeshData(DEFAULT_CALF_RECIPE,.45);
  const changed=editCalfStation(DEFAULT_CALF_RECIPE,1,'width',.39);
  const b=calfMeshData(changed,.45);
  assert.deepEqual(a.indices,b.indices);
  assert.notDeepEqual(a.vertices,b.vertices);
  for(let i=0;i<5;i++)assert.equal(a.vertices[i*12+1],b.vertices[i*12+1]);
});
test('legacy calf recipes remain importable but current Yardwalker is JSON-mastered',()=>{
 const yard=readFileSync(new URL('../yardwalkerVisual.js',import.meta.url),'utf8');
 const oldAdapter=readFileSync(new URL('../partWorkbenchGeometry.js',import.meta.url),'utf8');
 const tool=readFileSync(new URL('../partWorkbench.js',import.meta.url),'utf8');
 assert.match(yard,/YARDWALKER_DESIGN/);
 assert.match(yard,/compileGeometry/);
 assert.doesNotMatch(yard,/addYardwalkerCalf\(knee/);
 assert.match(oldAdapter,/targets\.length!==2/);
 assert.match(tool,/buildExteriorRig\(makeTestAssembly\(\)\)/);
 assert.match(tool,/buildPartVisual\('legs-yard',\{mode:'gameplay'\}\)/);
 assert.match(tool,/m3ch4-part-workbench-calf-v1/);
 assert.match(tool,/Legacy calf recipe only/);
 assert.doesNotMatch(tool,/m3ch4-test-yard-loadout-v1|m3ch4-graybox-v1/);
});
