import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeSurfaceEvent,summarizeSurfaceEvents,SURFACE_JOURNAL_DB} from '../partServiceJournal.js';
const source=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const impact=(n,serial='SR01-002')=>({
  eventId:'sortie-1:'+n,sortieId:'sortie-1',serial,
  surfaceId:'legs-yard/left-shin/outer-guard',
  localPoint:[.123456,-.2,.02],localNormal:[0,0,1],
  armorAbsorbed:n%2?14:0,internalDamage:n%2?0:12,
  destroyed:false,disabled:false,timestamp:90000+n,
});
test('surface history validates actual named, anchored observations and retains context',()=>{
  const evt=normalizeSurfaceEvent(impact(1));
  assert.equal(evt.schema,1);
  assert.equal(evt.serial,'SR01-002');
  assert.equal(evt.localPoint[0],.1235);
  assert.equal(evt.kind,'armor-strike');
  assert.equal(evt.armorAbsorbed,14);
  assert.equal(evt.surfaceVersion,1);
  assert.ok(Object.isFrozen(evt));
  assert.equal(SURFACE_JOURNAL_DB,'m3ch4-surface-history-v1');
});
test('invalid, guessed or non-physical scars cannot enter event journal',()=>{
  assert.equal(normalizeSurfaceEvent({...impact(2),surfaceId:''}),null);
  assert.equal(normalizeSurfaceEvent({...impact(2),localPoint:[NaN,0,0]}),null);
  assert.equal(normalizeSurfaceEvent({...impact(2),localNormal:[0,0,0]}),null);
  assert.equal(normalizeSurfaceEvent({...impact(2),armorAbsorbed:-1}),null);
  assert.equal(normalizeSurfaceEvent({...impact(2),serial:null}),null);
});
test('duplicate event IDs do not create duplicate visible or historic hits',()=>{
  const events=[impact(1),impact(1),impact(2),impact(3,'OTHER')];
  const summary=summarizeSurfaceEvents(events,'SR01-002');
  assert.equal(summary.hits,2);
  assert.equal(summary.armorStrikes,1);
  assert.equal(summary.penetrations,1);
  assert.equal(summary.scars.length,2);
  assert.equal(summary.lastImpactAt,90002);
});
test('all real raycast paths expose articulated local anchors and journal only resolved damage',()=>{
  const scene=source('scene.js'),main=source('main.js');
  assert.match(scene,/function surfaceContact\(actual,point,normal\)/);
  assert.match(scene,/surfaceHit:cover\?null:surfaceContact\(actual,point,surfaceNormal\)/);
  assert.match(scene,/node\.worldToLocal\(point\.clone\(\)\)/);
  assert.match(scene,/noteSurfaceImpact\(contact,outcome\)/);
  assert.match(scene,/drainSurfaceEvents/);
  assert.match(main,/const physicalEvents=arena\.drainSurfaceEvents\(\)/);
  assert.match(main,/storeSurfaceEvents\(physicalEvents\)/);
  assert.doesNotMatch(source('partServiceJournal.js'),/applyTargetHit|damageInstalledPart|storeMachine/);
});
