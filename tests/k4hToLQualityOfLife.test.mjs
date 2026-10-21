import test from 'node:test';
import assert from 'node:assert/strict';
import {decodeMachine,loadMachine,storeMachine} from '../persistence.js';
import {loadStable,rigById,rigFieldability} from '../stable.js';
import {startSeries,recordSeriesRound} from '../series.js';
import {fieldWorkRecoveryPossible,triageOptions,triagePreview,applyIntermissionTriage,
 TRIAGE_CONDITION,TRIAGE_ARMOR_FLOOR,TRIAGE_BUDGET,currentIntermissionFieldAction} from '../fieldWork.js';
import {bayAssembly} from '../garageBay.js';
import {WEAPONS} from '../combat.js';
import {shotContacts} from '../scattergun.js';
import fs from 'node:fs';
class Storage{constructor(){this.data=new Map();}getItem(k){return this.data.get(k)??null;}
setItem(k,v){this.data.set(k,String(v));}removeItem(k){this.data.delete(k);}}
function setup(){
 const storage=new Storage(),machine=decodeMachine(null);
 machine.assembly.name='MABEL';storeMachine(storage,machine);
 loadStable(storage,'2026-10-21T17:00:00.000Z');return storage;
}
function hurt(storage,slot,condition,armor=0){
 const machine=loadMachine(storage),serial=machine.assembly.installed[slot];
 machine.assembly.owned.find(p=>p.serial===serial).condition=condition;
 const state=machine.playerCondition.parts[slot];
 state.integrity=state.maxIntegrity*condition;state.armor=state.maxArmor*armor;
 if(slot==='mobility')machine.damage.drives[serial]={left:condition,right:condition};
 storeMachine(storage,machine);return serial;
}
test('multi-part triage spends exactly four units on one disabled and two critical systems',()=>{
 const storage=setup();
 const disabled=hurt(storage,'mobility',0),critical=hurt(storage,'power',.04),other=hurt(storage,'command',.06);
 const stable=loadStable(storage).stable;
 const choices=triageOptions(stable,'rig-01');
 assert.deepEqual(choices.filter(c=>['mobility','power','command'].includes(c.slot)).map(c=>c.cost),[2,1,1]);
 assert.equal(TRIAGE_BUDGET,4);
 const plan=triagePreview(stable,'rig-01',['mobility','power','command']);
 assert.equal(plan.cost,4);assert.equal(plan.fieldable,true);
 assert.equal(triagePreview(stable,'rig-01',['power','command']).fieldable,false);
 const begin=startSeries(storage,'yard-dog','rig-01','MABEL','assign-k4l');
 assert.equal(begin.ok,true);
 const round=recordSeriesRound(storage,{victory:true,reason:'ROUND WON'},{hasFieldableMachine:true});
 assert.equal(round.ok,true);assert.equal(fieldWorkRecoveryPossible(stable),true);
 const result=applyIntermissionTriage(storage,{
    seriesId:round.series.id,rigId:'rig-01',slots:['mobility','power','command'],now:78642});
 assert.equal(result.ok,true,result.reason);
 assert.equal(result.action.type,'triage');
 assert.equal(result.action.repairs.length,3);
 assert.equal(currentIntermissionFieldAction(storage,round.series)?.type,'triage');
 assert.equal(applyIntermissionTriage(storage,{
    seriesId:round.series.id,rigId:'rig-01',slots:['mobility']
 }).ok,false,'one committed action only');
 const saved=loadMachine(storage),after=loadStable(storage).stable;
 for(const [slot,serial] of [['mobility',disabled],['power',critical],['command',other]]){
    assert.equal(saved.assembly.owned.find(p=>p.serial===serial).condition,TRIAGE_CONDITION);
    const part=saved.playerCondition.parts[slot];
    assert.equal(part.integrity/part.maxIntegrity,TRIAGE_CONDITION);
    assert.ok(part.armor/part.maxArmor>=TRIAGE_ARMOR_FLOOR);
 }
 assert.equal(rigFieldability(after,'rig-01').fieldable,true);
 assert.equal(rigById(after,'rig-01').career.fieldServices,1);
});
test('triage is constrained by budget and never repairs destroyed hardware',()=>{
 const storage=setup();hurt(storage,'power',0);
 const machine=loadMachine(storage);machine.assembly.owned.find(p=>p.serial===machine.assembly.installed.command).destroyed=true;
 machine.playerCondition.parts.command.destroyed=true;storeMachine(storage,machine);
 const stable=loadStable(storage).stable;
 assert.equal(triageOptions(stable,'rig-01').some(c=>c.slot==='command'),false);
 assert.equal(triagePreview(stable,'rig-01',['power','command']).valid,false);
 assert.equal(triagePreview(stable,'rig-01',['power']).fieldable,false);
});
test('real scattergun retains six independent rays with stronger close-range nominal hit',()=>{
 const spec=WEAPONS['gun-scatter'];
 assert.equal(spec.pellets,6);
 assert.ok(spec.damage*spec.pellets*spec.roundsPerSecond>WEAPONS['gun-cannon'].damage*WEAPONS['gun-cannon'].roundsPerSecond);
 let count=0;
 const rays=shotContacts(2,spec,1,(x,y)=>{count++;return {x,y};});
 assert.equal(rays.length,6);assert.equal(count,6);
});
test('garage, audio and spectator flows retain all expected feedback hooks',()=>{
 const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
 const ui=read('unifiedGarageUI.js'),main=read('main.js'),scene=read('scene.js'),audio=read('audio.js');
 assert.match(ui,/SWAP \/ INVENTORY/);
 assert.match(ui,/unified-remove-icon/);
 assert.match(ui,/applyIntermissionTriage/);
 assert.match(main,/sortieOutroRemaining = 5/);
 assert.match(main,/orbitSpectatorBy/);
 assert.match(scene,/const illuminated=paintSelectedSlots \? false/);
 assert.match(audio,/soundWorkshop/);
 assert.match(main,/scatterFeedback/);
});
