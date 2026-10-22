/** No physics/nav changes: render metadata is strictly derived from existing
 * certified arena colliders. All audience and lighting structures are mounted
 * at the rear/perimeter, so there is no fake cover in a live firing lane.
 */
const round=n=>Math.round(n*1000)/1000;
export function backlotVisualPlan(world){
  if(!world||!Array.isArray(world.obstacles))throw new Error('Arena physics map required');
  const bounds={minX:world.minX,maxX:world.maxX,minZ:world.minZ,maxZ:world.maxZ};
  const obstacleFacades=world.obstacles.filter(o=>o.kind!=='pillar').map(o=>{
    const width=o.maxX-o.minX,depth=o.maxZ-o.minZ,h=o.height||1.1;
    return {
      id:o.id,kind:o.kind,
      centerX:round((o.minX+o.maxX)/2),
      centerZ:round((o.minZ+o.maxZ)/2),
      faceZ:round(o.minZ-.018),backZ:round(o.maxZ+.018),
      width:round(Math.max(.1,width-.22)),height:round(Math.max(.12,h-.20)),
      baseHeight:h,depth,
    };
  });
  const pillars=world.obstacles.filter(o=>o.kind==='pillar');
  const floodlightBases=pillars.filter(o=>
    Math.abs((o.minX+o.maxX)/2)>world.maxX*.74 &&
    Math.abs((o.minZ+o.maxZ)/2)>world.maxZ*.70)
    .filter((_,i)=>i%2===0).slice(0,4).map(o=>({
      x:round((o.minX+o.maxX)/2),z:round((o.minZ+o.maxZ)/2),
      y:round(o.height),
    }));
  const northPosts=[],southPosts=[],sidePosts=[];
  for(let x=world.minX+2;x<world.maxX-1;x+=4){
    northPosts.push(round(x));southPosts.push(round(x));
  }
  for(let z=world.minZ+3;z<world.maxZ-2;z+=5)sidePosts.push(round(z));
  return Object.freeze({
    bounds,obstacleFacades,floodlightBases,northPosts,southPosts,sidePosts,
    // Elevated, behind actual north barrier; never an invisible front-line
    // obstacle. There are no new gameplay walls, AABBs, or colliders.
    spectatorDecks:[
      {x:world.minX+10,z:world.minZ-2.2,width:10},
      {x:world.maxX-10,z:world.minZ-2.2,width:10},
    ],
  });
}
