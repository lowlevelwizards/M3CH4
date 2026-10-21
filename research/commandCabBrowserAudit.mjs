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
    const shielding=await page.evaluate(async()=>{
        const THREE=await import('three');
        const {makeTestAssembly,equip}=await import('./components.js');
        const {buildExteriorRig}=await import('./scene.js');
        const {shieldedModuleOnRay}=await import('./frameShielding.js');
        const offsets=[-.4,0,.4], report={};
        for(const frame of ['frame-sr','frame-utility','frame-wedge']){
            const a=makeTestAssembly();equip(a,'structure',frame);
            const rig=buildExteriorRig(a);
            rig.pickMeshes.forEach(m=>m.userData.actorId='audit');
            rig.root.updateWorldMatrix(true,true);
            const bounds=new THREE.Box3().setFromObject(rig.partGroups.get('command'));
            const center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3());
            const samples=[];
            for(const u of offsets)for(const v of offsets){
                const aim=center.clone().add(new THREE.Vector3(u*size.x,v*size.y,0));
                const source=aim.clone().add(new THREE.Vector3(0,0,-12));
                const ray=new THREE.Raycaster(source,aim.clone().sub(source).normalize(),0,25);
                const hits=ray.intersectObjects(rig.pickMeshes,false), first=hits[0];
                samples.push({u,v,aim:aim.toArray(),first:first?.object.userData.slot||'miss',
                    shielded:shieldedModuleOnRay(hits,first)||null,
                    firstName:first?.object.name||null,
                    hits:hits.slice(0,5).map(h=>({slot:h.object.userData.slot,name:h.object.name,d:h.distance}))});
            }
            report[frame]=samples;
            rig.root.traverse(n=>n.geometry?.dispose?.());
        }
        return report;
    });
    writeFileSync(out+'/frame-to-cab-ray-samples.json',JSON.stringify(shielding,null,2));
    console.log('Measured default Cyclops front shielding:',JSON.stringify(shielding));
    writeFileSync(out+'/measured-nine-combinations.json',JSON.stringify(results,null,2));
    console.log('Nine chassis/cab combinations raycast verified:',results.length);
    console.log(JSON.stringify(results));
    if(errors.length)throw Error('Browser console exceptions: '+errors.join('\n'));
}finally{
    await browser.close();
}
