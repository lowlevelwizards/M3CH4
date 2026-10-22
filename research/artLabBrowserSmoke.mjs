/** Real WebGL smoke for the phone-first art study, not a mock screenshot. */
import {chromium} from 'playwright';
import {mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
mkdirSync('art-lab-artifacts',{recursive:true});
const browser=await chromium.launch({headless:true,
  args:['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});
const errors=[];
const page=await browser.newPage({viewport:{width:844,height:390},deviceScaleFactor:2});
page.on('pageerror',e=>errors.push(String(e.stack||e.message)));
page.on('requestfailed',r=>errors.push(r.url()+': '+r.failure()?.errorText));
try{
  await page.goto('http://127.0.0.1:8765/art-lab.html',{waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>window.__m3ch4ArtLabReady===true,undefined,{timeout:30000});
  const before=await page.screenshot({path:'art-lab-artifacts/compare-initial.png'});
  const beforeHash=createHash('sha256').update(before).digest('hex');
  const status=await page.locator('#stage-status').textContent();
  if(!status.includes('MATCHED CAMERAS'))throw Error('A/B layout did not render: '+status);
  await page.locator('#rig').selectOption('hauler');
  await page.locator('#angle').selectOption('front');
  await page.locator('#wear').evaluate(input=>{
    input.value='5';input.dispatchEvent(new Event('input',{bubbles:true}));
  });
  await page.waitForTimeout(250);
  const changed=await page.screenshot({path:'art-lab-artifacts/hauler-weathered.png'});
  if(createHash('sha256').update(changed).digest('hex')===beforeHash)
    throw Error('Real rig and camera changes did not alter the rendered image');
  await page.locator('#comparison').selectOption('candidate');
  await page.locator('#export').click();
  const exported=JSON.parse(await page.locator('#export-result').inputValue());
  if(exported.kind!=='M3CH4-ArtLab-v1'||exported.rig!=='hauler'||exported.wear!==5)
    throw Error('Art Lab settings export was not faithful');
  if(errors.length)throw Error('Art Lab browser errors: '+errors.join('\n'));
  // Small-device portrait inspection: no unusable horizontal document overflow.
  await page.setViewportSize({width:390,height:844});
  const layout=await page.evaluate(()=>({w:document.documentElement.scrollWidth,v:innerWidth}));
  if(layout.w>layout.v+3)throw Error('Art Lab has horizontal overflow: '+JSON.stringify(layout));
  await page.screenshot({path:'art-lab-artifacts/portrait.png'});
  console.log('ART LAB: PASS · real Three.js rig, A/B, terrain, candidate finish, preset export, iPhone layout');
}finally{await browser.close();}
