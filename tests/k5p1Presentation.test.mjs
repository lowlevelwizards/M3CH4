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
test('mobile entry references cache-fresh changed modules and last-pass polish CSS',()=>{
    const html=source('index.html'), bridge=source('sceneAssembly.js'), mount=source('garageMountUI.js');
    const stage=html.includes('k.5p.2')?'k5p2':'k5p1';
    assert.match(html,/MECH ARENA — 0\.0\.1k\.5p\.[12]/);
    assert.match(html,/main\.js\?v=k5p1/);
    assert.ok(html.includes('garageMountUI.js?v='+stage));
    assert.ok(html.includes('polishPass.css?v='+stage));
    assert.ok(bridge.includes('scene.js?source='+stage));
    assert.ok(mount.includes('unifiedGarageUI.js?v='+stage));
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
