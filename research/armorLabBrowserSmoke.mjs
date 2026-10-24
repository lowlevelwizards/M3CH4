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
 const layout=await page.evaluate(()=>{
   const stage=document.querySelector('#armor-stage').getBoundingClientRect();
   const dock=document.querySelector('#armor-dock').getBoundingClientRect();
   const head=document.querySelector('.armor-head').getBoundingClientRect();
   return {stageTop:stage.top,stageBottom:stage.bottom,stageHeight:stage.height,
     dockTop:dock.top,headBottom:head.bottom,height:innerHeight,
     drawerHidden:document.querySelector('#armor-plate-drawer').hidden,
     horizontalOverflow:document.documentElement.scrollWidth>innerWidth+3};
 });
 if(!layout.drawerHidden||layout.horizontalOverflow||
    layout.stageBottom>layout.dockTop+1||
    layout.stageTop<layout.headBottom-1||
    layout.stageHeight/layout.height<.51)
   throw Error('Lab model viewer is blocked by the controls: '+JSON.stringify(layout));
 await page.locator('#armor-focus').click();
 const focused=await page.evaluate(()=>({
   stageHeight:document.querySelector('#armor-stage').getBoundingClientRect().height,
   dockVisible:getComputedStyle(document.querySelector('#armor-dock')).display!=='none',
 }));
 if(focused.dockVisible||focused.stageHeight<layout.stageHeight+90)
   throw Error('MODEL ONLY mode did not expose viewport '+JSON.stringify(focused));
 await page.locator('#armor-focus').click();
 await page.locator('#armor-view-toggle').click();
 if(!await page.locator('body').evaluate(x=>x.classList.contains('armor-solo')))
   throw Error('Solo presentation failed');
 await page.locator('#armor-view-toggle').click();
 await page.locator('#armor-toggle-plates').click();
 if(await page.locator('#armor-plate-drawer').getAttribute('hidden')!==null)
   throw Error('Full plate inventory failed to open');
 await page.locator('#armor-close-plates').click();
 if(await page.locator('#armor-plate-drawer').getAttribute('hidden')===null)
   throw Error('Full plate inventory failed to close');
 let state=await check();
 if(state.count!==2||!state.mass?.includes('36'))
  throw Error('Cyclops level 1 source model missing '+JSON.stringify(state));
 const initial=await page.screenshot({path:'armor-lab-artifacts/cyclops-armor-1.png'});
 await tier(0);
 state=await check();
 if(state.count!==0)throw Error('Naked Cyclops still has panels '+JSON.stringify(state));
 await page.screenshot({path:'armor-lab-artifacts/cyclops-naked.png'});
 await tier(2);
 state=await check();
 if(state.count!==4)throw Error('Cyclops medium package missing brow + lip '+JSON.stringify(state));
 await page.screenshot({path:'armor-lab-artifacts/cyclops-armor-2.png'});
 await tier(3);
 state=await check();
 if(state.count!==8)throw Error('Cyclops 8 independently destructible plates missing '+JSON.stringify(state));
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
 await tier(1);
 state=await check();
 if(state.count!==2)throw Error('Kestrel light package regressed '+JSON.stringify(state));
 await page.screenshot({path:'armor-lab-artifacts/kestrel-armor-1.png'});
 await tier(2);
 state=await check();
 if(state.count!==6)throw Error('Kestrel medium thigh armor missing '+JSON.stringify(state));
 await page.screenshot({path:'armor-lab-artifacts/kestrel-armor-2.png'});
 await tier(3);
 state=await check();
 if(state.count!==12)throw Error('Kestrel 12 independent articulated limb panels missing '+JSON.stringify(state));
 await page.locator('#armor-walk').click();
 if(await page.locator('#armor-walk').getAttribute('aria-pressed')!=='true')
  throw Error('Kestrel gait toggle did not engage');
 await page.locator('#armor-side').click();
 await page.waitForTimeout(230);
 await page.screenshot({path:'armor-lab-artifacts/kestrel-armor-3-side-gait.png'});
 await page.locator('#armor-front').click();
 await page.waitForTimeout(120);
 await page.screenshot({path:'armor-lab-artifacts/kestrel-armor-3-front.png'});
 const alignment=await page.evaluate(async()=>{
  const [{createArmoredPrototype,disposeArmorSpecimen},{default:THREE}]=await Promise.all([
    import('./armorPrototype.js'),import('three').then(m=>({default:m})),
  ]);
  const byTier={};
  for(const id of ['legs-compact','cab-cyclops']){
    const specimens=[0,1,2,3].map(t=>createArmoredPrototype(id,t));
    let previousCount=0;
    for(let tier=0;tier<=3;tier++){
      const specimen=specimens[tier];
      if(specimen.plates.size<previousCount)throw Error('Plate count shrank');
      previousCount=specimen.plates.size;
      const box=new THREE.Box3().setFromObject(specimen.root),size=new THREE.Vector3();
      box.getSize(size);
      byTier[id+':'+tier]={count:specimen.plates.size,bounds:size.toArray()};
    }
    if(id==='legs-compact'){
      for(const id of ['kestrel-left-thigh','kestrel-right-thigh','kestrel-left-flank','kestrel-right-flank']){
        const p=specimens[3].plates.get(id),mesh=p.mesh,anchor=mesh.userData.armorAlignment;
        if(!anchor)throw Error('Missing true spar alignment for '+id);
        const axis=new THREE.Vector3(...anchor.sparAxis);
        const worldAxis=new THREE.Vector3(0,1,0).applyQuaternion(mesh.quaternion);
        const bone=new THREE.Vector3(...anchor.jointTo).sub(new THREE.Vector3(...anchor.jointFrom));
        const start=new THREE.Vector3(...anchor.jointFrom);
        const centre=start.addScaledVector(bone,anchor.longitudinal);
        const offset=mesh.position.distanceTo(centre);
        if(mesh.parent.name!==anchor.mountParent||!mesh.parent.name.endsWith('Hip')||
          worldAxis.dot(axis)<.999||Math.abs(offset-anchor.clearance-anchor.depth*.5)>.002)
          throw Error('Floating or misaligned thigh guard: '+JSON.stringify({id,offset,anchor,angle:worldAxis.dot(axis)}));
      }
    }else{
      // At level three the single teal eye remains physically visible: a
      // central -Z shot must meet optic geometry rather than a solid plate.
      const heavy=specimens[3];heavy.root.updateMatrixWorld(true);
      const ray=new THREE.Raycaster(new THREE.Vector3(-.06,.072,-2),new THREE.Vector3(0,0,1));
      const actual=ray.intersectObject(heavy.root,true).filter(x=>x.object.isMesh&&x.object.visible);
      if(!actual.length||actual[0].object.userData.armorPlateId)
        throw Error('Bunker shell obstructs the Cyclops eye');
    }
    for(const specimen of specimens)disposeArmorSpecimen(specimen);
  }
  return byTier;
 });
 if(alignment['legs-compact:3'].count!==12||
   alignment['cab-cyclops:3'].count!==8)
  throw Error('Silhouette armor geometry missing '+JSON.stringify(alignment));
 const geometry=await page.evaluate(async()=>{
  const {createArmoredPrototype,disposeArmorSpecimen}=await import('./armorPrototype.js');
  const cy=createArmoredPrototype('cab-cyclops',3);
  const ke=createArmoredPrototype('legs-compact',3);
  const names=[...ke.plates].map(([id,p])=>({
    id,parent:p.mesh.parent?.name,hasParent:!!p.mesh.parent,
    moveWithLeg:['Knee','Hip','Ankle','Foot'].some(name=>p.mesh.parent?.name?.endsWith(name))
  }));
  const head=[...cy.plates].map(([id,p])=>({id,parent:p.mesh.parent?.name}));
  disposeArmorSpecimen(cy);disposeArmorSpecimen(ke);
  return {names,head};
 });
 if(geometry.names.length!==12||geometry.names.some(p=>!p.moveWithLeg)||
    geometry.head.length!==8)throw Error('Plate joint attachment missing '+JSON.stringify(geometry));
 if(errors.length)throw Error('Armor browser errors '+JSON.stringify(errors));
 console.log('ARMOR LAB PASS '+JSON.stringify({cyclopsPlateCount:8,
  kestrelPlateCount:12,geometry,crewRestoration:true}));
}finally{await browser.close();}
