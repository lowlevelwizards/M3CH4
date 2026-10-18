/** Adapter from an explicit pilot decision to the existing physical motion
 * controller. It never moves/aims/fires or modifies damage. Routes are static
 * geometry A* plus the legacy local avoidance/stuck recovery.
 */
import { planRoute, nextWaypoint } from './navigation.js';
const d=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export function createIntentExecutor(){return {route:null,key:null,
    lastPosition:null,stalledFor:0,lastFailure:null,failures:0};}
export function executeIntent(state,intent,rig,world,collisionRadius,dt) {
    const goal=intent?.point??{x:rig.x,z:rig.z};
    const stationary=intent?.goal==='HOLD'||intent?.goal==='SERVICE';
    if(stationary) {
        state.route=null;state.key=null;
        return {mode:'ANCHOR',point:{...goal},role:'TACTICAL',note:intent?.reason??'HOLD',brakeBias:.86};
    }
    const key=[intent?.goal,intent?.objectiveId??'',Math.round(goal.x),Math.round(goal.z)].join(':');
    if(state.lastPosition) {
        const traveled=d(state.lastPosition,rig);
        if(traveled<.055&&d(rig,goal)>2)state.stalledFor+=dt;
        else state.stalledFor=Math.max(0,state.stalledFor-dt*2);
    }
    state.lastPosition={x:rig.x,z:rig.z};
    const retry=state.stalledFor>2.5;
    if(state.key!==key||!state.route||retry){
        const route=planRoute(world,rig,goal,collisionRadius);
        state.route=route.ok?{waypoints:route.waypoints,index:0}:null;
        state.key=key;
        if(!route.ok){state.lastFailure=route.reason;state.failures++;}
        else state.lastFailure=null;
        state.stalledFor=0;
    }
    const waypoint=state.route?nextWaypoint(state.route,rig)??goal:goal;
    return {mode:'ORDER',point:waypoint,role:'TACTICAL',
        objectiveId:intent?.objectiveId,throttleScale:intent?.goal==='WITHDRAW'?.92:1,
        brakeBias:intent?.goal==='DEFEND'&&d(rig,goal)<3.2?.65:0,
        note:(intent?.goal??'MOVE')+' · '+(intent?.objectiveId??'FIELD'),
        routeFailure:state.lastFailure};
}
