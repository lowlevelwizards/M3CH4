import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { decodeMachine, loadMachine, storeMachine } from '../persistence.js';
import { loadStable } from '../stable.js';
import { bayHealth, bayStatus } from '../garageBay.js';
import { startSeries, recordSeriesRound } from '../series.js';
import { applyEmergencyFieldPatch, currentIntermissionFieldAction, FIELD_PATCH_CONDITION } from '../fieldWork.js';
import { CAMPAIGN_NODES, availableCampaignNodes, createCampaignState } from '../campaign.js';

const code = name => fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');
class MemoryStorage {
    constructor(){this.map=new Map();}
    getItem(k){return this.map.has(k)?this.map.get(k):null;}
    setItem(k,v){this.map.set(k,String(v));}
    removeItem(k){this.map.delete(k);}
}
function patchedStorage(slot='command') {
    const storage=new MemoryStorage();
    const machine=decodeMachine(null);
    machine.assembly.name='MABEL';
    const serial=machine.assembly.installed[slot];
    const part=machine.assembly.owned.find(p=>p.serial===serial);
    part.condition=0;part.destroyed=false;
    const target=machine.playerCondition.parts[slot];
    target.integrity=0;target.armor=0;target.destroyed=false;
    assert.equal(storeMachine(storage,machine),true);
    loadStable(storage);
    assert.equal(startSeries(storage,'yard-dog','rig-01','MABEL','assign-1').ok,true);
    const completed=recordSeriesRound(storage,{victory:true,reason:'ROUND ONE'},{hasFieldableMachine:true});
    assert.equal(completed.ok,true);
    assert.equal(completed.series.phase,'intermission');
    const patch=applyEmergencyFieldPatch(storage,{seriesId:completed.series.id,rigId:'rig-01',slot});
    assert.equal(patch.ok,true,patch.reason);
    return {storage,serial,patch,slot,series:completed.series};
}
test('a 22% pit repair survives reload with 22% internal integrity and zero armor, independently',()=>{
    const {storage,slot,serial,patch,series}=patchedStorage();
    const persisted=loadMachine(storage);
    const snapshot=persisted.playerCondition.parts[slot];
    assert.equal(snapshot.serial,serial);
    assert.equal(snapshot.integrity/snapshot.maxIntegrity,FIELD_PATCH_CONDITION);
    assert.equal(snapshot.armor,0);
    assert.equal(persisted.assembly.owned.find(p=>p.serial===serial).condition,FIELD_PATCH_CONDITION);
    const stable=loadStable(storage).stable;
    const health=bayHealth(stable,'rig-01').find(p=>p.slot===slot);
    assert.equal(health.condition,FIELD_PATCH_CONDITION);
    assert.equal(health.armorRatio,0);
    assert.equal(health.serial,serial);
    assert.equal(bayStatus(stable,'rig-01').canDeploy,true);
    assert.equal(currentIntermissionFieldAction(storage,series).serial,serial);
    assert.equal(patch.action.restoredCondition,FIELD_PATCH_CONDITION);
});
test('combat status percentage represents integrity, not armored and unarmored combined HP',()=>{
    const main=code('main.js');
    const functionBody=main.slice(main.indexOf('function playerPartRemaining('),
        main.indexOf('function syncCockpitInstruments('));
    assert.match(functionBody,/part\.integrity \/ Math\.max\(1,\s*part\.maxIntegrity\)/);
    assert.doesNotMatch(functionBody,/part\.armor|part\.maxArmor/);
    assert.match(main,/const ratio = playerPartRemaining\(part\)/);
    assert.match(main,/systems\[slot\] = Math\.round\(ratio \* 100\)/);
});
test('the pit module tile shows internal integrity, while detail verifies the exact patched serial and armor',()=>{
    const ui=code('unifiedGarageUI.js');
    assert.match(ui,/createStationFace\(item\.slot,item\)/);
    assert.match(ui,/createConditionMeter\(conditionFromPart\(current\)/);
    assert.match(ui,/createConditionMeter\(conditionFromPart\(current\)/);
    assert.match(ui,/const repairs=action\.type==='triage'/);
    assert.match(ui,/triagePreview\(stable,viewedId/);
    assert.match(ui,/if\(patch\?\.rigId===viewedId && !selectedSlot\)selectedSlot=patch\.slot/);
});
test('the cockpit has exactly one Domination objective readout plus one BO3 header',()=>{
    const main=code('main.js'),css=code('styles.css'),series=code('seriesUI.js');
    assert.match(main,/document\.body\.classList\.toggle\('domination-active'/);
    assert.match(css,/body\.domination-active #objective-status\{display:none!important\}/);
    assert.match(css,/body:not\(\.inspecting\) #domination-hud/);
    assert.match(series,/hud\.id = 'bo3-combat-hud'/);
    assert.match(css,/body\.domination-active:not\(\.inspecting\) \.look-heading/);
});
test('a single latched mission-kill notification replaces lower priority permanent shot reports',()=>{
    const main=code('main.js');
    assert.match(main,/playerMissionKillReason\s*=\s*reason/);
    assert.match(main,/if\s*\(!playerCombatActive && playerMissionKillReason\)/);
    assert.match(main,/shotReport\.textContent = ''/);
    assert.match(main,/shotReport\.classList\.add\('faded'\)/);
    assert.doesNotMatch(main,/reportFade = 9999/);
});
test('player mission kill opens touch-switchable allied follow view, not a second combat controller',()=>{
    const main=code('main.js'),scene=code('scene.js'),css=code('styles.css');
    assert.match(main,/function enterAlliedObservation\(\)/);
    assert.match(main,/function leaveAlliedObservation\(\)/);
    assert.match(main,/observePrev\.addEventListener\('click'/);
    assert.match(main,/observeNext\.addEventListener\('click'/);
    assert.match(main,/if\s*\(!watched\?\.active\)\s*setObservedAlly\(1\)/);
    assert.match(scene,/function setSpectatorRig\(rig\s*=\s*null\)/);
    assert.match(scene,/camera\.lookAt\(spectatorLook\)/);
    assert.match(scene,/combinerHud\.visible = !enabled && !spectatorRig/);
    assert.match(css,/#allied-observation button/);
    assert.match(main,/function resetSquadBattle\(\) \{\s*playerMissionKillReason=null;\s*leaveAlliedObservation/);
});
test('branching contract map uses campaign prerequisites, optional nodes and readable statuses',()=>{
    const ui=code('unifiedGarageUI.js'),style=code('unifiedGarageStyles.css');
    assert.match(ui,/className|unified-campaign-map/);
    assert.match(ui,/for\(const node of CAMPAIGN_NODES\)/);
    assert.match(ui,/if\(!node\.prereq\)continue/);
    assert.match(ui,/campaign\.clearedNodes\.includes\(node\.prereq\)/);
    assert.match(ui,/choice\.dataset\.node=node\.id/);
    assert.match(ui,/if\(!node\.required\)choice\.append/);
    assert.match(style,/\.unified-campaign-map/);
    assert.match(style,/\.campaign-link\.unlocked/);
    assert.match(style,/campaign-node-tile\[data-node="domination"\]/);
    assert.equal(CAMPAIGN_NODES.length,6);
    assert.equal(availableCampaignNodes(createCampaignState()).includes('domination'),false);
});
test('new mobile assets load instead of cached pre-clarity cockpit and garage scripts',()=>{
    const html=code('index.html'),bridge=code('sceneAssembly.js'),mount=code('garageMountUI.js');
    assert.match(html,/main\.js\?v=k4s1/);
    assert.match(html,/sceneAssembly\.js\?v=k4s1/);
    assert.match(html,/styles\.css\?v=k4q/);
    assert.match(html,/uiRedesign\.css\?v=k4q/);
    assert.match(mount,/unifiedGarageUI\.js\?v=k4s1/);
    assert.match(bridge,/scene\.js\?source=k4s1/);
});

test('the observer persists a camera position across frames and exits on return to the garage',()=>{
    const scene=code('scene.js'),main=code('main.js');
    assert.match(scene,/const spectatorCameraPosition = new THREE\.Vector3\(\)/);
    assert.match(scene,/spectatorCameraPosition\.lerp\(spectatorDesired/);
    assert.match(scene,/spectatorCameraReady = false/);
    assert.match(scene,/camera\.position\.copy\(spectatorCameraPosition\)/);
    assert.match(main,/if \(inspecting\) \{\s*leaveAlliedObservation\(\)/);
});
