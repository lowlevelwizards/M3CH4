/** Headless REAL Three.js before/after raster and structure audit.
 * Pass two locally served origins: baseline checkout, updated checkout.
 */
import {chromium} from 'playwright';
import {mkdirSync,writeFileSync} from 'node:fs';
const out='k4a-comparison-artifacts';mkdirSync(out,{recursive:true});
const [beforeUrl='http://127.0.0.1:8766',afterUrl='http://127.0.0.1:8765']=process.argv.slice(2);
const browser=await chromium.launch({headless:true,
 args:['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});
const errors=[];
async function open(port,category='frames',view='quarter',mini=false){
 const page=await browser.newPage({viewport:{width:1300,height:580},deviceScaleFactor:1});
 page.on('pageerror',e=>errors.push(port+' '+e.message));
 await page.goto(port+'/color-material-gallery.html?category='+category+'&view='+view+(mini?'&mini=1':''),
  {waitUntil:'domcontentloaded',timeout:60000});
 await page.waitForFunction(()=>window.__k4aGalleryRendered===true,undefined,{timeout:35000});
 return page;
}
async function fingerprint(origin){
 const p=await open(origin);
 const result=await p.evaluate(async()=>{
  const {buildPartVisual}=await import('./partVisuals.js');
  const {buildExteriorRig}=await import('./scene.js');
  const {makeTestAssembly,equip}=await import('./components.js');
  const ids=['frame-sr','frame-utility','frame-wedge',
    'gun-cannon','gun-short','gun-light','gun-scatter',
    'cab-cyclops','cab-utility','cab-armored',
    'power-dynamo','power-air','legs-yard','legs-compact','legs-hauler'];
  const out={};
  const hash=a=>{let h=2166136261;for(let i=0;i<a.length;i++){
   h=Math.imul(h^Math.round(a[i]*1e6),16777619);
  }return h>>>0;};
  const powerRoot=id=>{
   const a=makeTestAssembly();equip(a,'power',id);
   return buildExteriorRig(a).partGroups.get('power');
  };
  for(const id of ids){
   const root=id.startsWith('power-')?powerRoot(id):buildPartVisual(id);
   const hierarchy=[],materials=[];
   root.traverse(n=>{
    const path=[];let child=n;
    while(child&&child!==root){path.unshift(child.parent.children.indexOf(child)+':'+child.name);
     child=child.parent;}
    const entry={path:path.join('/'),name:n.name,type:n.type,
     position:n.position.toArray(),quaternion:n.quaternion.toArray(),scale:n.scale.toArray()};
    if(n.isMesh){
     entry.attributes=Object.fromEntries(Object.entries(n.geometry.attributes).map(([name,a])=>
      [name,{count:a.count,itemSize:a.itemSize,hash:hash(a.array)}]));
     entry.index=n.geometry.index?{count:n.geometry.index.count,hash:hash(n.geometry.index.array)}:null;
     const mats=Array.isArray(n.material)?n.material:[n.material];
     materials.push(...mats.map(m=>({name:n.name,role:n.userData.materialRole||null,
      color:m.color?.getHex()??null,metalness:m.metalness,roughness:m.roughness,
      roleFromMaterial:m.userData?.materialRole||null})));
    }
    hierarchy.push(entry);
   });
   out[id]={hierarchy,materials};
  }
  return out;
 });
 await p.close();return result;
}
try{
 const [baseline,updated]=await Promise.all([fingerprint(beforeUrl),fingerprint(afterUrl)]);
 const findings={geometryUnchanged:[],mobilityUnchanged:[],recolored:[],roles:[],isolation:true};
 for(const [id,old] of Object.entries(baseline)){
  const fresh=updated[id];
  if(JSON.stringify(old.hierarchy)!==JSON.stringify(fresh.hierarchy))
    throw Error('Geometry/hierarchy/transforms changed for '+id);
  findings.geometryUnchanged.push(id);
  if(id.startsWith('legs-')){
   if(JSON.stringify(old.materials)!==JSON.stringify(fresh.materials))
    throw Error('MOBILITY MATERIALS CHANGED '+id);
   findings.mobilityUnchanged.push(id);
  }else{
   if(JSON.stringify(old.materials)===JSON.stringify(fresh.materials))
    throw Error('No meaningful authored surface changes for '+id);
   const bare=fresh.materials.filter(m=>!m.role);
   if(bare.length)throw Error('Unclassified surface '+id+': '+bare.map(m=>m.name));
   for(const m of fresh.materials){
    if(m.role!==m.roleFromMaterial)throw Error('Material/mesh role disagreement '+id+'/'+m.name);
    if(!Number.isFinite(m.roughness)||m.roughness<0||m.roughness>1||
       !Number.isFinite(m.metalness)||m.metalness<0||m.metalness>1)
      throw Error('Invalid PBR '+id+'/'+m.name);
   }
   findings.recolored.push(id);
   findings.roles.push({id,counts:fresh.materials.reduce((a,m)=>
    (a[m.role]=(a[m.role]||0)+1,a),{})});
  }
 }
 // Independent gameplay materials, and preview versus game isolation.
 const inspect=await open(afterUrl);
 const ownership=await inspect.evaluate(async()=>{
  const {buildPartVisual}=await import('./partVisuals.js');
  const {buildExteriorRig}=await import('./scene.js');
  const {makeTestAssembly,equip}=await import('./components.js');
  for(const id of ['frame-sr','frame-utility','frame-wedge',
   'gun-cannon','gun-short','gun-light','gun-scatter','cab-cyclops','cab-utility','cab-armored']){
    const a=buildPartVisual(id,{mode:'gameplay'}),b=buildPartVisual(id,{mode:'gameplay'});
    const p=buildPartVisual(id,{mode:'preview'});
    let ma,mb,mp;
    a.traverse(n=>{if(n.isMesh&&!ma)ma=n.material;});
    b.traverse(n=>{if(n.isMesh&&!mb)mb=n.material;});
    p.traverse(n=>{if(n.isMesh&&!mp)mp=n.material;});
    if(!ma||ma===mb||ma===mp)throw Error('Shared game material for '+id);
    const original=mb.color.getHex(),preview=mp.color.getHex();
    ma.color.multiplyScalar(.12);
    if(mb.color.getHex()!==original||mp.color.getHex()!==preview)
     throw Error('Cross-instance tint leak '+id);
  }
  for(const id of ['power-dynamo','power-air']){
   const a=makeTestAssembly(),b=makeTestAssembly();equip(a,'power',id);equip(b,'power',id);
   const ra=buildExteriorRig(a).partMeshes.get('power'),rb=buildExteriorRig(b).partMeshes.get('power');
   if(ra.length!==rb.length||!ra.length)throw Error('Generator mesh count mismatch '+id);
   for(let j=0;j<ra.length;j++){
    if(ra[j].material===rb[j].material)throw Error('Generator shared material '+id);
   }
   const c=rb[0].material.color.getHex();
   ra[0].material.color.multiplyScalar(.11);
   if(rb[0].material.color.getHex()!==c)throw Error('Generator damage leak '+id);
  }
  return true;
 });
 await inspect.close();
 findings.isolation=ownership;
 writeFileSync(out+'/structure-and-surface-audit.json',JSON.stringify(findings,null,2));
 for(const cat of ['frames','weapons','cabs','power','assembled']){
  for(const view of ['quarter','front','side']){
   const [before,after]=await Promise.all([open(beforeUrl,cat,view),open(afterUrl,cat,view)]);
   const [left,right]=await Promise.all([
    before.locator('#stage').screenshot(),after.locator('#stage').screenshot()]);
   const label=cat+'-'+view;
   writeFileSync(out+'/'+label+'-before.png',left);
   writeFileSync(out+'/'+label+'-after.png',right);
   const pair=await browser.newPage({viewport:{width:2600,height:520},deviceScaleFactor:1});
   await pair.setContent('<style>body{margin:0;background:#101713;color:#f2dfb4;font:700 17px system-ui}main{display:flex}article{width:1300px}header{height:30px;padding:5px 12px;background:#28342b;box-sizing:border-box}img{width:1300px;height:475px;display:block}</style><main><article><header>BEFORE · MAIN</header><img src="data:image/png;base64,'+left.toString('base64')+'"></article><article><header>AFTER · k.4a</header><img src="data:image/png;base64,'+right.toString('base64')+'"></article></main>');
   await pair.screenshot({path:out+'/'+label+'-comparison.png'});
   await pair.close();await before.close();await after.close();
  }
  const [before,after]=await Promise.all([open(beforeUrl,cat,'quarter',true),open(afterUrl,cat,'quarter',true)]);
  const [left,right]=await Promise.all([before.locator('#stage').screenshot(),after.locator('#stage').screenshot()]);
  const mini=await browser.newPage({viewport:{width:2600,height:180},deviceScaleFactor:1});
  await mini.setContent('<style>body{margin:0;background:#18221e}main{display:flex}img{width:1300px;height:136px}</style><main><img src="data:image/png;base64,'+left.toString('base64')+'"><img src="data:image/png;base64,'+right.toString('base64')+'"></main>');
  await mini.screenshot({path:out+'/'+cat+'-mobile-comparison.png'});
  await mini.close();await before.close();await after.close();
 }
 if(errors.length)throw Error('Browser page errors: '+errors.join('\n'));
 console.log('K4A MATERIAL AUDIT PASS:',findings.geometryUnchanged.length,
  'unchanged geometric families, 3 untouched mobility palettes, 12 recolored, no game material leaks.');
}finally{await browser.close();}
