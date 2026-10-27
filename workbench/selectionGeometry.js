/** Pure Workbench marquee selection and stable screen-space rectangle tests. */
export const rectFromPoints=(a,b)=>({
 left:Math.min(a.x,b.x),right:Math.max(a.x,b.x),
 top:Math.min(a.y,b.y),bottom:Math.max(a.y,b.y)
});
export function selectedInRectangle(points,rect,{through=false,operation='replace',previous=[]}={}){
 const inside=new Set(points.filter(p=>p.x>=rect.left&&p.x<=rect.right&&p.y>=rect.top&&p.y<=rect.bottom&&
  p.inFrustum!==false&&(through||p.visible!==false)).map(p=>p.id));
 const next=operation==='replace'?new Set():new Set(previous);
 if(operation==='subtract')for(const id of inside)next.delete(id);
 else for(const id of inside)next.add(id);
 return next;
}
export function selectedCentroid(points){
 if(!points.length)return [0,0,0];
 const sum=[0,0,0];
 for(const point of points)for(let axis=0;axis<3;axis++)sum[axis]+=point[axis];
 return sum.map(n=>n/points.length);
}
export function offsetPoints(points,delta){
 if(delta.length!==3||delta.some(n=>!Number.isFinite(n)))throw Error('Invalid vertex displacement');
 return points.map(pos=>pos.map((n,i)=>Number((n+delta[i]).toFixed(5))));
}
