import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {decodeMachine,storeMachine,loadMachine} from '../persistence.js';
import {loadStable,rigById,rigFieldability} from '../stable.js';
import {startSeries,recordSeriesRound} from '../series.js';
import {
  TRIAGE_ARMOR_FLOOR,TRIAGE_CONDITION,TRIAGE_BUDGET,
  normalizeFieldWorkState,triageOptions,triagePreview,applyIntermissionTriage,
} from '../fieldWork.js';

const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
class MemoryStorage{
  constructor(){this.values=new Map();}
  getItem(k){return this.values.get(k)??null;}
  setItem(k,v){this.values.set(k,String(v));}
  removeItem(k){this.values.delete(k);}
}
function prepare(core=.81,armor=.02,slot='structure'){
  const storage=new MemoryStorage(),machine=decodeMachine(null);
  machine.assembly.name='MABEL';
  const serial=machine.assembly.installed[slot];
  const part=machine.assembly.owned.find(p=>p.serial===serial);
  part.condition=core;
  const snapshot=machine.playerCondition.parts[slot];
  snapshot.integrity=core*snapshot.maxIntegrity;
  snapshot.armor=armor*snapshot.maxArmor;
  storeMachine(storage,machine);
  loadStable(storage,'2026-10-22T19:58:00.000Z');
  return {storage,serial};
}
function intermission(storage){
  const started=startSeries(storage,'yard-dog','rig-01','MABEL','assign-1');
  assert.equal(started.ok,true);
  const round=recordSeriesRound(storage,{victory:true,reason:'R1'},{hasFieldableMachine:true});
  assert.equal(round.ok,true);
  return round.series;
}
test('pit can repair 2% armor on a healthy core without damaging it',()=>{
  const {storage,serial}=prepare();
  const stable=loadStable(storage).stable;
  const candidate=triageOptions(stable,'rig-01').find(o=>o.serial===serial);
  assert.ok(candidate,'armor-only eligibility');
  assert.ok(candidate.armorRatio<.03);
  assert.equal(candidate.cost,1);
  assert.equal(TRIAGE_BUDGET,4);
  assert.equal(TRIAGE_CONDITION,.48);
  assert.equal(TRIAGE_ARMOR_FLOOR,.35);
  const preview=triagePreview(stable,'rig-01',[candidate.slot]);
  assert.equal(preview.valid,true);
  assert.equal(preview.fieldable,true);
  const series=intermission(storage);
  const result=applyIntermissionTriage(storage,{
    seriesId:series.id,rigId:'rig-01',slots:[candidate.slot],now:1893931200000,
  });
  assert.equal(result.ok,true,result.reason);
  const machine=loadMachine(storage),part=machine.playerCondition.parts[candidate.slot];
  assert.ok(part.integrity/part.maxIntegrity>=.81-1e-9);
  assert.ok(part.armor/part.maxArmor>=.35-1e-9);
  assert.ok(machine.assembly.owned.find(p=>p.serial===serial).condition>=.81-1e-9);
  assert.equal(rigFieldability(loadStable(storage).stable,'rig-01').fieldable,true);
});
test('critical core improves but intact armor is never reduced',()=>{
  const {storage}=prepare(.16,.64,'combat');
  const stable=loadStable(storage).stable;
  const plan=triagePreview(stable,'rig-01',['combat']);
  assert.equal(plan.valid,true);
  const series=intermission(storage);
  assert.equal(applyIntermissionTriage(storage,{
    seriesId:series.id,rigId:'rig-01',slots:['combat']
  }).ok,true);
  const snapshot=loadMachine(storage).playerCondition.parts.combat;
  assert.ok(snapshot.integrity/snapshot.maxIntegrity>=.48-1e-9);
  assert.ok(snapshot.armor/snapshot.maxArmor>=.64-1e-9);
});
test('legacy thirty-percent triage history remains thirty-percent after upgrades',()=>{
  const state=normalizeFieldWorkState({
    version:1,seriesId:'legacy-series',
    actions:[{type:'triage',rigId:'rig-01',serial:'part-1',slot:'structure',
      afterRound:1,restoredCondition:.30,
      repairs:[{slot:'structure',serial:'part-1',before:0,cost:2,restoredCondition:.30}]}],
    patches:{'part-1':{serial:'part-1',rigId:'rig-01',slot:'structure',
      restoredCondition:.30,patchedAt:100}},
  });
  assert.equal(state.actions[0].restoredCondition,.30);
  assert.equal(state.actions[0].repairs[0].restoredCondition,.30);
  assert.equal(state.patches['part-1'].restoredCondition,.30);
});
test('scene visuals have framed CRT and defer triangle-clipping after impacts',()=>{
  const scene=read('scene.js'),bridge=read('sceneAssembly.js'),html=read('index.html');
  assert.match(scene,/monitor.rotation.y=Math.PI\+\.22/);
  assert.match(scene,/pendingSurfaceMarks\.push\(\{\.\.\.event,actorId:contact.actorId\}\)/);
  assert.match(scene,/flushSurfaceMarks\(2\)/);
  assert.match(scene,/fallRadius/);
  assert.match(scene,/canTouchFloor/);
  assert.match(bridge,/source=k5r3/);
  assert.match(html,/main\.js\?v=k5r3/);
  assert.match(html,/garageMountUI\.js\?v=k5p8/);
});
test('impact scars remain orange for ten seconds and use emissive shading',()=>{
  const renderer=read('surfaceDamageRenderer.js');
  assert.match(renderer,/FRESH_BREACH_MS=10000/);
  assert.match(renderer,/event\.timestamp\+FRESH_BREACH_MS/);
  assert.match(renderer,/emissive:kind==='fresh-breach'/);
  assert.match(renderer,/\['breach','destroyed-breach'\]/);
  assert.match(renderer,/edgeA\.subVectors/);
  assert.doesNotMatch(renderer,/new THREE\.Triangle\(\)/);
});
