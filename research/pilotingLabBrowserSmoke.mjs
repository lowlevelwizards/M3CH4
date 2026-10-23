/** Real Chromium integration for the no-save mobile piloting lab.
 * Does not rely on old version labels or mocked Three.js state.
 */
import {chromium} from 'playwright';
import {mkdirSync} from 'node:fs';
const output='browser-smoke-artifacts';
mkdirSync(output,{recursive:true});
const browser=await chromium.launch({headless:true,
 args:['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});
const page=await browser.newPage({viewport:{width:844,height:390},deviceScaleFactor:2});
const errors=[];
page.on('pageerror',e=>errors.push('SCRIPT '+String(e.stack||e.message)));
page.on('requestfailed',r=>errors.push('REQUEST '+r.url()+' '+r.failure()?.errorText));
try{
 await page.goto('http://127.0.0.1:8765/piloting-lab.html',{waitUntil:'domcontentloaded',timeout:60000});
 await page.waitForFunction(()=>window.__m3ch4PilotingLabReady===true,undefined,{timeout:28000});
 if(!(await page.locator('#stage canvas').count()))throw Error('Missing live WebGL scene');
 await page.waitForFunction(()=>document.querySelector('#telemetry')?.textContent.includes('YARDWALKER'),undefined,{timeout:12000});
 await page.screenshot({path:output+'/piloting-lab-yardwalker.png'});
 await page.locator('#family').selectOption('legs-compact');
 await page.waitForFunction(()=>document.querySelector('#telemetry')?.textContent.includes('KESTREL'),undefined,{timeout:12000});
 await page.locator('#handling').selectOption('legacy');
 await page.waitForFunction(()=>document.querySelector('#telemetry')?.textContent.includes('LEGACY'),undefined,{timeout:12000});
 await page.keyboard.down('w');
 await page.waitForTimeout(650);
 await page.keyboard.up('w');
 await page.locator('#handling').selectOption('assisted');
 await page.waitForFunction(()=>document.querySelector('#telemetry')?.textContent.includes('ASSISTED WALK'),undefined,{timeout:12000});
 await page.locator('#family').selectOption('legs-hauler');
 await page.waitForFunction(()=>document.querySelector('#telemetry')?.textContent.includes('HAULER H2'),undefined,{timeout:12000});
 await page.locator('#challenge').selectOption('climb');
 await page.waitForFunction(()=>document.querySelector('#telemetry')?.textContent.includes('LOADING DOCK'),undefined,{timeout:12000});
 await page.locator('#challenge').selectOption('precision');
 await page.waitForFunction(()=>document.querySelector('#telemetry')?.textContent.includes('PRECISION STOP'),undefined,{timeout:12000});
 await page.locator('#view').selectOption('cockpit');
 await page.waitForTimeout(280);
 await page.screenshot({path:output+'/piloting-lab-hauler-cockpit.png'});
 const issues=await page.locator('#lab-error').evaluate(e=>e.hidden?null:e.textContent);
 if(issues||errors.length)throw Error((issues||'')+' '+errors.join('\n'));
 console.log('PILOTING LAB: PASS · first frame, full mech, three families, both handling models, cockpit');
}finally{await browser.close();}
