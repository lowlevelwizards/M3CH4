/* Phone-first art study. Uses the game's real assembled procedural models.
 * No mutations to combat, stable, saved paint, or catalogue definitions.
 */
import * as THREE from 'three';
import {buildExteriorRig} from './scene.js';
import {makeTestAssembly,equip} from './components.js';
import {applyArtWeathering,createYardGroundTexture} from './artStyleProcedural.js';

const $=id=>document.getElementById(id);
const CONTROLS=['rig','angle','comparison','age','wear','contrast','terrain'];
const defaults=Object.freeze({rig:'yard',angle:'quarter',comparison:'compare',age:'1',wear:3,contrast:65,terrain:'dirt'});
const choices={
  yard:['frame-sr','legs-yard','power-dynamo','cab-cyclops','gun-cannon'],
  kestrel:['frame-utility','legs-compact','power-air','cab-utility','gun-light'],
  hauler:['frame-wedge','legs-hauler','power-dynamo','cab-armored','gun-short'],
};
const slots=['structure','mobility','power','command','combat'];
const renderer=new THREE.WebGLRenderer({canvas:$('art-canvas'),antialias:false,
  powerPreference:'low-power',preserveDrawingBuffer:true});
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.16;
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFShadowMap;
renderer.setPixelRatio(1);
const groundTexture=createYardGroundTexture();
const camera=new THREE.OrthographicCamera(-2,2,2,-2,.05,90);
const worldDirections={quarter:[5,3.3,-6],front:[0,1.8,-8],side:[8,2,0]};
let yawOffset=0,drag=null,pending=false;

function makeScene(candidate){
  const scene=new THREE.Scene();
  scene.background=new THREE.Color(0x242e28);
  const hemisphere=new THREE.HemisphereLight(0xbdc9bf,0x29251f,1.15);
  scene.add(hemisphere);
  const key=new THREE.DirectionalLight(0xffd4a0,2.25);
  key.position.set(-6,9,-5);
  key.castShadow=true;
  key.shadow.mapSize.set(512,512);
  key.shadow.camera.left=-8;key.shadow.camera.right=8;
  key.shadow.camera.top=8;key.shadow.camera.bottom=-8;
  key.shadow.camera.near=.5;key.shadow.camera.far=30;
  key.shadow.normalBias=.025;
  scene.add(key);
  const rim=new THREE.DirectionalLight(0x8cb8b4,.85);
  rim.position.set(5,4,6);scene.add(rim);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(60,60),
    new THREE.MeshStandardMaterial({color:0x514e43,roughness:.98,metalness:0}));
  floor.rotation.x=-Math.PI/2;
  floor.position.y=-.025;floor.receiveShadow=true;
  scene.add(floor);
  return {candidate,scene,hemisphere,key,rim,floor,model:null};
}
const stages=[makeScene(false),makeScene(true)];
function settings(){return Object.fromEntries(CONTROLS.map(id=>[id,
  id==='wear'||id==='contrast'?Number($(id).value):$(id).value]));}
function makeRig(name,candidate=false){
  const assembly=makeTestAssembly();
  choices[name].forEach((id,i)=>equip(assembly,slots[i],id));
  if(candidate){
    // Simulated history only: never writes actual inventory or service records.
    const age=Math.max(0,Math.min(2,Number($('age').value)||0));
    assembly.partHistory=Object.fromEntries(assembly.owned.map(part=>{
      part.wear=age===0?0:age===1?.20:.70;
      part.repairs=age===2?2:0;
      return [part.serial,{deployments:age*18,distanceTravelledM:age*12500,
        roundsFired:age*650,timesFieldServiced:age===2?2:0}];
    }));
  }
  const model=buildExteriorRig(assembly).root;
  model.updateWorldMatrix(true,true);
  const box=new THREE.Box3().setFromObject(model);
  const center=box.getCenter(new THREE.Vector3());
  model.position.set(-center.x,-box.min.y+.015,-center.z);
  model.updateWorldMatrix(true,true);
  return model;
}
function loadRig(){
  for(const stage of stages){
    if(stage.model)stage.scene.remove(stage.model);
    stage.model=makeRig($('rig').value,stage.candidate);
    stage.scene.add(stage.model);
  }
  yawOffset=0;
}
function updateArt(){
  const s=settings();
  $('wear-value').value=s.wear+' / 5';
  $('contrast-value').value=s.contrast+'%';
  applyArtWeathering(stages[1].model,s.wear);
  const contrast=s.contrast/100;
  const candidate=stages[1];
  candidate.hemisphere.intensity=1.2-contrast*.65;
  candidate.key.intensity=1.95+contrast*1.05;
  candidate.rim.intensity=.60+contrast*.75;
  stages.forEach(stage=>{
    const material=stage.floor.material;
    const textured=stage.candidate&&s.terrain==='dirt';
    material.map=textured?groundTexture:null;
    material.color.setHex(textured?0xffffff:0x514e43);
    material.needsUpdate=true;
  });
  requestDraw();
}
function requestDraw(){
  if(pending)return;pending=true;
  requestAnimationFrame(()=>{pending=false;draw();});
}
function draw(){
  const bounds=$('art-stage').getBoundingClientRect();
  const w=Math.max(1,Math.floor(bounds.width)),h=Math.max(1,Math.floor(bounds.height));
  renderer.setSize(w,h,false);
  renderer.setScissorTest(true);
  const s=settings(),single=s.comparison!=='compare';
  const active=single?[s.comparison==='current'?stages[0]:stages[1]]:stages;
  const vertical=!single&&w<560;
  $('view-labels').classList.toggle('vertical',vertical);
  $('view-labels').classList.toggle('single',single);
  $('left-label').textContent=single?s.comparison.toUpperCase():'CURRENT';
  $('right-label').textContent='CANDIDATE';
  for(let i=0;i<active.length;i++){
    const stage=active[i];
    const x=vertical?0:(single?0:Math.floor(i*w/2));
    const y=vertical?Math.floor((1-i)*h/2):0;
    const pw=vertical?w:(single?w:Math.ceil(w/2));
    const ph=vertical?Math.ceil(h/2):h;
    const box=new THREE.Box3().setFromObject(stage.model);
    const center=box.getCenter(new THREE.Vector3());
    const radius=Math.max(1.4,box.getBoundingSphere(new THREE.Sphere()).radius);
    const halfH=Math.max(radius*1.55,1.8);
    camera.left=-halfH*pw/ph;
    camera.right=halfH*pw/ph;
    camera.top=halfH;camera.bottom=-halfH;camera.updateProjectionMatrix();
    const dir=new THREE.Vector3(...worldDirections[s.angle]).normalize();
    dir.applyAxisAngle(new THREE.Vector3(0,1,0),yawOffset);
    camera.position.copy(center.clone().addScaledVector(dir,20));
    camera.lookAt(center);
    renderer.setViewport(x,y,pw,ph);
    renderer.setScissor(x,y,pw,ph);
    renderer.setClearColor(0x27332c,1);
    renderer.clear(true,true,true);
    renderer.render(stage.scene,camera);
  }
  renderer.setScissorTest(false);
  $('stage-status').textContent=single?'LIVE '+s.comparison.toUpperCase():'MATCHED CAMERAS / A-B';
  window.__m3ch4ArtLabReady=true;
}
for(const id of CONTROLS){
  $(id).addEventListener('input',()=>{
    if(id==='rig'||id==='age')loadRig();
    updateArt();
  });
}
$('reset').addEventListener('click',()=>{
  for(const [key,value] of Object.entries(defaults))$(key).value=value;
  loadRig();updateArt();
});
$('save').addEventListener('click',()=>{
  try{localStorage.setItem('m3ch4-art-lab-v1',JSON.stringify(settings()));
    $('stage-status').textContent='LOCAL PRESET SAVED';}
  catch{$('stage-status').textContent='LOCAL SAVE UNAVAILABLE';}
});
$('export').addEventListener('click',()=>{
  const value=JSON.stringify({kind:'M3CH4-ArtLab-v1',...settings()},null,2);
  const field=$('export-result');field.hidden=false;field.value=value;field.focus();field.select();
  if(navigator.clipboard?.writeText)navigator.clipboard.writeText(value).catch(()=>{});
  $('stage-status').textContent='PRESET READY TO COPY';
});
const canvas=$('art-canvas');
canvas.addEventListener('pointerdown',event=>{
  drag={x:event.clientX,offset:yawOffset};
  canvas.setPointerCapture(event.pointerId);
});
canvas.addEventListener('pointermove',event=>{
  if(!drag)return;
  yawOffset=drag.offset+(event.clientX-drag.x)*.008;
  requestDraw();
});
canvas.addEventListener('pointerup',()=>drag=null);
canvas.addEventListener('pointercancel',()=>drag=null);
window.addEventListener('resize',requestDraw);
window.visualViewport?.addEventListener('resize',requestDraw);
try{
  const saved=JSON.parse(localStorage.getItem('m3ch4-art-lab-v1')||'null');
  if(saved && typeof saved==='object'){
    for(const key of CONTROLS)if(saved[key]!=null)$(key).value=saved[key];
  }
}catch{/* Default study settings work without storage. */}
loadRig();updateArt();
