import test from 'node:test';
import assert from 'node:assert/strict';
import { makeTestAssembly, SLOTS, installedPart } from '../components.js';
import { makeRangeTarget, createTargetCondition } from '../combat.js';
import { PAINT_PRESETS, PAINT_VARIANTS, paintVariant } from '../factoryPaint.js';
import {
    CONTRACT_CREWS, TEAM_LIVERY_KEY, contractCrew,
    storeTeamLivery,readTeamLivery,clearTeamLivery,friendlyPalette,
    applyCrewPaint,applyEnemyCrewPaint,applyFriendlyCrewPaint,
} from '../crewLivery.js';
import { wreckManifest, claimToRecoveryOffer } from '../salvageDraft.js';
import { recoverSalvage } from '../acquisition.js';

const storage=()=>{const db=new Map();return {
    getItem:key=>db.get(key)??null,
    setItem:(key,value)=>db.set(key,value),
    removeItem:key=>db.delete(key),
};};

test('exactly three variants permute pigments, never invent new colors',()=>{
    const colors=PAINT_PRESETS[0].colors;
    assert.equal(PAINT_VARIANTS.length,3);
    const [a,b,c]=[0,1,2].map(n=>paintVariant(colors,n));
    assert.deepEqual(a,colors);
    assert.equal(b.primary,colors.secondary);
    assert.equal(b.secondary,colors.primary);
    assert.equal(c.primary,colors.armor);
    assert.equal(c.secondary,colors.primary);
    assert.equal(c.armor,colors.secondary);
    for(const p of [a,b,c])assert.deepEqual(new Set(Object.values(p)),new Set(Object.values(colors)));
    assert.notStrictEqual(a,colors);
    assert.equal(paintVariant({primary:'#123456'},1),null);
    assert.deepEqual(paintVariant(colors,99),colors);
});

test('contract crews are distinct and their visual variants are deterministic',()=>{
    assert.equal(Object.keys(CONTRACT_CREWS).length,6);
    assert.equal(new Set(Object.values(CONTRACT_CREWS).map(c=>c.colors.primary)).size,6);
    for(const id of Object.keys(CONTRACT_CREWS)){
        const member=[0,1,2].map(index=>applyEnemyCrewPaint(makeRangeTarget(id),id,index));
        const colors=member.map(r=>installedPart(r,'structure').instance.paint);
        assert.deepEqual(colors[0],paintVariant(contractCrew(id).colors,0));
        assert.deepEqual(colors[1],paintVariant(contractCrew(id).colors,1));
        assert.deepEqual(colors[2],paintVariant(contractCrew(id).colors,2));
        assert.deepEqual(member.map(r=>r.installed),[member[0].installed,member[0].installed,member[0].installed]);
    }
});

test('allied inheritance never mutates player serials; explicit team palette can be removed',()=>{
    const db=storage(),player=makeTestAssembly();
    assert.deepEqual(friendlyPalette(db,player),{primary:'#767a76',secondary:'#515958',armor:'#93968e',accent:'#8d745d'});
    const first=installedPart(player,'structure').instance;
    first.paint={...PAINT_PRESETS[3].colors};
    assert.deepEqual(friendlyPalette(db,player),first.paint);
    const source=JSON.stringify(player.owned);
    const a=applyFriendlyCrewPaint(makeRangeTarget('cutter'),db,player,1);
    const b=applyFriendlyCrewPaint(makeRangeTarget('mule'),db,player,2);
    assert.deepEqual(installedPart(a,'combat').instance.paint,paintVariant(first.paint,1));
    assert.deepEqual(installedPart(b,'combat').instance.paint,paintVariant(first.paint,2));
    assert.equal(JSON.stringify(player.owned),source);
    assert.equal(readTeamLivery(db),null);
    assert.equal(storeTeamLivery(db,PAINT_PRESETS[1].colors),true);
    assert.ok(db.getItem(TEAM_LIVERY_KEY));
    assert.deepEqual(friendlyPalette(db,player),PAINT_PRESETS[1].colors);
    assert.equal(storeTeamLivery(db,{primary:'invalid'}),false);
    assert.equal(clearTeamLivery(db),true);
    assert.deepEqual(friendlyPalette(db,player),first.paint);
    assert.equal(readTeamLivery(db),null);
});

test('defeated enemy paint survives a wreck manifest and becomes owned salvage',()=>{
    const enemy=applyEnemyCrewPaint(makeRangeTarget('cutter'),'cutter',1);
    const condition=createTargetCondition(enemy);
    const manifest=wreckManifest({id:'enemy-0',assembly:enemy,condition,active:false});
    const entry=manifest.parts.find(p=>p.slot==='mobility');
    assert.deepEqual(entry.paint,paintVariant(contractCrew('cutter').colors,1));
    const offer=claimToRecoveryOffer(entry);
    assert.deepEqual(offer.paint,entry.paint);
    const owner=makeTestAssembly();
    const recovered=recoverSalvage(owner,offer);
    assert.equal(recovered.ok,true);
    assert.deepEqual(recovered.instance.paint,entry.paint);
    assert.equal(recovered.instance.serial,entry.sourceSerial);
    assert.equal(SLOTS.length,5);
});
