import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { decodeMachine, loadMachine, storeMachine } from '../persistence.js';
import { loadStable, storeStable, rigById, mountPartOnRig, commissionRig, renameRig } from '../stable.js';
import { createTargetCondition } from '../combat.js';
import { recordSeriesRound, startSeries } from '../series.js';
import { applyEmergencyFieldPatch, FIELD_PATCH_CONDITION } from '../fieldWork.js';
import { BAY_IDS, BAY_SLOTS, bayAssembly, bayStatus, bayHealth, changeInactiveBay, serviceInactiveBay, setInactiveBayGeneratorMount, bayGeneratorMount } from '../garageBay.js';

class MemoryStorage {
    constructor() { this.map = new Map(); }
    getItem(k) { return this.map.has(k) ? this.map.get(k) : null; }
    setItem(k,v) { this.map.set(k,String(v)); }
    removeItem(k) { this.map.delete(k); }
}
function fixture() {
    const storage = new MemoryStorage();
    const machine = decodeMachine(null);
    machine.assembly.name = 'MABEL';
    for (const [slot, serial] of Object.entries(machine.assembly.installed)) {
        const original = machine.assembly.owned.find(p => p.serial === serial);
        machine.assembly.owned.push({ ...original, serial:'SPARE-'+slot, condition:1, destroyed:false, repairs:0, wear:0 });
    }
    assert.equal(storeMachine(storage,machine),true);
    const stable = loadStable(storage).stable;
    for (const slot of BAY_SLOTS) {
        const result = mountPartOnRig(stable,'rig-02',slot,'SPARE-'+slot);
        assert.equal(result.ok,true,slot + ': ' + result.reason);
    }
    assert.equal(renameRig(stable,'rig-01','MABEL').ok,true);
    assert.equal(commissionRig(stable,'rig-02','DOGTOOTH').ok,true);
    assert.equal(storeStable(storage,stable),true);
    return storage;
}
function damageParked(storage,slot,integrity=0) {
    const machine = loadMachine(storage);
    const serial = 'SPARE-'+slot;
    machine.assembly.owned.find(p=>p.serial===serial).condition=integrity;
    storeMachine(storage,machine);
    const stable = loadStable(storage).stable;
    const rig = rigById(stable,'rig-02');
    const snapshot = rig.playerCondition.parts[slot];
    snapshot.integrity=snapshot.maxIntegrity*integrity;
    snapshot.armor=0;
    storeStable(storage,stable);
    return serial;
}
test('viewing any of three bays does not change combat-active machine or serialized ownership',()=>{
    const storage=fixture();
    const stable=loadStable(storage).stable;
    assert.equal(stable.activeRigId,'rig-01');
    assert.deepEqual(BAY_IDS,['rig-01','rig-02','rig-03']);
    assert.equal(bayStatus(stable,'rig-01').name,'MABEL');
    assert.equal(bayStatus(stable,'rig-02').name,'DOGTOOTH');
    assert.equal(bayStatus(stable,'rig-02').canDeploy,true);
    assert.equal(bayStatus(stable,'rig-03').state,'EMPTY');
    assert.equal(bayStatus(stable,'rig-03').canDeploy,false);
    assert.deepEqual(bayAssembly(stable,'rig-03').installed,{});
    assert.equal(bayAssembly(stable,'rig-02').installed.combat,'SPARE-combat');
    assert.equal(loadStable(storage).stable.activeRigId,'rig-01');
});
test('the same five physical station operations work on parked bays and never steal owned serials',()=>{
    const storage=fixture();
    const originalCombat=loadMachine(storage).assembly.installed.combat;
    assert.equal(changeInactiveBay(storage,'rig-02','combat',null).ok,true);
    assert.equal(bayStatus(loadStable(storage).stable,'rig-02').canDeploy,false);
    assert.equal(changeInactiveBay(storage,'rig-02','combat','SPARE-combat').ok,true);
    const blocked=changeInactiveBay(storage,'rig-02','combat',loadMachine(storage).assembly.installed.combat);
    assert.equal(blocked.ok,false);
    assert.match(blocked.reason,/MOUNTED ON/);
    const stable=loadStable(storage).stable;
    assert.equal(rigById(stable,'rig-02').installed.combat,'SPARE-combat');
    assert.equal(stable.activeRigId,'rig-01');
    assert.equal(loadMachine(storage).assembly.installed.combat,originalCombat);
});
test('parked rig service repairs exact serial and can be mirrored to shared active inventory',()=>{
    const storage=fixture();
    damageParked(storage,'combat',.2);
    const before=loadStable(storage).stable;
    assert.ok(bayHealth(before,'rig-02').find(x=>x.slot==='combat').condition <= .2);
    const repaired=serviceInactiveBay(storage,'rig-02','combat',10000);
    assert.equal(repaired.ok,true,repaired.reason);
    assert.equal(repaired.serial,'SPARE-combat');
    assert.equal(repaired.part.condition,1);
    const live=loadMachine(storage);
    Object.assign(live.assembly.owned.find(p=>p.serial===repaired.serial),repaired.part);
    live.economy.credits-=repaired.charged;
    assert.equal(storeMachine(storage,live),true);
    const stable=loadStable(storage).stable;
    assert.equal(stable.inventory.find(p=>p.serial===repaired.serial).condition,1);
    assert.equal(bayStatus(stable,'rig-02').canDeploy,true);
    assert.equal(stable.activeRigId,'rig-01');
});
test('patched parked rig survives reload because the global v8 inventory mirrors the repaired serial',()=>{
    const storage=fixture();
    const serial=damageParked(storage,'combat',0);
    const series=startSeries(storage,'yard-dog','rig-01','MABEL','assignment-1');
    assert.equal(series.ok,true);
    const round=recordSeriesRound(storage,{victory:true,reason:'R1'},{hasFieldableMachine:true});
    assert.equal(round.series.phase,'intermission');
    const patch=applyEmergencyFieldPatch(storage,{seriesId:series.series.id,rigId:'rig-02',slot:'combat'});
    assert.equal(patch.ok,true,patch.reason);
    assert.equal(loadMachine(storage).assembly.owned.find(p=>p.serial===serial).condition,FIELD_PATCH_CONDITION);
    const stable=loadStable(storage).stable;
    assert.equal(stable.inventory.find(p=>p.serial===serial).condition,FIELD_PATCH_CONDITION);
    assert.equal(rigById(stable,'rig-02').playerCondition.parts.combat.integrity,
        rigById(stable,'rig-02').playerCondition.parts.combat.maxIntegrity*FIELD_PATCH_CONDITION);
    assert.equal(stable.activeRigId,'rig-01');
});
test('mobile UX has a single physical bay navigator and explicit contract/setup/pit states',()=>{
    const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
    const garage=fs.readFileSync(new URL('../garageMountUI.js',import.meta.url),'utf8');
    const ui=fs.readFileSync(new URL('../unifiedGarageUI.js',import.meta.url),'utf8');
    const css=fs.readFileSync(new URL('../unifiedGarageStyles.css',import.meta.url),'utf8');
    assert.match(html,/0\.0\.1k\.3v\.5\.1/);
    assert.match(garage,/unifiedGarageUI\.js\?v=k3v5p1/);
    assert.doesNotMatch(garage,/import '\.\/fieldWorkUI\.js/);
    assert.match(ui,/mode = 'garage'/);
    assert.match(ui,/mode\s*=\s*'contracts'/);
    assert.match(ui,/mode='setup'/);
    assert.match(ui,/return series\?\.phase === 'intermission' \? 'pit'/);
    assert.match(ui,/arena\.rebuildAssembly\(bayAssembly\(stable, viewedId\)\)/);
    assert.match(ui,/clearSortieAssignment\(session\)/);
    assert.match(ui,/oldDeploy\.click\(\)/);
    assert.match(ui,/FIELD PATCH/);
    assert.match(css,/body\.inspecting #inspection-panel \{ display:none !important; \}/);
    assert.match(css,/body\.inspecting #assembly-toggle \{ display:none !important; \}/);
});

test('parked rig generator mounting obeys physical graph constraints without changing the active rig',()=>{
    const storage=fixture();
    let stable=loadStable(storage).stable;
    const first=bayGeneratorMount(stable,'rig-01');
    assert.equal(bayGeneratorMount(stable,'rig-02'),'standard');
    const mounted=setInactiveBayGeneratorMount(storage,'rig-02','offset');
    assert.equal(mounted.ok,true,mounted.reason);
    stable=loadStable(storage).stable;
    assert.equal(bayGeneratorMount(stable,'rig-02'),'offset');
    assert.equal(bayGeneratorMount(stable,'rig-01'),first);
    assert.equal(stable.activeRigId,'rig-01');
    assert.equal(setInactiveBayGeneratorMount(storage,'rig-02','standard').ok,true);
    assert.equal(bayGeneratorMount(loadStable(storage).stable,'rig-02'),'standard');
});

test('physical tap reaches the same station UI without mutating combat-active selection',()=>{
    const main=fs.readFileSync(new URL('../main.js',import.meta.url),'utf8');
    const ui=fs.readFileSync(new URL('../unifiedGarageUI.js',import.meta.url),'utf8');
    assert.match(main,/m3ch4:bay-picked/);
    assert.match(ui,/addEventListener\('m3ch4:bay-picked'/);
    assert.match(ui,/selectedSlot = slot/);
    assert.match(main,/m3ch4:bay-reconcile-patch/);
    assert.match(ui,/m3ch4:bay-reconcile-patch/);
});
