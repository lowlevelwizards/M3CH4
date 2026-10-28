/** Browser acceptance: same full M3CH4 rig in three leg configurations,
 * synchronized view, size controls, and portrait phone focus layout.
 */
import {chromium} from 'playwright';
import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const out='yardwalker-silhouette-artifacts';
mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});
const diagnostics=[];
let page;
async function open(viewport,mobile=false){
 page=await browser.newPage({viewport,deviceScaleFactor:1,isMobile:mobile,hasTouch:mobile});
 page.on('pageerror',e=>diagnostics.push('PAGE: '+e.message));
 page.on('console',m=>{if(m.type()==='error')diagnostics.push('CONSOLE: '+m.text());});
 page.on('requestfailed',r=>diagnostics.push('NETWORK: '+r.url()+' '+r.failure()?.errorText));
 await page.goto('http://127.0.0.1:8765/yardwalker-silhouette.html',
  {waitUntil:'domcontentloaded',timeout:60000});
 await page.waitForFunction(()=>window.__yardwalkerSilhouetteLab?.ready,null,
  {timeout:55000}).catch(e=>{throw Error(e.message+'\n'+diagnostics.join('\n'));});
}
async function snapshot(file){await page.waitForTimeout(150);await page.screenshot({path:out+'/'+file,fullPage:false});}
try{
 await open({width:1280,height:780});
 // Production and the approved Naked Industrial Strider must share
 // every meaningful primitive and rest-world pose. Actual named joints must
 // move it; do not silently substitute the old V4 model for gameplay.
 const livePromotion=await page.evaluate(async()=>{
  const [{buildPartVisual},{createSilhouetteMachine},{candidateById}]=await Promise.all([
   import('./partVisuals.js'),import('./research/yardwalkerSilhouetteGeometry.js'),
   import('./research/yardwalkerSilhouetteDesign.js')]);
  const live=buildPartVisual('legs-yard',{mode:'gameplay'});
  const lab=createSilhouetteMachine(candidateById('strider'),{tier:0}).root;
  live.updateMatrixWorld(true);lab.updateMatrixWorld(true);
  const mismatches=[],names=[],newGeometry=[],armored=[];
  const a=window.THREE||null;
  lab.traverse(obj=>{if(obj.isMesh){
   const installed=live.getObjectByName(obj.name);
   names.push(obj.name);
   if(!installed||!installed.isMesh){mismatches.push(obj.name+' missing');return;}
   if(installed.geometry.getAttribute('position').count!==
      obj.geometry.getAttribute('position').count)mismatches.push(obj.name+' vertex count');
   const v1=obj.getWorldPosition(obj.position.clone()),
    v2=installed.getWorldPosition(installed.position.clone());
   const q1=obj.getWorldQuaternion(obj.quaternion.clone()),
    q2=installed.getWorldQuaternion(installed.quaternion.clone());
   if(v1.distanceTo(v2)>.004||1-Math.abs(q1.dot(q2))>1e-5)
    mismatches.push(obj.name+' rest pose');
  }});
  live.traverse(obj=>{if(obj.userData?.armorZone)armored.push(obj.name);});
  const chain=['left','right'].map(side=>{
   const joints=['Hip','Knee','Ankle','Foot'].map(j=>live.getObjectByName(side+j));
   return {side,names:joints.map(j=>j?.name),valid:joints.every((j,i)=>j?.userData?.joint===
    ['hip','knee','ankle','foot'][i])};
  });
  const foot=live.getObjectByName('L/load spreading boot'),
    hip=live.getObjectByName('leftHip');
  const initial=foot.getWorldPosition(foot.position.clone());
  hip.rotation.x=.13;live.updateMatrixWorld(true);
  const animated=foot.getWorldPosition(foot.position.clone());
  const movement=initial.distanceTo(animated);
  hip.rotation.x=0;live.updateMatrixWorld(true);
  const restored=foot.getWorldPosition(foot.position.clone());
  const baseDesign=live.userData.visualDesign;
  return {names:names.length,mismatches,chain,movement,
   restoredError:restored.distanceTo(initial),armorPieces:armored.length,
   design:baseDesign};
 });
 assert.ok(livePromotion.names>=20,'must compare all meaningful lab meshes against live model');
 assert.deepEqual(livePromotion.mismatches,[],'live Strider should match the Naked lab');
 assert.ok(livePromotion.chain.every(c=>c.valid),'actual named live gait joints must exist');
 assert.ok(livePromotion.movement>.018,'visual foot must move under hip rotation');
 assert.ok(livePromotion.restoredError<1e-5,'rest pose should be reversible');
 assert.equal(livePromotion.armorPieces,0,'armor must not ship in live Yardwalker');
 assert.equal(livePromotion.design,'industrial-strider-naked-v1');
 // Audit actual geometry, not just a screenshot: every triangle of every
 // custom prism must face OUTWARD. The previous inward winding rendered only
 // interiors under Three.js's standard FrontSide backface culling.
 const geometryAudit=await page.evaluate(async()=>{
  const {createSilhouetteMachine}=await import('./research/yardwalkerSilhouetteGeometry.js');
  const {candidateById,SILHOUETTE_PRESETS,TUNABLES}=await import('./research/yardwalkerSilhouetteDesign.js');
  const bad=[];let meshes=0,triangles=0;
  const cases=SILHOUETTE_PRESETS.flatMap(p=>{
   const baseline=candidateById(p.id);
   return [baseline,
    {...baseline,...Object.fromEntries(Object.entries(TUNABLES).map(([k,v])=>[k,v.min]))},
    {...baseline,...Object.fromEntries(Object.entries(TUNABLES).map(([k,v])=>[k,v.max]))}];
  });
  for(const params of cases){
   const machine=createSilhouetteMachine(params);
   machine.root.traverse(o=>{
    if(!o.isMesh||!o.geometry.userData?.yardwalkerPrism)return;
    meshes++;
    const g=o.geometry,positions=g.getAttribute('position'),ind=g.index.array;
    for(let i=0;i<ind.length;i+=3){
     const a=ind[i],b=ind[i+1],c=ind[i+2];
     const pa=[positions.getX(a),positions.getY(a),positions.getZ(a)];
     const pb=[positions.getX(b),positions.getY(b),positions.getZ(b)];
     const pc=[positions.getX(c),positions.getY(c),positions.getZ(c)];
     const u=pb.map((v,k)=>v-pa[k]),v=pc.map((q,k)=>q-pa[k]);
     const normal=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
     const centroid=pa.map((q,k)=>(q+pb[k]+pc[k])/3);
     const dot=normal.reduce((sum,q,k)=>sum+q*centroid[k],0);
     // Convex closed prisms are centered at the origin in local coordinates.
     // Outward normals have a strictly positive dot with their face centroid.
     if(dot<=1e-9)bad.push({study:params.id,mesh:o.name,triangle:i/3,dot});
     triangles++;
    }
    g.dispose();
   });
  }
  return {meshes,triangles,bad:bad.slice(0,30),badCount:bad.length};
 });
 assert.ok(geometryAudit.meshes>80,'must audit actual thigh, shin, foot and carriage faces');
 assert.ok(geometryAudit.triangles>2500,'must inspect every custom triangle');
 assert.equal(geometryAudit.badCount,0,JSON.stringify(geometryAudit.bad));
 // Independently verify 0/1/2/3 kits for all three candidates at all slider extremes.
 // Naked geometry must remain byte-for-byte identical across armor tiers.
 const armorAudit=await page.evaluate(async()=>{
  const {createSilhouetteMachine}=await import('./research/yardwalkerSilhouetteGeometry.js');
  const {SILHOUETTE_PRESETS,TUNABLES,candidateById}=await import('./research/yardwalkerSilhouetteDesign.js');
  const {normalizeArmor,ARMOR_LEVELS}=await import('./research/yardwalkerSilhouetteArmor.js');
  const cases=SILHOUETTE_PRESETS.flatMap(p=>{
   const base=candidateById(p.id);
   return [base,...['min','max'].map(edge=>({...base,
    ...Object.fromEntries(Object.entries(TUNABLES).map(([k,v])=>[k,v[edge]]))}))];
  });
  const errors=[],counts={};
  function signedVolume(geometry){
   const attr=geometry.getAttribute('position'),idx=geometry.index.array;
   let volume=0,invalid=0;
   const edgeMap=new Map();
   for(let i=0;i<idx.length;i+=3){
    const a=idx[i],b=idx[i+1],c=idx[i+2];
    const pa=[attr.getX(a),attr.getY(a),attr.getZ(a)],
      pb=[attr.getX(b),attr.getY(b),attr.getZ(b)],
      pc=[attr.getX(c),attr.getY(c),attr.getZ(c)];
    const u=pb.map((x,k)=>x-pa[k]),v=pc.map((x,k)=>x-pa[k]);
    const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
    if(Math.hypot(...n)<1e-8)invalid++;
    volume+=(pa[0]*(pb[1]*pc[2]-pb[2]*pc[1])+
      pa[1]*(pb[2]*pc[0]-pb[0]*pc[2])+pa[2]*(pb[0]*pc[1]-pb[1]*pc[0]))/6;
    for(const [x,y] of [[a,b],[b,c],[c,a]]){
     const key=Math.min(x,y)+':'+Math.max(x,y);
     edgeMap.set(key,(edgeMap.get(key)||0)+1);
    }
   }
   return {volume,invalid,openEdges:[...edgeMap.values()].filter(n=>n!==2).length};
  }
  for(const config of cases){
   const base=createSilhouetteMachine(config,{tier:0});
   const exposed=new Map();
   base.root.traverse(obj=>{
    if(obj.isMesh&&!obj.userData?.armorZone)
     exposed.set(obj.name,JSON.stringify(Array.from(obj.geometry.getAttribute('position').array)));
   });
   for(const tier of [0,1,2,3]){
    for(const style of tier===3?['box','taper']:['box']){
     const built=createSilhouetteMachine(config,{tier,style,bootPlate:true});
     const armored=[],unmodified=[];
     built.root.traverse(obj=>{
      if(!obj.isMesh)return;
      if(obj.userData?.armorZone){
       armored.push(obj);
       if(!obj.parent?.isMesh)errors.push('Armor parent is not moving link '+obj.name);
       const meshStats=signedVolume(obj.geometry);
       if(meshStats.invalid||meshStats.openEdges||meshStats.volume<=1e-6)
        errors.push('Bad armor geometry '+config.id+' '+tier+' '+style+' '+obj.name+' '+JSON.stringify(meshStats));
      }else{
       if(exposed.get(obj.name)!==JSON.stringify(Array.from(obj.geometry.getAttribute('position').array)))
        unmodified.push(obj.name);
      }
     });
     if(unmodified.length)errors.push('Naked geometry changed: '+unmodified.join(','));
     const expected=([0,4,8,8])[tier];
     if(armored.length!==expected)errors.push(config.id+' kit '+tier+' '+style+' parts '+armored.length+' expected '+expected);
     counts[config.id+'/'+tier+'/'+style]=(counts[config.id+'/'+tier+'/'+style]||0)+1;
     built.root.traverse(obj=>{if(obj.isMesh)obj.geometry.dispose();});
    }
   }
   base.root.traverse(obj=>{if(obj.isMesh)obj.geometry.dispose();});
  }
  const bootOff=createSilhouetteMachine(cases[0],{tier:3,bootPlate:false});
  let count=0;bootOff.root.traverse(o=>{if(o.userData?.armorZone)count++;});
  if(count!==6)errors.push('Encased with no boot plates should contain 6 plates, got '+count);
  bootOff.root.traverse(obj=>{if(obj.isMesh)obj.geometry.dispose();});
  return {cases:cases.length,levels:ARMOR_LEVELS.length,variants:Object.keys(counts).length,errors:errors.slice(0,30)};
 });
 assert.equal(armorAudit.errors.length,0,armorAudit.errors.join('\n'));
 let before=await page.evaluate(()=>window.__yardwalkerSilhouetteLab.inspect());
 assert.equal(before.focus,false);
 assert.equal(before.fullRig,true);
 assert.equal(before.candidates.length,3);
 assert.equal(before.candidates[0].id,'strider');
 await snapshot('01-full-mech-compare-quarter.png');
 await page.locator('#legs-only').click();
 await snapshot('20-naked-legs-only-quarter.png');
 await page.locator('#full-rig').click();
 // A consistent tier across all three models makes whole-silhouette progression
 // judgeable, without conflating armor with base mechanical redesigns.
 for(const [level,label] of [[1,'light'],[2,'heavy'],[3,'encased-box']]){
  await page.locator('[data-armor-tier="'+level+'"]').click();
  const st=await page.evaluate(()=>window.__yardwalkerSilhouetteLab.inspect());
  assert.equal(st.armorTier,level);
  assert.ok(Object.values(st.armorPieces).every(n=>n===([0,4,8,8])[level]));
  await snapshot('12-'+label+'-three-up-quarter.png');
  // Inspect the kit itself, not just its appearance under the full mech.
  await page.locator('#legs-only').click();
  await snapshot('18-'+label+'-legs-only-three-up.png');
  if(level>=2){
   await page.locator('#focus').click();
   await page.locator('#choose-bruiser').click();
   await snapshot('19-'+label+'-bruiser-close-up.png');
   await page.locator('#compare').click();
  }
  await page.locator('#full-rig').click();
  if(level===2){await page.locator('[data-view="side"]').click();
   await snapshot('13-heavy-three-up-side.png');
   await page.locator('[data-view="quarter"]').click();}
 }
 await page.locator('#encased-style').selectOption('taper');
 assert.equal((await page.evaluate(()=>window.__yardwalkerSilhouetteLab.inspect())).armorStyle,'taper');
 await snapshot('14-encased-taper-quarter.png');
 await page.locator('#boot-plate').uncheck();
 assert.ok(Object.values((await page.evaluate(()=>window.__yardwalkerSilhouetteLab.inspect())).armorPieces).every(n=>n===6));
 await snapshot('15-encased-no-boot-plate.png');
 await page.locator('#boot-plate').check();
 await page.locator('[data-armor-tier="0"]').click();
 assert.equal((await page.evaluate(()=>window.__yardwalkerSilhouetteLab.inspect())).armorTier,0);
 await page.locator('[data-view="front"]').click();await snapshot('02-full-mech-compare-front.png');
 await page.locator('[data-view="side"]').click();await snapshot('03-full-mech-compare-side.png');
 await page.locator('#arena').click();await snapshot('04-full-mech-arena-distance.png');
 await page.locator('#garage').click();
 await page.locator('#silhouette').click();await snapshot('05-black-silhouette.png');
 await page.locator('#silhouette').click();
 await page.locator('#choose-bruiser').click();
 const a=await page.evaluate(()=>window.__yardwalkerSilhouetteLab.inspect());
 await page.locator('#thighMass').evaluate(el=>{el.value='.59';el.dispatchEvent(new Event('input',{bubbles:true}));});
 const b=await page.evaluate(()=>window.__yardwalkerSilhouetteLab.inspect());
 assert.equal(b.selected,'bruiser');
 assert.equal(b.candidates[1].thighMass,.59);
 assert.equal(a.candidates[0].thighMass,b.candidates[0].thighMass);
 assert.equal(a.candidates[2].thighMass,b.candidates[2].thighMass);
 await snapshot('06-bruiser-edited-thigh-width.png');
 await page.locator('#reset-study').click();
 const reset=await page.evaluate(()=>window.__yardwalkerSilhouetteLab.inspect());
 assert.equal(reset.candidates[1].thighMass,a.candidates[1].thighMass);
 await page.locator('#legs-only').click();await snapshot('07-legs-only-three-candidates.png');
 await page.locator('#full-rig').click();
 await page.locator('#focus').click();
 assert.equal((await page.evaluate(()=>window.__yardwalkerSilhouetteLab.inspect())).focus,true);
 await snapshot('08-focus-bruiser.png');
 assert.equal(diagnostics.length,0,diagnostics.join('\n'));
 await page.close();
 await open({width:390,height:844},true);
 const p=await page.evaluate(()=>window.__yardwalkerSilhouetteLab.inspect());
 assert.equal(p.focus,true,'phone should focus one candidate by default');
 await snapshot('09-mobile-portrait-strider.png');
 await page.locator('[data-armor-tier="2"]').click();
 await snapshot('16-mobile-heavy-kit.png');
 await page.locator('[data-armor-tier="3"]').click();
 await page.locator('#encased-style').selectOption('taper');
 await snapshot('17-mobile-encased-taper.png');
 await page.locator('[data-armor-tier="0"]').click();
 await page.locator('#choose-hound').click();
 await page.locator('[data-view="side"]').click();
 await snapshot('10-mobile-portrait-hound-side.png');
 const mobile=await page.evaluate(()=>{
  const r=document.getElementById('stage').getBoundingClientRect();
  const s=document.getElementById('scene').getBoundingClientRect();
  return {stage:r.width,canvas:s.width,viewport:window.innerWidth,
   sliders:[...document.querySelectorAll('#sliders input')].every(e=>e.getBoundingClientRect().width>30)};
 });
 assert.equal(mobile.stage,mobile.canvas);
 assert.ok(mobile.stage<=mobile.viewport+1);
 assert.ok(mobile.sliders);
 await page.locator('#compare').click();
 await snapshot('11-mobile-compare-three.png');
 const q=await page.evaluate(()=>window.__yardwalkerSilhouetteLab.inspect());
 assert.equal(q.focus,false);
 assert.equal(diagnostics.length,0,diagnostics.join('\n'));
 writeFileSync(out+'/acceptance.json',JSON.stringify({desktop:before,edited:b,mobile:q,livePromotion,geometryAudit,armorAudit,diagnostics},null,2));
 console.log('YARDWALKER SILHOUETTE LAB BROWSER PASS');
}finally{await browser.close();}
