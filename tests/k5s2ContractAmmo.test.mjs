import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { WEAPONS, createWeaponState, startReload, advanceWeapon, reserveReadout, ammoCostCents } from '../combat.js';
import { settleSortie, POST_BOUT_RECOVERY_FLOOR } from '../economy.js';

test('all eight weapons have intentional, positive, distinct contract ammunition rates', () => {
    const expected = {
        'gun-cannon': 100, 'gun-short': 100, 'gun-light': 75, 'gun-scatter': 200,
        'gun-rivet': 25, 'gun-breaker': 400, 'gun-rocket': 800, 'gun-arc': 5,
    };
    assert.deepEqual(Object.fromEntries(Object.values(WEAPONS).map(w=>[w.id,w.ammoCostCents])),expected);
    for (const weapon of Object.values(WEAPONS)) {
        assert.equal(ammoCostCents(weapon),expected[weapon.id]);
        assert.equal(ammoCostCents(weapon,7),expected[weapon.id]*7);
        assert.ok(weapon.magazine>0 && weapon.reloadSeconds>0);
    }
});

test('player and AI use the same unlimited contract reserve and unchanged mechanical reloads', () => {
    for (const weapon of Object.values(WEAPONS)) {
        for (const controller of ['player','AI']) {
            const state=createWeaponState(weapon);
            assert.equal(state.loaded,weapon.magazine);
            assert.equal(reserveReadout(state),'∞');
            assert.equal(state.reserve,Infinity);
            for(let i=0;i<32;i++){
                state.loaded=0;
                assert.equal(startReload(state,weapon),true,`${controller} ${weapon.id} reload ${i}`);
                assert.equal(startReload(state,weapon),false,'no duplicate active reload');
                advanceWeapon(state,weapon,weapon.reloadSeconds+.001);
                assert.equal(state.loaded,weapon.magazine);
                assert.equal(state.reserve,Infinity);
            }
        }
    }
});

test('legacy finite ammo state remains well-defined during migration',()=>{
    const spec=WEAPONS['gun-short'],state={...createWeaponState(spec),loaded:0,reserve:3};
    assert.equal(startReload(state,spec),true);
    advanceWeapon(state,spec,spec.reloadSeconds);
    assert.equal(state.loaded,3);
    assert.equal(state.reserve,0);
});

test('single-match ammunition invoice charges actual cent prices without per-shot rounding',()=>{
    const result=settleSortie({
        credits:600,victory:true,roundsFired:7,
        ammoCostCents:ammoCostCents(WEAPONS['gun-rivet'],7),victoryPayout:850,
    });
    assert.equal(result.ammoCost,2,'seven ₡0.25 rivets invoice to ₡1.75, billed as ₡2');
    assert.equal(result.grossPayout,850);
    assert.equal(result.creditsAfter,1448);
    assert.equal(result.ammoAssistance,0);
});

test('lost contract can never become unplayable from ammunition charges',()=>{
    const bill=settleSortie({credits:0,victory:false,roundsFired:500,ammoCostCents:500000});
    assert.equal(bill.grossPayout,350);
    assert.equal(bill.ammoCost,5000);
    assert.equal(bill.creditsAfter,POST_BOUT_RECOVERY_FLOOR);
    assert.equal(bill.ammoAssistance,4800);
    assert.equal(bill.netPayout,POST_BOUT_RECOVERY_FLOOR);
});

test('production code bills consumed discharges once, preserves AI and collision handling',()=>{
    const main=fs.readFileSync(new URL('../main.js',import.meta.url),'utf8');
    const index=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
    const yard=fs.readFileSync(new URL('../test-yard.html',import.meta.url),'utf8');
    assert.match(main,/const shot = fireWeapon\(weaponState, weaponSpec\)/);
    assert.match(main,/sortieAmmoCostCents \+= ammoCostCents\(weaponSpec\)/);
    assert.match(main,/ammoCostCents: sortieAmmoCostCents/);
    assert.match(main,/sortieAmmoCostCents = 0/);
    assert.match(main,/attemptAiFire\(actor,target,shot\)/);
    assert.match(main,/shotContacts\(shot,weaponSpec/);
    assert.match(main,/reserveReadout\(weaponState\)/);
    assert.match(main,/summary\.ammoAssistance/);
    for(const html of [index,yard]){
        for(const path of ['combat.js','economy.js','series.js'])
            assert.ok(html.includes(`"./${path}": "./${path}?v=k5s2"`),path);
        assert.match(html,/main\.js\?v=k5s2/);
    }
});
