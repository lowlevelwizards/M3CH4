/** Real Chromium screenshot of the exact shared Three.js weapon geometry. */
import {chromium} from 'playwright';
import {mkdirSync} from 'node:fs';
const output='browser-smoke-artifacts';mkdirSync(output,{recursive:true});
const browser=await chromium.launch({
 headless:true,args:['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader'],
});
const page=await browser.newPage({viewport:{width:1250,height:730},deviceScaleFactor:1});
const errors=[];
page.on('pageerror',e=>errors.push('pageerror '+e.message));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
 await page.goto('http://127.0.0.1:8765/weapon-anatomy.html',{waitUntil:'domcontentloaded',timeout:60000});
 await page.waitForFunction(()=>window.__m3ch4WeaponLabReady===true,undefined,{timeout:25000});
 await page.waitForTimeout(700);
 await page.locator('#stage').screenshot({path:output+'/k3x-weapons-hero.png'});
 for(const view of ['side','front','top']){
   await page.locator('[data-view="'+view+'"]').click();
   await page.waitForTimeout(200);
   await page.locator('#stage').screenshot({path:output+'/k3x-weapons-'+view+'.png'});
 }
 await page.locator('[data-view="side"]').click();
 await page.locator('#gray').check();
 await page.waitForTimeout(200);
 await page.locator('#stage').screenshot({path:output+'/k3x-weapons-gray-side.png'});
 if(errors.length)throw Error(errors.join('\n'));
 console.log('WEAPON LAB: PASS · four genuine shared model renders, side/front/top/gray screenshots');
}finally{await browser.close();}
