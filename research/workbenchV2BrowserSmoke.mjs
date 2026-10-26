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
 await page.locator('#edit-overlay .point-handle').first().waitFor({state:'attached',timeout:8000}).catch(async()=>{
   throw Error('Profile handles missing: '+JSON.stringify(await page.evaluate(()=>({
    status:document.querySelector('#status')?.textContent,
    view:document.querySelector('#mode-status')?.textContent,
    selected:document.querySelector('#selected-id')?.textContent,
    svg:document.querySelector('#edit-overlay')?.innerHTML.slice(0,800)
   }))));
 });
 const handle=page.locator('#edit-overlay .point-handle').first();
 const box=await handle.boundingBox();assert.ok(box,'visible point handle');
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
 await page.mouse.move(box.x+box.width/2+16,box.y+box.height/2+6,{steps:4});await page.mouse.up();
 await page.screenshot({path:'part-workbench-v2-artifacts/02-ortho-edit.png'});
 page.once('dialog',dialog=>dialog.accept('Plate preset A'));
 await page.locator('#save-shape').click();
 await page.waitForTimeout(180);
 assert.ok(await page.locator('#library-items .asset-item').count()>=1,'Saved shape appears in library');
 await page.locator('#library-items .asset-item button').first().click();
 assert.equal(await page.locator('.tree-item').count(),4,'Reusable asset inserted into project');
 await page.locator('#group-objects').click();
 page.once('dialog',dialog=>dialog.accept('One-piece test assembly'));
 await page.locator('#save-assembly').click();
 await page.waitForFunction(()=>document.querySelectorAll('#library-items .asset-item').length>=2,undefined,{timeout:8000}).catch(async()=>{
   throw Error('Saved assembly missing: '+JSON.stringify(await page.evaluate(()=>({
    status:document.querySelector('#status')?.textContent,
    library:document.querySelector('#library-items')?.textContent?.slice(0,900),
    selected:document.querySelector('#selected-id')?.textContent
   }))));
 });
 await page.locator('[data-tab="reference"]').click();
 // Generate a real browser-encoded PNG. Some older tiny base64 fixtures
 // decode inconsistently in headless mobile Chromium.
 const tinyPng=Buffer.from((await page.evaluate(()=>{
  const canvas=document.createElement('canvas');canvas.width=40;canvas.height=40;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#c3aa67';ctx.fillRect(0,0,40,40);
  return canvas.toDataURL('image/png').split(',')[1];
 })),'base64');
 await page.locator('#reference-view').selectOption('front');
 await page.locator('#reference-file').setInputFiles({name:'front.png',mimeType:'image/png',buffer:tinyPng});
 await page.waitForFunction(
  ()=>document.querySelectorAll('#reference-items .tree-item').length===1,
  undefined,{timeout:10000}
 ).catch(async()=>{
  throw Error('Reference image was not imported: '+JSON.stringify(await page.evaluate(()=>({
   status:document.querySelector('#status')?.textContent,
   input:document.querySelector('#reference-file')?.value,
   references:document.querySelector('#reference-items')?.textContent
  }))));
 });
 await page.locator('#reference-width').fill('1.4');await page.locator('#reference-width').dispatchEvent('change');
 await page.locator('#module-manifest').fill('[{"name":"Knee hub","geometry":"cylinder"},{"name":"Shin casing","geometry":"loft"}]');
 await page.locator('#apply-manifest').click();
 await page.screenshot({path:'part-workbench-v2-artifacts/03-reference.png'});
 await page.locator('#save-project').click();
 await page.waitForFunction(()=>document.querySelector('#status')?.textContent?.includes('Project saved'),undefined,{timeout:10000});
 await page.reload({waitUntil:'domcontentloaded',timeout:60000});
 await page.waitForFunction(()=>window.__m3ch4WorkbenchV2Ready===true,undefined,{timeout:35000});
 assert.ok(await page.locator('.tree-item').count()>=4,'IndexedDB reloaded shape hierarchy');
 await page.locator('[data-tab="reference"]').click();
 assert.equal(await page.locator('#reference-items .tree-item').count(),1,'reference images persist');
 // The exact same editable document must survive the handoff to the REAL
 // Test Yard. Its sandbox meshes attach to the player knee, never enemy rigs.
 await page.setViewportSize({width:844,height:390});
 await page.locator('#test-in-yard').click();
 await page.waitForURL(/test-yard\.html\?wb-prototype=1/,{timeout:15000});
 await page.waitForFunction(()=>window.__m3ch4BootOK===true,undefined,{timeout:60000});
 const sandbox=await page.evaluate(async()=>{
  const {activePlayerArena}=await import('./scene.js');
  let count=0;let name=null;
  activePlayerArena()?.arena?.scene?.traverse(n=>{
   if(n.name==='WORKBENCH V2 / LEFT KNEE SANDBOX PROTOTYPE'){name=n.name;count=n.children.length;}
  });
  return {name,count};
 });
 assert.equal(sandbox.name,'WORKBENCH V2 / LEFT KNEE SANDBOX PROTOTYPE');
 assert.ok(sandbox.count>=1,'Actual player knee contains editable blueprint geometry');
 await page.screenshot({path:'part-workbench-v2-artifacts/04-real-test-yard-prototype.png'});
 if(errors.length)throw Error('Browser errors: '+errors.join('\\n'));
 console.log('WORKBENCH V2 PASS · real Three.js mobile, profile edit, mirror, library, IndexedDB and ortho references');
}finally{await browser.close();}
if(errors.length)throw Error(errors.join('\n'));
