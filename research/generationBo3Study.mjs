/** Matched generation-vs-generation BO3 series study. Isolated from production.
 * New: actual k3u2 planner, pilot commitments, A* and movement.
 * Legacy: authentic b056964 enemyMotion + squadIntent + fixed per-ID
 * dominationPointForActor assignment, using original ~.25s replans.
 * Shared: current rig physics, collisions, weapons, geometry, capture rules,
 * damage, conditional field service, and approximate probabilistic ballistic hit.
 * PROXY BO3: independent fresh-hardware rounds, not garage persistent
 * wear/intermission repair or human-controlled squad commander.
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
import { createEnemyMotion as makeLegacyMotion, advanceEnemyMotion as advanceLegacyMotion } from './legacyEnemyMotion.js';
import { squadIntent } from '../squadCoordination.js';
import { dominationPointForActor } from '../sortieObjectives.js';
import { exploitServicingTarget } from '../faultSupport.js';
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
            shotTriggers:0,actualShots:0,hits:0,kills:0,goalChanges:0,navigationRecoveries:0,
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
    const strategies=createStrategicState();
    const teams={friendly:[],hostile:[]};
    for(const team of ['friendly','hostile']){
      let recipe=team===settings.variantTeam?settings.variant:['yard','kestrel','hauler'];
      const actors=recipe.map((family,i)=>makeRig(team,i,family,rng,
          team===settings.wornTeam?settings.wear:settings.backgroundWear??0));
      for(const a of actors){
        a.generation=team===settings.newTeam?'new':'legacy';
        if(a.generation==='legacy')a.motion=makeLegacyMotion(a.behavior);
        a.teamPlanLeft=0;
        a.teamPlanTargetId=null;
        a.teamIntent=null;
      }
      teams[team]=actors;
    }
    const actors=[...teams.friendly,...teams.hostile],memory=createWorldModel();
    const metrics={seed,scenario:settings.name,accuracy:settings.accuracy,newTeam:settings.newTeam,
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
        plans={friendly:planTeam(snapshot,'friendly',{
            strategy:evaluateStrategy(strategies,snapshot,'friendly')}),
            hostile:planTeam(snapshot,'hostile',{
            strategy:evaluateStrategy(strategies,snapshot,'hostile')})};
        planLeft=.85;
        if(metrics.firstContactAt===null&&['friendly','hostile'].some(team=>
          snapshot.knowledge[team].contacts.some(c=>c.visible)))
          metrics.firstContactAt=t;
      }
      for(const a of actors){
        if(!a.active)continue;
        const target=a.generation==='new' ? nearestVisible(a,actors,snapshot) :
          actors.filter(e=>e.active&&e.team!==a.team)
            .sort((b,c)=>dist(a.rig,b.rig)-dist(a.rig,c.rig))[0]??null;
        const recovery=aiWeaponRecoveryDirective(a,target);
        const capability=snapshot.knowledge[a.team].allies
          .find(p=>p.id===a.id)?.capability;
        const config=configFor(a);
        let drive;
        if(a.generation==='legacy'){
          const oldPosture=aiWeaponRecoveryPosture(damagePosture(a.condition,a.behavior),recovery);
          if(target){
            a.teamPlanLeft=Math.max(0,a.teamPlanLeft-DT);
            if(a.teamPlanLeft<=0 || a.teamPlanTargetId!==target.id){
              const objective=dominationPointForActor(state,a);
              a.teamIntent=squadIntent(a,actors,target,objective,oldPosture,null);
              if(objective && oldPosture?.preferredMode!=='WITHDRAW' &&
                  oldPosture?.preferredMode!=='HOLD'){
                a.teamIntent={mode:'DOMINATE',role:a.teamIntent.role,point:objective,
                  note:'SECURE POINT '+objective.id,throttleScale:.94};
              }
              a.teamIntent=exploitServicingTarget(a.teamIntent,target,oldPosture);
              a.teamPlanLeft=.24+((a.id.charCodeAt(a.id.length-1)||0)%3)*.04;
              a.teamPlanTargetId=target.id;
              a.stats.goalChanges++;
            }
            const functional=hostileOutput(a.condition,a.behavior);
            const canMove=functional.structure>.05 && functional.command>.05 &&
              functional.power>.12 && functional.mobility>.05;
            drive=advanceLegacyMotion(a.motion,a.rig,target.rig,DT,canMove,
              DEFAULT_WORLD,config.collisionRadiusM,a.behavior,a.teamIntent);
          }else{
            // The old live actor loop stopped whenever it lost a target.
            drive={throttle:0,strafe:0,steer:0,brake:1};
          }
        }else{
          const job=plans[a.team].orders[a.id]??null;
          const before=a.brain.history.length;
          const decision=decidePilot(a.brain,{id:a.id,position:{x:a.rig.x,z:a.rig.z}},
            job,{capability,weaponRecovery:recovery,world:DEFAULT_WORLD,
              personality:a.behavior.id,preferredRangeM:a.behavior.preferredRangeM,
              underFireSeconds:a.motion.awareness?.underFireSeconds??0,
              retreatPoint:{x:a.rig.x,z:a.team==='friendly'?22:-22}},t);
          if(a.brain.history.length>before)a.stats.goalChanges++;
          const instruction=executeIntent(a.executor,decision,a.rig,DEFAULT_WORLD,
            config.collisionRadiusM,DT);
          if(instruction.routeFailure&&!a._lastRouteFailure)
            a.stats.routeErrors++;
          a._lastRouteFailure=!!instruction.routeFailure;
          drive=advanceEnemyMotion(a.motion,a.rig,target?.rig??a.rig,DT,
            capability?.canMove??true,DEFAULT_WORLD,config.collisionRadiusM,
            a.behavior,instruction);
        }
        if(a.motion.phase==='RECOVER' && a._previousMovePhase!=='RECOVER')
          a.stats.navigationRecoveries++;
        a._previousMovePhase=a.motion.phase;
        if(recovery.begin&&!a.fieldService.held)
          beginFieldService(a.condition,a.fieldService,a.rig);
        const posture=aiWeaponRecoveryPosture(damagePosture(a.condition,a.behavior),recovery);
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
        const slot=hostileAimSlot(fired,a.behavior.aimPriority);
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

function serialMetrics(rows){
  const avg=(fn)=>rows.length?rows.reduce((sum,row)=>sum+fn(row),0)/rows.length:0;
  const totalActors=rows.flatMap(r=>r.actors);
  const one=(gen)=>totalActors.filter(a=>a.generation===gen);
  const side=(gen,key)=>one(gen).reduce((s,a)=>s+a[key],0);
  return {bouts:rows.length,
    scores:avg(r=>r.points.friendly+r.points.hostile),
    captures:avg(r=>r.captureEvents),recaptures:avg(r=>r.recaptureEvents),
    contestsSeconds:avg(r=>r.contestedSeconds),
    noScoringSeconds:avg(r=>r.noMajoritySeconds),
    firstContactSeconds:avg(r=>r.firstContactAt??MAX_SECONDS),
    roundsWithNoContact:rows.filter(r=>r.firstContactAt===null).length,
    territoryVictories:rows.filter(r=>r.winReason==='SCORE').length,
    timeouts:rows.filter(r=>r.winReason==='TIME LIMIT').length,
    roundsWithNoDamage:rows.filter(r=>r.damagingShots===0).length,
    killsPerBout:avg(r=>r.kills),
    meanDuration:avg(r=>r.time),
    byGeneration:Object.fromEntries(['new','legacy'].map(g=>[g,{
      rigs:one(g).length,damage:side(g,'damageDealt'),
      kills:side(g,'kills'),shots:side(g,'actualShots'),
      hits:side(g,'hits'),captures:side(g,'captures'),
      zoneSeconds:side(g,'zoneSeconds'),
      distance:side(g,'travel'),goals:side(g,'goalChanges'),
      recoveries:side(g,'navigationRecoveries'),routeFailures:side(g,'routeErrors'),
      service:side(g,'serviceCount'),
      surviving:one(g).filter(a=>a.alive).length
    }]))};
}
function runSeries(index,scenario,sideSwap=false){
  const newTeam=sideSwap?'hostile':'friendly';
  const series={index,seed:0x5d128f71+index*94307,scenario,newTeam,
    roundWins:{new:0,legacy:0},roundDraws:0,rounds:[],
    outcome:null,roundCount:0};
  for(let round=0;round<3;round++){
    if(series.roundWins.new>=2||series.roundWins.legacy>=2)break;
    const seed=series.seed+round*0x1c23b;
    const bout=runBout(seed,{name:scenario,accuracy:scenario==='no-damage'?0:.70,
      policy:'strict',newTeam,variantTeam:'none',
      variant:['yard','kestrel','hauler']});
    series.rounds.push(bout);
    if(bout.win==='draw')series.roundDraws++;
    else series.roundWins[bout.win===newTeam?'new':'legacy']++;
  }
  series.roundCount=series.rounds.length;
  series.outcome=series.roundWins.new>=2?'new':series.roundWins.legacy>=2?'legacy':'unresolved';
  return series;
}
function aggregate(series){
  const bouts=series.flatMap(s=>s.rounds);
  const n=series.length;
  const count=(status)=>series.filter(s=>s.outcome===status).length;
  const newWins=count('new'),legacyWins=count('legacy'),unresolved=count('unresolved');
  const decisive=newWins+legacyWins;
  return {series:n,bouts:bouts.length,seriesWins:{new:newWins,legacy:legacyWins,unresolved},
    decisiveWinFraction:decisive?newWins/decisive:null,
    winFractionAll:newWins/n,
    meanRounds:series.reduce((s,x)=>s+x.roundCount,0)/n,
    seriesWithDrawRound:series.filter(x=>x.roundDraws>0).length,
    boutsSummary:serialMetrics(bouts)};
}
function main(){
  const shard=Number(process.argv[2]??0);
  const armedPairs=Number(process.argv[3]??2);
  const noDamagePairs=Number(process.argv[4]??1);
  const series=[];
  for(const [scenario,count,offset] of [['armed',armedPairs,0],['no-damage',noDamagePairs,100000]]){
    for(let i=0;i<count;i++){
      const index=offset+shard*armedPairs+i;
      // Repeat each seed on the opposite side to measure spawn asymmetry.
      series.push(runSeries(index,scenario,false));
      series.push(runSeries(index,scenario,true));
    }
  }
  const stats={headCommit:'k3u2 MAIN 93286524 (branch base)',legacyCommit:'b056964',
    shard,simulation:'paired 3v3 proxy BO3',model:'60Hz physical rigs, approximate shot hits',
    productionPolicy:'strict',maxBoutSeconds:MAX_SECONDS,
    resetBetweenRounds:true,headlessRaycastApproximation:true,
    armed:aggregate(series.filter(s=>s.scenario==='armed')),
    noDamage:aggregate(series.filter(s=>s.scenario==='no-damage'))};
  fs.mkdirSync('study-results',{recursive:true});
  fs.writeFileSync('study-results/generation-series-shard-'+shard+'.json',JSON.stringify(series));
  fs.writeFileSync('study-results/generation-summary-shard-'+shard+'.json',JSON.stringify(stats,null,2));
  console.log('COMPARISON_RESULTS '+JSON.stringify(stats));
}
main();
