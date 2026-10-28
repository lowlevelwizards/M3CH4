/** Actual WebGL, no save: compare every Yardwalker armor level and pose.
 * Captured geometry is the real buildPartVisual source used by garage/combat.
 */
import {chromium} from 'playwright';
import {mkdirSync,writeFileSync} from 'node:fs';
const dir='yardwalker-artifacts';mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({headless:true,
 args:['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});
const page=await browser.newPage({viewport:{width:844,height:390},
 deviceScaleFactor:1,isMobile:true,hasTouch:true});
const errors=[];
page.on('pageerror',e=>errors.push(String(e.stack||e.message)));
try{
 await page.goto('http://127.0.0.1:8765/armor-lab.html',{waitUntil:'domcontentloaded',timeout:60000});
 await page.locator('#armor-part').selectOption('legs-yard');
 const measurements=[];
 for(let tier=0;tier<4;tier++){
  await page.locator('#armor-tier').evaluate((el,n)=>{
    el.value=String(n);el.dispatchEvent(new Event('input',{bubbles:true}));
  },tier);
  await page.waitForTimeout(170);
  const result=await page.evaluate(async tier=>{
   const THREE=await import('three');
   const [{createArmoredPrototype,disposeArmorSpecimen},{YARDWALKER_LAYOUT},
    {YARDWALKER_DESIGN}]=await Promise.all([
     import('./armorPrototype.js'),import('./mobilityDefinitions.js'),import('./yardwalkerDesignData.js')]);
   const specimen=createArmoredPrototype('legs-yard',tier),root=specimen.root;
   const expected=[0,4,6,8][tier];
   if(specimen.plates.size!==expected)throw Error('Wrong armor count at tier '+tier);
   const original=YARDWALKER_LAYOUT;
   const axes=['left','right'],joints={};
   for(const side of axes){
    joints[side]=Object.fromEntries(['Hip','Knee','Ankle','Foot'].map(kind=>{
     const g=root.getObjectByName(side+kind);
     if(!g||!g.userData.joint)throw Error('Missing IK '+side+kind);
     return [kind,g];
    }));
   }
   const source=YARDWALKER_DESIGN;
   const targets=source.armor.filter(s=>s.tier<=tier);
   for(const entry of targets){
    const plate=specimen.plates.get(entry.id);
    const parentName=entry.parent==='carriage'?'YARDWALKER / WORK-CARRIAGE':entry.parent;
    if(plate.mesh.parent.name!==parentName)
      throw Error('Incorrect animated armor parent: '+entry.id);
   }
   const results=[];
   for(const pose of [
    {name:'rest',hip:0,knee:0,ankle:0},
    {name:'step-forward',hip:.2,knee:.2,ankle:-.1},
    {name:'step-back',hip:-.2,knee:.13,ankle:.11},
    {name:'compression',hip:.12,knee:.32,ankle:-.14},
    {name:'strafe',hip:.06,knee:.09,ankle:-.09,roll:.10}
   ]){
    for(const side of axes){
      const j=joints[side],sign=side==='left'?-1:1;
      j.Hip.rotation.set(pose.hip,0,(pose.roll||0)*sign);
      j.Knee.rotation.set(pose.knee,0,0);
      j.Ankle.rotation.set(pose.ankle,0,0);
    }
    root.updateMatrixWorld(true);
    // Fixed hip shells must not overlap the moving thigh shells in any
    // representative real gait pose (including forward lean and hip roll).
    if(tier>=2){
      for(const side of axes){
        const hip=specimen.plates.get('yard-'+side+'-hip').mesh;
        const thigh=specimen.plates.get('yard-'+side+'-thigh').mesh;
        const fixedBox=new THREE.Box3().setFromObject(hip);
        const movingBox=new THREE.Box3().setFromObject(thigh);
        if(fixedBox.intersectsBox(movingBox))
          throw Error('Hip shell intersects moving thigh at '+pose.name+' / '+side+' / tier '+tier);
      }
    }
    const box=new THREE.Box3().setFromObject(root),size=box.getSize(new THREE.Vector3());
    if([size.x,size.y,size.z].some(x=>!Number.isFinite(x)||x<.1))
      throw Error('Invalid Yardwalker bounds on '+pose.name);
    const rest=pose.name==='rest';
    if(rest){
      if(box.min.x < -1.001||box.max.x>1.001||
         box.min.y<-.826||box.max.y>.826||
         box.min.z<-.591||box.max.z>.591)
        throw Error('Yardwalker rest envelope breached: '+JSON.stringify(box));
    }
    results.push({pose:pose.name,width:Number(size.x.toFixed(3)),
      height:Number(size.y.toFixed(3)),depth:Number(size.z.toFixed(3))});
   }
   disposeArmorSpecimen(specimen);
   return {tier,parts:expected,poses:results};
  },tier);
  measurements.push(result);
  await page.locator('#armor-front').click();
  await page.screenshot({path:dir+'/tier-'+tier+'-front.png'});
  await page.locator('#armor-side').click();
  await page.screenshot({path:dir+'/tier-'+tier+'-side.png'});
  await page.locator('#armor-rear').click();
  await page.screenshot({path:dir+'/tier-'+tier+'-rear.png'});
  if(tier===3){
   await page.locator('#armor-walk').click();
   await page.waitForTimeout(220);
   await page.screenshot({path:dir+'/tier-3-gait.png'});
   await page.locator('#armor-walk').click();
  }
 }
 if(errors.length)throw Error(errors.join('; '));
 writeFileSync(dir+'/measurements.json',JSON.stringify(measurements,null,2));
 console.log('YARDWALKER FOUR-TIER AUDIT PASS '+JSON.stringify(measurements));
}finally{await browser.close();}
