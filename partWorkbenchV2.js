/** M3CH4 V2 — multi-object blueprint editor, no career or combat writes. */
import * as THREE from 'three';
import {FORMAT,VERSION,clone,createDocument,newShape,addNode,updateNode,removeNode,
 duplicateNode,mirrorNode,groupNodes,makeAsset,insertAsset,validateDocument,validateGeometry,migrateCalfRecipe,identity} from './workbench/blueprint.js';
import {compileBlueprint,compileGeometry,disposeBlueprint,measureBlueprint} from './workbench/geometry.js';
import * as db from './workbench/storage.js';
import {orbitAfterDrag,cameraPose,cameraFacing} from './workbench/orbitCamera.js?v=orbit360';
import {packagePrototype,PROTOTYPE_KEY} from './workbench/prototypeBridge.js';
import {buildExteriorRig} from './scene.js';
import {makeTestAssembly} from './components.js';
import {factoryCatalogueOptions,importFactoryPart,importFactoryAssembly,importSavedGarageBay} from './workbench/factoryImport.js';
import {meshPointPage,meshPointGroups,updateMeshPoint} from './workbench/editableMesh.js';
import {rectFromPoints,selectedInRectangle} from './workbench/selectionGeometry.js';
import {transformMeshGroups,transformProfilePoints} from './workbench/vertexTransforms.js';
import {validateStandaloneAsset} from './workbench/assetImport.js';
import {inspectBlueprint} from './workbench/geometryAudit.js';
import {moveLoftControls} from './workbench/loftTransforms.js';
import {insertProfilePoint,insertLoftSection} from './workbench/meshTopology.js';
import {bakeXReflection} from './workbench/mirrorGeometry.js';
import {selectableElements,modifyElementVertexSelection} from './workbench/elementSelection.js';
import {moveNodeToParent,groupPreservingPose,ungroupPreservingPose} from './workbench/hierarchyTransforms.js';
import {thumbnailForDocument,thumbnailForPrimitive,thumbnailForAsset} from './workbench/thumbnail.js';

const $=id=>document.getElementById(id),rad=n=>n*Math.PI/180,deg=n=>n*180/Math.PI;
let doc=createDocument('Untitled assembly'),current=null,history=[],step=0,selected='root',selectedIds=new Set();
let view='quarter',tool='select',showContext=false,context=null,compiled=null;
let camera,renderer,scene,grid,raycaster=new THREE.Raycaster(),orthoScale=2.7;
let referenceObjects=new Map(),activeRef=null,drag=null,pointers=new Map(),touchSpan=null;
let orbit={yaw:.65,pitch:.32,distance:3.9},focus=new THREE.Vector3();
let meshPointPageIndex=0,meshPointSelectedIndex=0;
let activePoint=null,visibilityMode='all',pointSliderStart=null;
let displayMode='solid',pointDepth='visible',pointPick='tap',selectionOp='replace';
let selectedPoints=new Set(),marquee=null,touchCenter=null;
let navigating=false,objectMultiSelect=false,collapsedGroups=new Set(),editingLevel='point';
let comparison={mode:'off',definitionId:null,compiled:null};
const comparisonSource=()=>doc.metadata?.source?.definitionId||doc.metadata?.factoryDefinitionId||null;
function discardComparison(){
 if(comparison.compiled){comparison.compiled.root.parent?.remove(comparison.compiled.root);
  disposeBlueprint(comparison.compiled.root);}
 comparison={mode:'off',definitionId:null,compiled:null};
}
function updateComparisonUI(){
 const btn=$('compare-original');if(!btn)return;
 btn.disabled=!comparisonSource();
 btn.textContent='COMPARE ORIGINAL: '+comparison.mode.toUpperCase().replace('SPLIT','SIDE BY SIDE');
}
function applyComparisonLayout(){
 if(!compiled||comparison.mode==='off'||showContext)return;
 const source=comparisonSource();
 if(!source){discardComparison();updateComparisonUI();return;}
 if(comparison.definitionId!==source||!comparison.compiled){
  const wanted=comparison.mode;discardComparison();
  try{
   const model=importFactoryPart(source);
   comparison={mode:wanted,definitionId:source,compiled:compileBlueprint(model.document)};
   scene.add(comparison.compiled.root);
  }catch(e){discardComparison();message('Factory comparison unavailable: '+e.message,true);return;}
 }
 compiled.root.position.set(0,0,0);
 const original=comparison.compiled.root;original.position.set(0,0,0);
 original.traverse(o=>{if(!o.isMesh)return;
  for(const m of(Array.isArray(o.material)?o.material:[o.material])){
   m.opacity=comparison.mode==='overlay'?.22:1;
   m.transparent=comparison.mode==='overlay';m.depthWrite=comparison.mode!=='overlay';m.needsUpdate=true;
  }
 });
 if(comparison.mode==='split'){
  original.updateMatrixWorld(true);compiled.root.updateMatrixWorld(true);
  const factoryBox=new THREE.Box3().setFromObject(original),draftBox=new THREE.Box3().setFromObject(compiled.root);
  const factorySize=factoryBox.getSize(new THREE.Vector3()),draftSize=draftBox.getSize(new THREE.Vector3());
  const gap=Math.max(.45,Math.max(factorySize.x,draftSize.x)*.35);
  const x=Math.max(factorySize.x,draftSize.x)/2+gap;
  original.position.x=x-factoryBox.getCenter(new THREE.Vector3()).x;
  compiled.root.position.x=-x-draftBox.getCenter(new THREE.Vector3()).x;
 }
 original.updateMatrixWorld(true);compiled.root.updateMatrixWorld(true);
 updateComparisonUI();
}
const elementCache=new WeakMap();
function editingElements(g){
 let record=elementCache.get(g);if(!record){record=new Map();elementCache.set(g,record);}
 if(!record.has(editingLevel))record.set(editingLevel,selectableElements(g,editingLevel));
 return record.get(editingLevel);
}
const isEditGesture=()=>!!drag&&drag.mode!=='orbit';
function cancelActivePreview(note){
 let changed=false;
 if(isEditGesture()&&drag.previous){doc=clone(drag.previous);drag=null;changed=true;}
 if(pointSliderStart){doc=clone(pointSliderStart);pointSliderStart=null;changed=true;}
 if(marquee){marquee=null;changed=true;}
 if(changed){rebuild();renderInspector();updateContextPanel();requestDraw();}
 if(changed&&note)message(note);
 return changed;
}
function cancelSliderPreview(){
 if(!pointSliderStart)return;
 doc=clone(pointSliderStart);pointSliderStart=null;rebuild();renderInspector();updateContextPanel();
 message('Slider edit cancelled.');
}
const pointKey=entry=>entry.kind+':'+entry.index;
const parsePointKey=key=>{const [kind,index]=key.split(':');return {kind,index:Number(index)};};
function activePointKeys(){return [...selectedPoints].map(parsePointKey);}
function activeGroupIndices(){return [...selectedPoints].filter(k=>k.startsWith('factory-mesh:')).map(k=>Number(k.split(':')[1]));}
function applyBatchDelta(previous,delta,scale=[1,1,1]){
 const source=previous.nodes.find(n=>n.id===selected),g=source?.geometry;
 if(!g)throw Error('Select a valid editable part');
 if(g.type==='mesh')return transformMeshGroups(g,activeGroupIndices(),{delta,scale});
 if(g.profile)return transformProfilePoints(g,activePointKeys().filter(p=>p.kind==='profile').map(p=>p.index),{delta,scale});
 if(g.type==='loft'){
  if(scale.some(v=>v!==1))throw Error('Loft group scaling requires section parameters; use Move instead.');
  return moveLoftControls(g,activePointKeys(),{delta});
 }
 throw Error('Unsupported group geometry');
}
function previewBatchGeometry(geometry){
 const n=findNode(selected);if(!n)return;
 n.geometry=geometry;const obj=compiled?.objects.get(selected);
 if(obj?.isMesh){const old=obj.geometry;obj.geometry=compileGeometry(geometry);old.dispose();}
 requestDraw();
}

const axisKeys=['X','Y','Z'];
const findNode=id=>doc.nodes.find(n=>n.id===id);
function pointCoordinates(which=activePoint,document=doc){
 if(!which)return null;
 const n=document.nodes.find(n=>n.id===which.nodeId),g=n?.geometry;
 if(!g||n.locked||n.mirrorOf||n.kind!=='shape')return null;
 if(g.type==='mesh')return meshPointGroups(g)[which.index]?.position.slice()||null;
 if(g.profile&&which.kind==='profile'){
  const p=g.profile[which.index];return p?[p[0],p[1],0]:null;
 }
 if(g.sections){
  const p=g.sections[which.index];if(!p)return null;
  return [which.kind==='width'||which.kind==='topWidth'?-p.width/2:p.width/2,
   p.y,which.kind==='back'||which.kind==='topBack'?p.back:p.front];
 }
 return null;
}
function setPointCoordinates(nextPos,which=activePoint,original=doc){
 const n=original.nodes.find(n=>n.id===which?.nodeId);
 if(!n||n.locked||n.mirrorOf||n.kind!=='shape')throw Error('Select an editable point');
 const geometry=clone(n.geometry);
 if(geometry.type==='mesh')return updateMeshPoint(geometry,which.index,nextPos);
 if(geometry.profile&&which.kind==='profile'){
  geometry.profile[which.index]=nextPos.slice(0,2);
 }else if(geometry.sections){
  const entry=geometry.sections[which.index];
  if(['width','topWidth'].includes(which.kind))
   entry.width=Math.max(.02,Math.abs(nextPos[0])*2);
  if(which.kind==='front')entry.front=Math.min(entry.back-.02,nextPos[2]);
  if(['back','topBack'].includes(which.kind))entry.back=Math.max(entry.front+.02,nextPos[2]);
  entry.y=nextPos[1];
 }else throw Error('This geometry has no control points');
 return validateGeometry(geometry);
}
function previewPointGeometry(geometry,which=activePoint){
 const n=findNode(which.nodeId);if(!n)return;
 n.geometry=geometry;
 const visual=compiled?.objects.get(n.id);
 if(visual?.isMesh){
  const previous=visual.geometry;
  visual.geometry=compileGeometry(geometry);
  previous.dispose();
 }
 requestDraw();
}
function selectPoint(which){
 const key=pointKey(which);
 if(selectionOp==='subtract')selectedPoints.delete(key);
 else if(selectionOp==='add'){selectedPoints.add(key);}
 else if(!(selectedPoints.size>1&&selectedPoints.has(key))){selectedPoints=new Set([key]);}
 activePoint=selectedPoints.has(key)?{nodeId:which.nodeId,kind:which.kind,index:which.index}:
  (selectedPoints.size?{nodeId:which.nodeId,...parsePointKey([...selectedPoints][0])}:null);
 if(which.kind==='factory-mesh')meshPointSelectedIndex=which.index;
 updateContextPanel();requestDraw();
}
function clearPoint(){activePoint=null;selectedPoints.clear();pointSliderStart=null;updateContextPanel();}
function selectedIsDescendant(id){
 if(!selected||selected==='root')return false;
 let key=id;
 const visited=new Set();
 while(key&&!visited.has(key)){
  if(key===selected)return true;
  visited.add(key);key=findNode(key)?.parentId;
 }
 return false;
}
function applyVisibility(){
 if(!compiled)return;
 // When isolating, the optional reference rig must not obscure the part.
 if(context?.root)context.root.visible=visibilityMode!=='isolate';
 for(const n of doc.nodes){
  const obj=compiled.objects.get(n.id);
  if(!obj||!obj.isMesh)continue;
  const isSelected=selectedIsDescendant(n.id);
  obj.visible=n.visible!==false&&(visibilityMode!=='isolate'||isSelected);
  const mats=Array.isArray(obj.material)?obj.material:[obj.material];
  for(const m of mats){
   if(!m.userData.workbenchBase)m.userData.workbenchBase={
    opacity:m.opacity,transparent:m.transparent,depthWrite:m.depthWrite,depthTest:m.depthTest,wireframe:m.wireframe,side:m.side
   };
   const base=m.userData.workbenchBase;
   const ghost=visibilityMode==='ghost'&&!isSelected;
   const xray=displayMode==='xray';
   m.opacity=xray?(isSelected?.22:.09):(ghost?.14:base.opacity);
   m.transparent=xray||ghost||base.transparent;
   m.depthWrite=(xray||ghost)?false:base.depthWrite;
   m.depthTest=base.depthTest;
   m.wireframe=displayMode==='wire';
   m.side=xray?THREE.DoubleSide:base.side;
   m.needsUpdate=true;
  }
 }
 requestDraw();
}
function updateContextPanel(){
 const n=node(),active=n&&selected!=='root',point=activePoint?.nodeId===selected?pointCoordinates():null;
 const count=selectedPoints.size;
 $('point-mode-toolbar').hidden=tool!=='points'||!active||n.kind!=='shape';
 for(const [id,v] of [['point-tap',pointPick==='tap'],['point-box',pointPick==='box'],
  ['select-add',selectionOp==='add'],['select-subtract',selectionOp==='subtract'],
  ['display-solid',displayMode==='solid'],['display-wire',displayMode==='wire'],['display-xray',displayMode==='xray'],
  ['depth-visible',pointDepth==='visible'],['depth-through',pointDepth==='through'],
  ['edit-level-point',editingLevel==='point'],['edit-level-edge',editingLevel==='edge'],
  ['edit-level-face',editingLevel==='face']])
   $(id).classList.toggle('active',v);
 const audit=inspectBlueprint(doc);
 $('geometry-audit').textContent=audit.shapes+' shapes · '+audit.vertices+' imported vertices · '+audit.triangles+' triangles'+
  (audit.warnings.length?' · '+audit.warnings[0]:'');
 $('context-edit').hidden=!active;
 $('selection-actions').hidden=!active;
 if(!active){visibilityMode='all';applyVisibility();return;}
 $('context-title').textContent=count>1?count+' POINTS SELECTED':point?'POINT '+(activePoint.index+1):'SELECTED · '+n.name;
 $('context-value').textContent=count>1?'RELATIVE TRANSFORM · METRES':point?point.map((v,i)=>axisKeys[i]+' '+v.toFixed(3)).join('  ·  '):n.kind.toUpperCase();
 $('point-controls').hidden=!point;
 for(const m of ['all','ghost','isolate'])
  $('visibility-'+(m==='all'?'normal':m)).classList.toggle('active',visibilityMode===m);
 const b=$('point-axis-controls');b.replaceChildren();
 if(!point)return;
 if(count>1){
  for(let axis=0;axis<3;axis++){
   const row=document.createElement('label');row.className='axis-row';
   const name=document.createElement('strong');name.textContent=axisKeys[axis]+' Δ';
   const slider=document.createElement('input');slider.type='range';slider.min='-.5';slider.max='.5';slider.step='.005';slider.value='0';
   slider.dataset.axis=axis;slider.setAttribute('aria-label','Relative '+axisKeys[axis]+' offset for '+count+' points');
   const read=document.createElement('input');read.type='number';read.min='-10';read.max='10';read.step='.005';read.value='0';
   read.setAttribute('aria-label','Exact relative displacement in metres');
   slider.addEventListener('pointerdown',()=>{pointSliderStart=clone(doc);});
   slider.addEventListener('input',()=>{
    if(!pointSliderStart)pointSliderStart=clone(doc);
    const delta=[0,0,0];delta[axis]=snapValue(Number(slider.value));
    try{previewBatchGeometry(applyBatchDelta(pointSliderStart,delta));
     read.value=delta[axis].toFixed(3);
    }catch(e){message(e.message,true);}
   });
   const finish=()=>{
    if(!pointSliderStart)return;const before=pointSliderStart,after=clone(doc);
    pointSliderStart=null;doc=before;commit(after,selected,'Moved '+count+' selected points.');
    updateContextPanel();
   };
   slider.addEventListener('change',finish);slider.addEventListener('pointercancel',cancelSliderPreview);
   read.addEventListener('change',()=>{
    const value=Number(read.value);if(!Number.isFinite(value)||Math.abs(value)>10)return message('Offset outside 10 metre range.',true);
    try{
     const snapshot=clone(doc),delta=[0,0,0];delta[axis]=snapValue(value);
     const next=clone(doc);next.nodes.find(n=>n.id===selected).geometry=applyBatchDelta(snapshot,delta);
     commit(next,selected,'Moved '+count+' vertices by '+delta[axis].toFixed(3)+'m.');
    }catch(e){message(e.message,true);}
   });
    row.append(name,slider,read);b.append(row);
  }
  if(n.geometry.type==='mesh'||n.geometry.profile){
   for(let axis=0;axis<3;axis++){
    if(n.geometry.profile&&axis===2)continue;
    const row=document.createElement('label');row.className='axis-row';
    const name=document.createElement('strong');name.textContent=axisKeys[axis]+' ×';
    const slider=document.createElement('input');slider.type='range';slider.min='.5';slider.max='1.5';slider.step='.025';slider.value='1';
    slider.setAttribute('aria-label','Scale selected points on '+axisKeys[axis]);
    const read=document.createElement('input');read.type='number';read.min='.05';read.max='10';read.step='.025';read.value='1';
    read.setAttribute('aria-label','Exact axis scale multiplier');
    slider.addEventListener('pointerdown',()=>{pointSliderStart=clone(doc);});
    slider.addEventListener('input',()=>{
     if(!pointSliderStart)pointSliderStart=clone(doc);
     const scale=[1,1,1];scale[axis]=Number(slider.value);
     try{previewBatchGeometry(applyBatchDelta(pointSliderStart,[0,0,0],scale));
      read.value=scale[axis].toFixed(3);}
     catch(e){message(e.message,true);}
    });
    const finish=()=>{
     if(!pointSliderStart)return;const before=pointSliderStart,after=clone(doc);
     pointSliderStart=null;doc=before;commit(after,selected,'Scaled '+count+' selected points.');
     updateContextPanel();
    };
    slider.addEventListener('change',finish);slider.addEventListener('pointercancel',cancelSliderPreview);
    read.addEventListener('change',()=>{
     const value=Number(read.value);if(!Number.isFinite(value)||value<=0||value>10)return message('Invalid scale factor.',true);
     try{
      const snapshot=clone(doc),scale=[1,1,1];scale[axis]=value;
      const next=clone(doc);next.nodes.find(n=>n.id===selected).geometry=applyBatchDelta(snapshot,[0,0,0],scale);
      commit(next,selected,'Scaled '+count+' selected vertices.');
     }catch(e){message(e.message,true);}
    });
    row.append(name,slider,read);b.append(row);
   }
  }
  return;
 }
 const editable=n.geometry.type==='mesh'?[0,1,2]:
  n.geometry.profile?[0,1]:n.geometry.sections?
   activePoint.kind==='width'||activePoint.kind==='topWidth'?[0,1]:
    [1,2]:[];
 for(const axis of editable){
  const row=document.createElement('label');row.className='axis-row';
  const title=document.createElement('strong');title.textContent=axisKeys[axis];
  const range=document.createElement('input');range.type='range';range.step='.005';
  range.min=String(Math.max(-100,point[axis]-.6));
  range.max=String(Math.min(100,point[axis]+.6));
  range.value=String(point[axis]);range.dataset.axis=String(axis);
  range.setAttribute('aria-label',axisKeys[axis]+' point coordinate in metres');
  const read=document.createElement('output');read.textContent=point[axis].toFixed(3);
  range.addEventListener('pointerdown',()=>{pointSliderStart=clone(doc);});
  range.addEventListener('input',()=>{
   if(!pointSliderStart)pointSliderStart=clone(doc);
   const original=pointCoordinates(activePoint,pointSliderStart);if(!original)return;
   const next=original.slice();next[axis]=snapValue(Number(range.value));
   try{
    previewPointGeometry(setPointCoordinates(next,activePoint,pointSliderStart));
    read.textContent=next[axis].toFixed(3);
    $('context-value').textContent=next.map((v,i)=>axisKeys[i]+' '+v.toFixed(3)).join(' · ');
   }catch(e){message(e.message,true);}
  });
  const finish=()=>{
   if(!pointSliderStart)return;
   const before=pointSliderStart,after=clone(doc);pointSliderStart=null;doc=before;
   commit(after,selected,'Adjusted point '+axisKeys[axis]+'.');
   updateContextPanel();
  };
  range.addEventListener('change',finish);
  range.addEventListener('pointercancel',cancelSliderPreview);
  row.append(title,range,read);b.append(row);
 }
}

let thumbEpoch=0,browseListMode=false,browseFilter='',thumbCache=new Map(),thumbObserver=null;
let saveTimer=null,savePromise=Promise.resolve(),drawPending=false,ready=false;
const canvas=$('stage-canvas'),stage=$('stage'),svg=$('edit-overlay'),NS='http://www.w3.org/2000/svg';
const snap=()=>Number($('snap').value)||0;
const snapValue=v=>snap()?Math.round(v/snap())*snap():v;
const node=()=>doc.nodes.find(n=>n.id===selected);
const message=(s,error=false)=>{const e=$('status');e.textContent=s;e.style.color=error?'#efa596':'#e1ba7b';};
function startHistory(){
 history=[clone(doc)];step=0;selected='root';selectedIds.clear();activePoint=null;selectedPoints.clear();
}
function commit(next,selection=selected,notify){
 try{
  const valid=validateDocument(next);
  if(JSON.stringify(valid)===JSON.stringify(doc))return;
  doc=valid;selected=selection;
 if(activePoint?.nodeId!==selected){activePoint=null;selectedPoints.clear();}
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
 const pointSelection=new Set(selectedPoints),previousActive=activePoint;
 step=next;doc=clone(history[step]);thumbEpoch++;thumbCache.clear();
 if(!doc.nodes.some(n=>n.id===selected))selected='root';
 const n=doc.nodes.find(x=>x.id===selected);
 const available=new Set(n?.kind==='shape'&&!n.locked&&!n.mirrorOf?
  shapePointHandles(n.geometry,view).map(pointKey):[]);
 selectedPoints=new Set([...pointSelection].filter(key=>available.has(key)));
 activePoint=previousActive&&selectedPoints.has(pointKey(previousActive))?previousActive:
  (selectedPoints.size?{nodeId:selected,...parsePointKey([...selectedPoints][0])}:null);
 queueSave();refresh();
}
const thumbnailKey=(id)=>doc.id+'/'+thumbEpoch+'/'+id;
function makeTile(nodeData,docOrAsset,type='shape',name=nodeData?.name||'',meta=''){
 const tile=document.createElement('button');
 tile.type='button';tile.className='part-tile';tile.title=name;
 const img=document.createElement('img');img.alt='Preview of '+name;
 img.loading='lazy';img.dataset.thumbtype=type;img.dataset.thumbid=nodeData?.id||'root';
 const label=document.createElement('span');label.className='tile-title';label.textContent=name;
 const note=document.createElement('span');note.className='tile-meta';note.textContent=meta;
 tile.append(img,label,note);
 // Thumbnails use real authored mesh triangles, not generic decorative icons.
 if(type==='node')img._renderPreview=()=>thumbnailForDocument(doc,nodeData.id,140,100);
 else if(type==='asset')img._renderPreview=()=>thumbnailForAsset(docOrAsset);
 else if(type==='project')img._renderPreview=()=>thumbnailForDocument(docOrAsset,'root',140,100);
 else if(type==='primitive')img._renderPreview=()=>thumbnailForPrimitive(nodeData);
 else if(type==='factory')img._renderPreview=()=>{
  const model=importFactoryPart(nodeData.id);
  return thumbnailForDocument(model.document,'root',140,100);
 };
 if(thumbObserver)thumbObserver.observe(img);else renderThumb(img);
 return tile;
}
function renderThumb(img){
 if(!img.isConnected)return;
 const key=img.dataset.thumbtype+'/'+img.dataset.thumbid+
  (img.dataset.thumbtype==='node'?'/'+thumbnailKey(img.dataset.thumbid):'');
 let result=thumbCache.get(key);
 if(!result){try{result=img._renderPreview?.()||'';if(result)thumbCache.set(key,result);}
  catch(e){console.warn('Workbench preview unavailable',img.dataset.thumbid,e.message);}
 }
 if(result)img.src=result;
 else{img.style.display='none';const fallback=document.createElement('span');
  fallback.className='tile-thumb';fallback.textContent='◇';img.parentElement?.insertBefore(fallback,img);}
 thumbObserver?.unobserve(img);
}
function setupThumbnails(){
 if(typeof IntersectionObserver==='function'){
  thumbObserver=new IntersectionObserver(entries=>{
   for(const entry of entries)if(entry.isIntersecting)renderThumb(entry.target);
  },{rootMargin:'80px'});
 }
}
function selectedFeedback(){
 const n=node(),active=n&&n.id!=='root';
 $('selection-chip').hidden=!active;
 if(active){
  $('selection-name').textContent=n.name;
  $('selection-actions').hidden=false;
  $('focus-selected').disabled=!compiled?.objects.get(selected);

 }
}
function fitSelected(targetId=selected){
 const obj=compiled?.objects.get(targetId==='root'?'root':targetId);
 if(!obj)return;
 const bounds=new THREE.Box3().setFromObject(obj);
 if(targetId==='root'&&comparison.mode==='split'&&comparison.compiled)
  bounds.union(new THREE.Box3().setFromObject(comparison.compiled.root));
 if(bounds.isEmpty())return;
 const size=bounds.getSize(new THREE.Vector3());
 focus.copy(bounds.getCenter(new THREE.Vector3()));
 const h=Math.max(.08,size.y),w=Math.max(.08,size.x,size.z);
 const aspect=Math.max(.45,stage.clientWidth/Math.max(1,stage.clientHeight));
 const halfFov=Math.PI*38/360;
 orbit.distance=Math.max(.33,Math.min(40,Math.max(h/(2*Math.tan(halfFov)),w/(2*Math.tan(halfFov)*aspect))*1.52));
 orthoScale=Math.max(.12,Math.min(30,Math.max(h/2,w/(2*aspect))*1.28));
 updateCamera();requestDraw();
}

function replaceProjectWithFactory(result){
 const imported=result.document;
 const next=clone(imported);
 // A factory model is an editable COPIED project. Keep previous projects in
 // the IndexedDB library, and never mutate source engine geometry.
 doc=validateDocument(next);
 // An entire imported factory rig must never accidentally be parented inside
 // the previous project's Yardwalker knee context.
 showContext=false;buildContext();
 meshPointPageIndex=0;meshPointSelectedIndex=0;startHistory();
 const importedBounds=compileBlueprint(doc);
 const bounds=measureBlueprint(importedBounds.root);
 disposeBlueprint(importedBounds.root);
 if(!bounds.empty){
  const max=Math.max(...bounds.size);
  orbit.distance=Math.max(.45,Math.min(25,max*1.6));
  orthoScale=Math.max(.42,Math.min(10,max*.9));
  setCamera();
 }
 queueSave();refresh();
 selected=doc.nodes.find(n=>n.parentId==='root')?.id||'root';
 renderTree();renderInspector();selectedFeedback();fitSelected();requestDraw();
 message('Opened '+result.meshCount+' authentic game meshes and '+result.groupCount+
  ' named groups. Select a MESH in the hierarchy to edit points; select the top group to SAVE the complete part or assembly.');
}
function remapImportedNodes(target,source){
 const next=clone(target),map=new Map();
 const unique=()=>('factory-insert-'+(crypto.randomUUID?.()||Math.random().toString(36).slice(2)));
 for(const n of source.nodes)if(n.id!=='root')map.set(n.id,unique());
 for(const n of source.nodes){
  if(n.id==='root')continue;
  const copy=clone(n);copy.id=map.get(n.id);
  copy.parentId=map.get(n.parentId)||'root';
  copy.mirrorOf=map.get(n.mirrorOf)||null;
  next.nodes.push(copy);
 }
 const top=source.nodes.find(n=>n.parentId==='root');
 return {document:validateDocument(next),selectedId:map.get(top?.id)||'root'};
}
async function openFactoryPart(insert=false){
 const id=$('factory-part-select').value;
 if(!id)return message('Select a game component.',true);
 try{
  const result=importFactoryPart(id);
  if(insert){
   const {document,selectedId}=remapImportedNodes(doc,result.document);
   commit(document,selectedId,'Inserted authentic '+id+' factory geometry into this project.');
   return;
  }
  await savePromise;await db.saveProject(doc);
  replaceProjectWithFactory(result);
 }catch(e){message('Could not import game part: '+e.message,true);console.error(e);}
}
async function openFactoryRig(kind){
 try{
  const result=importFactoryAssembly(kind);
  await savePromise;await db.saveProject(doc);
  replaceProjectWithFactory(result);
 }catch(e){message('Could not open game assembly: '+e.message,true);console.error(e);}
}
async function openCareerBay(){
 try{
  const result=importSavedGarageBay(Number($('garage-bay-select').value));
  await savePromise;await db.saveProject(doc);
  replaceProjectWithFactory(result);
 }catch(e){message('Could not open career bay: '+e.message,true);console.error(e);}
}

function setupFactoryPicker(){
 const picker=$('factory-part-select');
 const groups=new Map();
 for(const def of factoryCatalogueOptions()){
  let group=groups.get(def.slot);
  if(!group){group=document.createElement('optgroup');group.label=def.slot.toUpperCase();picker.append(group);groups.set(def.slot,group);}
  const option=document.createElement('option');option.value=def.id;option.textContent=def.name;group.append(option);
 }
 $('open-factory-part').onclick=()=>openFactoryPart(false);
 $('insert-factory-part').onclick=()=>openFactoryPart(true);
 $('open-factory-rig').onclick=()=>openFactoryRig('default');
 $('open-yard-rig').onclick=()=>openFactoryRig('yard');
 $('open-garage-bay').onclick=openCareerBay;
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
function cameraZoom(factor){
 if(!Number.isFinite(factor)||factor<=0)return;
 if(view==='quarter')orbit.distance=THREE.MathUtils.clamp(orbit.distance*factor,.22,45);
 else orthoScale=THREE.MathUtils.clamp(orthoScale*factor,.07,30);
 requestDraw();
}
function panCamera(dx,dy){
 const height=Math.max(1,stage.clientHeight);
 const perPixel=view==='quarter'?
  2*orbit.distance*Math.tan(THREE.MathUtils.degToRad(38)/2)/height:
  2*orthoScale/height;
 const right=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,0);
 const up=new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld,1);
 focus.addScaledVector(right,-dx*perPixel).addScaledVector(up,dy*perPixel);
 requestDraw();
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
 const pose=cameraPose(view,orbit,20);
 camera.position.copy(focus).add(new THREE.Vector3(...pose.position));
 camera.up.set(...pose.up);
 camera.lookAt(focus);
 camera.updateMatrixWorld(true);
 const bearing=$('camera-bearing');
 if(bearing)bearing.textContent=cameraFacing(view,orbit.yaw);
 const azimuth=$('camera-azimuth');
 if(azimuth)azimuth.textContent=view==='quarter'?
  Math.round(orbit.yaw*180/Math.PI)+'° / 360°':'ORTHOGRAPHIC';
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
   // Keep camera state stable while the edited geometry is rebuilt.
  }else{
   scene.add(compiled.root);
   // Camera focus stays fixed while sculpting; use the FIT control deliberately.
  }
  grid.visible=!showContext;
  applyComparisonLayout();applyVisibility();requestDraw();
 }catch(e){message('Geometry rejected: '+e.message,true);console.error(e);}
}
function refresh(){
 $('project-name').value=doc.name;renderTree();renderInspector();renderLibrary();renderReferences();selectedFeedback();
 for(const b of document.querySelectorAll('[data-view]'))b.classList.toggle('active',b.dataset.view===view);
 for(const b of document.querySelectorAll('[data-tool]'))b.classList.toggle('active',b.dataset.tool===tool);
 $('undo').disabled=step===0;$('redo').disabled=step===history.length-1;
 $('node-count').textContent=doc.nodes.filter(n=>n.kind==='shape').length+' SHAPES';
 $('selected-id').textContent=selected==='root'?'ROOT':selected.slice(-8);
 $('context-toggle').textContent=showContext?'HIDE YARDWALKER':'SHOW YARDWALKER';
 updateComparisonUI();
 $('mode-status').textContent=view.toUpperCase()+' / '+tool.toUpperCase();
 updateContextPanel();
 $('stage-hint').textContent=tool==='points'
  ?'POINTS · DRAG AMBER DOTS · TAP A MESH TO SWITCH · PINCH TO ZOOM'
  :tool==='select'
   ?'TAP A PIECE · SELECT · DRAG TO ORBIT · PINCH TO ZOOM'
   :tool.toUpperCase()+' · DRAG COLORED XYZ HANDLES OR THE PIECE';
 rebuild();
}
function treeLineage(node,map){
 const parents=[],seen=new Set([node.id]);
 let parent=map.get(node.parentId);
 while(parent&&parent.id!=='root'&&!seen.has(parent.id)){
  parents.unshift(parent);seen.add(parent.id);parent=map.get(parent.parentId);
 }
 return parents;
}
function renderTree(){
 const target=$('object-tree');target.replaceChildren();
 target.classList.toggle('list-mode',browseListMode);
 const search=$('object-search').value.trim().toLowerCase();
 const map=new Map(doc.nodes.map(n=>[n.id,n])),children=new Map();
 for(const n of doc.nodes)if(n.id!=='root'){
  if(!children.has(n.parentId))children.set(n.parentId,[]);
  children.get(n.parentId).push(n);
 }
 const matched=new Set();
 if(search)for(const n of doc.nodes)if(n.id!=='root'&&n.name.toLowerCase().includes(search)){
  matched.add(n.id);for(const ancestor of treeLineage(n,map))matched.add(ancestor.id);
 }
 let count=0;
 function visit(parentId,depth){
  for(const n of children.get(parentId)||[]){
   if(count>=170)return;
   if(search&&!matched.has(n.id))continue;
   const childrenCount=(children.get(n.id)||[]).length;
   const collapsed=!search&&collapsedGroups.has(n.id);
   const line=document.createElement('div');line.className='tree-line';
   line.style.setProperty('--tree-depth',Math.min(depth,12));
   if(childrenCount){
    const toggle=document.createElement('button');toggle.className='tree-caret';
    toggle.type='button';toggle.textContent=collapsed?'▸':'▾';
    toggle.setAttribute('aria-label',(collapsed?'Expand ':'Collapse ')+n.name);
    toggle.setAttribute('aria-expanded',String(!collapsed));
    toggle.onclick=()=>{
     collapsed?collapsedGroups.delete(n.id):collapsedGroups.add(n.id);renderTree();
    };
    line.append(toggle);
   }else{
    const placeholder=document.createElement('span');placeholder.className='tree-caret-placeholder';line.append(placeholder);
   }
   const tile=makeTile(n,doc,'node',n.name||'Unnamed piece',n.kind==='shape'?
    n.geometry.type.toUpperCase():n.kind.toUpperCase());
   tile.classList.add('tree-item');
   if(n.kind!=='shape')tile.classList.add('is-group');
   if(selectedIds.has(n.id)||selected===n.id)tile.classList.add('active');
   tile.dataset.kind=n.kind;tile.dataset.nodeId=n.id;
   if(n.visible===false)tile.classList.add('is-hidden');
   if(n.locked||n.visible===false){
    const flag=document.createElement('small');flag.className='tile-flag';
    flag.textContent=n.visible===false?'HIDDEN':'LOCK';tile.append(flag);
   }
   tile.onclick=e=>{
    cancelActivePreview();clearPoint();
    if(objectMultiSelect||e.shiftKey||e.ctrlKey||e.metaKey){
     selectedIds.has(n.id)?selectedIds.delete(n.id):selectedIds.add(n.id);
     selected=selectedIds.has(n.id)?n.id:([...selectedIds][0]||'root');
    }else{selectedIds.clear();selectedIds.add(n.id);selected=n.id;}
    meshPointPageIndex=0;renderTree();renderInspector();selectedFeedback();applyVisibility();requestDraw();
   };
   line.append(tile);
   const eye=document.createElement('button');eye.className='tree-eye';
   eye.type='button';eye.textContent=n.visible===false?'◌':'◉';
   eye.setAttribute('aria-label',(n.visible===false?'Show ':'Hide ')+n.name);
   eye.onclick=()=>{try{commit(updateNode(doc,n.id,{visible:!n.visible}),selected,'Updated visibility.');}
    catch(e){message(e.message,true);}};
   line.append(eye);
   target.append(line);count++;
   if(!collapsed&&childrenCount)visit(n.id,depth+1);
  }
 }
 visit('root',0);
 if(count>=170){
  const more=document.createElement('p');more.className='hint';
  more.textContent='Showing first 170 expanded pieces. Collapse groups or search to find others.';
  target.append(more);
 }
 if(count===0){
  const p=document.createElement('p');p.className='hint';
  p.textContent=search?'No matching model pieces.':'Your canvas is empty. Choose + SHAPE or GAME PART.';
  target.append(p);
 }
 const multi=$('object-multi');
 if(multi){multi.classList.toggle('active',objectMultiSelect);
  multi.setAttribute('aria-pressed',String(objectMultiSelect));
  multi.title=selectedIds.size+' objects selected';}
}

$('object-search').oninput=()=>renderTree();
$('object-multi').onclick=()=>{objectMultiSelect=!objectMultiSelect;
 if(!objectMultiSelect&&selected!=='root')selectedIds=new Set([selected]);
 renderTree();message(objectMultiSelect?'MULTI: tap several shapes to select them.':'Single-object selection.');};
$('tree-list-toggle').onclick=()=>{
 browseListMode=!browseListMode;renderTree();
 $('tree-list-toggle').textContent=browseListMode?'▦':'☷';
};
$('show-shapes-panel').onclick=()=>{
 const details=$('shape-maker');details.open=true;details.scrollIntoView({block:'nearest',behavior:'smooth'});
};
$('show-factory-panel').onclick=()=>{
 const details=$('factory-picker');details.open=true;
 if(!$('factory-grid').children.length)showFactoryGrid();
 details.scrollIntoView({block:'nearest',behavior:'smooth'});
};
$('show-details-panel').onclick=()=>{
 const details=$('inspector-details');details.open=!details.open;
 if(details.open)details.scrollIntoView({block:'nearest',behavior:'smooth'});
};
$('dock-collapse').onclick=()=>{
 const content=$('drawer-content');content.hidden=!content.hidden;
 $('dock-collapse').setAttribute('aria-expanded',String(!content.hidden));
 $('dock-collapse').textContent=content.hidden?'⌃':'⌄';
};
$('focus-selected').onclick=()=>fitSelected();
$('context-close').onclick=()=>clearPoint();
const moreActions=$('more-actions');
moreActions.addEventListener('click',e=>{
 if(e.target.closest('button'))moreActions.open=false;
});
document.addEventListener('pointerdown',e=>{
 if(moreActions.open&&!moreActions.contains(e.target))moreActions.open=false;
},{capture:true});

for(const [mode,id] of [['all','visibility-normal'],['ghost','visibility-ghost'],['isolate','visibility-isolate']]){
 $(id).onclick=()=>{
  visibilityMode=mode;applyVisibility();updateContextPanel();
  message(mode==='all'?'Showing full assembly.':mode==='ghost'?'Background geometry transparent.':'Only selected part visible.');
 };
}

$('hide-others').onclick=()=>{
 const preserved=new Set(selectedIds.size?selectedIds:[selected]);
 if(!preserved.size||preserved.has('root'))return message('Select a shape or group first.',true);
 const kept=new Set();
 for(const n of doc.nodes){
  let cur=n,seen=new Set();
  while(cur&&!seen.has(cur.id)){
   seen.add(cur.id);if(preserved.has(cur.id)){kept.add(n.id);break;}
   cur=doc.nodes.find(p=>p.id===cur.parentId);
  }
  if(preserved.has(n.id)){
   let parent=doc.nodes.find(p=>p.id===n.parentId);
   while(parent&&!kept.has(parent.id)){kept.add(parent.id);parent=doc.nodes.find(p=>p.id===parent.parentId);}
  }
 }
 const next=clone(doc);
 for(const n of next.nodes)if(n.id!=='root')n.visible=kept.has(n.id);
 commit(next,selected,'Other objects hidden (undo to restore).');
};
$('show-all-nodes').onclick=()=>{
 const next=clone(doc);
 for(const n of next.nodes)n.visible=true;
 commit(next,selected,'All objects visible.');
};
function showPrimitiveGrid(){
 const target=$('primitive-grid');target.replaceChildren();
 for(const type of ['box','chamfer','cylinder','tube','wedge','plate','taper','loft']){
  const primitive=newShape(type,{name:type});
  const tile=makeTile(primitive.geometry,null,'primitive',type.toUpperCase(),'ADD '+type.toUpperCase());
  tile.dataset.thumbid=type;
  tile.onclick=()=>{
   $('shape-type').value=type;$('add-shape').click();
   $('shape-maker').open=false;
  };
  target.append(tile);
  const image=tile.querySelector('img');
  if(image)renderThumb(image); // The eight primitives are cheap: draw immediately.
 }
}
function showFactoryGrid(){
 const target=$('factory-grid');target.replaceChildren();
 let shown=0;
 for(const def of factoryCatalogueOptions()){
  const tile=makeTile(def,null,'factory',def.name,def.slot.toUpperCase());
  tile.onclick=()=>{
   $('factory-part-select').value=def.id;
   openFactoryPart(false);
   $('factory-picker').open=false;
  };
  target.append(tile);
  // Seed first visible row. Remaining real meshes render as their tiles
  // enter the scroll area, avoiding extra WebGL contexts or load spikes.
  const preview=tile.querySelector('img');
  if(preview&&shown++<3)renderThumb(preview);
 }
}
$('factory-picker').addEventListener('toggle',()=>{
 if($('factory-picker').open&&$('factory-grid').children.length===0)showFactoryGrid();
});
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
function renderImportedMeshControls(n,active){
 const panel=$('mesh-point-panel');
 const mesh=n?.kind==='shape'&&n?.geometry?.type==='mesh'&&!n?.mirrorOf;
 panel.hidden=!mesh;
 if(!mesh)return;
 const info=meshPointPage(n.geometry,meshPointPageIndex);
 meshPointPageIndex=info.page;
 meshPointSelectedIndex=Math.max(0,Math.min(info.count-1,meshPointSelectedIndex));
 $('mesh-points-label').textContent=info.count+' POINTS / PAGE '+(info.page+1)+' OF '+info.pages;
 $('mesh-points-prev').disabled=info.page<=0;
 $('mesh-points-next').disabled=info.page>=info.pages-1;
 const picker=$('mesh-point-select');picker.replaceChildren();
 for(const group of info.points){
  const option=document.createElement('option');option.value=group.index;
  option.textContent='POINT '+(group.index+1)+' — '+group.position.map(v=>v.toFixed(3)).join(' / ');
  picker.append(option);
 }
 // Select the first visible point when paging to another group.
 if(!info.points.some(x=>x.index===meshPointSelectedIndex))
  meshPointSelectedIndex=info.points[0]?.index||0;
 picker.value=String(meshPointSelectedIndex);
 picker.disabled=!active;
 const coord=$('mesh-point-coordinates');coord.replaceChildren();
 const point=meshPointGroups(n.geometry)[meshPointSelectedIndex]?.position;
 if(!point)return;
 for(let axis=0;axis<3;axis++){
  const field=inputNumber(point[axis],value=>{
   const current=node();
   if(!current||current.kind!=='shape'||current.geometry.type!=='mesh')return;
   try{
    const updated=updateMeshPoint(current.geometry,meshPointSelectedIndex,
      point.map((v,j)=>j===axis?value:v));
    commit(updateNode(doc,selected,{geometry:updated}),selected,'Edited original game mesh point.');
   }catch(e){message('Point rejected: '+e.message,true);}
  },{label:['X (M)','Y (M)','Z (M)'][axis],min:-100,max:100,step:.01});
  field.querySelector('input').disabled=!active;coord.append(field);
 }
}
$('mesh-points-prev').onclick=()=>{meshPointPageIndex--;renderInspector();requestDraw();};
$('mesh-points-next').onclick=()=>{meshPointPageIndex++;renderInspector();requestDraw();};
$('mesh-point-select').onchange=e=>{
 meshPointSelectedIndex=Number(e.target.value);renderInspector();requestDraw();
};

function renderInspector(){
 const n=node(),active=!!n&&!n.locked&&n.id!=='root';
 updateComparisonUI();
 const selector=$('reparent-target');
 if(selector){
  const chosen=selector.value;selector.replaceChildren();
  for(const parent of doc.nodes.filter(x=>['group','anchor'].includes(x.kind))){
   const option=document.createElement('option');option.value=parent.id;option.textContent=parent.name;
   selector.append(option);
  }
  selector.value=[...selector.options].some(o=>o.value===chosen)?chosen:'root';
  $('reparent-object').disabled=!active;
 }
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
 renderImportedMeshControls(n,active);
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
 if(g.type==='mesh')target.textContent='Imported factory triangles are editable in the POINTS controls below and in FRONT / SIDE / TOP views. All three coordinates can be edited numerically.';
 if(g.profile)for(let i=0;i<g.profile.length;i++)for(let axis=0;axis<2;axis++)
  field('POINT '+(i+1)+' '+(axis?'Y':'X'),['profile',i,axis],g.profile[i][axis],-6,6);
 const actions=document.createElement('div');actions.className='toolbar';
 const add=document.createElement('button');add.textContent=g.sections?'ADD SECTION':'ADD POINT';
 const del=document.createElement('button');del.textContent=g.sections?'REMOVE SECTION':'REMOVE POINT';
 add.onclick=()=>editGeometryCount(1);del.onclick=()=>editGeometryCount(-1);
 if(g.profile||g.sections){actions.append(add,del);target.append(actions);}
 $('insert-geometry-point').disabled=!(g.profile||g.sections);
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
$('insert-geometry-point').onclick=()=>{
 const n=node(),g=n?.geometry;if(!n||n.locked||n.mirrorOf||!(g?.profile||g?.sections))return;
 try{
  let geometry;
  if(g.profile){
   const chosen=activePoint?.kind==='profile'?activePoint.index:0;
   geometry=insertProfilePoint(g,chosen);
  }else{
   const chosen=Math.max(0,Math.min(g.sections.length-2,activePoint?.index??0));
   geometry=insertLoftSection(g,chosen);
  }
  clearPoint();commit(updateNode(doc,selected,{geometry}),selected,'Inserted control point/section after selection.');
 }catch(e){message('Could not insert control: '+e.message,true);}
};
const changeSelected=(change,msg)=>{
 const n=node();if(!n||n.locked||selected==='root')return;
 try{commit(updateNode(doc,selected,change),selected,msg);}catch(e){message(e.message,true);}
};
$('object-name').onchange=()=>changeSelected({name:$('object-name').value.trim()||'Unnamed'});
$('material-role').onchange=()=>{
 const n=node();if(!n||n.kind!=='shape')return;
 const role=$('material-role').value;
 const change={materialRole:role};
 if(n.geometry.type==='mesh'){
  // Palette selection is an explicit repaint of imported authored colors.
  const palette={olive:0x849275,ochre:0xb48c37,cream:0xcac4ae,iron:0x4c5a56,
   teal:0x468786,orange:0xc07852,dark:0x293431,bright:0x9ba6a3,armor:0xbbb49c};
  change.materialColor=palette[role];
  if(n.materialColors)change.materialColors=n.materialColors.map(()=>palette[role]);
 }
 changeSelected(change,'Updated selected shape finish.');
};
$('project-name').onchange=()=>{
 const next=clone(doc);next.name=$('project-name').value.trim()||'Untitled assembly';commit(next);
};
$('add-shape').onclick=()=>{
 const type=$('shape-type').value,shape=newShape(type,{parentId:'root'});
 // A new shape appears in front of the camera but preserves predictable local coordinates.
 try{commit(addNode(doc,shape),shape.id,'Added '+type+'. Drag the selected shape or handles to edit.');fitSelected();}
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
 changeSelected({geometry:bakeXReflection(source.geometry),mirrorOf:null},'Mirror unlinked without changing its appearance.');
};
$('delete-object').onclick=()=>{
 if(node()?.locked)return message('Unlock this object before deleting it.',true);
 try{commit(removeNode(doc,selected),'root','Deleted selected object/subtree.');}
 catch(e){message(e.message,true);}
};
$('hide-object').onclick=()=>{const n=node();if(n)changeSelected({visible:!n.visible});};
$('lock-object').onclick=()=>{
 const n=node();
 if(n&&n.id!=='root'){
  try{commit(updateNode(doc,selected,{locked:!n.locked}),selected,n.locked?'Object unlocked.':'Object locked.');}
  catch(e){message(e.message,true);}
 }
};
$('reset-selected').onclick=()=>changeSelected({transform:identity()});
$('compare-original').onclick=()=>{
 const source=comparisonSource();if(!source)return message('Open a specific factory part or draft linked to one.',true);
 if(showContext){showContext=false;buildContext();}
 const modes=['off','overlay','split'],next=modes[(modes.indexOf(comparison.mode)+1)%modes.length];
 if(next==='off'){discardComparison();rebuild();}
 else{
  if(comparison.mode==='off'||comparison.definitionId!==source)
   comparison={mode:next,definitionId:null,compiled:null};
  else comparison.mode=next;
  rebuild();fitSelected('root');
 }
 updateComparisonUI();message(next==='off'?'Factory comparison closed.':'Factory comparison: '+next+'.');
};
$('group-objects').onclick=()=>{
 try{const ids=[...selectedIds].filter(id=>id!=='root').length?
   [...selectedIds].filter(id=>id!=='root'):[selected];
  const result=groupPreservingPose(doc,ids);
  commit(result.document,result.selectedId,'Grouped objects without shifting their world positions.');
 }catch(e){message('Could not group: '+e.message,true);}
};
$('ungroup').onclick=()=>{
 const n=node();if(n?.kind!=='group'||n.id==='root')return message('Select a group first.');
 try{const next=ungroupPreservingPose(doc,n.id);
  commit(next,n.parentId,'Ungrouped and preserved child positions.');
 }catch(e){message('Could not ungroup: '+e.message,true);}
};
$('reparent-object').onclick=()=>{
 if(selected==='root')return message('Select an object first.',true);
 const parentId=$('reparent-target').value;
 try{commit(moveNodeToParent(doc,selected,parentId),selected,'Moved into group; world pose preserved.');}
 catch(e){message('Cannot change parent: '+e.message,true);}
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
 cancelActivePreview();tool=b.dataset.tool;
 if(tool!=='points')clearPoint();refresh();updateContextPanel();
};
for(const b of document.querySelectorAll('[data-view]'))b.onclick=()=>{
 cancelActivePreview();view=b.dataset.view;setCamera();refresh();
};
$('zoom-in').onclick=()=>cameraZoom(.8);
$('zoom-out').onclick=()=>cameraZoom(1.25);
$('fit-all').onclick=()=>{fitSelected('root');requestDraw();};
$('point-tap').onclick=()=>{navigating=false;$('nav-mode').classList.remove('active');pointPick='tap';updateContextPanel();requestDraw();};
$('nav-mode').onclick=()=>{cancelActivePreview();navigating=!navigating;
 $('nav-mode').classList.toggle('active',navigating);
 message(navigating?'Navigation active: drag to orbit or pan; selection is preserved.':'Point editing active.');
 requestDraw();};
$('frame-points').onclick=()=>{
 const chosen=getSelectionCandidates().filter(p=>selectedPoints.has(p.id));
 if(!chosen.length)return fitSelected();
 const box=new THREE.Box3();
 for(const p of chosen)box.expandByPoint(p.world);
 const size=box.getSize(new THREE.Vector3());focus.copy(box.getCenter(new THREE.Vector3()));
 const dim=Math.max(.08,size.x,size.y,size.z);
 orbit.distance=THREE.MathUtils.clamp(dim*3,.28,40);
 orthoScale=THREE.MathUtils.clamp(dim*.95,.09,25);
 requestDraw();
};
$('point-box').onclick=()=>{pointPick='box';updateContextPanel();requestDraw();};
for(const level of ['point','edge','face'])$('edit-level-'+level).onclick=()=>{
 const g=node()?.geometry;
 if(level!=='point'&&g&&!['mesh','plate','wedge'].includes(g.type))
  return message('Edge/Face editing is available for mesh and polygon shells; use Point for loft sections.',true);
 cancelActivePreview();editingLevel=level;navigating=false;$('nav-mode').classList.remove('active');
 updateContextPanel();requestDraw();
};
$('select-add').onclick=()=>{selectionOp=selectionOp==='add'?'replace':'add';updateContextPanel();};
$('select-subtract').onclick=()=>{selectionOp=selectionOp==='subtract'?'replace':'subtract';updateContextPanel();};
$('clear-point-selection').onclick=()=>{clearPoint();requestDraw();};
$('select-all-points').onclick=()=>{
 const n=node();if(!n||n.kind!=='shape'||n.locked||n.mirrorOf)return;
 const g=n.geometry;selectedPoints=new Set((g.type==='mesh'?meshPointGroups(g).map((_,i)=>'factory-mesh:'+i):
  g.profile?g.profile.map((_,i)=>'profile:'+i):
  (g.sections||[]).map((_,i)=>'front:'+i)));
 const key=[...selectedPoints][0];
 activePoint=key?{nodeId:selected,...parsePointKey(key)}:null;
 updateContextPanel();requestDraw();
};
for(const mode of ['solid','wire','xray'])$('display-'+mode).onclick=()=>{
 displayMode=mode;applyVisibility();updateContextPanel();};
for(const mode of ['visible','through'])$('depth-'+mode).onclick=()=>{
 pointDepth=mode;updateContextPanel();requestDraw();};
$('reset-camera').onclick=()=>{
 orbit={yaw:.62,pitch:.22,distance:Math.max(1.8,orbit.distance)};
 view='quarter';setCamera();refresh();message('Camera reset · FRONT -Z / RIGHT +X / UP +Y.');
};
$('context-toggle').onclick=()=>{showContext=!showContext;if(showContext)discardComparison();buildContext();refresh();
 message(showContext?'Inspecting the actual Yardwalker knee assembly.':'Editing stand-alone blueprint.');};
async function deployPrototype(mode){
 try{
  const raw=packagePrototype(doc,{mode,side:$('yard-preview-side').value});
  // A standalone blueprint overlays only the left Yardwalker knee in the real range.
  sessionStorage.setItem(PROTOTYPE_KEY,raw);
  await db.saveProject(doc);
  window.location.assign('./test-yard.html?wb-prototype=1');
 }catch(e){message('Test Yard handoff failed: '+e.message,true);}
}
$('test-in-yard').onclick=()=>deployPrototype('overlay');
$('test-replace-calf').onclick=()=>deployPrototype('replace-calf');
$('undo').onclick=()=>undo(-1);$('redo').onclick=()=>undo(1);
window.addEventListener('blur',()=>cancelActivePreview());
document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelActivePreview();});
document.addEventListener('keydown',e=>{
 if(e.key==='Escape'){cancelActivePreview('Edit cancelled.');return;}
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
const worldAxes=[new THREE.Vector3(1,0,0),new THREE.Vector3(0,1,0),new THREE.Vector3(0,0,1)];
const axisColors=['#ed7770','#8cdd94','#78aaff'];
function drawSelectionAndGizmos(object,n){
 const box=new THREE.Box3().setFromObject(object);
 if(box.isEmpty())return;
 const corners=[];
 for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z]){
  const p=projected(new THREE.Vector3(x,y,z));if(Number.isFinite(p.x)&&Number.isFinite(p.y))corners.push(p);
 }
 if(corners.length){
  const minX=Math.min(...corners.map(p=>p.x)),maxX=Math.max(...corners.map(p=>p.x));
  const minY=Math.min(...corners.map(p=>p.y)),maxY=Math.max(...corners.map(p=>p.y));
  svgNode('rect',{x:minX-3,y:minY-3,width:Math.max(1,maxX-minX+6),height:Math.max(1,maxY-minY+6),
   fill:'none',stroke:'#efd49a','stroke-opacity':.8,'stroke-width':1.4,'stroke-dasharray':'5 4','pointer-events':'none'});
 }
 if(n.locked||!['move','rotate','scale'].includes(tool))return;
 const anchor=box.getCenter(new THREE.Vector3()),start=projected(anchor);
 const pixelScale=camera.isPerspectiveCamera?
  camera.position.distanceTo(anchor)*Math.tan(THREE.MathUtils.degToRad(camera.fov)/2)*2/Math.max(1,stage.clientHeight):
  orthoScale*2/Math.max(1,stage.clientHeight);
 const worldDistance=52*pixelScale;
 const orientation=object.getWorldQuaternion(new THREE.Quaternion());
 for(let i=0;i<3;i++){
  const axis=worldAxes[i].clone().applyQuaternion(orientation).normalize();
  const end=projected(anchor.clone().addScaledVector(axis,worldDistance));
  const dx=end.x-start.x,dy=end.y-start.y,len=Math.hypot(dx,dy);
  if(!Number.isFinite(len)||len<15)continue;
  svgNode('line',{x1:start.x,y1:start.y,x2:end.x,y2:end.y,
   stroke:axisColors[i],'stroke-width':3,'stroke-linecap':'round','pointer-events':'none'});
  const hit=svgNode('circle',{cx:end.x,cy:end.y,r:16,fill:axisColors[i],'fill-opacity':.23,
   stroke:axisColors[i],'stroke-width':2,class:'gizmo-hit','data-axis':['x','y','z'][i],
   'aria-label':['X','Y','Z'][i]+' axis drag handle'});
  svgNode('text',{x:end.x,y:end.y+4,'text-anchor':'middle','font-size':10,'font-weight':800,
   fill:'#f5efe2','pointer-events':'none'}).textContent=['X','Y','Z'][i];
  hit.addEventListener('pointerdown',e=>{
   e.preventDefault();e.stopPropagation();
   if(isEditGesture()&&drag.pointerId!==e.pointerId){cancelActivePreview('Interrupted edit cancelled.');return;}
   drag={mode:'gizmo',tool,nodeId:selected,axis:i,worldAxis:axis,anchor:anchor.clone(),
    projectedAxis:{x:dx/len,y:dy/len},worldDistance,pixelLength:len,
    pointerId:e.pointerId,previous:clone(doc),base:clone(n.transform),
    start:{x:e.clientX,y:e.clientY}};
   svg.setPointerCapture(e.pointerId);
  });
 }
}
function applyGizmoDrag(e){
 if(!drag||drag.mode!=='gizmo'||drag.pointerId!==e.pointerId)return;
 const deltaX=e.clientX-drag.start.x,deltaY=e.clientY-drag.start.y;
 const signedPx=deltaX*drag.projectedAxis.x+deltaY*drag.projectedAxis.y;
 const target=doc.nodes.find(n=>n.id===drag.nodeId);
 if(!target||target.locked)return;
 const i=drag.axis;
 if(drag.tool==='move'){
  const parent=compiled?.objects.get(target.parentId);
  if(!parent)return;
  parent.updateMatrixWorld(true);
  const worldDelta=drag.worldAxis.clone().multiplyScalar(signedPx/drag.pixelLength*drag.worldDistance);
  const localStart=parent.worldToLocal(drag.anchor.clone());
  const localEnd=parent.worldToLocal(drag.anchor.clone().add(worldDelta));
  const localDelta=localEnd.sub(localStart);
  target.transform.position=drag.base.position.map((v,j)=>snapValue(v+localDelta.getComponent(j)));
 }else if(drag.tool==='scale'){
  const factor=Math.max(.02,1+signedPx/85);
  target.transform.scale[i]=Math.max(.005,Number((drag.base.scale[i]*factor).toFixed(4)));
 }else if(drag.tool==='rotate'){
  target.transform.rotation[i]=drag.base.rotation[i]+signedPx*.012;
 }
 try{
  const visual=compiled?.objects.get(target.id);
  if(visual){
   visual.position.set(...target.transform.position);
   visual.rotation.set(...target.transform.rotation,'XYZ');
   visual.scale.set(...target.transform.scale);
   if(target.mirrorOf)visual.scale.x*=-1;
   visual.updateMatrixWorld(true);
  }
  requestDraw();
 }catch{/* Invalid intermediate drag ignored. */}
}
function finishGizmoDrag(e){
 if(!drag||drag.mode!=='gizmo'||drag.pointerId!==e.pointerId)return;
 if(e.type==='pointercancel'){cancelActivePreview('Axis transform cancelled.');return;}
 const before=drag.previous,after=clone(doc),selection=drag.nodeId;
 drag=null;doc=before;commit(after,selection,'Updated part directly on the model.');
}

function shapePointHandles(g,whichView=view){
 if(g.type==='mesh')return meshPointGroups(g).map((pt,i)=>({
  pos:new THREE.Vector3(...pt.position),kind:'factory-mesh',index:i}));
 if(g.profile&&(whichView==='front'||whichView==='quarter'))
  return g.profile.map((pt,i)=>({pos:new THREE.Vector3(pt[0],pt[1],0),kind:'profile',index:i}));
 const handles=[];
 if(g.sections)g.sections.forEach((sec,i)=>{
  if(whichView==='quarter'){
   handles.push({pos:new THREE.Vector3(-sec.width/2,sec.y,sec.front),kind:'width',index:i});
   handles.push({pos:new THREE.Vector3(sec.width/2,sec.y,sec.front),kind:'front',index:i});
   handles.push({pos:new THREE.Vector3(sec.width/2,sec.y,sec.back),kind:'back',index:i});
  }else if(whichView==='front'){
   handles.push({pos:new THREE.Vector3(-sec.width/2,sec.y,sec.front),kind:'width',index:i});
   handles.push({pos:new THREE.Vector3(sec.width/2,sec.y,sec.front),kind:'width',index:i});
  }else if(whichView==='side'||whichView==='left'){
   handles.push({pos:new THREE.Vector3(0,sec.y,sec.front),kind:'front',index:i});
   handles.push({pos:new THREE.Vector3(0,sec.y,sec.back),kind:'back',index:i});
  }else if(whichView==='top'){
   handles.push({pos:new THREE.Vector3(sec.width/2,sec.y,sec.front),kind:'topWidth',index:i});
   handles.push({pos:new THREE.Vector3(-sec.width/2,sec.y,sec.back),kind:'topBack',index:i});
  }
 });
 return handles;
}
function drawTopologyHandles(geometry,obj){
 let elements;
 try{elements=editingElements(geometry);}catch(e){message(e.message,true);return;}
 const seen=new Set(),selectedDisplay=[];
 let shown=0;
 for(const entry of elements){
  const pts=entry.points.map(p=>projected(obj.localToWorld(new THREE.Vector3(...p))));
  const x=pts.reduce((sum,p)=>sum+p.x,0)/pts.length,y=pts.reduce((sum,p)=>sum+p.y,0)/pts.length;
  const selectedElement=entry.members.every(k=>selectedPoints.has(k));
  if(x< -20||y< -20||x>stage.clientWidth+20||y>stage.clientHeight+20)continue;
  const cell=Math.floor(x/12)+':'+Math.floor(y/12);
  if(!selectedElement&&(seen.has(cell)||shown>=360))continue;
  seen.add(cell);shown++;
  const center=obj.localToWorld(new THREE.Vector3(...entry.center));
  let handle;
  if(editingLevel==='face'){
   handle=svgNode('polygon',{points:pts.map(p=>p.x+','+p.y).join(' '),
    fill:selectedElement?'#e8af65':'#b7d5b0','fill-opacity':selectedElement?.35:.08,
    stroke:selectedElement?'#ffe2a2':'#b6c2ad','stroke-opacity':selectedElement?.9:.4,
    'stroke-width':selectedElement?2:1,'pointer-events':pointPick==='box'?'none':'all'});
  }else{
   handle=svgNode('line',{x1:pts[0].x,y1:pts[0].y,x2:pts[1].x,y2:pts[1].y,
    stroke:selectedElement?'#ffd893':'#aac9b2','stroke-opacity':selectedElement?.95:.4,
    'stroke-width':selectedElement?9:7,'stroke-linecap':'round','pointer-events':pointPick==='box'?'none':'stroke'});
  }
  if(pointPick==='box')continue;
  handle.addEventListener('pointerdown',e=>{
   e.preventDefault();e.stopPropagation();
   if(isEditGesture()&&drag.pointerId!==e.pointerId){cancelActivePreview('Interrupted edit cancelled.');return;}
   selectedPoints=modifyElementVertexSelection(selectedPoints,[entry],{operation:selectionOp});
   const key=[...selectedPoints][0];
   activePoint=key?{nodeId:selected,...parsePointKey(key)}:null;
   updateContextPanel();requestDraw();
   if(selectionOp!=='replace'||!key)return;
   drag={mode:'point',nodeId:selected,kind:'factory-mesh',
    pointerId:e.pointerId,anchor:center,previous:clone(doc)};
   svg.setPointerCapture(e.pointerId);
  });
 }
}
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
 if(!n||!obj||!n.visible||selected==='root')return;
 obj.updateMatrixWorld(true);
 drawSelectionAndGizmos(obj,n);
 if(n.kind!=='shape')return;
 const g=n.mirrorOf?doc.nodes.find(s=>s.id===n.mirrorOf).geometry:n.geometry;
 if(tool==='points'&&editingLevel!=='point'&&!n.locked&&!n.mirrorOf&&!navigating){
  drawTopologyHandles(g,obj);
 }
  const allHandles=tool==='points'&&editingLevel==='point'&&!n.locked&&!n.mirrorOf&&!navigating?
  shapePointHandles(g,view):[];
 const handles=[],cells=new Set();
 for(const entry of allHandles){
  const world=obj.localToWorld(entry.pos.clone()),p=projected(world);
  if(!Number.isFinite(p.x)||!Number.isFinite(p.y)||
   p.x< -12||p.x>stage.clientWidth+12||p.y< -12||p.y>stage.clientHeight+12)continue;
  if(selectedPoints.has(pointKey(entry))){handles.push(entry);continue;}
  const cell=Math.floor(p.x/12)+':'+Math.floor(p.y/12);
  if(!cells.has(cell)&&cells.size<450){cells.add(cell);handles.push(entry);}
 }
 for(const entry of handles){
  const world=obj.localToWorld(entry.pos.clone()),p=projected(world);
  if(!Number.isFinite(p.x)||!Number.isFinite(p.y))continue;
  const circle=svgNode('circle',{cx:p.x,cy:p.y,r:entry.kind==='factory-mesh'?10:14,fill:'#edb15d','fill-opacity':'.15',
   stroke:'#e7ae57','stroke-width':1.5,class:(pointPick==='box'?'point-indicator':'point-handle')+
    (selectedPoints.has(pointKey(entry))?' is-selected':'')+
    (activePoint?.kind===entry.kind&&activePoint?.index===entry.index?' is-active':''),
   'data-index':entry.index,'data-kind':entry.kind});
  const core=svgNode('circle',{cx:p.x,cy:p.y,r:5.5,fill:'#ffcc71','pointer-events':'none'});
  if(pointPick==='box')continue;
  circle.addEventListener('pointerdown',e=>{
   e.preventDefault();e.stopPropagation();
   if(isEditGesture()&&drag.pointerId!==e.pointerId){cancelActivePreview('Interrupted edit cancelled.');return;}
   selectPoint({nodeId:selected,index:entry.index,kind:entry.kind});
   if(selectionOp!=='replace'){return;}
   const target=compiled.objects.get(selected);
   const anchor=target.localToWorld(entry.pos.clone());
   drag={mode:'point',nodeId:selected,index:entry.index,kind:entry.kind,
    pointerId:e.pointerId,anchor,previous:clone(doc)};
   svg.setPointerCapture(e.pointerId);
  });
 }
 if(marquee){
  const rect=rectFromPoints(marquee.start,marquee.end);
  svgNode('rect',{x:rect.left,y:rect.top,width:Math.max(1,rect.right-rect.left),
   height:Math.max(1,rect.bottom-rect.top),class:'marquee'});
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
 if(selectedPoints.size>1){
  const origin=target.worldToLocal(drag.anchor.clone()),delta=local.clone().sub(origin).toArray();
  try{previewBatchGeometry(applyBatchDelta(drag.previous,delta));
   updatePointValueWithoutRebuildingControls();}catch(e){message(e.message,true);}
  return;
 }
 const n=doc.nodes.find(n=>n.id===drag.nodeId);
 const source=drag.previous.nodes.find(n=>n.id===drag.nodeId);
 if(!n||!source||n.locked)return;
 const g=clone(source.geometry),i=drag.index;
 if(g.type==='mesh'){
  const original=meshPointGroups(g)[i]?.position;
  if(!original)return;
  const pos=original.slice();
  if(view==='front'){pos[0]=snapValue(local.x);pos[1]=snapValue(local.y);}
  if(view==='side'){pos[2]=snapValue(local.z);pos[1]=snapValue(local.y);}
  if(view==='top'){pos[0]=snapValue(local.x);pos[2]=snapValue(local.z);}
  if(view==='quarter'){pos[0]=snapValue(local.x);pos[1]=snapValue(local.y);pos[2]=snapValue(local.z);}
  meshPointSelectedIndex=i;
  try{n.geometry=updateMeshPoint(g,i,pos);}
  catch{return;}
 }
 if(g.profile){
  if(view!=='front'&&view!=='quarter')return;
  g.profile[i]=[snapValue(local.x),snapValue(local.y)];
 }else if(g.sections){
  const section=g.sections[i],kind=drag.kind;
  if(kind==='width'||kind==='topWidth')section.width=Math.max(.02,snapValue(Math.abs(local.x)*2));
  if(kind==='front')section.front=Math.min(section.back-.02,snapValue(local.z));
  if(kind==='back'||kind==='topBack')section.back=Math.max(section.front+.02,snapValue(local.z));
  if(kind==='front'||kind==='back'||kind==='width')section.y=Math.max(0,snapValue(local.y));
 }
 try{
  if(g.type!=='mesh'){validateGeometry(g);n.geometry=g;}
  const visual=compiled?.objects.get(n.id);
  if(visual?.isMesh){
   const oldGeometry=visual.geometry;
   visual.geometry=compileGeometry(n.geometry);
   oldGeometry.dispose();
  }
  updatePointValueWithoutRebuildingControls();
  requestDraw();
 }catch{
  n.geometry=clone(source.geometry);
 }
}
function updatePointValueWithoutRebuildingControls(){
 if(!activePoint||selectedPoints.size>1)return;
 const point=pointCoordinates();
 if(!point)return;
 $('context-value').textContent=point.map((v,i)=>axisKeys[i]+' '+v.toFixed(3)).join(' · ');
 for(const row of $('point-axis-controls').querySelectorAll('.axis-row')){
  const slider=row.querySelector('input'),read=row.querySelector('output');
  const axis=Number(slider.dataset.axis);
  slider.value=String(point[axis]);read.textContent=point[axis].toFixed(3);
 }
}
svg.addEventListener('pointermove',e=>{
 if(drag?.mode==='point'&&drag.pointerId===e.pointerId){applyPoint(e);e.preventDefault();}
 if(drag?.mode==='gizmo'&&drag.pointerId===e.pointerId){applyGizmoDrag(e);e.preventDefault();}
});
const finishPoint=e=>{
 if(drag?.mode!=='point'||drag.pointerId!==e.pointerId)return;
 if(e.type==='pointercancel'){cancelActivePreview('Point edit cancelled.');return;}
 const after=clone(doc),before=drag.previous;drag=null;
 doc=before;commit(after,selected,'Edited selected point.');
 updateContextPanel();
};
svg.addEventListener('pointerup',finishPoint);svg.addEventListener('pointercancel',finishPoint);
svg.addEventListener('pointerup',finishGizmoDrag);svg.addEventListener('pointercancel',finishGizmoDrag);
function getSelectionCandidates(){
 const n=node(),obj=compiled?.objects.get(selected);
 if(!n||n.kind!=='shape'||!obj||n.locked||n.mirrorOf)return [];
 const g=n.geometry;
 const entries=shapePointHandles(g,view).map(h=>({
  kind:h.kind,index:h.index,pos:h.pos.toArray()
 }));
 obj.updateMatrixWorld(true);
 return entries.map(p=>{
  const world=obj.localToWorld(new THREE.Vector3(...p.pos));
  const clip=world.clone().project(camera);
  return {...p,id:pointKey(p),x:(clip.x+1)*stage.clientWidth/2,y:(1-clip.y)*stage.clientHeight/2,
   inFrustum:Math.abs(clip.x)<=1.02&&Math.abs(clip.y)<=1.02&&clip.z>=-1&&clip.z<=1,world,clip};
 });
}
function finishMarquee(){
 if(!marquee)return;
 if(editingLevel!=='point'){
  const obj=compiled?.objects.get(selected),n=node();
  if(!obj||!n||n.kind!=='shape')return void (marquee=null);
  const rect=rectFromPoints(marquee.start,marquee.end);
  const hits=editingElements(n.geometry).filter(element=>{
   const world=obj.localToWorld(new THREE.Vector3(...element.center));
   const p=world.clone().project(camera),screenX=(p.x+1)*stage.clientWidth/2,screenY=(1-p.y)*stage.clientHeight/2;
   if(p.z< -1||p.z>1||screenX<rect.left||screenX>rect.right||screenY<rect.top||screenY>rect.bottom)return false;
   if(pointDepth==='through')return true;
   raycaster.setFromCamera(new THREE.Vector2(p.x,p.y),camera);
   const first=raycaster.intersectObject(obj,false)[0];
   return !first||first.distance>=camera.position.distanceTo(world)-.025;
  });
  selectedPoints=modifyElementVertexSelection(selectedPoints,hits,{operation:selectionOp});
  const first=[...selectedPoints][0];activePoint=first?{nodeId:selected,...parsePointKey(first)}:null;
  marquee=null;updateContextPanel();requestDraw();message(selectedPoints.size+' vertices selected via '+editingLevel+'.');
  return;
 }
 const rect=rectFromPoints(marquee.start,marquee.end);
 const candidates=getSelectionCandidates().filter(p=>p.x>=rect.left&&p.x<=rect.right&&p.y>=rect.top&&p.y<=rect.bottom&&p.inFrustum);
 const obj=compiled?.objects.get(selected);
 if(pointDepth==='visible'&&obj){
  for(const point of candidates){
   raycaster.setFromCamera(new THREE.Vector2(point.clip.x,point.clip.y),camera);
   const front=raycaster.intersectObject(obj,false)[0];
   point.visible=!front||front.distance>=camera.position.distanceTo(point.world)-.025;
  }
 }
 selectedPoints=selectedInRectangle(candidates,rect,{through:pointDepth==='through',
  operation:selectionOp,previous:selectedPoints});
 const key=[...selectedPoints][0];activePoint=key?{nodeId:selected,...parsePointKey(key)}:null;
 marquee=null;updateContextPanel();requestDraw();
 message(selectedPoints.size+' points selected.');
}
function screenNDC(e){
 const b=stage.getBoundingClientRect();
 return {x:(e.clientX-b.left)/b.width*2-1,y:1-(e.clientY-b.top)/b.height*2};
}
canvas.addEventListener('pointerdown',e=>{
 canvas.setPointerCapture(e.pointerId);
 if((isEditGesture()&&drag.pointerId!==e.pointerId)||pointSliderStart){
  cancelActivePreview('Interrupted edit cancelled; geometry restored.');
 }
 pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
 // A second finger is always a viewport gesture, never an object edit.
 if(pointers.size!==1){cancelActivePreview();drag=null;marquee=null;touchSpan=null;touchCenter=null;return;}
 if(tool==='points'&&!navigating&&pointPick==='box'&&node()?.kind==='shape'){
  const bounds=stage.getBoundingClientRect();
  marquee={start:{x:e.clientX-bounds.left,y:e.clientY-bounds.top},
   end:{x:e.clientX-bounds.left,y:e.clientY-bounds.top},pointerId:e.pointerId};
  requestDraw();return;
 }
 if(navigating&&view!=='quarter'){
  drag={mode:'pan',pointerId:e.pointerId};return;
 }
 raycaster.setFromCamera(screenNDC(e),camera);
 const hits=raycaster.intersectObjects([...compiled?.objects.values()||[]].filter(x=>x.isMesh),false);
 const found=hits.find(h=>h.object.userData.workbenchSelectable);
 const hitId=found?.object.userData.workbenchNodeId||null;
 // Critical: tapping a mesh selects it, DRAGGING ON THE SAME MESH ORBITS.
 // Previously any mesh hit consumed the gesture, so a full mech would barely rotate.
 if(view==='quarter'&&(navigating||tool==='select'||tool==='points'||!found)){
  drag={mode:'orbit',pointerId:e.pointerId,hitId,moved:false,
   start:{x:e.clientX,y:e.clientY}};
  return;
 }
 if(found){
  selected=hitId;selectedIds=new Set([selected]);clearPoint();
  renderTree();renderInspector();applyVisibility();requestDraw();
  const n=node();
  if(['move','scale','rotate'].includes(tool)&&n&&!n.locked){
   const anchor=found.object.getWorldPosition(new THREE.Vector3());
   drag={mode:tool,nodeId:selected,pointerId:e.pointerId,anchor,previous:clone(doc),
    start:{x:e.clientX,y:e.clientY},base:clone(n.transform)};
  }
 }else if(tool==='select'){
  selected='root';selectedIds.clear();clearPoint();renderTree();renderInspector();selectedFeedback();applyVisibility();requestDraw();
 }
});
canvas.addEventListener('pointermove',e=>{
 const prev=pointers.get(e.pointerId);if(!prev)return;
 const dx=e.clientX-prev.x,dy=e.clientY-prev.y;
 pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
 if(pointers.size===2){
  const [a,b]=[...pointers.values()],distance=Math.max(5,Math.hypot(a.x-b.x,a.y-b.y));
  const center={x:(a.x+b.x)/2,y:(a.y+b.y)/2};
  if(touchSpan!==null)cameraZoom(touchSpan/distance);
  if(touchCenter)panCamera(center.x-touchCenter.x,center.y-touchCenter.y);
  touchSpan=distance;touchCenter=center;requestDraw();return;
 }
 if(marquee?.pointerId===e.pointerId){
  const bounds=stage.getBoundingClientRect();
  marquee.end={x:e.clientX-bounds.left,y:e.clientY-bounds.top};
  requestDraw();return;
 }
 if(drag?.mode==='pan'){panCamera(dx,dy);return;}
 if(drag?.mode==='orbit'&&view==='quarter'){
  const traveled=Math.hypot(e.clientX-drag.start.x,e.clientY-drag.start.y);
  if(traveled>3)drag.moved=true;
  if(drag.moved)orbit=orbitAfterDrag(orbit,dx,dy);
  requestDraw();return;
 }
 if(!drag||drag.pointerId!==e.pointerId)return;
 const n=doc.nodes.find(n=>n.id===drag.nodeId);
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
 try{
  const visual=compiled?.objects.get(n.id);
  if(visual){
   visual.position.set(...n.transform.position);
   visual.rotation.set(...n.transform.rotation,'XYZ');
   visual.scale.set(...n.transform.scale);
   if(n.mirrorOf)visual.scale.x*=-1;
   visual.updateMatrixWorld(true);
  }
  requestDraw();
 }catch{/* Drag stays on last valid snapshot. */}
});
function finishCanvas(e){
 pointers.delete(e.pointerId);touchSpan=null;touchCenter=null;
 if(e.type==='pointercancel'){cancelActivePreview('Gesture cancelled.');drag=null;return;}
 if(marquee?.pointerId===e.pointerId){
  if(e.type==='pointercancel')marquee=null;else finishMarquee();
  requestDraw();return;
 }
 if(!drag||drag.pointerId!==e.pointerId)return;
 if(drag.mode==='orbit'&&!drag.moved&&['select','points'].includes(tool)){
  selected=drag.hitId||'root';meshPointPageIndex=0;
  selectedIds=drag.hitId?new Set([selected]):new Set();
  clearPoint();renderTree();renderInspector();applyVisibility();requestDraw();
 }
 if(['move','rotate','scale'].includes(drag.mode)){
  const after=clone(doc),before=drag.previous;drag=null;doc=before;
  commit(after,selected,'Updated selected shape transform.');
 }else drag=null;
}
canvas.addEventListener('pointerup',finishCanvas);canvas.addEventListener('pointercancel',finishCanvas);
// Explicitly suppress iOS Safari touch-and-hold text selection, callout and
// its context menu only on modeling controls. Inputs keep native edit affordances.
for(const el of [canvas,svg,stage,$('selection-actions'),$('object-tree')]){
 el.addEventListener('contextmenu',e=>e.preventDefault());
 el.addEventListener('selectstart',e=>e.preventDefault());
}
canvas.addEventListener('wheel',e=>{e.preventDefault();cameraZoom(Math.exp(e.deltaY*.001));},{passive:false});
canvas.addEventListener('dblclick',e=>{if(e.target===canvas){fitSelected('root');requestDraw();}});

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
  asset.factoryDefinitionId=comparisonSource();
  await db.saveAsset(asset);await renderLibrary();
  message('Saved '+type+' "'+name+'" to reusable library.');switchTab('library');
 }catch(e){message('Could not save asset: '+e.message,true);}
}
$('save-shape').onclick=()=>saveSelected('shape');
$('save-part').onclick=()=>saveSelected('part');
$('save-assembly').onclick=()=>saveSelected('assembly');
async function openAssetForEditing(asset){
 if(!confirm('Open '+asset.name+' as its own editable project? Current project will be saved.'))return;
 try{
  await savePromise;await db.saveProject(doc);
  const inserted=insertAsset(createDocument(asset.name+' / draft'),asset);
  doc=inserted.document;doc.metadata={...doc.metadata,sourceAssetId:asset.id,assetRootId:inserted.selectedId,factoryDefinitionId:asset.factoryDefinitionId||null};
  startHistory();selected=inserted.selectedId;selectedIds=new Set([selected]);
  await db.saveProject(doc);refresh();switchTab('objects');fitSelected();
  message('Opened editable '+asset.name+'. Use SAVE ASSET REVISION to publish to its library history.');
 }catch(e){message('Could not open asset: '+e.message,true);}
}
async function showAssetHistory(asset){
 const panel=$('asset-history');panel.replaceChildren();panel.hidden=false;
 const title=document.createElement('strong');title.textContent='REVISIONS / '+asset.name;panel.append(title);
 const versions=[{revision:asset.revision,savedAt:asset.updated,live:true},...await db.assetRevisionHistory(asset.id)];
 for(const item of versions.slice(0,16)){
  const row=document.createElement('div');row.className='version-row';
  const label=document.createElement('span');label.textContent='v'+item.revision+' · '+new Date(item.savedAt||Date.now()).toLocaleString();
  row.append(label);
  if(!item.live){
   const restore=document.createElement('button');restore.textContent='RESTORE';
   restore.onclick=async()=>{
    if(!confirm('Restore '+asset.name+' version '+item.revision+' as a new latest revision?'))return;
    try{await db.restoreAssetRevision(asset.id,item.id);await renderLibrary();message('Older version restored; newer revisions kept.');}
    catch(e){message(e.message,true);}
   };row.append(restore);
  }else{
   const edit=document.createElement('button');edit.textContent='OPEN';edit.onclick=()=>openAssetForEditing(asset);
   row.append(edit);
  }
  panel.append(row);
 }
}
async function renderCheckpoints(){
 const box=$('project-checkpoints');box.replaceChildren();
 try{
  const checkpoints=(await db.projectCheckpointHistory(doc.id)).slice(0,12);
  if(!checkpoints.length)return;
  const title=document.createElement('strong');title.textContent='PROJECT CHECKPOINTS';box.append(title);
  for(const checkpoint of checkpoints){
   const row=document.createElement('div');row.className='version-row';
   const label=document.createElement('span');label.textContent=checkpoint.label+' · '+new Date(checkpoint.savedAt).toLocaleDateString();
   const restore=document.createElement('button');restore.textContent='RESTORE';
   restore.onclick=async()=>{
    if(!confirm('Restore '+checkpoint.label+'? Your current state will remain undoable.'))return;
    try{commit(await db.loadProjectCheckpoint(checkpoint.id),selected,'Restored checkpoint '+checkpoint.label+'.');}
    catch(e){message(e.message,true);}
   };
   row.append(label,restore);box.append(row);
  }
 }catch(e){message('Checkpoints unavailable: '+e.message,true);}
}
$('save-checkpoint').onclick=async()=>{
 const label=prompt('Checkpoint name',doc.name+' / checkpoint');if(!label?.trim())return;
 try{await db.saveProjectCheckpoint(doc,label.trim());await renderCheckpoints();message('Checkpoint saved.');}
 catch(e){message('Checkpoint failed: '+e.message,true);}
};
$('save-linked-revision').onclick=async()=>{
 const assetId=doc.metadata?.sourceAssetId,rootId=doc.metadata?.assetRootId;
 if(!assetId||!rootId)return message('Open a library asset to create a revision.',true);
 try{
  const old=await db.get('assets',assetId);if(!old)throw Error('Original asset missing');
  const next=makeAsset(doc,rootId,old.type,old.name);next.id=assetId;next.created=old.created;
  next.factoryDefinitionId=old.factoryDefinitionId||comparisonSource();
  await db.saveAsset(next);await renderLibrary();message('Saved new revision of '+old.name+'.');
 }catch(e){message('Revision failed: '+e.message,true);}
};
async function renderLibrary(){
 if(!ready)return;
 const box=$('library-items'),projectsBox=$('project-items');
 try{
  const [assets,projects]=await Promise.all([db.all('assets'),db.all('projects')]);
  projectsBox.replaceChildren();box.replaceChildren();
  $('save-linked-revision').disabled=!doc.metadata?.sourceAssetId;
  void renderCheckpoints();
  for(const project of projects.filter(p=>p?.format===FORMAT)
   .sort((a,b)=>(b.metadata?.updated||0)-(a.metadata?.updated||0)).slice(0,30)){
   const tile=makeTile({id:project.id},project,'project',project.name,
    project.id===doc.id?'CURRENT':(project.nodes?.length-1||0)+' PIECES');
   tile.classList.add('asset-item');
   tile.onclick=async()=>{
    if(project.id===doc.id)return switchTab('objects');
    if(!confirm('Open '+project.name+'? Your current project will be saved.'))return;
    try{
     await savePromise;await db.saveProject(doc);
     doc=validateDocument(project);startHistory();thumbEpoch++;thumbCache.clear();
     await loadReferences();refresh();switchTab('objects');fitSelected();
     message('Opened '+doc.name+'.');
    }catch(e){message('Could not open project: '+e.message,true);}
   };
   projectsBox.append(tile);
  }
  const search=$('library-search').value.trim().toLowerCase();
  for(const asset of assets.filter(a=>a?.format==='m3ch4.workbench.asset'&&a.name.toLowerCase().includes(search))){
   const tile=makeTile({id:asset.id},asset,'asset',asset.name,asset.type.toUpperCase());
   tile.classList.add('asset-item');
   const insert=()=>{
    try{const result=insertAsset(doc,asset);commit(result.document,result.selectedId,'Inserted '+asset.name);
     switchTab('objects');}
    catch(e){message('Insert rejected: '+e.message,true);}
   };
   tile.onclick=insert;
   const actions=document.createElement('div');actions.className='asset-actions';
   const add=document.createElement('button');add.textContent='＋ INSERT';add.title='Insert into assembly';
   add.onclick=e=>{e.stopPropagation();insert();};
   const rename=document.createElement('button');rename.textContent='✎';rename.title='Rename';
   rename.onclick=async e=>{e.stopPropagation();const next=prompt('Rename asset',asset.name);
    if(!next?.trim())return;
    try{asset.name=next.trim().slice(0,100);await db.saveAsset(asset,{keepRevision:false});renderLibrary();}
    catch(err){message(err.message,true);}
   };
   const remove=document.createElement('button');remove.textContent='×';remove.title='Delete';
   remove.onclick=async e=>{e.stopPropagation();
    if(!confirm('Delete '+asset.name+' from the Workbench library?'))return;
    try{await db.remove('assets',asset.id);renderLibrary();}
    catch(err){message(err.message,true);}
   };
   const open=document.createElement('button');open.textContent='OPEN';open.title='Edit independent library draft';
   open.onclick=e=>{e.stopPropagation();openAssetForEditing(asset);};
   const historyButton=document.createElement('button');historyButton.textContent='HISTORY';historyButton.title='Restore an earlier asset version';
   historyButton.onclick=e=>{e.stopPropagation();showAssetHistory(asset);};
   actions.append(add,open,historyButton,rename,remove);tile.append(actions);box.append(tile);
  }
  if(!box.children.length){const p=document.createElement('p');p.className='hint';
    p.textContent='No saved parts yet. Select a piece and tap SAVE AS PART.';
    box.append(p);}
 }catch(e){box.textContent='Library unavailable: '+e.message;}
}

$('import-part').onclick=()=>$('part-json-file').click();
$('part-json-file').onchange=async e=>{
 const file=e.target.files?.[0];if(!file)return;
 try{
  if(file.size>2e6)throw Error('Single asset exceeds 2 MB; use a smaller design or import a project bundle.');
  const validated=validateStandaloneAsset(JSON.parse(await file.text()));
  const asset={...validated,id:'wb-'+crypto.randomUUID(),created:Date.now(),updated:Date.now(),revision:1,
   name:validated.name.trim()};
  await db.saveAsset(asset);await renderLibrary();
  message('Imported editable design "'+asset.name+'". Tap its thumbnail to insert.');
 }catch(error){message('Part import rejected: '+error.message,true);}
 e.target.value='';
};
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
 const image=ref&&referenceObjects.get(ref.imageId);
 $('reference-image-wrap').hidden=!image;
 if(image)$('reference-preview').src=image.data;
 $('reference-rotation').disabled=!ref;
 $('reference-remove').disabled=!ref;
 $('reference-preview-zoom').disabled=!image;
 $('reference-opacity').disabled=!ref;$('reference-width').disabled=!ref;
 $('reference-x').disabled=!ref;$('reference-y').disabled=!ref;
 if(ref){
  $('reference-opacity').value=ref.opacity;$('reference-width').value=ref.scale;
  $('reference-x').value=ref.offset[0];$('reference-y').value=ref.offset[1];
  $('reference-rotation').value=ref.rotation;
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
$('reference-preview-zoom').oninput=()=>{
 $('reference-preview').style.width=(Number($('reference-preview-zoom').value)*100)+'%';
};
$('reference-remove').onclick=()=>{
 if(!activeRef)return;
 const next=clone(doc);next.references=next.references.filter(r=>r.id!==activeRef);
 activeRef=next.references[0]?.id||null;
 commit(next,selected,'Reference removed from this project.');
};
$('reference-replace-file').onchange=async e=>{
 const file=e.target.files?.[0];if(!file||!activeRef)return;
 try{
  const img=await db.importImage(file),next=clone(doc);
  const ref=next.references.find(r=>r.id===activeRef);if(!ref)throw Error('Missing selected reference');
  ref.imageId=img.id;referenceObjects.set(img.id,img);
  commit(next,selected,'Reference image replaced.');renderReferences();
 }catch(error){message('Could not replace reference: '+error.message,true);}
 e.target.value='';
};
$('reference-rotation').onchange=e=>setReference({rotation:Number(e.target.value)});
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
 const caller=new URLSearchParams(window.location.search).get('from');
 const returnLink=$('return-to-game');
 if(caller==='yard'){
  returnLink.href='./test-yard.html';
  returnLink.textContent='TEST YARD';
 }else{
  returnLink.href='./index.html';
  returnLink.textContent='LIVE GAME';
 }
 sceneSetup();
 setupThumbnails();showPrimitiveGrid();
 setupFactoryPicker();
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
  startHistory();ready=true;refresh();if(doc.nodes.length>1)fitSelected();message(loaded?'Opened saved Workbench project.':'Ready. Choose + SHAPE or GAME PART.');
  window.__m3ch4WorkbenchV2Ready=true;
 }catch(e){
  ready=true;startHistory();refresh();if(doc.nodes.length>1)fitSelected();
  message('IndexedDB unavailable ('+e.message+'). Geometry editing works; export for backup.',true);
  window.__m3ch4WorkbenchV2Ready=true;
 }
}
initialize();
