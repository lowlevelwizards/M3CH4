import test from 'node:test';
import assert from 'node:assert/strict';
import {clipProjectedTriangle} from '../surfaceDecalClip.js';
const v=(x,y,z,u,vv)=>({x,y,z,u,v:vv});
test('polygon clipping respects BOTH scar dimensions and stays within original physical triangle',()=>{
  const tri=[v(-2,-1,0,-2,-1),v(2,-1,0,2,-1),v(0,2,0,0,2)];
  const polygon=clipProjectedTriangle(tri,.3,.2);
  assert.ok(polygon.length>=3);
  for(const p of polygon){
    assert.ok(Math.abs(p.u)<=.3000001,JSON.stringify(p));
    assert.ok(Math.abs(p.v)<=.2000001,JSON.stringify(p));
    assert.equal(p.x,p.u);
    assert.equal(p.y,p.v);
    // barycentric envelope of original triangle: never beyond its material.
    assert.ok(p.y>=-1-1e-6);
    assert.ok(p.y<=2+1e-6);
  }
});
test('scar outside source triangle has no drawable geometry, not a floating fallback',()=>{
  const tri=[v(1,1,0,1,1),v(2,1,0,2,1),v(1,2,0,1,2)];
  assert.deepEqual(clipProjectedTriangle(tri,.1,.1),[]);
});
test('half-transparent or malformed clipping cannot invent a physical scar',()=>{
  assert.deepEqual(clipProjectedTriangle([],1,1),[]);
  assert.deepEqual(clipProjectedTriangle([v(0,0,0,0,0)],1,1),[]);
  assert.deepEqual(clipProjectedTriangle([v(0,0,0,0,0),v(1,0,0,1,0),v(0,1,0,0,1)],0,.5),[]);
});
