/** Browser acceptance: same full M3CH4 rig in three leg configurations,
 * synchronized view, size controls, and portrait phone focus layout.
 */
import {chromium} from 'playwright';
import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const out='yardwalker-silhouette-artifacts';
mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});
const diagnostics=[];
let page;
async function open(viewport,mobile=false){
 page=await browser.newPage({viewport,deviceScaleFactor:1,isMobile:mobile,hasTouch:mobile});
 page.on('pageerror',e=>diagnostics.push('PAGE: '+e.message));
 page.on('console',m=>{if(m.type()==='error')diagnostics.push('CONSOLE: '+m.text());});
 page.on('requestfailed',r=>diagnostics.push('NETWORK: '+r.url()+' '+r.failure()?.errorText));
 await page.goto('http://127.0.0.1:8765/yardwalker-silhouette.html',
  {waitUntil:'domcontentloaded',timeout:60000});
 await page.waitForFunction(()=>window.__yardwalkerSilhouetteLab?.ready,null,
  {timeout:55000}).catch(e=>{throw Error(e.message+'\n'+diagnostics.join('\n'));});
}
async function snapshot(file){await page.waitForTimeout(150);await page.screenshot({path:out+'/'+file,fullPage:false});}
try{
 await open({width:1280,height:780});
 let before=await page.evaluate(()=>window.__yardwalkerSilhouetteLab.inspect());
 assert.equal(before.focus,false);
 assert.equal(before.fullRig,true);
 assert.equal(before.candidates.length,3);
 assert.equal(before.candidates[0].id,'strider');
 await snapshot('01-full-mech-compare-quarter.png');
 await page.locator('[data-view="front"]').click();await snapshot('02-full-mech-compare-front.png');
 await page.locator('[data-view="side"]').click();await snapshot('03-full-mech-compare-side.png');
 await page.locator('#arena').click();await snapshot('04-full-mech-arena-distance.png');
 await page.locator('#garage').click();
 await page.locator('#silhouette').click();await snapshot('05-black-silhouette.png');
 await page.locator('#silhouette').click();
 await page.locator('#choose-bruiser').click();
 const a=await page.evaluate(()=>window.__yardwalkerSilhouetteLab.inspect());
 await page.locator('#thighMass').evaluate(el=>{el.value='.59';el.dispatchEvent(new Event('input',{bubbles:true}));});
 const b=await page.evaluate(()=>window.__yardwalkerSilhouetteLab.inspect());
 assert.equal(b.selected,'bruiser');
 assert.equal(b.candidates[1].thighMass,.59);
 assert.equal(a.candidates[0].thighMass,b.candidates[0].thighMass);
 assert.equal(a.candidates[2].thighMass,b.candidates[2].thighMass);
 await snapshot('06-bruiser-edited-thigh-width.png');
 await page.locator('#reset-study').click();
 const reset=await page.evaluate(()=>window.__yardwalkerSilhouetteLab.inspect());
 assert.equal(reset.candidates[1].thighMass,a.candidates[1].thighMass);
 await page.locator('#legs-only').click();await snapshot('07-legs-only-three-candidates.png');
 await page.locator('#full-rig').click();
 await page.locator('#focus').click();
 assert.equal((await page.evaluate(()=>window.__yardwalkerSilhouetteLab.inspect())).focus,true);
 await snapshot('08-focus-bruiser.png');
 assert.equal(diagnostics.length,0,diagnostics.join('\n'));
 await page.close();
 await open({width:390,height:844},true);
 const p=await page.evaluate(()=>window.__yardwalkerSilhouetteLab.inspect());
 assert.equal(p.focus,true,'phone should focus one candidate by default');
 await snapshot('09-mobile-portrait-strider.png');
 await page.locator('#choose-hound').click();
 await page.locator('[data-view="side"]').click();
 await snapshot('10-mobile-portrait-hound-side.png');
 const mobile=await page.evaluate(()=>{
  const r=document.getElementById('stage').getBoundingClientRect();
  const s=document.getElementById('scene').getBoundingClientRect();
  return {stage:r.width,canvas:s.width,viewport:window.innerWidth,
   sliders:[...document.querySelectorAll('#sliders input')].every(e=>e.getBoundingClientRect().width>30)};
 });
 assert.equal(mobile.stage,mobile.canvas);
 assert.ok(mobile.stage<=mobile.viewport+1);
 assert.ok(mobile.sliders);
 await page.locator('#compare').click();
 await snapshot('11-mobile-compare-three.png');
 const q=await page.evaluate(()=>window.__yardwalkerSilhouetteLab.inspect());
 assert.equal(q.focus,false);
 assert.equal(diagnostics.length,0,diagnostics.join('\n'));
 writeFileSync(out+'/acceptance.json',JSON.stringify({desktop:before,edited:b,mobile:q,diagnostics},null,2));
 console.log('YARDWALKER SILHOUETTE LAB BROWSER PASS');
}finally{await browser.close();}
