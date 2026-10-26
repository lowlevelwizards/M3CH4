/** IndexedDB-backed project and asset library. No career/test-yard storage keys. */
const DB='m3ch4-workbench-v2',VER=1;
const STORES=['projects','assets','images','settings'];
let promise=null;
function open(){
 if(!promise)promise=new Promise((resolve,reject)=>{
  if(!('indexedDB' in globalThis)){reject(Error('IndexedDB unavailable'));return;}
  const req=indexedDB.open(DB,VER);
  req.onupgradeneeded=()=>{
   const db=req.result;
   for(const s of STORES)if(!db.objectStoreNames.contains(s))db.createObjectStore(s,{keyPath:'id'});
  };
  req.onerror=()=>reject(req.error||Error('Storage unavailable'));
  req.onsuccess=()=>resolve(req.result);
 }).catch(e=>{promise=null;throw e;});
 return promise;
}
async function transact(store,mode,fn){
 const db=await open();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction(store,mode),obj=tx.objectStore(store),req=fn(obj);
  let result;
  req.onsuccess=()=>{result=req.result;};
  req.onerror=()=>reject(req.error);
  tx.oncomplete=()=>resolve(result);
  tx.onerror=()=>reject(tx.error);
 });
}
export const put=(store,value)=>transact(store,'readwrite',db=>db.put(value));
export const get=(store,id)=>transact(store,'readonly',db=>db.get(id));
export const remove=(store,id)=>transact(store,'readwrite',db=>db.delete(id));
export const all=store=>transact(store,'readonly',db=>db.getAll());
export async function saveProject(doc){
 const record={...structuredClone(doc),metadata:{...(doc.metadata||{}),updated:Date.now()}};
 await put('projects',record);await put('settings',{id:'lastProject',projectId:doc.id});return record;
}
export const lastProject=async()=>{const s=await get('settings','lastProject');return s?.projectId?get('projects',s.projectId):null;};
export async function saveAsset(asset){
 const old=await get('assets',asset.id);
 const record={...structuredClone(asset),revision:(old?.revision||0)+1,updated:Date.now()};
 await put('assets',record);return record;
}
export async function importImage(file){
 if(!file||!file.type.startsWith('image/')||file.size>7e6)throw Error('Please use an image smaller than 7 MB.');
 const src=await new Promise((resolve,reject)=>{
  const reader=new FileReader();reader.onerror=()=>reject(Error('Image read failed'));
  reader.onload=()=>resolve(reader.result);reader.readAsDataURL(file);
 });
 const image=await new Promise((resolve,reject)=>{
  const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error('Invalid image'));img.src=src;
 });
 const scale=Math.min(1,1600/Math.max(image.width,image.height));
 const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));
 canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
 const id='ref-'+(crypto.randomUUID?.()||Date.now());
 const result={id,name:file.name,width:canvas.width,height:canvas.height,data:canvas.toDataURL('image/jpeg',.87)};
 await put('images',result);return result;
}
export async function exportBundle(doc){
 const assets=await all('assets');
 const references=await Promise.all(doc.references.map(r=>get('images',r.imageId)));
 return {format:'m3ch4.workbench.bundle',version:1,project:structuredClone(doc),
  assets:assets.filter(a=>a.format==='m3ch4.workbench.asset'),
  images:references.filter(Boolean)};
}
export async function importBundle(bundle){
 if(bundle?.format!=='m3ch4.workbench.bundle'||bundle.version!==1)throw Error('Unsupported Workbench bundle');
 const {validateDocument}=await import('./blueprint.js');
 const doc=validateDocument(bundle.project);
 if(!Array.isArray(bundle.assets)||!Array.isArray(bundle.images)||bundle.assets.length>250||bundle.images.length>12)
  throw Error('Invalid bundle assets');
 for(const item of bundle.images){
  if(typeof item.id!=='string'||typeof item.data!=='string'||!/^data:image\/(jpeg|png|webp);base64,/.test(item.data)||item.data.length>5e6)
   throw Error('Invalid reference image in bundle');
 }
 for(const a of bundle.assets){
  if(a?.format!=='m3ch4.workbench.asset'||a.version!==2||!Array.isArray(a.nodes))throw Error('Invalid library asset');
  const trial={format:'m3ch4.workbench',version:2,id:'import-validate',name:a.name||'',rootId:'root',nodes:[
   {id:'root',name:'root',kind:'group',parentId:null,transform:{position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]},visible:true,locked:false,mirrorOf:null},
   ...a.nodes.map(n=>({...n,parentId:n.parentId||'root'}))
  ],references:[]};
  // Assets can contain their own root named anything. Validate geometry nodes individually.
  const {validateGeometry}=await import('./blueprint.js');
  for(const n of a.nodes)if(n.kind==='shape')validateGeometry(n.geometry);
 }
 for(const i of bundle.images)await put('images',i);
 for(const a of bundle.assets)await put('assets',a);
 await saveProject(doc);return doc;
}
