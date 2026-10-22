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
page.on('console',message=>{
  if(message.type()==='error' && /THREE\.WebGLProgram|Shader Error|VALIDATE_STATUS|ERROR: 0:/.test(message.text()))
    errors.push('GPU shader compilation: '+message.text().slice(0,900));
});
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
  // Verify a scar on the actual catalogue model sticks to the correct
  // articulated submesh without becoming another physical raycast target.
  const scar=await page.evaluate(async()=>{
    const [{buildExteriorRig},{makeTestAssembly},
      {createSurfaceScarRenderer}]=await Promise.all([
      import('./scene.js'),import('./components.js'),
      import('./surfaceDamageRenderer.js'),
    ]);
    const rig=buildExteriorRig(makeTestAssembly()),renderer=createSurfaceScarRenderer();
    let hit=null;
    rig.partGroups.get('mobility').traverse(node=>{
      if(!hit&&node.isMesh&&node.userData.surface?.persistable)hit=node;
    });
    if(!hit)return {ok:false,reason:'No named mobility surface'};
    const mark={
      eventId:'browser-mobility-hit-1',sortieId:'browser-smoke',serial:'SR01-002',
      surfaceId:hit.userData.surface.id,
      localPoint:[0,0,0],localNormal:[0,0,1],
      armorAbsorbed:12,internalDamage:0,timestamp:1000,
    };
    const applied=renderer.apply(rig,mark);
    const duplicate=renderer.apply(rig,mark);
    const child=hit.children.find(node=>node.userData.surfaceScarEvent===mark.eventId);
    const pickContamination=rig.pickMeshes.includes(child);
    renderer.clear();
    return {ok:applied&&!duplicate&&!!child&&!pickContamination&&
      !child.parent,markCount:renderer.counts()};
  });
  if(!scar.ok)throw Error('Real articulated scar render failed: '+JSON.stringify(scar));
  if(errors.length)throw Error('Art Lab browser errors: '+errors.join('\n'));
  // Small-device portrait inspection: no unusable horizontal document overflow.
  await page.setViewportSize({width:390,height:844});
  const layout=await page.evaluate(()=>({w:document.documentElement.scrollWidth,v:innerWidth}));
  if(layout.w>layout.v+3)throw Error('Art Lab has horizontal overflow: '+JSON.stringify(layout));
  await page.screenshot({path:'art-lab-artifacts/portrait.png'});
  console.log('ART LAB: PASS · real Three.js rig, A/B, terrain, candidate finish, preset export, iPhone layout');
}finally{await browser.close();}
