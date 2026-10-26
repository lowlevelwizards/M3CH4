/** Visual-first UX gate: test real Three.js mesh input on an iPhone-sized viewport. */
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
mkdirSync('workbench-visual-artifacts',{recursive:true});
const browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});
const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2,hasTouch:true,isMobile:true});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:8765/part-workbench-v2.html',{waitUntil:'domcontentloaded',timeout:60000});
 await page.waitForFunction(()=>window.__m3ch4WorkbenchV2Ready===true,undefined,{timeout:45000});
 const stage=page.locator('#stage'),view=await stage.boundingBox();
 assert.ok(view.height>240,'The 3D viewport must remain usable while leaving a contextual parts drawer visible');
 assert.ok(await page.locator('#inspector-details').evaluate(x=>!x.open),'Numeric inspector starts collapsed');
 assert.ok(await page.locator('#stage-canvas').isVisible(),'Actual Three.js viewport renders');
 assert.ok(await page.locator('#primitive-grid .part-tile').count()>=8,'Eight shape types have visual tiles');
 await page.locator('#show-shapes-panel').click();
 const thumbs=await page.evaluate(async()=>{
  try{
   const {newShape}=await import('./workbench/blueprint.js');
   const {thumbnailForPrimitive}=await import('./workbench/thumbnail.js');
   const picture=thumbnailForPrimitive(newShape('box').geometry);
   return {prefix:picture.slice(0,48),count:document.querySelectorAll('#primitive-grid img[src]').length};
  }catch(e){return {error:e.stack||String(e),tiles:[...document.querySelectorAll('#primitive-grid .part-tile')].map(el=>el.outerHTML.slice(0,240))};}
 });
 assert.ok(thumbs.prefix?.startsWith('data:image/png'),'Primitive thumbnail renderer: '+JSON.stringify(thumbs));
 await page.locator('#primitive-grid img').first().scrollIntoViewIfNeeded();
 await page.locator('#primitive-grid img[src^="data:image/png"]').first().waitFor({state:'attached',timeout:12000});
 await page.screenshot({path:'workbench-visual-artifacts/01-visual-workspace.png'});
 await page.locator('#shape-type').selectOption('plate');
 await page.locator('#add-shape').click();
 assert.equal(await page.locator('#object-tree .tree-item').count(),1);
 await page.locator('#object-tree .tree-item img').first().scrollIntoViewIfNeeded();
 await page.locator('#object-tree .tree-item img[src^="data:image/png"]').first().waitFor({state:'attached',timeout:10000});
 await page.locator('[data-tool="move"]').click();
 await page.locator('#edit-overlay .gizmo-hit').first().waitFor({state:'attached',timeout:10000});
 const drag=page.locator('#edit-overlay .gizmo-hit').first(),pos=await drag.boundingBox();assert.ok(pos);
 const before=Number(await page.locator('#position-fields input').first().inputValue());
 await page.mouse.move(pos.x+pos.width/2,pos.y+pos.height/2);await page.mouse.down();
 await page.mouse.move(pos.x+pos.width/2+32,pos.y+pos.height/2+9,{steps:6});await page.mouse.up();
 const after=Number(await page.locator('#position-fields input').first().inputValue());
 assert.ok(Math.abs(after-before)>.001,'Dragging a gizmo changes actual model transform');
 await page.screenshot({path:'workbench-visual-artifacts/02-direct-move-gizmo.png'});
 await page.locator('[data-tool="points"]').click();
 await page.locator('[data-view="quarter"]').click();
 const point=page.locator('#edit-overlay .point-handle').first();
 await point.waitFor({state:'attached',timeout:10000});
 const loc=await point.boundingBox();assert.ok(loc);
 const pointBefore=await page.locator('#geometry-fields input').evaluateAll(inputs=>inputs.map(x=>x.value));
 await page.mouse.move(loc.x+loc.width/2,loc.y+loc.height/2);await page.mouse.down();
 await page.mouse.move(loc.x+loc.width/2+25,loc.y+loc.height/2+4,{steps:5});await page.mouse.up();
 const pointAfter=await page.locator('#geometry-fields input').evaluateAll(inputs=>inputs.map(x=>x.value));
 assert.notDeepEqual(pointAfter.slice(1),pointBefore.slice(1),
  'Dragging a 3D plate point must change its profile XY coordinates, not its depth');
 await page.screenshot({path:'workbench-visual-artifacts/03-direct-3d-points.png'});
 page.once('dialog',d=>d.accept('Visual test plate'));
 await page.locator('#save-part').click();
 await page.locator('#library-items .asset-item img').first().scrollIntoViewIfNeeded();
 await page.locator('#library-items .asset-item img[src^="data:image/png"]').first().waitFor({state:'attached',timeout:10000});
 await page.screenshot({path:'workbench-visual-artifacts/04-saved-part-grid.png'});
 await page.locator('[data-tab="objects"]').click();
 await page.locator('#show-factory-panel').click();
 await page.waitForFunction(()=>document.querySelectorAll('#factory-grid .part-tile').length>=15,
  undefined,{timeout:9000});
 await page.locator('#factory-grid img').first().scrollIntoViewIfNeeded();
 await page.locator('#factory-grid img[src^="data:image/png"]').first().waitFor({state:'attached',timeout:20000});
 assert.equal(errors.length,0,'No browser runtime errors: '+errors.join(' | '));
 console.log('VISUAL-FIRST WORKBENCH PASS: full-viewport editor, real thumbnails, direct 3D gizmo/point edits, parts library');
}finally{await browser.close();}
