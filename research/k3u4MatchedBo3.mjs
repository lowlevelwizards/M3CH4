/** RESEARCH ONLY — side-swapped k3u4 AI vs exact k3u2 baseline.
 * 60Hz physical rigs, live strict Domination, approximate mesh shots.
 * BO3 proxy: fresh hardware each round; historical no-elimination-end rule
 * deliberately retained to isolate AI changes. Neither iPhone performance
 * nor between-round repair/serialized damage is represented here.
 */
/**
 * RESEARCH ONLY: PR #42 3v3 Domination battle runner (Node, no canvas).
 *
 * LIVE production pure rules called here:
 *  - team/pilot perception, utility, commitments, routes, tactical movement
 *  - 60Hz stepRig physics, family-specific mass/drive, obstacles/collisions
 *  - Domination capture, contesting, score and victory
 *  - actual weapon/target condition, armor-first damage, AI cadence, ammo,
 *    field service, damage-aware derating, disabled-state rules
 *
 * LIMITATIONS: actual Three.js raycast mesh, recoil visual, target occlusion,
 * shooter accuracy at slot centroid are approximated with explicit chance
 * calibrated as LOW/MID/HIGH sensitivity cohorts. There is no human player,
 * rendering, audio, persistence or BO3 between-round repair. This is a
 * randomized battle test, NOT equivalent to headless browser playthrough.
 */
import fs from 'node:fs';
import { makeRangeTarget, createTargetCondition, weaponFor, createWeaponState,
    advanceWeapon, startReload, fireWeapon, applyTargetHit, mirrorTargetCondition,
    applyRecoil } from '../combat.js';
import { createRigState, stepRig, DEFAULT_WORLD } from '../locomotion.js';
import { deriveRigConfig } from '../assemblyPhysics.js';
import { installedPart } from '../components.js';
import { createSortieObjective, advanceSortieObjective } from '../sortieObjectives.js';
import { contractById } from '../contracts.js';
import { createHostileController, hostileOutput, advanceHostileController,
    hostileAimSlot, hostileMissionKillReason, hostileSpread } from '../hostileRig.js';
import { createEnemyMotion, advanceEnemyMotion, withinFiringArc } from '../enemyMotion.js';
import { tacticalLineOfSight, noteIncomingFire, noteBlockedFire } from '../tacticalAwareness.js';
import { createWorldModel, observeBattlefield } from '../ai/worldModel.js';
import { planTeam } from '../ai/teamPlanner.js';
import { createStrategicState,evaluateStrategy } from '../ai/strategicState.js';
import { createPilotBrain, decidePilot } from '../ai/pilotBrain.js';
import { createIntentExecutor, executeIntent } from '../ai/intentExecutor.js';
import { damagePosture } from '../damageBehavior.js';
import { derateRigConfig, functionalOutput } from '../functionalDamage.js';
import { createFieldServiceState, arrestFirstWeaponFailure, canFieldService,
    beginFieldService, advanceFieldService, fieldServiceStationary } from '../fieldService.js';
import { aiWeaponRecoveryDirective, aiWeaponRecoveryPosture, aiWeaponMissionKillReason } from '../aiFieldService.js';
import { createStrategicState as baselineCreateStrategy, evaluateStrategy as baselineEvaluateStrategy } from './baselineK3u2/strategicState.js';
import { planTeam as baselinePlanTeam } from './baselineK3u2/teamPlanner.js';
import { createPilotBrain as baselineCreateBrain,decidePilot as baselineDecidePilot } from './baselineK3u2/pilotBrain.js';
import { createIntentExecutor as baselineCreateExecutor, executeIntent as baselineExecuteIntent } from './baselineK3u2/intentExecutor.js';
import { prioritizeVisibleTarget,shouldAttemptTacticalShot,tacticalAimSlot } from '../ai/adaptiveTactics.js';

const DT=1/60,MAX_SECONDS=210;
const PARTS=['structure','mobility','power','command','combat'];
const FAMILIES={yard:'yard-dog',kestrel:'cutter',hauler:'mule'};
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const clamp=(a,lo,hi)=>Math.max(lo,Math.min(hi,a));
function random(seed){
  let value=seed>>>0;
  return ()=>{value^=value<<13;value^=value>>>17;value^=value<<5;
    return (value>>>0)/4294967296;};
}
const pick=(rng,items)=>items[Math.floor(rng()*items.length)];
function makeRig(team,n,family,rng,wear=0){
    const assembly=makeRangeTarget(FAMILIES[family]);
    const condition=createTargetCondition(assembly);
    for(const slot of PARTS){
        const part=condition.parts[slot];
        if(wear>0) {
            // Worn rigs start with both degraded internals and plating.
            const integrity=clamp(1-wear*(.3+.7*rng()),.28,1);
            const armor=clamp(1-wear*(.4+.6*rng()),.18,1);
            part.integrity=part.maxIntegrity*integrity;
            part.armor=part.maxArmor*armor;
        }
    }
    mirrorTargetCondition(assembly,condition);
    const weaponSpec=weaponFor(assembly);
    const side=team==='friendly'?1:-1, x=[-9,0,9][n]+(rng()-.5)*4.2,
        z=side*(21+(rng()-.5)*3.4);
    const rig=createRigState({x,z,yaw:team==='friendly'?0:Math.PI});
    const behavior=contractById(FAMILIES[family]).behavior;
    const id=team==='friendly'?'ally-'+(n+1):'enemy-'+n;
    return {id,team,family,behavior,assembly,condition,rig,
        spawn:{x,z},active:true,killReason:null,
        weaponSpec,weaponState:createWeaponState(weaponSpec),
        controller:createHostileController(.7+n*.15,behavior),
        motion:createEnemyMotion(behavior),baseConfig:deriveRigConfig(assembly),
        driveDamage:{drives:{}},brain:createPilotBrain(),executor:createIntentExecutor(),
        fieldService:createFieldServiceState(),lastScore:0,
        stats:{travel:0,damageDealt:0,armorDamage:0,internalDamage:0,damageTaken:0,
            shotTriggers:0,actualShots:0,hits:0,kills:0,goalChanges:0,
            captures:0,zoneSeconds:0,routeErrors:0,serviceCount:0,
            firstContact:null,firstShot:null,deathAt:null,
            attackBySlot:Object.fromEntries(PARTS.map(s=>[s,0]))}};
}
function configFor(a){
    const part=a.condition.parts.mobility;
    const mobility=installedPart(a.assembly,'mobility');
    const health=clamp(part.integrity/part.maxIntegrity,0,1);
    a.driveDamage.drives[mobility.instance.serial]={left:health,right:health};
    return derateRigConfig(a.baseConfig,functionalOutput(a.assembly,a.driveDamage));
}
function nearestVisible(a,roster,snapshot){
    const known=new Set((snapshot?.knowledge?.[a.team]?.contacts??[])
        .filter(c=>c.visible).map(c=>c.id));
    const live=roster.filter(o=>o.active&&o.team!==a.team&&known.has(o.id));
    live.sort((a1,b1)=>dist(a.rig,a1.rig)-dist(a.rig,b1.rig));
    return live[0]??null;
}
function damage(attacker,target,slot,metrics,t,rng){
    const pre=target.condition.parts[slot].integrity;
    const hit=applyTargetHit(target.condition,slot,attacker.weaponSpec.damage);
    const service=target.fieldService;
    const fault=slot==='combat'&&arrestFirstWeaponFailure(target.condition,service,pre);
    mirrorTargetCondition(target.assembly,target.condition);
    target.stats.damageTaken+=hit.armorAbsorbed+hit.internalDamage;
    attacker.stats.armorDamage+=hit.armorAbsorbed;
    attacker.stats.internalDamage+=hit.internalDamage;
    attacker.stats.damageDealt+=hit.armorAbsorbed+hit.internalDamage;
    attacker.stats.attackBySlot[slot]++;
    noteIncomingFire(target.motion,attacker.rig,attacker.id,
        hit.internalDamage?1.55:1.1);
    if(service.held){service.held=false;service.progress=0;}
    const cause=aiWeaponMissionKillReason(target.condition,target.behavior,service);
    if(cause){
        target.active=false;target.killReason=cause;target.stats.deathAt=t;
        attacker.stats.kills++;
        metrics.kills++;metrics.killReasons[cause]=(metrics.killReasons[cause]??0)+1;
        metrics.firstKillAt??=t;
    }
    return {hit,fault};
}
function runBout(seed,settings){
    const rng=random(seed),state=createSortieObjective(contractById('domination'));
    state.domination.capturePolicy=settings.policy??'strict';
    const strategies={new:createStrategicState(),baseline:baselineCreateStrategy()};
    const assaultMemory={friendly:{},hostile:{}};
    const teams={friendly:[],hostile:[]};
    for(const team of ['friendly','hostile']){
      let recipe=team===settings.variantTeam?settings.variant:['yard','kestrel','hauler'];
      const actors=recipe.map((family,i)=>makeRig(team,i,family,rng,
          team===settings.wornTeam?settings.wear:settings.backgroundWear??0));
      for(const a of actors) {
        a.generation=settings.modernTeam==='both'||team===settings.modernTeam?'new':'baseline';
        if(a.generation==='baseline'){
          a.brain=baselineCreateBrain();a.executor=baselineCreateExecutor();
        }
        a.stats.yieldTicks=0;a.stats.stagingSeconds=0;a.stats.movementRecoveries=0;
      }
      teams[team]=actors;
    }
    const actors=[...teams.friendly,...teams.hostile],memory=createWorldModel();
    const metrics={seed,scenario:settings.name,accuracy:settings.accuracy,modernTeam:settings.modernTeam,
        variants:{friendly:teams.friendly.map(a=>a.family),hostile:teams.hostile.map(a=>a.family)},
        win:null,winReason:null,time:MAX_SECONDS,points:{friendly:0,hostile:0},
        kills:0,killReasons:{},firstKillAt:null,firstContactAt:null,
        firstCaptureAt:null,firstMajorityAt:null,scoreLeadChanges:0,contestedSeconds:0,
        noMajoritySeconds:0,totalScoringSeconds:0,captureEvents:0,
        contestedEvents:0,recaptureEvents:0,deadlocks:0,damagingShots:0,
        scoreByTeam:{friendly:0,hostile:0},actors:[]};
    let oldOwners=['', '', ''],lastClaimedOwners=[null,null,null],oldContest=[false,false,false],
        oldLeader=null,plans={},snapshot=null,planLeft=0;
    const count=team=>actors.filter(a=>a.team===team&&a.active).length;
    // Each trial is independent; no user-managed player is present.
    for(let tick=0;tick<MAX_SECONDS/DT;tick++){
      const t=tick*DT;
      planLeft-=DT;
      if(planLeft<=0||!snapshot){
        snapshot=observeBattlefield(memory,actors,state,DEFAULT_WORLD,t);
        plans={};
        for(const team of ['friendly','hostile']){
          const modern=teams[team][0].generation==='new';
          const strategy=modern?
            evaluateStrategy(strategies.new,snapshot,team):
            baselineEvaluateStrategy(strategies.baseline,snapshot,team);
          plans[team]=modern?
            planTeam(snapshot,team,{strategy,assaultMemory:assaultMemory[team]}):
            baselinePlanTeam(snapshot,team,{strategy});
        }
        planLeft=.85;
        if(metrics.firstContactAt===null&&['friendly','hostile'].some(team=>
          snapshot.knowledge[team].contacts.some(c=>c.visible)))
          metrics.firstContactAt=t;
      }
      for(const a of actors){
        if(!a.active)continue;
        const observed=new Set((snapshot?.knowledge?.[a.team]?.contacts??[])
          .filter(c=>c.visible).map(c=>c.id));
        const target=a.generation==='new'?
          prioritizeVisibleTarget(a,actors.filter(c=>c.active&&c.team!==a.team&&observed.has(c.id)),
            snapshot,plans[a.team]?.orders?.[a.id]??null,a.targetId??null,null):
          nearestVisible(a,actors,snapshot);
        a.targetId=target?.id??null;
        const recovery=aiWeaponRecoveryDirective(a,target);
        const capability=snapshot.knowledge[a.team].allies
          .find(p=>p.id===a.id)?.capability;
        const job=plans[a.team].orders[a.id]??null;
        const before=a.brain.history.length;
        const decision=(a.generation==='new'?decidePilot:baselineDecidePilot)(a.brain,{id:a.id,position:{x:a.rig.x,z:a.rig.z}},
          job,{capability,weaponRecovery:recovery,world:DEFAULT_WORLD,
            personality:a.behavior.id,preferredRangeM:a.behavior.preferredRangeM,
            underFireSeconds:a.motion.awareness?.underFireSeconds??0,
            nearbyAllies:actors.filter(c=>c.active&&c.team===a.team&&c.id!==a.id).map(c=>({position:{x:c.rig.x,z:c.rig.z}})),
            preserveMajority:state.domination.points.filter(p=>p.owner===a.team&&!p.contested).length>=2,
            retreatPoint:{x:a.rig.x,z:a.team==='friendly'?22:-22}},t);
        if(a.brain.history.length>before)a.stats.goalChanges++;
        const config=configFor(a);
        const traffic=actors.filter(c=>c.active&&c.team===a.team&&c.id!==a.id&&
          dist(c.rig,a.rig)<7).map(c=>({position:c.rig,
            radius:configFor(c).collisionRadiusM,active:true}));
        const instruction=a.generation==='new'?
          executeIntent(a.executor,decision,a.rig,DEFAULT_WORLD,config.collisionRadiusM,DT,traffic):
          baselineExecuteIntent(a.executor,decision,a.rig,DEFAULT_WORLD,config.collisionRadiusM,DT);
        if(a.generation==='new'&&instruction.note?.includes('YIELD TRAFFIC'))a.stats.yieldTicks++;
        if(decision.goal==='STAGE')a.stats.stagingSeconds+=DT;
        if(a.motion.phase==='RECOVER'&&a._previousPhase!=='RECOVER')a.stats.movementRecoveries++;
        a._previousPhase=a.motion.phase;
        if(instruction.routeFailure&&!a._lastRouteFailure){
          a.stats.routeErrors++;
        }
        a._lastRouteFailure=!!instruction.routeFailure;
        if(recovery.begin&&!a.fieldService.held)
          beginFieldService(a.condition,a.fieldService,a.rig);
        const posture=aiWeaponRecoveryPosture(damagePosture(a.condition,a.behavior),recovery);
        let drive=advanceEnemyMotion(a.motion,a.rig,target?.rig??a.rig,DT,
          capability?.canMove??true,DEFAULT_WORLD,config.collisionRadiusM,
          a.behavior,instruction);
        if(a.fieldService.held||recovery.mode==='SETTLE')
          drive={throttle:0,strafe:0,steer:0,brake:1};
        else drive={...drive,
          throttle:drive.throttle*Math.max(.66,posture.paceScale),
          strafe:(drive.strafe??0)*Math.max(.56,posture.strafeScale),
          steer:drive.steer*Math.max(.62,posture.steerScale)};
        const former={x:a.rig.x,z:a.rig.z};
        stepRig(a.rig,drive,DT,config,DEFAULT_WORLD);
        a.stats.travel+=dist(former,a.rig);
        if(recovery.mode==='SETTLE'&&!a.fieldService.held&&fieldServiceStationary(a.rig))
            beginFieldService(a.condition,a.fieldService,a.rig);
        const serviceStep=advanceFieldService(a.condition,a.fieldService,a.rig,DT);
        if(serviceStep.event==='completed'){
            a.stats.serviceCount++;mirrorTargetCondition(a.assembly,a.condition);
        }
        advanceWeapon(a.weaponState,a.weaponSpec,DT);
        if(a.weaponState.loaded<=0 && a.weaponState.reloadLeft===0&&a.weaponState.reserve>0)
            startReload(a.weaponState,a.weaponSpec);
        if(!target)continue;
        // Production AI trigger timing & forward firing arc.
        const fired=advanceHostileController(a.controller,a.condition,DT,false);
        if(fired===null)continue;
        a.stats.shotTriggers++;
        if(a.stats.firstContact===null)a.stats.firstContact=t;
        if(!withinFiringArc(a.rig,target.rig))continue;
        const assigned=plans[a.team]?.orders?.[a.id]??null;
        const urgent=!!state.domination.points.find(p=>
          dist(p,target.rig)<state.radius&&(p.contested||p.owner===a.team));
        if(a.generation==='new'&&!shouldAttemptTacticalShot(a,target,{urgent}))continue;
        if(!tacticalLineOfSight(a.rig,target.rig,DEFAULT_WORLD)){
            noteBlockedFire(a.motion,'STATIC COVER');continue;
        }
        const distance=dist(a.rig,target.rig);
        const errors=hostileOutput(a.condition,a.behavior);
        const spread=hostileSpread(fired,errors.spreadRadians);
        // The sprite/mesh raycast cannot run in Node: represent its probability
        // of striking a true exposed target with scenario-defined sensitivity.
        const chance=clamp(settings.accuracy-(Math.max(0,distance-8)*.006)-
            Math.min(.15,Math.hypot(...spread)*1.2),.12,.98);
        // Fired rounds cost ammunition and recoil even on misses.
        if(fireWeapon(a.weaponState,a.weaponSpec)===null)continue;
        a.stats.actualShots++;
        if(a.stats.firstShot===null)a.stats.firstShot=t;
        const dx=target.rig.x-a.rig.x,dz=target.rig.z-a.rig.z;
        applyRecoil(a.rig,config,dx,dz,a.weaponSpec.recoilImpulseNs);
        if(settings.accuracy===0||rng()>chance)continue;
        a.stats.hits++;metrics.damagingShots++;
        const defaultSlot=hostileAimSlot(fired,a.behavior.aimPriority);
        const contesting=!!assigned?.objectiveId&&state.domination.points.some(p=>
          p.id===assigned.objectiveId&&p.contested&&dist(p,target.rig)<state.radius);
        const slot=a.generation==='new'?tacticalAimSlot(defaultSlot,{
          targetSpeed:Math.hypot(target.rig.vx??0,target.rig.vz??0),
          contesting,visibleService:!!target.fieldService?.held}):defaultSlot;
        damage(a,target,slot,metrics,t,rng);
      }
      const prevScore={friendly:state.friendlyProgress,hostile:state.hostileProgress};
      const outcome=advanceSortieObjective(state,actors,DT);
      const ours=state.domination.points.filter(p=>p.owner==='friendly'&&!p.contested).length;
      const theirs=state.domination.points.filter(p=>p.owner==='hostile'&&!p.contested).length;
      // Real awarded score, not merely ownership count: experimental local
      // majority pressure can award reduced progress while contested.
      const scoring=state.friendlyProgress>prevScore.friendly+1e-9 ||
          state.hostileProgress>prevScore.hostile+1e-9;
      if(scoring){
          metrics.totalScoringSeconds+=DT;
          if(metrics.firstMajorityAt===null)metrics.firstMajorityAt=t;
      }else metrics.noMajoritySeconds+=DT;
      if(state.domination.points.some(p=>p.contested))metrics.contestedSeconds+=DT;
      state.domination.points.forEach((p,i)=>{
        if(p.contested&&!oldContest[i])metrics.contestedEvents++;
        oldContest[i]=p.contested;
        if(p.owner!==oldOwners[i]){
          if(p.owner){
            metrics.captureEvents++;metrics.firstCaptureAt??=t;
            const holder=actors.filter(a=>a.active&&a.team===p.owner&&
                dist(a.rig,p)<=state.radius).sort((a,b)=>dist(a.rig,p)-dist(b.rig,p))[0];
            if(holder)holder.stats.captures++;
            if(lastClaimedOwners[i]&&lastClaimedOwners[i]!==p.owner)metrics.recaptureEvents++;
            lastClaimedOwners[i]=p.owner;
          }
          oldOwners[i]=p.owner;
        }
        for(const a of actors)if(a.active&&dist(a.rig,p)<=state.radius)
          a.stats.zoneSeconds+=DT;
      });
      const lead=Math.sign(state.friendlyProgress-state.hostileProgress);
      if(lead&&oldLeader&&lead!==oldLeader)metrics.scoreLeadChanges++;
      if(lead)oldLeader=lead;
      if(outcome){
        metrics.win=outcome.victory?'friendly':'hostile';
        metrics.winReason='SCORE';metrics.time=t+DT;break;
      }
      // A friendly/hostile team elimination still makes sense as a battle
      // state, but Domination only ends after territorial points are earned.
      if(count('friendly')===0 && count('hostile')===0){metrics.win='draw';metrics.winReason='BOTH TEAMS DISABLED';metrics.time=t+DT;break;}
      // All active actors may be stranded, which produces a timed draw.
    }
    if(metrics.win===null){
        metrics.win='draw';metrics.winReason='TIME LIMIT';
    }
    metrics.points={friendly:+state.friendlyProgress.toFixed(2),
      hostile:+state.hostileProgress.toFixed(2)};
    metrics.actors=actors.map(a=>({id:a.id,team:a.team,family:a.family,generation:a.generation,
        alive:a.active,killReason:a.killReason,
        integrity:+(PARTS.reduce((s,k)=>s+a.condition.parts[k].integrity/a.condition.parts[k].maxIntegrity,0)/5).toFixed(3),
        armor:+(PARTS.reduce((s,k)=>s+a.condition.parts[k].armor/a.condition.parts[k].maxArmor,0)/5).toFixed(3),
        ...Object.fromEntries(Object.entries(a.stats).map(([k,v])=>[k,typeof v==='number'?+v.toFixed(2):v]))}));
    return metrics;
}
const sum=(rows,key)=>rows.reduce((s,x)=>s+(Number(key(x))||0),0);
function groupReport(rows){
  const count=rows.length;
  const games=rows.filter(x=>x.win!=='draw');
  const roll=arr=>arr.length?sum(arr,x=>x)/arr.length:null;
  const winner={friendly:rows.filter(x=>x.win==='friendly').length,
    hostile:rows.filter(x=>x.win==='hostile').length,draw:rows.filter(x=>x.win==='draw').length};
  const flatten=rows.flatMap(x=>x.actors);
  const byFamily=Object.fromEntries(['yard','kestrel','hauler'].map(f=>{
    const a=flatten.filter(x=>x.family===f);
    return [f,{rigs:a.length,knockouts:a.filter(x=>!x.alive).length,
        survivalRate:a.filter(x=>x.alive).length/Math.max(1,a.length),
        capturesPerRig:roll(a.map(x=>x.captures)),
        zoneSecondsPerRig:roll(a.map(x=>x.zoneSeconds)),
        damagePerRig:roll(a.map(x=>x.damageDealt)),
        killsPerRig:roll(a.map(x=>x.kills)),
        distancePerRig:roll(a.map(x=>x.travel)),
        routeErrorsPerRig:roll(a.map(x=>x.routeErrors))}];
  }));
  return {n:count,winner,meanTime:roll(rows.map(x=>x.time)),
    medianTime:[...rows].map(x=>x.time).sort((a,b)=>a-b)[Math.floor(count/2)]??null,
    timeouts:rows.filter(x=>x.winReason==='TIME LIMIT').length,
    territoryDecisions:rows.filter(x=>x.winReason==='SCORE').length,
    meanScore:roll(rows.map(x=>x.points.friendly+x.points.hostile)),
    meanContestedSeconds:roll(rows.map(x=>x.contestedSeconds)),
    meanNoMajoritySeconds:roll(rows.map(x=>x.noMajoritySeconds)),
    meanScoringSeconds:roll(rows.map(x=>x.totalScoringSeconds)),
    meanCaptureEvents:roll(rows.map(x=>x.captureEvents)),
    meanRecaptureEvents:roll(rows.map(x=>x.recaptureEvents)),
    meanLeadChanges:roll(rows.map(x=>x.scoreLeadChanges)),
    meanFirstContact:roll(rows.filter(x=>x.firstContactAt!==null).map(x=>x.firstContactAt)),
    meanFirstKill:roll(rows.filter(x=>x.firstKillAt!==null).map(x=>x.firstKillAt)),
    noContact:rows.filter(x=>x.firstContactAt===null).length,
    noDamage:rows.filter(x=>x.damagingShots===0).length,
    meanKills:roll(rows.map(x=>x.kills)),
    meanServices:roll(rows.map(x=>sum(x.actors,a=>a.serviceCount))),
    meanRouteFailures:roll(rows.map(x=>sum(x.actors,a=>a.routeErrors))),
    meanPlanChanges:roll(rows.map(x=>sum(x.actors,a=>a.goalChanges))),
    shareWithRecaptures:rows.filter(x=>x.recaptureEvents>0).length/count,
    shareWithLeadChange:rows.filter(x=>x.scoreLeadChanges>0).length/count,
    meanSurvivingRigs:roll(rows.map(x=>x.actors.filter(a=>a.alive).length)),
    meanShotsAttempted:roll(rows.map(x=>sum(x.actors,a=>a.shotTriggers))),
    damageShotsPerGame:roll(rows.map(x=>x.damagingShots)),
    killReasons:rows.reduce((acc,x)=>{for(const [k,v]of Object.entries(x.killReasons))
        acc[k]=(acc[k]??0)+v;return acc;},{}),
    byFamily};
}

function series(seed,mode,swap,shard){
 const modernTeam=swap?'hostile':'friendly';
 const rows=[],wins={new:0,baseline:0},roundWins={friendly:0,hostile:0};
 const settings={name:mode,accuracy:mode==='no-damage'?0:.70,
   policy:'strict',modernTeam,variantTeam:'none',variant:['yard','kestrel','hauler'],
   wornTeam:mode==='worn-25'?modernTeam:null,wear:.25};
 for(let round=0;round<3;round++){
   if(wins.new>=2||wins.baseline>=2)break;
   const row=runBout((seed+round*10687)>>>0,settings);
   rows.push(row);
   if(row.win!=='draw'){
     roundWins[row.win]++;
     wins[row.win===modernTeam?'new':'baseline']++;
   }
 }
 return {seed,shard,mode,modernTeam,wins,roundWins,rounds:rows,
   victor:wins.new>=2?'new':wins.baseline>=2?'baseline':'unresolved'};
}
function aggregate(seriesRows){
 const rounds=seriesRows.flatMap(x=>x.rounds),N=rounds.length;
 const sum=(items,fn)=>items.reduce((a,x)=>a+(Number(fn(x))||0),0);
 const winCount=name=>seriesRows.filter(x=>x.victor===name).length;
 const actors=rounds.flatMap(r=>r.actors),actorsFor=name=>actors.filter(a=>a.generation===name);
 const byGen={};
 for(const name of ['new','baseline']){
   const these=actorsFor(name);
   byGen[name]={rigs:these.length,survivors:these.filter(a=>a.alive).length,
     ...Object.fromEntries(['captures','zoneSeconds','travel','damageDealt',
       'hits','actualShots','shotTriggers','kills','goalChanges','routeErrors',
       'serviceCount','yieldTicks','stagingSeconds','movementRecoveries']
       .map(k=>[k,+sum(these,a=>a[k]).toFixed(2)]))};
 }
 const lethal=rounds.filter(r=>r.firstKillAt!==null);
 return {series:seriesRows.length,rounds:N,seriesWins:{
   new:winCount('new'),baseline:winCount('baseline'),unresolved:winCount('unresolved')},
   decisiveRate:(winCount('new')+winCount('baseline'))?winCount('new')/
     (winCount('new')+winCount('baseline')):null,
   meanRounds:sum(seriesRows,s=>s.rounds.length)/Math.max(1,seriesRows.length),
   roundsByOutcome:{score:rounds.filter(r=>r.winReason==='SCORE').length,
     timeout:rounds.filter(r=>r.winReason==='TIME LIMIT').length,
     bothDisabled:rounds.filter(r=>r.winReason==='BOTH TEAMS DISABLED').length},
   metricsPerRound:{duration:+(sum(rounds,r=>r.time)/Math.max(1,N)).toFixed(2),
     contested:+(sum(rounds,r=>r.contestedSeconds)/Math.max(1,N)).toFixed(2),
     noScoring:+(sum(rounds,r=>r.noMajoritySeconds)/Math.max(1,N)).toFixed(2),
     scoring:+(sum(rounds,r=>r.totalScoringSeconds)/Math.max(1,N)).toFixed(2),
     captures:+(sum(rounds,r=>r.captureEvents)/Math.max(1,N)).toFixed(2),
     recaptures:+(sum(rounds,r=>r.recaptureEvents)/Math.max(1,N)).toFixed(2),
     kills:+(sum(rounds,r=>r.kills)/Math.max(1,N)).toFixed(2),
     firstContact:+(sum(rounds,r=>r.firstContactAt??0)/Math.max(1,N)).toFixed(2),
     firstKillAmongLethal:+(sum(lethal,r=>r.firstKillAt)/Math.max(1,lethal.length)).toFixed(2)},
   byGeneration:byGen
 };
}
function main(){
 const shard=Number(process.argv[2]??0);
 const armedPairs=Number(process.argv[3]??2),
   noDamagePairs=Number(process.argv[4]??1),wornPairs=Number(process.argv[5]??1);
 const all=[];
 for(const [mode,amount,bucket] of [['armed',armedPairs,0],
   ['no-damage',noDamagePairs,10000],['worn-25',wornPairs,20000]]){
   for(let i=0;i<amount;i++){
     // Repeat every seed with the two AI generations on opposite sides.
     const id=shard*amount+i+bucket,seed=(0x24689abc+id*47017)>>>0;
     all.push(series(seed,mode,false,shard),series(seed,mode,true,shard));
   }
 }
 const result={shard,roundModel:'BO3 independent fresh-rig rounds',
   versions:{new:'k3u3 tactical + k3u4 cockpit, main 4db04214',
     baseline:'k3u2 tactical, main 93286524'},
   policy:'strict, pre-elimination termination rule',dt:DT,maxSeconds:MAX_SECONDS,
   approximateHits:true,
   armed:aggregate(all.filter(s=>s.mode==='armed')),
   noDamage:aggregate(all.filter(s=>s.mode==='no-damage')),
   worn:aggregate(all.filter(s=>s.mode==='worn-25'))};
 fs.mkdirSync('study-results',{recursive:true});
 fs.writeFileSync('study-results/k3u4-series-shard-'+shard+'.json',JSON.stringify(all));
 fs.writeFileSync('study-results/k3u4-summary-shard-'+shard+'.json',JSON.stringify(result,null,2));
 console.log('K3U4_BO3_SUMMARY '+JSON.stringify(result));
}
main();
