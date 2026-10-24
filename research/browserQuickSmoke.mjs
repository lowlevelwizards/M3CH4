/** PR-only real-browser smoke. The full several-minute interaction/audio
 * battery stays available via the weekly/manual browser workflow. */
import {chromium} from 'playwright';
import {mkdirSync} from 'node:fs';
mkdirSync('browser-smoke-artifacts',{recursive:true});
const browser=await chromium.launch({
  headless:true,args:['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader'],
});
const page=await browser.newPage({viewport:{width:844,height:390},deviceScaleFactor:2});
const errors=[];
page.on('pageerror',e=>errors.push(String(e.stack||e.message)));
page.on('requestfailed',r=>errors.push(r.url()+': '+r.failure()?.errorText));
try{
  await page.goto('http://127.0.0.1:8765/index.html',{waitUntil:'domcontentloaded',timeout:60000});
  try {
    await page.waitForFunction(()=>window.__m3ch4BootOK===true,undefined,{timeout:25000});
  }catch(error){
    const diagnostic=await page.evaluate(()=>({
      title:document.title,
      startupPanel:document.querySelector('#startup-diagnostic-detail')?.textContent||null,
      text:document.body?.textContent?.slice(0,700)||null,
    }));
    throw new Error('MAP BOOT FAILED '+JSON.stringify({diagnostic,errors,
      original:String(error)}));
  }
  const initial=await page.evaluate(()=>({
    workspace:document.querySelector('#unified-garage')?.dataset.workspace,
    stations:document.querySelectorAll('#unified-garage .workshop-rail .unified-station').length,
    deploy:document.querySelector('#unified-garage .workshop-deploy')?.textContent,
  }));
  if(initial.workspace!=='garage'||initial.stations!==5||initial.deploy!=='SELECT JOB')
    throw Error('Wrong garage startup: '+JSON.stringify(initial));
  const backlot=await page.evaluate(async()=>{
    const {activePlayerArena}=await import('./scene.js');
    const scene=activePlayerArena()?.arena?.scene;
    const group=scene?.getObjectByName('backlot-outdoor-derby-world');
    let activeDrawObjects=0,physicalCover=0;
    group?.traverse(mesh=>{
      if(!mesh.isMesh)return;
      activeDrawObjects++;
      if(mesh.userData?.arenaObstacleId)physicalCover++;
    });
    return {stats:group?.userData?.backlotStats,activeDrawObjects,
      physicalCover,garageBackground:scene?.background?.isColor===true,
      oldWarehouse:!!scene?.getObjectByName('wall-north')};
  });
  if(!backlot.stats?.collisionCertificate?.pass||
   backlot.stats.collisionCertificate.authoritativeRaycastSolids!==57||
   backlot.stats.collisionCertificate.expectedPhysicalParts!==57||
   backlot.stats.collisionCertificate.uncollidableOffsiteAssets!==18)
    throw Error('Backlot physical/render certificate failed: '+
      JSON.stringify(backlot.stats?.collisionCertificate));
  if(!backlot.stats||!backlot.garageBackground||backlot.oldWarehouse||
     backlot.stats.enclosingWarehouseWalls!==0||
     backlot.stats.sky!=='open'||
     backlot.stats.fixtureBatch?.callsSaved<80||
     backlot.physicalCover!==backlot.stats.obstacleCount||
     backlot.activeDrawObjects<backlot.physicalCover||
     backlot.activeDrawObjects>320)
    throw Error('Mobile open-air Backlot world validation failed: '+JSON.stringify(backlot));
  await page.screenshot({path:'browser-smoke-artifacts/quick-garage.png'});
  await page.locator('#unified-garage .workshop-deploy').click();
  if(await page.locator('#unified-garage').getAttribute('data-workspace')!=='contracts')
    throw Error('Select Job did not open contract board');
  await page.locator('#unified-garage .campaign-node-tile[data-node="yard-dog"]').click();
  await page.locator('#unified-garage-action .unified-primary').click();
  const garage=await page.evaluate(()=>({
    workspace:document.querySelector('#unified-garage')?.dataset.workspace,
    action:document.querySelector('#unified-garage .workshop-deploy')?.textContent,
  }));
  if(garage.workspace!=='garage'||garage.action!=='DEPLOY')
    throw Error('Taking a contract did not expose Deploy: '+JSON.stringify(garage));
  await page.locator('#unified-garage .workshop-deploy').click();
  if(await page.locator('#unified-garage').getAttribute('data-workspace')!=='setup')
    throw Error('Deploy did not open sortie setup');
  await page.screenshot({path:'browser-smoke-artifacts/quick-sortie-setup.png'});
  if(errors.length)throw Error('Browser runtime errors: '+errors.join('\n'));
  console.log('PR BROWSER: PASS · first frame, physical garage, contract selection and sortie setup');
} finally {await browser.close();}
