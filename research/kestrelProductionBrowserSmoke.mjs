/** Production Raptor Scout real Chromium/WebGL regression on an assembled lab page. */
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {mkdirSync,writeFileSync} from 'node:fs';
const out='kestrel-production-artifacts';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:[
 '--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader'
]});
const errors=[];
try{
 const page=await browser.newPage({viewport:{width:1280,height:840},deviceScaleFactor:1});
 page.on('pageerror',e=>errors.push('PAGE '+e.message));
 page.on('requestfailed',r=>errors.push('REQUEST '+r.url()+' '+r.failure()?.errorText));
 page.on('console',m=>{if(m.type()==='error')errors.push('CONSOLE '+m.text());});
 await page.goto('http://127.0.0.1:8765/kestrel-silhouette.html',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__kestrelSilhouetteLab?.ready,null,{timeout:60000});
 const audit=await page.evaluate(async()=>{
  const [{buildPartVisual},{createSilhouetteMachine},{candidateById},
    {createArmoredPrototype}]=await Promise.all([
    import('./partVisuals.js'),
    import('./research/kestrelSilhouetteGeometry.js'),
    import('./research/kestrelSilhouetteDesign.js'),
    import('./armorPrototype.js')
  ]);
  const live=buildPartVisual('legs-compact',{mode:'gameplay'});
  const study=createSilhouetteMachine(candidateById('raptor')).root;
  live.updateMatrixWorld(true);study.updateMatrixWorld(true);
  const problems=[];
  const meshes=study.children.filter(x=>x.isMesh);
  for(const original of meshes){
   const production=live.getObjectByName(original.name);
   if(!production?.isMesh){problems.push('Missing '+original.name);continue;}
   if(original.geometry.getAttribute('position').count!==
      production.geometry.getAttribute('position').count)
    problems.push('Changed geometry '+original.name);
   const oldP=original.getWorldPosition(original.position.clone());
   const newP=production.getWorldPosition(production.position.clone());
   const oldQ=original.getWorldQuaternion(original.quaternion.clone());
   const newQ=production.getWorldQuaternion(production.quaternion.clone());
   if(oldP.distanceTo(newP)>.003||1-Math.abs(oldQ.dot(newQ))>1e-5)
    problems.push('Rest pose mismatch '+original.name);
  }
  const chains=['left','right'].map(side=>
   ['Hip','Knee','Ankle','Foot'].map(label=>live.getObjectByName(side+label)));
  const names=['hip','knee','ankle','foot'];
  for(const chain of chains){
   chain.forEach((joint,i)=>{
    if(!joint||joint.userData.joint!==names[i])
     problems.push('Bad '+names[i]+' live joint');
   });
  }
  const foot=live.getObjectByName('L/tapered landing sole');
  const footOrigin=foot.getWorldPosition(foot.position.clone());
  chains[0][0].rotation.x=.16;
  live.updateMatrixWorld(true);
  const moved=foot.getWorldPosition(foot.position.clone()).distanceTo(footOrigin);
  chains[0][0].rotation.x=0;live.updateMatrixWorld(true);
  const restored=foot.getWorldPosition(foot.position.clone()).distanceTo(footOrigin);
  const legacy=createArmoredPrototype('legs-compact',3);
  const archivePresent=Boolean(legacy.root.getObjectByName('K9-left-minimal-supported-runner-sole'));
  const armorCount=legacy.plates.size;
  const liveArmor=[];live.traverse(x=>{if(x.userData?.armorZone)liveArmor.push(x.name);});
  return {design:live.userData.visualDesign,meshes:meshes.length,problems,
   moved,restored,armorCount,archivePresent,liveArmor};
 });
 assert.equal(audit.design,'raptor-scout-naked-v1');
 assert.ok(audit.meshes>=20,'all approved naked meshes should survive');
 assert.deepEqual(audit.problems,[],'rest-pose art and real joints must match');
 assert.ok(audit.moved>.015,'live hip must articulate the Raptor foot');
 assert.ok(audit.restored<1e-5,'live rest pose must be reversible');
 assert.ok(audit.archivePresent,'original Kestrel armor lab must keep legacy anatomy');
 assert.ok(audit.armorCount>0,'legacy Kestrel armor archive must remain usable');
 assert.deepEqual(audit.liveArmor,[],'no experimental armor in the live model');
 assert.deepEqual(errors,[],errors.join('\n'));
 writeFileSync(out+'/acceptance.json',JSON.stringify(audit,null,2));
 console.log('RAPTOR SCOUT PRODUCTION / LEGACY ARMOR ARCHIVE BROWSER PASS');
}finally{await browser.close();}
