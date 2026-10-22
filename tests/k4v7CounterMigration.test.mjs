import test from 'node:test';
import assert from 'node:assert/strict';
import { COUNTER_KEY, COUNTER_SIZE, COUNTER_VERSION, generateCounterStock,
    loadCounter, buyCounterLot } from '../usedPartsCounter.js';
import { decodeMachine,storeMachine,loadMachine } from '../persistence.js';
class Store{
    data=new Map();
    getItem(k){return this.data.get(k)??null;}
    setItem(k,v){this.data.set(k,String(v));}
    removeItem(k){this.data.delete(k);}
}
test('new cycles are six deterministic diverse serialized listings, not permanent S-6 promotion',()=>{
    assert.equal(COUNTER_VERSION,2);assert.equal(COUNTER_SIZE,6);
    for(let cycle=0;cycle<30;cycle++){
        const a=generateCounterStock(cycle);
        assert.deepEqual(a,generateCounterStock(cycle));
        assert.equal(a.offers.length,6);
        assert.equal(new Set(a.offers.map(o=>o.serial)).size,6);
        assert.ok(a.offers.some(o=>o.definitionId.startsWith('gun-')));
        assert.ok(a.offers.some(o=>o.definitionId.startsWith('legs-')));
    }
    assert.equal(generateCounterStock(0).offers[0].definitionId,'gun-scatter');
    assert.ok(Array.from({length:30},(_,n)=>generateCounterStock(n+1))
        .some(stock=>stock.offers[0].definitionId!=='gun-scatter'));
});
test('active old four-item rotations preserve purchase truth and only future cycle gains six',()=>{
    const storage=new Store(),legacy=generateCounterStock(7);
    legacy.version=1;legacy.offers=legacy.offers.slice(0,4);
    legacy.offers[1].sold=true;
    const raw=JSON.stringify(legacy);
    storage.setItem(COUNTER_KEY,raw);
    assert.equal(loadCounter(storage,7).persisted,true);
    assert.deepEqual(loadCounter(storage,7).stock,legacy);
    assert.equal(storage.getItem(COUNTER_KEY),raw,'load does not rewrite old stock');
    const fresh=loadCounter(storage,8).stock;
    assert.equal(fresh.version,2);assert.equal(fresh.offers.length,6);
    assert.ok(fresh.offers.every(o=>o.sold===false));
    assert.equal(loadCounter(storage,8).stock.offers[0].serial,fresh.offers[0].serial);
});
test('a purchase from surviving legacy stock commits one physical serial, no added free lots',()=>{
    const storage=new Store(),legacy=generateCounterStock(9);
    legacy.version=1;legacy.offers=legacy.offers.slice(0,4);
    storage.setItem(COUNTER_KEY,JSON.stringify(legacy));
    const machine=decodeMachine(null);machine.economy.credits=25000;
    assert.equal(storeMachine(storage,machine),true);
    const lot=legacy.offers[0],credits=machine.economy.credits;
    const result=buyCounterLot(storage,9,lot.serial,machine);
    assert.equal(result.ok,true,result.reason);
    assert.equal(machine.economy.credits,credits-lot.price);
    assert.equal(loadMachine(storage).assembly.owned.filter(p=>p.serial===lot.serial).length,1);
    assert.equal(loadCounter(storage,9).stock.offers.length,4);
    assert.equal(loadCounter(storage,9).stock.offers[0].sold,true);
});
