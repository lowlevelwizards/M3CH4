/** k.3z Single-canvas live geometry gallery; never updates player storage. */
import * as THREE from 'three';
import {buildPartVisual} from './partVisuals.js';
import {buildExteriorRig} from './scene.js';
import {makeTestAssembly,equip,inspectAssembly,SLOT_CENTERS} from './components.js';
const ids=['frame-sr','frame-utility','frame-wedge'];
const legs=['legs-yard','legs-compact','legs-hauler'];
const tiles=[...document.querySelectorAll('.tile')];
const stage=document.querySelector('#stage'),status=document.querySelector('#status');
const world=new THREE.Scene();
world.add(new THREE.HemisphereLight(0xe8f2e6,0x42564e,2.4));
const sun=new THREE.DirectionalLight(0xffedd1,2.3);sun.position.set(-4,7,-6);world.add(sun);
const rim=new THREE.DirectionalLight(0x86c0c1,.85);rim.position.set(4,4,4);world.add(rim);
const renderer=new THREE.WebGLRenderer({canvas:document.querySelector('#lab-canvas'),
    antialias:false,powerPreference:'low-power'});
renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));
renderer.outputColorSpace=THREE.SRGBColorSpace;
const camera=new THREE.OrthographicCamera(-3,3,3,-3,.04,70);
const gray=new THREE.MeshStandardMaterial({color:0xaaa9a0,roughness:.91,metalness:.08,flatShading:true});
const directions={quarter:[4,3.5,-6],front:[0,0,-7],side:[7,0,0],top:[0,7,-.002]};
let mode='bare',view='quarter',grayMode=false,envelopeMode=false,queued=false;
const makeMachine=(frame,mobility)=>{
    const a=makeTestAssembly();
    equip(a,'structure',frame);equip(a,'mobility',mobility);
    const inspection=inspectAssembly(a);
    const rig=buildExteriorRig(a);
    rig.root.position.set(0,-SLOT_CENTERS.structure[1],-SLOT_CENTERS.structure[2]);
    return {root:rig.root,inspection};
};
const subjects=ids.map((id,i)=>{
    const bare=buildPartVisual(id);
    const matched=makeMachine(id,'legs-yard');
    const matrix=legs.map(leg=>makeMachine(id,leg));
    world.add(bare,matched.root,...matrix.map(row=>row.root));
    return {id,tile:tiles[i],bare,matched,matrix};
});
function choose(subject,index){
    if(mode==='bare')return subject.bare;
    if(mode==='assembled')return subject.matched.root;
    return subject.matrix[index].root;
}
function render(){
    queued=false;
    const bounds=stage.getBoundingClientRect();
    if(bounds.width<2||bounds.height<2)return;
    renderer.setSize(bounds.width,bounds.height,false);
    renderer.setScissorTest(true);
    const rows=mode==='matrix'?3:1;
    document.getElementById('tiles').style.gridTemplateRows=mode==='matrix'?'repeat(3,minmax(0,1fr))':'';
    stage.style.height=mode==='matrix'?(window.innerWidth<751?'2300px':'1120px'):
        (window.innerWidth<751?'960px':'460px');
    const stageRect=stage.getBoundingClientRect();
    renderer.setSize(stageRect.width,stageRect.height,false);
    const rects=subjects.flatMap((s,i)=>Array.from({length:rows},(_,j)=>({s,i,j})));
    const aimY=mode==='bare'?0:-.12;
    camera.position.set(...directions[view].map((v,i)=>v+(i===1?aimY:0)));
    camera.up.set(0,view==='top'?0:1,view==='top'?-1:0);
    camera.lookAt(0,aimY,0);
    for(const {s,i,j} of rects){
        const r=s.tile.getBoundingClientRect();
        const h=r.height/rows;
        const x=r.left-stageRect.left,y=stageRect.bottom-(r.top+j*h+h),w=r.width;
        if(w<1||h<1)continue;
        const aspect=w/h,scale=mode==='bare'?3.6:4.9;
        camera.left=-scale*aspect/2;camera.right=scale*aspect/2;
        camera.top=scale/2;camera.bottom=-scale/2;camera.updateProjectionMatrix();
        renderer.setViewport(x,y,w,h);renderer.setScissor(x,y,w,h);
        renderer.setClearColor(0x28352d,1);renderer.clear(true,true,true);
        const obj=choose(s,j),old=world.overrideMaterial;
        world.overrideMaterial=grayMode?gray:null;
        obj.visible=true;
        if(mode==='bare'&&obj.userData.outline)obj.userData.outline.visible=envelopeMode;
        renderer.render(world,camera);
        obj.visible=false;world.overrideMaterial=old;
    }
    renderer.setScissorTest(false);
}
function request(){if(!queued){queued=true;requestAnimationFrame(render);}}
function refreshLabels(){
    subjects.forEach(s=>{
        const label=s.tile.querySelector('.sub');
        if(mode==='bare'){let n=0;s.bare.traverse(o=>{if(o.isMesh)n++;});
            label.textContent=n+' real solids · '+s.bare.userData.nominalEnvelope.join(' × ')+' m core';}
        else if(mode==='assembled')label.textContent='Yardwalker · Cyclops · Training Cannon · Dynamo';
        else label.textContent=legs.map((leg,j)=>leg.replace('legs-','').toUpperCase()+
            (s.matrix[j].inspection.ready?' ✓':' [FIT ONLY]')).join(' / ');
    });
    status.textContent='MODE '+mode.toUpperCase()+' · '+(grayMode?'MONOCHROME':'M3CH4 MATERIALS')+
        ' · '+(mode==='matrix'?'3 frames × 3 installed mobility assemblies':'3 frame definitions');
}
for(const b of document.querySelectorAll('[data-mode]'))b.addEventListener('click',()=>{
    mode=b.dataset.mode;
    for(const button of document.querySelectorAll('[data-mode]'))
        button.setAttribute('aria-pressed',String(button===b));
    refreshLabels();request();
});
for(const b of document.querySelectorAll('[data-view]'))b.addEventListener('click',()=>{
    view=b.dataset.view;
    for(const button of document.querySelectorAll('[data-view]'))
        button.setAttribute('aria-pressed',String(button===b));
    request();
});
document.querySelector('#gray').addEventListener('change',e=>{grayMode=e.target.checked;refreshLabels();request();});
document.querySelector('#envelopes').addEventListener('change',e=>{envelopeMode=e.target.checked;request();});
window.addEventListener('resize',request);
if('ResizeObserver' in window)new ResizeObserver(request).observe(stage);
for(const s of subjects){s.bare.visible=false;s.matched.root.visible=false;
    s.matrix.forEach(m=>m.root.visible=false);}
refreshLabels();window.__m3ch4FrameAuditReady=true;request();
