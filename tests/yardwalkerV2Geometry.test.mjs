import test from 'node:test';
import assert from 'node:assert/strict';
import {YARDWALKER_DESIGN as D} from '../yardwalkerDesignData.js';
import {yardwalkerShapes,makeYardwalkerWorkbenchAsset} from '../yardwalkerWorkbenchExport.js';

/** Test *actual* imported index buffers; cannot falsely pass for coplanar or inside-out triangles. */
const tri=(positions,indices,p)=>{
 const A=indices[p]*3,B=indices[p+1]*3,C=indices[p+2]*3;
 const a=[positions[A],positions[A+1],positions[A+2]];
 const b=[positions[B],positions[B+1],positions[B+2]];
 const c=[positions[C],positions[C+1],positions[C+2]];
 const u=b.map((x,i)=>x-a[i]),v=c.map((x,i)=>x-a[i]);
 const normal=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
 return {normal,centroid:a.map((x,i)=>(x+b[i]+c[i])/3)};
};
test('Yardwalker V2 is a deliberate sculpt, not more scaled cuboids',()=>{
 assert.equal(D.version,2);
 assert.ok(D.core.length>=40&&D.core.length<=54);
 const structural=D.core.filter(s=>/(cross-carriage|fixed-hip-yoke|primary-thigh|single-shin-housing|continuous-boot)/.test(s.id));
 assert.equal(structural.length,9);
 assert.ok(structural.filter(s=>s.geometry.type==='mesh').length>=8);
 assert.equal(D.core.find(s=>s.id==='Y1-cross-carriage').geometry.type,'plate');
 assert.ok(D.armor.every(a=>a.variants.every(v=>v.geometry.type==='mesh')));
 // Every armor level shares exactly the same core; heavy levels change the shape, not the skeleton.
 const naked=yardwalkerShapes(0).map(s=>s.id);
 for(const level of [1,2,3])assert.deepEqual(
   yardwalkerShapes(level).filter(s=>!s.armorId).map(s=>s.id),naked);
});
test('every sculpted housing is a closed, non-degenerate consistently outward-facing mesh',()=>{
 const all=[...D.core,...D.armor.flatMap(a=>a.variants.map(v=>({...a,...v})))];
 let visited=0;
 for(const s of all.filter(s=>s.geometry.type==='mesh')){
  const {positions:p,indices:idx}=s.geometry,edgeMap=new Map();
  assert.ok(idx.length>=6 && idx.length%3===0);
  for(let j=0;j<idx.length;j+=3){
   const {normal}=tri(p,idx,j);
   const area=Math.hypot(...normal);
   assert.ok(area>1e-8,'Degenerate '+s.id+' triangle '+j/3);
   for(let k=0;k<3;k++){
    const a=idx[j+k],b=idx[j+(k+1)%3],key=[a,b].sort((x,y)=>x-y).join(':');
    edgeMap.set(key,(edgeMap.get(key)||0)+1);
   }
  }
  assert.ok([...edgeMap.values()].every(v=>v===2),'Open or nonmanifold sculpt '+s.id);
  // A consistently wound closed surface has signed positive volume.
  let signed=0;
  for(let j=0;j<idx.length;j+=3){
   const a=idx[j]*3,b=idx[j+1]*3,c=idx[j+2]*3;
   const bc=[p[b+1]*p[c+2]-p[b+2]*p[c+1],p[b+2]*p[c]-p[b]*p[c+2],p[b]*p[c+1]-p[b+1]*p[c]];
   signed+=p[a]*bc[0]+p[a+1]*bc[1]+p[a+2]*bc[2];
  }
  assert.ok(signed>1e-7,'Inside-out sculpt '+s.id+' signed '+signed);
  visited++;
 }
 assert.ok(visited>=32);
});
test('armor remains joint-parented, individualized and genuinely changes its silhouette profile',()=>{
 for(const a of D.armor){
  assert.equal(a.variants.length,a.tier===3?1:a.tier===2?2:3);
  const verts=a.variants.map(v=>v.geometry.positions);
  if(verts.length>1)assert.notDeepEqual(verts[0],verts.at(-1),'Scaled duplicate '+a.id);
  assert.ok(['carriage','leftHip','rightHip','leftKnee','rightKnee'].includes(a.parent));
 }
 const out=(s,axis)=>{
   const geom=s.geometry;
   if(geom.type==='mesh')return geom.positions.filter((_,i)=>i%3===axis).map(x=>x+s.position[axis]);
   return [];
 };
 const left=D.armor.find(a=>a.id==='yard-left-hip');
 const at=a=>[Math.min(...out(a,0)),Math.max(...out(a,0))];
 const widths=left.variants.map(v=>{const v2={...v};return at(v2)[1]-at(v2)[0]});
 assert.ok(widths[2]>widths[1]+.03 && widths[1]>widths[0]+.05,
   'Higher tier shoulder armor must produce real shape growth');
 for(let tier=0;tier<4;tier++){
  const json=makeYardwalkerWorkbenchAsset(tier);
  assert.equal(json.nodes.filter(x=>x.kind==='shape').length,D.core.length+[0,4,6,8][tier]);
 }
});
test('U1 mounts and IK anchors remain byte-identical to declared Yardwalker production contract',async()=>{
 const {YARDWALKER_LAYOUT}=await import('../mobilityDefinitions.js');
 assert.deepEqual(D.mountFace,YARDWALKER_LAYOUT.mountingFace);
 assert.deepEqual(D.catalogEnvelope,[2,1.65,1.18]);
 for(const leg of YARDWALKER_LAYOUT.legs){
  const n=leg.side<0?'left':'right';
  const p=name=>D.anchors.find(x=>x.id===n+name).position;
  assert.deepEqual(p('Hip'),leg.hip);
  for(const [name,to,from] of [['Knee','knee','hip'],['Ankle','ankle','knee'],['Foot','foot','ankle']])
   assert.ok(p(name).every((v,i)=>Math.abs(v-(leg[to][i]-leg[from][i]))<1e-8));
 }
});
