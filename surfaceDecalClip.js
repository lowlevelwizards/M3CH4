/** Clip a source triangle against a pixel scar's 2D tangent rectangle.
 * Pure geometry operation, testable without THREE. Every new vertex is an
 * interpolation of a real triangle edge: no generated scar can leave the mesh.
 * Each vertex has {x,y,z,u,v}; u/v are in local impact-plane metres.
 */
export function clipProjectedTriangle(vertices,halfWidth,halfHeight){
  if(!Array.isArray(vertices)||vertices.length!==3||!(halfWidth>0)||!(halfHeight>0))return [];
  let polygon=vertices;
  const planes=[
    v=>v.u+halfWidth,
    v=>halfWidth-v.u,
    v=>v.v+halfHeight,
    v=>halfHeight-v.v,
  ];
  for(const distance of planes){
    if(!polygon.length)break;
    const clipped=[];
    for(let i=0;i<polygon.length;i++){
      const a=polygon[i],b=polygon[(i+1)%polygon.length];
      const da=distance(a),db=distance(b),inA=da>=0,inB=db>=0;
      if(inA)clipped.push(a);
      if(inA!==inB){
        const t=da/(da-db);
        const v={};
        for(const key of ['x','y','z','u','v'])v[key]=a[key]+(b[key]-a[key])*t;
        clipped.push(v);
      }
    }
    polygon=clipped;
  }
  return polygon;
}
