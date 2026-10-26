/** Phone browser smoke for the actual V2 Workbench, not a mock UI. */
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
mkdirSync('part-workbench-v2-artifacts',{recursive:true});
const browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});
const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2,hasTouch:true,isMobile:true,acceptDownloads:true});
const errors=[];
page.on('pageerror',e=>errors.push('PAGE: '+e.stack));
page.on('requestfailed',r=>errors.push('NETWORK: '+r.url()+' '+r.failure()?.errorText));
try{
 await page.goto('http://127.0.0.1:8765/part-workbench-v2.html',{waitUntil:'domcontentloaded',timeout:60000});
 await page.waitForFunction(()=>window.__m3ch4WorkbenchV2Ready===true,{timeout:35000});
 assert.ok(await page.locator('#stage-canvas').isVisible(),'Three.js stage visible');
 assert.ok((await page.locator('#status').textContent()).includes('Ready'),'initialized');
 const w=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
 assert.ok(w<=3,'Portrait should not overflow: '+w);
 await page.screenshot({path:'part-workbench-v2-artifacts/01-mobile-start.png'});
 await page.locator('#shape-type').selectOption('plate');await page.locator('#add-shape').click();
 assert.equal(await page.locator('.tree-item').count(),1,'First primitive is in hierarchy');
 await page.locator('#object-name').fill('Custom armor');await page.locator('#object-name').dispatchEvent('change');
 await page.locator('#position-fields input').first().fill('0.32');
 await page.locator('#position-fields input').first().dispatchEvent('change');
 await page.locator('#duplicate').click();
 assert.equal(await page.locator('.tree-item').count(),2);
 await page.locator('.tree-item').first().click();
 await page.locator('#mirror').click();
 assert.equal(await page.locator('.tree-item').count(),3);
 await page.locator('#unlink').click();
 await page.locator('[data-view="front"]').click();await page.locator('[data-tool="points"]').click();
 assert.ok(await page.locator('#edit-overlay .point-handle').count()>0,'Profile handles in true orthographic projection');
 const handle=page.locator('#edit-overlay .point-handle').first();
 const box=await handle.boundingBox();assert.ok(box,'visible point handle');
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
 await page.mouse.move(box.x+box.width/2+16,box.y+box.height/2+6,{steps:4});await page.mouse.up();
 await page.screenshot({path:'part-workbench-v2-artifacts/02-ortho-edit.png'});
 await page.locator('#save-shape').click();
 // Save prompt with source name.
 page.once('dialog',dialog=>dialog.accept('Plate preset A'));
 // Listener needs to exist before click; previous click opens prompt. Kept separate below.
}finally{await browser.close();}
if(errors.length)throw Error(errors.join('\n'));
