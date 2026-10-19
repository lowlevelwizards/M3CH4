/** Sparse deterministic A* grid for the compact industrial arena. Static AABBs
 * are inflated by collision radius; moving rigs stay in the legacy local
 * collision/recovery layer. Planner never teleports an actor.
 */
const length=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
function valid(p,world,pad) {
    if(p.x<world.minX+pad||p.x>world.maxX-pad||
        p.z<world.minZ+pad||p.z>world.maxZ-pad)return false;
    return !(world.obstacles??[]).some(o=>!o.dynamic &&
        p.x>o.minX-pad&&p.x<o.maxX+pad&&p.z>o.minZ-pad&&p.z<o.maxZ+pad);
}
function clearSegment(a,b,world,pad) {
    const samples=Math.max(2,Math.ceil(length(a,b)/.9));
    for(let i=0;i<=samples;i++){
        const t=i/samples;
        if(!valid({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t},world,pad))return false;
    }
    return true;
}
function buildNodes(world,step,pad) {
    const nodes=[];
    for(let x=world.minX+pad;x<=world.maxX-pad;x+=step)
        for(let z=world.minZ+pad;z<=world.maxZ-pad;z+=step) {
            const p={x:Math.round(x*100)/100,z:Math.round(z*100)/100};
            if(valid(p,world,pad))nodes.push(p);
        }
    return nodes;
}
export function planRoute(world,from,goal,radius=.95) {
    if(!world||!from||!goal)return {ok:false,reason:'NO ROUTE DATA',waypoints:[]};
    const pad=radius+.34;
    if(!valid(goal,world,pad))return {ok:false,reason:'GOAL BLOCKED',waypoints:[]};
    if(!valid(from,world,pad)){
        // A real chassis may be physically legal but inside our *inflated*
        // safety envelope beside a concrete screen. Searching from that
        // start as though it were an obstacle makes every A* edge impossible.
        // Guide it to the nearest clearance point using PHYSICAL steering.
        // Never teleport, alter collision geometry, or invent a route through
        // the actual obstacle.
        let escape=null,best=Infinity;
        for(const reach of [.65,1.2,1.8,2.6,3.5,4.5]){
            for(let i=0;i<16;i++){
                const angle=i*Math.PI/8;
                const p={x:from.x+Math.cos(angle)*reach,z:from.z+Math.sin(angle)*reach};
                const d=length(from,p);
                if(d<best&&valid(p,world,pad)){escape=p;best=d;}
            }
            if(escape)break;
        }
        if(!escape)return {ok:false,reason:'NO CLEARANCE FROM START',waypoints:[]};
        const continuation=planRoute(world,escape,goal,radius);
        if(!continuation.ok)return continuation;
        return {...continuation,waypoints:[escape,...continuation.waypoints],
            cost:best+continuation.cost,recoveredStart:true};
    }
    if(clearSegment(from,goal,world,pad))return {ok:true,waypoints:[{...goal}],cost:length(from,goal)};
    const step=4.0,nodes=buildNodes(world,step,pad);
    const all=[{x:from.x,z:from.z},...nodes,{x:goal.x,z:goal.z}],n=all.length;
    const start=0,end=n-1,open=new Set([start]);
    const g=new Array(n).fill(Infinity),f=new Array(n).fill(Infinity);
    const via=new Array(n).fill(-1),closed=new Set();
    g[start]=0;f[start]=length(from,goal);
    // Bound to a compact yard: no graph pre-processing / navmesh dependency.
    for(let iterations=0;iterations<n*2&&open.size;iterations++){
        const current=[...open].sort((a,b)=>f[a]-f[b]||a-b)[0];
        if(current===end){
            const indexes=[];let at=current;
            while(at!==start&&at>=0){indexes.push(at);at=via[at];}
            const route=indexes.reverse().map(i=>({...all[i]}));
            // Elide any intermediate corner with unobstructed visibility.
            const smooth=[];let origin=from;
            for(let i=0;i<route.length;){
                let j=route.length-1;
                while(j>i&&!clearSegment(origin,route[j],world,pad))j--;
                smooth.push(route[j]);origin=route[j];i=j+1;
            }
            return {ok:true,waypoints:smooth,cost:g[end]};
        }
        open.delete(current);closed.add(current);
        for(let candidate=1;candidate<n;candidate++){
            if(candidate===current||closed.has(candidate))continue;
            const d=length(all[current],all[candidate]);
            if(d>step*1.51&&candidate!==end&&current!==start)continue;
            if(!clearSegment(all[current],all[candidate],world,pad))continue;
            const alt=g[current]+d;
            if(alt>=g[candidate])continue;
            via[candidate]=current;g[candidate]=alt;
            f[candidate]=alt+length(all[candidate],all[end]);open.add(candidate);
        }
    }
    return {ok:false,reason:'NO PASSABLE PATH',waypoints:[]};
}
export function nextWaypoint(routeState,position,radius=1.6){
    const points=routeState?.waypoints??[];
    while(routeState.index<points.length-1 &&
        length(position,points[routeState.index])<radius)routeState.index++;
    return points[routeState.index]??null;
}

/** Capture/defense needs ANY safe position inside the scoring circle, not a
 * single exact center coordinate. Distinct entry bearings allow recovery from
 * a blocked segment without changing the physical collision envelope. */
export function planApproachRoute(world,from,center,zoneRadius,collisionRadius=.95,attempt=0,avoid=null){
    const maxEntry=Math.max(.2,zoneRadius-collisionRadius-.4);
    const candidates=[{x:center.x,z:center.z}];
    for(let i=0;i<12;i++){
        const angle=(i+attempt*3)*Math.PI/6;
        candidates.push({x:center.x+Math.cos(angle)*maxEntry*.72,
            z:center.z+Math.sin(angle)*maxEntry*.72});
    }
    // Prefer physically direct entries first. The grid-search fallback
    // evaluates only nearby alternatives, keeping 60Hz phone pacing bounded.
    const sorted=candidates.filter(point=>valid(point,world,collisionRadius+.34))
        .sort((a,b)=> {
            const penalty=p=>avoid&&length(p,avoid)<3.0?12:0;
            return length(from,a)+penalty(a)-length(from,b)-penalty(b);
        });
    for(const point of sorted)
        if(clearSegment(from,point,world,collisionRadius+.34))
            return {ok:true,waypoints:[point],cost:length(from,point),approach:point};
    let best=null,score=Infinity;
    for(const point of sorted.slice(0,4)){
        const path=planRoute(world,from,point,collisionRadius);
        if(!path.ok)continue;
        const weight=path.cost+Math.max(0,zoneRadius/2-
            Math.hypot(center.x-point.x,center.z-point.z))*.05;
        if(weight<score-1e-6){score=weight;best={...path,approach:point};}
    }
    return best??{ok:false,reason:'NO SAFE OBJECTIVE APPROACH',waypoints:[]};
}
