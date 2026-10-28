import test from 'node:test';
import assert from 'node:assert/strict';
import {YARDWALKER_DESIGN as D} from '../yardwalkerDesignData.js';
import {makeYardwalkerWorkbenchAsset,yardwalkerShapes} from '../yardwalkerWorkbenchExport.js';
import {YARDWALKER_LAYOUT} from '../mobilityDefinitions.js';
const shape=id=>D.core.find(s=>s.id===id);
const armor=id=>D.armor.find(s=>s.id===id);
function range(model,axis=0) {
 const p=model.geometry.positions;
 const values=p.filter((_,i)=>i%3===axis).map(v=>v+model.position[axis]);
 return [Math.min(...values),Math.max(...values)];
}
function sections(model) {
 const p=model.geometry.positions,n=(p.length/3)-2;
 return Array.from({length:n/8},(_,j)=>{
  const x=[],y=[],z=[];
  for(let i=j*8;i<j*8+8;i++){x.push(p[3*i]+model.position[0]);y.push(p[3*i+1]+model.position[1]);z.push(p[3*i+2]+model.position[2]);}
  return {width:Math.max(...x)-Math.min(...x),y:y.reduce((a,b)=>a+b,0)/8,z:z.reduce((a,b)=>a+b,0)/8,
   depth:Math.max(...z)-Math.min(...z)};
 });
}
const localWorld=(id)=>{
 const a=D.anchors.find(a=>a.id===id);
 const p=a.parent?localWorld(a.parent):[0,0,0];
 return a.position.map((v,i)=>v+p[i]);
};
function outerEdge(model,parent,side){
 const edge=range(model,0);
 return localWorld(parent)[0]+(side==='right'?edge[1]:edge[0]);
}
test('V4 preserves real angled mechanical anatomy and U1 interface, cleaning only supported fittings',()=>{
 assert.equal(D.version,4);
 assert.deepEqual(D.mountFace,YARDWALKER_LAYOUT.mountingFace);
 assert.deepEqual(D.catalogEnvelope,[2,1.65,1.18]);
 assert.equal(D.core.length,46);
 for(const side of ['left','right']){
   const t=sections(shape('Y4-'+side+'-primary-thigh'));
   const l=sections(shape('Y7-'+side+'-single-shin-housing'));
   assert.ok(t.at(-1).z-t[0].z>.13,'inclined thigh preserved');
   assert.ok(l.at(-1).z-l[0].z<-.13,'opposing shin preserved');
   const ankle=shape('Y8-'+side+'-ankle-load-shank');
   assert.ok(sections(ankle).some(x=>x.width>.2),'ankle should not resemble a fragile stem');
   const knee=sections(shape('Y6-'+side+'-knee-fork'));
   assert.ok(knee.some(x=>x.width>.27),'clevis should surround the bearing');
   for(const suffix of ['upper-actuator-lug','lower-actuator-lug']){
     const fitting=shape('Y5-'+side+'-'+suffix);
     assert.equal(fitting.parent,side+'Hip');
     assert.ok(fitting.geometry.size[0]>.11,'clearly mounted thigh strut');
   }
 }
});
test('Heavy silhouette is dominated by moving thigh rather than shoulder boxes',()=>{
 for(const side of ['left','right']){
  const sign=side==='right'?1:-1;
  const hip=armor('yard-'+side+'-hip'),thigh=armor('yard-'+side+'-thigh');
  const level2Hip=hip.variants[1],heavyThigh=thigh.variants[0],encasedThigh=thigh.variants[1];
  const upper=sections(heavyThigh),full=sections(encasedThigh);
  assert.ok(Math.max(...upper.map(x=>x.width))>.47,'Heavy must have a dramatic broad upper thigh');
  assert.ok(Math.max(...full.map(x=>x.width))>.55,'Encased upper thigh must be distinctly broader');
  assert.ok(upper[1].width>upper.at(-1).width*2,'Heavy thigh must narrow into knee, not appear as a cuff');
  assert.ok(full[1].width>full.at(-1).width*2,'Encased thigh must narrow into knee');
  const thighOuter=outerEdge(heavyThigh,side+'Hip',side);
  const hipOuter=outerEdge(level2Hip,'carriage',side);
  assert.ok(sign*thighOuter>sign*hipOuter+.035,'moving thigh, not stationary hip, owns silhouette');
  assert.ok(Math.abs(outerEdge(encasedThigh,side+'Hip',side))<=1.0,'Encased thigh exceeds catalogue width');
  assert.equal(hip.parent,'carriage');
  assert.equal(thigh.parent,side+'Hip');
  assert.ok(upper.at(-1).z-upper[0].z>.15,'armor must follow incline');
 }
});
test('Guarded, Heavy and Encased use genuinely different full-link form languages',()=>{
 for(const side of ['left','right']){
   const shin=armor('yard-'+side+'-shin'),hip=armor('yard-'+side+'-hip');
   const light=shin.variants[0],heavy=shin.variants[1],enc=shin.variants[2];
   const thin=sections(light),wide=sections(heavy),encased=sections(enc);
   assert.ok(Math.max(...thin.map(s=>s.depth))<.07,'Guarded plate must be a thin applied guard');
   assert.ok(Math.max(...wide.map(s=>s.depth))>.16,'Heavy shin must be substantial');
   assert.ok(Math.max(...encased.map(s=>s.width))>.38,'Encased needs broad lower coverage');
   assert.ok(Math.max(...sections(hip.variants[0]).map(s=>s.width))<
     Math.max(...sections(hip.variants[1]).map(s=>s.width)));
   assert.ok(Math.max(...sections(hip.variants[2]).map(s=>s.width))<.30,
     'Encased should not return to giant independent hip boxes');
   const rail=armor('yard-'+side+'-calf-wrap');
   assert.ok(Math.max(...sections(rail.variants[0]).map(s=>s.width))<.075,
     'calf protection should be a rail not a stacked block');
 }
});
test('All tiers share core and exactly eight moving-joint armor identities',()=>{
 const naked=yardwalkerShapes(0).filter(x=>!x.armorId);
 for(let level=0;level<=3;level++){
  const shapes=yardwalkerShapes(level),asset=makeYardwalkerWorkbenchAsset(level);
  assert.deepEqual(shapes.filter(x=>!x.armorId),naked);
  assert.equal(shapes.filter(x=>x.armorId).length,[0,4,6,8][level]);
  assert.equal(asset.nodes.filter(n=>n.kind==='shape').length,46+[0,4,6,8][level]);
  assert.equal(asset.metadata.version,'Yardwalker-V4');
 }
});
