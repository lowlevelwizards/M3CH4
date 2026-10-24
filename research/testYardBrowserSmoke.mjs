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
   selects:document.querySelectorAll('.yard-parts .yard-select').length,
   weapons:document.querySelector('.yard-select[aria-label="WEAPON"]')?.options.length,
   auxiliaryMounts:['UTILITY LEFT','UTILITY RIGHT','FRONT ARMOR','WEAPON CRADLE','SECONDARY GUN'].map(label=>
     !!document.querySelector('.yard-select[aria-label="'+label+'"]')),
   garage:document.querySelector('.yard-shell')?.classList.contains('garage'),
   map:document.querySelector('#dev-version')?.textContent,
 }));
 if(bench.selects!==10||bench.auxiliaryMounts.includes(false)||bench.weapons!==8||!bench.garage||
    !bench.map?.includes('TEST YARD'))throw Error('BENCH '+JSON.stringify(bench));
 await page.screenshot({path:'browser-smoke-artifacts/test-yard-bench.png'});
 // Auxiliary sockets are a genuine part of the same bench, with independent
 // gun state and no modification to the campaign's five-station save.
 await page.locator('.yard-select[aria-label="UTILITY LEFT"]').selectOption('cinder-smoke');
 await page.locator('.yard-select[aria-label="WEAPON CRADLE"]').selectOption('twin-spar');
 await page.locator('.yard-select[aria-label="SECONDARY GUN"]').selectOption('gun-light');
 const aux=await page.evaluate(()=>({
    smoke:JSON.parse(localStorage.getItem('m3ch4-test-yard-loadout-v1')||'{}').equipment?.utilityLeft,
    cradle:JSON.parse(localStorage.getItem('m3ch4-test-yard-loadout-v1')||'{}').equipment?.combatCradle,
    secondary:JSON.parse(localStorage.getItem('m3ch4-test-yard-loadout-v1')||'{}').equipment?.secondaryWeapon,
 }));
 if(aux.smoke!=='cinder-smoke'||aux.cradle!=='twin-spar'||aux.secondary!=='gun-light')
    throw Error('AUXILIARY FIT SAVE '+JSON.stringify(aux));

 await page.locator('.yard-select[aria-label="WEAPON"]').selectOption('gun-scatter');
 const stored=await page.evaluate(()=>({
   campaign:localStorage.getItem('mech-arena-machine-v8'),
   sandbox:localStorage.getItem('m3ch4-test-yard-loadout-v1')
 }));
 if(stored.campaign!=='UNTOUCHED-CAMPAIGN-SENTINEL' ||
    !stored.sandbox?.includes('gun-scatter')) throw Error('SANDBOX SAVE '+JSON.stringify(stored));
 await page.locator('.yard-toolbar button').filter({hasText:'DEPLOY'}).click();
 await page.waitForTimeout(600);
 const swap=page.locator('#weapon-toggle'),smoke=page.locator('#utility-smoke');
 if(!await swap.isVisible()||!await smoke.isVisible())throw Error('EQUIPMENT CONTROLS NOT VISIBLE');
 await swap.click();
 if(!/2 \/ 2/.test(await swap.textContent()))throw Error('SECONDARY WEAPON NOT SELECTED');
 await swap.click();
 if(!/1 \/ 2/.test(await swap.textContent()))throw Error('PRIMARY WEAPON NOT RESTORED');
 await smoke.click();
 if(!/×1/.test(await smoke.textContent()))throw Error('CINDER SMOKE DID NOT DISCHARGE');
 if(await page.locator('.yard-shell').evaluate(node=>node.classList.contains('garage')))
   throw Error('Deploy did not leave garage');
 await page.screenshot({path:'browser-smoke-artifacts/test-yard-range.png'});
 // Interactive injury laboratory must operate on the real paired drive and
 // enemy module, without ever touching persistent campaign save data.
 await page.locator('.yard-toolbar button').filter({hasText:'DAMAGE'}).click();
 const lab=page.locator('#yard-damage-lab');
 await lab.locator('select[aria-label="System to injure"]').selectOption('mobility');
 await lab.locator('select[aria-label="Mobility side"]').selectOption('left');
 await lab.getByRole('button',{name:'25%'}).click();
 const wounded=await lab.locator('.yard-injury-readout').textContent();
 if(!/L 25% \/ R 100%/.test(wounded))throw Error('LEFT DRIVE NOT INJURED '+wounded);
 await page.screenshot({path:'browser-smoke-artifacts/test-yard-damage-lab.png'});
 await lab.getByRole('button',{name:'RESTORE SELECTED MACHINE'}).click();
 const restored=await lab.locator('.yard-injury-readout').textContent();
 if(!/L 100% \/ R 100%/.test(restored))throw Error('DRIVE NOT RESTORED '+restored);
 await lab.locator('select[aria-label="Machine to injure"]').selectOption('enemy');
 await lab.locator('select[aria-label="System to injure"]').selectOption('power');
 await lab.getByRole('button',{name:'50%'}).click();
 const damagedEnemy=await lab.locator('.yard-injury-readout').textContent();
 if(!/ENEMY · POWER 50%/.test(damagedEnemy))throw Error('AI MODULE NOT INJURED '+damagedEnemy);
 await lab.getByRole('button',{name:'RESTORE SELECTED MACHINE'}).click();
 await page.locator('.yard-toolbar button').filter({hasText:'DAMAGE'}).click();
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
