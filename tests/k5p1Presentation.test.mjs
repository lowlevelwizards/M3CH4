import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('post-match has a playable survivor breather before staging the winner parade',()=>{
    const main=source('main.js');
    assert.match(main,/SORTIE_BREATHER_SECONDS=3/);
    assert.match(main,/sortieOutroRemaining=SORTIE_BREATHER_SECONDS\+SORTIE_SHOWCASE_SECONDS/);
    assert.match(main,/controls\.setEnabled\(playerCombatActive\)/);
    assert.match(main,/pendingWinnerPresentation && sortieOutroRemaining<=SORTIE_SHOWCASE_SECONDS/);
    assert.match(main,/controls\.setEnabled\(false\)/);
    assert.match(main,/testEnded && sortiePhase === 'outro' && playerCombatActive/);
});
test('disabled winners never translate in the physical parade',()=>{
    const scene=source('scene.js');
    assert.match(scene,/const moving=entry\.operational&&t<1/);
    assert.match(scene,/const z=entry\.operational\?-3\.8\+eased\*3\.9:-3\.8/);
});
test('shop purchase cannot recreate the player preview over the sales counter',()=>{
    const scene=source('scene.js');
    assert.match(scene,/exterior\.root\.visible = inspecting && !vendorEnabled/);
    assert.match(scene,/SOLD OUT/);
    assert.match(scene,/definition\.slot==='combat'\?-radius\*2\.25/);
});
test('mobile entry uses separately versioned script and workshop dependencies',()=>{
    const html=source('index.html'), bridge=source('sceneAssembly.js'), mount=source('garageMountUI.js');
    assert.match(html,/MECH ARENA — 0\.0\.1k\.5[a-z]\.[0-9]+/);
    const script=html.match(/main\.js\?v=(k[0-9]+[a-z][0-9]+)/)?.[1];
    const workshop=html.match(/garageMountUI\.js\?v=(k[0-9]+[a-z][0-9]+)/)?.[1];
    const scene=html.match(/sceneAssembly\.js\?v=(k[0-9]+[a-z][0-9]+)/)?.[1];
    assert.ok(script && workshop && scene);
    assert.ok(html.includes('polishPass.css?v='+workshop));
    assert.ok(bridge.includes('scene.js?source='+scene));
    assert.ok(mount.includes('unifiedGarageUI.js?v='+workshop));
    assert.match(mount,/acquisitionUI\.js\?v=k5p1/);
});
test('garage selection and report statistics remain rooted in real serial and ledger state',()=>{
    const ui=source('unifiedGarageUI.js'), score=source('acquisitionUI.js');
    assert.match(ui,/markModuleInspected/);
    assert.match(ui,/workshop-repair-all/);
    assert.match(ui,/inventory-location-badge/);
    assert.match(ui,/sortie-pick-grid/);
    assert.match(ui,/window\.confirm\('DEPLOY DAMAGED RIG/);
    assert.match(score,/k5p-score-inspector/);
    assert.match(score,/picked\.armorPercent/);
    assert.match(score,/picked\.internalPercent/);
});

test('hostile IFF markers use physical cover raycasts, friendlies keep orientation cues',()=>{
    const scene=source('scene.js');
    assert.match(scene,/const friendly=team==='friendly'/);
    assert.match(scene,/const markerSightRay=new THREE\.Raycaster\(\)/);
    assert.match(scene,/markerSightRay\.intersectObjects\(worldSolids,false\)/);
    assert.match(scene,/record\.marker\.visible=friendly\|\|!!record\.iffVisible/);
});
