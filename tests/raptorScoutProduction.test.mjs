import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CATALOG} from '../components.js';
import {KESTREL_LAYOUT} from '../mobilityDefinitions.js';
import {SILHOUETTE_PRESETS,candidateById,deriveSilhouette} from '../research/kestrelSilhouetteDesign.js';
import {armorRecipe} from '../research/kestrelArmorSpec.js';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');

test('Raptor Scout is the one approved production Kestrel, without changing inventory or gameplay balance',()=>{
 const live=read('../kestrelVisual.js');
 const builder=read('../kestrelRaptorVisual.js');
 const registry=read('../partVisuals.js');
 const part=CATALOG.filter(x=>x.id==='legs-compact');
 assert.equal(part.length,1);
 assert.equal(part[0].massKg,1010);
 assert.equal(part[0].loadLimitKg,3900);
 assert.equal(part[0].maxForwardSpeedMps,9.3);
 assert.match(registry,/'legs-compact': buildKestrelVisual/);
 assert.match(live,/return buildRaptorScoutKestrel\(fixture,layout\)/);
 assert.match(live,/export function buildLegacyKestrelVisual/);
 assert.match(builder,/candidateById\('raptor'\)/);
 assert.match(builder,/createSilhouetteMachine\(design\)/);
 assert.match(builder,/visualDesign:'raptor-scout-naked-v1'/);
 assert.match(builder,/armorTier:0/);
 assert.doesNotMatch(builder,/installKestrelArmor|tailoredSplitCheek|armorRecipe/);
});
test('Raptor stance keeps the U1 plane, grounded feet and named animation hierarchy',()=>{
 const builder=read('../kestrelRaptorVisual.js');
 const p=deriveSilhouette(candidateById('raptor'));
 assert.deepEqual(p.mount,KESTREL_LAYOUT.mountingFace);
 assert.equal(p.floor,-.775);
 assert.ok(p.isNominalWidth);
 for(const leg of p.legs){
  assert.ok(leg.knee[2]>leg.hip[2] && leg.knee[2]>leg.ankle[2]);
  assert.ok(leg.hip[1]>leg.knee[1]&&leg.knee[1]>leg.ankle[1]);
 }
 for(const joint of ['hip','knee','ankle','foot']){
  assert.ok(builder.includes("word+'"+joint[0].toUpperCase()+joint.slice(1)+"'"));
 }
 assert.match(builder,/g\.userData=\{joint,side:leg\.side,restPose:0\}/);
 assert.match(builder,/return finishMobilityVisual\(root,fixture,layout\)/);
});
test('alternate anatomy and preferred Split encasement remain archived separately',()=>{
 const ids=SILHOUETTE_PRESETS.map(x=>x.id);
 assert.deepEqual(ids,['raptor','field','perch']);
 assert.equal(new Set(ids).size,3);
 const recipe=armorRecipe('raptor',{tier:3,form:'split'});
 assert.equal(recipe.tier,3);
 assert.equal(recipe.form,'split');
 assert.equal(recipe.parts.filter(x=>x.zone==='thigh'&&x.role==='shell').length,4);
 const archive=read('../armorPrototype.js');
 assert.match(archive,/buildLegacyKestrelVisual\(fitFixtureFor\(partId\)\)/);
 const lab=read('../research/kestrelSilhouetteLab.js');
 assert.match(lab,/configs:Object\.fromEntries\(SILHOUETTE_PRESETS/);
 assert.match(lab,/installKestrelArmor/);
 assert.match(lab,/createArticulatedKestrel/);
});
