#!/usr/bin/env node
/**
 * M3CH4 AI OLYMPICS — k4v.1 research competency course.
 *
 * Unlike the 3v3 tournament this evaluates controlled, individually scored
 * situations. Everything that MOVES is stepped by real stepRig physics;
 * routing, threat response and target selection call their production logic.
 * Rear impacts and sensor dropout are deliberately scripted stimuli.
 *
 * node research/aiOlympics.mjs --quick
 * node research/aiOlympics.mjs --seeds=8 --families=yard,kestrel,hauler
 * node research/aiOlympics.mjs --events=rear-ambush,wounded-withdrawal --profiles=baseline,cautious
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {makeRangeTarget,createTargetCondition,mirrorTargetCondition} from '../combat.js';
import {createRigState,stepRig} from '../locomotion.js';
import {deriveRigConfig} from '../assemblyPhysics.js';
import {contractById} from '../contracts.js';
import {createEnemyMotion,advanceEnemyMotion} from '../enemyMotion.js';
import {createIntentExecutor,executeIntent} from '../ai/intentExecutor.js';
import {createPilotBrain,decidePilot} from '../ai/pilotBrain.js';
import {createWorldModel,observeBattlefield,actorCapabilities} from '../ai/worldModel.js';
import {prioritizeVisibleTarget} from '../ai/adaptiveTactics.js';
import {noteIncomingFire,recentThreatTargetId} from '../tacticalAwareness.js';
import {getAiResearchProfile,getAiResearchDifficulty} from '../ai/researchProfiles.js';
import {TRAFFIC_POLICIES} from '../ai/trafficCoordination.js';
import {coordinateSquadArrivals,ARRIVAL_POLICIES} from '../ai/squadPositioning.js';
import {coordinateCorridors,CORRIDOR_POLICIES} from '../ai/corridorCoordinator.js';
import {OLYMPIC_EVENTS,EVENT_IDS,METRIC_VERSION,createMotionDiagnostic,
  sampleMotion,motionSummary,gradeOlympicEvent,summarizeOlympics}
  from './aiOlympicsMetrics.mjs';

const DT=1/60;
const FAMILIES=Object.freeze({yard:'yard-dog',kestrel:'cutter',hauler:'mule'});
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const round=(x,n=3)=>Math.round(x*10**n)/10**n;
function random(seed){let value=seed>>>0;return ()=>{
  value^=value<<13;value^=value>>>17;value^=value<<5;
  return (value>>>0)/4294967296;
};}
const block=(id,minX,maxX,minZ,maxZ)=>({id,minX,maxX,minZ,maxZ,
  height:3.5,kind:'building'});
const trainingWorld=obstacles=>({minX:-29,maxX:29,minZ:-27,maxZ:27,obstacles});
function configuration(id,rng){
  // Matched seeds vary initial lane placement and heading without
  // changing machine capability, target geometry, or the course's solutions.
  // Stress real steering/traffic rather than repeating effectively identical
  // spawns dozens of times.
  const jitter=()=>1.9*(rng()-.5);
  const p=(x,z,yaw=0)=>({x:x+jitter(),z:z+jitter(),
    yaw:yaw+.20*(rng()-.5)});
  switch(id){
    case 'open-transit':return {world:trainingWorld([]),
      starts:[p(0,19)],goal:{x:0,z:-17},kind:'route'};
    case 'wall-detour':return {world:trainingWorld([
      block('closed-gate',-5.5,5.5,-2.2,2.2)]),
      starts:[p(0,17)],goal:{x:0,z:-17},kind:'route'};
    case 'squad-arrival':return {world:trainingWorld([
      block('west-objective-approach',-12,-3,-5,7),
      block('east-objective-approach',3,12,-5,7)]),
      starts:[p(-5.2,19),p(0,22),p(5.2,19)],
      goal:{x:0,z:-14},kind:'squad-arrival'};
    case 'corridor-crossing':return {world:trainingWorld([
      block('west-corridor',-12,-3,-7,7),
      block('east-corridor',3,12,-7,7)]),
      starts:[p(-1.8,19),p(0,22),p(1.8,19)],
      goals:[{x:-9,z:-17},{x:0,z:-20},{x:9,z:-17}],
      kind:'corridor-crossing'};
    case 'ally-choke':return {world:trainingWorld([
      block('west-corridor-wall',-12,-3,-6,7),
      block('east-corridor-wall',3,12,-6,7)]),
      starts:[p(-4.2,19),p(0,22),p(4.2,19)],goal:{x:0,z:-17},kind:'traffic'};
    case 'rear-ambush':return {world:trainingWorld([
      block('cover-left',-9,-6,0,5)]),
      starts:[p(0,0)],kind:'ambush'};
    case 'contact-dropout':return {world:trainingWorld([]),
      starts:[p(0,0)],contacts:[p(0,-12,Math.PI)],kind:'dropout'};
    case 'target-triage':return {world:trainingWorld([]),
      starts:[p(0,2)],contacts:[p(0,-12,Math.PI),p(7,-9,Math.PI)],
      kind:'triage'};
    case 'objective-anchor':return {world:trainingWorld([]),
      starts:[p(0,15)],goal:{x:0,z:0},kind:'anchor'};
    case 'wounded-withdrawal':return {world:trainingWorld([]),
      starts:[p(0,0)],goal:{x:0,z:-15},retreat:{x:0,z:18},
      kind:'withdraw'};
    default:throw new RangeError('Unknown Olympic event '+id);
  }
}
function makeActor(family,id,position,profile,difficulty,team='friendly'){
  const assembly=makeRangeTarget(FAMILIES[family]);
  const condition=createTargetCondition(assembly);
  const behavior=contractById(FAMILIES[family]).behavior;
  return {id,team,active:true,assembly,condition,behavior,
    rig:createRigState(position),motion:createEnemyMotion(behavior),
    executor:createIntentExecutor(),brain:createPilotBrain(),
    config:deriveRigConfig(assembly),profile,difficulty,
    diagnostic:createMotionDiagnostic(),
    firstArrival:null,lastIntent:null,decisions:0};
}
const collisionWorld=(self,actors,world)=>({...world,obstacles:[
  ...world.obstacles,...actors.filter(a=>a!==self&&a.active).map(a=>{
    const radius=a.config?.collisionRadiusM??1.1;
    return {id:'peer-'+a.id,dynamic:true,
      minX:a.rig.x-radius,maxX:a.rig.x+radius,
      minZ:a.rig.z-radius,maxZ:a.rig.z+radius};
  })
]});
function listTraffic(actor,actors){
  return actors.filter(a=>a!==actor&&a.team===actor.team&&a.active&&
    dist(actor.rig,a.rig)<7).map(a=>({id:a.id,position:a.rig,
      radius:a.config?.collisionRadiusM??1.1,
    speed:Math.hypot(a.rig.vx??0,a.rig.vz??0),
    velocity:{x:a.rig.vx??0,z:a.rig.vz??0}}));
}
function courseOrder(spec,actor,index){
  if(spec.kind==='anchor')return {goal:'DEFEND',point:spec.goal,
    objectiveId:'olympic-objective',radius:4.7,anchor:true,score:.9};
  if(spec.kind==='corridor-crossing')return {goal:'CAPTURE',
    objectiveId:'different-zone-'+index,point:spec.goals[index],
    radius:4.7,score:.83,note:'CROSS GATE TO DISTINCT OBJECTIVE'};
  if(spec.kind==='squad-arrival')return {goal:'CAPTURE',
    objectiveId:'olympics-zone',point:spec.goal,radius:4.7,
    score:.83,note:'TEAM ENTER SHARED ZONE'};
  if(spec.kind==='route'||spec.kind==='traffic')return {
    goal:'CAPTURE',point:spec.goal,score:.82};
  if(spec.kind==='withdraw')return {goal:'CAPTURE',point:spec.goal,score:.78};
  return {goal:'HOLD',point:{x:actor.rig.x,z:actor.rig.z},score:.6};
}
const heading=(rig,point)=>Math.atan2(point.x-rig.x,-(point.z-rig.z));
const yawError=(a,b)=>Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)));
export function runOlympicEvent(id,{seed=1717,family='yard',
    profile='baseline',difficulty='pro',seconds=null,
    trafficPolicy='legacy',arrivalPolicy='legacy',corridorPolicy='legacy'}={}){
  if(!CORRIDOR_POLICIES.includes(corridorPolicy))
    throw new RangeError('Corridor policy '+corridorPolicy);
  if(!ARRIVAL_POLICIES.includes(arrivalPolicy))
    throw new RangeError('Arrival policy '+arrivalPolicy);
  if(!TRAFFIC_POLICIES.includes(trafficPolicy))throw new RangeError('Traffic policy '+trafficPolicy);
  if(!EVENT_IDS.includes(id))throw new RangeError('Unknown event '+id);
  if(!Object.hasOwn(FAMILIES,family))throw new RangeError('Unknown family '+family);
  if(!Number.isInteger(seed)||seed<0)throw new RangeError('Invalid seed');
  const policy=getAiResearchProfile(profile);
  const tier=getAiResearchDifficulty(difficulty);
  const event=OLYMPIC_EVENTS.find(e=>e.id===id);
  const duration=seconds??event.seconds;
  if(!Number.isFinite(duration)||duration<.5||duration>180)
    throw new RangeError('Bad duration');
  const spec=configuration(id,random(seed));
  const actors=spec.starts.map((p,i)=>makeActor(
    family,
    'ally-'+i,p,policy,tier));
  const player=actors[0];
  const enemies=(spec.contacts??[]).map((p,i)=>makeActor('yard',
    'contact-'+i,p,policy,tier,'hostile'));
  const fullRoster=[...actors,...enemies],memory=createWorldModel();
  if(spec.kind==='withdraw'){
    // Actual structural integrity, not a fictitious health multiplier.
    const part=player.condition.parts.structure;
    // All pilot profiles must recognize this as a genuinely critical,
    // physically damaged structure. Marginal 35% cases belong in separate
    // preference tests, not a mandatory retreat competency benchmark.
    part.integrity=part.maxIntegrity*.25;
    mirrorTargetCondition(player.assembly,player.condition);
  }
  const facts={seed,event:id,family,profile,difficulty,
    trafficPolicy,arrivalPolicy,corridorPolicy,
    initialDistance:spec.goal?dist(player.rig,spec.goal):null,
    finalDistance:spec.goal?dist(player.rig,spec.goal):null,
    completed:false,arrived:false,teamCompletions:0,
    timeToGoal:null,reactionSeconds:null,defensiveTurn:0,
    noGhostFraction:0,searchFraction:0,
    threatSelectionFraction:0,visibleOnlyFraction:0,
    holdFraction:0,withdrawSeconds:null,escapeProgress:0,
    contactsVisible:0,contactLossAt:null,spacingQuality:0};
  const firstAngles=actors.map(a=>a.rig.yaw);
  let observed=0,ghostOk=0,searchOk=0,triageFrames=0,triageThreat=0,
    triageOnly=0,anchorFrames=0,anchorInside=0,visibleBeforeLoss=false,
    startRetreat=player.rig.z,t=0;
  const arrivalTimes=new Map();
  let squadOrders=null,corridorOrders=null;
  const corridorMemory={};let reservedCount=0;
  for(let tick=0;tick<duration/DT;tick++){
    t=tick*DT;
    const snapshot=(spec.kind==='triage'||spec.kind==='dropout')?
      observeBattlefield(memory,fullRoster,null,spec.world,t):null;
    // Incoming fire supplies only a bearing/evidence. It does NOT make a
    // hidden attacker targetable or expose its current position to planning.
    if(spec.kind==='ambush'&&tick===Math.round(2/DT))
      noteIncomingFire(player.motion,{x:0,z:12},'unseen-attacker',1.5,player.rig);
    if(spec.kind==='withdraw'&&tick%Math.round(1.1/DT)===0)
      noteIncomingFire(player.motion,{x:0,z:-12},'unseen-attacker',1.1,player.rig);
    if(spec.kind==='triage'&&tick===Math.round(2.5/DT))
      noteIncomingFire(player.motion,enemies[1].rig,enemies[1].id,1.4,player.rig);
    if(spec.kind==='squad-arrival'&&(!squadOrders||tick%51===0)){
      const assigned=Object.fromEntries(actors.map((actor,i)=>[
        actor.id,courseOrder(spec,actor,i)]));
      squadOrders=coordinateSquadArrivals(assigned,actors.map(a=>({
        id:a.id,position:{x:a.rig.x,z:a.rig.z},active:a.active,
        capability:actorCapabilities(a)})),[
        {id:'olympics-zone',point:spec.goal}],{
        policy:arrivalPolicy,world:spec.world,zoneRadius:4.7,
        previousOrders:squadOrders??{},collisionRadius:1.14});
    }
    if(spec.kind==='corridor-crossing'&&(!corridorOrders||tick%51===0)){
      const independent=Object.fromEntries(actors.map((actor,i)=>[
        actor.id,courseOrder(spec,actor,i)]));
      const arranged=coordinateCorridors(independent,actors.map(a=>({
        id:a.id,position:{x:a.rig.x,z:a.rig.z},active:a.active,
        capability:actorCapabilities(a)})),spec.world,{
        policy:corridorPolicy,collisionRadius:1.14,time:t,
        memory:corridorMemory});
      corridorOrders=arranged.orders;
      reservedCount=Math.max(reservedCount,arranged.metrics.queued);
    }
    for(let index=0;index<actors.length;index++){
      const actor=actors[index],cap=actorCapabilities(actor);
      const view=snapshot?.knowledge?.friendly;
      const contacts=(view?.contacts??[]).filter(c=>c.visible);
      const eligible=spec.kind==='dropout'&&t>=2.5?[]:contacts;
      if(spec.kind==='dropout'&&contacts.length&&t<2.5)visibleBeforeLoss=true;
      const candidates=enemies.filter(e=>eligible.some(c=>c.id===e.id));
      const target=spec.kind==='triage'?
        prioritizeVisibleTarget(actor,candidates,snapshot,null,
          actor.targetId??null,recentThreatTargetId(actor.motion)):
        candidates[0]??null;
      actor.targetId=target?.id??null;
      const assignment=spec.kind==='squad-arrival'?
        squadOrders[actor.id]:spec.kind==='corridor-crossing'?
        corridorOrders[actor.id]:courseOrder(spec,actor,index);
      const position={x:actor.rig.x,z:actor.rig.z};
      const context={capability:cap,policy,world:spec.world,
        personality:actor.behavior.id,
        preferredRangeM:actor.behavior.preferredRangeM,
        uncertain:!target,enemySeen:!!target,
        underFireSeconds:actor.motion.awareness.underFireSeconds??0,
        retreatPoint:spec.retreat??{x:0,z:17},
        collisionRadius:actor.config.collisionRadiusM,
        nearbyAllies:actors.filter(a=>a!==actor).map(a=>({position:a.rig}))};
      const decision=decidePilot(actor.brain,{id:actor.id,position},
        assignment,context,t);
      actor.lastIntent=decision;
      const world=collisionWorld(actor,actors,spec.world);
      const instruction=executeIntent(actor.executor,decision,actor.rig,
        world,actor.config.collisionRadiusM,DT,listTraffic(actor,actors),
        {trafficPolicy,actorId:actor.id,now:t});
      const command=advanceEnemyMotion(actor.motion,actor.rig,target?.rig??null,
        DT,cap.canMove,world,actor.config.collisionRadiusM,
        actor.behavior,instruction);
      stepRig(actor.rig,command,DT,actor.config,world);
      sampleMotion(actor.diagnostic,actor.rig,command,
        {...instruction,missionPoint:decision.point},
        actor.executor,spec.world,DT,actors.filter(a=>a!==actor),t);
      // Objective defenders succeed by physically holding INSIDE the
      // authored scoring circle. They need not touch the exact centre.
      const finishRadius=spec.kind==='anchor'?4.0:
        spec.kind==='squad-arrival'?3.3:2.7;
      const arrivalGoal=spec.kind==='corridor-crossing'?
        spec.goals[index]:spec.goal;
      if(arrivalGoal&&dist(actor.rig,arrivalGoal)<finishRadius&&
         !arrivalTimes.has(actor.id))arrivalTimes.set(actor.id,t);
      if(index!==0)continue;
      if(spec.kind==='ambush'&&t>=2){
        const headingTowardShot=heading(actor.rig,{x:0,z:12});
        const turn=yawError(firstAngles[0],actor.rig.yaw);
        facts.defensiveTurn=Math.max(facts.defensiveTurn,turn);
        // A label saying UNDER FIRE is not a physical response.
        // Require a measurable chassis turn or actual cover-seeking travel.
        const coverMove=actor.motion.phase==='SEEK COVER'&&
          dist(actor.rig,spec.starts[0])>1.8;
        if(facts.reactionSeconds===null&&(turn>.55||coverMove))
          facts.reactionSeconds=t-2;
      }
      if(spec.kind==='dropout'&&t>=2.5){
        observed++;
        if(!target&&actor.motion.awareness.lineOfSight===false)ghostOk++;
        if(Math.abs(actor.rig.yawRate)>.1||
          /CONTACT|SCAN|SEARCH/.test(actor.motion.navigation??''))searchOk++;
      }
      if(spec.kind==='triage'&&t>=2.5){
        triageFrames++;
        if(target?.id===enemies[1].id)triageThreat++;
        if(!target||eligible.some(c=>c.id===target.id))triageOnly++;
      }
      if(spec.kind==='anchor'&&t>=15){
        anchorFrames++;
        if(dist(actor.rig,spec.goal)<4.7)anchorInside++;
      }
      if(spec.kind==='withdraw'&&facts.withdrawSeconds===null&&
        decision.goal==='WITHDRAW')facts.withdrawSeconds=t;
    }
    if(['route','traffic','squad-arrival','corridor-crossing'].includes(spec.kind)&&
      actors.every(a=>arrivalTimes.has(a.id)))break;
  }
  const secs=Math.min(duration,t+DT);
  if(spec.goal)facts.finalDistance=dist(player.rig,spec.goal);
  facts.completed=arrivalTimes.has(player.id);
  facts.arrived=facts.completed;
  facts.timeToGoal=arrivalTimes.get(player.id)??null;
  facts.teamCompletions=arrivalTimes.size;
  facts.corridorReservations=reservedCount;
  if(['traffic','squad-arrival','corridor-crossing'].includes(spec.kind))facts.teamProgress=actors.reduce((total,a,i)=>
    total+clamp(1-(spec.kind==='squad-arrival'?
      Math.max(0,dist(a.rig,spec.goal)-3.3):
      dist(a.rig,spec.kind==='corridor-crossing'?spec.goals[i]:spec.goal))/
      Math.max(1,dist(spec.starts[i],
        spec.kind==='corridor-crossing'?spec.goals[i]:spec.goal))),0);
  if(spec.kind==='squad-arrival'){
    let pairs=0,total=0;
    for(let i=0;i<actors.length;i++)for(let j=i+1;j<actors.length;j++){
      const desired=actors[i].config.collisionRadiusM+
        actors[j].config.collisionRadiusM+.45;
      total+=clamp(dist(actors[i].rig,actors[j].rig)/desired);
      pairs++;
    }
    facts.spacingQuality=pairs?total/pairs:1;
  }
  if(spec.kind==='dropout'){
    facts.noGhostFraction=observed?ghostOk/observed:0;
    facts.searchFraction=observed?searchOk/observed:0;
    facts.contactLossAt=visibleBeforeLoss?2.5:null;
  }
  if(spec.kind==='triage'){
    facts.threatSelectionFraction=triageFrames?triageThreat/triageFrames:0;
    facts.visibleOnlyFraction=triageFrames?triageOnly/triageFrames:0;
    facts.contactsVisible=triageFrames;
  }
  if(spec.kind==='anchor')facts.holdFraction=anchorFrames?anchorInside/anchorFrames:0;
  if(spec.kind==='withdraw')facts.escapeProgress=
    clamp((player.rig.z-startRetreat)/Math.max(1,spec.retreat.z-startRetreat));
  facts.seconds=round(secs);
  const aggregate=actors.map(a=>motionSummary(a.diagnostic));
  const motion={...aggregate[0]};
  if(spec.kind==='traffic'||spec.kind==='corridor-crossing'){
    for(const field of ['realStall','allyStall','obstacleStall',
      'intentionalHold','routeFailure','collisions','oscillations',
      'loopSeconds','peakNoAdvance','trafficQueueSeconds']){
      motion[field]=round(aggregate.reduce((s,a)=>s+(a[field]??0),0)/
        aggregate.length);
    }
  }
  facts.motion=motion;
  const evaluation=gradeOlympicEvent(id,facts);
  return {...facts,...evaluation,motion,actors:actors.map(a=>({
    id:a.id,family,
    x:round(a.rig.x),z:round(a.rig.z),yaw:round(a.rig.yaw),
    goal:a.lastIntent?.goal,motion:motionSummary(a.diagnostic),
    navigation:a.motion.navigation
  }))};
}
function parseOpts(args){
  const o={quick:false};
  for(const arg of args){
    if(arg==='--quick'){o.quick=true;continue;}
    const match=/^--([\w-]+)=(.+)$/.exec(arg);
    if(!match)throw Error('Invalid Olympics option '+arg);
    o[match[1]]=match[2];
  }
  const selected=(key,options,defaults)=>{
    const raw=(o[key]??defaults).split(',');
    if(raw.some(x=>!options.includes(x))||new Set(raw).size!==raw.length)
      throw Error('Invalid '+key+' selection '+raw.join(','));
    return raw;
  };
  const events=selected('events',EVENT_IDS,EVENT_IDS.join(','));
  const trafficPolicies=selected('traffic',TRAFFIC_POLICIES,'legacy');
  const arrivalPolicies=selected('arrivals',ARRIVAL_POLICIES,'legacy');
  const corridorPolicies=selected('corridors',CORRIDOR_POLICIES,'legacy');
  const families=selected('families',Object.keys(FAMILIES),
    o.quick?'yard':Object.keys(FAMILIES).join(','));
  const profiles=selected('profiles',['baseline','blitz','fortress','wolfpack',
    'skirmish','cautious','reactive','opportunist'],o.quick?'baseline':'baseline,cautious');
  const difficulties=selected('difficulties',['rookie','club','pro','elite'],
    'pro');
  const seeds=Number(o.seeds??(o.quick?'1':'4'));
  const seed=Number(o.seed??'46291');
  if(!Number.isInteger(seeds)||seeds<1||seeds>100||
    !Number.isInteger(seed)||seed<0||seed>4294967295)
    throw RangeError('Bad seed count or seed');
  return {events,families,profiles,difficulties,
    trafficPolicies,arrivalPolicies,corridorPolicies,seeds,seed,
    out:o.out??'study-results/ai-olympics'};
}
function csv(bouts){
  const cols=['event','family','profile','difficulty','seed','score','pass',
    'mission','safety','seconds','timeToGoal','reactionSeconds','realStall',
    'intentionalHold','obstacleStall','allyStall','loopSeconds',
    'trafficQueueSeconds','collisions','oscillations',
    'routeSwitches','trafficYields','completed','finalDistance'];
  return [cols.join(','),...bouts.map(b=>cols.map(k=>{
    const val=['realStall','intentionalHold','obstacleStall','allyStall',
      'collisions','oscillations','routeSwitches','trafficYields',
      'loopSeconds','trafficQueueSeconds'].includes(k)?
      b.motion[k]:b[k];
    return val??'';
  }).join(','))].join('\n')+'\n';
}
export function runOlympics(config,{onProgress=null}={}){
  const trafficPolicies=config.trafficPolicies??['legacy'];
  const bouts=[];const total=config.events.length*config.families.length*
    config.profiles.length*config.difficulties.length*config.seeds*
    trafficPolicies.length*(config.arrivalPolicies??['legacy']).length*
    (config.corridorPolicies??['legacy']).length;
  for(const event of config.events)
    for(const family of config.families)
      for(const profile of config.profiles)
        for(const difficulty of config.difficulties)
          for(const trafficPolicy of trafficPolicies)
          for(const arrivalPolicy of (config.arrivalPolicies??['legacy']))
          for(const corridorPolicy of (config.corridorPolicies??['legacy']))
          for(let i=0;i<config.seeds;i++){
            // Same scenario and seed across families and profiles.
            const seed=(config.seed+43909*i+31337*EVENT_IDS.indexOf(event))>>>0;
            const result=runOlympicEvent(event,{seed,family,profile,difficulty,
              trafficPolicy,arrivalPolicy,corridorPolicy});
            bouts.push(result);
            onProgress?.(bouts.length,total,result);
          }
  const byProfile=Object.fromEntries(config.profiles.map(profile=>{
    const cohort=bouts.filter(b=>b.profile===profile);
    return [profile,summarizeOlympics(cohort)];
  }));
  const byTraffic=Object.fromEntries(trafficPolicies.map(trafficPolicy=>{
    const cohort=bouts.filter(b=>b.trafficPolicy===trafficPolicy);
    return [trafficPolicy,summarizeOlympics(cohort)];
  }));
  const byArrival=Object.fromEntries((config.arrivalPolicies??['legacy']).map(arrivalPolicy=>{
    const cohort=bouts.filter(b=>b.arrivalPolicy===arrivalPolicy);
    return [arrivalPolicy,summarizeOlympics(cohort)];
  }));
  const byCorridor=Object.fromEntries((config.corridorPolicies??['legacy']).map(corridorPolicy=>{
    const cohort=bouts.filter(b=>b.corridorPolicy===corridorPolicy);
    return [corridorPolicy,summarizeOlympics(cohort)];
  }));
  const byFamily=Object.fromEntries(config.families.map(family=>{
    const cohort=bouts.filter(b=>b.family===family);
    return [family,summarizeOlympics(cohort)];
  }));
  return {meta:{version:METRIC_VERSION,createdAt:new Date().toISOString(),
    sourceCommit:process.env.GITHUB_SHA??null,
    seeds:config.seeds,seed:config.seed,families:config.families,
    profiles:config.profiles,difficulties:config.difficulties,
    trafficPolicies,arrivalPolicies:config.arrivalPolicies??['legacy'],
    corridorPolicies:config.corridorPolicies??['legacy'],
    events:config.events,bouts:bouts.length,
    note:'Controlled scripted drills; not a full-match win-rate estimate. Physics and AI decisions shared with live game.'},
    summary:summarizeOlympics(bouts),byProfile,byFamily,byTraffic,byArrival,byCorridor,bouts};
}
export function olympicsMarkdown(report){
  const {meta,summary}=report;
  const s=['# M3CH4 AI Olympics — '+meta.version,'',
    meta.bouts+' controlled physical trials · '+meta.seeds+' paired seeds per cohort.',
    'Families: '+meta.families.join(', ')+' · Policies: '+meta.profiles.join(', ')+
      ' · Skill tiers: '+meta.difficulties.join(', ')+
      ' · Traffic: '+(meta.trafficPolicies??['legacy']).join(', ')+
      ' · Arrival: '+(meta.arrivalPolicies??['legacy']).join(', ')+
      ' · Corridor: '+(meta.corridorPolicies??['legacy']).join(', ')+'.','',
    '## Event medals (diagnostic, not competitive ranks)','',
    '| Event | Group | Trials | Pass | Score / 100 | Hard stall (s) | No-net-advance (s) | Queued (s) | Deliberate hold (s) |',
    '|---|---|---:|---:|---:|---:|---:|---:|---:|'];
  for(const e of summary.events){
    if(e.n===0)continue;
    s.push('| '+e.name+' | '+e.group+' | '+e.n+' | '+
      (e.passRate*100).toFixed(1)+'% | '+e.meanScore+' | '+
      e.meanStall+' | '+e.meanLoop+' | '+e.meanQueue+' | '+e.meanIntentionalHold+' |');
  }
  s.push('','## Lowest-scoring capabilities','',
    ...summary.weakest.filter(x=>x.n).map(x=>'- '+x.name+
      ': '+x.meanScore+'/100, pass '+(x.passRate*100).toFixed(1)+'%'),
    '','## Policy comparison (same seed schedules)','');
  for(const [profile,cohort]of Object.entries(report.byProfile)){
    s.push('- **'+profile+'**: '+cohort.overall+
      '/100; weakest: '+cohort.weakest.filter(e=>e.n)
        .map(e=>e.name+' ('+e.meanScore+')').slice(0,2).join(', '));
  }
  if(report.byTraffic){
    s.push('','## Experimental traffic policies (matched scenarios)','');
    for(const [name,cohort]of Object.entries(report.byTraffic)){
      const choke=cohort.events.find(e=>e.id==='ally-choke');
      if(!choke?.n)continue;
      s.push('- **'+name+'**: '+(choke.passRate*100).toFixed(1)+'% pass, score '+
        choke.meanScore+', '+choke.meanCollisions+' collisions, '+choke.meanLoop+
        's looping, '+choke.meanQueue+'s queued, '+choke.meanStall+'s hard stall');
    }
  }
  if(report.byArrival){
    s.push('','## Destination-reservation experiments','');
    for(const [name,cohort]of Object.entries(report.byArrival)){
      const event=cohort.events.find(e=>e.id==='squad-arrival');
      if(!event?.n)continue;
      s.push('- **'+name+'**: '+(event.passRate*100).toFixed(1)+'% pass; '+
        event.meanScore+'/100; '+event.meanCollisions+' collisions; '+
        event.meanLoop+'s no-net-progress');
    }
  }
  if(report.byCorridor){
    s.push('','## Shared-corridor across different objectives','');
    for(const [name,cohort]of Object.entries(report.byCorridor)){
      const event=cohort.events.find(e=>e.id==='corridor-crossing');
      if(!event?.n)continue;
      s.push('- **'+name+'**: '+(event.passRate*100).toFixed(1)+'% pass; '+
        event.meanScore+'/100; '+event.meanCollisions+' collisions; '+
        event.meanLoop+'s unproductive motion');
    }
  }
  s.push('','## Evaluation rules and limitations','',
    '- Pass thresholds are fixed in aiOlympicsMetrics.mjs; they are heuristic engineering acceptance criteria, not human-player difficulty estimates.',
    '- Every machine moves using the fitted rig physics; walls and peer bodies cause real collision responses. No teleporting is used to satisfy an objective.',
    '- Unseen ambushes inject an approximate shot bearing, never a visible shooter. The dropout event scripts a temporary sensor interruption while the contact remains physically present.',
    '- This event harness does not render Three.js/projectile raycasts, simulate complete rounds or prove comprehensive squad tactics.',
    '- First fix cases with actual low-progression stalls, crashes or missing reactions. High intentional hold time by itself is NOT a defect.',
    '- For trustworthy comparisons, run multiple new seed sets and inspect raw per-actor traces before concluding a profile is superior.',
    '','Full inputs, outcomes, and individual actor diagnostics appear in results.json and results.csv.','');
  return s.join('\n');
}
function main(){
  const opts=parseOpts(process.argv.slice(2));
  const report=runOlympics(opts,{onProgress:(n,total,r)=>{
    if(n===1||n===total||n%Math.max(1,Math.ceil(total/12))===0)
      console.log('OLYMPICS_PROGRESS '+n+'/'+total+' '+r.event+' '+r.profile+
        ' '+r.family+' score '+r.score);
  }});
  fs.mkdirSync(opts.out,{recursive:true});
  fs.writeFileSync(path.join(opts.out,'results.json'),JSON.stringify(report,null,2)+'\n');
  fs.writeFileSync(path.join(opts.out,'results.csv'),csv(report.bouts));
  fs.writeFileSync(path.join(opts.out,'report.md'),olympicsMarkdown(report));
  console.log('OLYMPICS_SUMMARY '+JSON.stringify({
    meta:report.meta,events:report.summary.events,weakest:report.summary.weakest,
    profiles:Object.fromEntries(Object.entries(report.byProfile)
      .map(([k,v])=>[k,v.overall]))
  }));
  for(const event of report.summary.weakest){
    if(event.meanScore>=75)continue;
    const worst=report.bouts.filter(b=>b.event===event.id)
      .sort((a,b)=>a.score-b.score||a.seed-b.seed)[0];
    console.log('OLYMPICS_ANOMALY '+JSON.stringify({
      event:event.id,score:worst.score,pass:worst.pass,seed:worst.seed,
      trafficPolicy:worst.trafficPolicy,arrivalPolicy:worst.arrivalPolicy,
      corridorPolicy:worst.corridorPolicy,corridorReservations:worst.corridorReservations,
      profile:worst.profile,family:worst.family,
      initialDistance:worst.initialDistance,finalDistance:worst.finalDistance,
      arrived:worst.arrived,holdFraction:worst.holdFraction,
      withdrawSeconds:worst.withdrawSeconds,escapeProgress:worst.escapeProgress,
      motion:worst.motion,actors:worst.actors
    }));
  }
  console.log('Olympics report: '+opts.out+'/report.md');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{main();}catch(error){console.error(error?.stack??error);process.exitCode=1;}
}
