import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('garage readout has separate labeled weight and electrical rows',()=>{
 const ui=source('unifiedGarageUI.js'),css=source('polishPass.css');
 assert.match(ui,/workshop-limit-row/);
 assert.match(ui,/▰ WEIGHT/);
 assert.match(ui,/ϟ POWER/);
 assert.match(css,/workshop-limit-row\+\.workshop-limit-row/);
});
test('sortie uses live physical rig selection instead of overlapping bay carousel',()=>{
 const ui=source('unifiedGarageUI.js'),css=source('polishPass.css'),main=source('main.js');
 assert.match(ui,/\['garage','pit'\]\.includes\(currentMode\)/);
 assert.match(ui,/3D RIG PREVIEW/);
 assert.match(css,/data-workspace="setup"\] \.unified-bay-navigation\{display:none!important\}/);
 assert.match(main,/workspace==='setup'/);
 assert.match(main,/reserved=-\(rect\.right-bayDock/);
});
test('pit has independent lighting when arena key is hidden during inspection',()=>{
 const scene=source('scene.js');
 const pit=scene.slice(scene.indexOf('function buildPitLane()'),scene.indexOf('function buildGarageBay()'));
 assert.match(scene,/arenaHemisphere\.visible = !enabled/);
 assert.match(pit,/new THREE\.HemisphereLight/);
 assert.match(pit,/new THREE\.DirectionalLight/);
 assert.match(pit,/new THREE\.SpotLight/);
});
test('square IFF is overhead and hostile detection still respects cover',()=>{
 const scene=source('scene.js');
 assert.match(scene,/const marker = new THREE\.LineLoop\(geometry,material\)/);
 assert.match(scene,/position\.y\+=friendly\?3\.05:2\.92/);
 assert.match(scene,/markerSightRay\.intersectObjects\(worldSolids,false\)/);
});
test('barrel obstruction warning queries real fire ray, without shooting',()=>{
 const scene=source('scene.js'),main=source('main.js'),css=source('polishPass.css');
 const safety=scene.slice(scene.indexOf('function predictShotObstruction('),scene.indexOf('function traceCombatantShot('));
 assert.match(safety,/traceShot\(0,0,muzzleZ\)/);
 assert.match(safety,/if\(!locallyBlockedMuzzle\(contact\)\)return null/);
 assert.match(scene,/muzzleRayFallsShort\(/);
 assert.match(safety,/hitSquad\?\.team==='friendly'/);
 assert.match(safety,/return 'cover'/);
 assert.doesNotMatch(safety,/fireWeapon|applyTargetHit|updateTargetDamage/);
 assert.match(main,/shotSafetyTimer=\.12/);
 assert.match(main,/arena\.predictShotObstruction\(weaponSpec\.muzzleZ\)/);
 assert.match(css,/center-crosshair\.center-crosshair\.unsafe-shot/);
});
test('entry cache keys cover scene, workshop and CSS changes',()=>{
 const html=source('index.html'),bridge=source('sceneAssembly.js'),mount=source('garageMountUI.js');
 for(const suffix of ['garageMountUI.js']) assert.ok(html.includes(suffix+'?v=k5p8'));
 assert.match(html,/polishPass\.css\?v=k5a4/);
 assert.match(html,/main\.js\?v=k5e1/);
 assert.match(html,/sceneAssembly\.js\?v=k5e1/);
 assert.match(bridge,/scene\.js\?source=k5e1/);
 assert.match(mount,/unifiedGarageUI\.js\?v=k5p4/);
});
