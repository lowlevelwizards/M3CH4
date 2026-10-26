/**
 * Phone-first development editor. All 3D imagery is the *production* M3CH4
 * Yardwalker geometry; no substitute meshes or independent constructor.
 * This page never writes campaign or Test Yard save keys.
 */
import * as THREE from 'three';
import {buildExteriorRig} from './scene.js';
import {buildPartVisual} from './partVisuals.js';
import {makeTestAssembly} from './components.js';
import {applyYardwalkerCalfRecipe} from './partWorkbenchGeometry.js';
import {DEFAULT_CALF_RECIPE,copyCalfRecipe,validateCalfRecipe,
        editCalfStation,CALF_STATIONS} from './partWorkbenchRecipe.js';

const $=id=>document.getElementById(id);
const DRAFT_KEY='m3ch4-part-workbench-calf-v1';
const centerX=160,scale=545,top=26,height=192;
const sy=i=>top+(height*CALF_STATIONS[i]);
const svg=$('outline');
const stage=$('part-stage'),canvas=$('preview');
let recipe=copyCalfRecipe(DEFAULT_CALF_RECIPE);
try {
  const saved=window.localStorage.getItem(DRAFT_KEY);
  if(saved)recipe=validateCalfRecipe(JSON.parse(saved));
} catch(e){console.warn('Part workbench draft ignored:',e);}
let history=[copyCalfRecipe(recipe)],historyIndex=0;
let editingView='front',selected={index:2,field:'width'},drag=null;
let assembled=true,showOriginal=false,referenceURL=null;
let rigRoot=null,modelHeight=3,modelRadius=2,drawScheduled=false;
let yaw=.62,pitch=.17,distance=7;
const scene=new THREE.Scene();
scene.background=new THREE.Color(0x35423a);
scene.add(new THREE.HemisphereLight(0xe7ead7,0x303831,2.0));
const key=new THREE.DirectionalLight(0xf8d49c,2.6);
key.position.set(-5,8,-6);scene.add(key);
const rim=new THREE.DirectionalLight(0x9bc8ba,1.15);
rim.position.set(5,4,4);scene.add(rim);
const floor=new THREE.Mesh(new THREE.PlaneGeometry(22,22),
  new THREE.MeshStandardMaterial({color:0x404b43,roughness:1}));
floor.rotation.x=-Math.PI/2;scene.add(floor);
const grid=new THREE.GridHelper(14,14,0x819083,0x607265);
grid.material.transparent=true;grid.material.opacity=.23;scene.add(grid);
const camera=new THREE.PerspectiveCamera(38,1,.03,80);
const renderer=new THREE.WebGLRenderer({canvas,antialias:false,powerPreference:'low-power'});
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5));

function feedback(message,error=false) {
  $('feedback').textContent=message;
  $('feedback').style.color=error?'#f1a18e':'#d3b77b';
}
function store() {
  try {localStorage.setItem(DRAFT_KEY,JSON.stringify(recipe));return true;}
  catch(e){feedback('Local save unavailable: '+e.message,true);return false;}
}
function recordChange(next) {
  const candidate=validateCalfRecipe(next);
  if(JSON.stringify(candidate)===JSON.stringify(history[historyIndex])){
    recipe=candidate;refresh();return;
  }
  history=history.slice(0,historyIndex+1);
  history.push(copyCalfRecipe(candidate));
  if(history.length>50)history.shift();
  historyIndex=history.length-1;
  recipe=candidate;store();refresh();
}
function undoRedo(step) {
  const index=historyIndex+step;
  if(index<0||index>=history.length)return;
  historyIndex=index;recipe=copyCalfRecipe(history[index]);store();refresh();
}
function applyShell() {
  if(!rigRoot)return;
  const response=applyYardwalkerCalfRecipe(rigRoot,
    showOriginal?DEFAULT_CALF_RECIPE:recipe);
  if(!response.ok)feedback(response.reason||'Calf shell is missing.',true);
  requestDraw();
}
function disposeModel() {
  if(!rigRoot)return;
  scene.remove(rigRoot);
  rigRoot.traverse(node=>{
    if(!node.isMesh)return;
    node.geometry?.dispose?.();
    // Both gameplay and editor-only part builds clone their materials.
    const materials=Array.isArray(node.material)?node.material:[node.material];
    for(const mat of materials)mat?.dispose?.();
  });
  rigRoot=null;
}
function rebuildModel() {
  disposeModel();
  try {
    rigRoot=assembled ? buildExteriorRig(makeTestAssembly()).root :
      buildPartVisual('legs-yard',{mode:'gameplay'});
    if(!rigRoot)throw Error('Live mobility visual was unavailable.');
    scene.add(rigRoot);
    rigRoot.updateMatrixWorld(true);
    const box=new THREE.Box3().setFromObject(rigRoot);
    if(box.isEmpty())throw Error('The live rig has no visible geometry.');
    const center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());
    rigRoot.position.sub(center);
    rigRoot.updateMatrixWorld(true);
    modelHeight=size.y;modelRadius=Math.max(.7,size.length()*.5);
    floor.position.y=-size.y/2-.055;grid.position.y=floor.position.y+.005;
    distance=Math.max(2.5,modelRadius*2.9);
    applyShell();
  } catch(e){feedback('3D preview failed: '+e.message,true);console.error(e);}
  updateViewButtons();
  requestDraw();
}
function updateCamera(){
  pitch=THREE.MathUtils.clamp(pitch,-.35,1.2);
  distance=THREE.MathUtils.clamp(distance,1.5,20);
  camera.position.set(
    Math.sin(yaw)*Math.cos(pitch)*distance,
    Math.sin(pitch)*distance,
    -Math.cos(yaw)*Math.cos(pitch)*distance
  );
  camera.lookAt(0,0,0);
}
function requestDraw(){
  if(drawScheduled)return;
  drawScheduled=true;
  requestAnimationFrame(()=>{
    drawScheduled=false;
    const width=Math.max(1,stage.clientWidth),height=Math.max(1,stage.clientHeight);
    renderer.setSize(width,height,false);
    camera.aspect=width/height;camera.updateProjectionMatrix();
    updateCamera();renderer.render(scene,camera);
  });
}
function updateViewButtons(){
  document.querySelectorAll('[data-camera]').forEach(button=>{
    const name=button.dataset.camera;
    button.classList.toggle('active',
      name==='front'?Math.abs(yaw)<.01&&Math.abs(pitch)<.01:
      name==='side'?Math.abs(yaw-Math.PI/2)<.01&&Math.abs(pitch)<.01:
      Math.abs(yaw-.62)<.01&&Math.abs(pitch-.17)<.01);
  });
  $('rig-toggle').textContent=assembled?'ISOLATE LEGS':'FULL MECH';
  $('compare-toggle').textContent=showOriginal?'VIEW EDIT':'VIEW ORIGINAL';
  $('compare-toggle').classList.toggle('active',showOriginal);
  $('view-label').textContent=(assembled?'ASSEMBLED':'LEGS ONLY')+
    (showOriginal?' / ORIGINAL':' / CANDIDATE');
}
function setCamera(name) {
  if(name==='front'){yaw=0;pitch=0;}
  if(name==='side'){yaw=Math.PI/2;pitch=0;}
  if(name==='quarter'){yaw=.62;pitch=.17;}
  updateViewButtons();requestDraw();
}
document.querySelectorAll('[data-camera]').forEach(button=>
  button.addEventListener('click',()=>setCamera(button.dataset.camera)));
$('rig-toggle').addEventListener('click',()=>{
  assembled=!assembled;rebuildModel();feedback(assembled?'Complete production-built mech.':'Isolated production-built mobility.');
});
$('compare-toggle').addEventListener('click',()=>{
  showOriginal=!showOriginal;applyShell();updateViewButtons();
});
const touches=new Map();let lastPinch=null;
canvas.addEventListener('pointerdown',e=>{
  canvas.setPointerCapture(e.pointerId);
  touches.set(e.pointerId,{x:e.clientX,y:e.clientY});
  lastPinch=null;
});
canvas.addEventListener('pointermove',e=>{
  const prev=touches.get(e.pointerId);
  if(!prev)return;
  const dx=e.clientX-prev.x,dy=e.clientY-prev.y;
  touches.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(touches.size===1){
    yaw+=dx*.008;pitch=THREE.MathUtils.clamp(pitch-dy*.006,-.35,1.2);
  }else if(touches.size===2){
    const [a,b]=[...touches.values()];
    const span=Math.hypot(a.x-b.x,a.y-b.y);
    if(lastPinch!==null)distance=THREE.MathUtils.clamp(distance*lastPinch/span,1.5,20);
    lastPinch=span;
  }
  updateViewButtons();requestDraw();
});
function endOrbit(e){touches.delete(e.pointerId);lastPinch=null;}
canvas.addEventListener('pointerup',endOrbit);
canvas.addEventListener('pointercancel',endOrbit);
canvas.addEventListener('wheel',e=>{
  e.preventDefault();distance=THREE.MathUtils.clamp(distance*Math.exp(e.deltaY*.001),1.5,20);requestDraw();
},{passive:false});
if('ResizeObserver' in window)new ResizeObserver(requestDraw).observe(stage);
else window.addEventListener('resize',requestDraw);

const NS='http://www.w3.org/2000/svg';
function node(tag,attributes,parent=svg){
  const el=document.createElementNS(NS,tag);
  for(const [k,v] of Object.entries(attributes))el.setAttribute(k,String(v));
  parent.append(el);return el;
}
function polygonPoints(source,view) {
  const s=source.stations;
  if(view==='front')return [
    ...s.map((p,i)=>[centerX-p.width/2*scale,sy(i)]),
    ...s.map((p,i)=>[centerX+p.width/2*scale,sy(i)]).reverse()
  ];
  return [
    ...s.map((p,i)=>[centerX+p.front*scale,sy(i)]),
    ...s.map((p,i)=>[centerX+p.back*scale,sy(i)]).reverse()
  ];
}
function pathOf(source,view){
  return polygonPoints(source,view).map((pt,i)=>(i?'L':'M')+
    pt[0].toFixed(2)+' '+pt[1].toFixed(2)).join(' ')+' Z';
}
function outlineRender(){
  svg.replaceChildren();
  node('rect',{x:0,y:0,width:320,height:244,fill:'#dde3d9'});
  if(referenceURL){
    node('image',{href:referenceURL,x:6,y:8,width:308,height:224,opacity:.26,
      preserveAspectRatio:'xMidYMid meet'});
  }
  for(let i=0;i<CALF_STATIONS.length;i++){
    const y=sy(i);
    node('line',{x1:20,x2:300,y1:y,y2:y,stroke:'#abb7ab','stroke-dasharray':'4 5'});
    node('text',{x:6,y:y+3,fill:'#7c8b7d','font-size':9},svg).textContent=String(i+1);
  }
  node('line',{x1:centerX,x2:centerX,y1:12,y2:229,stroke:'#98aaa0','stroke-dasharray':'3 5'});
  node('path',{d:pathOf(DEFAULT_CALF_RECIPE,editingView),fill:'none',stroke:'#839388',
    'stroke-width':1.7,'stroke-dasharray':'5 4'});
  node('path',{d:pathOf(recipe,editingView),fill:'#6b8074', 'fill-opacity':.86,
    stroke:'#30483d','stroke-width':2.5,'stroke-linejoin':'round'});
  const stations=recipe.stations;
  stations.forEach((station,i)=>{
    const candidates=editingView==='front'?
      [{x:centerX-station.width/2*scale,field:'width'},
       {x:centerX+station.width/2*scale,field:'width'}]:
      [{x:centerX+station.front*scale,field:'front'},
       {x:centerX+station.back*scale,field:'back'}];
    for(const {x,field} of candidates){
      const y=sy(i),active=selected.index===i&&selected.field===field;
      node('circle',{cx:x,cy:y,r:15,fill:'transparent',
        'data-index':i,'data-field':field,'aria-label':field+' station '+(i+1)});
      node('circle',{cx:x,cy:y,r:active?6.8:5.6,fill:active?'#f4c86e':'#dca34a',
        stroke:'#304038','stroke-width':2,'pointer-events':'none'});
    }
  });
  node('text',{x:160,y:239,'text-anchor':'middle',fill:'#758477','font-size':10})
    .textContent=editingView==='front'?'SYMMETRIC WIDTH / METRES':'FRONT — BACK DEPTH / METRES';
  $('selected-label').textContent='STATION '+(selected.index+1)+' / '+
    ['TOP','UPPER','MIDDLE','LOWER','BOTTOM'][selected.index];
  const station=recipe.stations[selected.index];
  $('measure').textContent=editingView==='front'?
    'WIDTH '+Math.round(station.width*1000)+' MM':
    'DEPTH '+Math.round((station.back-station.front)*1000)+' MM';
}
function editorControls(){
  $('front-mode').classList.toggle('active',editingView==='front');
  $('side-mode').classList.toggle('active',editingView==='side');
  $('undo').disabled=historyIndex<=0;
  $('redo').disabled=historyIndex>=history.length-1;
}
function refresh(){outlineRender();editorControls();applyShell();}
$('front-mode').addEventListener('click',()=>{
  editingView='front';selected={index:selected.index,field:'width'};
  refresh();setCamera('front');
});
$('side-mode').addEventListener('click',()=>{
  editingView='side';selected={index:selected.index,field:'front'};
  refresh();setCamera('side');
});
function xInSVG(e){
  const point=svg.createSVGPoint();point.x=e.clientX;point.y=e.clientY;
  return point.matrixTransform(svg.getScreenCTM().inverse()).x;
}
svg.addEventListener('pointerdown',e=>{
  const target=e.target.closest('[data-index]');
  if(!target)return;
  const index=Number(target.getAttribute('data-index'));
  const field=target.getAttribute('data-field');
  selected={index,field};showOriginal=false;updateViewButtons();
  drag={pointerId:e.pointerId,start:JSON.stringify(recipe)};
  svg.setPointerCapture(e.pointerId);refresh();e.preventDefault();
});
svg.addEventListener('pointermove',e=>{
  if(!drag||e.pointerId!==drag.pointerId)return;
  let value=(xInSVG(e)-centerX)/scale;
  if(selected.field==='width')value=Math.abs(value)*2;
  try {recipe=editCalfStation(recipe,selected.index,selected.field,value);refresh();}
  catch(error){feedback(error.message,true);}
  e.preventDefault();
});
function finishEdit(e){
  if(!drag||e.pointerId!==drag.pointerId)return;
  const changed=drag.start!==JSON.stringify(recipe);
  drag=null;
  if(changed){recordChange(recipe);feedback('Edited both shin casings · draft autosaved in this browser.');}
  else refresh();
}
svg.addEventListener('pointerup',finishEdit);
svg.addEventListener('pointercancel',finishEdit);
$('undo').addEventListener('click',()=>undoRedo(-1));
$('redo').addEventListener('click',()=>undoRedo(1));
$('reset').addEventListener('click',()=>{
  recordChange(DEFAULT_CALF_RECIPE);showOriginal=false;updateViewButtons();
  feedback('Restored the original casing profile (undo available).');
});
$('save').addEventListener('click',()=>{if(store())feedback('Local draft saved. Career and Test Yard saves untouched.');});
$('reference-file').addEventListener('change',e=>{
  if(referenceURL)URL.revokeObjectURL(referenceURL);
  const file=e.target.files?.[0];
  referenceURL=file?.type?.startsWith('image/')?URL.createObjectURL(file):null;
  outlineRender();feedback(referenceURL?'Reference overlay loaded locally.':'Select an image reference.');
});
$('clear-reference').addEventListener('click',()=>{
  if(referenceURL)URL.revokeObjectURL(referenceURL);
  referenceURL=null;$('reference-file').value='';outlineRender();
});
$('export').addEventListener('click',()=>{
  $('json-box').hidden=false;
  $('recipe-json').value=JSON.stringify(recipe,null,2);
  feedback('Copy this portable shape recipe; it does not change the game.');
});
$('import').addEventListener('click',()=>{
  $('json-box').hidden=false;$('recipe-json').value='';
  $('recipe-json').focus();feedback('Paste a version 1 Yardwalker calf recipe, then APPLY IMPORT.');
});
$('json-close').addEventListener('click',()=>$('json-box').hidden=true);
$('json-copy').addEventListener('click',async()=>{
  const area=$('recipe-json');
  try {await navigator.clipboard.writeText(area.value);feedback('Recipe copied.');}
  catch {area.focus();area.select();feedback('Select and copy this text using your device.');}
});
$('json-apply').addEventListener('click',()=>{
  try{
    const imported=validateCalfRecipe(JSON.parse($('recipe-json').value));
    showOriginal=false;recordChange(imported);updateViewButtons();
    $('json-box').hidden=true;feedback('Validated recipe imported into the editor.');
  }catch(e){feedback('Import rejected: '+e.message,true);}
});
document.addEventListener('keydown',e=>{
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'&&
    !['TEXTAREA','INPUT'].includes(document.activeElement?.tagName)){
    e.preventDefault();undoRedo(e.shiftKey?1:-1);
  }
});
window.addEventListener('unhandledrejection',e=>feedback('Preview error: '+(e.reason?.message||e.reason),true));
window.addEventListener('error',e=>feedback('Preview error: '+(e.message||'unknown'),true));
rebuildModel();refresh();
feedback('Ready. Editing changes only the two real Yardwalker calf casings.');
