/**
 * k4v.1 AI Olympics: measurements independent of policy implementation.
 * The main innovation is distinguishing real obstruction from *intentional*
 * holding, facing, or low-speed progress. Never classify a single 60Hz
 * low-displacement tick as a stuck machine.
 */
export const OLYMPIC_EVENTS=Object.freeze([
  Object.freeze({id:'open-transit',name:'Open-ground transit',group:'mobility',
    description:'Travel to a reachable point without cover or opponents',seconds:35}),
  Object.freeze({id:'wall-detour',name:'Blocked-path navigation',group:'mobility',
    description:'Find a physical path around a tall obstruction',seconds:55}),
  Object.freeze({id:'ally-choke',name:'Squad traffic',group:'coordination',
    description:'Three same-family physical mechs share a confined route without deadlocking',seconds:55}),
  Object.freeze({id:'rear-ambush',name:'Rear-sector ambush',group:'awareness',
    description:'Infer a shot bearing and turn or seek safety without x-ray vision',seconds:16}),
  Object.freeze({id:'contact-dropout',name:'Lost visual contact',group:'awareness',
    description:'Refrain from aiming at an unobserved target after a sensor dropout',seconds:15}),
  Object.freeze({id:'target-triage',name:'Observed attacker selection',group:'combat',
    description:'Prefer the observed immediate attacker, not an unseen exact position',seconds:14}),
  Object.freeze({id:'objective-anchor',name:'Objective discipline',group:'coordination',
    description:'Occupy a scoring area and remain inside its useful footprint',seconds:42}),
  Object.freeze({id:'wounded-withdrawal',name:'Damaged-system retreat',group:'survival',
    description:'Respond to genuine damaged condition and sustained hostile fire',seconds:25})
]);
export const EVENT_IDS=Object.freeze(OLYMPIC_EVENTS.map(e=>e.id));
export const METRIC_VERSION='k4v1-diagnostic-1';
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const round=(x,n=3)=>Math.round(x*10**n)/10**n;
const average=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0;
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));

export function createMotionDiagnostic(){
  return {seconds:0,travel:0,intentionalHold:0,usefulTurning:0,
    usefulProgress:0,realStall:0,obstacleStall:0,allyStall:0,
    unclassifiedStall:0,routeFailure:0,recoveryTime:0,
    collisions:0,oscillations:0,lowProgressRun:0,lastImpact:0,
    loopSeconds:0,peakNoAdvance:0,noAdvance:0,bestMissionDistance:null,
    lastMissionKey:null,
    lastPosition:null,lastYaw:null,lastVelocity:null,lastReversalAt:-Infinity,
    worstStall:0,peakStall:0,routeSwitches:0,trafficYields:0};
}
/** Call after the physical step with the *actual* control returned by the
 * movement controller and the same order used for that step. */
export function sampleMotion(m,rig,drive,order,executor,world,dt,
    neighbours=[],time=m.seconds){
  if(!Number.isFinite(dt)||dt<=0)throw new RangeError('Bad diagnostic time step');
  const previous=m.lastPosition??{x:rig.x,z:rig.z};
  const moved=distance(previous,rig);
  const yawChange=m.lastYaw===null?0:Math.abs(wrap(rig.yaw-m.lastYaw));
  const waypoint=order?.point??null;
  // Track net accomplishment against the PILOT mission, not a temporary
  // local traffic sidestep. A machine circling a wall can be moving, steering
  // and technically making waypoint progress without getting any closer
  // to the objective for tens of seconds.
  const mission=order?.missionPoint??waypoint;
  const missionKey=mission?
    Math.round(mission.x*2)+'/'+Math.round(mission.z*2):null;
  const remaining=waypoint?distance(rig,waypoint):null;
  const wasRemaining=waypoint?distance(previous,waypoint):null;
  const toward=waypoint?wasRemaining-remaining:0;
  const speed=Math.hypot(rig.vx??0,rig.vz??0);
  const effort=Math.hypot(drive.throttle??0,drive.strafe??0);
  const hold=order?.mode==='ANCHOR'||order?.goal==='HOLD'||
    order?.goal==='SERVICE'||(!waypoint&&effort<.2);
  const turning=yawChange/dt>.14||Math.abs(rig.yawRate??0)>.14;
  const recovering=executor?.phase==='RECOVER'||executor?.recoveryLeft>0;
  const seeking=!!waypoint&&!hold&&remaining>1.8;
  const pressing=seeking&&effort>.26&&!recovering;
  if(missionKey!==m.lastMissionKey){
    m.lastMissionKey=missionKey;
    m.bestMissionDistance=mission?distance(rig,mission):null;
    m.noAdvance=0;
  }else if(pressing&&mission){
    const remainingMission=distance(rig,mission);
    if(remainingMission<(m.bestMissionDistance??Infinity)-.35){
      m.bestMissionDistance=remainingMission;
      m.noAdvance=0;
    }else{
      m.noAdvance+=dt;
      m.peakNoAdvance=Math.max(m.peakNoAdvance,m.noAdvance);
      if(m.noAdvance>4)m.loopSeconds+=dt;
    }
  }else if(hold)m.noAdvance=0;
  m.seconds+=dt;m.travel+=moved;
  if(hold)m.intentionalHold+=dt;
  if(turning&&seeking)m.usefulTurning+=dt;
  if(toward>.014*dt)m.usefulProgress+=dt;
  if(recovering)m.recoveryTime+=dt;
  if(order?.routeFailure)m.routeFailure+=dt;
  if(pressing&&toward<.045*dt&&moved<.08*dt&&!turning)
    m.lowProgressRun+=dt;
  else m.lowProgressRun=Math.max(0,m.lowProgressRun-dt*3);
  if(m.lowProgressRun>1.2){
    m.realStall+=dt;
    const inPeer=neighbours.some(n=>{
      const p=n?.rig??n?.position??n;
      return p&&distance(p,rig)<(n?.radius??1.1)+2.15;
    });
    const inStatic=(world?.obstacles??[]).some(o=>!o.dynamic&&
      rig.x>o.minX-3.8&&rig.x<o.maxX+3.8&&
      rig.z>o.minZ-3.8&&rig.z<o.maxZ+3.8);
    if(inPeer)m.allyStall+=dt;
    else if(inStatic)m.obstacleStall+=dt;
    else m.unclassifiedStall+=dt;
    m.worstStall=Math.max(m.worstStall,m.lowProgressRun);
  }
  // Detect discrete physical contact impulses, avoiding an event on every
  // subsequent frame of the naturally damped impact meter.
  if((rig.impact??0)>.36&&(rig.impact??0)-m.lastImpact>.11)
    m.collisions++;
  m.lastImpact=rig.impact??0;
  const velocity=m.lastVelocity;
  if(velocity&&speed>.48&&Math.hypot(velocity.x,velocity.z)>.48&&
    (velocity.x*rig.vx+velocity.z*rig.vz)/
    (Math.hypot(velocity.x,velocity.z)*speed)<-.55 &&
    time-m.lastReversalAt>1){
    m.oscillations++;m.lastReversalAt=time;
  }
  m.lastVelocity={x:rig.vx??0,z:rig.vz??0};
  m.lastPosition={x:rig.x,z:rig.z};m.lastYaw=rig.yaw;
  m.routeSwitches=executor?.routeSwitches??m.routeSwitches;
  m.trafficYields=executor?.trafficYields??m.trafficYields;
  return {moved,toward,hold,turning,stall:m.lowProgressRun>1.2,
    distanceToWaypoint:remaining};
}
export function motionSummary(m){
  const keys=['seconds','travel','intentionalHold','usefulTurning','usefulProgress',
    'realStall','obstacleStall','allyStall','unclassifiedStall',
    'routeFailure','recoveryTime','worstStall','loopSeconds','peakNoAdvance'];
  return {...Object.fromEntries(keys.map(k=>[k,round(m[k])])),
    collisions:m.collisions,oscillations:m.oscillations,
    routeSwitches:m.routeSwitches,trafficYields:m.trafficYields};
}
export function gradeOlympicEvent(eventId,facts){
  const time=Math.max(1,facts.seconds??1),motion=facts.motion??{};
  const safety=clamp(1-(motion.realStall??0)/time*1.4-
    (motion.collisions??0)*.07-(motion.routeFailure??0)/time*.5-
    (motion.loopSeconds??0)/time*.85);
  let mission=0;
  if(['open-transit','wall-detour'].includes(eventId)){
    const initial=Math.max(1,facts.initialDistance??1);
    const progress=clamp(1-(facts.finalDistance??initial)/initial);
    const completion=facts.completed?1:0;
    mission=completion*.70+progress*.30;
  } else if(eventId==='ally-choke'){
    mission=.65*clamp((facts.teamCompletions??0)/3)+
      .35*clamp((facts.teamProgress??0)/3);
  } else if(eventId==='rear-ambush'){
    const response=Number.isFinite(facts.reactionSeconds)?
      clamp(1-facts.reactionSeconds/6):0;
    mission=.7*response+.3*clamp((facts.defensiveTurn??0)/1.25);
  } else if(eventId==='contact-dropout'){
    mission=.55*clamp(facts.noGhostFraction??0)+
      .45*clamp(facts.searchFraction??0);
  } else if(eventId==='target-triage'){
    mission=.7*clamp(facts.threatSelectionFraction??0)+
      .3*clamp(facts.visibleOnlyFraction??0);
  } else if(eventId==='objective-anchor'){
    mission=.45*clamp(facts.arrived?1:0)+
      .55*clamp(facts.holdFraction??0);
  } else if(eventId==='wounded-withdrawal'){
    const progress=clamp(facts.escapeProgress??0);
    mission=.65*progress+.35*(Number.isFinite(facts.withdrawSeconds)?
      clamp(1-facts.withdrawSeconds/6):0);
  }else throw new RangeError('Unknown event '+eventId);
  const score=round(100*(mission*.85+safety*.15),2);
  return {score,pass:mission>=.65&&safety>=.45,mission:round(mission),
    safety:round(safety)};
}
export function summarizeOlympics(bouts){
  const events=OLYMPIC_EVENTS.map(e=>{
    const rows=bouts.filter(b=>b.event===e.id);
    return {id:e.id,name:e.name,group:e.group,n:rows.length,
      passRate:round(average(rows.map(b=>Number(b.pass)))),
      meanScore:round(average(rows.map(b=>b.score)),2),
      meanStall:round(average(rows.map(b=>b.motion.realStall??0))),
      meanLoop:round(average(rows.map(b=>b.motion.loopSeconds??0))),
      meanCollisions:round(average(rows.map(b=>b.motion.collisions??0))),
      meanIntentionalHold:round(average(rows.map(b=>b.motion.intentionalHold??0))),
      worstSeed:[...rows].sort((a,b)=>a.score-b.score||a.seed-b.seed)[0]?.seed??null};
  });
  const tested=events.filter(e=>e.n>0);
  const groups=[...new Set(tested.map(e=>e.group))].map(group=>{
    const selected=tested.filter(e=>e.group===group);
    return {group,meanScore:round(average(selected.map(e=>e.meanScore)),2),
      meanPass:round(average(selected.map(e=>e.passRate)))};
  });
  return {events,groups,overall:round(average(tested.map(e=>e.meanScore)),2),
    weakest:[...tested].sort((a,b)=>a.meanScore-b.meanScore).slice(0,4)};
}
