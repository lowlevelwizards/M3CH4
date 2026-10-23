import {chromium} from 'playwright';
import {mkdirSync} from 'node:fs';
mkdirSync('gallery-smoke-artifacts',{recursive:true});
const browser=await chromium.launch({
 headless:true,args:['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']
});
const page=await browser.newPage({viewport:{width:844,height:390},deviceScaleFactor:1.5,
 isMobile:true,hasTouch:true});
const errors=[];
page.on('pageerror',e=>errors.push(String(e.stack||e.message)));
page.on('requestfailed',r=>errors.push(r.url()+': '+r.failure()?.errorText));
try{
 await page.goto('http://127.0.0.1:8765/backlot-prop-gallery.html',
  {waitUntil:'domcontentloaded',timeout:60000});
 await page.waitForFunction(()=>window.__backlotGalleryReady?.total>30,
  undefined,{timeout:30000});
 const stats=await page.evaluate(()=>({
  ...window.__backlotGalleryReady,
  options:document.querySelectorAll('#gallery-select option').length,
  current:document.querySelector('#gallery-current')?.textContent,
  canvas:!!document.querySelector('#stage canvas'),
  errors:document.querySelector('#gallery-error')?.textContent,
 }));
 if(!Array.isArray(stats.assemblyAudits)||stats.assemblyAudits.length!==14)
  throw Error('Missing structural assembly audit '+JSON.stringify(stats.assemblyAudits));
 const failed=stats.assemblyAudits.filter(a=>!a.pass);
 if(failed.length)throw Error('Structural geometry disconnected: '+JSON.stringify(failed));
 const required=['tractor','loader','combine','pickup','tyres'];
 for(const family of required){
  const audit=stats.assemblyAudits.find(x=>x.id==='experiment-'+family+'-anatomy');
  if(!audit||audit.checked<3)throw Error('Missing anchored '+family+' audit');
 }
 if(stats.experimentalIds?.length!==14||
  !stats.experimentalIds.includes('experiment-loader-anatomy')||
  !stats.experimentalIds.includes('experiment-combine-anatomy')||
  !stats.experimentalIds.includes('experiment-container-anatomy'))
  throw Error('Anatomy exhibits incomplete '+JSON.stringify(stats.experimentalIds));
 if(stats.mapVersion!==3||stats.coverCount!==34||
   stats.showcaseCount!==4||stats.experimentCount!==14||
   stats.experimentId!=='experiment-tractor-anatomy'||
   stats.total!==stats.options||
   stats.sceneryArchetypes<20||!stats.canvas||!stats.hasFreeCamera)
  throw Error('Incorrect gallery coverage '+JSON.stringify(stats));
 await page.screenshot({path:'gallery-smoke-artifacts/overview-first-prop.png'});
 // This is a dedicated experimental assembly, NOT live-map geometry.
 await page.locator('#gallery-before-after').click();
 if(!(await page.locator('#gallery-before-after').textContent()).includes('SIDE BY SIDE'))
   throw Error('OLD/NEW tractor toggle did not switch');
 await page.screenshot({path:'gallery-smoke-artifacts/old-tractor-same-camera.png'});
 await page.locator('#gallery-before-after').click();
 await page.screenshot({path:'gallery-smoke-artifacts/side-by-side-tractor.png'});
 await page.locator('#gallery-silhouette').click();
 if(!(await page.locator('#gallery-silhouette').textContent()).includes('RESTORE'))
   throw Error('Silhouette toggle failed');
 await page.screenshot({path:'gallery-smoke-artifacts/grey-silhouette-comparison.png'});
 await page.locator('#gallery-colliders').click();
 if(!(await page.locator('#gallery-colliders').textContent()).includes('ON'))
   throw Error('Collider overlay toggle failed');
 await page.screenshot({path:'gallery-smoke-artifacts/current-aabb-overlay.png'});
 await page.locator('#gallery-silhouette').click();
 await page.locator('#gallery-colliders').click();
 await page.locator('#gallery-before-after').click();
 const first=stats.current;
 await page.locator('#gallery-next').click();
 const next=await page.locator('#gallery-current').textContent();
 if(!next||first===next)throw Error('Next prop navigation not working');
 await page.locator('#gallery-overview').click();
 await page.screenshot({path:'gallery-smoke-artifacts/prop-grid-overview.png'});
 // Inspect the NEXT full machinery family, including a new/old transition.
 await page.locator('#gallery-select').selectOption('1');
 if(!(await page.locator('#gallery-current').textContent()).includes('LOADER'))
  throw Error('Loader experiment absent at expected gallery index');
 await page.screenshot({path:'gallery-smoke-artifacts/loader-new.png'});
 await page.locator('#gallery-before-after').click();
 await page.screenshot({path:'gallery-smoke-artifacts/loader-old.png'});
 await page.locator('#gallery-before-after').click();
 await page.screenshot({path:'gallery-smoke-artifacts/loader-both.png'});
 await page.locator('#gallery-select').selectOption('2');
 await page.screenshot({path:'gallery-smoke-artifacts/combine-harvester-chunk-v4.png'});
 await page.locator('#gallery-select').selectOption('3');
 if(!(await page.locator('#gallery-experiment-title').textContent()).includes('PICKUP'))
  throw Error('Picker still displays tractor lab on pickup prototype');
 // Verify the front, flank, rear and overhead authored inspection presets.
 for(const angle of ['FRONT','SIDE','REAR','TOP']){
  await page.locator('#gallery-ui-toggle').click().catch(()=>{});
  await page.locator('#gallery-angle-cycle').click();
  if(!(await page.locator('#gallery-angle-cycle').textContent()).includes(angle))
   throw Error('Inspection preset failed: '+angle);
  await page.screenshot({path:'gallery-smoke-artifacts/pickup-'+angle.toLowerCase()+'-v5.png'});
  await page.locator('#gallery-ui-toggle').click().catch(()=>{});
 }
 await page.screenshot({path:'gallery-smoke-artifacts/pickup-chunk-v4.png'});
 for(const [idx,name] of [[8,'tyre-stack'],[10,'flatbed'],[12,'container']]){
  await page.locator('#gallery-select').selectOption(String(idx));
  await page.screenshot({path:'gallery-smoke-artifacts/'+name+'-chunk-v4.png'});
 }
 await page.locator('#gallery-select').selectOption(String(stats.coverCount+stats.showcaseCount+stats.experimentCount));
 await page.screenshot({path:'gallery-smoke-artifacts/scenery-sample.png'});
 // Navigating back out of the DEV lab must always preserve the live app link.
 const back=await page.locator('#gallery-exit').getAttribute('href');
 if(!back?.includes('index.html'))throw Error('No return to game');
 if(errors.length)throw Error('Gallery browser errors '+JSON.stringify(errors));
 console.log('BACKLOT GALLERY PASS '+JSON.stringify({stats,selected:next,back}));
}finally{await browser.close();}
