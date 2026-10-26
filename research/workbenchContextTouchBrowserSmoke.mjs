import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
mkdirSync('workbench-context-artifacts',{recursive:true});
const browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});
const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true,deviceScaleFactor:2});
const errors=[];page.on('pageerror',e=>errors.push(e.stack));
try{
 await page.goto('http://127.0.0.1:8765/part-workbench-v2.html',{waitUntil:'domcontentloaded',timeout:60000});
 await page.waitForFunction(()=>window.__m3ch4WorkbenchV2Ready===true,undefined,{timeout:60000});
 await page.locator('#show-shapes-panel').click();
 await page.locator('#primitive-grid .part-tile').filter({hasText:'PLATE'}).click();
 assert.ok(await page.locator('#selection-actions').isVisible(),'Selected shape actions visible');
 for(const id of ['duplicate','mirror','hide-object','delete-object']){
  const b=page.locator('#'+id);
  assert.ok(await b.isVisible(),'Visible labeled action '+id);
  assert.ok((await b.locator('small').textContent()).trim().length>1,'Action has label');
 }
 const panel=page.locator('#context-edit');
 assert.ok(await panel.isVisible(),'Selected part has contextual editor controls');
 await page.locator('#visibility-ghost').click();
 assert.match(await page.locator('#visibility-ghost').getAttribute('class')||'',/active/);
 await page.locator('#visibility-isolate').click();
 assert.match(await page.locator('#visibility-isolate').getAttribute('class')||'',/active/);
 await page.locator('#visibility-normal').click();
 await page.locator('[data-tool="points"]').click();
 // Contextual sliders must work from the 3D editor, not just a flat numeric inspector.
 await page.locator('[data-view="quarter"]').click();
 const dot=page.locator('#edit-overlay .point-handle').first();
 await dot.waitFor({state:'visible',timeout:10000});
 await dot.click();
 await page.locator('#point-controls').waitFor({state:'visible',timeout:10000}).catch(async()=>{
  const detail=await page.evaluate(()=>({
   selection:document.querySelector('#selection-name')?.textContent,
   title:document.querySelector('#context-title')?.textContent,
   contextHidden:document.querySelector('#context-edit')?.hidden,
   pointHidden:document.querySelector('#point-controls')?.hidden,
   tool:document.querySelector('#mode-status')?.textContent,
   dots:document.querySelectorAll('#edit-overlay .point-handle').length,
   active:document.activeElement?.outerHTML.slice(0,200)
  }));
  throw Error('Tapped point without contextual controls: '+JSON.stringify(detail));
 });
 assert.equal(await page.locator('#point-axis-controls input[type="range"]').count(),2);
 const before=await page.locator('#geometry-fields input').evaluateAll(els=>els.map(e=>e.value));
 const slider=page.locator('#point-axis-controls input[data-axis="0"]');
 const start=Number(await slider.inputValue());
 await slider.evaluate((el,value)=>{
  el.value=String(value);el.dispatchEvent(new Event('input',{bubbles:true}));
  el.dispatchEvent(new Event('change',{bubbles:true}));
 },start+.15);
 const after=await page.locator('#geometry-fields input').evaluateAll(els=>els.map(e=>e.value));
 assert.notDeepEqual(after,before,'Contextual slider changed real polygon coordinates');
 await page.screenshot({path:'workbench-context-artifacts/01-point-slider-portrait.png'});
 // Unhideable parts must remain reachable after hide.
 await page.locator('#hide-object').click();
 assert.ok(await page.locator('#object-tree .tree-item.is-hidden').count()===1,'Hidden part stays in browser');
 await page.locator('#hide-object').click();
 const dims=await page.evaluate(()=>{
  const view=document.querySelector('.view-panel').getBoundingClientRect();
  const dock=document.querySelector('.edit-panel').getBoundingClientRect();
  const head=document.querySelector('header.workbench-head').getBoundingClientRect();
  return {width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,
   view:{top:view.top,bottom:view.bottom},dock:{top:dock.top,bottom:dock.bottom},headBottom:head.bottom};
 });
 assert.ok(dims.scrollWidth<=dims.width+3,'Portrait horizontal overflow '+JSON.stringify(dims));
 assert.ok(dims.view.bottom<=dims.height+2,'Portrait viewport in frame '+JSON.stringify(dims));
 assert.ok(dims.dock.top>=dims.view.bottom-2,'Separate drawer not overlaid '+JSON.stringify(dims));
 // Landscape on modern iPhone devices comes with a very short viewport.
 await page.setViewportSize({width:844,height:390});
 await page.locator('[data-view="side"]').click();
 const landscape=await page.evaluate(()=>{
  const view=document.querySelector('.view-panel').getBoundingClientRect();
  const dock=document.querySelector('.edit-panel').getBoundingClientRect();
  const head=document.querySelector('header.workbench-head').getBoundingClientRect();
  const tabs=document.querySelector('.tabs').getBoundingClientRect();
  return {width:innerWidth,height:innerHeight,scrollWidth:document.documentElement.scrollWidth,
   view:{top:view.top,bottom:view.bottom},dock:{top:dock.top,bottom:dock.bottom},headBottom:head.bottom,tabsTop:tabs.top};
 });
 assert.ok(landscape.scrollWidth<=landscape.width+3,'Landscape horizontal overflow '+JSON.stringify(landscape));
 assert.ok(landscape.view.bottom<=landscape.height+2,'Landscape view not clipped '+JSON.stringify(landscape));
 assert.ok(landscape.tabsTop>=landscape.view.bottom-2,'Landscape tabs do not overlap viewport '+JSON.stringify(landscape));
 await page.screenshot({path:'workbench-context-artifacts/02-landscape-with-context.png'});
 assert.equal(errors.length,0,'Browser exceptions: '+errors.join('\n'));
 console.log('CONTEXT EDIT PASS: labeled actions, slider edits, isolate+ghost, hidden node return, portrait+landscape');
}finally{await browser.close();}
