/** Kestrel V2 browser acceptance on actual assembled M3CH4 rigs. */
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdirSync,writeFileSync} from 'node:fs';
const folder='kestrel-v2-artifacts';mkdirSync(folder,{recursive:true});
const browser=await chromium.launch({headless:true,args:[
 '--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader'
]});
const faults=[],records={};
async function newPage(viewport,mobile){
 const page=await browser.newPage({viewport,isMobile:mobile,hasTouch:mobile,deviceScaleFactor:1});
 page.on('pageerror',e=>faults.push('PAGE '+e.message));
 page.on('requestfailed',r=>faults.push('REQUEST '+r.url()+' '+r.failure()?.errorText));
 page.on('console',msg=>{if(msg.type()==='error')faults.push('CONSOLE '+msg.text());});
 await page.goto('http://127.0.0.1:8765/kestrel-silhouette.html',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__kestrelSilhouetteLab?.ready,null,{timeout:55000});
 return page;
}
async function status(page){return page.evaluate(()=>window.__kestrelSilhouetteLab.inspect());}
async function snap(page,file){await page.screenshot({path:folder+'/'+file});}
try{
 let p=await newPage({width:1440,height:900},false);
 let state=await status(p);
 assert.equal(state.comparison,'designs');
 assert.equal(state.stance,'balanced');
 assert.equal(state.motion,'stand');
 assert.ok(state.rigPoses.every(r=>r.pose.reachable));
 await snap(p,'01-assembled-original-balance.png');
 await p.locator('#stance-perched').click();
 state=await status(p);
 assert.equal(state.stance,'perched');
 assert.ok(state.rigPoses.every(r=>r.pose.stance==='perched'&&r.pose.reachable));
 await snap(p,'02-three-perched-designs.png');
 await p.locator('#stance-crouched').click();
 await p.locator('[data-view="side"]').click();
 await snap(p,'03-deep-crouched-side-profile.png');
 await p.locator('#choose-field').click();
 await p.locator('#compare-stances').click();
 state=await status(p);
 assert.equal(state.comparison,'stances');
 assert.equal(state.selected,'field');
 assert.deepEqual(state.rigPoses.map(r=>r.design),['field','field','field']);
 assert.deepEqual(state.rigPoses.map(r=>r.pose.stance),['perched','balanced','crouched']);
 await snap(p,'04-field-three-stances-full-mech.png');
 await p.locator('#legs-only').click();
 await snap(p,'05-field-three-stances-legs-only.png');
 await p.locator('#full-rig').click();
 await p.locator('#arena').click();
 await snap(p,'06-field-three-stances-arena-scale.png');
 await p.locator('#garage').click();
 await p.locator('#mode-inspect').click();
 await p.locator('#gait-phase').evaluate(el=>{
  el.value='62';el.dispatchEvent(new Event('input',{bubbles:true}));
 });
 state=await status(p);
 assert.equal(state.motion,'inspect');
 assert.equal(state.playing,false);
 assert.equal(state.phase,.62);
 assert.ok(state.rigPoses.every(r=>r.pose.reachable));
 await snap(p,'07-field-stride-contact-phase62.png');
 await p.locator('#mode-walk').click();
 const a=await status(p);await p.waitForTimeout(700);
 const b=await status(p);
 assert.equal(b.playing,true);
 assert.ok(Math.abs(b.phase-a.phase)>.01,'walking gait actually advances');
 assert.ok(b.rigPoses.every(r=>r.pose.reachable));
 await p.locator('#toggle-play').click();
 const paused=await status(p);
 assert.equal(paused.playing,false);
 await snap(p,'08-animated-step-paused.png');
 await p.locator('#compare-designs').click();
 state=await status(p);
 assert.deepEqual(state.rigPoses.map(r=>r.design),['raptor','field','perch']);
 await p.locator('#mode-stand').click();
 await p.locator('#stance-balanced').click();
 await p.locator('[data-view="quarter"]').click();
 await snap(p,'09-three-designs-return-to-original.png');
 await p.close();
 p=await newPage({width:390,height:844},true);
 assert.equal((await status(p)).focus,true);
 await p.locator('#compare-stances').click();
 state=await status(p);
 assert.equal(state.focus,false,'compare stances should reveal all three models');
 await snap(p,'10-portrait-three-stances.png');
 await p.locator('#focus').click();
 await p.locator('#choose-perch').click();
 await p.locator('#stance-crouched').click();
 await p.locator('[data-view="side"]').click();
 await snap(p,'11-portrait-perch-crouched.png');
 const layout=await p.evaluate(()=>{
  const stage=document.getElementById('stage').getBoundingClientRect();
  const toolbar=document.querySelector('.pose-toolbar').getBoundingClientRect();
  const motion=document.querySelector('#gait-phase').getBoundingClientRect();
  return {viewport:innerWidth,stage:stage.width,toolbar:toolbar.width,
   slider:motion.width,scrollWidth:document.documentElement.scrollWidth};
 });
 assert.ok(layout.stage<=layout.viewport+1);
 assert.ok(layout.toolbar<=layout.viewport+1);
 assert.ok(layout.scrollWidth<=layout.viewport+2);
 assert.ok(layout.slider>50);
 assert.equal(faults.length,0,faults.join('\n'));
 records.desktop=b;records.mobile=layout;
 writeFileSync(folder+'/acceptance.json',JSON.stringify(records,null,2));
 console.log('KESTREL V2 FULL-RIG ARTICULATION & UI PASS');
}finally{await browser.close();}
