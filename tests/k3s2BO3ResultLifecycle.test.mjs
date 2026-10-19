import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { decodeMachine, storeMachine, loadMachine } from '../persistence.js';
import { loadStable } from '../stable.js';
import { bayHealth, bayStatus } from '../garageBay.js';
import { startSeries, loadSeries } from '../series.js';
import { publishBoutResult, latestBoutResult, latestRoundResult, clearBoutResult } from '../boutSession.js';

class MemoryStorage {
    constructor() { this.map=new Map(); }
    getItem(key) { return this.map.has(key) ? this.map.get(key) : null; }
    setItem(key,val) { this.map.set(key,String(val)); }
    removeItem(key) { this.map.delete(key); }
}
function savedRig() {
    const storage=new MemoryStorage();
    const machine=decodeMachine(null);
    assert.equal(storeMachine(storage,machine),true);
    return storage;
}
function hurt(storage, slot, integrity, armor, wear) {
    const machine=loadMachine(storage);
    const state=machine.playerCondition.parts[slot];
    const serial=machine.assembly.installed[slot];
    const owned=machine.assembly.owned.find(p=>p.serial===serial);
    owned.condition=integrity;
    owned.wear=wear;
    state.integrity=state.maxIntegrity*integrity;
    state.armor=state.maxArmor*armor;
    assert.equal(storeMachine(storage,machine),true);
}
const source = path => fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('persisted post-round integrity, armor and lifetime wear remain separate at the pit',()=>{
    const storage=savedRig();
    hurt(storage,'command',.43,.61,.12);
    const stable=loadStable(storage).stable;
    const item=bayHealth(stable,stable.activeRigId).find(x=>x.slot==='command');
    assert.ok(Math.abs(item.condition-.43)<1e-8);
    assert.ok(Math.abs(item.armorRatio-.61)<1e-8);
    assert.ok(Math.abs(item.wear-.12)<1e-8);
    assert.equal(item.label,'DAMAGED');
    assert.equal(bayStatus(stable,stable.activeRigId).state,'DAMAGED · FIELDABLE');
});
test('100% internal condition never disguises stripped armor as a healthy green station',()=>{
    const storage=savedRig();
    hurt(storage,'structure',1,.25,.04);
    const stable=loadStable(storage).stable;
    const frame=bayHealth(stable,stable.activeRigId).find(x=>x.slot==='structure');
    assert.equal(frame.condition,1);
    assert.ok(Math.abs(frame.armorRatio-.25)<1e-8);
    assert.equal(frame.label,'CRITICAL');
    assert.equal(bayStatus(stable,stable.activeRigId).state,'DAMAGED · FIELDABLE');
});
test('round-state bridge sees the newly persisted hardware when deciding intermission',()=>{
    const storage=savedRig();
    const initial=loadStable(storage).stable;
    const original=globalThis.localStorage;
    try {
        globalThis.localStorage=storage;
        const started=startSeries(storage,'yard-dog',initial.activeRigId,'MABEL','assignment-1');
        assert.equal(started.ok,true);
        // Same order as main.finishSortie: live condition stored BEFORE publication.
        hurt(storage,'command',.43,.61,.12);
        const resolved=publishBoutResult({ victory:true,reason:'ROUND WON' });
        assert.equal(resolved.terminal,false);
        assert.equal(loadSeries(storage).phase,'intermission');
        assert.equal(latestBoutResult(),null);
        assert.equal(latestRoundResult().round.round,1);
        const returned=bayHealth(loadStable(storage).stable,initial.activeRigId).find(x=>x.slot==='command');
        assert.ok(Math.abs(returned.condition-.43)<1e-8);
    } finally {
        clearBoutResult();
        if (original===undefined) delete globalThis.localStorage;
        else globalThis.localStorage=original;
    }
});
test('combat commits live damage before any synchronous subscriber can score or read stable',()=>{
    const main=source('main.js');
    const finish=main.slice(main.indexOf('function finishSortie('),main.indexOf('function applyAiHitToPlayer('));
    assert.ok(finish.indexOf('persistMachine();')>=0);
    assert.ok(finish.indexOf('persistMachine();') < finish.indexOf('publishBoutResult('));
    assert.match(main,/m3ch4:debrief-opened/);
    assert.match(main,/BEST OF THREE · YOU/);
});
test('one explicit debrief-open event coordinates BO3 and salvage without a self-rendering observer loop',()=>{
    const series=source('seriesUI.js');
    const salvage=source('acquisitionUI.js');
    const assignment=source('sortieAssignmentUI.js');
    assert.match(series,/addEventListener\('m3ch4:debrief-opened'/);
    assert.match(salvage,/addEventListener\('m3ch4:debrief-opened'/);
    assert.doesNotMatch(series,/debriefObserver\.observe/);
    assert.doesNotMatch(salvage,/observer\.observe\(sheet/);
    assert.doesNotMatch(assignment,/debriefObserver\.observe/);
    assert.match(assignment,/addEventListener\('m3ch4:debrief-opened'/);
    assert.match(series,/CONTINUE TO INTERMISSION/);
    assert.match(series,/INTEGRITY|INT ' \+ percent\(part\.condition\)/);
    assert.match(series,/percent\(part\.armorRatio\)/);
    assert.match(series,/percent\(part\.wear\)/);
});
test('round score navigation works while salvage remains gated until contract completion',()=>{
    const score=source('acquisitionUI.js');
    const style=source('seriesStyles.css');
    assert.match(score,/latestBoutResult\(\) \?\? latestRoundResult\(\)/);
    assert.match(score,/subscribeRoundResult\(render\)/);
    assert.match(score,/result\.terminal !== false/);
    assert.match(score,/pagePrev\.addEventListener\('click'/);
    assert.match(score,/pageNext\.addEventListener\('click'/);
    assert.match(score,/onAction: \(\) => claimPlayerPart\(result, entry\)/);
    assert.match(style,/bo3-round-debrief \[data-debrief-page="2"\]/);
    assert.doesNotMatch(style,/bo3-round-debrief \[data-debrief-page="1"\]/);
    assert.doesNotMatch(style,/bo3-round-debrief \.debrief-edge,.bo3-round-debrief/);
});
test('claim confirmation is explicit and never immediately dismissed by an automatic timer',()=>{
    const score=source('acquisitionUI.js');
    assert.doesNotMatch(score,/scheduleGarageReturn|autoGarageTimer/);
    assert.doesNotMatch(score,/garage\.click\(\)/);
    assert.match(score,/CLAIM SECURED · RETURN TO GARAGE/);
});
test('BO3 is visible in combat and restored on an active-round reload',()=>{
    const series=source('seriesUI.js');
    const styles=source('seriesStyles.css');
    assert.match(series,/id = 'bo3-combat-hud'/);
    assert.match(series,/ROUND ' \+ match\.roundNumber \+ ' \/ 3/);
    assert.match(series,/phase === 'round_active'/);
    assert.match(series,/renderCombatSeries\(\);\s*scheduleActiveRoundResume\(binding\)/);
    assert.match(styles,/body\.inspecting #bo3-combat-hud/);
    assert.match(styles,/pointer-events:none/);
});
test('updated mobile URLs reference fresh result and machine-status resources',()=>{
    const html=source('index.html');
    const mount=source('garageMountUI.js');
    const series=source('seriesUI.js');
    assert.match(html,/main\.js\?v=k3u5/);
    assert.match(html,/garageMountUI\.js\?v=k3u3/);
    assert.match(html,/garageBay\.js\?v=k3s2/);
    assert.match(mount,/seriesUI\.js\?v=k3s2/);
    assert.match(mount,/acquisitionUI\.js\?v=k3s2/);
    assert.match(series,/seriesStyles\.css\?v=k3s2/);
});
