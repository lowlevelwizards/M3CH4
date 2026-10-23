import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('crew allocation starts unspent, and no queue may exceed four units',()=>{
    const ui=source('unifiedGarageUI.js');
    const plan=ui.slice(ui.indexOf('function ensurePitPlan('),ui.indexOf('function commitPitTriage('));
    assert.match(plan,/triageSelected\.clear\(\)/);
    assert.doesNotMatch(plan,/triageSelected\.add\(/);
    assert.match(ui,/const affordable=selected\|\|candidate\.cost<=available/);
    assert.match(ui,/TRIAGE_BUDGET-check\.cost/);
    assert.match(ui,/for\(let i=0;i<TRIAGE_BUDGET;i\+\+\)/);
    assert.match(ui,/ONE SERVICE OPERATION PER ROUND/);
});
test('crew rules and commitment remain authoritative and unchanged',()=>{
    const rules=source('fieldWork.js'),ui=source('unifiedGarageUI.js');
    assert.match(rules,/export const TRIAGE_BUDGET = 4/);
    assert.match(rules,/export function triagePreview\(/);
    assert.match(ui,/applyIntermissionTriage\(storage,/);
    assert.match(ui,/!plan\.valid\|\|!plan\.fieldable/);
});
test('pit does not borrow the garage room; vendor hides both workshop rooms',()=>{
    const scene=source('scene.js');
    assert.match(scene,/const pitRoot=buildPitLane\(\)/);
    assert.match(scene,/\(pitPresentation\?pitRoot:garageRoot\)\.add\(serviceDressing\)/);
    assert.match(scene,/garageRoot\.visible=inspecting&&!vendorEnabled&&!pitPresentation/);
    assert.match(scene,/pitRoot\.visible=inspecting&&!vendorEnabled&&pitPresentation/);
    assert.match(scene,/function buildPitLane\(\)/);
});
test('garage keeps persistent module damage and blue repair welding',()=>{
    const scene=source('scene.js'), ui=source('unifiedGarageUI.js');
    assert.match(scene,/function updateGarageFailureEffects\(dt\)/);
    assert.match(scene,/persistentFailureProfile\(slot,integrityRatio\(part\)\)/);
    assert.match(scene,/function playWorkshopAction\(slot='structure',kind='repair'\)/);
    assert.match(scene,/service\?\[0x77dfff,0xd9f9ff,0x559bff\]/);
    assert.match(scene,/playWorkshopAction,/);
    assert.match(ui,/arena\?\.playWorkshopAction\?\.\(slot,'repair'\)/);
});
test('developer tools are grouped without losing any wired controls',()=>{
    const html=source('index.html');
    assert.equal((html.match(/class="dev-group"/g)||[]).length,5);
    for(const id of ['dev-version','dev-readout','animation-preview-toggle','animation-preview-mode',
        'animation-preview-speed','audio-bench-open','pressure-forge-open','systems-sound-open','backlot-prop-gallery-open',
        'reset-rig','toggle-colliders','wipe-save']){
        assert.ok(html.includes('id="'+id+'"'),id+' must remain available');
    }
});
