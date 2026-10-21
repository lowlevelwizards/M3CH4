import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('k4s.1 garage starts as a 3D workshop with no permanent manager dock',()=>{
    const ui=source('unifiedGarageUI.js'),css=source('k4sWorkshopShell.css');
    assert.match(ui,/class="workshop-rail"/);
    assert.match(ui,/class="workshop-status"/);
    assert.match(ui,/class="workshop-links"/);
    assert.match(ui,/rail\.append\(moduleStation\(view\)\)/);
    assert.match(ui,/shell\.classList\.toggle\('tool-open',state==='garage'/);
    assert.match(css,/#unified-garage\[data-workspace="garage"\] #unified-garage-dock\{\s*display:none/);
    assert.match(css,/#unified-garage\[data-workspace="garage"\]\.tool-open #unified-garage-dock\{display:flex\}/);
    assert.match(css,/#unified-garage\[data-workspace="garage"\] \.unified-stations\{\s*display:flex;flex-direction:column/);
});

test('workspace navigation has dedicated paint, counter, contract, setup and pit surfaces',()=>{
    const ui=source('unifiedGarageUI.js'),css=source('k4sWorkshopShell.css');
    assert.match(ui,/function openWorkspace\(target\)/);
    assert.match(ui,/function goBack\(\)/);
    assert.match(ui,/const links=\[\['paint','PAINT'\],\['vendor','PARTS'\]/);
    assert.match(ui,/shell\.dataset\.workspace=state==='garage' && paintExpanded\?'paint':state/);
    for(const state of ['paint','vendor','contracts','setup','pit'])
        assert.ok(css.includes('[data-workspace="'+state+'"] #unified-garage-dock'),state);
    assert.doesNotMatch(ui.slice(ui.indexOf('function goBack()'),ui.indexOf('function assignment(')),
        /clearSortieAssignment/);
});

test('selected machine parts and inventory shelf only appear when explicitly opened',()=>{
    const ui=source('unifiedGarageUI.js'),css=source('k4sWorkshopShell.css');
    assert.match(ui,/if \(selectedSlot\) dock\.append\(moduleDetails\(stable,view,machine\)\)/);
    assert.match(ui,/if \(!identityExpanded\) return/);
    assert.match(ui,/identityExpanded=false; \/\/ Inspect and machine history never stack/);
    assert.match(ui,/shelf\.classList\.toggle\('shown',state==='garage'/);
    assert.match(ui,/bayPreviewAssembly\(stable,viewedId,selectedSlot,fitSerial\)/);
    assert.match(ui,/onAction: \(\) => editModule\(slot, focused\.serial\)/);
    assert.match(css,/#unified-garage\[data-workspace="garage"\]\.replacing #unified-garage-dock/);
});

test('camera reserves space for visible tools and otherwise centers the rig',()=>{
    const main=source('main.js');
    assert.match(main,/workspace==='paint' \|\| \(workspace==='garage' && shell\.classList\.contains\('tool-open'\)\)/);
    assert.match(main,/const panelRight=reserve \? bayDock\.getBoundingClientRect\(\)\.right-rect\.left\+8 : 0/);
    assert.match(main,/m3ch4:workspace-layout/);
});

test('browser entry uses new workspace stylesheet and fresh module identity',()=>{
    const html=source('index.html'),mount=source('garageMountUI.js');
    assert.match(html,/k4sWorkshopShell\.css\?v=k4s1/);
    assert.match(html,/main\.js\?v=k4s1/);
    assert.match(html,/garageMountUI\.js\?v=k4s1/);
    assert.match(html,/unifiedGarageUI\.js\?v=k4s1/);
    assert.match(mount,/unifiedGarageUI\.js\?v=k4s1/);
});
