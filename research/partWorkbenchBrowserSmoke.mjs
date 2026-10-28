/** Real mobile browser smoke: archived calf recipe remains safe but no longer edits the JSON-mastered production rig. */
import {chromium} from 'playwright';
import {mkdirSync} from 'node:fs';
import assert from 'node:assert/strict';
mkdirSync('part-workbench-artifacts',{recursive:true});
const browser=await chromium.launch({headless:true,args:[
  '--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader',
]});
const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2,hasTouch:true,isMobile:true});
const errors=[];
page.on('pageerror',e=>errors.push(String(e.stack||e.message)));
page.on('requestfailed',r=>errors.push(r.url()+': '+r.failure()?.errorText));
try{
  await page.goto('http://127.0.0.1:8765/part-workbench.html',
    {waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>window.__m3ch4PartWorkbenchReady===false &&    document.querySelector('#feedback')?.textContent.includes('Legacy calf recipe'),
    undefined,{timeout:45000});
  await page.screenshot({path:'part-workbench-artifacts/start-portrait.png'});
  const before=await page.evaluate(()=>({
    overflow:document.documentElement.scrollWidth-window.innerWidth,
    status:document.querySelector('#feedback').textContent,
    draft:localStorage.getItem('m3ch4-part-workbench-calf-v1'),
    career:localStorage.getItem('m3ch4-save-v3'),
  }));
  assert.ok(before.overflow<=3,'phone interface has horizontal overflow');
  const handle=page.locator('#outline circle[data-index="2"][data-field="width"]').last();
  const box=await handle.boundingBox();
  assert.ok(box,'front width drag handle exists');
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);
  await page.mouse.down();
  await page.mouse.move(box.x+box.width/2+32,box.y+box.height/2,{steps:6});
  await page.mouse.up();
  await page.locator('#export').click();
  const exported=JSON.parse(await page.locator('#recipe-json').inputValue());
  assert.equal(exported.id,'legs-yard/calf-shell');
  assert.ok(Number.isFinite(exported.stations[2].width),'archived recipe remains valid JSON');
  await page.locator('#save').click();
  const saved=await page.evaluate(()=>localStorage.getItem('m3ch4-part-workbench-calf-v1'));
  assert.equal(JSON.parse(saved).stations[2].width,exported.stations[2].width);
  await page.locator('#side-mode').click();
  assert.ok(await page.locator('#outline circle[data-field="front"]').count()>0);
  await page.locator('#compare-toggle').click();
  assert.match(await page.locator('#view-label').textContent(),/ORIGINAL/);
  await page.locator('#compare-toggle').click();
  await page.locator('#rig-toggle').click();
  assert.match(await page.locator('#view-label').textContent(),/LEGS ONLY/);
  assert.equal(await page.evaluate(()=>window.__m3ch4PartWorkbenchReady),false,    'Archived V1 calf recipes must not report live geometry modification');
  await page.screenshot({path:'part-workbench-artifacts/edit-legs-portrait.png'});
  await page.locator('#import').click();
  await page.locator('#recipe-json').fill('{"version":99,"id":"legs-yard/calf-shell","stations":[]}');
  await page.locator('#json-apply').click();
  assert.match(await page.locator('#feedback').textContent(),/Import rejected/);
  if(await page.locator('#undo').isEnabled())await page.locator('#undo').click();
  if(await page.locator('#redo').isEnabled())await page.locator('#redo').click();
  const after=await page.evaluate(()=>({
    draft:localStorage.getItem('m3ch4-part-workbench-calf-v1'),
    career:localStorage.getItem('m3ch4-save-v3'),
  }));
  assert.equal(before.career,after.career,'career saves may not be edited');
  assert.ok(after.draft,'isolated browser draft should be saved');
  if(errors.length)throw Error('Browser errors: '+errors.join('\n'));
  console.log('PART WORKBENCH: PASS · archived calf profile stays editable without mutating JSON production rig');
}finally{await browser.close();}
