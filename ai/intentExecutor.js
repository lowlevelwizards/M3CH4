/** Adapter from an explicit pilot decision to the existing physical motion
 * controller. It never moves/aims/fires or modifies damage. Routes are static
 * geometry A* plus the legacy local avoidance/stuck recovery.
 */
import { planRoute, planApproachRoute, nextWaypoint } from './navigation.js';
import { trafficAdvice } from './trafficCoordination.js';
const d=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export function createIntentExecutor(){return {route:null,key:null,
    lastPosition:null,stalledFor:0,lastFailure:null,failures:0,retryLeft:0,
    replanAttempts:0,lastWaypoint:null,abortReason:null,
    trafficLock:null,trafficYields:0,zoneSettles:0,routeSwitches:0,
    viaIdentity:null,viaReached:false,trafficWaitTime:0,
    trafficWaits:0,trafficQueueSeconds:0};}
export function executeIntent(state,intent,rig,world,collisionRadius,dt,traffic=[],
    options={}) {
    state.retryLeft=Math.max(0,(state.retryLeft??0)-dt);
    const finalGoal=intent?.point??{x:rig.x,z:rig.z};
    const viaIdentity=[intent?.goal,intent?.objectiveId??'',
        Math.round(finalGoal.x),Math.round(finalGoal.z)].join(':');
    if(state.viaIdentity!==viaIdentity){
        state.viaIdentity=viaIdentity;state.viaReached=false;
    }
    if(intent?.viaPoint&&d(rig,intent.viaPoint)<1.7)state.viaReached=true;
    const via=!state.viaReached?intent?.viaPoint??null:null;
    const goal=via??finalGoal;
    // Physical presence already inside an objective is an accomplished
    // approach; stop steering instead of continually seeking a sample point.
    const arrived=(intent?.goal==='CAPTURE'||intent?.goal==='CONTEST')&&
        !intent.contested&&Number.isFinite(intent?.radius)&&
        d(rig,finalGoal)<Math.max(.65,intent.radius-collisionRadius-.5);
    const guarding=intent?.goal==='DEFEND'&&d(rig,finalGoal)<1.15;
    const stationary=intent?.goal==='HOLD'||intent?.goal==='SERVICE'||arrived||guarding;
    if(stationary) {
        state.route=null;state.key=null;state.trafficLock=null;state.stalledFor=0;
        state.trafficWaitTime=0;
        state.lastPosition={x:rig.x,z:rig.z};state.lastYaw=rig.yaw??null;
        if(arrived||guarding)state.zoneSettles++;
        return {mode:'ANCHOR',point:{x:rig.x,z:rig.z},role:'TACTICAL',
            objectiveId:intent?.objectiveId,
            note:arrived?'SCORING FOOTPRINT':guarding?'HOLD SCORING POSITION':intent?.reason??'HOLD',
            brakeBias:.94};
    }
    const key=[intent?.goal,intent?.objectiveId??'',Math.round(goal.x),Math.round(goal.z)].join(':');
    if(state.lastPosition) {
        const waypoint=state.route?.waypoints?.[state.route.index]??goal;
        // Evaluate actual progress per second, not motion per simulation tick.
        const progress=d(state.lastPosition,waypoint)-d(rig,waypoint);
        const turn=Number.isFinite(rig.yaw)&&Number.isFinite(state.lastYaw)?
            Math.abs(Math.atan2(Math.sin(rig.yaw-state.lastYaw),Math.cos(rig.yaw-state.lastYaw))):0;
        if(progress<.07*dt&&turn<.08*dt&&d(rig,waypoint)>1.6)
            state.stalledFor+=dt;
        else state.stalledFor=Math.max(0,state.stalledFor-dt*2);
    }
    state.lastPosition={x:rig.x,z:rig.z};state.lastYaw=rig.yaw??null;
    const retry=state.stalledFor>2.5;
    const failedWaypoint=retry?state.route?.waypoints?.[state.route.index]??null:null;
    if(retry){state.replanAttempts++;state.abortReason='STALLED AT WAYPOINT';}
    if(state.key!==key||retry||(!state.route&&state.retryLeft===0)){
        if(state.key && state.key!==key)state.routeSwitches++;
        if(state.key!==key){state.trafficLock=null;state.trafficWaitTime=0;}
        // CAPTURE/CONTEST may stop anywhere within the true scoring radius.
        // DEFEND already receives a carefully chosen interior point from
        // chooseDefendPosition; another radius around THAT point can leave the
        // chassis outside the actual objective (detected by AI Olympics).
        const territory=['CAPTURE','CONTEST'].includes(intent?.goal)&&
            Number.isFinite(intent?.radius);
        let route=territory?
            planApproachRoute(world,rig,goal,intent.radius,collisionRadius,state.replanAttempts,
                failedWaypoint,traffic):
            planRoute(world,rig,goal,collisionRadius);
        // A speculative sheltered via-point must never strand an otherwise
        // valid capture route. Fall back to real destination on route failure.
        if(!route.ok&&via){
            state.viaReached=true;
            route=territory?
              planApproachRoute(world,rig,finalGoal,intent.radius,
                collisionRadius,state.replanAttempts,failedWaypoint,traffic):
              planRoute(world,rig,finalGoal,collisionRadius);
        }
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
    let adjusted=waypoint;
    const lock=state.trafficLock;
    if(lock&&lock.left>0&&d(rig,lock.point)>.95){
        lock.left=Math.max(0,lock.left-dt);
        adjusted=lock.point;
    }else{
        state.trafficLock=null;
        // An established defender never sacrifices scoring for ordinary
        // ally avoidance; dynamic body physics still resolves actual contact.
        if(intent?.goal!=='DEFEND'||d(rig,goal)>2.3){
            const advice=trafficAdvice(rig,waypoint,traffic,world,collisionRadius,{
                policy:options.trafficPolicy??'legacy',
                actorId:options.actorId??null,waitedSeconds:state.trafficWaitTime});
            if(advice?.kind==='WAIT'){
                state.trafficWaitTime+=dt;
                state.trafficQueueSeconds+=dt;
                if(state.trafficWaitTime<=dt*1.5)state.trafficWaits++;
                state.stalledFor=0;
                return {mode:'ANCHOR',goal:'TRAFFIC_WAIT',point:{x:rig.x,z:rig.z},
                    role:'TACTICAL',objectiveId:intent?.objectiveId,
                    note:'YIELD · '+(advice.toId??'CREW'),
                    brakeBias:1,trafficQueued:true,missionPoint:finalGoal};
            }
            if(advice?.kind==='PASS'){
                adjusted=advice.point;state.trafficYields++;
                state.trafficLock={point:{...advice.point},left:1.3};
            }
            if(!advice||advice.kind==='PASS')
                state.trafficWaitTime=Math.max(0,state.trafficWaitTime-dt*.6);
        }
    }
    return {mode:'ORDER',goal:intent?.goal??null,point:adjusted,role:'TACTICAL',
        missionPoint:finalGoal,objectiveId:intent?.objectiveId,throttleScale:intent?.goal==='WITHDRAW'?.92:1,
        brakeBias:intent?.goal==='DEFEND'&&d(rig,goal)<3.2?.65:0,
        note:(intent?.goal??'MOVE')+' · '+(intent?.objectiveId??'FIELD')+
          (adjusted!==waypoint?' · YIELD TRAFFIC':''),
        approach:state.route?.waypoints.at(-1),
        routeFailure:state.lastFailure};
}
