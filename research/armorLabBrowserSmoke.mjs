/** Real iPhone-landscape browser smoke for the production-mesh Armor Lab.
 * Not a mock screenshot: exercises Three.js, switches kits, removes physical
 * plates, spends real prototype crew units, and runs the Kestrel joint preview.
 */
import {chromium} from 'playwright';
import {mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
mkdirSync('armor-lab-artifacts',{recursive:true});
const browser=await chromium.launch({headless:true,
  args:['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});
const page=await browser.newPage({viewport:{width:844,height:390},deviceScaleFactor:1,
  isMobile:true,hasTouch:true});
const errors=[];
page.on('pageerror',e=>errors.push(String(e.stack||e.message)));
page.on('requestfailed',r=>errors.push(r.url()+': '+r.failure()?.errorText));
const hash=buf=>createHash('sha256').update(buf).digest('hex');
async function tier(level){
 await page.locator('#armor-tier').evaluate((input,n)=>{
  input.value=String(n);input.dispatchEvent(new Event('input',{bubbles:true}));
 },level);
}
async function check(){
 const state=await page.evaluate(()=>({
  hasCanvas:!!document.querySelector('#armor-stage canvas'),
  count:document.querySelectorAll('#armor-plates .armor-plate').length,
  mass:document.querySelector('#armor-mass')?.textContent,
  msg:document.querySelector('#armor-feedback')?.textContent,
  error:document.querySelector('#armor-error')?.textContent,
  errorHidden:document.querySelector('#armor-error')?.hidden,
 }));
 if(!state.hasCanvas||!state.errorHidden||errors.length)
  throw Error('Armor Lab did not load '+JSON.stringify({state,errors}));
 return state;
}
try{
 await page.goto('http://127.0.0.1:8765/armor-lab.html',
  {waitUntil:'domcontentloaded',timeout:60000});
 await page.locator('#armor-plates .armor-plate').first().waitFor({timeout:30000});
 let state=await check();
 if(state.count!==2||!state.mass?.includes('36'))
  throw Error('Cyclops level 1 source model missing '+JSON.stringify(state));
 const initial=await page.screenshot({path:'armor-lab-artifacts/cyclops-armor-1.png'});
 await tier(0);
 state=await check();
 if(state.count!==0)throw Error('Naked Cyclops still has panels '+JSON.stringify(state));
 await page.screenshot({path:'armor-lab-artifacts/cyclops-naked.png'});
 await tier(3);
 state=await check();
 if(state.count!==5)throw Error('Cyclops 5 independently destructible panels missing '+JSON.stringify(state));
 const heavy=await page.screenshot({path:'armor-lab-artifacts/cyclops-armor-3.png'});
 if(hash(initial)===hash(heavy))throw Error('Cyclops armor tiers did not render differently');
 await page.locator('#armor-hit').click();
 if(!(await page.locator('#armor-plates .armor-plate').first().textContent()).includes('50%'))
  throw Error('Cyclops individual panel failed impact simulation');
 await page.locator('#armor-strip').click();
 if(!(await page.locator('#armor-plates .armor-plate').first().textContent()).includes('0%'))
  throw Error('Cyclops panel did not separate');
 await page.screenshot({path:'armor-lab-artifacts/cyclops-plate-gone.png'});
 await page.locator('#armor-patch').click();
 if(!(await page.locator('#armor-plates .armor-plate').first().textContent()).includes('25%')||
   !(await page.locator('#armor-worker-count').textContent()).includes('3 / 4'))
  throw Error('Crew plate restoration did not consume one unit');
 await page.locator('#armor-repair-reset').click();
 await page.locator('#armor-part').selectOption('legs-compact');
 state=await check();
 if(state.count!==0)throw Error('Kestrel native state not stripped '+JSON.stringify(state));
 await tier(3);
 state=await check();
 if(state.count!==6)throw Error('Kestrel left/right limb armor missing '+JSON.stringify(state));
 await page.locator('#armor-walk').click();
 if(await page.locator('#armor-walk').getAttribute('aria-pressed')!=='true')
  throw Error('Kestrel gait toggle did not engage');
 await page.locator('#armor-side').click();
 await page.waitForTimeout(230);
 await page.screenshot({path:'armor-lab-artifacts/kestrel-armor-3-side-gait.png'});
 const geometry=await page.evaluate(async()=>{
  const {createArmoredPrototype,disposeArmorSpecimen}=await import('./armorPrototype.js');
  const cy=createArmoredPrototype('cab-cyclops',3);
  const ke=createArmoredPrototype('legs-compact',3);
  const names=[...ke.plates].map(([id,p])=>({
    id,parent:p.mesh.parent?.name,hasParent:!!p.mesh.parent,
    moveWithLeg:!!p.mesh.parent?.name?.endsWith('Knee')||
      !!p.mesh.parent?.name?.endsWith('Hip')
  }));
  const head=[...cy.plates].map(([id,p])=>({id,parent:p.mesh.parent?.name}));
  disposeArmorSpecimen(cy);disposeArmorSpecimen(ke);
  return {names,head};
 });
 if(geometry.names.length!==6||geometry.names.some(p=>!p.moveWithLeg)||
    geometry.head.length!==5)throw Error('Plate joint attachment missing '+JSON.stringify(geometry));
 if(errors.length)throw Error('Armor browser errors '+JSON.stringify(errors));
 console.log('ARMOR LAB PASS '+JSON.stringify({cyclopsPlateCount:5,
  kestrelPlateCount:6,geometry,crewRestoration:true}));
}finally{await browser.close();}
