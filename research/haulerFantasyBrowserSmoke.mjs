/** Real Three.js + Chromium acceptance: Hauler H2 fantasy lab, mobile and desktop. */
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdirSync,writeFileSync} from 'node:fs';
const out='hauler-fantasy-artifacts';mkdirSync(out,{recursive:true});
const errors=[],audit={};
const browser=await chromium.launch({headless:true,args:[
 '--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader'
]});
async function open(viewport,mobile=false){
 const page=await browser.newPage({viewport,isMobile:mobile,hasTouch:mobile,deviceScaleFactor:1});
 page.on('pageerror',err=>errors.push('PAGE '+err.message));
 page.on('console',msg=>{if(msg.type()==='error')errors.push('CONSOLE '+msg.text());});
 page.on('requestfailed',r=>errors.push('NETWORK '+r.url()+' '+r.failure()?.errorText));
 await page.goto('http://127.0.0.1:8765/hauler-fantasy-lab.html',
  {waitUntil:'domcontentloaded',timeout:60000});
 await page.waitForFunction(()=>window.__haulerFantasyLab?.ready&&
  window.__haulerFantasyLab.inspect().frameCount>0,null,{timeout:55000});
 return page;
}
const inspect=page=>page.evaluate(()=>window.__haulerFantasyLab.inspect());
try{
 let page=await open({width:1380,height:880});
 let state=await inspect(page);
 assert.equal(state.focus,false);
 assert.equal(state.fullRig,false);
 assert.deepEqual(state.candidates.map(c=>c.id),['dock','strider','crane']);
 assert.ok(state.candidates.every(c=>c.meshCount>14));
 // Verify the original fantasy geometry actually builds inside the intended
 // footprint and has independent real joint groups. No live builder imported.
 audit.geometry=await page.evaluate(async()=>{
  const {createHaulerConcept}=await import('./research/haulerFantasyGeometry.js');
  const {HAULER_IDS,preset}=await import('./research/haulerFantasyDesign.js');
  const THREE=await import('three');
  const result=[];
  for(const id of HAULER_IDS){
   const c=createHaulerConcept(preset(id)),root=c.root;
   root.updateMatrixWorld(true);
   const parts=[],nodes=[];
   root.traverse(o=>{
    if(o.isMesh&&!o.userData.contactMarker){
     const box=new THREE.Box3().setFromObject(o);
     parts.push({name:o.name,min:box.min.toArray(),max:box.max.toArray()});
    }
    if(o.userData?.joint)nodes.push(o.userData.joint);
   });
   const offenders=parts.filter(x=>x.min[0]<-1.29||x.max[0]>1.29||
    x.min[1]<-.864||x.max[1]>.861||
    x.min[2]<-.690||x.max[2]>.690).map(x=>x.name);
   result.push({id,count:parts.length,nodes,offenders,
    uniqueParts:new Set(parts.map(x=>x.name)).size,
    footprint:[Math.min(...parts.map(x=>x.min[0])),
     Math.max(...parts.map(x=>x.max[0]))]});
  }
  return result;
 });
 for(const entry of audit.geometry){
  assert.deepEqual(entry.offenders,[],'all '+entry.id+' meshes must fit nominal Hauler envelope');
  assert.ok(entry.count>14,entry.id+' lacks mechanical geometry');
  assert.equal(entry.nodes.length,8,'both legs need 4 named joint pivots');
  assert.equal(entry.uniqueParts,entry.count,'components must have stable distinct names');
 }
 await page.screenshot({path:out+'/01-three-naked-concepts.png'});
 for(const view of ['front','side','rear']){
  await page.locator('[data-view="'+view+'"]').click();
  await page.screenshot({path:out+'/02-'+view+'.png'});
 }
 await page.locator('[data-view="quarter"]').click();
 await page.locator('#full-rig').click();
 await page.screenshot({path:out+'/03-three-real-upper-assemblies.png'});
 await page.locator('#legs-only').click();
 await page.locator('#silhouette').check();
 await page.screenshot({path:out+'/04-silhouettes.png'});
 await page.locator('#silhouette').uncheck();
 await page.locator('[data-choose="crane"]').click();
 await page.locator('#focus').click();
 await page.locator('#ghost').check();
 state=await inspect(page);
 assert.equal(state.selected,'crane');
 assert.equal(state.focus,true);
 assert.equal(state.ghost,true);
 await page.screenshot({path:out+'/05-crane-ghost-overlays.png'});
 await page.locator('#ghost').uncheck();
 await page.locator('[data-motion="walk"]').click();
 await page.locator('#contacts').check();
 await page.locator('#joints').check();
 await page.locator('#phase').fill('35');
 state=await inspect(page);
 assert.equal(state.motion,'walk');
 assert.ok(state.candidates[2].motion.feet.some(x=>x.contact==='SWING'));
 await page.screenshot({path:out+'/06-crane-walk-contacts.png'});
 await page.locator('#play').click();
 await page.waitForTimeout(340);
 let moving=await inspect(page);
 assert.equal(moving.playing,true);
 assert.notEqual(moving.phase,state.phase);
 await page.locator('#play').click();
 await page.locator('[data-motion="brace"]').click();
 state=await inspect(page);
 assert.equal(state.motion,'brace');
 await page.screenshot({path:out+'/07-crane-brace.png'});
 // Edit one candidate without mutating any other design's default.
 await page.locator('.proportions summary').click();
 await page.locator('#footScale').fill('1.04');
 state=await inspect(page);
 assert.ok(state.candidates[2].soleWidth>.53);
 assert.equal(state.candidates[0].hipSpan,1.89);
 assert.equal(state.candidates[1].hipSpan,1.8);
 await page.locator('#reset-study').click();
 state=await inspect(page);
 assert.equal(state.candidates[2].soleWidth,.53);
 await page.close();
 page=await open({width:390,height:844},true);
 state=await inspect(page);
 assert.equal(state.focus,true,'portrait defaults to one useful large model');
 await page.screenshot({path:out+'/08-phone-focus.png'});
 await page.locator('[data-choose="strider"]').click();
 await page.locator('[data-view="side"]').click();
 await page.screenshot({path:out+'/09-phone-strider-side.png'});
 await page.locator('#compare').click();
 await page.screenshot({path:out+'/10-phone-three-up.png'});
 const dimensions=await page.evaluate(()=>({
  body:document.documentElement.scrollWidth,viewport:innerWidth,
  stage:document.getElementById('stage').getBoundingClientRect().width,
  canvas:document.getElementById('scene').getBoundingClientRect().width,
  controls:[...document.querySelectorAll('button')].every(b=>
   b.getBoundingClientRect().height>=35)
 }));
 assert.ok(dimensions.body<=dimensions.viewport+2,'no phone horizontal overflow');
 assert.ok(dimensions.stage<=dimensions.viewport+2);
 assert.equal(dimensions.stage,dimensions.canvas);
 assert.equal(dimensions.controls,true,'touch controls minimum 35px');
 assert.deepEqual(errors,[],errors.join('\n'));
 audit.mobile=dimensions;
 writeFileSync(out+'/acceptance.json',JSON.stringify(audit,null,2));
 console.log('HAULER FANTASY THREE BUILDERS / MECHANICS / MOBILE LAB PASS');
}finally{await browser.close();}
