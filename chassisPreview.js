/** Standalone k.3a.1 design study. Production scene/main/garage never import it. */
import * as THREE from 'three';
import { CONCEPT_CHASSIS, getConceptChassis, validateConceptChassis } from './chassisConcepts.js';
import { buildConceptChassis } from './chassisConceptBuilder.js';
import { buildSocketGizmos } from './chassisVisualKit.js';

const host=document.getElementById('viewport');
const buttons=document.getElementById('frames');
const details=document.getElementById('details');
const showSockets=document.getElementById('show-sockets');
const renderer=new THREE.WebGLRenderer({antialias:false,alpha:false,powerPreference:'low-power'});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.6));
renderer.setClearColor(0x24302b);
renderer.outputColorSpace=THREE.SRGBColorSpace;
host.prepend(renderer.domElement);
const scene=new THREE.Scene();
scene.add(new THREE.HemisphereLight(0xf5f3e8,0x465850,2.5));
const key=new THREE.DirectionalLight(0xffe6b2,2.65);key.position.set(-4,7,-3);scene.add(key);
const fill=new THREE.DirectionalLight(0xc8d4cf,.9);fill.position.set(4,2,5);scene.add(fill);
const grid=new THREE.GridHelper(6,12,0x62736a,0x3c4943);
grid.position.y=-.99;scene.add(grid);
const frontArrow=new THREE.ArrowHelper(new THREE.Vector3(0,0,-1),new THREE.Vector3(0,-.975,-1.23),.54,0xd8ac47,.15,.085);
frontArrow.name='orientation-only:front-negative-Z';scene.add(frontArrow);
const camera=new THREE.PerspectiveCamera(36,1,.06,65);
const raycaster=new THREE.Raycaster();const pointer=new THREE.Vector2();
let root,markers,frame,yaw=2.49,pitch=.24,radius=4.4;
let down=null,pinching=null;
const views={
    quarter:{yaw:2.49,pitch:.24},
    front:{yaw:Math.PI,pitch:0},
    side:{yaw:Math.PI/2,pitch:0},
    top:{yaw:Math.PI,pitch:1.49},
};
function disposeTree(tree){
    if(!tree)return;
    const geometry=new Set(),materials=new Set();
    tree.traverse(node=>{
        if(node.geometry)geometry.add(node.geometry);
        if(node.material)(Array.isArray(node.material)?node.material:[node.material]).forEach(m=>materials.add(m));
    });
    geometry.forEach(g=>g.dispose());
    // The kit shares module-level metal materials; marker colors are per scene.
    if(tree===markers)materials.forEach(m=>m.dispose());
    scene.remove(tree);
}
function frameInfo(f){
    return `${f.name}\n\n${f.structure}\n\n`+
        `${f.pieces.length} named structural members · ${f.sockets.length} authored mounting faces\n`+
        `No legs, command module, generator or weapon installed.\n`+
        `No invented gameplay mass or load rating. Socket capacities are only provisional test values.`;
}
function selectFrame(id){
    const next=getConceptChassis(id);if(!next)return;
    const checked=validateConceptChassis(next);
    if(!checked.valid){details.textContent=checked.errors.join('\n');return;}
    disposeTree(root);disposeTree(markers);
    frame=next;root=buildConceptChassis(frame);markers=buildSocketGizmos(frame);
    markers.visible=showSockets.checked;
    scene.add(root,markers);
    for(const button of buttons.children)button.setAttribute('aria-pressed',String(button.dataset.id===id));
    details.textContent=frameInfo(frame);
    radius=Math.max(3.6,Math.max(...frame.bounds)*2.50);
}
for(const f of CONCEPT_CHASSIS){
    const button=document.createElement('button');
    button.type='button';button.dataset.id=f.id;button.textContent=f.name;
    button.addEventListener('click',()=>selectFrame(f.id));buttons.append(button);
}
showSockets.addEventListener('change',()=>{if(markers)markers.visible=showSockets.checked;});
function displaySocket(id){
    const s=frame?.sockets.find(s=>s.id===id);if(!s)return;
    const support=frame.pieces.find(p=>p.id===s.supportId);
    details.textContent=`${s.id.toUpperCase()}\nRole: ${s.roleHint}\nStandard: ${s.standard}\n`+
        `Provisional capacity: ${s.maxLoadKg} kg (not gameplay data)\n`+
        `XYZ: ${s.position.map(n=>n.toFixed(3)).join(', ')}\n`+
        `Face normal: ${s.normal.join(', ')}\n\n`+
        `STRUCTURAL SUPPORT: ${s.supportId}\n${support?.purpose??'MISSING'}`;
}
function onPick(clientX,clientY){
    if(!markers?.visible)return;
    const rect=renderer.domElement.getBoundingClientRect();
    pointer.set(((clientX-rect.left)/rect.width)*2-1,-((clientY-rect.top)/rect.height)*2+1);
    raycaster.setFromCamera(pointer,camera);
    const hit=raycaster.intersectObjects(markers.children,true)[0];
    if(hit?.object.userData.socketId)displaySocket(hit.object.userData.socketId);
}
const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
renderer.domElement.addEventListener('pointerdown',e=>{
    down={x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,id:e.pointerId};
    renderer.domElement.setPointerCapture(e.pointerId);
});
renderer.domElement.addEventListener('pointermove',e=>{
    if(!down||down.id!==e.pointerId||pinching)return;
    yaw+=(e.clientX-down.x)*.009;
    pitch=clamp(pitch+(e.clientY-down.y)*.007,-.32,1.50);
    down.x=e.clientX;down.y=e.clientY;
});
renderer.domElement.addEventListener('pointerup',e=>{
    if(down?.id===e.pointerId&&Math.hypot(e.clientX-down.startX,e.clientY-down.startY)<8)onPick(e.clientX,e.clientY);
    down=null;
});
renderer.domElement.addEventListener('pointercancel',()=>{down=null;pinching=null;});
renderer.domElement.addEventListener('wheel',e=>{
    e.preventDefault();radius=clamp(radius+Math.sign(e.deltaY)*.24,2.4,10);
},{passive:false});
const touchesDistance=e=>e.touches.length===2?
    Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY):null;
host.addEventListener('touchstart',e=>{const d=touchesDistance(e);if(d)pinching={distance:d,radius};},{passive:true});
host.addEventListener('touchmove',e=>{
    const d=touchesDistance(e);if(d&&pinching){e.preventDefault();radius=clamp(pinching.radius*pinching.distance/d,2.4,10);}
},{passive:false});
host.addEventListener('touchend',e=>{if(e.touches.length<2)pinching=null;},{passive:true});
for(const button of document.querySelectorAll('[data-view]')){
    button.addEventListener('click',()=>{
        const view=views[button.dataset.view];if(!view)return;
        yaw=view.yaw;pitch=view.pitch;
        for(const candidate of document.querySelectorAll('[data-view]'))
            candidate.setAttribute('aria-pressed',String(candidate===button));
    });
}
function resize(){
    const {width,height}=host.getBoundingClientRect();if(width<1||height<1)return;
    renderer.setSize(width,height,false);
    camera.aspect=width/height;camera.updateProjectionMatrix();
}
window.addEventListener('resize',resize);
if('ResizeObserver'in window)new ResizeObserver(resize).observe(host);
function animate(){
    requestAnimationFrame(animate);
    camera.position.set(radius*Math.sin(yaw)*Math.cos(pitch),radius*Math.sin(pitch),radius*Math.cos(yaw)*Math.cos(pitch));
    camera.lookAt(0,0,0);
    renderer.render(scene,camera);
}
selectFrame('concept-hub');resize();animate();
