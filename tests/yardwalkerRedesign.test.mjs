import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {BY_ID} from '../components.js';
import {YARDWALKER_LAYOUT} from '../mobilityDefinitions.js';
import {YARDWALKER_DESIGN} from '../yardwalkerDesignData.js';
import {makeYardwalkerWorkbenchAsset,YARDWALKER_TIERS,
  yardwalkerShapes,assertYardwalkerDesign} from '../yardwalkerWorkbenchExport.js';
import {installedArmorPlates} from '../armorPlan.js';
const source=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('authored Yardwalker JSON is single source for runtime and four exact Workbench exports',()=>{
 assert.equal(assertYardwalkerDesign(),true);
 assert.deepEqual(JSON.parse(source('yardwalker-design/master.json')),YARDWALKER_DESIGN);
 const expected='/** Generated from yardwalker-design/master.json; do not edit by hand. */\n'+
   'export const YARDWALKER_DESIGN = Object.freeze('+JSON.stringify(YARDWALKER_DESIGN)+');\n';
 assert.equal(source('yardwalkerDesignData.js'),expected);
 for(let tier=0;tier<4;tier++){
  const name='workbench-assets/yardwalker/yardwalker-0'+tier+'-'+YARDWALKER_TIERS[tier]+'.asset.json';
  const generated=JSON.stringify(makeYardwalkerWorkbenchAsset(tier),null,2)+'\n';
  assert.equal(source(name),generated,'stale '+name);
  const a=JSON.parse(generated),shapes=a.nodes.filter(n=>n.kind==='shape');
  assert.equal(shapes.length,34+[0,4,6,8][tier]);
  assert.deepEqual(shapes.filter(n=>!n.armorPlateId).map(n=>n.id),
    YARDWALKER_DESIGN.core.map(n=>'yw-'+n.id));
  assert.equal(a.nodes.filter(n=>n.kind==='anchor').length,8);
 }
});
test('Yardwalker retains catalogue envelope, U1 interface and exactly the original eight moving joints',()=>{
 const c=BY_ID.get('legs-yard'),m=YARDWALKER_DESIGN;
 assert.deepEqual(c.envelope,[2,1.65,1.18]);
 assert.equal(c.massKg,1240);
 assert.deepEqual(m.catalogEnvelope,c.envelope);
 assert.deepEqual(m.mountFace,YARDWALKER_LAYOUT.mountingFace);
 for(const leg of YARDWALKER_LAYOUT.legs){
  const word=leg.side<0?'left':'right',all=m.anchors;
  const xyz=id=>all.find(a=>a.id===word+id)?.position;
  const delta=(to,from)=>to.map((v,i)=>v-from[i]);
  assert.deepEqual(xyz('Hip'),leg.hip);
  assert.ok(xyz('Knee').every((n,i)=>Math.abs(n-delta(leg.knee,leg.hip)[i])<1e-9));
  assert.ok(xyz('Ankle').every((n,i)=>Math.abs(n-delta(leg.ankle,leg.knee)[i])<1e-9));
  assert.ok(xyz('Foot').every((n,i)=>Math.abs(n-delta(leg.foot,leg.ankle)[i])<1e-9));
 }
 assert.equal(m.anchors.filter(a=>a.joint).length,8);
});
test('Armor Lab installs exactly 0,4,6,8 joint-local protective assemblies',()=>{
 for(const t of [0,1,2,3]){
  const ids=installedArmorPlates('legs-yard',t).map(a=>a.id);
  assert.deepEqual(yardwalkerShapes(t).filter(s=>s.armorId).map(s=>s.id).sort(),ids.sort());
 }
 const sourceIds=YARDWALKER_DESIGN.armor.map(s=>s.id);
 assert.equal(new Set(sourceIds).size,8);
 assert.ok(YARDWALKER_DESIGN.armor.filter(s=>s.parent.endsWith('Hip')).length===2);
 assert.ok(YARDWALKER_DESIGN.armor.filter(s=>s.parent.endsWith('Knee')).length===4);
 assert.ok(YARDWALKER_DESIGN.armor.filter(s=>s.parent==='carriage').length===2);
 const level3=yardwalkerShapes(3).filter(s=>s.armorId);
 assert.equal(level3.length,8);
 assert.deepEqual(YARDWALKER_DESIGN.core.map(n=>n.id),
   yardwalkerShapes(3).filter(s=>!s.armorId).map(n=>n.id));
});
test('runtime remains the normal mobility builder and does not alter IK, state or combat saves',()=>{
 const src=source('yardwalkerVisual.js'),lab=source('armorPrototype.js');
 assert.match(src,/compileGeometry/);
 assert.match(src,/finishMobilityVisual/);
 assert.match(src,/Authored Yardwalker anchors drift from canonical IK layout/);
 assert.match(src,/buildYardwalkerArmorPlate/);
 assert.match(lab,/buildYardwalkerArmorPlate/);
 assert.doesNotMatch(src,/applyTargetHit|storeStable|localStorage|stepRig/);
 assert.match(source('scene.js'),/leg\.hip\.rotation\.x=pose\.hip/);
});
