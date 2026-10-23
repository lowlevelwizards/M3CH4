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
 if(stats.mapVersion!==3||stats.coverCount!==34||stats.showcaseCount!==4||
   stats.total!==stats.options||
   stats.sceneryArchetypes<20||!stats.canvas||!stats.hasFreeCamera)
  throw Error('Incorrect gallery coverage '+JSON.stringify(stats));
 await page.screenshot({path:'gallery-smoke-artifacts/overview-first-prop.png'});
 const first=stats.current;
 await page.locator('#gallery-next').click();
 const next=await page.locator('#gallery-current').textContent();
 if(!next||first===next)throw Error('Next prop navigation not working');
 await page.locator('#gallery-overview').click();
 await page.screenshot({path:'gallery-smoke-artifacts/prop-grid-overview.png'});
 await page.locator('#gallery-select').selectOption(String(stats.coverCount+stats.showcaseCount));
 await page.screenshot({path:'gallery-smoke-artifacts/scenery-sample.png'});
 // Navigating back out of the DEV lab must always preserve the live app link.
 const back=await page.locator('#gallery-exit').getAttribute('href');
 if(!back?.includes('index.html'))throw Error('No return to game');
 if(errors.length)throw Error('Gallery browser errors '+JSON.stringify(errors));
 console.log('BACKLOT GALLERY PASS '+JSON.stringify({stats,selected:next,back}));
}finally{await browser.close();}
