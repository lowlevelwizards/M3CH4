import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('k4s.2 uses cache-fresh mobile modules and last-loaded flow stylesheet',()=>{
  const html=read('index.html'),mount=read('garageMountUI.js'),bridge=read('sceneAssembly.js');
  assert.match(html,/0\.0\.1k\.4(?:s\.3 — Deploy and Layout|z\.1 — Pit Survival & Impact Performance|z\.2 — AI Impact Crash Fix)/);
  assert.match(html,/k4s2GarageFlow\.css\?v=k4s2/);
  assert.ok(html.indexOf('k4s2GarageFlow.css')>html.indexOf('k4sWorkshopShell.css'));
    assert.match(html,/main\.js\?v=[\w.-]+/);
  assert.match(html,/garageMountUI\.js\?v=k4z1/);
  assert.match(mount,/unifiedGarageUI\.js\?v=k4z1/);
  // The cache token advances independently of the original garage-flow release.
  assert.match(bridge,/scene\.js\?source=[a-zA-Z0-9_.-]+/);
});
test('garage owns primary deploy CTA and header navigation',()=>{
  const ui=read('unifiedGarageUI.js'),style=read('k4s2GarageFlow.css');
  assert.match(ui,/function renderWorkshopChrome\(stable,view\)/);
  assert.match(ui,/\['paint','PAINT'\]/);
  assert.match(ui,/\['vendor','VENDORS'\]/);
  assert.match(ui,/\['inventory','INVENTORY'\]/);
  assert.match(ui,/workshop-rename/);
  assert.match(ui,/workshop-action-lane/);
  assert.match(ui,/job\?'DEPLOY':'SELECT JOB'/);
  assert.match(ui,/mode='garage';dock\.scrollTop=0;render\(\)/);
  assert.match(style,/\.workshop-top-links/);
  assert.match(style,/\.workshop-deploy/);
  assert.match(style,/\.unified-bay-navigation\{\s*left:44%/);
});
test('serialized inventory filters and sorts without reassigning hardware',()=>{
  const ui=read('unifiedGarageUI.js');
  assert.match(ui,/function renderInventory\(stable\)/);
  assert.match(ui,/inventoryFilter='all'/);
  assert.match(ui,/inventorySort='station'/);
  assert.match(ui,/stable\.inventory\.map\(part=>/);
  assert.match(ui,/Object\.values\(r\.installed\)\.includes\(part\.serial\)/);
  assert.match(ui,/inventoryFilter==='equipped'/);
  assert.match(ui,/inventorySort==='station'/);
  assert.match(ui,/inventory-view-bay/);
  assert.doesNotMatch(ui,/function renderInventory\(stable\)[\s\S]*?function renderCounter\(machine\)[\s\S]*?\bmigrat/i);
});
test('vendor exposes Three.js tabletop picks and a single simple Buy action',()=>{
  const ui=read('unifiedGarageUI.js'),scene=read('scene.js');
  assert.match(scene,/used-parts-counter-table/);
  assert.match(scene,/vendorPicks/);
  assert.match(scene,/pickVendorLot/);
  assert.match(ui,/vendor-placard/);
  assert.match(ui,/vendor-inspector/);
  assert.match(ui,/\n            'BUY',\(\)=>/);
  assert.doesNotMatch(ui,/BUY SERIAL/);
  assert.match(ui,/m3ch4:counter-buy/);
  assert.match(ui,/setVendorStock\(offers\)/);
});
test('part inspector restores rendered model, only one name and always-open details',()=>{
  const ui=read('unifiedGarageUI.js');
  assert.match(ui,/workshop-part-heading/);
  assert.match(ui,/workshop-part-serial/);
  assert.match(ui,/workshop-part-preview/);
  assert.match(ui,/partThumbnailDataUrl\?\.\(installed\.definitionId/);
  assert.match(ui,/garage-spec-line/);
  assert.match(ui,/garage-part-description/);
  assert.match(ui,/bayGeneratorMount\(stable, viewedId\)/);
  assert.match(ui,/bayModuleQuote\(stable, viewedId, slot\)/);
});
test('station shapes are distinct and camera never jumps on selection or deselection',()=>{
  const meters=read('uiMeters.js'),icons=read('moduleIcons.js'),scene=read('scene.js'),main=read('main.js');
  for(const slot of ['structure','mobility','power','command','combat'])
    assert.match(icons,new RegExp(slot+':'));
  assert.match(meters,/createModuleIcon\(slot/);
  assert.match(scene,/savedWorkshopOrbit/);
  assert.match(scene,/desiredTarget\.copy\(savedWorkshopOrbit\.target\)/);
  assert.match(scene,/function focusPart\(slot\) \{\s*\/\//);
  assert.match(main,/const reserve=inspecting && !!bayDock && workspace==='paint'/);
});
