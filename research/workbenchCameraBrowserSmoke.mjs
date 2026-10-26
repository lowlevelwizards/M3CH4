/** Regression for the real live-game entry and actual canvas gestures on phone. */
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
mkdirSync('workbench-camera-artifacts',{recursive:true});
const browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});
const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true,deviceScaleFactor:2});
try{
 await page.goto('http://127.0.0.1:8765/index.html',{waitUntil:'domcontentloaded',timeout:60000});
 const link=page.locator('#live-workbench-open');
 assert.ok(await link.isVisible(),'Live game exposes an obvious Workbench link');
 await link.click();
 await page.waitForURL(/part-workbench-v2\.html\?from=game/,{timeout:20000});
 await page.waitForFunction(()=>window.__m3ch4WorkbenchV2Ready===true,undefined,{timeout:60000});
 assert.equal(await page.locator('#return-to-game').getAttribute('href'),'./index.html');
 await page.locator('#shape-type').selectOption('box');
 await page.locator('#add-shape').click();
 const canvas=page.locator('#stage-canvas');
 const bounds=await canvas.boundingBox();assert.ok(bounds);
 const x=bounds.x+bounds.width/2,y=bounds.y+bounds.height/2;
 // Tap actual model first. Then drag ON it, not in the empty background.
 await page.mouse.click(x,y);
 assert.notEqual(await page.locator('#selected-id').textContent(),'ROOT','Tap selects mesh');
 const initial=await page.locator('#camera-azimuth').textContent();
 await page.mouse.move(x,y);await page.mouse.down();
 await page.mouse.move(x+160,y+35,{steps:10});await page.mouse.up();
 const after=await page.locator('#camera-azimuth').textContent();
 assert.notEqual(after,initial,'One-finger drag over model genuinely changes camera');
 assert.equal(await page.locator('#camera-bearing').textContent(),'REAR  +Z','right drag turns past RIGHT toward rear');
 assert.ok(await page.locator('#object-tree .tree-item').count()===1,'Orbit does not corrupt edited shapes');
 await page.screenshot({path:'workbench-camera-artifacts/01-orbit-over-model.png'});
 for(const [view,facing] of [['front','FRONT  -Z'],['side','RIGHT  +X'],['rear','REAR  +Z'],['left','LEFT  -X'],['top','TOP  +Y']]){
  await page.locator('[data-view="'+view+'"]').click();
  assert.equal(await page.locator('#camera-bearing').textContent(),facing,'Ortho faces genuine game '+view);
 }
 await page.locator('#reset-camera').click();
 assert.equal(await page.locator('#camera-bearing').textContent(),'FRONT  -Z');
 await page.screenshot({path:'workbench-camera-artifacts/02-orthographic-axes.png'});
 await page.goto('http://127.0.0.1:8765/test-yard.html',{waitUntil:'domcontentloaded',timeout:60000});
 assert.ok(await page.locator('#live-workbench-open').isVisible(),'Real Test Yard also links directly to editor');
 await page.locator('#live-workbench-open').click();
 await page.waitForURL(/part-workbench-v2\.html\?from=yard/,{timeout:20000});
 await page.waitForFunction(()=>window.__m3ch4WorkbenchV2Ready===true,undefined,{timeout:60000});
 assert.equal(await page.locator('#return-to-game').getAttribute('href'),'./test-yard.html');
 console.log('CAMERA + LIVE GAME PASS: tap, orbit on mesh, 360 axes, orthos, direct game/yard entry');
}finally{await browser.close();}
