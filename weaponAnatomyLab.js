/** k.3x | One low-cost WebGL renderer, four actual catalogue-backed weapon models. */
import * as THREE from 'three';
import {buildPartVisual} from './partVisuals.js?v=k3x';

const ids=['gun-cannon','gun-short','gun-light','gun-scatter'];
const canvas=document.querySelector('#weapons'),stage=document.querySelector('#stage');
const tiles=[...document.querySelectorAll('.tile')];
const status=document.querySelector('#status');
const renderer=new THREE.WebGLRenderer({canvas,antialias:false,alpha:false,powerPreference:'low-power'});
renderer.setPixelRatio(Math.min(1.6,devicePixelRatio||1));
renderer.setClearColor(0x26332c,1);
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.23;
renderer.autoClear=false;
const gray=new THREE.MeshStandardMaterial({color:0xaaa9a0,roughness:.95,flatShading:true});
const scene=new THREE.Scene();
scene.add(new THREE.HemisphereLight(0xe4efdc,0x333527,1.3));
const key=new THREE.DirectionalLight(0xffd79a,2.7);key.position.set(-2,4,-3);scene.add(key);
const fill=new THREE.DirectionalLight(0xa1d3c8,1.5);fill.position.set(4,2,3);scene.add(fill);
const models=ids.map(id=>{
  const root=buildPartVisual(id);
  if(!root)throw new Error('No shared weapon model for '+id);
  const holder=new THREE.Group();holder.add(root);
  scene.add(holder);
  return {id,holder,root};
});
const views={
 hero:[3.6,2.4,-3.8],
 side:[4.8,1,-.4],
 front:[0,0,-5.5],
 top:[.01,5.5,0],
};
let active='hero',grayMode=false,scheduled=false;
function redraw(){
  scheduled=false;
  const stageBox=stage.getBoundingClientRect(),w=Math.max(1,stage.clientWidth),h=Math.max(1,stage.clientHeight);
  renderer.setSize(w,h,false);
  renderer.setScissorTest(true);
  const origin=stageBox.left,top=stageBox.top;
  const drawW=renderer.domElement.width,drawH=renderer.domElement.height;
  const scaleX=drawW/w,scaleY=drawH/h;
  for(let i=0;i<models.length;i++){
    const rect=tiles[i].getBoundingClientRect();
    const x=Math.round((rect.left-origin)*scaleX);
    const y=Math.round((h-(rect.bottom-top))*scaleY);
    const width=Math.max(1,Math.round(rect.width*scaleX));
    const height=Math.max(1,Math.round(rect.height*scaleY));
    renderer.setViewport(x,y,width,height);
    renderer.setScissor(x,y,width,height);
    renderer.clear(true,true,true);
    for(const m of models)m.holder.visible=false;
    const m=models[i];m.holder.visible=true;
    // Keep the extra-long Needle muzzle in frame even in narrow four-column
    // desktop tiles; preserve identical world scale for all four machines.
    const aspect=width/height,halfX=Math.max(1.72,1.55*aspect),halfY=halfX/aspect;
    const camera=new THREE.OrthographicCamera(-halfX,halfX,halfY,-halfY,.05,30);
    camera.position.set(...views[active]);
    camera.lookAt(0,0,-.63);
    camera.updateProjectionMatrix();
    scene.overrideMaterial=grayMode?gray:null;
    renderer.render(scene,camera);
  }
  scene.overrideMaterial=null;
  renderer.setScissorTest(false);
  status.textContent='4 real shared builders · '+active.toUpperCase()+' · '+(grayMode?'monochrome silhouette':'industrial materials');
}
function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(redraw);}
document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>{
  active=button.dataset.view;
  document.querySelectorAll('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
  schedule();
}));
document.querySelector('#gray').addEventListener('change',e=>{grayMode=e.target.checked;schedule();});
window.addEventListener('resize',schedule);
window.__m3ch4WeaponLabReady=true;
schedule();
