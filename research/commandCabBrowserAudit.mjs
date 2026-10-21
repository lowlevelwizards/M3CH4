/** k.3y real Chromium model audit and reproducible camera comparisons. */
import {chromium} from 'playwright';
import {mkdirSync,writeFileSync} from 'node:fs';
const out='command-cab-artifacts';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({
    headless:true,args:['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader'],
});
const errors=[];
const page=await browser.newPage({viewport:{width:1180,height:790},deviceScaleFactor:1});
page.on('pageerror',e=>errors.push(String(e.stack||e.message)));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
    await page.goto('http://127.0.0.1:8765/cab-anatomy.html',
        {waitUntil:'domcontentloaded',timeout:60000});
    await page.waitForFunction(()=>window.__m3ch4CommandAuditReady===true,
        undefined,{timeout:30000});
    for(const view of ['quarter','front','side','top']){
        await page.locator('[data-view="'+view+'"]').click();
        await page.waitForTimeout(120);
        await page.screenshot({path:out+'/'+view+'.png'});
    }
    await page.locator('#gray').check();
    await page.waitForTimeout(120);
    await page.screenshot({path:out+'/gray-top.png'});
    await page.locator('[data-view="front"]').click();
    await page.waitForTimeout(120);
    await page.screenshot({path:out+'/gray-front.png'});
    await page.locator('#gray').uncheck();
    await page.locator('#explode').check();
    await page.waitForTimeout(120);
    await page.screenshot({path:out+'/exploded-front.png'});
    const results=await page.evaluate(async()=>{
        const THREE=await import('three');
        const {buildPartVisual}=await import('./partVisuals.js');
        const {makeTestAssembly,equip,inspectAssembly}=await import('./components.js');
        const {buildExteriorRig}=await import('./scene.js');
        const frames=['frame-sr','frame-utility','frame-wedge'];
        const cabs=['cab-cyclops','cab-utility','cab-armored'];
        const combinations=[];
        for(const frame of frames)for(const id of cabs){
            const assembly=makeTestAssembly();
            equip(assembly,'structure',frame);equip(assembly,'command',id);
            if(!inspectAssembly(assembly).ready)
                throw Error('Illegal fixture '+frame+'/'+id);
            const rig=buildExteriorRig(assembly);
            rig.root.updateMatrixWorld(true);
            const meshes=rig.partMeshes.get('command')||[];
            if(meshes.length<9)throw Error('Command geometry missing: '+frame+'/'+id);
            if(meshes.some(m=>m.userData.slot!=='command'||!rig.pickMeshes.includes(m)))
                throw Error('Command hit ownership missing: '+frame+'/'+id);
            const def=assembly.owned.find(p=>p.serial===assembly.installed.command).definitionId;
            if(def!==id)throw Error('Wrong serialized command '+id);
            const rays=[
                new THREE.Raycaster(new THREE.Vector3(0,2.43,-5),
                    new THREE.Vector3(0,0,1),0,9),
                new THREE.Raycaster(new THREE.Vector3(5,2.43,-.36),
                    new THREE.Vector3(-1,0,0),0,9),
                new THREE.Raycaster(new THREE.Vector3(0,7,-1.6),
                    new THREE.Vector3(0,-4.57,1.24).normalize(),0,9),
            ];
            const hits=rays.map(ray=>ray.intersectObjects(meshes,false).length);
            if(hits[0]===0||hits[1]===0||hits[2]===0)
                throw Error('Missing front/side/elevated command intersection '+frame+'/'+id+': '+hits);
            const bbox=new THREE.Box3().setFromObject(rig.partGroups.get('command'),true);
            const frameBox=new THREE.Box3().setFromObject(rig.partGroups.get('structure'),true);
            const overlap=bbox.clone().intersect(frameBox),intersects=!overlap.isEmpty();
            combinations.push({frame,command:id,meshes:meshes.length,rayHits:hits,
                commandWorldBounds:{min:bbox.min.toArray(),max:bbox.max.toArray()},
                envelopeAabbOverlapsFrame:intersects});
            rig.root.traverse(n=>{if(n.geometry?.dispose)n.geometry.dispose();});
        }
        for(const id of cabs){
            const a=buildPartVisual(id,{mode:'gameplay'});
            const b=buildPartVisual(id,{mode:'gameplay'});
            let ma=null,mb=null;
            a.traverse(o=>{if(!ma&&o.isMesh)ma=o.material;});
            b.traverse(o=>{if(!mb&&o.isMesh)mb=o.material;});
            if(ma===mb||!ma||!mb)throw Error('Command materials not isolated '+id);
            const original=mb.color.getHex();
            ma.color.multiplyScalar(.1);
            if(mb.color.getHex()!==original)throw Error('Cross-machine tint leak '+id);
        }
        return combinations;
    });
    writeFileSync(out+'/measured-nine-combinations.json',JSON.stringify(results,null,2));
    console.log('Nine chassis/cab combinations raycast verified:',results.length);
    console.log(JSON.stringify(results));
    if(errors.length)throw Error('Browser console exceptions: '+errors.join('\n'));
}finally{
    await browser.close();
}
