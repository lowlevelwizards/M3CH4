/** Standalone k.3a preview. Intentionally NOT imported by main.js or index.html. */
import * as THREE from 'three';
import { EXISTING_CHASSIS, getExistingChassis, validatePreviewChassis } from './chassisDefinitions.js';
import { buildChassisProxy, buildSocketGizmos } from './chassisVisualKit.js';

const host = document.getElementById('viewport');
const buttons = document.getElementById('frames');
const details = document.getElementById('details');
const showSockets = document.getElementById('show-sockets');
const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'low-power' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.setClearColor(0x222b28);
renderer.outputColorSpace = THREE.SRGBColorSpace;
host.prepend(renderer.domElement);
const scene = new THREE.Scene();
scene.add(new THREE.HemisphereLight(0xe8ecdf, 0x344940, 2));
const key = new THREE.DirectionalLight(0xfff2d3, 2.5);
key.position.set(-4, 8, 7); scene.add(key);
const grid = new THREE.GridHelper(5, 10, 0x65736c, 0x394640);
grid.position.y = -1.1; scene.add(grid);
const camera = new THREE.PerspectiveCamera(37, 1, .08, 60);
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let root, markers, frame, yaw = -.65, pitch = .20, radius = 4.5;
let down = null, pinching = null;

function disposeTree(tree) {
    if (!tree) return;
    const geometry = new Set(), materials = new Set();
    tree.traverse(node => { if (node.geometry) geometry.add(node.geometry);
        if (node.material) (Array.isArray(node.material) ? node.material : [node.material]).forEach(m => materials.add(m)); });
    geometry.forEach(g => g.dispose());
    // The proxy kit intentionally shares module-level materials. Do not dispose
    // them when changing one preview chassis; only marker materials are unique.
    if (tree === markers) materials.forEach(m => m.dispose());
    scene.remove(tree);
}
function frameInfo(f) { return `${f.name}\n${f.massKg.toLocaleString()} kg · ${f.loadLimitKg.toLocaleString()} kg frame rating\nSchematic central structure only.`; }
function selectFrame(id) {
    const next = getExistingChassis(id);
    if (!next) return;
    const checked = validatePreviewChassis(next);
    if (!checked.valid) { details.textContent = checked.errors.join('\n'); return; }
    disposeTree(root); disposeTree(markers);
    frame = next;
    root = buildChassisProxy(frame);
    markers = buildSocketGizmos(frame);
    markers.visible = showSockets.checked;
    scene.add(root, markers);
    for (const button of buttons.children) button.setAttribute('aria-pressed', String(button.dataset.id === id));
    details.textContent = frameInfo(frame);
    const [w,h,d] = frame.bounds;
    radius = Math.max(3.5, Math.max(w,h,d)*2.8);
}
for (const f of EXISTING_CHASSIS) {
    const button = document.createElement('button');
    button.type = 'button'; button.dataset.id = f.id;
    button.textContent = f.name;
    button.addEventListener('click', () => selectFrame(f.id));
    buttons.append(button);
}
showSockets.addEventListener('change', () => { if (markers) markers.visible = showSockets.checked; });
function displaySocket(id) {
    const s = frame?.sockets.find(s => s.id === id);
    if (!s) return;
    details.textContent = `${s.id.toUpperCase()}\nRole: ${s.roleHint}\nStandard: ${s.standard}\nLoad limit: ${s.maxLoadKg} kg\nLocal XYZ: [${s.position.map(n => n.toFixed(2)).join(', ')}]`;
}
function onPick(clientX,clientY) {
    if (!markers || !markers.visible) return;
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set(((clientX-rect.left)/rect.width)*2-1, -((clientY-rect.top)/rect.height)*2+1);
    raycaster.setFromCamera(pointer, camera);
    const picked = raycaster.intersectObjects(markers.children, true)[0]?.object;
    if (picked?.userData.socketId) displaySocket(picked.userData.socketId);
}
// Pointer gestures work on Safari without OrbitControls or a second CDN import.
renderer.domElement.addEventListener('pointerdown', e => {
    down = { x:e.clientX,y:e.clientY, startX:e.clientX,startY:e.clientY,id:e.pointerId };
    renderer.domElement.setPointerCapture(e.pointerId);
});
renderer.domElement.addEventListener('pointermove', e => {
    if (!down || down.id!==e.pointerId || pinching) return;
    const dx=e.clientX-down.x,dy=e.clientY-down.y;
    yaw+=dx*.009; pitch=Math.max(-.3,Math.min(1.12,pitch+dy*.007));
    down.x=e.clientX; down.y=e.clientY;
});
renderer.domElement.addEventListener('pointerup', e => {
    if (down?.id===e.pointerId && Math.hypot(e.clientX-down.startX,e.clientY-down.startY)<8) onPick(e.clientX,e.clientY);
    down=null;
});
renderer.domElement.addEventListener('pointercancel',()=>{down=null;pinching=null;});
renderer.domElement.addEventListener('wheel', e => { e.preventDefault(); radius=Math.max(2.3,Math.min(9,radius+Math.sign(e.deltaY)*.23)); },{passive:false});
// Safari two-finger pinch; keep it from moving the page while inspecting.
const touchesDistance = e => e.touches.length===2 ? Math.hypot(e.touches[0].clientX-e.touches[1].clientX,e.touches[0].clientY-e.touches[1].clientY):null;
host.addEventListener('touchstart',e=>{const d=touchesDistance(e);if(d) pinching={distance:d,radius};},{passive:true});
host.addEventListener('touchmove',e=>{const d=touchesDistance(e);if(d&&pinching){e.preventDefault();radius=Math.max(2.3,Math.min(9,pinching.radius*pinching.distance/d));}},{passive:false});
host.addEventListener('touchend',e=>{if(e.touches.length<2)pinching=null;},{passive:true});
function resize() {
    const { width,height } = host.getBoundingClientRect();
    if (width<1||height<1) return;
    renderer.setSize(width,height,false);
    camera.aspect=width/height;camera.updateProjectionMatrix();
}
window.addEventListener('resize',resize);
if ('ResizeObserver' in window) new ResizeObserver(resize).observe(host);
function animate() {
    requestAnimationFrame(animate);
    camera.position.set(radius*Math.sin(yaw)*Math.cos(pitch),radius*Math.sin(pitch),radius*Math.cos(yaw)*Math.cos(pitch));
    camera.lookAt(0,0,0);
    renderer.render(scene,camera);
}
selectFrame('frame-sr');resize();animate();
