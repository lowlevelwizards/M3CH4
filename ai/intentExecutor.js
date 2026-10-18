/** Adapter from an explicit pilot decision to the existing physical motion
 * controller. It never moves/aims/fires or modifies damage. Routes are static
 * geometry A* plus the legacy local avoidance/stuck recovery.
 */
import { planRoute, planApproachRoute, nextWaypoint } from './navigation.js';
const d=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export function createIntentExecutor(){return {route:null,key:null,
    lastPosition:null,stalledFor:0,lastFailure:null,failures:0,retryLeft:0,
    replanAttempts:0,lastWaypoint:null,abortReason:null};}
export function executeIntent(state,intent,rig,world,collisionRadius,dt) {
    state.retryLeft=Math.max(0,(state.retryLeft??0)-dt);
    const goal=intent?.point??{x:rig.x,z:rig.z};
    const stationary=intent?.goal==='HOLD'||intent?.goal==='SERVICE';
    if(stationary) {
        state.route=null;state.key=null;
        return {mode:'ANCHOR',point:{...goal},role:'TACTICAL',note:intent?.reason??'HOLD',brakeBias:.86};
    }
    const key=[intent?.goal,intent?.objectiveId??'',Math.round(goal.x),Math.round(goal.z)].join(':');
    if(state.lastPosition) {
        const traveled=d(state.lastPosition,rig);
        const finalWaypoint=state.route?.waypoints?.at(-1)??goal;
        if(traveled<.055&&d(rig,finalWaypoint)>1.6)state.stalledFor+=dt;
        else state.stalledFor=Math.max(0,state.stalledFor-dt*2);
    }
    state.lastPosition={x:rig.x,z:rig.z};
    const retry=state.stalledFor>2.5;
    const failedWaypoint=retry?state.route?.waypoints?.[state.route.index]??null:null;
    if(retry){state.replanAttempts++;state.abortReason='STALLED AT WAYPOINT';}
    if(state.key!==key||retry||(!state.route&&state.retryLeft===0)){
        const territory=['CAPTURE','CONTEST','DEFEND'].includes(intent?.goal)&&
            Number.isFinite(intent?.radius);
        const route=territory?
            planApproachRoute(world,rig,goal,intent.radius,collisionRadius,state.replanAttempts):
            planRoute(world,rig,goal,collisionRadius);
        state.route=route.ok?{waypoints:route.waypoints,index:0}:null;
        state.key=key;
        if(!route.ok){state.lastFailure=route.reason;state.failures++;
            state.abortReason=route.reason;
            state.retryLeft=2.5;}
        else {state.lastFailure=null;state.abortReason=null;}
        state.stalledFor=0;
    }
    if(!state.route)return {mode:'ANCHOR',point:{x:rig.x,z:rig.z},
        role:'TACTICAL',brakeBias:1,
        note:'ROUTE FAILURE · '+state.lastFailure,routeFailure:state.lastFailure};
    const waypoint=nextWaypoint(state.route,rig)??goal;
    return {mode:'ORDER',point:waypoint,role:'TACTICAL',
        objectiveId:intent?.objectiveId,throttleScale:intent?.goal==='WITHDRAW'?.92:1,
        brakeBias:intent?.goal==='DEFEND'&&d(rig,goal)<3.2?.65:0,
        note:(intent?.goal??'MOVE')+' · '+(intent?.objectiveId??'FIELD'),
        approach:state.route?.waypoints.at(-1),
        routeFailure:state.lastFailure};
}
