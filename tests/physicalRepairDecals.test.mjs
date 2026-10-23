import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {hideBreachAfterService,REPAIR_PATCH_SIZE} from '../surfaceRepairPolicy.js';
import {surfaceDamageLanguage} from '../surfaceDamageLanguage.js';
const text=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const impact=(timestamp=100)=>({event:'impact',eventId:'impact-1',internalDamage:25,timestamp});
const context=(changes={})=>({
  coveredIds:new Set(),partCondition:.5,repairs:1,serviceAt:null,sessionStart:200,...changes,
});
test('a service patch removes the exact covered hole, regardless of visible-scar budget',()=>{
  assert.equal(hideBreachAfterService(impact(),context({coveredIds:new Set(['impact-1'])})),true);
  assert.equal(hideBreachAfterService(impact(),context({coveredIds:new Set(['other'])})),false);
  assert.ok(REPAIR_PATCH_SIZE.width>surfaceDamageLanguage({
    armorAbsorbed:0,internalDamage:100,destroyed:true,
  }).width);
  assert.ok(REPAIR_PATCH_SIZE.height>surfaceDamageLanguage({
    armorAbsorbed:0,internalDamage:100,destroyed:true,
  }).height);
});
test('a fully repaired physical part cannot show pre-repair perforations',()=>{
  assert.equal(hideBreachAfterService(impact(100),context({partCondition:1,repairs:2,serviceAt:150})),true);
  assert.equal(hideBreachAfterService(impact(175),context({partCondition:1,repairs:2,serviceAt:150})),false);
  assert.equal(hideBreachAfterService(impact(100),context({partCondition:1,repairs:2,serviceAt:null,sessionStart:200})),true);
  assert.equal(hideBreachAfterService(impact(250),context({partCondition:1,repairs:2,serviceAt:null,sessionStart:200})),false);
});
test('partial repairs do not pretend other uncovered breaches were fixed',()=>{
  assert.equal(hideBreachAfterService(impact(100),context({partCondition:.75,repairs:1,serviceAt:150})),false);
  assert.equal(hideBreachAfterService({...impact(100),internalDamage:0},context({partCondition:1,repairs:4})),false);
  assert.equal(hideBreachAfterService({event:'service',internalDamage:10},context({partCondition:1,repairs:4})),false);
});
test('all permanent scars respond to scene lighting, hot breach rim is temporary',()=>{
  const renderer=text('surfaceDamageRenderer.js');
  assert.match(renderer,/new THREE\.MeshStandardMaterial/);
  assert.doesNotMatch(renderer,/new THREE\.MeshBasicMaterial/);
  assert.match(renderer,/roughness:kind==='service-patch'/);
  assert.match(renderer,/const kind=newHeat&&\['breach','destroyed-breach'\]\.includes\(profile\.kind\)/);
  assert.match(renderer,/mark\.userData\.coolAt=event\.timestamp\+FRESH_BREACH_MS/);
  assert.match(renderer,/mark\.material=r\.materials\.get\(mark\.userData\.surfaceDamageKind\)/);
  assert.match(renderer,/const profile=event\.event==='service'/);
  assert.match(renderer,/\.\.\.REPAIR_PATCH_SIZE/);
  assert.match(renderer,/hideBreachAfterService\(event,context\(exterior,event\.serial\)\)/);
  assert.match(text('scene.js'),/surfaceMarks\.update\(\)/);
});
