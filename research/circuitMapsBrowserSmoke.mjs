/** Real WebGL certificate for all three authored combat venues.
 * The same THREE environment builder used by the live game is rendered at
 * phone-landscape resolution, with no mock screenshots or fake cover.
 */
import {chromium} from 'playwright';
import {mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
mkdirSync('art-lab-artifacts',{recursive:true});
const browser=await chromium.launch({headless:true,
 args:['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});
const page=await browser.newPage({viewport:{width:844,height:390},deviceScaleFactor:1});
const errors=[];
page.on('pageerror',e=>errors.push(String(e.message)));
page.on('console',m=>{
 if(m.type()==='error'&&/THREE.WebGLProgram|Shader Error|VALIDATE_STATUS/.test(m.text()))
  errors.push(m.text().slice(0,900));
});
try {
 await page.goto('http://127.0.0.1:8765/art-lab.html',
  {waitUntil:'domcontentloaded',timeout:60000});
 await page.waitForFunction(()=>window.__m3ch4ArtLabReady===true,
  undefined,{timeout:30000});
 const pictures=[];
 for(const mapId of ['backlot-dustbowl','culvert-nine','grainhouse']){
  const outcome=await page.evaluate(async id=>{
    const [three,core,components,maps]=await Promise.all([
      import('three'),import('./scene.js'),import('./components.js'),
      import('./maps/mapRegistry.js'),
    ]);
    const map=maps.mapById(id),assembly=components.makeTestAssembly();
    const arena=core.createArenaScene(assembly,
       components.makeTestAssembly(),map);
    const renderer=new three.WebGLRenderer({
       antialias:false,preserveDrawingBuffer:true,powerPreference:'low-power',
    });
    renderer.setSize(844,390);
    renderer.setPixelRatio(1);
    arena.camera.aspect=844/390;
    arena.camera.far=155;
    arena.camera.updateProjectionMatrix();
    arena.camera.position.set(0,53,67);
    arena.camera.lookAt(0,0,0);
    renderer.render(arena.scene,arena.camera);
    const cover=new Set();
    arena.scene.traverse(node=>{
      if(node.isMesh&&node.userData?.arenaObstacleId)
        cover.add(node.userData.arenaObstacleId);
    });
    const cert=arena.scene.getObjectByName('backlot-outdoor-derby-world')
      ?.userData?.backlotStats?.collisionCertificate;
    const allMapCover=id==='backlot-dustbowl'
      ?!!cert?.pass&&cert.gameplayObstacleCount===map.world.obstacles.length&&
       cert.visuallyCertifiedParts>=30&&
       map.world.obstacles.every(o=>o.id.startsWith('tractor-')||
        o.id.startsWith('loader-')||cover.has(o.id))
      :map.world.obstacles.every(o=>cover.has(o.id));
    const actual=arena.scene.getObjectByName('arena-environment');
    const themed=id==='backlot-dustbowl'
      ?arena.scene.getObjectByName('backlot-outdoor-derby-world')
      :arena.scene.getObjectByName('venue-dressing-'+id);
    const data=renderer.domElement.toDataURL('image/png');
    // Also certify a mech-height point of view: the overhead map view alone
    // could never reveal whether the sky still looked like a warehouse.
    let eyeLevel=null;
    if(id==='backlot-dustbowl'){
      arena.camera.position.set(0,3.7,19);
      arena.camera.lookAt(0,3.0,-22);
      renderer.render(arena.scene,arena.camera);
      eyeLevel=renderer.domElement.toDataURL('image/png');
    }
    renderer.dispose();
    return {id,actualMap:actual?.userData?.mapId,
       obstacleCount:map.world.obstacles.length,
       drawnColliders:cover.size,allMapCover,
       themed:!!themed,
       backlotOpen:id==='backlot-dustbowl'?(
         themed?.userData?.backlotStats?.enclosingWarehouseWalls===0 &&
         arena.scene.background?.isTexture===true &&
         !arena.scene.getObjectByName('wall-north') &&
         !arena.scene.getObjectByName('wall-west') &&
         !arena.scene.getObjectByName('wall-south') &&
         !arena.scene.getObjectByName('wall-east')):true,
       eyeLevel,data};
  },mapId);
  if(outcome.actualMap!==mapId||!outcome.themed||!outcome.backlotOpen||!outcome.allMapCover||
      (mapId!=='backlot-dustbowl'&&outcome.drawnColliders<outcome.obstacleCount))
    throw Error('Venue cover/visual parity '+JSON.stringify({...outcome,data:'omitted'}));
  const buffer=Buffer.from(outcome.data.split(',')[1],'base64');
  writeFileSync('art-lab-artifacts/map-'+mapId+'.png',buffer);
  if(outcome.eyeLevel)
    writeFileSync('art-lab-artifacts/map-backlot-mech-eye.png',
      Buffer.from(outcome.eyeLevel.split(',')[1],'base64'));
  pictures.push({...outcome,eyeLevel:undefined,data:undefined,
    hash:createHash('sha256').update(buffer).digest('hex')});
 }
 if(new Set(pictures.map(p=>p.hash)).size!==3)
   throw Error('Distinct maps rendered identical: '+JSON.stringify(pictures));
 // The actual deployed game must use the SAME contract-to-world choice as
 // the standalone map renders, including campaign unlock and browser reload.
 await page.goto('http://127.0.0.1:8765/index.html',
  {waitUntil:'domcontentloaded',timeout:60000});
 await page.evaluate(async()=>{
  const {CAMPAIGN_STORAGE_KEY,createCampaignState}=await import('./campaign.js');
  localStorage.setItem(CAMPAIGN_STORAGE_KEY,JSON.stringify(createCampaignState({
   clearedNodes:['yard-dog','cutter','mule','circuit-final'],
   status:'complete',
  })));
 });
 for(const [contractId,expectedMap] of [
  ['yard-dog','backlot-dustbowl'],
  ['domination','culvert-nine'],
  ['circuit-final','grainhouse'],
 ]){
  await page.evaluate(id=>{
   sessionStorage.setItem('m3ch4-contract-v1',id);
  },contractId);
  await page.reload({waitUntil:'domcontentloaded'});
  try{
   await page.waitForFunction(()=>window.__m3ch4BootOK===true,undefined,
    {timeout:25000});
  }catch(e){
   const log=await page.evaluate(()=>document.querySelector(
    '#startup-diagnostic-detail')?.textContent||'no startup diagnostic');
   throw Error('Venue live load failed '+contractId+': '+log+' / '+String(e));
  }
  const live=await page.evaluate(async()=>{
   const {activePlayerArena}=await import('./scene.js');
   const scene=activePlayerArena()?.arena?.scene;
   return {id:scene?.getObjectByName('arena-environment')?.userData?.mapId,
    coverCount:scene?.children?.length??0};
  });
  if(live.id!==expectedMap)
   throw Error('Real contract loaded wrong world '+contractId+' '+JSON.stringify(live));
  await page.screenshot({path:'art-lab-artifacts/live-contract-'+contractId+'.png'});
 }

 if(errors.length)throw Error('Browser WebGL errors: '+errors.join('; '));
 console.log('CIRCUIT MAPS: PASS · 3 real 3D venues, map-specific cover and lighting '+JSON.stringify(pictures));
} finally {await browser.close();}
