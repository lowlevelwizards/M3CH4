import test from 'node:test';
import assert from 'node:assert/strict';
import { BY_ID } from '../components.js';
import { createTargetCondition, createTargetPartCondition } from '../combat.js';
import { decodeMachine, loadMachine, storeMachine } from '../persistence.js';
import { bayAssembly, bayHealth, bayModuleQuote, serviceInactiveBay } from '../garageBay.js';
import { loadStable, mountPartOnRig, rigById, storeStable } from '../stable.js';
import { repairQuote } from '../economy.js';

class Storage {
    constructor(){ this.items=new Map(); }
    getItem(key){ return this.items.get(key) ?? null; }
    setItem(key,value){ this.items.set(key,String(value)); }
    removeItem(key){ this.items.delete(key); }
}

function incompleteBay() {
    const storage=new Storage();
    const machine=decodeMachine(null);
    const original=machine.assembly.owned.find(p=>BY_ID.get(p.definitionId)?.slot==='structure');
    assert.ok(original,'starter has a genuine owned frame');
    machine.assembly.owned.push({...original,serial:'SPARE-PARTIAL-FRAME',condition:.35,wear:.1,repairs:0,destroyed:false});
    assert.ok(storeMachine(storage,machine));
    const stable=loadStable(storage).stable;
    const mounted=mountPartOnRig(stable,'rig-02','structure','SPARE-PARTIAL-FRAME');
    assert.equal(mounted.ok,true,mounted.reason);
    assert.ok(storeStable(storage,stable));
    return storage;
}

test('incomplete Rig 02 may quote one installed part without requiring missing combat stations',()=>{
    const storage=incompleteBay();
    const stable=loadStable(storage).stable;
    const rig=rigById(stable,'rig-02');
    assert.deepEqual(Object.keys(rig.installed),['structure']);
    assert.equal(rig.playerCondition,null);
    const assembly=bayAssembly(stable,'rig-02');
    assert.throws(()=>createTargetCondition(assembly,true),/Target requires mobility/,'combat must still require complete physical hit volumes');
    const condition=createTargetPartCondition(assembly,'structure',true);
    const quote=bayModuleQuote(stable,'rig-02','structure');
    assert.equal(quote.serial,'SPARE-PARTIAL-FRAME');
    assert.equal(quote.amount,repairQuote(condition));
    assert.ok(quote.amount>0);
    assert.equal(bayModuleQuote(stable,'rig-02','mobility'),null,'uninstalled station has no quote');
});

test('single part can be serviced in an uncommissioned, incomplete Rig 02',()=>{
    const storage=incompleteBay();
    const result=serviceInactiveBay(storage,'rig-02','structure',10000);
    assert.equal(result.ok,true,result.reason);
    assert.equal(result.serial,'SPARE-PARTIAL-FRAME');
    assert.equal(result.part.condition,1);
    assert.ok(result.charged>0);
    // Same live-v8 mirroring contract used by main.js for all inactive-bay service.
    const live=loadMachine(storage);
    Object.assign(live.assembly.owned.find(x=>x.serial===result.serial),result.part);
    assert.equal(storeMachine(storage,live),true);
    const stable=loadStable(storage).stable;
    const rig=rigById(stable,'rig-02');
    assert.deepEqual(Object.keys(rig.installed),['structure'],'service cannot manufacture missing stations');
    assert.equal(rig.commissioned,false);
    assert.equal(rig.playerCondition,null,'uncommissioned bays do not acquire a fake full combat snapshot');
    assert.equal(bayHealth(stable,'rig-02').find(x=>x.slot==='structure').condition,1);
    assert.equal(bayModuleQuote(stable,'rig-02','structure').amount,0);
});

test('a stale slot snapshot cannot quote repair costs against the wrong serial',()=>{
    const stable=loadStable(incompleteBay()).stable;
    const rig=rigById(stable,'rig-02');
    rig.playerCondition={parts:{structure:{
        slot:'structure',serial:'OLD-FRAME',integrity:0,maxIntegrity:260,armor:0,maxArmor:250,impacts:0,
    }},shotsHit:0};
    const quote=bayModuleQuote(stable,'rig-02','structure');
    assert.equal(quote.amount,repairQuote(createTargetPartCondition(bayAssembly(stable,'rig-02'),'structure',true)));
    assert.ok(quote.amount>0);
});

test('frame-less staged cab in Rig 02 can show its honest repair quote',()=>{
    const storage=new Storage(), machine=decodeMachine(null);
    const cab=machine.assembly.owned.find(p=>BY_ID.get(p.definitionId)?.slot==='command');
    assert.ok(cab);
    machine.assembly.owned.push({...cab,serial:'SPARE-STAGED-CAB',condition:.45,wear:0,repairs:0,destroyed:false});
    assert.equal(storeMachine(storage,machine),true);
    const stable=loadStable(storage).stable;
    const result=mountPartOnRig(stable,'rig-02','command','SPARE-STAGED-CAB');
    assert.equal(result.ok,true,result.reason);
    assert.equal(bayHealth(stable,'rig-02').find(x=>x.slot==='structure').serial,null);
    assert.throws(()=>createTargetCondition(bayAssembly(stable,'rig-02'),true),/Target requires structure/);
    const quote=bayModuleQuote(stable,'rig-02','command');
    assert.equal(quote.serial,'SPARE-STAGED-CAB');
    assert.ok(quote.amount>0);
    assert.equal(serviceInactiveBay(storage,'rig-02','command',10000).ok,false,
        'unsaved staged equipment is not serviceable until its physical ownership is persisted');
    assert.equal(storeStable(storage,stable),true);
    const service=serviceInactiveBay(storage,'rig-02','command',10000);
    assert.equal(service.ok,true,service.reason);
    assert.equal(service.part.condition,1);
});
