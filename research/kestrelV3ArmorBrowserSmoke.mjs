/** Kestrel V3 real WebGL acceptance – four armor tiers × three moving studies. */
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdirSync,writeFileSync} from 'node:fs';
const out='kestrel-v3-artifacts';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:[
 '--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader'
]});
const errs=[],results={};
async function open(viewport,mobile=false){
 const page=await browser.newPage({viewport,isMobile:mobile,hasTouch:mobile,deviceScaleFactor:1});
 page.on('pageerror',e=>errs.push('PAGE '+e.message));
 page.on('console',m=>{if(m.type()==='error')errs.push('CONSOLE '+m.text());});
 page.on('requestfailed',r=>errs.push('FAILED '+r.url()+' '+r.failure()?.errorText));
 await page.goto('http://127.0.0.1:8765/kestrel-silhouette.html',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__kestrelSilhouetteLab?.ready,null,{timeout:60000});
 return page;
}
const status=p=>p.evaluate(()=>window.__kestrelSilhouetteLab.inspect());
const screenshot=(p,name)=>p.screenshot({path:out+'/'+name+'.png'});
async function clickTier(p,tier){
 await p.locator('[data-armor-tier="'+tier+'"]').click();
 const s=await status(p);
 assert.equal(s.armorTier,tier,'tier updated');
 assert.ok(s.rigPoses.every(r=>r.armorTier===tier),'matching armor level');
 assert.ok(s.rigPoses.every(r=>tier===0?r.armorCount===0:r.armorCount>0),'plate quantities');
}
try{
 let p=await open({width:1440,height:900});
 for(const tier of [0,1,2,3]){
  await clickTier(p,tier);
  await screenshot(p,'0'+tier+'-three-designs-tier-'+tier);
 }
 await p.locator('#choose-raptor').click();
 await p.locator('#compare-armor').click();
 let s=await status(p);
 assert.equal(s.comparison,'armor');
 assert.equal(s.rigPoses.length,4);
 assert.deepEqual(s.rigPoses.map(x=>x.armorTier),[0,1,2,3]);
 assert.deepEqual(s.rigPoses.map(x=>x.armorCount),[0,4,10,10]);
 await screenshot(p,'04-raptor-four-tiers-full');
 await p.locator('#legs-only').click();
 await screenshot(p,'05-raptor-four-tiers-legs');
 await p.locator('[data-view="side"]').click();
 await screenshot(p,'06-raptor-four-tiers-side');
 await p.locator('#full-rig').click();
 await p.locator('#arena').click();
 await screenshot(p,'07-raptor-four-tiers-arena');
 await p.locator('#garage').click();
 await p.locator('#encased-form').selectOption('pod');
 await screenshot(p,'08-raptor-pod-shell');
 await p.locator('#encased-form').selectOption('split');
 s=await status(p);
 assert.equal(s.armorForm,'split');
 assert.equal(s.rigPoses[3].armorCount,12);
 await screenshot(p,'09-raptor-split-shell');
 await p.locator('#encased-form').selectOption('swept');
 await p.locator('#stance-crouched').click();
 await p.locator('#mode-inspect').click();
 await p.locator('#gait-phase').evaluate(el=>{el.value='65';el.dispatchEvent(new Event('input',{bubbles:true}));});
 s=await status(p);
 assert.equal(s.motion,'inspect');
 assert.ok(s.rigPoses.every(x=>x.pose.reachable));
 await screenshot(p,'10-raptor-crouched-mid-stride');
 await p.locator('#armor-explode').click();
 s=await status(p);
 assert.equal(s.exploded,true);
 await screenshot(p,'11-exploded-plates');
 await p.locator('#armor-only').click();
 s=await status(p);
 assert.equal(s.armorOnly,true);
 await screenshot(p,'12-isolated-armor');
 await p.locator('[data-armor-zone="shin"]').click();
 s=await status(p);
 assert.equal(s.armorZones.shin,false);
 assert.ok(s.rigPoses.filter(x=>x.armorTier>0).every(x=>x.visibleArmor<x.armorCount));
 await screenshot(p,'13-shins-hidden');
 await p.locator('#armor-reset-view').click();
 s=await status(p);
 assert.equal(s.armorOnly,false);
 assert.equal(s.exploded,false);
 assert.ok(Object.values(s.armorZones).every(Boolean));
 await p.locator('#compare-designs').click();
 for(const design of ['field','perch']){
  await p.locator('#choose-'+design).click();
  await p.locator('#compare-armor').click();
  await p.locator('#mode-stand').click();
  await p.locator('#stance-balanced').click();
  await p.locator('[data-view="quarter"]').click();
  await screenshot(p,design+'-four-tiers');
  await p.locator('#compare-designs').click();
 }
 await p.locator('#compare-armor').click();
 await p.locator('#mode-walk').click();
 const before=(await status(p)).phase;
 await p.waitForTimeout(450);
 const after=await status(p);
 assert.ok(after.playing&&Math.abs(after.phase-before)>.01,'gait advances while armor follows');
 assert.ok(after.rigPoses.every(x=>x.pose.reachable),'armored poses reachable');
 await p.locator('#toggle-play').click();
 await screenshot(p,'14-armored-walking-pause');
 results.desktop=after;
 await p.close();
 p=await open({width:390,height:844},true);
 await p.locator('#compare-armor').click();
 s=await status(p);
 assert.equal(s.rigPoses.length,4);
 await screenshot(p,'15-phone-armor-four-grid');
 await p.locator('#focus').click();
 await clickTier(p,3);
 await p.locator('#encased-form').selectOption('split');
 await screenshot(p,'16-phone-single-encased');
 const layout=await p.evaluate(()=>({
  viewport:innerWidth,
  overflow:document.documentElement.scrollWidth,
  armor:document.querySelector('.armor-toolbar').getBoundingClientRect().width,
  stage:document.getElementById('stage').getBoundingClientRect().width,
  buttons:[...document.querySelectorAll('[data-armor-tier]')].map(x=>x.getBoundingClientRect().width)
 }));
 assert.ok(layout.armor<=layout.viewport+2 && layout.stage<=layout.viewport+2);
 assert.ok(layout.overflow<=layout.viewport+2,'mobile should not overflow horizontally');
 assert.ok(layout.buttons.every(w=>w>35));
 results.mobile=layout;
 assert.deepEqual(errs,[],errs.join('\n'));
 writeFileSync(out+'/acceptance.json',JSON.stringify(results,null,2));
 console.log('KESTREL V3 ALL FOUR ARMOR TIERS / THREE DESIGNS / WALK / MOBILE PASS');
}finally{await browser.close();}
