import test from 'node:test';
import assert from 'node:assert/strict';
import { recordCombatMatch,recordCombatRound,loadCombatRecords,combatAccuracy } from '../combatRecords.js';
import { createSeries,startSeries,recordSeriesRound,loadSeries,beginSeriesRound } from '../series.js';
import { createSortieAssignment,storeSortieAssignment,markSortieLaunching,markSortieDeployed,loadSortieAssignment } from '../sortieAssignment.js';
import { reconcileMatchOnBoot,retireUnfinishedMatch } from '../matchRecovery.js';

class Storage {
    constructor(){this.data=new Map();}
    getItem(k){return this.data.get(k)??null;}
    setItem(k,v){this.data.set(k,String(v));}
    removeItem(k){this.data.delete(k);}
}
function deployed(local,session){
    const assignment=createSortieAssignment('yard-dog',1000,'assignment-1');
    storeSortieAssignment(session,{...assignment,rigId:'rig-01',rigName:'MABEL',phase:'launching'});
    markSortieDeployed(session);
    startSeries(local,'yard-dog','rig-01','MABEL','assignment-1',1000);
}
test('refreshing a committed live round resumes without a fake result',()=>{
    const local=new Storage(),session=new Storage();deployed(local,session);
    assert.equal(reconcileMatchOnBoot(local,session).action,'resume');
    assert.equal(loadCombatRecords(local).totals.matches,0);
    assert.equal(loadSeries(local).phase,'round_active');
});
test('a lost tab session retires a live round as DNF and unlocks the next assignment',()=>{
    const local=new Storage();const session=new Storage();deployed(local,session);
    const abandoned=reconcileMatchOnBoot(local,new Storage());
    assert.equal(abandoned.action,'retired');
    assert.equal(loadSeries(local),null);
    assert.equal(loadCombatRecords(local).recentMatches[0].outcome,'DNF');
    assert.equal(loadCombatRecords(local).totals.losses,0);
});
test('intermission restored to pit with a pending assignment and preserved score',()=>{
    const local=new Storage(),session=new Storage();deployed(local,session);
    recordSeriesRound(local,{victory:true});
    const result=reconcileMatchOnBoot(local,session);
    assert.equal(result.action,'pit-restored');
    assert.equal(loadSeries(local).playerWins,1);
    assert.equal(loadSortieAssignment(session).phase,'pending');
});
test('manual retirement is idempotent, preserves unrelated saved data and never counts loss',()=>{
    const local=new Storage(),session=new Storage();deployed(local,session);local.setItem('wallet','600');
    assert.equal(retireUnfinishedMatch(local,session).action,'retired');
    assert.equal(retireUnfinishedMatch(local,session).action,'none');
    assert.equal(local.getItem('wallet'),'600');
    assert.equal(loadCombatRecords(local).totals.dnf,1);
    assert.equal(loadCombatRecords(local).totals.losses,0);
});
test('round evidence deduplicates and attributes stats to a rig and exact combat serial',()=>{
    const local=new Storage();
    const round={id:'series-1/round/1',seriesId:'series-1',contractId:'yard-dog',rigId:'rig-01',
        weaponSerial:'WEAPON-42',parts:{combat:'WEAPON-42',mobility:'LEGS-17'},
        victory:true,shots:8,projectiles:13,hits:7,kills:2,breaches:3,disables:1,
        armorDamage:96,internalDamage:28,damageTaken:41,damageTakenBySlot:{mobility:30,combat:11}};
    assert.equal(recordCombatRound(local,round).ok,true);
    assert.equal(recordCombatRound(local,round).duplicate,true);
    const result=loadCombatRecords(local);
    assert.equal(result.totals.rounds,1);
    assert.equal(result.rigs['rig-01'].kills,2);
    assert.equal(result.parts['WEAPON-42'].shots,8);
    assert.equal(result.parts['LEGS-17'].damageTaken,30);
    assert.equal(combatAccuracy(result.totals),53.8);
});
test('recent match history stores win loss and interrupted separately',()=>{
    const local=new Storage();
    for(const [id,outcome] of [['match-1','W'],['match-2','L'],['match-3','DNF']]){
        recordCombatMatch(local,{id,outcome,rigs:['rig-01'],playerWins:outcome==='W'?2:0,enemyWins:1});
    }
    const data=loadCombatRecords(local);
    assert.deepEqual(data.recentMatches.map(x=>x.outcome),['DNF','L','W']);
    assert.equal(data.rigs['rig-01'].wins,1);
    assert.equal(data.rigs['rig-01'].losses,1);
    assert.equal(data.totals.dnf,1);
});

test('retiring orphaned series never erases a separate newly staged contract',()=>{
    const local=new Storage(),session=new Storage();deployed(local,session);
    storeSortieAssignment(session,createSortieAssignment('mule',2000,'fresh-pending'));
    const result=reconcileMatchOnBoot(local,session);
    assert.equal(result.action,'retired');
    assert.equal(loadSortieAssignment(session).contractId,'mule');
    assert.equal(loadSortieAssignment(session).phase,'pending');
    assert.equal(loadSeries(local),null);
});
test('reloading after a settled BO3 releases only lifecycle lock',()=>{
    const local=new Storage(),session=new Storage();deployed(local,session);
    recordSeriesRound(local,{victory:true});beginSeriesRound(local,'rig-01','MABEL','assignment-2');
    recordSeriesRound(local,{victory:true});
    const result=reconcileMatchOnBoot(local,session);
    assert.equal(result.action,'completed-cleanup');
    assert.equal(loadSeries(local),null);
    assert.equal(loadCombatRecords(local).totals.dnf,0);
});
