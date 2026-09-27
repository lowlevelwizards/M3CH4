/** k.3a.6 — On-demand, ONE WebGL context, nine independent combinations.
 * Static 3x3 comparison and focused issue inspection; no live game imports.
 * Preview rest pose only; actual locomotion, damage, saves unchanged.
 */
import * as THREE from 'three';
import { CONCEPT_CHASSIS } from './chassisConcepts.js';
import { buildConceptChassis } from './chassisConceptBuilder.js';
import { buildFitFixture } from './chassisFitVisuals.js';
import { buildYardwalkerGuideVisuals } from './yardwalkerVisual.js';
import { buildKestrelGuideVisuals } from './kestrelVisual.js';
import { buildHaulerGuideVisuals } from './haulerVisual.js';
import { buildNineCombinationAudit, auditTextReport } from './chassisAudit.js?v=k3a6';

const stage=document.getElementById('stage');
const canvas=document.getElementById('audit-canvas');
const matrix=document.getElementById('matrix');
const focusControls=document.getElementById('focus-controls');
const focusName=document.getElementById('focus-name');
const selectionTitle=document.getElementById('selection-title');
const selectionStatus=document.getElementById('selection-status');
const metrics=document.getElementById('metrics');
const findings=document.getElementById('findings');
const hideEquipment=document.getElementById('hide-equipment');
const copyStatus=document.getElementById('copy-status');
const renderer=new THREE.WebGLRenderer({canvas,antialias:false,powerPreference:'low-power'});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.35));
renderer.setScissorTest(true);
renderer.outputColorSpace=THREE.SRGBColorSpace;
const scene=new THREE.Scene();
scene.add(new THREE.HemisphereLight(0xf4f2e8,0x46554b,2.3));
const keyLight=new THREE.DirectionalLight(0xffdfaf,2.5);keyLight.position.set(-4,7,-3);scene.add(keyLight);
const fillLight=new THREE.DirectionalLight(0xc0d6ca,1.0);fillLight.position.set(3,2,5);scene.add(fillLight);
const grid=new THREE.GridHelper(5.6,12,0x688777,0x35483d);
grid.position.y=-.015;scene.add(grid);
const guideBuilders=Object.freeze({
    'legs-yard':buildYardwalkerGuideVisuals,
    'legs-compact':buildKestrelGuideVisuals,
    'legs-hauler':buildHaulerGuideVisuals,
});
const cases=buildNineCombinationAudit();
const models=cases.map((study,i)=>{
    const root=new THREE.Group();root.name=study.key;
    const chassis=buildConceptChassis(study.frame);
    chassis.name=`chassis:${study.frameId}`;root.add(chassis);
    const gear=[];
    for(const component of study.fit.components){
        if(!component.pose)continue;
        const mesh=buildFitFixture(component.fixture,{mobilityModel:'engineered'});
        mesh.position.set(...component.pose.position);
        const [x,y,z]=component.pose.rotation.map(axis=>new THREE.Vector3(...axis));
        mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(x,y,z));
        root.add(mesh);gear.push({fixture:component.fixture,mesh});
    }
    if(study.fit.guidePlan?.ok){
        const make=guideBuilders[study.mobilityId];
        const guide=make(study.fit.guidePlan);
        guide.name='PROVISIONAL FRAME-SIDE GUIDE STUDY';
        root.add(guide);
    }
    root.position.y=study.metrics?.groundShiftY??0;
    root.visible=false;scene.add(root);
    return {study,root,chassis,gear};
});
let mode='grid',selectedIndex=0,view='quarter',focusHeight=5.0,highlight=null,queued=false;
const CAMERA_DIRECTIONS={
    quarter:[4.4,2.9,-5.2], front:[0,1.6,-7], side:[7,1.6,0], top:[0,7,-.01],
};
const mainCamera=new THREE.OrthographicCamera(-1,1,1,-1,.1,50);
const tileButtons=[];
const mobilityLabel=id=>id==='legs-yard'?'YARDWALKER':id==='legs-compact'?'KESTREL':'HAULER H2';
const frameLabel=id=>CONCEPT_CHASSIS.find(x=>x.id===id)?.family.toUpperCase().replaceAll('-',' ')??id;
const fmt=(m,precision=2)=>Number.isFinite(m)?m.toFixed(precision):'N/A';

for(let i=0;i<cases.length;i++){
    const study=cases[i];
    const button=document.createElement('button');
    button.className='case-tile';button.type='button';
    button.dataset.case=study.key;
    const number=document.createElement('span');number.textContent=frameLabel(study.frameId);
    const name=document.createElement('span');const title=document.createElement('b');title.textContent=mobilityLabel(study.mobilityId);name.append(title);
    const summary=document.createElement('small');summary.dataset.status=study.status;
    summary.textContent=study.fit.issues.some(x=>x.severity==='error')?'MOUNT BLOCKED':
        `${fmt(study.metrics?.chassisGroundClearanceM)} m CLEARANCE`;
    button.append(number,name,summary);
    button.setAttribute('aria-label',`${study.frame.name} with ${study.fixtures[0].name}. Open measured audit.`);
    button.addEventListener('click',()=>setSelection(i,true));
    matrix.append(button);tileButtons.push(button);
}

function fillMetric(label,value){
    const tile=document.createElement('div');tile.className='metric';
    const name=document.createElement('small');name.textContent=label;
    const amount=document.createElement('strong');amount.textContent=value;
    tile.append(name,amount);metrics.append(tile);
}
function clearHighlight(){
    if(!highlight)return;
    scene.remove(highlight);
    const materials=new Set();
    highlight.traverse(obj=>{obj.geometry?.dispose?.();if(obj.material)materials.add(obj.material);});
    // All highlight materials are private; chassis/fixture materials remain shared.
    for(const material of materials)material.dispose();
    highlight=null;
}
function highlightIssue(item){
    clearHighlight();
    const current=models[selectedIndex];
    const marker=new THREE.Group();marker.name='NON-PHYSICAL INSPECTION HIGHLIGHT';
    const material=new THREE.MeshBasicMaterial({color:0xffd373,depthTest:false,transparent:true,opacity:.90});
    marker.userData.material=material;
    let position=item.at;
    if(!position && item.socketId)position=current.study.frame.sockets.find(s=>s.id===item.socketId)?.position;
    if(!position && item.fixtureIds?.length)position=current.study.fit.poses.get(item.fixtureIds[0])?.position;
    if(!position)position=[0,0,0];
    let node=null;
    if(item.ref?.memberId)node=current.root.getObjectByName(item.ref.memberId,true);
    if(!node && item.message){
        const piece=current.study.frame.pieces.find(p=>item.message.includes(p.id));
        if(piece)node=current.chassis.getObjectByName(piece.id,true);
    }
    if(!node && item.socketId)node=current.chassis.getObjectByName(`empty-mount:${item.socketId}`,true);
    if(!node && item.fixtureIds?.length)node=current.gear.find(g=>g.fixture.id===item.fixtureIds[0])?.mesh;
    if(node){
        current.root.updateMatrixWorld(true);
        const outline=new THREE.BoxHelper(node,0xffd373);
        outline.material.depthTest=false;outline.material.transparent=true;outline.material.opacity=.9;
        outline.renderOrder=9;marker.add(outline);
    }
    const sphere=new THREE.Mesh(new THREE.SphereGeometry(.095,10,7),material);
    sphere.position.set(position[0],position[1]+(current.study.metrics?.groundShiftY??0),position[2]);
    sphere.renderOrder=10;marker.add(sphere);
    // Place the cursor at the actual member referenced by the pure proxy check.
    // Its sphere marker denotes review position rather than suggesting mesh collision certainty.
    scene.add(marker);highlight=marker;scheduleRender();
}
function issueButton(event,isFinding){
    const button=document.createElement('button');button.className=`issue ${event.level==='blocked'||event.severity==='error'?'blocked':''}`;
    button.type='button';button.textContent=isFinding?event.label:event.message;
    button.title='Highlight the implicated member or mounting face in focused view';
    button.addEventListener('click',()=>{
        if(mode!=='focus')setMode('focus');
        highlightIssue(event);
        button.focus();
    });
    return button;
}
function showSelected(){
    const study=cases[selectedIndex];
    const stats=study.metrics;
    selectionTitle.textContent=`${study.frame.name} / ${mobilityLabel(study.mobilityId)}`;
    selectionStatus.dataset.status=study.status;
    const mountingErrors=study.fit.issues.filter(x=>x.severity==='error').length;
    const toReview=study.fit.issues.filter(x=>x.severity==='review').length+study.findings.filter(x=>x.level==='review').length;
    selectionStatus.textContent=`${study.status.toUpperCase()} · ${mountingErrors} mounting errors · ${toReview} review flags · rest-pose measurements only`;
    metrics.replaceChildren();
    if(stats){
        fillMetric('Assembled height',`${fmt(stats.heightFromGroundM)} m`);
        fillMetric('Hip spacing',`${fmt(stats.stanceCentreSeparationM)} m`);
        fillMetric('Footprint W × D',`${fmt(stats.footprintWidthM)} × ${fmt(stats.footprintDepthM)} m`);
        fillMetric('Chassis underside',`${fmt(stats.chassisGroundClearanceM)} m`);
        fillMetric('Foot height mismatch',`${fmt(stats.footMismatchM,3)} m`);
        fillMetric('Installed equipment¹',`${stats.equipmentMassKg.toLocaleString()} kg`);
        fillMetric('H2/U1 adapter',stats.adapterMassKg?`${stats.adapterMassKg} kg`:'None');
        fillMetric('Left / right guides',stats.guideSpansM?stats.guideSpansM.map(n=>fmt(n,3)).join(' / ')+' m':'Unavailable');
    }
    findings.replaceChildren();
    const hint=document.createElement('p');hint.className='micro';
    hint.textContent='¹ Frame weight and frame-side guide bracket weight have not been authored. Socket ratings and these lengths are provisional. All existing equipment IDs, mass and power values are unchanged.';
    findings.append(hint);
    const memberHeader=document.createElement('h3');memberHeader.textContent=`GEOMETRY / CONTACT FINDINGS (${stats?.memberProximities??0} LINK PROXIMITIES)`;findings.append(memberHeader);
    const proximity=study.findings.filter(f=>f.code==='member-proximity');
    if(!proximity.length){const p=document.createElement('p');p.className='micro';p.textContent='No close approach was detected between the authored moving-link centerlines and modeled major equipment/structural volumes in this REST pose. This does not clear a machine for joint travel or detailed mesh contact.';findings.append(p);}
    for(const f of study.findings)findings.append(issueButton(f,true));
    const warnings=study.fit.issues.filter(f=>f.severity!=='pass');
    const fitHeader=document.createElement('h3');fitHeader.textContent=`MOUNTING / ENVELOPE FLAGS (${warnings.length})`;findings.append(fitHeader);
    if(!warnings.length){const p=document.createElement('p');p.className='micro';p.textContent='No mounting errors or conservative envelope warnings.';findings.append(p);}
    for(const event of warnings)findings.append(issueButton(event,false));
    const passes=document.createElement('h3');passes.textContent='CHECKED CONNECTIONS';findings.append(passes);
    const summary=document.createElement('p');summary.className='micro';
    summary.textContent=study.fit.issues.filter(x=>x.severity==='pass').map(x=>x.message).join('\n');
    summary.style.whiteSpace='pre-line';findings.append(summary);
    tileButtons.forEach((b,i)=>{b.classList.toggle('selected',i===selectedIndex);b.setAttribute('aria-pressed',String(i===selectedIndex));});
    focusName.textContent=`${frameLabel(study.frameId)} / ${mobilityLabel(study.mobilityId)}`;
}
function setMode(next){
    if(next!=='grid'&&next!=='focus')return;
    mode=next;
    matrix.hidden=next!=='grid';focusControls.hidden=next!=='focus';
    if(next==='grid')clearHighlight();
    scheduleRender();
}
function setSelection(index,focus=false){
    if(index<0||index>=cases.length)return;
    selectedIndex=index;clearHighlight();showSelected();
    if(focus)setMode('focus');else scheduleRender();
}
document.getElementById('return-grid').addEventListener('click',()=>setMode('grid'));
document.getElementById('previous-case').addEventListener('click',()=>setSelection((selectedIndex+8)%9));
document.getElementById('next-case').addEventListener('click',()=>setSelection((selectedIndex+1)%9));
for(const button of document.querySelectorAll('[data-camera]'))button.addEventListener('click',()=>{
    view=button.dataset.camera;
    document.querySelectorAll('[data-camera]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
    scheduleRender();
});
hideEquipment.addEventListener('change',()=>{
    for(const m of models)for(const item of m.gear)
        if(item.fixture.slot!=='mobility')item.mesh.visible=!hideEquipment.checked;
    scheduleRender();
});
document.getElementById('copy-report').addEventListener('click',async()=>{
    try{await navigator.clipboard.writeText(auditTextReport(cases));copyStatus.textContent='Nine-case report copied.';}
    catch{copyStatus.textContent='Clipboard unavailable. Use HTTPS / GitHub Pages to enable copying.';}
});

const target=new THREE.Vector3(0,1.65,0);
function configureCamera(width,height){
    // The GRID always uses exactly the same vertical world scale for all nine.
    const worldHeight=mode==='grid'?5.8:focusHeight;
    const aspect=Math.max(.3,width/Math.max(1,height));
    mainCamera.left=-worldHeight*aspect/2;
    mainCamera.right=worldHeight*aspect/2;
    mainCamera.top=worldHeight/2;
    mainCamera.bottom=-worldHeight/2;
    mainCamera.updateProjectionMatrix();
    const [x,y,z]=CAMERA_DIRECTIONS[view];
    mainCamera.position.set(target.x+x,target.y+y,target.z+z);
    mainCamera.lookAt(target);
    mainCamera.updateMatrixWorld();
}
function renderCase(index,x,y,w,h){
    if(w<3||h<3)return;
    configureCamera(w,h);
    renderer.setViewport(x,y,w,h);
    renderer.setScissor(x,y,w,h);
    renderer.setClearColor(index===selectedIndex?0x304035:0x202c26,1);
    renderer.clear(true,true,true);
    const current=models[index].root;
    current.visible=true;
    scene.updateMatrixWorld(true);
    renderer.render(scene,mainCamera);
    current.visible=false;
}
function render(){
    queued=false;
    const {width,height}=stage.getBoundingClientRect();
    if(width<2||height<2)return;
    renderer.setSize(width,height,false);
    renderer.setScissorTest(true);
    if(mode==='focus'){
        renderCase(selectedIndex,0,0,width,height);
    }else{
        const rect=stage.getBoundingClientRect();
        for(let i=0;i<tileButtons.length;i++){
            const box=tileButtons[i].getBoundingClientRect();
            renderCase(i,box.left-rect.left,rect.bottom-box.bottom,box.width,box.height);
        }
    }
    renderer.setScissorTest(false);
}
function scheduleRender(){
    if(queued)return;queued=true;
    requestAnimationFrame(render);
}
window.addEventListener('resize',scheduleRender);
if('ResizeObserver'in window)new ResizeObserver(scheduleRender).observe(stage);
// A safe smoke check: geometry should stay in its own authored study tree.
showSelected();scheduleRender();
