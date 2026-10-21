/** k.3z real Chromium screenshot and mesh/raycast audit. Run with a local HTTP server
 * on port 8765 and playwright + Chromium installed (see k3z workflow).
 */
import {chromium} from 'playwright';
import {mkdirSync,writeFileSync} from 'node:fs';
const out='frame-anatomy-artifacts';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true,
    args:['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});
const errors=[];
const page=await browser.newPage({viewport:{width:1250,height:780},deviceScaleFactor:1});
page.on('pageerror',e=>errors.push(String(e.stack||e.message)));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
try{
    await page.goto('http://127.0.0.1:8765/frame-anatomy.html',
        {waitUntil:'domcontentloaded',timeout:60000});
    await page.waitForFunction(()=>window.__m3ch4FrameAuditReady===true,undefined,{timeout:45000});
    for(const view of ['quarter','front','side','top']){
        await page.locator('[data-view="'+view+'"]').click();
        await page.waitForTimeout(220);
        await page.screenshot({path:out+'/bare-'+view+'.png'});
    }
    await page.locator('#gray').check();
    await page.waitForTimeout(160);
    await page.screenshot({path:out+'/bare-gray-top.png'});
    await page.locator('[data-view="front"]').click();
    await page.waitForTimeout(160);
    await page.screenshot({path:out+'/bare-gray-front.png'});
    await page.locator('#gray').uncheck();
    await page.locator('[data-view="quarter"]').click();
    await page.locator('[data-mode="assembled"]').click();
    await page.waitForTimeout(220);
    await page.screenshot({path:out+'/assembled-matched.png'});
    await page.locator('[data-mode="matrix"]').click();
    await page.waitForTimeout(240);
    await page.screenshot({path:out+'/assembled-nine-mobility.png',fullPage:true});
    const measurements=await page.evaluate(async()=>{
        const THREE=await import('three');
        const {buildPartVisual}=await import('./partVisuals.js');
        const {buildExteriorRig}=await import('./scene.js');
        const {makeTestAssembly,equip,inspectAssembly,BY_ID}=await import('./components.js');
        const ids=['frame-sr','frame-utility','frame-wedge'];
        const legs=['legs-yard','legs-compact','legs-hauler'];
        const cabs=['cab-cyclops','cab-utility','cab-armored'];
        const rays=new THREE.Raycaster();
        const records=[];
        for(const id of ids){
            const fixture=BY_ID.get(id);
            const fresh=buildPartVisual(id),copy=buildPartVisual(id);
            const materialsA=[],materialsB=[];
            fresh.traverse(n=>{if(n.isMesh)materialsA.push(n.material);});
            copy.traverse(n=>{if(n.isMesh)materialsB.push(n.material);});
            if(materialsA.length<15||materialsA.some((m,i)=>m===materialsB[i]))
                throw Error('Missing/isolation failure in authored '+id);
            const named=[];
            fresh.updateMatrixWorld(true);
            fresh.traverse(n=>{
                if(!n.isMesh)return;
                const a=n.geometry.getAttribute('position');
                if(!a||a.count===0||[...n.position.toArray(),...n.scale.toArray(),
                    ...n.quaternion.toArray()].some(v=>!Number.isFinite(v)))
                    throw Error('Invalid frame mesh '+id+'/'+n.name);
                const bound=new THREE.Box3().setFromObject(n,true);
                if(bound.isEmpty())throw Error('Degenerate '+id+'/'+n.name);
                named.push(n.name);
                // Every custom shell triangle edge is paired, i.e., actually closed.
                if(n.name.includes('shell')||n.name.includes('nose')||n.name.includes('cheek')){
                    const edgeCounts=new Map(),pos=n.geometry.getAttribute('position');
                    const ix=n.geometry.index;
                    const q=i=>[0,1,2].map(j=>pos.getComponent(i,j).toFixed(5)).join(',');
                    for(let j=0;j<(ix?ix.count:pos.count);j+=3){
                        const tri=[0,1,2].map(k=>q(ix?ix.getX(j+k):j+k));
                        for(let k=0;k<3;k++){
                            const e=[tri[k],tri[(k+1)%3]].sort().join('|');
                            edgeCounts.set(e,(edgeCounts.get(e)||0)+1);
                        }
                    }
                    if([...edgeCounts.values()].some(v=>v!==2))
                        throw Error('Open faceted shell '+id+'/'+n.name);
                }
            });
            if(id==='frame-utility'&&named.some(n=>n.includes('welded core')||n.includes('monocoque')))
                throw Error('Skeleton has fake solid core');
            const bound=new THREE.Box3().setFromObject(fresh,true);
            // Genuine void: a center-front ray passes between the Skeleton upper and lower rails.
            rays.set(new THREE.Vector3(0,0,-6),new THREE.Vector3(0,0,1));
            rays.far=12;
            const first=rays.intersectObjects(fresh.children,true).filter(h=>h.object.isMesh);
            if(id==='frame-utility'&&first.length!==0)
                throw Error('Skeleton forward central opening is blocked: '+first[0].object.name);
            if(id!=='frame-utility'&&first.length===0)
                throw Error('Solid Bruiser/Wedge center has no front intersection '+id);
            const combinations=[];
            for(const leg of legs){
                const a=makeTestAssembly();
                equip(a,'structure',id);equip(a,'mobility',leg);
                const verdict=inspectAssembly(a);
                const rig=buildExteriorRig(a);
                rig.root.updateMatrixWorld(true);
                const owned=rig.partMeshes.get('structure');
                if(!owned?.length||owned.some(m=>m.userData.slot!=='structure'||
                    !rig.pickMeshes.includes(m)))throw Error('Frame pick ownership wrong '+id+'/'+leg);
                const legBounds=new THREE.Box3().setFromObject(rig.partGroups.get('mobility'));
                const frameBounds=new THREE.Box3().setFromObject(rig.partGroups.get('structure'));
                combinations.push({leg,deployable:verdict.ready,
                    overlapDepth:legBounds.clone().intersect(frameBounds).getSize(new THREE.Vector3()).toArray(),
                    frameBounds:{min:frameBounds.min.toArray(),max:frameBounds.max.toArray()},
                    mobilityBounds:{min:legBounds.min.toArray(),max:legBounds.max.toArray()}});
                if(legBounds.isEmpty()||frameBounds.isEmpty())throw Error('Absent mounted geometry');
            }
            for(const cab of cabs){
                const a=makeTestAssembly();equip(a,'structure',id);equip(a,'command',cab);
                if(!inspectAssembly(a).ready)throw Error('Cab not deployable '+id+'/'+cab);
                const rig=buildExteriorRig(a);
                if(!(rig.partMeshes.get('command')||[]).length)
                    throw Error('Command lost in rig '+id+'/'+cab);
            }
            records.push({id,bodyMass:fixture.massKg,meshCount:materialsA.length,
                bounds:{min:bound.min.toArray(),max:bound.max.toArray()},
                named,socketPoints:fixture.sockets.map(s=>({id:s.id,position:s.position})),
                frontCenterFirst:first[0]?.object.name||'void',combinations});
        }
        return records;
    });
    writeFileSync(out+'/geometry-and-nine-assembly-audit.json',JSON.stringify(measurements,null,2));
    console.log('Three real frame kits, nine mobility combinations, nine cab combinations audited.');
    if(errors.length)throw Error('Browser startup/console errors: '+errors.join('\n'));
}finally{await browser.close();}
