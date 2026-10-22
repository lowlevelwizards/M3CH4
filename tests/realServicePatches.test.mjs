import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeSurfaceEvent,summarizeSurfaceEvents} from '../partServiceJournal.js';
import {queueServiceRecord,queuedServiceRecords,physicalServiceEvent} from '../serviceEventRecorder.js';
import {readFileSync} from 'node:fs';
const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const fake=()=>{const m=new Map();return {setItem:(k,v)=>m.set(k,v),getItem:k=>m.get(k)||null};};
const hit=(id,internal)=>normalizeSurfaceEvent({
  event:'impact',eventId:id,serial:'SER-1',sortieId:'sortie-5',
  surfaceId:'legs-yard/shin',localPoint:[0.1,.2,-.3],localNormal:[0,0,1],
  armorAbsorbed:4,internalDamage:internal,timestamp:1000,
});
test('service record references an actual recorded penetration on that physical serial',()=>{
  const events=[hit('surface-hit-1',0),hit('deep-hit-2',29),hit('deep-hit-3',18)];
  const p={eventId:'repair-SER-1-2',serial:'SER-1',mode:'workshop-repair',timestamp:2000};
  const service=physicalServiceEvent(p,events);
  assert.equal(service.coveredEventId,'deep-hit-2');
  assert.equal(service.surfaceId,'legs-yard/shin');
  assert.deepEqual(service.localPoint,[.1,.2,-.3]);
  const normalized=normalizeSurfaceEvent(service);
  assert.equal(normalized.event,'service');
  assert.equal(normalized.coveredEventId,'deep-hit-2');
  const next=physicalServiceEvent({...p,eventId:'repair-SER-1-3'},[...events,normalized]);
  assert.equal(next.coveredEventId,'deep-hit-3');
});
test('no documented breach produces only a truthful nonlocalized service fact',()=>{
  const service=physicalServiceEvent({eventId:'repair-SER-1-1',serial:'SER-1',
    mode:'workshop-repair',timestamp:1200},[hit('armor-only',0)]);
  assert.equal(service.coveredEventId,null);
  assert.equal(service.surfaceId,null);
  assert.equal(service.localPoint,null);
  assert.equal(normalizeSurfaceEvent(service).event,'service');
  assert.equal(normalizeSurfaceEvent({...service,surfaceId:'random-surface'}),null);
  assert.equal(normalizeSurfaceEvent({...service,mode:'imaginary-repair'}),null);
});
test('impact statistics exclude service events and preserve both truthful event kinds',()=>{
  const actual=hit('hit-1',15);
  const repair=normalizeSurfaceEvent(physicalServiceEvent({
    eventId:'repair-1',serial:'SER-1',mode:'workshop-rebuild',timestamp:2200},[actual]));
  const tally=summarizeSurfaceEvents([actual,repair],'SER-1');
  assert.equal(tally.hits,1);
  assert.equal(tally.services,1);
  assert.equal(tally.penetrations,1);
  assert.equal(tally.scars.length,2);
});
test('outbox is synchronous and idempotent across pit reloads',()=>{
  const storage=fake(),record={eventId:'pit-1-5-SER-1-123',serial:'SER-1',mode:'pit-triage',timestamp:123};
  assert.equal(queueServiceRecord(storage,record),true);
  assert.equal(queueServiceRecord(storage,record),true);
  assert.equal(queuedServiceRecords(storage).length,1);
  assert.equal(queueServiceRecord(storage,{...record,mode:'invented'}),false);
});
test('successful actual shop actions and pit patches enqueue, no damage is invented',()=>{
  const scene=source('scene.js'),main=source('main.js'),visuals=source('surfaceDamageRenderer.js');
  assert.match(main,/preserveSuccessfulService\(serviced\.serial/);
  assert.match(main,/preserveSuccessfulService\(result\.serial/);
  assert.match(main,/preserveSuccessfulService\(serial,'pit-triage',key\)/);
  assert.match(main,/queueServiceRecord\(saveStorage/);
  assert.match(main,/flushServiceRecords\(saveStorage/);
  assert.match(visuals,/event\.event==='service'\s*\?\{kind:'service-patch'/);
  assert.match(visuals,/geometryForPhysicalScar\(target,event,profile\)/);
  assert.match(scene,/createSurfaceScarRenderer\(\{perSerialLimit:4\}\)/);
});
