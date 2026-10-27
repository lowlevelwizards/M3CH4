import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CYCLOPS_CORE,CYCLOPS_ARMOR,cyclopsVariantShapes} from '../cyclopsDesign.js';
import {makeCyclopsWorkbenchAsset,assertCyclopsDesignConsistency,
 CYCLOPS_VARIANT_NAMES} from '../cyclopsWorkbenchExport.js';
import {installedArmorPlates} from '../armorPlan.js';
const fromRepo=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('four approved Cyclops variants reproduce committed editable Workbench JSON exactly',()=>{
 assert.equal(assertCyclopsDesignConsistency(),true);
 for(let tier=0;tier<=3;tier++){
   const path='workbench-assets/cyclops/cyclops-0'+tier+'-'+CYCLOPS_VARIANT_NAMES[tier]+'.asset.json';
   const generated=JSON.stringify(makeCyclopsWorkbenchAsset(tier),null,2)+'\n';
   assert.equal(fromRepo(path),generated,'stale asset at level '+tier);
   const asset=JSON.parse(generated);
   assert.equal(asset.nodes.filter(n=>n.kind==='shape').length,
     CYCLOPS_CORE.length+installedArmorPlates('cab-cyclops',tier).length);
   assert.equal(asset.metadata.visualOnly,true);
 }
});
test('core is identical across every armor level and the eight armor IDs remain stable',()=>{
 assert.equal(CYCLOPS_CORE.length,42);
 const coreIDs=CYCLOPS_CORE.map(s=>s.id);
 const productionIDs=Object.keys(CYCLOPS_ARMOR);
 assert.deepEqual(new Set(productionIDs),new Set(installedArmorPlates('cab-cyclops',3).map(p=>p.id)));
 for(let tier=0;tier<=3;tier++){
  const shapes=cyclopsVariantShapes(tier);
  assert.deepEqual(shapes.filter(s=>!s.armorId).map(s=>s.id),coreIDs);
  assert.deepEqual(new Set(shapes.filter(s=>s.armorId).map(s=>s.armorId)),
    new Set(installedArmorPlates('cab-cyclops',tier).map(p=>p.id)));
 }
});
test('all four silhouettes are engineered inside the existing declared 1.24 × .90 × 1.14 metre envelope',()=>{
 const tolerance=.0006;
 const bounds=[1.24/2,.9/2,1.14/2];
 function vertices(s){
  const g=s.geometry,points=[];
  if(g.type==='box'||g.type==='chamfer'){
   const [x,y,z]=g.size.map(n=>n/2);
   for(const a of [-x,x])for(const b of [-y,y])for(const c of [-z,z])points.push([a,b,c]);
  }else if(g.type==='cylinder'||g.type==='tube'){
   const r=g.radius??g.outerRadius,h=g.length/2;
   for(const a of [-r,r])for(const b of [-r,r])for(const c of [-h,h]){
    if(g.axis==='y')points.push([a,c,b]);
    else if(g.axis==='x')points.push([c,a,b]);
    else points.push([a,b,c]);
   }
  }else if(g.type==='plate'||g.type==='wedge'){
   for(const [x,y] of g.profile)for(const z of [-g.depth/2,g.depth/2])points.push([x,y,z]);
  }else throw Error('Unsupported Cyclops primitive '+g.type);
  const [rx,ry,rz]=s.rotation,[px,py,pz]=s.position;
  return points.map(([x,y,z])=>{
   let yy=y*Math.cos(rx)-z*Math.sin(rx),zz=y*Math.sin(rx)+z*Math.cos(rx);
   let xx=x*Math.cos(ry)+zz*Math.sin(ry),zzz=-x*Math.sin(ry)+zz*Math.cos(ry);
   return [xx*Math.cos(rz)-yy*Math.sin(rz)+px,xx*Math.sin(rz)+yy*Math.cos(rz)+py,zzz+pz];
  });
 }
 for(let tier=0;tier<=3;tier++){
  for(const s of cyclopsVariantShapes(tier)){
   for(const p of vertices(s))for(let axis=0;axis<3;axis++)
    assert.ok(Math.abs(p[axis])<=bounds[axis]+tolerance,
     'Cyclops '+tier+' '+s.id+' exceeds '+['X','Y','Z'][axis]+' envelope: '+p[axis]);
  }
 }
});
test('production Cyclops and Armor Lab share the master instead of independent geometry',()=>{
 const prod=fromRepo('cyclopsVisual.js');
 const lab=fromRepo('armorPrototype.js');
 assert.match(prod,/CYCLOPS_CORE/);
 assert.match(prod,/CYCLOPS_ARMOR/);
 assert.match(prod,/compileGeometry/);
 assert.match(lab,/buildCyclopsArmorPlate\(root,entry,tier\)/);
 assert.doesNotMatch(lab,/return makePlate\(cheeks,entry/);
});
