import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { decodeMachine, storeMachine } from '../persistence.js';
import { loadStable, storeStable, rigById, serialOwner } from '../stable.js';
import { BAY_IDS, bayHealth, bayAssembly, changeInactiveBay } from '../garageBay.js';
import { createTargetCondition } from '../combat.js';
import { FRIENDLY_TEAM,HOSTILE_TEAM,squadOutcome } from '../squadBattle.js';
import { createSortieObjective,advanceSortieObjective } from '../sortieObjectives.js';
import { contractById } from '../contracts.js';
const source=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
class MemoryStorage{
    constructor(){this.map=new Map()}
    getItem(k){return this.map.get(k)??null}
    setItem(k,v){this.map.set(k,String(v))}
    removeItem(k){this.map.delete(k)}
}
function fresh(){
    const storage=new MemoryStorage();
    assert.equal(storeMachine(storage,decodeMachine(null)),true);
    return storage;
}
test('inactive bay 2 and 3 installed serialized parts can be removed and returned to inventory',()=>{
    const storage=fresh();
    // No assumption that starter inventory provides two spare frames:
    // two physical duplicate serials are deliberately acquired for this test.
    const machine=decodeMachine(null);
    const frame=machine.assembly.owned.find(p=>p.definitionId.startsWith('frame-'));
    assert.ok(frame);
    machine.assembly.owned.push({...frame,serial:'TEST-FRAME-R2'},
        {...frame,serial:'TEST-FRAME-R3'});
    assert.equal(storeMachine(storage,machine),true);
    const stable=loadStable(storage).stable;
    assert.equal(BAY_IDS.length,3);
    const spare=stable.inventory.filter(p=>p.serial==='TEST-FRAME-R2'||p.serial==='TEST-FRAME-R3');
    assert.equal(spare.length,2);
    for(const [i,rigId] of ['rig-02','rig-03'].entries()){
        const part=spare[i];
        let result=changeInactiveBay(storage,rigId,'structure',part.serial);
        assert.equal(result.ok,true,JSON.stringify(result));
        let check=loadStable(storage).stable;
        assert.equal(rigById(check,rigId).installed.structure,part.serial);
        assert.equal(serialOwner(check,part.serial).id,rigId);
        result=changeInactiveBay(storage,rigId,'structure',null);
        assert.equal(result.ok,true,JSON.stringify(result));
        check=loadStable(storage).stable;
        assert.equal(rigById(check,rigId).installed.structure,undefined);
        assert.equal(serialOwner(check,part.serial),null,'physical serial remains owned but no longer fitted');
        assert.ok(check.inventory.some(p=>p.serial===part.serial));
    }
});
test('every bay condition displays core and external armor separately, including intermission-level armor loss',()=>{
    const storage=fresh(),stable=loadStable(storage).stable;
    const active=rigById(stable,stable.activeRigId);
    const slot='structure',serial=active.installed[slot];
    const owned=stable.inventory.find(p=>p.serial===serial);
    owned.condition=1;
    const condition=active.playerCondition.parts[slot];
    condition.integrity=condition.maxIntegrity;
    condition.armor=condition.maxArmor*.12;
    const item=bayHealth(stable,active.id).find(x=>x.slot===slot);
    assert.equal(item.condition,1);
    assert.ok(Math.abs(item.armorRatio-.12)<1e-8);
    assert.equal(item.label,'CRITICAL');
    assert.equal(item.serial,serial);
    // The serialized body percent is not an "overall damage" number.
    assert.notEqual(item.condition,item.armorRatio);
});
test('the garage keeps mounted parts accessible and separates other-machine ownership',()=>{
    const ui=source('unifiedGarageUI.js');
    assert.match(ui,/selectedSlot = item\.slot; \/\/ Repeated taps always open details/);
    assert.match(ui,/selectedSlot = slot;/);
    assert.doesNotMatch(ui,/selectedSlot = selectedSlot === item\.slot \?/);
    assert.match(ui,/dock\.scrollTop = 0; \/\/ New machine/);
    assert.match(ui,/button\('×'/);
    assert.match(ui,/unified-remove-icon/);
    assert.match(ui,/SWAP \/ INVENTORY/);
    assert.match(ui,/actionDisabled: !!elsewhere/);
    assert.match(ui,/OTHER BAYS/);
    assert.match(ui,/OPEN BAY /);
    assert.match(ui,/bayHealth\(stable,owner\.id\)/);
    assert.match(ui,/createStationFace\(item\.slot,item\)/);
    assert.match(ui,/createConditionMeter\(/);
    assert.match(ui,/actualMode\(loadSeries\(storage\)\) !== 'garage'/);
});
test('sortie selection reuses the garage serial-matched armor snapshots',()=>{
    const ui=source('sortieAssignmentUI.js');
    assert.match(ui,/import \{ bayHealth \} from '\.\/garageBay\.js'/);
    assert.match(ui,/const states=bayHealth\(stable,rig\.id\)/);
    assert.match(ui,/Math\.min\(x\.condition,x\.armorRatio\)/);
    assert.match(ui,/LOWEST CORE\/ARMOR/);
});
test('the elimination resolver ends Domination when all enemy combat rigs have been disabled',()=>{
    const contract=contractById('domination');
    const state=createSortieObjective(contract);
    const actors=[
        {team:FRIENDLY_TEAM,id:'player',active:true,rig:{x:0,z:0}},
        {team:FRIENDLY_TEAM,id:'ally-1',active:true,rig:{x:0,z:0}},
        {team:HOSTILE_TEAM,id:'enemy-0',active:false,rig:{x:20,z:20}},
        {team:HOSTILE_TEAM,id:'enemy-1',active:false,rig:{x:21,z:21}},
        {team:HOSTILE_TEAM,id:'enemy-2',active:false,rig:{x:22,z:22}},
    ];
    assert.deepEqual(squadOutcome(true,actors).victory,true);
    assert.equal(state.complete,false);
    const main=source('main.js');
    assert.match(main,/checkSquadOutcome\(\)/);
    assert.match(main,/sortieOutroRemaining = 5/);
    assert.match(main,/renderDebrief\(next\.summary, next\.reason\)/);
});
test('DEV version comes from the actual page build label, not a stale hardcoded string',()=>{
    const html=source('index.html'),main=source('main.js');
    assert.match(html,/<span id="dev-version"><\/span>/);
    assert.match(html,/0\.0\.1k\.3z — Frame Anatomy Rewrite/);
    assert.doesNotMatch(html,/RIG DIAGNOSTICS <span>0\.0\.1k\.3u\.7/);
    assert.match(main,/devVersion\.textContent = document\.title\.split/);
    assert.match(html,/main\.js\?v=k3z/);
    assert.match(html,/garageMountUI\.js\?v=k3v6/);
    assert.match(source('garageMountUI.js'),/unifiedGarageUI\.js\?v=k3v6/);
});
