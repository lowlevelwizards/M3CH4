import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CATALOG} from '../components.js';
import {YARDWALKER_LAYOUT} from '../mobilityDefinitions.js';
import {candidateById,deriveSilhouette} from '../research/yardwalkerSilhouetteDesign.js';

test('Industrial Strider is the selected production Yardwalker, without new inventory IDs',()=>{
 const source=readFileSync(new URL('../yardwalkerVisual.js',import.meta.url),'utf8');
 const builder=readFileSync(new URL('../yardwalkerStriderVisual.js',import.meta.url),'utf8');
 assert.match(source,/return buildIndustrialStriderYardwalker\(fixture,layout\)/);
 assert.match(source,/export function buildLegacyYardwalkerVisual/);
 assert.match(builder,/candidateById\('strider'\)/);
 assert.match(builder,/createSilhouetteMachine\(candidateById\('strider'\),\{tier:0\}\)/);
 assert.match(builder,/root\.userData\.armorTier:0|armorTier:0/);
 assert.doesNotMatch(builder,/addArmorToLeg|YARDWALKER_DESIGN\.armor/);
 assert.equal(CATALOG.filter(x=>x.id==='legs-yard').length,1);
 assert.equal(CATALOG.find(x=>x.id==='legs-yard').massKg,1240);
});
test('production joint hierarchy retains all four live animation joints and U1 bounds',()=>{
 const source=readFileSync(new URL('../yardwalkerStriderVisual.js',import.meta.url),'utf8');
 for(const joint of ['hip','knee','ankle','foot']){
  assert.match(source,new RegExp("joint,side:leg.side,restPose:0"));
  assert.match(source,new RegExp("side+'"+joint[0].toUpperCase()+joint.slice(1)+"'"));
 }
 const p=deriveSilhouette(candidateById('strider'));
 assert.deepEqual(p.mount,YARDWALKER_LAYOUT.mountingFace);
 assert.equal(p.floor,-.825);
 assert.ok(p.legs.every(l=>l.knee[2]>l.hip[2]&&l.knee[2]>l.ankle[2]));
});
test('previous armor specimens remain independent from production Naked legs',()=>{
 const source=readFileSync(new URL('../armorPrototype.js',import.meta.url),'utf8');
 assert.match(source,/buildLegacyYardwalkerVisual\(fitFixtureFor\(partId\)\)/);
 const lab=readFileSync(new URL('../research/yardwalkerSilhouetteLab.js',import.meta.url),'utf8');
 assert.match(lab,/SILHOUETTE_PRESETS/);
 assert.match(lab,/createSilhouetteMachine/);
});
