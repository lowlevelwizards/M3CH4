/** Browser-wide production importer audit, plus touch editor acceptance. */
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
mkdirSync('workbench-factory-artifacts',{recursive:true});
const browser=await chromium.launch({headless:true,args:[
 '--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader'
]});
const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2,
 isMobile:true,hasTouch:true});
const errors=[];
page.on('pageerror',e=>errors.push(String(e.stack||e.message)));
try{
 await page.goto('http://127.0.0.1:8765/part-workbench-v2.html',
  {waitUntil:'domcontentloaded',timeout:60000});
 await page.waitForFunction(()=>window.__m3ch4WorkbenchV2Ready===true,
  undefined,{timeout:60000});
 // Actually exercise EVERY current game catalogue definition, not a hand-built fake.
 const audit=await page.evaluate(async()=>{
  const {CATALOG}=await import('./components.js');
  const {importFactoryPart,importFactoryAssembly}=await import('./workbench/factoryImport.js');
  const {compileBlueprint,disposeBlueprint}=await import('./workbench/geometry.js');
  const results=[];
  for(const part of CATALOG){
   try{
    const imported=importFactoryPart(part.id);
    const doc=imported.document;
    const original=doc.nodes.filter(n=>n.kind==='shape');
    if(!original.length)throw Error('No editable geometry');
    if(doc.metadata.source.definitionId!==part.id)throw Error('Lost factory identity');
    if(!original.every(n=>n.geometry.type==='mesh'))throw Error('Fake primitive');
    const compiled=compileBlueprint(doc);disposeBlueprint(compiled.root);
    results.push({id:part.id,meshes:imported.meshCount,groups:imported.groupCount,ok:true});
   }catch(e){results.push({id:part.id,ok:false,error:e.message});}
  }
  for(const kind of ['default','yard']){
   try{
    const a=importFactoryAssembly(kind);
    if(a.meshCount<10)throw Error('Full game rig incomplete');
    results.push({id:'assembly-'+kind,meshes:a.meshCount,groups:a.groupCount,ok:true});
   }catch(e){results.push({id:'assembly-'+kind,ok:false,error:e.message});}
  }
  return results;
 });
 console.log('FACTORY AUDIT',JSON.stringify(audit));
 const failed=audit.filter(x=>!x.ok);
 assert.equal(failed.length,0,'All factory parts and complete rigs must import: '+JSON.stringify(failed));
 await page.locator('#factory-part-select').selectOption('legs-yard');
 await page.locator('#open-factory-part').click();
 await page.waitForFunction(()=>document.querySelector('#status')?.textContent?.includes('authentic game meshes'),
   undefined,{timeout:10000});
 assert.ok(await page.locator('#object-tree .tree-item').count()>15,'Real hierarchy visible');
 await page.locator('#object-tree .tree-item[data-kind="shape"]').first().click();
 await page.screenshot({path:'workbench-factory-artifacts/01-imported-yardwalker.png'});
 await page.locator('[data-view="front"]').click();
 await page.locator('[data-tool="points"]').click();
 await page.locator('#mesh-point-panel').waitFor({state:'visible',timeout:9000});
 const controls=await page.locator('#mesh-point-select option').count();
 assert.ok(controls>=3,'Factory mesh exposes vertex groups');
 const inputs=page.locator('#mesh-point-coordinates input');
 const before=await inputs.first().inputValue();
 await inputs.first().fill((Number(before)+.025).toFixed(3));
 await inputs.first().dispatchEvent('change');
 assert.match(await page.locator('#status').textContent(),/Edited original game mesh point/);
 await page.screenshot({path:'workbench-factory-artifacts/02-factory-vertices.png'});
 page.once('dialog',dialog=>dialog.accept('Yardwalker derived variant'));
 await page.locator('#save-part').click();
 await page.waitForFunction(()=>document.querySelectorAll('#library-items .asset-item').length>0,
   undefined,{timeout:8000});
 await page.locator('#open-factory-rig').click();
 await page.waitForFunction(()=>document.querySelector('#status')?.textContent?.includes('authentic editable'),
   undefined,{timeout:10000});
 assert.ok(await page.locator('#object-tree .tree-item').count()>30,'Whole rig hierarchy retained');
 await page.screenshot({path:'workbench-factory-artifacts/03-full-game-mech.png'});
 if(errors.length)throw Error('Browser errors: '+errors.join('\n'));
 console.log('FACTORY IMPORT PASS: all catalogue parts, factory & yard rigs, point edits, reuse');
}finally{await browser.close();}
