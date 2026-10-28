import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SILHOUETTE_PRESETS,TUNABLES,candidateById,deriveSilhouette,clampParameter}
 from '../research/kestrelSilhouetteDesign.js';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');

test('three fresh birdlike silhouettes have genuinely independent mechanical proportions',()=>{
 assert.deepEqual(SILHOUETTE_PRESETS.map(p=>p.id),['raptor','field','perch']);
 assert.equal(new Set(SILHOUETTE_PRESETS.map(p=>p.kneeOffset)).size,3);
 assert.equal(new Set(SILHOUETTE_PRESETS.map(p=>p.thighShare)).size,3);
 assert.equal(new Set(SILHOUETTE_PRESETS.map(p=>p.footSize)).size,3);
 assert.equal(new Set(SILHOUETTE_PRESETS.map(p=>p.hipSpan)).size,3);
 assert.ok(SILHOUETTE_PRESETS.every(p=>Object.isFrozen(p)));
});
test('all variants have real compact fit, matching U1 and grounded feet',()=>{
 for(const preset of SILHOUETTE_PRESETS){
  const p=deriveSilhouette(preset);
  assert.deepEqual(p.mount,[0,.775,0]);
  assert.equal(p.floor,-.775);
  assert.ok(p.isNominalWidth);
  assert.ok(p.fullSpan<1.67);
  assert.equal(p.legs.length,2);
  assert.ok(p.footWidth<.40);
  for(const leg of p.legs){
   assert.ok(leg.knee[2]-leg.hip[2]>.24,'signature birdlike rear knee');
   assert.ok(leg.knee[2]-leg.ankle[2]>.40,'forward-sweeping shin');
   assert.ok(leg.hip[1]>leg.knee[1]&&leg.knee[1]>leg.ankle[1]);
   assert.ok(Math.abs((leg.foot[1]-p.footHeight/2)-p.floor)<1e-9);
  }
  for(const joint of ['hip','knee','ankle','foot']){
   assert.ok(p.legs.every(l=>l[joint].every(Number.isFinite)));
  }
 }
});
test('editing one prototype is independent and never changes immutable defaults',()=>{
 const a=candidateById('raptor'),b=candidateById('field');
 const before=deriveSilhouette(b).fullSpan;
 a.hipSpan=clampParameter('hipSpan',1.06);
 assert.equal(deriveSilhouette(b).fullSpan,before);
 assert.equal(candidateById('raptor').hipSpan,.82);
 assert.equal(clampParameter('footSize',22),TUNABLES.footSize.max);
 assert.equal(clampParameter('thighMass',-.1),TUNABLES.thighMass.min);
 assert.throws(()=>clampParameter('NO',4),/Unknown/);
});
test('Kestrel prototype stays outside playable registry; one deliberate casting and toe design per candidate',()=>{
 const geom=read('../research/kestrelSilhouetteGeometry.js');
 const js=read('../research/kestrelSilhouetteLab.js');
 const html=read('../kestrel-silhouette.html');
 const index=read('../index.html');
 const registry=read('../partVisuals.js');
 assert.match(geom,/single swept thigh/);
 assert.match(geom,/primary forward shin/);
 assert.match(geom,/sharp field talon/);
 assert.match(geom,/split traction toe/);
 assert.match(geom,/wide perching toe/);
 assert.match(geom,/new THREE\.CylinderGeometry/);
 assert.match(js,/buildExteriorRig\(makeTestAssembly\(\)\)/);
 assert.match(js,/createSilhouetteMachine/);
 assert.match(js,/selected:'raptor'/);
 assert.doesNotMatch(js,/selected:'strider'/);
 assert.doesNotMatch(geom,/buildKestrelVisual|armorTier:3|addArmorToLeg/);
 assert.doesNotMatch(registry,/kestrelSilhouetteGeometry|kestrelSilhouetteDesign/);
 assert.match(registry,/'legs-compact': buildKestrelVisual/);
 assert.match(index,/id="kestrel-silhouette-open"/);
 assert.match(html,/src="\.\/research\/kestrelSilhouetteLab\.js"/);
 assert.doesNotMatch(html,/src="\.\/research\/yardwalkerSilhouetteLab\.js"/);
 assert.match(html,/data-id="raptor"/);
 assert.match(html,/data-id="field"/);
 assert.match(html,/data-id="perch"/);
 assert.match(html,/id="full-rig"/);
 assert.match(html,/id="legs-only"/);
 assert.match(html,/id="arena"/);
 assert.match(html,/id="silhouette"/);
 assert.match(html,/id="focus"/);
 assert.doesNotMatch(html,/data-armor-tier|id="boot-plate"/);
});
