/** k.3a.8 standalone equal-scale silhouette separation lab.
 * No gameplay code, no persistence, exactly ONE shared WebGL context.
 */
import * as THREE from 'three';
import {fitFixtureFor} from './chassisFitFixtures.js';
import {buildYardwalkerVisual} from './yardwalkerVisual.js?v=k3a8';
import {buildKestrelVisual} from './kestrelVisual.js?v=k3a8';
import {buildHaulerVisual} from './haulerVisual.js?v=k3a8';
import {MOBILITY_LAYOUTS,mobilitySilhouetteMetrics,validateMobilityFamilySeparation} from './mobilityDefinitions.js?v=k3a8';
import {setMobilityGreybox} from './mobilityVisualKit.js?v=k3a8';
const stage=document.getElementById('stage');
const tiles=[...document.querySelectorAll('.tile[data-family]')];
const greybox=document.getElementById('greybox');
const envelopes=document.getElementById('envelopes');
const labels=document.getElementById('labels');
const status=document.getElementById('silhouette-status');
const renderer=new THREE.WebGLRenderer({canvas:document.getElementById('anatomy-canvas'),antialias:false,powerPreference:'low-power'});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.setScissorTest(true);
const scene=new THREE.Scene();
scene.add(new THREE.HemisphereLight(0xf9f4e5,0x3d4b44,2.9));
const key=new THREE.DirectionalLight(0xffffff,2.15);key.position.set(-4,7,-5);scene.add(key);
const rim=new THREE.DirectionalLight(0xd9e8df,1.1);rim.position.set(4,4,5);scene.add(rim);
const grid=new THREE.GridHelper(4.6,10,0x637469,0x35443b);scene.add(grid);
const builders={
    'legs-yard':buildYardwalkerVisual,
    'legs-compact':buildKestrelVisual,
    'legs-hauler':buildHaulerVisual,
};
const role={
    'legs-yard':'UTILITY WALKER',
    'legs-compact':'REVERSE-KNEE RUNNER',
    'legs-hauler':'PODDED LOAD-BEARER',
};
const subjects=tiles.map(tile=>{
    const id=tile.dataset.family,fixture=fitFixtureFor(id),layout=MOBILITY_LAYOUTS[id];
    if(!fixture||!layout)throw new Error(`Unknown source-backed mobility part: ${id}`);
    const root=builders[id](fixture);
    root.visible=false;scene.add(root);
    setMobilityGreybox(root,true);
    const m=mobilitySilhouetteMetrics(layout);
    const metric=tile.querySelector('.metric');
    if(metric)metric.textContent=`${role[id]} · footprint ${m.footprintWidthM.toFixed(2)} × ${m.footprintDepthM.toFixed(2)} m`;
    return {tile,id,root,layout};
});
const separation=validateMobilityFamilySeparation();
status.dataset.status=separation.valid?'pass':'fail';
status.textContent=separation.valid?
    'GEOMETRY GATE PASS · Kestrel < Yardwalker < Hauler in stance and footprint; reverse-knee and pod-span thresholds satisfied.':
    `GEOMETRY GATE FAIL · ${separation.errors.join(' ')}`;
const camera=new THREE.OrthographicCamera(-1,1,1,-1,.05,35);
const views={front:[0,0,-6],side:[6,0,0],quarter:[4.1,2.0,-4.7]};
let view='front',scheduled=false;
function render(){
    scheduled=false;
    const rect=stage.getBoundingClientRect();
    if(rect.width<2||rect.height<2)return;
    renderer.setSize(rect.width,rect.height,false);
    renderer.setScissorTest(true);
    const [cx,cy,cz]=views[view];
    camera.position.set(cx,cy,cz);camera.lookAt(0,0,0);
    for(const {tile,root,layout} of subjects){
        const box=tile.getBoundingClientRect();
        const x=box.left-rect.left,y=rect.bottom-box.bottom,w=box.width,h=box.height;
        if(w<=0||h<=0)continue;
        const aspect=w/h;
        // One constant world scale for all three; sufficiently wide for Hauler.
        const height=Math.max(view==='quarter'?2.55:2.25,3.35/aspect);
        camera.left=-height*aspect/2;camera.right=height*aspect/2;
        camera.top=height/2;camera.bottom=-height/2;camera.updateProjectionMatrix();
        renderer.setViewport(x,y,w,h);renderer.setScissor(x,y,w,h);
        renderer.setClearColor(0x25332b,1);renderer.clear(true,true,true);
        grid.position.y=layout.legs[0].foot[1]-layout.footSize[1]/2-.013;
        root.visible=true;
        scene.updateMatrixWorld(true);
        renderer.render(scene,camera);
        root.visible=false;
    }
    renderer.setScissorTest(false);
}
function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(render)}
for(const b of document.querySelectorAll('[data-view]'))b.addEventListener('click',()=>{
    view=b.dataset.view;
    for(const c of document.querySelectorAll('[data-view]'))c.setAttribute('aria-pressed',String(c===b));
    schedule();
});
greybox.addEventListener('change',()=>{
    for(const {root} of subjects)setMobilityGreybox(root,greybox.checked);
    schedule();
});
envelopes.addEventListener('change',()=>{
    for(const {root} of subjects)root.userData.outline.visible=envelopes.checked;
    schedule();
});
labels.addEventListener('change',()=>{
    stage.classList.toggle('labels-hidden',!labels.checked);
});
window.addEventListener('resize',schedule);
if('ResizeObserver'in window)new ResizeObserver(schedule).observe(stage);
schedule();
