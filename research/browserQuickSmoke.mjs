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
  // Real deployment regression: fire rays at the VISIBLE loader roof and
  // bucket backplate, through the open cab window, and plan an actual AI route.
  // Unlike source-string checks this runs after the live meshes are fitted.
  const combatGeometry=await page.evaluate(async()=>{
    const {BACKLOT}=await import('./maps/backlot.js');
    const {collisionPieces,hasLiveCompoundPieces}=await import('./backlotCompoundGeometry.js');
    const {firstCoverHit}=await import('./coverTruth.js');
    const {planRoute}=await import('./ai/navigation.js');
    const byId=id=>BACKLOT.world.obstacles.find(o=>o.id===id);
    const cab=byId('loader-cab'),scoop=byId('loader-scoop');
    const roof=collisionPieces(cab).find(p=>p.source?.includes('roof-canopy-panel'));
    const backplate=collisionPieces(scoop).find(p=>p.source?.includes('welded-bucket-backplate'));
    const allLive=BACKLOT.world.obstacles.filter(o=>/^(tractor|loader)-/.test(o.id))
      .every(hasLiveCompoundPieces);
    if(!roof||!backplate)return {allLive,roof:!!roof,backplate:!!backplate};
    const roofX=(roof.minX+roof.maxX)/2,roofY=(roof.minY+roof.maxY)/2;
    const roofZ=(roof.minZ+roof.maxZ)/2;
    const hitRoof=firstCoverHit([roof.minX-1,roofY,roofZ],[1,0,0],[cab],10,0);
    const window=firstCoverHit([roofX,2.65,roof.minZ-2],[0,0,1],[cab],8,0);
    const scoopX=(backplate.minX+backplate.maxX)/2;
    const hitScoop=firstCoverHit([scoopX,1.25,backplate.minZ-2],[0,0,1],[scoop],6,0);
    const path=planRoute(BACKLOT.world,BACKLOT.spawns.friendly[0],
      BACKLOT.sites.domination[1],.95);
    return {allLive,roofSource:roof.source,roofY,roofHit:hitRoof?.partId===roof.partId,
      windowOpen:window===null,bucketHit:hitScoop?.partId===backplate.partId,
      aiRoute:path.ok,routeReason:path.reason??null};
  });
  if(!combatGeometry.allLive||!combatGeometry.roofHit||
     !combatGeometry.windowOpen||!combatGeometry.bucketHit||!combatGeometry.aiRoute)
    throw Error('LIVE machine steel / open sightline / route mismatch: '+
      JSON.stringify(combatGeometry));
  if(!backlot.stats?.collisionCertificate?.pass||
   backlot.stats.collisionCertificate.authoritativeRaycastSolids!==
     backlot.stats.collisionCertificate.expectedPhysicalParts||
   backlot.stats.collisionCertificate.visuallyCertifiedParts<30||
   backlot.stats.collisionCertificate.uncollidableOffsiteAssets!==18)
    throw Error('Backlot physical/render certificate failed: '+
      JSON.stringify(backlot.stats?.collisionCertificate));
  if(!backlot.stats||!backlot.garageBackground||backlot.oldWarehouse||
     backlot.stats.enclosingWarehouseWalls!==0||
     backlot.stats.sky!=='open'||
     backlot.stats.fixtureBatch?.callsSaved<80||
     // Twelve rebuilt machinery parents use mesh-derived raycast volumes,
     // so only the 22 legacy covers remain as tagged visible geometry.
     backlot.physicalCover!==(backlot.stats.obstacleCount-
       backlot.stats.collisionCertificate.compoundFamilyCount)||
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
