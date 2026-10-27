/** M3CH4 Workbench V2: pure, versioned editable blueprint model. */
export const FORMAT='m3ch4.workbench';
export const VERSION=2;
export const SHAPES=['box','chamfer','cylinder','tube','wedge','plate','taper','loft','mesh'];
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const vec=(v,n)=>Array.isArray(v)&&v.length===n&&v.every(finite);
const uuid=()=>('wb-'+(globalThis.crypto?.randomUUID?.()||Math.random().toString(36).slice(2)+Date.now().toString(36)));
export const identity=()=>({position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]});
export const clone=data=>JSON.parse(JSON.stringify(data));
export function defaultGeometry(type){
 switch(type){
 case 'box':return {type,size:[.3,.3,.3]};
 case 'chamfer':return {type,size:[.35,.35,.3],bevel:.045};
 case 'cylinder':return {type,radius:.16,length:.18,sides:10,axis:'x'};
 case 'tube':return {type,outerRadius:.14,innerRadius:.075,length:.30,sides:10,axis:'z'};
 case 'wedge':return {type,profile:[[-.20,-.14],[.19,-.14],[.12,.14],[-.14,.14]],depth:.24};
 case 'plate':return {type,profile:[[-.20,-.20],[.20,-.20],[.16,.19],[-.16,.19]],depth:.05};
 case 'taper':return {type,from:[.32,.26],to:[.18,.20],length:.46};
 case 'loft':return {type,sections:[
   {y:0,width:.18,front:-.10,back:.10},
   {y:.14,width:.26,front:-.13,back:.12},
   {y:.31,width:.30,front:-.12,back:.11},
   {y:.46,width:.22,front:-.08,back:.08}
 ]};
 default:throw Error('Unsupported shape '+type);
 }
}
export function newShape(type='box',options={}){
 return {id:uuid(),name:options.name||type.toUpperCase(),kind:'shape',
  parentId:options.parentId||'root',geometry:defaultGeometry(type),
  transform:identity(),materialRole:options.materialRole||'olive',
  visible:true,locked:false,mirrorOf:null};
}
export const createDocument=(name='Untitled assembly')=>({
 format:FORMAT,version:VERSION,id:uuid(),name,rootId:'root',
 nodes:[{id:'root',name:'Assembly',kind:'group',parentId:null,
  transform:identity(),visible:true,locked:false,mirrorOf:null}],
 references:[],metadata:{created:Date.now(),updated:Date.now()}
});
const assert=(test,message)=>{if(!test)throw Error(message);};
function polygonOK(points){
 assert(Array.isArray(points)&&points.length>=3&&points.length<=32,'Polygon needs 3–32 points');
 for(const p of points)assert(vec(p,2)&&Math.abs(p[0])<=6&&Math.abs(p[1])<=6,'Invalid polygon point');
 let area=0;
 for(let i=0;i<points.length;i++){
  const a=points[i],b=points[(i+1)%points.length];area+=a[0]*b[1]-b[0]*a[1];
 }
 assert(Math.abs(area)>1e-6,'Zero-area polygon');
 const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
 const on=(a,b,p)=>Math.min(a[0],b[0])-1e-8<=p[0]&&p[0]<=Math.max(a[0],b[0])+1e-8&&Math.min(a[1],b[1])-1e-8<=p[1]&&p[1]<=Math.max(a[1],b[1])+1e-8;
 for(let i=0;i<points.length;i++)for(let j=i+1;j<points.length;j++){
  if(j===i+1||(i===0&&j===points.length-1))continue;
  const a=points[i],b=points[(i+1)%points.length],c=points[j],d=points[(j+1)%points.length];
  const x1=cross(a,b,c),x2=cross(a,b,d),x3=cross(c,d,a),x4=cross(c,d,b);
  if((x1*x2<0&&x3*x4<0)||
    (Math.abs(x1)<1e-9&&on(a,b,c))||(Math.abs(x2)<1e-9&&on(a,b,d))||
    (Math.abs(x3)<1e-9&&on(c,d,a))||(Math.abs(x4)<1e-9&&on(c,d,b)))
   throw Error('Self-intersecting polygon');
 }
}
export function validateGeometry(g){
 assert(g&&SHAPES.includes(g.type),'Unsupported geometry type');
 const pos=n=>finite(n)&&n>.001&&n<=8;
 switch(g.type){
 case 'box':case 'chamfer':
  assert(vec(g.size,3)&&g.size.every(pos),'Invalid box size');
  if(g.type==='chamfer')assert(finite(g.bevel)&&g.bevel>=0&&g.bevel<Math.min(...g.size.slice(0,2))*.5,'Invalid chamfer');
  break;
 case 'cylinder':assert(pos(g.radius)&&pos(g.length),'Invalid cylinder');break;
 case 'tube':assert(pos(g.outerRadius)&&finite(g.innerRadius)&&g.innerRadius>0&&g.innerRadius<g.outerRadius-.005&&pos(g.length),'Invalid tube');break;
 case 'wedge':case 'plate':polygonOK(g.profile);assert(pos(g.depth),'Invalid extrusion depth');break;
 case 'taper':assert(vec(g.from,2)&&vec(g.to,2)&&[...g.from,...g.to].every(pos)&&pos(g.length),'Invalid taper');break;
 case 'mesh': {
  assert(Array.isArray(g.positions)&&g.positions.length>=9&&g.positions.length<=36000&&g.positions.length%3===0&&g.positions.every(n=>finite(n)&&Math.abs(n)<=100),'Invalid imported mesh positions');
  const count=g.positions.length/3;
  assert(Array.isArray(g.indices)&&g.indices.length>=3&&g.indices.length<=90000&&g.indices.length%3===0&&g.indices.every(n=>Number.isInteger(n)&&n>=0&&n<count),'Invalid imported mesh triangles');
  if(g.normals!==undefined)assert(Array.isArray(g.normals)&&g.normals.length===g.positions.length&&g.normals.every(n=>finite(n)&&Math.abs(n)<=1.01),'Invalid mesh normals');
  if(g.pointGroups!==undefined){
   assert(Array.isArray(g.pointGroups)&&g.pointGroups.length<=count,'Invalid logical mesh groups');
   const covered=new Set();
   for(const group of g.pointGroups){
    assert(Array.isArray(group)&&group.length>0,'Empty logical mesh group');
    for(const i of group){
     assert(Number.isInteger(i)&&i>=0&&i<count&&!covered.has(i),'Overlapping logical mesh point groups');
     covered.add(i);
    }
   }
   assert(covered.size===count,'Incomplete logical mesh groups');
  }
  if(g.groups!==undefined){
   assert(Array.isArray(g.groups)&&g.groups.length<=128&&g.groups.every(x=>Number.isInteger(x.start)&&Number.isInteger(x.count)&&Number.isInteger(x.materialIndex)&&x.start>=0&&x.count>=0&&x.start+x.count<=g.indices.length&&x.materialIndex>=0&&x.materialIndex<16),'Invalid material groups');
  }
  break;
 }
 case 'loft':
  assert(Array.isArray(g.sections)&&g.sections.length>=2&&g.sections.length<=24,'Loft needs 2–24 sections');
  let prev=-Infinity;
  for(const p of g.sections){
   assert(finite(p.y)&&p.y>=0&&p.y<=8&&p.y>prev+.002,'Loft sections must ascend in Y');
   assert(pos(p.width)&&finite(p.front)&&finite(p.back)&&p.back-p.front>.015&&Math.abs(p.front)<6&&Math.abs(p.back)<6,'Invalid loft section');
   prev=p.y;
  }
  break;
 }
 if('sides' in g)assert(Number.isInteger(g.sides)&&g.sides>=6&&g.sides<=32,'Sides must be 6–32');
 if('axis' in g)assert(['x','y','z'].includes(g.axis),'Invalid shape axis');
 return g;
}
export function validateDocument(input){
 assert(input?.format===FORMAT&&input.version===VERSION,'Unsupported Workbench document');
 assert(typeof input.id==='string'&&input.id.length<128,'Invalid document ID');
 assert(typeof input.name==='string'&&input.name.length<=100,'Invalid document name');
 assert(Array.isArray(input.nodes)&&input.nodes.length>=1&&input.nodes.length<=1000,'Invalid node count');
 const ids=new Set(),map=new Map();
 for(const n of input.nodes){
  assert(typeof n.id==='string'&&n.id.length>0&&n.id.length<=128&&!ids.has(n.id),'Duplicate or invalid node ID');
  ids.add(n.id);map.set(n.id,n);
  assert(['group','shape','anchor','instance'].includes(n.kind),'Invalid node kind');
  assert(typeof n.name==='string'&&n.name.length<=100,'Invalid node name');
  const t=n.transform;
  assert(t&&vec(t.position,3)&&vec(t.rotation,3)&&vec(t.scale,3)&&t.scale.every(x=>x>.001&&x<=30)&&
   [...t.position,...t.rotation].every(x=>Math.abs(x)<100),'Invalid transform');
  assert(typeof n.visible==='boolean'&&typeof n.locked==='boolean','Invalid flags');
  if(n.kind==='shape')validateGeometry(n.geometry);
  if(n.materialColor!==undefined)assert(Number.isInteger(n.materialColor)&&n.materialColor>=0&&n.materialColor<=0xffffff,'Invalid authored surface color');
  if(n.materialColors!==undefined)assert(Array.isArray(n.materialColors)&&n.materialColors.length<=16&&n.materialColors.every(v=>Number.isInteger(v)&&v>=0&&v<=0xffffff),'Invalid authored material colors');
  if(n.kind==='instance')assert(typeof n.assetId==='string'&&n.assetId.length<128,'Invalid asset reference');
 }
 assert(map.has('root')&&map.get('root').kind==='group'&&map.get('root').parentId===null,'Invalid root node');
 for(const n of input.nodes){
  if(n.id==='root')continue;
  assert(map.has(n.parentId)&&n.parentId!==n.id,'Orphan or self-parented node');
  let cursor=n,seen=new Set([n.id]);
  while(cursor.parentId){
   assert(!seen.has(cursor.parentId),'Cyclic node hierarchy');
   seen.add(cursor.parentId);cursor=map.get(cursor.parentId);
   assert(cursor,'Missing parent');
  }
  if(n.mirrorOf!==null){
   const source=map.get(n.mirrorOf);
   assert(source&&source.id!==n.id&&source.kind==='shape'&&n.kind==='shape'&&!source.mirrorOf,'Invalid mirror source');
  }
 }
 assert(Array.isArray(input.references)&&input.references.length<=12,'Too many reference images');
 for(const ref of input.references){
  assert(['front','side','top','concept','modules'].includes(ref.view),'Invalid reference view');
  assert(typeof ref.id==='string'&&typeof ref.imageId==='string','Invalid reference metadata');
  assert(finite(ref.opacity)&&ref.opacity>=0&&ref.opacity<=1&&finite(ref.scale)&&ref.scale>0&&ref.scale<1e4,'Invalid reference calibration');
  assert(vec(ref.offset,2)&&finite(ref.rotation),'Invalid reference transform');
 }
 return clone(input);
}
export function addNode(document,node){
 const doc=clone(document);doc.nodes.push(clone(node));return validateDocument(doc);
}
export function removeNode(document,id){
 assert(id!=='root','Cannot delete assembly root');
 const doc=clone(document);
 const removed=new Set([id]);let changed=true;
 while(changed){changed=false;for(const n of doc.nodes)if(removed.has(n.parentId)&&!removed.has(n.id)){removed.add(n.id);changed=true;}}
 doc.nodes=doc.nodes.filter(n=>!removed.has(n.id)&&!removed.has(n.mirrorOf));
 return validateDocument(doc);
}
export function updateNode(document,id,change){
 const doc=clone(document);const n=doc.nodes.find(n=>n.id===id);assert(n,'Unknown node');
 Object.assign(n,clone(change));return validateDocument(doc);
}
export function duplicateNode(document,id){
 const doc=clone(document),src=doc.nodes.find(n=>n.id===id);assert(src&&id!=='root','Invalid duplicate');
 const ids=new Map();const descendants=doc.nodes.filter(n=>{
  if(n.id===id)return false;
  let cur=n;
  while(cur?.parentId){
   if(cur.parentId===id)return true;
   cur=doc.nodes.find(p=>p.id===cur.parentId);
  }
  return false;
 });
 for(const n of [src,...descendants])ids.set(n.id,uuid());
 for(const n of [src,...descendants]){
  const copy=clone(n);copy.id=ids.get(n.id);copy.name=n.name+' copy';
  copy.parentId=ids.get(n.parentId)||n.parentId;copy.mirrorOf=null;
  doc.nodes.push(copy);
 }
 return {document:validateDocument(doc),selectedId:ids.get(id)};
}
export function mirrorNode(document,id,linked=true){
 const src=document.nodes.find(n=>n.id===id);assert(src?.kind==='shape'&&!src.mirrorOf,'Mirror a source shape');
 const copy=clone(src);copy.id=uuid();copy.name=src.name+' / MIRROR';copy.mirrorOf=linked?src.id:null;
 copy.transform.position[0]*=-1;copy.transform.rotation[1]*=-1;copy.transform.rotation[2]*=-1;
 return {document:addNode(document,copy),selectedId:copy.id};
}
export function groupNodes(document,ids){
 assert(Array.isArray(ids)&&ids.length>0&&ids.every(id=>id!=='root'),'Select nodes to group');
 const doc=clone(document),selected=doc.nodes.filter(n=>ids.includes(n.id));
 assert(selected.length===ids.length,'Missing selection');
 const parent=selected[0].parentId;
 assert(selected.every(n=>n.parentId===parent),'Group only siblings (preserves local transforms)');
 const group={id:uuid(),name:'New group',kind:'group',parentId:parent,transform:identity(),visible:true,locked:false,mirrorOf:null};
 doc.nodes.push(group);for(const n of selected)n.parentId=group.id;
 return {document:validateDocument(doc),selectedId:group.id};
}
export function makeAsset(document,nodeId,type,name){
 assert(['shape','part','assembly'].includes(type),'Invalid asset type');
 const source=document.nodes.find(n=>n.id===nodeId);assert(source,'Missing source node');
 if(type==='shape')assert(source.kind==='shape','Select a shape first');
 const all=new Set([nodeId]);let changed=true;
 while(changed){changed=false;for(const n of document.nodes)if(all.has(n.parentId)&&!all.has(n.id)){all.add(n.id);changed=true;}}
 const nodes=document.nodes.filter(n=>all.has(n.id)).map(clone);
 for(const n of nodes){if(n.id===nodeId)n.parentId=null;if(n.mirrorOf&&!all.has(n.mirrorOf))n.mirrorOf=null;}
 return {format:'m3ch4.workbench.asset',version:2,id:uuid(),revision:1,
  type,name:String(name||source.name).slice(0,100),rootId:nodeId,nodes,
  created:Date.now(),updated:Date.now()};
}
export function insertAsset(document,asset,parentId='root'){
 assert(asset?.format==='m3ch4.workbench.asset'&&asset.version===2&&Array.isArray(asset.nodes),'Invalid asset');
 const doc=clone(document),remap=new Map(asset.nodes.map(n=>[n.id,uuid()]));
 for(const n of asset.nodes){
  const item=clone(n);item.id=remap.get(n.id);
  item.parentId=remap.get(n.parentId)||parentId;
  item.mirrorOf=remap.get(n.mirrorOf)||null;
  doc.nodes.push(item);
 }
 return {document:validateDocument(doc),selectedId:remap.get(asset.rootId)};
}
export function migrateCalfRecipe(old){
 const doc=createDocument('Imported Yardwalker calf V1');
 if(!old||old.id!=='legs-yard/calf-shell'||old.version!==1||old.stations?.length!==5)throw Error('Invalid legacy calf');
 const shape=newShape('loft',{name:'Imported calf casing'});
 shape.geometry.sections=old.stations.map((s,i)=>({y:i*.11,width:s.width,front:s.front,back:s.back}));
 return addNode(doc,shape);
}
