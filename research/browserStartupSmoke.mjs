/** Real browser smoke: catches module-graph errors that Node source tests miss. */
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const output = 'browser-smoke-artifacts';
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'],
});
const messages = [];
const page = await browser.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 });
page.on('console', m => { if (m.type() === 'error') messages.push('console: ' + m.text()); });
page.on('pageerror', e => messages.push('pageerror: ' + String(e.stack || e.message || e)));
page.on('requestfailed', r => messages.push('requestfailed: ' + r.url() + ' ' + (r.failure()?.errorText || '')));
let booted = false;
try {
  await page.goto('http://127.0.0.1:8765/index.html', { waitUntil: 'domcontentloaded', timeout: 60000 });
  try {
    await page.waitForFunction(() => window.__m3ch4BootOK === true, undefined, { timeout: 25000 });
    booted = true;
  } catch (e) {
    messages.push('first frame timed out: ' + e.message);
  }
  await page.screenshot({ path: output + '/startup.png' });
  const diag = await page.locator('#startup-diagnostic-detail').textContent().catch(() => null);
  if (diag) messages.push('visible diagnostic: ' + diag);
  console.log('BOOTED:', booted, 'DIAGNOSTIC:', diag || 'none');
  console.log('BROWSER MESSAGES:', messages.join('\n') || 'none');
  if (!booted) throw Error('Browser never rendered its first scene frame.');
  // k3w17: the first-ever Scattergun install must not leave a raw
  // number in Mesh.material, and cleanup of any legacy malformed material
  // must never turn a legitimate garage part-swap into a fatal overlay.
  const weaponSwaps=await page.evaluate(async()=>{
    const {activePlayerArena}=await import('./scene.js');
    const {makeTestAssembly,equipSerial}=await import('./components.js');
    const {Mesh,BoxGeometry}=await import('three');
    const live=activePlayerArena();
    if(!live?.arena||!live?.assembly)throw Error('Player garage scene is unavailable');
    const arena=live.arena,scratch=makeTestAssembly(),original=live.assembly;
    const installed=[];
    const audit=()=>{
      const bad=[];
      arena.scene.traverse(node=>{
        if(!node.isMesh||node.userData.actorId!=='player')return;
        const materials=Array.isArray(node.material)?node.material:[node.material];
        if(materials.some(material=>!material?.isMaterial))
          bad.push({name:node.name,materials:materials.map(m=>typeof m)});
      });
      return bad;
    };
    try {
      arena.rebuildAssembly(scratch);
      // Exercise the exact historical failure: dispose() on a raw integer.
      // The injected old mesh is never rendered, saved or used for hit tests.
      const structure=[];
      arena.scene.traverse(node=>{
        if(node.type==='Group'&&node.name.startsWith('structure: ')&&
          node.children.some(child=>child.userData?.actorId==='player'))
          structure.push(node);
      });
      if(!structure.length)throw Error('Could not find player exterior');
      const malformed=new Mesh(new BoxGeometry(.02,.02,.02),0x777777);
      structure[0].parent.add(malformed);
      for(const weaponId of ['gun-scatter','gun-cannon','gun-short','gun-light','gun-scatter','gun-cannon']){
        const part=scratch.owned.find(p=>p.definitionId===weaponId);
        if(!part)throw Error('No owned part for '+weaponId);
        equipSerial(scratch,'combat',part.serial);
        arena.rebuildAssembly(scratch);
        const bad=audit();
        if(bad.length)throw Error('Malformed fitted materials after '+weaponId+': '+JSON.stringify(bad));
        installed.push(weaponId);
      }
    }finally{
      arena.rebuildAssembly(original);
    }
    return {installed,invalidMaterials:audit()};
  });
  if(weaponSwaps.installed.length!==6||weaponSwaps.invalidMaterials.length)
    throw Error('First Scattergun equip/garage teardown regression: '+JSON.stringify(weaponSwaps));
  const swapDiagnostic=await page.locator('#startup-diagnostic-detail').textContent().catch(()=>null);
  if(swapDiagnostic)throw Error('Error overlay after Scattergun mounting: '+swapDiagnostic);
  console.log('SCATTERGUN SWAP: PASS · all four guns, first install, bad legacy material teardown');

  // Reproduce the iPhone user's second failure: a staged cab is installed in
  // Rig 02 with no frame. It may be inspected and quoted before commissioning.
  const fixture = await page.evaluate(async () => {
    const { BY_ID } = await import('./components.js');
    const { loadMachine, storeMachine } = await import('./persistence.js');
    const { loadStable, mountPartOnRig, storeStable } = await import('./stable.js');
    const live = loadMachine(localStorage);
    const cab = live.assembly.owned.find(p => BY_ID.get(p.definitionId)?.slot === 'command');
    if (!cab) throw Error('Starter fixture has no cab');
    const serial = 'BROWSER-STAGED-CAB';
    live.assembly.owned.push({ ...cab, serial, condition: .42, wear: 0, repairs: 0, destroyed: false });
    if (!storeMachine(localStorage, live)) throw Error('Could not store browser fixture');
    const stable = loadStable(localStorage).stable;
    const mounted = mountPartOnRig(stable, 'rig-02', 'command', serial);
    if (!mounted.ok) throw Error('Could not stage cab: ' + mounted.reason);
    if (!storeStable(localStorage, stable)) throw Error('Could not store staged bay');
    sessionStorage.setItem('m3ch4-viewed-bay-v1', 'rig-02');
    return { serial, installed: stable.rigs.find(r => r.id === 'rig-02').installed };
  });
  if (Object.keys(fixture.installed).length !== 1 || fixture.installed.command !== fixture.serial)
    throw Error('Fixture accidentally fielded a complete rig');
  // The current live game persists its own in-memory inventory on pagehide.
  // Seed the prepared save *before* JS modules run after reload, otherwise
  // pagehide overwrites this synthetic extra part with the older inventory.
  const prepared = await page.evaluate(() => ({
    machine: localStorage.getItem('mech-arena-machine-v8'),
    stable: localStorage.getItem('m3ch4-stable-v1'),
  }));
  if (!prepared.machine || !prepared.stable) throw Error('Browser fixture save missing');
  await page.addInitScript(`(() => {
    if (!location.pathname.endsWith('/index.html')) return;
    localStorage.setItem('mech-arena-machine-v8', ${JSON.stringify(prepared.machine)});
    localStorage.setItem('m3ch4-stable-v1', ${JSON.stringify(prepared.stable)});
    sessionStorage.setItem('m3ch4-viewed-bay-v1', 'rig-02');
  })();`);
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => window.__m3ch4BootOK === true, undefined, { timeout: 25000 });
  await page.locator('#unified-garage .unified-station').nth(3).click({ timeout: 12000 });
  const garageState = await page.evaluate(() => ({
    view: document.querySelector('#unified-garage')?.dataset.mode,
    selected: document.querySelector('#unified-garage .unified-station.selected')?.textContent,
    modules: document.querySelector('#unified-garage .unified-modules')?.textContent?.slice(0,800),
    hasQuote: !!document.querySelector('#unified-garage .unified-service'),
    startupError: document.querySelector('#startup-diagnostic-detail')?.textContent,
    garageText: document.querySelector('#unified-garage')?.textContent?.slice(0,1200),
  }));
  console.log('STAGED BAY DOM AFTER SELECT:', JSON.stringify(garageState));
  await page.waitForFunction(() => document.querySelector('#startup-diagnostic') ||
    document.querySelector('#unified-garage .unified-service'), undefined, { timeout: 6000 });
  await page.screenshot({ path: output + '/staged-rig-02.png' });
  const stagedError = await page.locator('#startup-diagnostic-detail').textContent().catch(() => null);
  const quote = await page.locator('#unified-garage .unified-service').textContent().catch(() => null);
  console.log('STAGED RIG QUOTE:', quote || 'none', 'ERROR:', stagedError || 'none');
  if (stagedError || !quote || !quote.includes('SERVICE CAB'))
    throw Error('Cannot inspect a partial Rig 02: ' + (stagedError || quote || 'missing repair quote'));

  // The fixture deliberately views an incomplete Rig 02 with only a cab.
  // Change to complete Rig 01 before checking moving leg joints.
  await page.locator('.unified-bay-navigation button[aria-label="View bay 1"]')
    .click({timeout:12000});
  await page.waitForFunction(()=>document.querySelector('.unified-bay-navigation button[aria-label="View bay 1"]')?.getAttribute('aria-pressed')==='true');
  // DEV animation inspection previews the ACTUAL fitted garage model;
  // all moving parts must be real transforms rather than just UI controls.
  await page.locator('#dev-toggle').click({ timeout: 12000 });
  await page.locator('#animation-preview-toggle').click({ timeout: 12000 });
  await page.waitForTimeout(650);
  const inspectionMotion=await page.evaluate(async()=>{
    const {activePlayerArena}=await import('./scene.js');
    const root=activePlayerArena()?.arena?.scene;
    const joints=[];root?.traverse(node=>{
      if(node.userData?.joint==='hip'||node.userData?.joint==='knee')
        joints.push(Math.abs(node.rotation.x));
    });
    return joints;
  });
  if(!inspectionMotion.some(a=>a>.04))
    throw Error('Garage animation preview does not articulate the actual hip/knee transforms: '+
      JSON.stringify(inspectionMotion));
  await page.locator('#animation-preview-mode').selectOption('reload');
  // Wait until the bolt has actually been drawn back, not the initial
  // opening-latch stage where motion is deliberately only a few millimetres.
  await page.waitForTimeout(810);
  const actionMotion=await page.evaluate(async()=>{
    const {activePlayerArena}=await import('./scene.js');
    let found=[];
    activePlayerArena()?.arena.scene.traverse(n=>{
      if(n.name==='EXPOSED BOLT / RELOAD CARRIAGE')found.push(n.position.z);
    });
    return found;
  });
  if(!actionMotion.some(z=>z>.025))
    throw Error('Reload inspection did not slide real mechanical parts: '+JSON.stringify(actionMotion));
  await page.locator('#animation-preview-mode').selectOption('disabled');
  await page.waitForTimeout(150);
  await page.screenshot({path:output+'/articulation-disabled-iphone.png'});
  await page.locator('#animation-preview-toggle').click();
  if(await page.locator('#animation-preview-toggle').getAttribute('aria-pressed')!=='false')
    throw Error('DEV animation inspection did not stop');
  console.log('ARTICULATION LAB: PASS · true leg joints, real bolt movement, damaged pose');
  // k3w16 / The visible garage soles must sit on the service pad at
  // Y=.09. Only inspect visible feet of the actual selected rig, not AI rigs
  // hidden behind the garage or the incomplete staged cab.
  await page.waitForTimeout(170);
  const contact=await page.evaluate(async()=>{
    const {activePlayerArena}=await import('./scene.js');
    const {Box3}=await import('three');
    const scene=activePlayerArena()?.arena?.scene;
    const feet=[];
    scene?.updateMatrixWorld(true);
    scene?.traverse(node=>{
      if(node.userData?.joint!=='foot')return;
      let ancestor=node;
      while(ancestor&&ancestor.visible){ancestor=ancestor.parent;}
      if(ancestor)return;
      const bounds=new Box3().setFromObject(node);
      if(Number.isFinite(bounds.min.y))
        feet.push({name:node.name,y:bounds.min.y});
    });
    return feet;
  });
  console.log('GARAGE SOLES:',JSON.stringify(contact));
  if(contact.length!==2||contact.some(foot=>Math.abs(foot.y-.102)>.045))
    throw Error('Visible garage soles do not meet service pad: '+JSON.stringify(contact));
  await page.locator('#animation-preview-toggle').click();
  await page.locator('#animation-preview-mode').selectOption('strafe-left');
  await page.waitForTimeout(720);
  const strafePose=await page.evaluate(async()=>{
    const {activePlayerArena}=await import('./scene.js');
    const hips=[],knees=[];
    activePlayerArena()?.arena?.scene.traverse(node=>{
      if(node.userData?.joint==='hip')hips.push(node.rotation.z);
      if(node.userData?.joint==='knee')knees.push(node.rotation.z);
    });
    return {hips,knees};
  });
  if(!strafePose.hips.some(n=>Math.abs(n)>.035)||
     !strafePose.knees.some(n=>Math.abs(n)>.025))
    throw Error('Side-step did not move both hip and knee joints: '+JSON.stringify(strafePose));
  await page.locator('#animation-preview-mode').selectOption('strafe-right');
  await page.waitForTimeout(540);
  await page.screenshot({path:output+'/strafe-ground-contact-iphone.png'});
  await page.locator('#animation-preview-toggle').click();
  console.log('GROUND / STRAFE: PASS · soles planted, side-step knee and hip articulation');

  // The first real iPhone audio milestone: DEV -> SOUND TEST BENCH -> one
  // tapped WebAudio audition, without affecting any rig or save data.
  await page.locator('#audio-bench-open').click({ timeout: 12000 });
  await page.locator('#audio-bench [data-weapon="gun-scatter"]').click({ timeout: 12000 });
  await page.locator('#audio-bench [data-variation="B"]').click({ timeout: 12000 });
  const benchStatus = await page.locator('#audio-bench-status').textContent();
  const benchRecipe = await page.locator('#audio-bench .audio-lab-identity').textContent();
  console.log('SOUND LAB:', benchRecipe, benchStatus);
  if (!benchStatus.includes('TRIGGERED') || !benchStatus.includes('S-6 SCATTERGUN / B'))
    throw Error('DEV Audio Lab did not trigger a WebAudio audition');
  // Stage 1b: each weapon's mix/variation persists independently. Export all
  // four, then reload the real page and verify it restores them.
  await page.locator('#audio-bench [name="audio-body"]').fill('25');
  await page.locator('#audio-bench [name="audio-action"]').fill('85');
  await page.locator('#audio-bench [data-weapon="gun-light"]').click();
  await page.locator('#audio-bench [data-variation="C"]').click();
  await page.locator('#audio-bench [name="audio-metal"]').fill('90');
  await page.locator('#audio-bench [data-weapon="gun-scatter"]').click();
  if ((await page.locator('#audio-bench [name="audio-body"]').inputValue())!=='25' ||
      (await page.locator('#audio-bench [name="audio-action"]').inputValue())!=='85' ||
      (await page.locator('#audio-bench [data-variation="B"]').getAttribute('aria-pressed'))!=='true')
    throw Error('Scattergun did not retain its own mix and B selection');
  await page.locator('#audio-bench .audio-lab-copy').click();
  const exported = await page.locator('#audio-bench-export').inputValue();
  if(!exported.includes('S-6 SCATTERGUN [gun-scatter] — B') ||
     !exported.includes('NEEDLE CANNON [gun-light] — C') ||
     !exported.includes('BODY 25') || !exported.includes('METAL 90'))
    throw Error('Copy All does not contain the four saved choices: '+exported);
  const saved = await page.evaluate(() => localStorage.getItem('m3ch4-audio-bench-presets-v2'));
  if (!saved || JSON.parse(saved).weapons['gun-scatter'].variation !== 'B')
    throw Error('Weapon preferences were not saved to the isolated audition key');
  await page.screenshot({ path: output + '/audio-lab-iphone-landscape.png' });
  await page.locator('#audio-bench .audio-lab-dismiss').click({ timeout: 12000 });
  if (!(await page.locator('#audio-bench').evaluate(node=>node.classList.contains('hidden'))))
    throw Error('Audio Lab did not close');
  if (await page.locator('#startup-diagnostic-detail').count())
    throw Error('Audio Lab introduced a startup/runtime error');
  await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => window.__m3ch4BootOK === true, undefined, {timeout:25000});
  await page.locator('#dev-toggle').click({timeout:12000});
  await page.locator('#audio-bench-open').click({timeout:12000});
  await page.locator('#audio-bench [data-weapon="gun-scatter"]').click();
  if ((await page.locator('#audio-bench [data-variation="B"]').getAttribute('aria-pressed'))!=='true' ||
      (await page.locator('#audio-bench [name="audio-body"]').inputValue())!=='25' ||
      (await page.locator('#audio-bench [name="audio-action"]').inputValue())!=='85')
    throw Error('Scattergun preset lost after full page reload');
  await page.locator('#audio-bench [data-weapon="gun-light"]').click();
  if ((await page.locator('#audio-bench [data-variation="C"]').getAttribute('aria-pressed'))!=='true' ||
      (await page.locator('#audio-bench [name="audio-metal"]').inputValue())!=='90')
    throw Error('Needle preset lost after full page reload');
  console.log('AUDIO PRESET RELOAD: PASS · 4 independent recipes exported');
  // Isolated k3w5 Stump material studies: existing saved A/B/C and sliders
  // must survive reference and three unsaved PCM comparisons unchanged.
  const priorPresets=await page.evaluate(() => localStorage.getItem('m3ch4-audio-bench-presets-v2'));
  await page.locator('#audio-bench [data-weapon="gun-short"]').click();
  await page.locator('#audio-stump-experiment').waitFor({state:'visible'});
  for(const material of ['reference','pressure','steel','hybrid']){
    await page.locator('#audio-stump-experiment [data-experiment="'+material+'"]').click();
    const status=await page.locator('#audio-stump-experiment-status').textContent();
    if(!status.includes(material==='reference'?'SAVED STUMP':'TRIGGERED'))
      throw Error('Stump material '+material+' failed to trigger: '+status);
    const recorded=await page.locator('#audio-stump-experiment').getAttribute('data-last-experiment');
    if(recorded!==material)throw Error('Wrong material selected: '+recorded);
  }
  const afterPresets=await page.evaluate(()=>localStorage.getItem('m3ch4-audio-bench-presets-v2'));
  if(afterPresets!==priorPresets)throw Error('Material experiment silently modified saved weapon choices');
  await page.screenshot({path:output+'/stump-materials-iphone-landscape.png'});
  await page.locator('#audio-bench .audio-lab-dismiss').click();
  await page.reload({waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>window.__m3ch4BootOK===true,undefined,{timeout:25000});
  await page.locator('#dev-toggle').click();
  await page.locator('#audio-bench-open').click();
  await page.locator('#audio-bench [data-weapon="gun-short"]').click();
  if((await page.locator('#audio-stump-experiment').isVisible())!==true)
    throw Error('Stump experiment missing after reload');
  if((await page.evaluate(()=>localStorage.getItem('m3ch4-audio-bench-presets-v2')))!==priorPresets)
    throw Error('Presets changed after page reload');
  console.log('STUMP MATERIAL STUDY: PASS · 3 PCM styles and saved reference, untouched presets');
  // Pressure Forge is a separate, compact landscape panel; the legacy
  // decisions must survive all editing, auditioning, and the page reload.
  await page.locator('#audio-bench .audio-lab-dismiss').click({timeout:12000});
  const oldBench=await page.evaluate(()=>localStorage.getItem('m3ch4-audio-bench-presets-v2'));
  await page.locator('#pressure-forge-open').click({timeout:12000});
  await page.locator('#pressure-forge').waitFor({state:'visible'});
  const fit=await page.evaluate(()=>{
    const work=document.querySelector('.forge-work').getBoundingClientRect();
    const header=document.querySelector('.forge-header').getBoundingClientRect();
    const guns=document.querySelector('.forge-guns').getBoundingClientRect();
    const footer=document.querySelector('.forge-footer').getBoundingClientRect();
    const viewport={width:innerWidth,height:innerHeight};
    return {work:{x:work.left,y:work.top,right:work.right,bottom:work.bottom},
      header:{top:header.top,bottom:header.bottom},
      guns:{top:guns.top,bottom:guns.bottom},footer:{top:footer.top,bottom:footer.bottom},
      viewport,scroll:document.querySelector('.forge-work').scrollHeight,
      height:document.querySelector('.forge-work').clientHeight};
  });
  console.log('PRESSURE FORGE FIT:',JSON.stringify(fit));
  if(fit.work.x<0||fit.work.y<0||fit.work.right>fit.viewport.width||
     fit.work.bottom>fit.viewport.height||fit.footer.bottom>fit.work.bottom||
     fit.guns.bottom>fit.footer.top||fit.scroll>fit.height+2)
    throw Error('Forge panel does not fit iPhone landscape viewport');
  await page.locator('#pressure-forge [data-weapon="gun-short"]').click();
  await page.locator('#pressure-forge [data-template="heavy"]').click();
  await page.locator('#pressure-forge [name="forge-bass"]').fill('95');
  await page.locator('#pressure-forge [data-tab="action"]').click();
  await page.locator('#pressure-forge [data-action="breech"]').click();
  await page.locator('#pressure-forge [name="forge-delay"]').fill('85');
  await page.locator('#forge-play').click();
  let status=await page.locator('#forge-status').textContent();
  if(!status.includes('FULL PLAYED'))throw Error('Forge full shot did not play: '+status);
  await page.locator('#pressure-forge [data-weapon="gun-light"]').click();
  await page.locator('#pressure-forge [data-template="dry"]').click();
  await page.locator('#pressure-forge [data-tab="blast"]').click();
  await page.locator('#pressure-forge [name="forge-treble"]').fill('90');
  await page.locator('#pressure-forge [data-weapon="gun-short"]').click();
  if((await page.locator('#pressure-forge [name="forge-bass"]').inputValue())!=='95')
    throw Error('Per-gun bass mix was lost when switching weapons');
  await page.locator('#forge-copy').click();
  const exportText=await page.locator('#forge-export').inputValue();
  if(!exportText.includes('STUMP CANNON [gun-short]')||
     !exportText.includes('NEEDLE CANNON [gun-light]')||
     !exportText.includes('BASS 95')||!exportText.includes('TREBLE 90'))
    throw Error('Forge four-weapon export is missing saved choices');
  const forgeRaw=await page.evaluate(()=>localStorage.getItem('m3ch4-pressure-forge-v1'));
  if(!forgeRaw||JSON.parse(forgeRaw).weapons['gun-short'].settings.delay!==85)
    throw Error('Forge recipe did not save to dedicated key');
  await page.locator('.forge-close-export').click();
  await page.locator('#pressure-forge [data-tab="blast"]').click();
  await page.screenshot({path:output+'/pressure-forge-iphone-landscape.png'});
  await page.locator('#pressure-forge .forge-close').click();
  if((await page.evaluate(()=>localStorage.getItem('m3ch4-audio-bench-presets-v2')))!==oldBench)
    throw Error('Forge unexpectedly modified legacy A/B/C recipes');
  await page.reload({waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>window.__m3ch4BootOK===true,undefined,{timeout:25000});
  await page.locator('#dev-toggle').click({timeout:12000});
  await page.locator('#pressure-forge-open').click({timeout:12000});
  await page.locator('#pressure-forge [data-weapon="gun-short"]').click();
  if((await page.locator('#pressure-forge [name="forge-bass"]').inputValue())!=='95')
    throw Error('Saved Stump Forge bass lost on reload');
  await page.locator('#pressure-forge [data-weapon="gun-light"]').click();
  if((await page.locator('#pressure-forge [name="forge-treble"]').inputValue())!=='90')
    throw Error('Saved Needle Forge treble lost on reload');
  if((await page.evaluate(()=>localStorage.getItem('m3ch4-audio-bench-presets-v2')))!==oldBench)
    throw Error('Forge overwrote old bench preferences during reload');
  console.log('PRESSURE FORGE: PASS · sound, fit, independent settings, copy-all, reload');
  // Smoke the exact production modules in Chromium after WebAudio has been
  // unlocked by the user's earlier interactions. Real integration is also
  // asserted statically in the Node suite against successful fireWeapon calls.
  const liveShot=await page.evaluate(async()=>{
    const {soundWeaponShot}=await import('./audio.js');
    return {
      own:soundWeaponShot('gun-short',{shotIndex:1,cockpit:true}),
      remote:soundWeaponShot('gun-scatter',{shotIndex:3,cockpit:false,distance:38}),
      training:soundWeaponShot('gun-cannon',{shotIndex:2,cockpit:true}),
      needle:soundWeaponShot('gun-light',{shotIndex:2,cockpit:true}),
    };
  });
  if(Object.values(liveShot).some(s=>!s.ok) ||
     !(liveShot.own.gain>liveShot.remote.gain) ||
     liveShot.own.reflectionCount!==4 || liveShot.remote.reflectionCount!==0)
    throw Error('Production weapon audio did not initialize correctly: '+JSON.stringify(liveShot));
  if((await page.evaluate(()=>localStorage.getItem('m3ch4-pressure-forge-v1')))!==forgeRaw)
    throw Error('Live weapon audio modified the audition presets');
  console.log('LIVE WEAPON SOUNDS: PASS · all four, cockpit reflections and remote attenuation');
  // k3w8: navigate a compact category lab without disturbing live combat
  // audio, garage save, or the existing user's Pressure Forge selections.
  await page.locator('#pressure-forge .forge-close').click({timeout:12000});
  const oldForge=await page.evaluate(()=>localStorage.getItem('m3ch4-pressure-forge-v1'));
  await page.locator('#systems-sound-open').click({timeout:12000});
  await page.locator('#systems-sound-lab').waitFor({state:'visible'});
  const soundFit=await page.evaluate(()=>{
    const work=document.querySelector('.systems-lab-work');
    const list=document.querySelector('.systems-lab-list');
    const foot=document.querySelector('.systems-lab-footer').getBoundingClientRect();
    const a=work.getBoundingClientRect();
    return {width:innerWidth,height:innerHeight,left:a.left,top:a.top,right:a.right,bottom:a.bottom,
      footerBottom:foot.bottom,scrollHeight:work.scrollHeight,clientHeight:work.clientHeight,
      listScrollable:list.scrollHeight>=list.clientHeight};
  });
  console.log('SYSTEMS SOUND FIT:',JSON.stringify(soundFit));
  if(soundFit.left<0||soundFit.top<0||soundFit.right>soundFit.width||
     soundFit.bottom>soundFit.height||soundFit.footerBottom>soundFit.bottom||
     soundFit.scrollHeight>soundFit.clientHeight+2)
    throw Error('Systems Sound Lab clipped outside iPhone landscape viewport');
  await page.locator('#systems-sound-lab [data-sound="glance"] [data-variant="1"]').click();
  if(!(await page.locator('#systems-sound-status').textContent()).includes('ARMOR GLANCE / B'))
    throw Error('Metallic deflection did not audition');
  await page.locator('#systems-sound-lab [data-sound="destruction"] [data-variant="2"]').click();
  await page.locator('#systems-sound-lab [data-group="electrical"]').click();
  await page.locator('#systems-sound-lab [data-sound="sparks"] [data-variant="1"]').click();
  await page.locator('#systems-sound-lab [data-sound="recharge"] [data-variant="2"]').click();
  await page.locator('#systems-sound-lab [data-group="machinery"]').click();
  for(const id of ['engine','hydraulics','yardwalker','kestrel','hauler','reload']){
    await page.locator('#systems-sound-lab [data-sound="'+id+'"] [data-variant="2"]').click();
    if(!(await page.locator('#systems-sound-status').textContent()).includes(' / C'))
      throw Error('Machine sound '+id+' did not audition');
  }
  await page.locator('#systems-sound-lab .systems-lab-copy').click();
  const soundChoices=await page.locator('#systems-sound-export').inputValue();
  if((soundChoices.match(/ \[/g)||[]).length!==13||
     !soundChoices.includes('HAULER H2 FOOTFALL [hauler] | C')||
     !soundChoices.includes('ARMOR GLANCE [glance] | B'))
    throw Error('Missing systems effect choices in export');
  const soundSave=await page.evaluate(()=>localStorage.getItem('m3ch4-systems-sound-lab-v1'));
  if(!soundSave||JSON.parse(soundSave).choices.hauler!==2)
    throw Error('Systems choices did not persist');
  await page.locator('.systems-lab-export-close').click();
  await page.screenshot({path:output+'/systems-audio-iphone-landscape.png'});
  await page.locator('#systems-sound-lab .systems-lab-close').click();
  if((await page.evaluate(()=>localStorage.getItem('m3ch4-pressure-forge-v1')))!==oldForge)
    throw Error('Systems audio changed existing weapon Forge');
  await page.reload({waitUntil:'domcontentloaded',timeout:60000});
  await page.waitForFunction(()=>window.__m3ch4BootOK===true,undefined,{timeout:25000});
  await page.locator('#dev-toggle').click();
  await page.locator('#systems-sound-open').click();
  await page.locator('#systems-sound-lab [data-group="machinery"]').click();
  if((await page.locator('#systems-sound-lab [data-sound="hauler"] [data-variant="2"]').
      getAttribute('aria-pressed'))!=='true')
    throw Error('Hauler sound choice lost after reload');
  if((await page.evaluate(()=>localStorage.getItem('m3ch4-pressure-forge-v1')))!==oldForge)
    throw Error('Existing weapon Forge changed across Systems Lab reload');
  console.log('SYSTEMS SOUND LAB: PASS · 39 examples, three pages, save/export, landscape');
  // Production effects must work in the same browser AudioContext as weapon
  // audio. Verify physical hit classification, distance and cockpit routing.
  const soundscape=await page.evaluate(async()=>{
    const {soundCombatImpact,soundSystemEvent}=await import('./audio.js');
    const {createMotionSoundState,advanceMotionSound,soundFamilyFor}=await import('./liveSystemsEvents.js');
    const armor=soundCombatImpact({armorAbsorbed:32,internalDamage:0,remainingArmor:70},
      {cockpit:true,slot:'structure'});
    const breached=soundCombatImpact({armorAbsorbed:0,internalDamage:20,remainingArmor:0},
      {distance:16,slot:'mobility'});
    const failed=soundCombatImpact({justDestroyed:true,internalDamage:50},
      {distance:6,slot:'power'});
    const local=soundSystemEvent('part',{cockpit:true,variant:2});
    const distant=soundSystemEvent('part',{distance:30,variant:2});
    const localFoot=soundSystemEvent('hauler',{cockpit:true,variant:0});
    const distantFoot=soundSystemEvent('hauler',{distance:30,variant:0});
    const charger=soundSystemEvent('recharge',{cockpit:true,variant:1});
    const engine=soundSystemEvent('engine',{cockpit:true,variant:0});
    const movement=createMotionSoundState();
    const events=[];
    for(let i=0;i<90;i++)events.push(...advanceMotionSound(movement,soundFamilyFor('legs-yard'),3,.02));
    return {armor,breached,failed,local,distant,localFoot,distantFoot,charger,engine,events};
  });
  if(soundscape.armor[0]?.id!=='glance' ||
     soundscape.breached[0]?.id!=='part' ||
     soundscape.failed[0]?.id!=='destruction'||
     !soundscape.local.ok||!soundscape.distant.ok||
     !(soundscape.local.gain>soundscape.distant.gain)||
     soundscape.local.earlyReflections!==4||
     soundscape.distant.earlyReflections!==0||
     !soundscape.localFoot.ok||!soundscape.distantFoot.skipped||
     !soundscape.charger.ok||!soundscape.engine.ok||
     !soundscape.events.includes('yardwalker'))
    throw Error('Production soundscape failed in-browser: '+JSON.stringify(soundscape));
  console.log('LIVE SYSTEMS AUDIO: PASS · physical damage, attenuation, cabin reverb and walking');
  const cachedPrep=await page.evaluate(async()=>{
    const {warmupStatus,warmPCM}=await import('./audioWarmup.js');
    const {renderSystemSound}=await import('./audioSystemsSynth.js');
    // Poll in the SAME page execution world as the actual game's modules.
    // Priority buffers should arrive early; optional late samples can continue
    // warming without blocking the match or this acceptance check.
    await new Promise((resolve,reject)=>{
      const start=performance.now();
      const poll=()=>{
        const state=warmupStatus();
        if(state.failed)return reject(Error('Audio worker failed'));
        if(state.received>=20)return resolve();
        if(performance.now()-start>18000)
          return reject(Error('Priority audio sample preparation timed out'));
        setTimeout(poll,120);
      };
      poll();
    });
    const status=warmupStatus();
    const glance=warmPCM('system','glance',0);
    const weapon=warmPCM('weapon','gun-cannon',0);
    const workerBlasted=!!(glance?.pcm?.length>1000&&weapon?.pcm?.length>1000);
    const src=renderSystemSound('glance',0,16000);
    return {status,workerBlasted,glancePeak:Math.max(...src.slice(0,250)),
      samples:src.length};
  });
  if(!cachedPrep.workerBlasted||cachedPrep.status.received<20||
     cachedPrep.status.failed)
    throw Error('Combat PCM was not prepared by the background worker: '+JSON.stringify(cachedPrep));
  console.log('AUDIO PREWARM: PASS · worker delivered ',cachedPrep.status.received,' samples');







} finally {
  await browser.close();
}
