/** Historical / current visual comparison, one WebGL context, no saves. */
import * as THREE from 'three';
import {fitFixtureFor} from '../chassisFitFixtures.js';
import {buildYardwalkerOriginalReference} from './yardwalkerOriginalReference.js';
import {buildYardwalkerVisual} from '../yardwalkerVisual.js';
import {YARDWALKER_LAYOUT} from '../mobilityDefinitions.js?v=k3a8';
const fixture=fitFixtureFor('legs-yard'),stage=document.getElementById('stage');
if(!fixture)throw Error('Cannot construct real Yardwalker catalogue fixture');
const original=buildYardwalkerOriginalReference(fixture);
const scene=new THREE.Scene();
scene.add(new THREE.HemisphereLight(0xfff2d3,0x3b4941,2.45));
const key=new THREE.DirectionalLight(0xffffff,2.2);key.position.set(-4,7,-5);scene.add(key);
const rim=new THREE.DirectionalLight(0xc4dace,.85);rim.position.set(4,4,5);scene.add(rim);
const floor=new THREE.GridHelper(4.6,12,0x718376,0x3f5548);scene.add(floor);
const renderer=new THREE.WebGLRenderer({canvas:document.getElementById('scene'),antialias:false,powerPreference:'low-power'});
renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.setScissorTest(true);
const camera=new THREE.OrthographicCamera(-1,1,1,-1,.05,35);
const views={quarter:[3.5,1.95,-4.4],front:[0,.7,-6],side:[6,.6,0],rear:[0,.7,6]};
let current=buildYardwalkerVisual(fixture,YARDWALKER_LAYOUT,{armorTier:0});
original.visible=false;current.visible=false;scene.add(original,current);
floor.position.y=YARDWALKER_LAYOUT.legs[0].foot[1]-YARDWALKER_LAYOUT.footSize[1]/2-.012;
let view='quarter',scheduled=false,tier=0;
window.__yardwalkerLineageReady=true;
function render(){
 scheduled=false;
 const r=stage.getBoundingClientRect();if(r.width<1||r.height<1)return;
 renderer.setSize(r.width,r.height,false);
 const vec=views[view];camera.position.set(...vec);camera.lookAt(0,.03,0);
 const panels=[...document.querySelectorAll('.panel')];
 for(let i=0;i<2;i++){
  const rect=panels[i].getBoundingClientRect(),x=rect.left-r.left,y=r.bottom-rect.bottom,w=rect.width,h=rect.height;
  if(w<1||h<1)continue;
  const aspect=w/h,vertical=Math.max(view==='quarter'?2.55:2.4,2.35/aspect);
  camera.left=-vertical*aspect/2;camera.right=vertical*aspect/2;camera.top=vertical/2;camera.bottom=-vertical/2;camera.updateProjectionMatrix();
  renderer.setViewport(x,y,w,h);renderer.setScissor(x,y,w,h);renderer.setClearColor(0x2b3e33,1);renderer.clear(true,true,true);
  const obj=i===0?original:current;obj.visible=true;
  scene.updateMatrixWorld(true);renderer.render(scene,camera);obj.visible=false;
 }
 document.getElementById('status').textContent=' · Side-view and tier comparison ready';
}
function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(render);}
for(const b of document.querySelectorAll('[data-view]'))b.addEventListener('click',()=>{
 view=b.dataset.view;
 for(const item of document.querySelectorAll('[data-view]'))item.setAttribute('aria-pressed',String(item===b));
 schedule();
});
document.getElementById('tier').addEventListener('change',event=>{
 tier=Number(event.target.value);
 scene.remove(current);
 current=buildYardwalkerVisual(fixture,YARDWALKER_LAYOUT,{armorTier:tier});
 current.visible=false;scene.add(current);
 document.getElementById('v3-label').textContent='01 / V4 '+['NAKED','GUARDED','HEAVY','ENCASED'][tier];
 schedule();
});
window.addEventListener('resize',schedule);
if('ResizeObserver'in window)new ResizeObserver(schedule).observe(stage);
schedule();
