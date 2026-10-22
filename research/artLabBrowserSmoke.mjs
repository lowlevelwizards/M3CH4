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
    const geo=hit.geometry,attr=geo.getAttribute('position'),ids=geo.getIndex();
    const idx=n=>ids?ids.getX(n):n;
    const pa=[attr.getX(idx(0)),attr.getY(idx(0)),attr.getZ(idx(0))];
    const pb=[attr.getX(idx(1)),attr.getY(idx(1)),attr.getZ(idx(1))];
    const pc=[attr.getX(idx(2)),attr.getY(idx(2)),attr.getZ(idx(2))];
    const ab=pb.map((v,i)=>v-pa[i]),ac=pc.map((v,i)=>v-pa[i]);
    const nn=[ab[1]*ac[2]-ab[2]*ac[1],
      ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0]];
    const l=Math.hypot(...nn)||1;
    const mark={
      eventId:'browser-mobility-hit-1',sortieId:'browser-smoke',serial:'SR01-002',
      surfaceId:hit.userData.surface.id,
      localPoint:pa.map((v,i)=>(v+pb[i]+pc[i])/3),
      localNormal:nn.map(x=>x/l),
      armorAbsorbed:12,internalDamage:0,timestamp:1000,
    };
    const applied=renderer.apply(rig,mark);
    const duplicate=renderer.apply(rig,mark);
    const child=hit.children.find(node=>node.userData.surfaceScarEvent===mark.eventId);
    const pickContamination=rig.pickMeshes.includes(child);
    const breach={...mark,eventId:'browser-penetration-2',
      armorAbsorbed:1,internalDamage:34};
    const appliedBreach=renderer.apply(rig,breach);
    const hole=hit.children.find(node=>node.userData.surfaceScarEvent===breach.eventId);
    const rgb=hole?.material.map.image.getContext('2d')
      .getImageData(16,16,1,1).data;
    const roundBreach=hole?.userData.surfaceDamageKind==='breach' &&
      hole.userData.surfaceDamageSize[1]>child.userData.surfaceDamageSize[1]*2;
    const blackCavity=rgb&&rgb[0]<25&&rgb[1]<25&&rgb[2]<25&&rgb[3]>200;
    // Every generated vertex must come from the actual target's triangles,
    // never the free-floating billboard that used to overhang narrow shins.
    const isClipped=child?.geometry.type==='BufferGeometry'&&
      child.geometry.getAttribute('position').count>=3 &&
      !child.geometry.parameters;
    // An exact repair must conceal the old hole, use a physically lit material,
    // and cover at least the size of the original breach at that very anchor.
    const patched=renderer.apply(rig,{
      event:'service',eventId:'browser-repair-3',serial:'SR01-002',
      mode:'workshop-repair',coveredEventId:'browser-penetration-2',
      surfaceId:hit.userData.surface.id,localPoint:mark.localPoint,
      localNormal:mark.localNormal,timestamp:2000,
    });
    const patch=hit.children.find(node=>node.userData.surfaceScarEvent==='browser-repair-3');
    const repairValid=patched&&!hole.visible&&!!patch&&
      patch.material.isMeshStandardMaterial&&hole.material.isMeshStandardMaterial&&
      patch.userData.surfaceDamageSize[0]>hole.userData.surfaceDamageSize[0]&&
      patch.userData.surfaceDamageSize[1]>hole.userData.surfaceDamageSize[1];
    renderer.clear();
    return {ok:applied&&!duplicate&&!!child&&!pickContamination&&
      appliedBreach&&roundBreach&&blackCavity&&isClipped&&repairValid&&
      !child.parent&&!hole.parent&&!patch.parent,markCount:renderer.counts()};
  });
  if(!scar.ok)throw Error('Real articulated scar render failed: '+JSON.stringify(scar));
  const parade=await page.evaluate(async()=>{
    const [{createArenaScene},{makeTestAssembly}]=await Promise.all([
      import('./scene.js'),import('./components.js'),
    ]);
    const assembly=makeTestAssembly();
    const arena=createArenaScene(assembly,makeTestAssembly());
    const winners=[0,1,2].map(i=>({
      id:'show-'+i,assembly:makeTestAssembly(),operational:true,
    }));
    const started=arena.beginVictoryShowcase(winners);
    for(let i=0;i<125;i++)arena.updateVictoryShowcase(1/60);
    const visible=!!arena.scene.getObjectByName('physical-victory-parade');
    const cameraZ=arena.camera.position.z;
    arena.endVictoryShowcase();
    return {started,visible,cameraZ,removed:!arena.scene.getObjectByName('physical-victory-parade')};
  });
  if(!parade.started||!parade.visible||!parade.removed||parade.cameraZ>-60)
    throw Error('3D victory show failed '+JSON.stringify(parade));

  if(errors.length)throw Error('Art Lab browser errors: '+errors.join('\n'));
  // Small-device portrait inspection: no unusable horizontal document overflow.
  await page.setViewportSize({width:390,height:844});
  const layout=await page.evaluate(()=>({w:document.documentElement.scrollWidth,v:innerWidth}));
  if(layout.w>layout.v+3)throw Error('Art Lab has horizontal overflow: '+JSON.stringify(layout));
  await page.screenshot({path:'art-lab-artifacts/portrait.png'});
  console.log('ART LAB: PASS · real Three.js rig, A/B, terrain, candidate finish, preset export, iPhone layout');
}finally{await browser.close();}
