import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const source=name=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');

test('k4s.1 ships fresh stylesheet and script identities',()=>{
    const html=source('index.html'),adapter=source('garageMountUI.js');
    assert.match(html,/0\.0\.1k\.4s\.3 — Deploy and Layout/);
    assert.match(html,/k4sWorkshopShell\.css\?v=k4s1/);
    assert.match(html,/main\.js\?v=[\w.-]+/);
    assert.match(html,/garageMountUI\.js\?v=k4w5/);
    assert.match(adapter,/unifiedGarageUI\.js\?v=k4w5/);
    assert.ok(html.indexOf('k4sWorkshopShell.css')>html.indexOf('interfaceClarity.css'),
        'new shell styles must override older garage panel rules');
});
test('home garage is the 3D stage with only one hidden contextual toolbox',()=>{
    const js=source('unifiedGarageUI.js'),css=source('k4sWorkshopShell.css');
    assert.match(js,/class="workshop-rail"/);
    assert.match(js,/class="workshop-status"/);
    assert.match(js,/class="workshop-links"/);
    assert.match(js,/rail\.append\(moduleStation\(view\)\)/);
    assert.match(js,/if \(selectedSlot\) dock\.append\(moduleDetails/);
    assert.match(js,/if \(!identityExpanded\) return;/);
    assert.match(css,/#unified-garage\[data-workspace="garage"\] #unified-garage-dock\{\s*display:none/);
    assert.match(css,/\.tool-open #unified-garage-dock\{display:flex\}/);
    assert.match(css,/#unified-garage\[data-workspace="garage"\] \.unified-stations/);
});
test('workspace navigation is centralized and leaves gameplay commitments untouched',()=>{
    const js=source('unifiedGarageUI.js');
    assert.match(js,/function openWorkspace\(target\)/);
    assert.match(js,/function goBack\(\)/);
    assert.match(js,/\['paint','PAINT'\]/);
    assert.match(js,/\['vendor','VENDORS'\]/);
    assert.match(js,/workshop-deploy/);
    assert.match(js,/state==='garage' && paintExpanded\?'paint':state/);
    assert.match(js,/if \(actualMode\(loadSeries\(storage\)\) === 'pit'\) return;/);
    assert.match(js,/oldDeploy\.click\(\)/);
    assert.match(js,/m3ch4:bay-service/);
    assert.match(js,/m3ch4:bay-module/);
    assert.match(js,/bayPreviewAssembly/);
});
test('camera reserves area only for an actual visible editor/toolbox',()=>{
    const main=source('main.js'),css=source('k4sWorkshopShell.css');
    assert.match(main,/const reserve=inspecting && !!bayDock && workspace==='paint'/);
    assert.match(main,/m3ch4:workspace-layout/);
    assert.match(main,/Math\.max\(0,panelRight\)/);
    assert.match(css,/#unified-garage\[data-workspace="paint"\] #unified-garage-dock/);
    assert.match(css,/#unified-garage\[data-workspace="contracts"\] #unified-garage-dock/);
});
