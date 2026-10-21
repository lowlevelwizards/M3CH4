/** k.4a comparison source: uses existing part builders, no proxy or art mockups.
 * Copy THIS file and HTML unchanged into the baseline checkout to take BEFORE.
 */
import * as THREE from 'three';
import {buildPartVisual} from './partVisuals.js';
import {buildExteriorRig} from './scene.js';
import {makeTestAssembly,equip,inspectAssembly,SLOT_CENTERS} from './components.js';
const query=new URLSearchParams(location.search);
const category=query.get('category')||'frames';
const view=query.get('view')||'quarter';
const mini=query.has('mini');
if(mini)document.body.classList.add('mini');
const types={
 frames:[['frame-sr','SR-01 BRUISER'],['frame-utility','U-2 SKELETON'],['frame-wedge','W-3 WEDGE']],
 weapons:[['gun-cannon','TRAINING'],['gun-short','STUMP'],['gun-light','NEEDLE'],['gun-scatter','S-6 SCATTER']],
 cabs:[['cab-cyclops','CYCLOPS'],['cab-utility','VISTA'],['cab-armored','HEARTH']],
 power:[['power-dynamo','DYNAMO G-2'],['power-air','DRAFT A-1']],
};
const combinations=[
 ['BRUISER / YARDWALKER',['frame-sr','legs-yard','power-dynamo','cab-cyclops','gun-cannon']],
 ['SKELETON / KESTREL',['frame-utility','legs-compact','power-air','cab-utility','gun-light']],
 ['WEDGE / HAULER',['frame-wedge','legs-hauler','power-dynamo','cab-armored','gun-short']],
 ['BRUISER / VISTA / S-6',['frame-sr','legs-yard','power-air','cab-utility','gun-scatter']],
 ['WEDGE / HEARTH / S-6',['frame-wedge','legs-hauler','power-dynamo','cab-armored','gun-scatter']],
];
if(!types[category]&&category!=='assembled')throw Error('Unknown material sheet: '+category);
const tiles=document.querySelector('#tiles');
const world=new THREE.Scene();
world.add(new THREE.HemisphereLight(0xc7d4ca,0x2a2420,1.3));
const key=new THREE.DirectionalLight(0xffdbaf,2.35);key.position.set(-4,6,-6);world.add(key);
const rim=new THREE.DirectionalLight(0x88b9b6,.95);rim.position.set(5,3,5);world.add(rim);
const renderer=new THREE.WebGLRenderer({canvas:document.querySelector('#lab-canvas'),antialias:false,
 powerPreference:'low-power',preserveDrawingBuffer:true});
renderer.setPixelRatio(1);renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.12;
const camera=new THREE.OrthographicCamera(-2,2,2,-2,.01,100);
const directions={quarter:[4,3.2,-6],front:[0,0,-7],side:[7,.4,0]};
const direction=directions[view];if(!direction)throw Error('Invalid view '+view);
const inputs=category==='assembled'?combinations:types[category];
tiles.style.setProperty('--count',inputs.length);
function assemblyFor(parts){
 const a=makeTestAssembly();
 for(const id of parts){
  const slot=id.startsWith('frame-')?'structure':
    id.startsWith('legs-')?'mobility':
    id.startsWith('power-')?'power':
    id.startsWith('cab-')?'command':'combat';
  equip(a,slot,id);
 }
 return a;
}
const subjects=inputs.map(([idOrLabel,partIds])=>{
 const isRig=Array.isArray(partIds);
 let object,description='';
 if(isRig){
  const assembly=assemblyFor(partIds);
  description=inspectAssembly(assembly).ready?'DEPLOYABLE':'FIT-ONLY STUDY';
  object=buildExteriorRig(assembly).root;
  object.position.set(0,-SLOT_CENTERS.structure[1],-SLOT_CENTERS.structure[2]);
 }else if(idOrLabel.startsWith('power-')){
  const assembly=assemblyFor(['frame-sr','legs-yard',idOrLabel,'cab-cyclops','gun-cannon']);
  object=buildExteriorRig(assembly).partGroups.get('power');
  // Copy world orientation into a standalone group for inspection, without rebuilding geometry.
  object.updateMatrixWorld(true);
  const clone=new THREE.Group();clone.name='generator display root';
  clone.add(object);object.position.set(0,0,0);object=clone;
 }else object=buildPartVisual(idOrLabel);
 const card=document.createElement('div');card.className='tile';
 const label=document.createElement('span');label.className='label';
 label.textContent=isRig?idOrLabel:partIds;
 const state=document.createElement('span');state.className='state';
 state.textContent=isRig?description:idOrLabel.toUpperCase();
 card.append(label,state);tiles.append(card);world.add(object);object.visible=false;
 return {object,card};
});
document.querySelector('#caption').textContent=category.toUpperCase()+' / '+view.toUpperCase()+
 ' / '+(mini?'MOBILE SCALE':'INSPECTION SCALE')+' · REAL SHARED BUILDERS · NO MODEL EDITS';
function draw(){
 const stage=document.querySelector('#stage').getBoundingClientRect();
 renderer.setSize(stage.width,stage.height,false);renderer.setScissorTest(true);
 for(const {object,card} of subjects){
  const r=card.getBoundingClientRect();
  const x=r.left-stage.left,y=stage.bottom-r.bottom,w=r.width,h=r.height;
  if(w<1||h<1)continue;
  const box=new THREE.Box3().setFromObject(object);
  if(box.isEmpty())throw Error('Part visual has empty bounds: '+object.name);
  const center=box.getCenter(new THREE.Vector3());
  const radius=Math.max(.25,box.getBoundingSphere(new THREE.Sphere()).radius);
  const scale=radius*(mini?3.6:2.65);
  const aspect=w/h;
  camera.left=-scale*aspect/2;camera.right=scale*aspect/2;
  camera.top=scale/2;camera.bottom=-scale/2;camera.updateProjectionMatrix();
  camera.position.copy(center.clone().add(new THREE.Vector3(...direction).normalize().multiplyScalar(12)));
  camera.up.set(0,1,0);camera.lookAt(center);
  renderer.setViewport(x,y,w,h);renderer.setScissor(x,y,w,h);
  renderer.setClearColor(0x29352e,1);renderer.clear(true,true,true);
  object.visible=true;renderer.render(world,camera);object.visible=false;
 }
 renderer.setScissorTest(false);
 window.__k4aGalleryRendered=true;
}
window.__k4aGalleryReady=true;
requestAnimationFrame(draw);
