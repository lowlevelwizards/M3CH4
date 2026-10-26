/** Lightweight CPU thumbnail rasterizer: actual authored triangle geometry,
 * no extra WebGL context on a phone. Preserves the chunky low-poly silhouettes.
 */
import * as THREE from 'three';
import {compileGeometry} from './geometry.js';

const defaultColors={olive:'#849275',ochre:'#b48c37',cream:'#cac4ae',iron:'#4c5a56',teal:'#468786',orange:'#c07852',dark:'#293431',bright:'#9ba6a3',armor:'#bbb49c'};
const rgba=(hex,light)=>{
 const n=Math.max(0,Math.min(0xffffff,hex));return 'rgb('+[n>>16&255,n>>8&255,n&255].map(c=>Math.min(255,Math.max(0,Math.round(c*light)))).join(',')+')';
};
const fromPalette=(node)=>{
 const material=node.materialColor??(parseInt(defaultColors[node.materialRole]?.replace('#','')||'849275',16));
 return material;
};
const transforms=new Map();
function draw(doc,rootId,width,height){
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
 const ctx=canvas.getContext('2d',{alpha:false});ctx.fillStyle='#293a30';ctx.fillRect(0,0,width,height);
 const byId=new Map(doc.nodes.map(n=>[n.id,n]));
 const root=byId.get(rootId);
 if(!root)return canvas.toDataURL('image/png');
 const solids=[],angles=new THREE.Euler(.28,-.53,0,'XYZ');
 const toScreen=new THREE.Quaternion().setFromEuler(angles);
 let faceCount=0;
 const stack=[{node:root,matrix:new THREE.Matrix4(),isRoot:true}];
 while(stack.length&&faceCount<1800){
  const {node,matrix,isRoot}=stack.pop();
  const t=node.transform||{position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]};
  const transform=new THREE.Matrix4().compose(
   new THREE.Vector3(...(isRoot?[0,0,0]:t.position)),
   new THREE.Quaternion().setFromEuler(new THREE.Euler(...(isRoot?[0,0,0]:t.rotation),'XYZ')),
   new THREE.Vector3(...(isRoot?[1,1,1]:t.scale))
  );
  const world=matrix.clone().multiply(transform);
  if(node.kind==='shape'&&node.visible!==false){
   const source=node.mirrorOf?byId.get(node.mirrorOf):node;
   let geometry;
   try{geometry=compileGeometry(source.geometry);}catch{continue;}
   const points=geometry.getAttribute('position'),index=geometry.getIndex();
   const triangles=index?index.count/3:points.count/3;
   const skip=Math.max(1,Math.ceil(triangles/500));
   const material=fromPalette(node);
   const point=i=>{
    const p=new THREE.Vector3(points.getX(i),points.getY(i),points.getZ(i)).applyMatrix4(world);
    p.applyQuaternion(toScreen);return [p.x,p.y,p.z];
   };
   for(let k=0;k<triangles;k+=skip){
    const tri=[];
    for(let v=0;v<3;v++){
     const i=index?index.getX(k*3+v):k*3+v;
     tri.push(point(i));
    }
    if(tri.some(p=>p.some(x=>!Number.isFinite(x))))continue;
    const a=new THREE.Vector3(tri[1][0]-tri[0][0],tri[1][1]-tri[0][1],tri[1][2]-tri[0][2]);
    const b=new THREE.Vector3(tri[2][0]-tri[0][0],tri[2][1]-tri[0][1],tri[2][2]-tri[0][2]);
    const normal=a.cross(b).normalize();
    const light=Math.min(1.25,Math.max(.55,.8+normal.x*.22+normal.y*.26-normal.z*.10));
    solids.push({tri,depth:tri.reduce((s,p)=>s+p[2],0)/3,color:rgba(material,light)});
   }
   faceCount+=triangles;
   geometry.dispose();
  }
  for(const child of doc.nodes)if(child.parentId===node.id){
   stack.push({node:child,matrix:world,isRoot:false});
  }
 }
 if(!solids.length){
  ctx.fillStyle='#8aa28d';ctx.font='bold 25px system-ui';ctx.textAlign='center';ctx.fillText('▦',width/2,height/2+9);
  return canvas.toDataURL('image/png');
 }
 const xs=solids.flatMap(f=>f.tri.map(p=>p[0])),ys=solids.flatMap(f=>f.tri.map(p=>p[1]));
 const minx=Math.min(...xs),maxx=Math.max(...xs),miny=Math.min(...ys),maxy=Math.max(...ys);
 const size=Math.max(maxx-minx,maxy-miny,.05),scale=Math.min(width,height)*.72/size;
 const cx=(minx+maxx)/2,cy=(miny+maxy)/2;
 solids.sort((a,b)=>b.depth-a.depth);
 ctx.lineJoin='round';ctx.lineWidth=.7;
 for(const f of solids){
  ctx.beginPath();
  f.tri.forEach((p,i)=>{
   const x=width/2+(p[0]-cx)*scale,y=height/2-(p[1]-cy)*scale;
   i?ctx.lineTo(x,y):ctx.moveTo(x,y);
  });
  ctx.closePath();ctx.fillStyle=f.color;ctx.fill();
  ctx.strokeStyle='#111d17a0';ctx.stroke();
 }
 return canvas.toDataURL('image/png');
}
export function thumbnailForDocument(doc,rootId='root',width=140,height=100){
 if(!doc?.nodes?.length)return '';
 return draw(doc,rootId,width,height);
}
export function thumbnailForPrimitive(geometry,color='#849275'){
 return draw({nodes:[
  {id:'root',kind:'group',transform:{position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]},visible:true},
  {id:'shape',parentId:'root',kind:'shape',visible:true,materialColor:parseInt(color.replace('#',''),16),
   geometry,transform:{position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]}}
 ]},'root');
}
export function thumbnailForAsset(asset){
 const nodes=asset.nodes.map(n=>({...n,parentId:n.id===asset.rootId?'root':n.parentId}));
 return draw({nodes:[{id:'root',kind:'group',visible:true,transform:{position:[0,0,0],rotation:[0,0,0],scale:[1,1,1]}},...nodes]},'root');
}
