/** Browser-only cab anatomy gallery: ONE WebGL canvas/context, no gameplay state. */
import * as THREE from 'three';
import {buildPartVisual} from './partVisuals.js';
import {fitFixtureFor} from './chassisFitFixtures.js';
import {setCommandGraybox} from './commandVisualKit.js';

const stage=document.querySelector('#stage'),tiles=[...document.querySelectorAll('[data-command]')];
const status=document.querySelector('#status');
const renderer=new THREE.WebGLRenderer({canvas:document.getElementById('lab-canvas'),
    antialias:false,powerPreference:'low-power'});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.setScissorTest(true);
const world=new THREE.Scene();
world.add(new THREE.HemisphereLight(0xf8f3e6,0x4a5851,2.4));
const sun=new THREE.DirectionalLight(0xfff3d4,2.1);sun.position.set(-3,5,-5);world.add(sun);
const rim=new THREE.DirectionalLight(0x9dd2ca,.8);rim.position.set(4,2,3);world.add(rim);
const ids=['cab-cyclops','cab-utility','cab-armored'];
const subjects=tiles.map((tile,index)=>{
    const id=ids[index],fixture=fitFixtureFor(id);
    const root=buildPartVisual(id);
    if(!fixture||!root)throw Error('Unregistered command model: '+id);
    root.visible=false;world.add(root);
    const groups=root.children.filter(c=>c.isGroup);
    return {tile,id,fixture,root,groups};
});
const camera=new THREE.OrthographicCamera(-2,2,2,-2,.04,45);
const directions={quarter:[3.6,2.2,-5.7],front:[0,0,-6],side:[6,0,0],top:[0,6,-.005]};
let view='quarter',scheduled=false;
function layoutExplode(root,enabled){
    const groups=root.children.filter(c=>c.isGroup);
    groups.forEach((g,i)=>{g.position.set(0,0,0);
        if(!enabled)return;
        if(i===1)g.position.z=-.24;
        if(i===2)g.position.x=.19;
        if(i===3)g.position.z=.25;
        if(i===4)g.position.y=-.16;
    });
}
function render(){
    scheduled=false;
    const stageBox=stage.getBoundingClientRect();
    if(stageBox.width<2||stageBox.height<2)return;
    renderer.setSize(stageBox.width,stageBox.height,false);
    renderer.setScissorTest(true);
    camera.position.set(...directions[view]);
    camera.up.set(0,view==='top'?0:1,view==='top'?-1:0);
    camera.lookAt(0,0,0);
    for(const subject of subjects){
        const r=subject.tile.getBoundingClientRect(),
            x=r.left-stageBox.left,y=stageBox.bottom-r.bottom,w=r.width,h=r.height;
        if(w<2||h<2)continue;
        const aspect=w/h,scale=Math.max(1.85,2.65/aspect);
        camera.left=-scale*aspect/2;camera.right=scale*aspect/2;
        camera.top=scale/2;camera.bottom=-scale/2;camera.updateProjectionMatrix();
        renderer.setViewport(x,y,w,h);renderer.setScissor(x,y,w,h);
        renderer.setClearColor(0x27372e,1);
        renderer.clear(true,true,true);
        subject.root.visible=true;
        renderer.render(world,camera);
        subject.root.visible=false;
    }
    renderer.setScissorTest(false);
}
function queue(){if(!scheduled){scheduled=true;requestAnimationFrame(render);}}
for(const button of document.querySelectorAll('[data-view]')){
    button.addEventListener('click',()=>{
        view=button.dataset.view;
        for(const b of document.querySelectorAll('[data-view]'))
            b.setAttribute('aria-pressed',String(b===button));
        queue();
    });
}
document.getElementById('gray').addEventListener('change',e=>{
    for(const s of subjects)setCommandGraybox(s.root,e.target.checked);
    queue();
});
document.getElementById('explode').addEventListener('change',e=>{
    for(const s of subjects)layoutExplode(s.root,e.target.checked);
    queue();
});
document.getElementById('envelopes').addEventListener('change',e=>{
    for(const s of subjects)s.root.userData.outline.visible=e.target.checked;
    queue();
});
window.addEventListener('resize',queue);
if('ResizeObserver' in window)new ResizeObserver(queue).observe(stage);
status.textContent=subjects.map(({id,fixture,root})=>{
    let count=0;root.traverse(o=>{if(o.isMesh)count++;});
    return id+': '+fixture.envelope.join(' × ')+' m · '+fixture.massKg+' kg · '+count+' meshes';
}).join('  |  ');
window.__m3ch4CommandAuditReady=true;
queue();
