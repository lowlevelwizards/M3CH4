/** M3CH4 V2 — multi-object blueprint editor, no career or combat writes. */
import * as THREE from 'three';
import {FORMAT,VERSION,clone,createDocument,newShape,addNode,updateNode,removeNode,
 duplicateNode,mirrorNode,groupNodes,makeAsset,insertAsset,validateDocument,validateGeometry,migrateCalfRecipe,identity} from './workbench/blueprint.js';
import {compileBlueprint,disposeBlueprint,measureBlueprint} from './workbench/geometry.js';
import * as db from './workbench/storage.js';
import {orbitAfterDrag} from './workbench/orbitCamera.js';
import {packagePrototype,PROTOTYPE_KEY} from './workbench/prototypeBridge.js';
import {buildExteriorRig} from './scene.js';
import {makeTestAssembly} from './components.js';

const $=id=>document.getElementById(id),rad=n=>n*Math.PI/180,deg=n=>n*180/Math.PI;
let doc=createDocument('Untitled assembly'),current=null,history=[],step=0,selected='root',selectedIds=new Set();
let view='quarter',tool='select',showContext=false,context=null,compiled=null;
let camera,renderer,scene,grid,raycaster=new THREE.Raycaster(),orthoScale=2.7;
let referenceObjects=new Map(),activeRef=null,drag=null,pointers=new Map(),touchSpan=null;
let orbit={yaw:.65,pitch:.32,distance:3.9},focus=new THREE.Vector3();
let saveTimer=null,savePromise=Promise.resolve(),drawPending=false,ready=false;
const canvas=$('stage-canvas'),stage=$('stage'),svg=$('edit-overlay'),NS='http://www.w3.org/2000/svg';
const snap=()=>Number($('snap').value)||0;
const snapValue=v=>snap()?Math.round(v/snap())*snap():v;
const node=()=>doc.nodes.find(n=>n.id===selected);
const message=(s,error=false)=>{const e=$('status');e.textContent=s;e.style.color=error?'#efa596':'#e1ba7b';};
function startHistory(){
 history=[clone(doc)];step=0;selected='root';selectedIds.clear();
}
function commit(next,selection=selected,notify){
 try{
  const valid=validateDocument(next);
  if(JSON.stringify(valid)===JSON.stringify(doc))return;
  doc=valid;selected=selection;
  history=history.slice(0,step+1);history.push(clone(doc));
  if(history.length>60)history.shift();step=history.length-1;
  queueSave();refresh();
  if(notify)message(notify);
 }catch(e){message(e.message,true);}
}
function queueSave(){
 // One commit = one ordered IndexedDB write; no debounce window that can lose
 // the final edit when Safari reloads or the user leaves immediately.
 const snapshot=clone(doc);
 savePromise=savePromise.catch(()=>{}).then(()=>db.saveProject(snapshot)).catch(
  e=>message('Storage unavailable: '+e.message+'. Export a bundle.',true));
 return savePromise;
}
function undo(offset){
 const next=step+offset;if(next<0||next>=history.length)return;
 step=next;doc=clone(history[step]);
 if(!doc.nodes.some(n=>n.id===selected))selected='root';
 queueSave();refresh();
}
function sceneSetup(){
 scene=new THREE.Scene();scene.background=new THREE.Color(0x344039);
 scene.add(new THREE.HemisphereLight(0xe8e9db,0x30392d,1.75));
 const key=new THREE.DirectionalLight(0xffd7a0,2.2);key.position.set(-5,7,-5);scene.add(key);
 const rim=new THREE.DirectionalLight(0x87baa7,.9);rim.position.set(5,3,4);scene.add(rim);
 grid=new THREE.GridHelper(12,24,0x81978b,0x536658);grid.material.transparent=true;grid.material.opacity=.30;scene.add(grid);
 renderer=new THREE.WebGLRenderer({canvas,antialias:false,powerPreference:'low-power'});
 renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.setPixelRatio(Math.min(1.5,devicePixelRatio||1));
 setCamera();new ResizeObserver(requestDraw).observe(stage);
}
function setCamera(){
 const w=Math.max(1,stage.clientWidth),h=Math.max(1,stage.clientHeight),aspect=w/h;
 const is3D=view==='quarter';
 if(camera)camera=null;
 if(is3D){
  camera=new THREE.PerspectiveCamera(38,aspect,.03,90);
 }else camera=new THREE.OrthographicCamera(-orthoScale*aspect,orthoScale*aspect,orthoScale,-orthoScale,.03,90);
 updateCamera();
}
function updateCamera(){
 if(!camera)return;
 const p=focus.clone();
 if(view==='quarter'){
  camera.position.set(p.x+Math.sin(orbit.yaw)*Math.cos(orbit.pitch)*orbit.distance,
    p.y+Math.sin(orbit.pitch)*orbit.distance,
    p.z-Math.cos(orbit.yaw)*Math.cos(orbit.pitch)*orbit.distance);
 }else if(view==='front')camera.position.copy(p).add(new THREE.Vector3(0,0,-20));
 else if(view==='side')camera.position.copy(p).add(new THREE.Vector3(20,0,0));
 else camera.position.copy(p).add(new THREE.Vector3(0,20,0));
 camera.up.set(0,view==='top'?0:1,view==='top'?-1:0);
 camera.lookAt(p);
 camera.updateMatrixWorld(true);
}
function requestDraw(){
 if(drawPending)return;
 drawPending=true;requestAnimationFrame(()=>{
  drawPending=false;if(!renderer)return;
  const w=Math.max(1,stage.clientWidth),h=Math.max(1,stage.clientHeight);
  renderer.setSize(w,h,false);
  camera.aspect=w/h;
  if(camera.isOrthographicCamera){
   camera.left=-orthoScale*w/h;camera.right=orthoScale*w/h;
   camera.top=orthoScale;camera.bottom=-orthoScale;
  }
  camera.updateProjectionMatrix();updateCamera();
  renderer.render(scene,camera);drawOverlay();
 });
}
function buildContext(){
 if(context){
  scene.remove(context.root);
  const materials=new Set();
  context.root.traverse(n=>{
   if(!n.isMesh)return;
   n.geometry?.dispose?.();
   for(const m of(Array.isArray(n.material)?n.material:[n.material]))materials.add(m);
  });
  for(const m of materials)m.dispose?.();
  context=null;
 }
 if(!showContext)return;
 const rig=buildExteriorRig(makeTestAssembly()).root;
 const bbox=new THREE.Box3().setFromObject(rig),c=bbox.getCenter(new THREE.Vector3());
 rig.position.sub(c);scene.add(rig);
 rig.traverse(n=>{
  if(!n.isMesh)return;
  // Production visual is a local disposable clone; never recolor live machine instances.
  if(Array.isArray(n.material))n.material=n.material.map(m=>m.clone());
  else n.material=n.material.clone();
  const mats=Array.isArray(n.material)?n.material:[n.material];
  for(const m of mats){m.transparent=true;m.opacity=.25;m.depthWrite=false;}
 });
 rig.updateMatrixWorld(true);
 let knee=null;rig.traverse(n=>{if(n.name==='leftKnee')knee=n;});
 context={root:rig,knee};
}
function rebuild(){
 if(compiled){compiled.root.parent?.remove(compiled.root);disposeBlueprint(compiled.root);compiled=null;}
 try{
  compiled=compileBlueprint(doc);
  if(showContext&&context?.knee){
   context.knee.add(compiled.root);context.root.updateMatrixWorld(true);
   focus.copy(context.knee.getWorldPosition(new THREE.Vector3()));
   orbit.distance=Math.max(orbit.distance,3.4);
  }else{
   scene.add(compiled.root);
   const bounds=measureBlueprint(compiled.root);
   if(!bounds.empty){
    const target=new THREE.Vector3(...bounds.min).add(new THREE.Vector3(...bounds.max)).multiplyScalar(.5);
    if(target.length()<8)focus.copy(target);else focus.set(0,0,0);
   }else focus.set(0,0,0);
  }
  grid.visible=!showContext;
  requestDraw();
 }catch(e){message('Geometry rejected: '+e.message,true);console.error(e);}
}
function refresh(){
 $('project-name').value=doc.name;renderTree();renderInspector();renderLibrary();renderReferences();
 for(const b of document.querySelectorAll('[data-view]'))b.classList.toggle('active',b.dataset.view===view);
 for(const b of document.querySelectorAll('[data-tool]'))b.classList.toggle('active',b.dataset.tool===tool);
 $('undo').disabled=step===0;$('redo').disabled=step===history.length-1;
 $('node-count').textContent=doc.nodes.length-1+' NODES';
 $('selected-id').textContent=selected==='root'?'ROOT':selected.slice(-8);
 $('context-toggle').textContent=showContext?'HIDE YARDWALKER':'SHOW YARDWALKER';
 $('mode-status').textContent=view.toUpperCase()+' / '+tool.toUpperCase();
 rebuild();
}
function renderTree(){
 const target=$('object-tree');target.replaceChildren();
 const traverse=(parent,depth)=>{
  for(const n of doc.nodes.filter(n=>n.parentId===parent)){
   const b=document.createElement('button');b.type='button';b.className='tree-item'+(selected===n.id?' active':'');
   const type=document.createElement('small');type.textContent=n.kind==='shape'?n.geometry.type.toUpperCase():n.kind.toUpperCase();
   const label=document.createElement('span');label.className='tree-name';label.textContent=('  '.repeat(depth))+n.name;
   const flags=document.createElement('small');flags.textContent=(n.visible?'':'HIDDEN ')+(n.locked?'LOCKED ':'')+(n.mirrorOf?'LINKED':'');
   b.append(label,type,flags);
   b.onclick=e=>{
    if(e.shiftKey||e.ctrlKey||e.metaKey){selectedIds.has(n.id)?selectedIds.delete(n.id):selectedIds.add(n.id);}
    else{selectedIds.clear();selectedIds.add(n.id);}
    selected=n.id;renderTree();renderInspector();requestDraw();
   };
   target.append(b);traverse(n.id,depth+1);
  }
 };
 traverse('root',0);
 const root=doc.nodes.find(n=>n.id==='root');
 if(!target.children.length){const p=document.createElement('p');p.className='hint';p.textContent='Choose ADD to create your first editable shape.';target.append(p);}
}
const inputNumber=(value,callback,{step=.01,label='',min=-100,max=100}={})=>{
 const wrap=document.createElement('label');wrap.textContent=label;
 const input=document.createElement('input');input.type='number';input.value=Number(value.toFixed?.(4)??value);
 input.step=step;input.min=min;input.max=max;
 input.onchange=()=>{const v=Number(input.value);if(Number.isFinite(v))callback(v);else message('Invalid number',true);};
 wrap.append(input);return wrap;
};
function changeTransform(field,i,value){
 const n=node();if(!n||n.locked)return;
 const change=clone(n.transform);change[field][i]=field==='rotation'?rad(value):value;
 try{commit(updateNode(doc,selected,{transform:change}));}
 catch(e){message(e.message,true);}
}
function renderInspector(){
 const n=node(),active=!!n&&!n.locked&&n.id!=='root';
 $('object-name').value=n?.name||'';$('object-name').disabled=!active;
 $('material-role').value=n?.materialRole||'olive';$('material-role').disabled=!active||n.kind!=='shape';
 for(const [field,title] of [['position','POSITION'],['rotation','ROTATION'],['scale','SCALE']]){
  const target=$(field+'-fields');target.replaceChildren();
  for(let i=0;i<3;i++){
   const v=n?.transform?.[field]?.[i]||0;
   const display=field==='rotation'?deg(v):v;
   const input=inputNumber(display,value=>changeTransform(field,i,value),
    {step:field==='rotation'?5:.01,label:['X','Y','Z'][i],min:field==='scale'?.001:field==='rotation'?-360:-20,max:field==='scale'?30:field==='rotation'?360:20});
   input.querySelector('input').disabled=!active;target.append(input);
  }
 }
 const target=$('geometry-fields');target.replaceChildren();
 if(!active||n.kind!=='shape'){target.textContent='Select an editable shape.';return;}
 const g=n.mirrorOf?doc.nodes.find(x=>x.id===n.mirrorOf).geometry:n.geometry;
 if(n.mirrorOf){target.textContent='Linked mirror: edit the source shape or tap UNLINK.';return;}
 function field(label,path,value,min,max,step=.01){
  const entry=inputNumber(value,v=>{
   const geo=clone(node().geometry);
   let object=geo;for(let i=0;i<path.length-1;i++)object=object[path[i]];
   object[path[path.length-1]]=v;
   try{validateGeometry(geo);commit(updateNode(doc,selected,{geometry:geo}));}
   catch(e){message(e.message,true);}
  },{label,min,max,step});
  target.append(entry);
 }
 if(g.size)for(let i=0;i<3;i++)field(['WIDTH','HEIGHT','DEPTH'][i],['size',i],g.size[i],.005,8);
 if(g.bevel!==undefined)field('CHAMFER',['bevel'],g.bevel,0,2);
 for(const key of ['radius','outerRadius','innerRadius','length','depth'])if(g[key]!==undefined)
  field(key.toUpperCase(),[key],g[key],.001,8);
 if(g.from)for(let i=0;i<2;i++)field('START '+['W','D'][i],['from',i],g.from[i],.001,8);
 if(g.to)for(let i=0;i<2;i++)field('END '+['W','D'][i],['to',i],g.to[i],.001,8);
 if(g.sections)for(let i=0;i<g.sections.length;i++)
  for(const key of ['y','width','front','back'])field('SECTION '+(i+1)+' '+key.toUpperCase(),
    ['sections',i,key],g.sections[i][key],key==='width'?.005:key==='y'?0:-6,8);
 if(g.profile)for(let i=0;i<g.profile.length;i++)for(let axis=0;axis<2;axis++)
  field('POINT '+(i+1)+' '+(axis?'Y':'X'),['profile',i,axis],g.profile[i][axis],-6,6);
 const actions=document.createElement('div');actions.className='toolbar';
 const add=document.createElement('button');add.textContent=g.sections?'ADD SECTION':'ADD POINT';
 const del=document.createElement('button');del.textContent=g.sections?'REMOVE SECTION':'REMOVE POINT';
 add.onclick=()=>editGeometryCount(1);del.onclick=()=>editGeometryCount(-1);
 if(g.profile||g.sections){actions.append(add,del);target.append(actions);}
}
function editGeometryCount(delta){
 const n=node(),g=clone(n.geometry);if(g.sections){
  if(delta>0){
   if(g.sections.length>=24)return message('Maximum 24 loft sections',true);
   const idx=Math.max(0,Math.floor((g.sections.length-1)/2));
   const a=g.sections[idx],b=g.sections[idx+1],mid={};
   for(const k of ['y','width','front','back'])mid[k]=(a[k]+b[k])/2;
   g.sections.splice(idx+1,0,mid);
  }else if(g.sections.length>2)g.sections.splice(Math.floor(g.sections.length/2),1);
  else return message('Minimum two loft sections',true);
 }else if(g.profile){
  if(delta>0){
   const a=g.profile[0],b=g.profile[1];
   g.profile.splice(1,0,[(a[0]+b[0])/2,(a[1]+b[1])/2]);
  }else if(g.profile.length>3)g.profile.splice(1,1);
  else return message('Minimum three polygon points',true);
 }
 try{commit(updateNode(doc,selected,{geometry:g}));}catch(e){message(e.message,true);}
}
const changeSelected=(change,msg)=>{
 const n=node();if(!n||n.locked||selected==='root')return;
 try{commit(updateNode(doc,selected,change),selected,msg);}catch(e){message(e.message,true);}
};
$('object-name').onchange=()=>changeSelected({name:$('object-name').value.trim()||'Unnamed'});
$('material-role').onchange=()=>changeSelected({materialRole:$('material-role').value});
$('project-name').onchange=()=>{
 const next=clone(doc);next.name=$('project-name').value.trim()||'Untitled assembly';commit(next);
};
$('add-shape').onclick=()=>{
 const type=$('shape-type').value,shape=newShape(type,{parentId:'root'});
 // A new shape appears in front of the camera but preserves predictable local coordinates.
 try{commit(addNode(doc,shape),shape.id,'Added '+type+'. Select MOVE or POINTS to edit.');}
 catch(e){message(e.message,true);}
};
$('duplicate').onclick=()=>{
 try{const {document,selectedId}=duplicateNode(doc,selected);commit(document,selectedId,'Duplicated object.');}
 catch(e){message(e.message,true);}
};
$('mirror').onclick=()=>{
 try{const {document,selectedId}=mirrorNode(doc,selected,true);commit(document,selectedId,'Linked mirror created.');}
 catch(e){message(e.message,true);}
};
$('unlink').onclick=()=>{
 const n=node();if(!n?.mirrorOf)return message('Select a linked mirror to unlink.');
 const source=doc.nodes.find(x=>x.id===n.mirrorOf);
 changeSelected({geometry:clone(source.geometry),mirrorOf:null},'Independent mirrored shape created.');
};
$('delete-object').onclick=()=>{
 if(node()?.locked)return message('Unlock this object before deleting it.',true);
 try{commit(removeNode(doc,selected),'root','Deleted selected object/subtree.');}
 catch(e){message(e.message,true);}
};
$('hide-object').onclick=()=>changeSelected({visible:!node().visible});
$('lock-object').onclick=()=>{
 const n=node();
 if(n&&n.id!=='root'){
  try{commit(updateNode(doc,selected,{locked:!n.locked}),selected,n.locked?'Object unlocked.':'Object locked.');}
  catch(e){message(e.message,true);}
 }
};
$('reset-selected').onclick=()=>changeSelected({transform:identity()});
$('group-objects').onclick=()=>{
 try{const {document,selectedId}=groupNodes(doc,[...selectedIds].filter(id=>id!=='root').length?
    [...selectedIds].filter(id=>id!=='root'):[selected]);
    commit(document,selectedId,'Grouped selected siblings.');}
 catch(e){message(e.message,true);}
};
$('ungroup').onclick=()=>{
 const n=node();if(n?.kind!=='group'||n.id==='root')return message('Select a group first.');
 try{
  const next=clone(doc);
  // Group can be flattened without losing child world pose only if its transform is identity.
  if(JSON.stringify(n.transform)!==JSON.stringify(identity()))return message('Reset group transform before ungrouping.',true);
  for(const item of next.nodes)if(item.parentId===n.id)item.parentId=n.parentId;
  next.nodes=next.nodes.filter(item=>item.id!==n.id);
  commit(next,n.parentId);
 }catch(e){message(e.message,true);}
};
$('save-project').onclick=async()=>{
 try{await savePromise;await db.saveProject(doc);message('Project saved to this browser. Export a bundle for backup.');}
 catch(e){message('Save failed: '+e.message,true);}
};
$('new-project').onclick=()=>{
 if(!window.confirm('Start a new project? Save/export the current project first.'))return;
 doc=createDocument('Untitled assembly');startHistory();queueSave();refresh();message('New assembly created.');
};
for(const b of document.querySelectorAll('[data-tool]'))b.onclick=()=>{
 tool=b.dataset.tool;refresh();
};
for(const b of document.querySelectorAll('[data-view]'))b.onclick=()=>{
 view=b.dataset.view;setCamera();refresh();
};
$('context-toggle').onclick=()=>{showContext=!showContext;buildContext();refresh();
 message(showContext?'Inspecting the actual Yardwalker knee assembly.':'Editing stand-alone blueprint.');};
$('test-in-yard').onclick=async()=>{
 try{
  const raw=packagePrototype(doc);
  // A standalone blueprint overlays only the left Yardwalker knee in the real range.
  sessionStorage.setItem(PROTOTYPE_KEY,raw);
  await db.saveProject(doc);
  window.location.assign('./test-yard.html?wb-prototype=1');
 }catch(e){message('Test Yard handoff failed: '+e.message,true);}
};
$('undo').onclick=()=>undo(-1);$('redo').onclick=()=>undo(1);
document.addEventListener('keydown',e=>{
 if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='z'&&!['INPUT','TEXTAREA'].includes(document.activeElement?.tagName)){
  e.preventDefault();undo(e.shiftKey?1:-1);
 }
});

function svgNode(tag,props={}){
 const el=document.createElementNS(NS,tag);
 for(const [k,v] of Object.entries(props))el.setAttribute(k,String(v));
 svg.append(el);return el;
}
function projected(world){
 const p=world.clone().project(camera);
 return {x:(p.x+1)*stage.clientWidth/2,y:(1-p.y)*stage.clientHeight/2};
}
function refWorld(a,b,plane){return plane==='front'?new THREE.Vector3(a,b,0):
 plane==='side'?new THREE.Vector3(0,b,a):new THREE.Vector3(a,0,b);}
function drawOverlay(){
 if(!camera)return;
 const w=stage.clientWidth,h=stage.clientHeight;
 svg.replaceChildren();svg.setAttribute('viewBox','0 0 '+w+' '+h);
 if(view!=='quarter'){
  const ref=doc.references.find(r=>r.view===view);
  if(ref&&referenceObjects.has(ref.imageId)){
   const image=referenceObjects.get(ref.imageId);
   const half=ref.scale/2,vertical=half*image.height/image.width;
   const pos=refWorld(ref.offset[0],ref.offset[1],view);
   // Image is parallel to ortho plane, positioned from calibrated world dimensions.
   const a=projected(refWorld(ref.offset[0]-half,ref.offset[1]+vertical,view));
   const b=projected(refWorld(ref.offset[0]+half,ref.offset[1]-vertical,view));
   const e=svgNode('image',{href:image.data,x:Math.min(a.x,b.x),y:Math.min(a.y,b.y),
    width:Math.abs(b.x-a.x),height:Math.abs(b.y-a.y),opacity:ref.opacity,preserveAspectRatio:'none'});
   if(ref.rotation)e.setAttribute('transform','rotate('+ref.rotation+' '+projected(pos).x+' '+projected(pos).y+')');
  }
 }
 const n=node(),obj=compiled?.objects.get(selected);
 if(!n||n.kind!=='shape'||!obj||!n.visible)return;
 const g=n.mirrorOf?doc.nodes.find(s=>s.id===n.mirrorOf).geometry:n.geometry;
 const handles=[];
 if(tool==='points'&&view!=='quarter'&&!n.locked&&!n.mirrorOf){
  if(g.profile&&view==='front')
   g.profile.forEach((p,i)=>handles.push({pos:new THREE.Vector3(p[0],p[1],0),kind:'profile',index:i}));
  if(g.sections){
   g.sections.forEach((s,i)=>{
    if(view==='front'){
     handles.push({pos:new THREE.Vector3(-s.width/2,s.y,0),kind:'width',index:i});
     handles.push({pos:new THREE.Vector3(s.width/2,s.y,0),kind:'width',index:i});
    }else if(view==='side'){
     handles.push({pos:new THREE.Vector3(0,s.y,s.front),kind:'front',index:i});
     handles.push({pos:new THREE.Vector3(0,s.y,s.back),kind:'back',index:i});
    }else if(view==='top'){
     handles.push({pos:new THREE.Vector3(s.width/2,s.y,s.front),kind:'topWidth',index:i});
     handles.push({pos:new THREE.Vector3(-s.width/2,s.y,s.back),kind:'topBack',index:i});
    }
   });
  }
 }
 for(const entry of handles){
  const world=obj.localToWorld(entry.pos.clone()),p=projected(world);
  if(!Number.isFinite(p.x)||!Number.isFinite(p.y))continue;
  const circle=svgNode('circle',{cx:p.x,cy:p.y,r:13,fill:'#edb15d','fill-opacity':'.15',
   stroke:'#e7ae57','stroke-width':1.5,class:'point-handle',
   'data-index':entry.index,'data-kind':entry.kind});
  const core=svgNode('circle',{cx:p.x,cy:p.y,r:4.5,fill:'#ffcc71','pointer-events':'none'});
  circle.addEventListener('pointerdown',e=>{
   e.preventDefault();e.stopPropagation();
   const target=compiled.objects.get(selected);
   const anchor=target.localToWorld(entry.pos.clone());
   drag={mode:'point',nodeId:selected,index:entry.index,kind:entry.kind,
    pointerId:e.pointerId,anchor,previous:clone(doc)};
   svg.setPointerCapture(e.pointerId);
  });
 }
}
function pointPlane(e,anchor){
 const box=stage.getBoundingClientRect();
 const x=(e.clientX-box.left)/box.width*2-1,y=1-(e.clientY-box.top)/box.height*2;
 raycaster.setFromCamera({x,y},camera);
 const normal=camera.getWorldDirection(new THREE.Vector3());
 const plane=new THREE.Plane().setFromNormalAndCoplanarPoint(normal,anchor);
 return raycaster.ray.intersectPlane(plane,new THREE.Vector3());
}
function applyPoint(e){
 const target=compiled?.objects.get(drag.nodeId);if(!target)return;
 const hit=pointPlane(e,drag.anchor);if(!hit)return;
 const local=target.worldToLocal(hit);
 const next=clone(doc),n=next.nodes.find(n=>n.id===drag.nodeId);
 const g=n.geometry,i=drag.index;
 if(g.profile){
  if(view!=='front')return;
  g.profile[i]=[snapValue(local.x),snapValue(local.y)];
 }else if(g.sections){
  const section=g.sections[i],kind=drag.kind;
  if(kind==='width'||kind==='topWidth')section.width=Math.max(.02,snapValue(Math.abs(local.x)*2));
  if(kind==='front')section.front=Math.min(section.back-.02,snapValue(local.z));
  if(kind==='back'||kind==='topBack')section.back=Math.max(section.front+.02,snapValue(local.z));
  if(kind==='front'||kind==='back'||kind==='width')section.y=Math.max(0,snapValue(local.y));
 }
 try{doc=validateDocument(next);rebuild();renderInspector();}
 catch{ /* invalid in-between drag poses remain uncommitted */ }
}
svg.addEventListener('pointermove',e=>{
 if(drag?.mode==='point'&&drag.pointerId===e.pointerId){applyPoint(e);e.preventDefault();}
});
const finishPoint=e=>{
 if(drag?.mode!=='point'||drag.pointerId!==e.pointerId)return;
 const after=clone(doc),before=drag.previous;drag=null;
 doc=before;commit(after,selected,'Edited profile control point.');
};
svg.addEventListener('pointerup',finishPoint);svg.addEventListener('pointercancel',finishPoint);
function screenNDC(e){
 const b=stage.getBoundingClientRect();
 return {x:(e.clientX-b.left)/b.width*2-1,y:1-(e.clientY-b.top)/b.height*2};
}
canvas.addEventListener('pointerdown',e=>{
 canvas.setPointerCapture(e.pointerId);
 pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
 if(pointers.size!==1)return;
 raycaster.setFromCamera(screenNDC(e),camera);
 const hits=raycaster.intersectObjects([...compiled?.objects.values()||[]].filter(x=>x.isMesh),false);
 const found=hits.find(h=>h.object.userData.workbenchSelectable);
 if(found){
  selected=found.object.userData.workbenchNodeId;selectedIds=new Set([selected]);
  renderTree();renderInspector();requestDraw();
  const n=node();
  if(['move','scale','rotate'].includes(tool)&&n&&!n.locked){
   const anchor=found.object.getWorldPosition(new THREE.Vector3());
   drag={mode:tool,nodeId:selected,pointerId:e.pointerId,anchor,previous:clone(doc),
    start:{x:e.clientX,y:e.clientY},base:clone(n.transform)};
  }
 }else if(view==='quarter')drag={mode:'orbit',pointerId:e.pointerId};
});
canvas.addEventListener('pointermove',e=>{
 const prev=pointers.get(e.pointerId);if(!prev)return;
 const dx=e.clientX-prev.x,dy=e.clientY-prev.y;
 pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
 if(pointers.size===2){
  const [a,b]=[...pointers.values()],distance=Math.hypot(a.x-b.x,a.y-b.y);
  if(touchSpan!==null){if(view==='quarter')orbit.distance*=touchSpan/distance;
   else orthoScale*=touchSpan/distance;
  }
  touchSpan=distance;requestDraw();return;
 }
 if(drag?.mode==='orbit'&&view==='quarter'){
  orbit=orbitAfterDrag(orbit,dx,dy);requestDraw();return;
 }
 if(!drag||drag.pointerId!==e.pointerId)return;
 const next=clone(doc),n=next.nodes.find(n=>n.id===drag.nodeId);
 if(!n||n.locked)return;
 if(drag.mode==='move'){
  const hit=pointPlane(e,drag.anchor);
  const startHit=pointPlane({clientX:drag.start.x,clientY:drag.start.y},drag.anchor);
  if(!hit||!startHit)return;
  const parent=compiled.objects.get(n.parentId);
  const inverseParent=parent.getWorldQuaternion(new THREE.Quaternion()).invert();
  const delta=hit.sub(startHit).applyQuaternion(inverseParent);
  n.transform.position=drag.base.position.map((v,i)=>snapValue(v+delta.getComponent(i)));
 }else if(drag.mode==='rotate'){
  n.transform.rotation[1]=snapValue(drag.base.rotation[1]+(e.clientX-drag.start.x)*.012);
 }else if(drag.mode==='scale'){
  const factor=Math.max(.1,1+(e.clientX-drag.start.x)/190);
  n.transform.scale=drag.base.scale.map(v=>Math.max(.01,Number((v*factor).toFixed(3))));
 }
 try{doc=validateDocument(next);rebuild();}
 catch{/* Drag stays on last valid snapshot. */}
});
function finishCanvas(e){
 pointers.delete(e.pointerId);touchSpan=null;
 if(!drag||drag.pointerId!==e.pointerId)return;
 if(['move','rotate','scale'].includes(drag.mode)){
  const after=clone(doc),before=drag.previous;drag=null;doc=before;
  commit(after,selected,'Updated selected shape transform.');
 }else drag=null;
}
canvas.addEventListener('pointerup',finishCanvas);canvas.addEventListener('pointercancel',finishCanvas);
canvas.addEventListener('wheel',e=>{
 e.preventDefault();
 if(view==='quarter')orbit.distance=Math.max(1,Math.min(35,orbit.distance*Math.exp(e.deltaY*.001)));
 else {orthoScale=Math.max(.15,Math.min(16,orthoScale*Math.exp(e.deltaY*.001)));setCamera();}
 requestDraw();
},{passive:false});

function switchTab(which){
 for(const b of document.querySelectorAll('[data-tab]'))b.classList.toggle('active',b.dataset.tab===which);
 for(const tab of ['objects','library','reference'])$('tab-'+tab).hidden=tab!==which;
}
for(const b of document.querySelectorAll('[data-tab]'))b.onclick=()=>switchTab(b.dataset.tab);
async function saveSelected(type){
 const n=node();if(!n||n.id==='root')return message('Select a shape or subgroup.',true);
 const name=window.prompt('Name new '+type+':',n.name);if(!name)return;
 try{
  const asset=makeAsset(doc,selected,type,name);
  await db.saveAsset(asset);await renderLibrary();
  message('Saved '+type+' "'+name+'" to reusable library.');switchTab('library');
 }catch(e){message('Could not save asset: '+e.message,true);}
}
$('save-shape').onclick=()=>saveSelected('shape');
$('save-part').onclick=()=>saveSelected('part');
$('save-assembly').onclick=()=>saveSelected('assembly');
async function renderLibrary(){
 const box=$('library-items');if(!ready)return;
 try{
  const [assets,projects]=await Promise.all([db.all('assets'),db.all('projects')]);
  const projectsBox=$('project-items');projectsBox.replaceChildren();
  for(const project of projects.filter(p=>p?.format===FORMAT).sort((a,b)=>(b.metadata?.updated||0)-(a.metadata?.updated||0))){
   const item=document.createElement('div');item.className='asset-item';
   const title=document.createElement('span'),name=document.createElement('strong'),btn=document.createElement('button');
   name.textContent=project.name;title.append(name);
   const sub=document.createElement('small');
   sub.textContent=project.id===doc.id?'CURRENT PROJECT':((project.nodes?.length||1)-1)+' NODES';
   title.append(sub);btn.textContent=project.id===doc.id?'OPEN':'OPEN PROJECT';
   btn.onclick=async()=>{
    if(project.id===doc.id)return switchTab('objects');
    if(!confirm('Open '+project.name+'? Unsaved edits should be saved or exported first.'))return;
    try{
     await savePromise;
     await db.saveProject(doc);
     doc=validateDocument(project);
     startHistory();await loadReferences();refresh();switchTab('objects');
     message('Opened '+doc.name+' from project library.');
    }catch(e){message('Project could not open: '+e.message,true);}
   };
   item.append(title,btn);projectsBox.append(item);
  }
  const search=$('library-search').value.toLowerCase();
  box.replaceChildren();
  for(const asset of assets.filter(a=>a.format==='m3ch4.workbench.asset'&&a.name.toLowerCase().includes(search))){
   const el=document.createElement('div');el.className='asset-item';
   const label=document.createElement('span'),actions=document.createElement('span');
   const title=document.createElement('strong');title.textContent=asset.name;
   const meta=document.createElement('small');meta.textContent=asset.type.toUpperCase()+' · REV '+asset.revision;
   label.append(title,meta);
   const btn=document.createElement('button');btn.textContent='INSERT';
   btn.onclick=()=>{
    try{const out=insertAsset(doc,asset);commit(out.document,out.selectedId,'Inserted '+asset.name+'.');switchTab('objects');}
    catch(e){message('Insert rejected: '+e.message,true);}
   };
   const rename=document.createElement('button');rename.textContent='✎';rename.title='Rename asset';
   rename.onclick=async()=>{
    const next=prompt('Rename asset',asset.name);
    if(!next?.trim())return;
    try{asset.name=next.trim().slice(0,100);await db.saveAsset(asset);renderLibrary();message('Asset renamed.');}
    catch(e){message('Rename failed: '+e.message,true);}
   };
   const del=document.createElement('button');del.textContent='×';del.title='Delete asset';
   del.onclick=async()=>{
    if(!confirm('Delete '+asset.name+' from this browser library? Export a backup first.'))return;
    try{await db.remove('assets',asset.id);renderLibrary();message('Deleted saved library asset.');}
    catch(e){message('Delete failed: '+e.message,true);}
   };
   actions.style.cssText='display:flex;flex-wrap:wrap;gap:4px';
   actions.append(btn,rename,del);el.append(label,actions);box.append(el);
  }
  if(!box.children.length)box.textContent='Library empty. Save a shape or part from OBJECTS.';
 }catch(e){box.textContent='Library unavailable: '+e.message;}
}

$('library-search').oninput=()=>renderLibrary();
const download=(name,value)=>{
 const blob=new Blob([JSON.stringify(value,null,2)],{type:'application/json'});
 const href=URL.createObjectURL(blob),a=document.createElement('a');a.href=href;a.download=name;
 a.click();setTimeout(()=>URL.revokeObjectURL(href),10000);
};
$('export-bundle').onclick=async()=>{
 try{const bundle=await db.exportBundle(doc);download('M3CH4-'+doc.name.replace(/[^a-z0-9-]/gi,'_')+'.json',bundle);
  message('Exported editable project, assets and references.');}
 catch(e){message('Export failed: '+e.message,true);}
};
$('import-bundle').onclick=()=>$('bundle-file').click();
$('bundle-file').onchange=async e=>{
 const file=e.target.files?.[0];if(!file)return;
 try{
  if(file.size>15e6)throw Error('Maximum 15 MB per bundle.');
  const imported=await db.importBundle(JSON.parse(await file.text()));
  doc=imported;startHistory();await loadReferences();refresh();message('Imported project bundle.');
 }catch(error){message('Import rejected: '+error.message,true);}
 e.target.value='';
};

function makeReferenceImage(){return doc.references.find(r=>r.id===activeRef);}
async function loadReferences(){
 referenceObjects=new Map();
 await Promise.all(doc.references.map(async r=>{
  try{const img=await db.get('images',r.imageId);if(img)referenceObjects.set(r.imageId,img);}
  catch{/* Missing image remains hidden and exportable draft remains intact. */}
 }));
 activeRef=doc.references[0]?.id||null;
}
function renderReferences(){
 const list=$('reference-items');list.replaceChildren();
 for(const ref of doc.references){
  const b=document.createElement('button');b.className='tree-item'+(ref.id===activeRef?' active':'');
  b.textContent=ref.view.toUpperCase()+' · '+(referenceObjects.get(ref.imageId)?.name||ref.imageId);
  b.onclick=()=>{activeRef=ref.id;renderReferences();};
  list.append(b);
 }
 const ref=makeReferenceImage();
 $('reference-opacity').disabled=!ref;$('reference-width').disabled=!ref;
 $('reference-x').disabled=!ref;$('reference-y').disabled=!ref;
 if(ref){
  $('reference-opacity').value=ref.opacity;$('reference-width').value=ref.scale;
  $('reference-x').value=ref.offset[0];$('reference-y').value=ref.offset[1];
 }
 $('module-manifest').value=doc.metadata?.moduleManifest?JSON.stringify(doc.metadata.moduleManifest,null,2):'';
}
function setReference(change){
 const idx=doc.references.findIndex(r=>r.id===activeRef);if(idx<0)return;
 const next=clone(doc);Object.assign(next.references[idx],change);
 try{commit(next,selected,'Reference calibration updated.');}
 catch(e){message(e.message,true);}
}
$('reference-file').onchange=async e=>{
 const file=e.target.files?.[0];if(!file)return;
 try{
  const img=await db.importImage(file),ref={
   id:'ref-'+crypto.randomUUID(),imageId:img.id,
   view:$('reference-view').value,opacity:.35,scale:1,offset:[0,0],rotation:0
  };
  referenceObjects.set(img.id,img);
  const next=clone(doc);next.references=next.references.filter(r=>r.view!==ref.view);next.references.push(ref);
  activeRef=ref.id;commit(next,selected,'Reference image saved in '+ref.view.toUpperCase()+'.');
  view=['front','side','top'].includes(ref.view)?ref.view:view;setCamera();refresh();switchTab('reference');
 }catch(error){message('Image rejected: '+error.message,true);}
 e.target.value='';
};
$('reference-opacity').oninput=e=>setReference({opacity:Number(e.target.value)});
$('reference-width').onchange=e=>setReference({scale:Number(e.target.value)});
$('reference-x').onchange=e=>{
 const ref=makeReferenceImage();if(ref)setReference({offset:[Number(e.target.value),ref.offset[1]]});
};
$('reference-y').onchange=e=>{
 const ref=makeReferenceImage();if(ref)setReference({offset:[ref.offset[0],Number(e.target.value)]});
};
$('apply-manifest').onclick=()=>{
 try{
  const data=JSON.parse($('module-manifest').value);
  if(!Array.isArray(data)||data.length>50||data.some(n=>typeof n.name!=='string'||n.name.length>100))
   throw Error('Expected an array of up to 50 named modules.');
  const next=clone(doc);next.metadata={...(next.metadata||{}),moduleManifest:data};
  commit(next,selected,'Module breakdown saved as project notes.');
 }catch(e){message('Manifest rejected: '+e.message,true);}
};
window.addEventListener('error',e=>message('Editor runtime error: '+e.message,true));
window.addEventListener('unhandledrejection',e=>message('Editor error: '+(e.reason?.message||e.reason),true));
async function initialize(){
 sceneSetup();
 try{
  const loaded=await db.lastProject();
  if(loaded)doc=validateDocument(loaded);
  else{
   let legacy;
   try{legacy=localStorage.getItem('m3ch4-part-workbench-calf-v1');}catch{}
   if(legacy){try{doc=migrateCalfRecipe(JSON.parse(legacy));}catch(e){console.warn('V1 draft not migrated',e);}}
   await db.saveProject(doc);
  }
  await loadReferences();
  startHistory();ready=true;refresh();message(loaded?'Opened saved Workbench project.':'Ready. Add geometry or edit your imported V1 calf.');
  window.__m3ch4WorkbenchV2Ready=true;
 }catch(e){
  ready=true;startHistory();refresh();
  message('IndexedDB unavailable ('+e.message+'). Geometry editing works; export for backup.',true);
  window.__m3ch4WorkbenchV2Ready=true;
 }
}
initialize();
