import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { BY_ID } from '../components.js';
import { createCampaignState, recordCampaignSortie } from '../campaign.js';
import { createEconomyState } from '../economy.js';
import { loadMachine, storeMachine, decodeMachine } from '../persistence.js';
import { loadStable, registerAcquiredPart, storeStable } from '../stable.js';
import { partCreditValue } from '../partEconomy.js';
import { COUNTER_SIZE, COUNTER_KEY, generateCounterStock, loadCounter, buyCounterLot } from '../usedPartsCounter.js';

class MemoryStorage {
    constructor() {this.data=new Map();this.failCounter=false;}
    getItem(k){return this.data.has(k)?this.data.get(k):null;}
    setItem(k,v){if(this.failCounter&&k===COUNTER_KEY)throw Error('vendor unavailable');this.data.set(k,String(v));}
    removeItem(k){this.data.delete(k);}
}
function setup() {
    const storage=new MemoryStorage();
    const machine=decodeMachine(null);
    machine.economy=createEconomyState(25000);
    assert.equal(storeMachine(storage,machine),true);
    return storage;
}
const code=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('vendor presents four deterministic serialized as-is parts, never freshly rerolling on reopen',()=>{
    const a=generateCounterStock(0),b=generateCounterStock(0);
    assert.equal(a.offers.length,COUNTER_SIZE);
    assert.deepEqual(a,b);
    assert.equal(new Set(a.offers.map(l=>l.serial)).size,4);
    assert.ok(a.offers.every(l=>BY_ID.has(l.definitionId)&&l.price>0&&!l.sold));
    assert.ok(a.offers.some(l=>l.condition<.75));
    assert.notDeepEqual(generateCounterStock(1).offers.map(l=>l.serial),a.offers.map(l=>l.serial));
});
test('most vendor offers are meaningfully marked up over their actual yard condition value',()=>{
    const lots=Array.from({length:24},(_,i)=>generateCounterStock(i).offers).flat();
    const overpriced=lots.filter(l=>l.price>=1.39*partCreditValue(l.definitionId,l.condition,{wear:l.wear})).length;
    const worn=lots.filter(l=>l.condition<.78).length;
    assert.ok(overpriced>=lots.length*.87,'markup: '+overpriced+'/'+lots.length);
    assert.ok(worn>=lots.length*.80,'worn: '+worn+'/'+lots.length);
    assert.ok(lots.some(l=>l.condition>.79),'rare more promising lots exist');
});
test('four lots persist independently of menu visits; sold-out table retains its empty slots',()=>{
    const storage=setup();
    const first=loadCounter(storage,0);
    assert.equal(first.persisted,true);
    assert.equal(loadCounter(storage,0).stock.offers[0].serial,first.stock.offers[0].serial);
    const machine=loadMachine(storage);
    for (const offer of first.stock.offers) {
        const result=buyCounterLot(storage,0,offer.serial,machine);
        assert.equal(result.ok,true,result.reason);
        assert.equal(loadCounter(storage,0).stock.offers.find(l=>l.serial===offer.serial).sold,true);
    }
    assert.equal(loadCounter(storage,0).stock.offers.length,4);
    assert.equal(loadCounter(storage,0).stock.offers.filter(l=>!l.sold).length,0);
    assert.equal(buyCounterLot(storage,0,first.stock.offers[0].serial,machine).ok,false);
});
test('a complete contract, not a new round or clock tick, refreshes the whole table',()=>{
    const storage=setup();
    const before=loadCounter(storage,0).stock;
    const machine=loadMachine(storage);
    assert.equal(buyCounterLot(storage,0,before.offers[0].serial,machine).ok,true);
    assert.equal(loadCounter(storage,0).stock.offers[0].sold,true);
    const activeCampaign=createCampaignState();
    assert.equal(activeCampaign.sorties,0);
    const after=recordCampaignSortie(activeCampaign,{nodeId:'yard-dog',victory:false});
    assert.equal(after.state.sorties,1);
    const replenished=loadCounter(storage,after.state.sorties).stock;
    assert.equal(replenished.offers.length,4);
    assert.ok(replenished.offers.every(l=>!l.sold));
    assert.notEqual(replenished.offers[0].serial,before.offers[0].serial);
    assert.equal(loadCounter(storage,after.state.sorties).stock.offers[0].serial,replenished.offers[0].serial);
});
test('purchase spends real credits and adds the exact physical serial to stable ownership',()=>{
    const storage=setup();
    const stableBefore=loadStable(storage).stable;
    const serialBefore=new Set(stableBefore.inventory.map(p=>p.serial));
    const chosen=loadCounter(storage,0).stock.offers[0];
    const machine=loadMachine(storage);
    const creditsBefore=machine.economy.credits;
    const done=buyCounterLot(storage,0,chosen.serial,machine);
    assert.equal(done.ok,true);
    assert.equal(machine.economy.credits,creditsBefore-chosen.price);
    const saved=loadMachine(storage);
    assert.equal(saved.economy.credits,creditsBefore-chosen.price);
    assert.equal(saved.assembly.owned.filter(p=>p.serial===chosen.serial).length,1);
    const acquired=saved.assembly.owned.find(p=>p.serial===chosen.serial);
    assert.equal(acquired.condition,chosen.condition);
    assert.equal(acquired.wear,chosen.wear);
    assert.equal(acquired.repairs,chosen.repairs);
    const loaded=loadStable(storage).stable;
    assert.equal(loaded.inventory.length,serialBefore.size+1);
    assert.ok(loaded.inventory.some(p=>p.serial===chosen.serial));
    registerAcquiredPart(loaded,chosen.serial,'used parts counter');
    assert.equal(storeStable(storage,loaded),true);
});
test('insufficient funds and vendor-save failure never award free hardware or burn credits',()=>{
    const storage=setup();
    const offer=loadCounter(storage,0).stock.offers[0];
    const machine=loadMachine(storage);
    machine.economy.credits=0;
    assert.equal(buyCounterLot(storage,0,offer.serial,machine).ok,false);
    assert.equal(machine.assembly.owned.some(p=>p.serial===offer.serial),false);
    machine.economy.credits=25000;
    const previous=machine.economy.credits;
    storage.failCounter=true;
    const result=buyCounterLot(storage,0,offer.serial,machine);
    assert.equal(result.ok,false);
    assert.match(result.reason,/REVERSED/);
    assert.equal(machine.economy.credits,previous);
    assert.equal(machine.assembly.owned.some(p=>p.serial===offer.serial),false);
    storage.failCounter=false;
    assert.equal(loadCounter(storage,0).stock.offers[0].sold,false);
});
test('3D counter uses actual part meshes on four separate table stalls with touch-selectable serials',()=>{
    const scene=code('scene.js'),main=code('main.js'),ui=code('unifiedGarageUI.js');
    assert.match(scene,/used-parts-counter-table/);
    assert.match(scene,/buildExteriorRig\(assembly\)/);
    assert.match(scene,/offers\|\|\[\]\)\.slice\(0,4\)/);
    assert.match(scene,/function pickVendorLot/);
    assert.match(scene,/raycaster\.intersectObjects\(vendorPicks,false\)/);
    assert.match(scene,/vendorRoot\.visible=inspecting&&vendorEnabled/);
    assert.match(main,/m3ch4:counter-picked/);
    assert.match(ui,/m3ch4:counter-picked/);
    assert.match(ui,/createPartCard\(/);
    assert.match(ui,/createPartDetail\(/);
    assert.match(ui,/BUY SERIAL/);
    assert.match(ui,/NO GUARANTEES\. NO REFUNDS/);
});
test('counter is only accessible from normal garage, and cannot bypass BO3 pit restrictions',()=>{
    const ui=code('unifiedGarageUI.js'),main=code('main.js');
    assert.match(ui,/currentMode === 'garage'\) \{/);
    assert.match(ui,/currentMode === 'vendor'/);
    assert.match(ui,/actualMode\(series\)/);
    assert.match(main,/dataset\.mode!=='vendor'/);
    assert.match(ui,/loadCampaign\(storage\)/);
    assert.match(ui,/stock\.cycle/);
    const mount=code('garageMountUI.js'),html=code('index.html');
    assert.match(mount,/unifiedGarageUI\.js\?v=k3u3/);
    assert.match(mount,/stableUI\.js\?v=k3t0/);
    assert.match(html,/sceneAssembly\.js\?v=k3t1/);
});
