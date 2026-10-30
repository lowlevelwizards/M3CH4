/** Dev drawer acceptance: Kestrel must be reachable from the *actual game UI*.
 * Check portrait and landscape constraints, not merely HTML presence.
 */
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdirSync} from 'node:fs';

mkdirSync('kestrel-silhouette-artifacts',{recursive:true});
const browser=await chromium.launch({headless:true,
 args:['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});
const base='http://127.0.0.1:8765/';
const expected={
 'kestrel-silhouette-open':'kestrel-silhouette.html',
 'hauler-fantasy-open':'hauler-fantasy-lab.html',
 'yardwalker-silhouette-open':'yardwalker-silhouette.html',
 'dev-workbench-open':'part-workbench-v2.html',
 'armor-lab-open':'armor-lab.html',
 'backlot-prop-gallery-open':'backlot-prop-gallery.html'
};
try {
 for(const [name,viewport,mobile] of [
  ['portrait',{width:390,height:844},true],
  ['landscape',{width:844,height:390},true],
  ['desktop',{width:1280,height:800},false]
 ]){
  const page=await browser.newPage({viewport,isMobile:mobile,hasTouch:mobile,deviceScaleFactor:1});
  const pageErrors=[];
  page.on('pageerror',e=>pageErrors.push(e.message));
  await page.goto(base+'index.html',{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>document.getElementById('dev-toggle')?.getAttribute('aria-controls')==='dev-panel',
   null,{timeout:55000}).catch(e=>{throw Error(name+': game UI did not initialize: '+e.message+'\n'+pageErrors.join('\n'));});
  if (name === 'portrait') {
   assert.equal(await page.locator('#portrait-warning').isVisible(),true,
    'portrait mode should still warn about landscape-only combat');
   await page.locator('#portrait-dev-open').click();
  } else {
   await page.locator('#dev-toggle').click();
  }
  assert.equal(await page.locator('#dev-panel').isVisible(),true);
  if(name==='portrait')assert.equal(await page.locator('#portrait-warning').isVisible(),false);

  const details=await page.evaluate(ids=>{
   const panel=document.getElementById('dev-panel');
   const rect=panel.getBoundingClientRect();
   const links=ids.map(id=>{
    const link=document.getElementById(id),r=link.getBoundingClientRect();
    return {id,href:link.getAttribute('href'),width:r.width,height:r.height,
     left:r.left,right:r.right,top:r.top,bottom:r.bottom,wrap:getComputedStyle(link).whiteSpace};
   });
   return {expanded:document.getElementById('dev-toggle').getAttribute('aria-expanded'),
    panel:{left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom,
      width:rect.width,height:rect.height,scrollHeight:panel.scrollHeight,clientHeight:panel.clientHeight},
    links,viewport:{width:innerWidth,height:innerHeight},bodyScroll:document.documentElement.scrollWidth};
  },Object.keys(expected));
  assert.equal(details.expanded,'true');
  assert.ok(details.panel.left>=-1 && details.panel.right<=viewport.width+1,
   name+': Dev drawer should stay entirely within the screen');
  assert.ok(details.panel.bottom<=viewport.height+1,
   name+': Dev drawer should stay above bottom safe edge');
  assert.ok(details.bodyScroll<=viewport.width+1,
   name+': Dev drawer should not create horizontal overflow');
  for(const entry of details.links){
   assert.ok(entry.width>=90 && entry.height>=40,name+': '+entry.id+' must remain tappable');
   assert.ok(entry.left>=details.panel.left-1 &&
     entry.right<=details.panel.right+1,name+': '+entry.id+' must not overflow horizontally');
   assert.ok(entry.href.includes(expected[entry.id]),name+': '+entry.id+' wrong destination');
   const response=await page.request.get(base+entry.href);
   assert.equal(response.status(),200,name+': '+entry.id+' destination must exist');
  }
  // Users can scroll to every launcher, without bringing the game viewport
  // underneath into focus or accidentally triggering the canvas.
  await page.locator('#backlot-prop-gallery-open').scrollIntoViewIfNeeded();
  await assert.equal(await page.locator('#backlot-prop-gallery-open').isVisible(),true);
  await page.locator('#kestrel-silhouette-open').scrollIntoViewIfNeeded();
  await page.screenshot({path:'kestrel-silhouette-artifacts/dev-workspaces-'+name+'.png'});
  await page.locator('#dev-panel-close').click();
  assert.equal(await page.locator('#dev-panel').isVisible(),false,
   name+': drawer close button must work');
  assert.equal(await page.locator('#dev-toggle').getAttribute('aria-expanded'),'false');
  if(name==='portrait')assert.equal(await page.locator('#portrait-warning').isVisible(),true);

  await page.close();
 }
 console.log('DEV WORKSPACES NAVIGATION & MOBILE OVERFLOW PASS');
}finally{await browser.close();}
