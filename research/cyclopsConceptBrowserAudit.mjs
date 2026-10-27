/** Actual rendered comparison across all 4 Cyclops configurations.
 * Uses the exact production visual builder and dev Armor Lab, not mock geometry.
 */
import {chromium} from 'playwright';
import {mkdirSync,writeFileSync} from 'node:fs';
const out='cyclops-concept-artifacts';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,
 args:['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});
const page=await browser.newPage({viewport:{width:844,height:390},deviceScaleFactor:1,
 isMobile:true,hasTouch:true});
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
try{
 await page.goto('http://127.0.0.1:8765/armor-lab.html',{waitUntil:'domcontentloaded',timeout:60000});
 await page.locator('#armor-plates .armor-plate').first().waitFor({timeout:30000});
 await page.locator('#armor-focus').click();
 const four=[];
 for(let tier=0;tier<=3;tier++){
  await page.locator('#armor-tier').evaluate((input,n)=>{
   input.value=String(n);input.dispatchEvent(new Event('input',{bubbles:true}));
  },tier);
  await page.waitForTimeout(150);
  await page.locator('#armor-front').click();
  await page.screenshot({path:out+'/cyclops-'+tier+'-front.png'});
  await page.locator('#armor-side').click();
  await page.screenshot({path:out+'/cyclops-'+tier+'-side.png'});
  const inspect=await page.evaluate(async n=>{
   const [THREE,{buildPartVisual},{createArmoredPrototype,disposeArmorSpecimen}]=await Promise.all([
     import('three'),import('./partVisuals.js'),import('./armorPrototype.js')]);
   const original=buildPartVisual('cab-cyclops',{mode:'gameplay'});
   const specimen=createArmoredPrototype('cab-cyclops',n);
   const front=new THREE.Raycaster(new THREE.Vector3(-.066,.066,-3),new THREE.Vector3(0,0,1),0,8);
   const meshes=[];
   specimen.root.traverse(obj=>{if(obj.isMesh)meshes.push(obj);});
   const hits=front.intersectObjects(meshes,false);
   const box=new THREE.Box3().setFromObject(specimen.root);
   const info={tier:n,parts:specimen.plates.size,frontHits:hits.length,
     bounds:{min:box.min.toArray(),max:box.max.toArray()},
     coreShapes:original.children.reduce((sum,c)=>sum+c.children.filter(x=>x.isMesh).length,0)};
   disposeArmorSpecimen(specimen);
   return info;
  },tier);
  if(inspect.frontHits<1||inspect.coreShapes<30||
    inspect.parts!==[0,2,4,8][tier])throw Error('Invalid render state '+JSON.stringify(inspect));
  four.push(inspect);
 }
 await page.locator('#armor-reset-camera').click();
 await page.screenshot({path:out+'/cyclops-encased-quarter.png'});
 writeFileSync(out+'/measurements.json',JSON.stringify(four,null,2));
 if(errors.length)throw Error(errors.join('; '));
 console.log('Verified Cyclops concept levels:',JSON.stringify(four));
}finally{await browser.close();}
