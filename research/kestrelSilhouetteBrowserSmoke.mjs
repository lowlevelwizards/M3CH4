/** Rendered browser acceptance for the Naked Kestrel rebuild concepts.
 * Compare actual assembled M3CH4 rigs, not synthetic upper-body boxes.
 */
import {chromium} from 'playwright';
import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const folder='kestrel-silhouette-artifacts';
mkdirSync(folder,{recursive:true});
const browser=await chromium.launch({headless:true,
 args:['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});
const errors=[];
let page;
async function open(viewport,mobile=false){
 page=await browser.newPage({viewport,deviceScaleFactor:1,isMobile:mobile,hasTouch:mobile});
 page.on('pageerror',e=>errors.push('PAGE '+e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push('CONSOLE '+m.text());});
 page.on('requestfailed',r=>errors.push('NETWORK '+r.url()+' '+r.failure()?.errorText));
 await page.goto('http://127.0.0.1:8765/kestrel-silhouette.html',
  {waitUntil:'domcontentloaded',timeout:60000});
 await page.waitForFunction(()=>window.__kestrelSilhouetteLab?.ready,null,{timeout:55000})
  .catch(e=>{throw Error(e.message+'\n'+errors.join('\n'));});
}
async function shot(name){
 await page.waitForTimeout(120);
 await page.screenshot({path:folder+'/'+name,fullPage:false});
}
try{
 await open({width:1440,height:900});
 let before=await page.evaluate(()=>window.__kestrelSilhouetteLab.inspect());
 assert.equal(before.focus,false);
 assert.equal(before.fullRig,true);
 assert.equal(before.candidates.length,3);
 assert.deepEqual(before.candidates.map(p=>p.id),['raptor','field','perch']);
 assert.ok(before.candidates.every(p=>p.isNominalWidth));
 // Inspect the actual 3D bodies for closed outward-facing surfaces, including
 // the extreme proportions, without sacrificing the exposed knee opening.
 const audit=await page.evaluate(async()=>{
  const {createSilhouetteMachine}=await import('./research/kestrelSilhouetteGeometry.js');
  const {SILHOUETTE_PRESETS,TUNABLES,candidateById}=await import('./research/kestrelSilhouetteDesign.js');
  const issues=[],counts={};
  for(const p of SILHOUETTE_PRESETS){
   const base=candidateById(p.id);
   for(const [setting,config] of [
    ['baseline',base],
    ['minimum',{...base,...Object.fromEntries(Object.entries(TUNABLES).map(([k,v])=>[k,v.min]))}],
    ['maximum',{...base,...Object.fromEntries(Object.entries(TUNABLES).map(([k,v])=>[k,v.max]))}]]){
    const root=createSilhouetteMachine(config).root;
    let meshCount=0,triangles=0,negative=0;
    root.traverse(o=>{
     if(!o.isMesh)return;
     meshCount++;
     if(o.geometry.userData?.yardwalkerPrism){
      const g=o.geometry,ind=g.index.array,pos=g.attributes.position;
      for(let i=0;i<ind.length;i+=3){
       const ix=[ind[i],ind[i+1],ind[i+2]];
       const a=ix.map(k=>[pos.getX(k),pos.getY(k),pos.getZ(k)]);
       const u=a[1].map((v,k)=>v-a[0][k]);
       const v=a[2].map((q,k)=>q-a[0][k]);
       const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
       const c=[0,1,2].map(k=>(a[0][k]+a[1][k]+a[2][k])/3);
       if(n.reduce((sum,v,k)=>sum+v*c[k],0)<=1e-8)negative++;
       triangles++;
      }
     }
     if(o.userData?.armorZone)issues.push('Unexpected armor on '+o.name);
    });
    counts[p.id+'/'+setting]={meshCount,triangles};
    if(meshCount<25)issues.push(p.id+' too few parts '+meshCount);
    if(triangles<250)issues.push(p.id+' no visible prisms');
    if(negative)issues.push(p.id+' inward or degenerate faces '+negative);
    root.traverse(o=>{if(o.isMesh)o.geometry.dispose();});
   }
  }
  const {buildPartVisual}=await import('./partVisuals.js');
  const playable=buildPartVisual('legs-compact',{mode:'gameplay'});
  if(playable.userData.visualDesign?.startsWith('kestrel-study'))
   issues.push('Experimental Kestrel model was used in live game');
  return {issues,counts};
 });
 assert.deepEqual(audit.issues,[],audit.issues.join('\n'));
 await shot('01-three-up-full-mech-quarter.png');
 for(const view of ['front','side','rear']){
  await page.locator('[data-view="'+view+'"]').click();
  await shot('02-full-mech-'+view+'.png');
 }
 await page.locator('[data-view="quarter"]').click();
 await page.locator('#arena').click();
 await shot('03-three-up-arena-distance.png');
 await page.locator('#garage').click();
 await page.locator('#legs-only').click();
 for(const view of ['quarter','front','side','rear']){
  await page.locator('[data-view="'+view+'"]').click();
  await shot('04-naked-legs-'+view+'.png');
 }
 await page.locator('[data-view="quarter"]').click();
 await page.locator('#silhouette').click();
 await shot('05-black-silhouettes.png');
 await page.locator('#silhouette').click();
 await page.locator('#full-rig').click();
 await page.locator('#choose-field').click();
 const selected=await page.evaluate(()=>window.__kestrelSilhouetteLab.inspect());
 assert.equal(selected.selected,'field');
 await page.locator('#thighMass').evaluate(el=>{el.value='.40';el.dispatchEvent(new Event('input',{bubbles:true}));});
 const edited=await page.evaluate(()=>window.__kestrelSilhouetteLab.inspect());
 assert.equal(edited.candidates[1].thighMass,.40);
 assert.equal(edited.candidates[0].thighMass,before.candidates[0].thighMass);
 assert.equal(edited.candidates[2].thighMass,before.candidates[2].thighMass);
 await shot('06-field-kestrel-adjusted-upper-casting.png');
 await page.locator('#reset-study').click();
 const restored=await page.evaluate(()=>window.__kestrelSilhouetteLab.inspect());
 assert.equal(restored.candidates[1].thighMass,before.candidates[1].thighMass);
 await page.locator('#focus').click();
 await shot('07-full-size-focused-field.png');
 assert.equal(errors.length,0,errors.join('\n'));
 await page.close();
 await open({width:390,height:844},true);
 const mobile=await page.evaluate(()=>window.__kestrelSilhouetteLab.inspect());
 assert.equal(mobile.focus,true,'Portrait phone should default to focus-one');
 await shot('08-phone-raptor-quarter.png');
 await page.locator('#choose-perch').click();
 await page.locator('[data-view="side"]').click();
 await shot('09-phone-perch-side.png');
 await page.locator('#legs-only').click();
 await shot('10-phone-perch-legs.png');
 const phoneRect=await page.evaluate(()=>{
  const stage=document.getElementById('stage').getBoundingClientRect();
  const canvas=document.getElementById('scene').getBoundingClientRect();
  return {width:stage.width,canvas:canvas.width,viewport:window.innerWidth,
   sliders:[...document.querySelectorAll('#sliders input')].every(el=>el.getBoundingClientRect().width>40)};
 });
 assert.equal(phoneRect.canvas,phoneRect.width);
 assert.ok(phoneRect.width<=phoneRect.viewport+1);
 assert.ok(phoneRect.sliders);
 await page.locator('#compare').click();
 await shot('11-phone-three-up.png');
 assert.equal((await page.evaluate(()=>window.__kestrelSilhouetteLab.inspect())).focus,false);
 assert.deepEqual(errors,[]);
 writeFileSync(folder+'/acceptance.json',JSON.stringify({before,audit,edited,restored,mobile,phoneRect,errors},null,2));
 console.log('KESTREL 3-UP SILHOUETTE LAB BROWSER PASS');
}finally{await browser.close();}
