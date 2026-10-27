/** Workbench 3: use real phone-sized Chromium and original editor, not mocks. */
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});
const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2,hasTouch:true,isMobile:true});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:8765/part-workbench-v2.html',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__m3ch4WorkbenchV2Ready===true,undefined,{timeout:45000});
 assert.ok(await page.locator('#zoom-in').isVisible());
 await page.locator('#zoom-in').click();await page.locator('#zoom-out').click();
 await page.locator('#show-shapes-panel').click();
 await page.locator('#shape-type').selectOption('plate');
 await page.locator('#add-shape').click();
 await page.locator('[data-tool="points"]').click();
 await page.locator('[data-view="front"]').click();
 assert.ok(await page.locator('#point-mode-toolbar').isVisible());
 await page.locator('#display-wire').click();
 assert.ok(await page.locator('#display-wire').evaluate(el=>el.classList.contains('active')));
 await page.locator('#display-xray').click();
 assert.ok(await page.locator('#display-xray').evaluate(el=>el.classList.contains('active')));
 await page.locator('#display-solid').click();
 await page.locator('#point-box').click();await page.locator('#depth-through').click();
 await page.locator('#edit-overlay .point-indicator').first().waitFor({state:'attached'});
 const positions=await page.locator('#edit-overlay .point-indicator').evaluateAll(els=>els.map(el=>({
  x:Number(el.getAttribute('cx')),y:Number(el.getAttribute('cy'))
 })));
 assert.ok(positions.length>=4,'Must render real profile control points');
 const stage=await page.locator('#stage').boundingBox();assert.ok(stage);
 const p0={x:Math.min(...positions.map(p=>p.x))-12,y:Math.min(...positions.map(p=>p.y))-12};
 const p1={x:Math.max(...positions.map(p=>p.x))+12,y:Math.max(...positions.map(p=>p.y))+12};
 await page.mouse.move(stage.x+p0.x,stage.y+p0.y);await page.mouse.down();
 await page.mouse.move(stage.x+p1.x,stage.y+p1.y,{steps:6});await page.mouse.up();
 const title=await page.locator('#context-title').textContent();
 assert.match(title,/4 POINTS SELECTED/,'Marquee must select all visible profile points');
 const axis=page.locator('#point-axis-controls input[type=range]').first();
 await axis.evaluate(el=>{
  el.value='0.05';el.dispatchEvent(new Event('input',{bubbles:true}));
  el.dispatchEvent(new Event('change',{bubbles:true}));
 });
 await page.locator('#clear-point-selection').click();
 assert.equal(await page.locator('#point-controls').isVisible(),false);
 // Import a genuinely valid v2 JSON asset, bypassing the whole-project importer.
 const raw=await page.evaluate(async()=>{
  const {createDocument,newShape,addNode,makeAsset}=await import('./workbench/blueprint.js');
  const n=newShape('plate',{name:'Chat hull'});const d=addNode(createDocument('Chat test'),n);
  return JSON.stringify(makeAsset(d,n.id,'part','Chat-authored shell'));
 });
 await page.locator('[data-tab="library"]').click();
 await page.locator('#part-json-file').setInputFiles({name:'chat-part.json',mimeType:'application/json',buffer:Buffer.from(raw)});
 await page.locator('#library-items .part-tile').filter({hasText:'Chat-authored shell'}).waitFor({timeout:15000});
 assert.equal(errors.length,0,errors.join('\n'));
}finally{await browser.close();}
