/** Headless iPhone-sized test-yard end-to-end smoke, no campaign session needed. */
import {chromium} from 'playwright';
import {mkdirSync} from 'node:fs';
mkdirSync('browser-smoke-artifacts',{recursive:true});
const browser=await chromium.launch({
 headless:true,args:['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader'],
});
const page=await browser.newPage({viewport:{width:844,height:390},deviceScaleFactor:2,isMobile:true,hasTouch:true});
const errors=[];
page.on('pageerror',error=>errors.push(String(error.stack||error.message)));
page.on('requestfailed',r=>errors.push(r.url()+': '+r.failure()?.errorText));
try {
 await page.addInitScript(()=>{
   localStorage.setItem('mech-arena-machine-v8','UNTOUCHED-CAMPAIGN-SENTINEL');
 });
 await page.goto('http://127.0.0.1:8765/test-yard.html',{waitUntil:'domcontentloaded',timeout:60000});
 try{await page.waitForFunction(()=>window.__m3ch4BootOK===true,undefined,{timeout:30000});}
 catch(err){
   throw Error('YARD BOOT '+JSON.stringify(await page.evaluate(()=>({
      detail:document.querySelector('#startup-diagnostic-detail')?.textContent,
      title:document.title
   })))+' '+errors.join('\n')+' '+String(err));
 }
 const bench=await page.evaluate(()=>({
   selects:document.querySelectorAll('.yard-select').length,
   weapons:document.querySelector('.yard-select[aria-label="WEAPON"]')?.options.length,
   garage:document.querySelector('.yard-shell')?.classList.contains('garage'),
   map:document.querySelector('#dev-version')?.textContent,
 }));
 if(bench.selects!==5||bench.weapons!==8||!bench.garage||
    !bench.map?.includes('TEST YARD'))throw Error('BENCH '+JSON.stringify(bench));
 await page.screenshot({path:'browser-smoke-artifacts/test-yard-bench.png'});
 await page.locator('.yard-select[aria-label="WEAPON"]').selectOption('gun-scatter');
 const stored=await page.evaluate(()=>({
   campaign:localStorage.getItem('mech-arena-machine-v8'),
   sandbox:localStorage.getItem('m3ch4-test-yard-loadout-v1')
 }));
 if(stored.campaign!=='UNTOUCHED-CAMPAIGN-SENTINEL' ||
    !stored.sandbox?.includes('gun-scatter')) throw Error('SANDBOX SAVE '+JSON.stringify(stored));
 await page.locator('.yard-toolbar button').filter({hasText:'DEPLOY'}).click();
 await page.waitForTimeout(600);
 if(await page.locator('.yard-shell').evaluate(node=>node.classList.contains('garage')))
   throw Error('Deploy did not leave garage');
 await page.screenshot({path:'browser-smoke-artifacts/test-yard-range.png'});
 const before=await page.locator('#ammo-count').textContent();
 await page.locator('#fire').click({timeout:10000});
 await page.waitForTimeout(100);
 const after=await page.locator('#ammo-count').textContent();
 if(before===after)throw Error('FIRE did not consume a round: '+before);
 await page.locator('.yard-toolbar button').filter({hasText:'REBUILD TARGETS'}).click();
 await page.locator('.yard-toolbar button').filter({hasText:'DUMMIES'}).click();
 if(!await page.locator('.yard-toolbar button').filter({hasText:'LIVE AI'}).count())
   throw Error('AI training switch failed');
 await page.locator('.yard-toolbar button').filter({hasText:'RESET RIG'}).click();
 await page.locator('.yard-toolbar button').filter({hasText:'GARAGE'}).click();
 if(!await page.locator('.yard-select[aria-label="WEAPON"]').count())
   throw Error('No builder after returning to bench');
 const final=await page.evaluate(()=>localStorage.getItem('mech-arena-machine-v8'));
 if(final!=='UNTOUCHED-CAMPAIGN-SENTINEL')throw Error('CAREER DATA MODIFIED');
 if(errors.length)throw Error('BROWSER ERRORS '+errors.join('\n'));
 console.log('TEST YARD: PASS · full catalogue, live range, dummy/AI, reset and no campaign save writes');
} finally {await browser.close();}
