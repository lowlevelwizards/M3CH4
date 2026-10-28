import test from 'node:test';
import assert from 'node:assert/strict';
import {YARDWALKER_DESIGN as D} from '../yardwalkerDesignData.js';
import {yardwalkerShapes} from '../yardwalkerWorkbenchExport.js';

const anchors=new Map(D.anchors.map(a=>[a.id,a]));
function anchorWorld(id){
 const a=anchors.get(id);
 if(!a)throw Error('Unknown anchor '+id);
 const p=a.parent?anchorWorld(a.parent):[0,0,0];
 return a.position.map((n,i)=>n+p[i]);
}
function faces(s){
 const geo=s.geometry;if(geo.type!=='mesh')return [];
 const world=anchorWorld(s.parent).map((n,i)=>n+s.position[i]);
 const p=geo.positions,i=geo.indices,output=[];
 for(let j=0;j<i.length;j+=3){
  const a=[0,1,2].map(k=>p[3*i[j]+k]+world[k]);
  const b=[0,1,2].map(k=>p[3*i[j+1]+k]+world[k]);
  const c=[0,1,2].map(k=>p[3*i[j+2]+k]+world[k]);
  const u=b.map((n,k)=>n-a[k]),v=c.map((n,k)=>n-a[k]);
  const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
  const mag=Math.hypot(...n);if(mag<1e-8)continue;
  const norm=n.map(x=>x/mag),axis=norm.reduce((a,v,k)=>Math.abs(v)>Math.abs(norm[a])?k:a,0);
  if(Math.abs(norm[axis])<.9995)continue;
  const pcoord=(a[axis]+b[axis]+c[axis])/3,ext=[0,1,2].filter(x=>x!==axis);
  const limits=ext.map(k=>[Math.min(a[k],b[k],c[k]),Math.max(a[k],b[k],c[k])]);
  output.push({mesh:s.id,axis,coord:pcoord,limits});
 }
 return output;
}
test('sculpted Yardwalker and fitted armor have no broad, near-coplanar axis-aligned front/back surfaces',()=>{
 for(let tier=0;tier<4;tier++){
  const facesByAxis=[[],[],[]];
  for(const shape of yardwalkerShapes(tier))for(const f of faces(shape))facesByAxis[f.axis].push(f);
  const collisions=[];
  for(const set of facesByAxis){
   const buckets=new Map();
   for(const f of set){
    const k=Math.round(f.coord/.002);
    if(!buckets.has(k))buckets.set(k,[]);
    buckets.get(k).push(f);
   }
   for(const [,items] of buckets){
    for(let i=0;i<items.length;i++)for(let j=i+1;j<items.length;j++){
     const a=items[i],b=items[j];
     if(a.mesh===b.mesh||Math.abs(a.coord-b.coord)>.0015)continue;
     const overlap=a.limits.map((v,k)=>Math.min(v[1],b.limits[k][1])-Math.max(v[0],b.limits[k][0]));
     // Only meaningful planar overlap. Intentional multi-mesh joints are
     // normally separated by actual depth and do not trigger this check.
     if(overlap.every(x=>x>.018))collisions.push([a.mesh,b.mesh,a.coord.toFixed(3)]);
    }
   }
  }
  assert.deepEqual(collisions.slice(0,12),[], 'Potential broad z-fighting at tier '+tier);
 }
});
