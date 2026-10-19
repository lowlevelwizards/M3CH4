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
        hit.internalDamage?1.55:1.1,target.rig);
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
      teams[team]=actors;
    }
    const actors=[...teams.friendly,...teams.hostile],memory=createWorldModel();
    const metrics={seed,scenario:settings.name,accuracy:settings.accuracy,
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
        const target=nearestVisible(a,actors,snapshot);
        const recovery=aiWeaponRecoveryDirective(a,target);
        const capability=snapshot.knowledge[a.team].allies
          .find(p=>p.id===a.id)?.capability;
        const job=plans[a.team].orders[a.id]??null;
        const before=a.brain.history.length;
        const decision=decidePilot(a.brain,{id:a.id,position:{x:a.rig.x,z:a.rig.z}},
          job,{capability,weaponRecovery:recovery,world:DEFAULT_WORLD,
            personality:a.behavior.id,preferredRangeM:a.behavior.preferredRangeM,
            underFireSeconds:a.motion.awareness?.underFireSeconds??0,
            retreatPoint:{x:a.rig.x,z:a.team==='friendly'?22:-22}},t);
        if(a.brain.history.length>before)a.stats.goalChanges++;
        const config=configFor(a);
        const instruction=executeIntent(a.executor,decision,a.rig,DEFAULT_WORLD,
          config.collisionRadiusM,DT);
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
        // Production k3u7 fire rate: the actual fitted weapon's loaded,
        // reload and physical cooldown state are authoritative. No separate
        // contract personality trigger interval or fake 60Hz attempts.
        const ready=a.weaponState.cooldown<=0&&a.weaponState.loaded>0&&
            a.weaponState.reloadLeft<=0&&withinFiringArc(a.rig,target.rig)&&
            tacticalLineOfSight(a.rig,target.rig,DEFAULT_WORLD);
        const fired=advanceHostileController(a.controller,a.condition,DT,false,ready);
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
    metrics.actors=actors.map(a=>({id:a.id,team:a.team,family:a.family,
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
function main(){
    const n=Number(process.argv[2]??60);
    const seedOffset=Number(process.argv[3]??0);
    const config=[
 {name:'no-damage-strict',accuracy:0,policy:'strict',variantTeam:'none',variant:['yard','kestrel','hauler']},
 {name:'no-damage-superiority',accuracy:0,policy:'superiority',variantTeam:'none',variant:['yard','kestrel','hauler']},
 {name:'no-damage-pressure',accuracy:0,policy:'pressure',variantTeam:'none',variant:['yard','kestrel','hauler']},
 {name:'armed-strict',accuracy:.70,policy:'strict',variantTeam:'none',variant:['yard','kestrel','hauler']},
 {name:'armed-superiority',accuracy:.70,policy:'superiority',variantTeam:'none',variant:['yard','kestrel','hauler']},
 {name:'armed-pressure',accuracy:.70,policy:'pressure',variantTeam:'none',variant:['yard','kestrel','hauler']},
 {name:'worn-05',accuracy:.70,policy:'strict',variantTeam:'none',variant:['yard','kestrel','hauler'],wornTeam:'hostile',wear:.05},
 {name:'worn-15',accuracy:.70,policy:'strict',variantTeam:'none',variant:['yard','kestrel','hauler'],wornTeam:'hostile',wear:.15},
 {name:'worn-25',accuracy:.70,policy:'strict',variantTeam:'none',variant:['yard','kestrel','hauler'],wornTeam:'hostile',wear:.25},
 {name:'worn-40',accuracy:.70,policy:'strict',variantTeam:'none',variant:['yard','kestrel','hauler'],wornTeam:'hostile',wear:.40},
 {name:'light-vs-balanced',accuracy:.70,policy:'strict',variantTeam:'hostile',variant:['kestrel','kestrel','kestrel']},
 {name:'heavy-vs-balanced',accuracy:.70,policy:'strict',variantTeam:'hostile',variant:['hauler','hauler','hauler']},
];
        const rows=[];
    for(const configItem of config){
      // Each seed is paired with a side swap to measure location advantage.
      for(let i=0;i<n;i++){
        const swapped=i%2!==0;
        const opt={...configItem,variantTeam:configItem.variantTeam==='none'?'none':
          swapped?'friendly':'hostile',
          wornTeam:configItem.wornTeam?(swapped?'friendly':'hostile'):null};
        const pairedAsymmetric=configItem.variantTeam!=='none'||!!configItem.wornTeam;
        const index=pairedAsymmetric?Math.floor(i/2):i;
        // Identical seeds and initial rigs across competing capture policies.
        // Otherwise A/B comparisons confound rule changes with different
        // spawn offsets, targeted subsystem RNG and initial movement.
        const bucket=configItem.name.startsWith('no-damage-')?'territory':
            configItem.name.startsWith('armed-')?'armed':configItem.name;
        const cohorts=['territory','armed','worn-05','worn-15','worn-25',
            'worn-40','light-vs-balanced','heavy-vs-balanced'];
        rows.push(runBout(0x13579bdf+(index+seedOffset)*37621+
            Math.max(0,cohorts.indexOf(bucket))*100001,opt));
      }
      const subset=rows.filter(r=>r.scenario===configItem.name);
      console.log('GROUP '+configItem.name+' '+JSON.stringify(groupReport(subset)));
    }
    const report={meta:{baseline:'PR42 + k3u2 strategic planner and truthful AI ammo',games:rows.length,perGroup:n,
        maxSeconds:MAX_SECONDS,fixedDt:DT,hitApproximation:true,matchedPolicySeeds:true,
        estimator:'2D physical cover+forward arc+probabilistic direct-target mesh contact',
        otherGameRules:'production decision, physics, capture, weapon cycles, localized damage, field servicing'},
        overall:groupReport(rows),groups:Object.fromEntries(config.map(x=>[
            x.name,groupReport(rows.filter(r=>r.scenario===x.name))])),
        notable:{nonScoring:rows.filter(x=>x.winReason!=='SCORE').slice(0,8),
            worstRoutes:[...rows].sort((a,b)=>sum(b.actors,x=>x.routeErrors)-sum(a.actors,x=>x.routeErrors)).slice(0,3).map(x=>({seed:x.seed,scenario:x.scenario,routes:sum(x.actors,a=>a.routeErrors),winner:x.win,points:x.points,time:x.time}))}};
    fs.mkdirSync('study-results',{recursive:true});
    fs.writeFileSync('study-results/domination-summary.json',JSON.stringify(report,null,2));
    fs.writeFileSync('study-results/domination-bouts.json',JSON.stringify(rows));
    fs.writeFileSync('study-results/domination-bouts.csv',[
      'seed,scenario,winner,reason,time,score_friendly,score_hostile,captures,recaptures,contested_seconds,no_majority_seconds,first_contact,first_kill,kills,damage_shots,lead_changes',
      ...rows.map(r=>[r.seed,r.scenario,r.win,r.winReason,r.time,r.points.friendly,r.points.hostile,r.captureEvents,r.recaptureEvents,r.contestedSeconds.toFixed(2),r.noMajoritySeconds.toFixed(2),r.firstContactAt??'',r.firstKillAt??'',r.kills,r.damagingShots,r.scoreLeadChanges].join(','))
    ].join('\n'));
    console.log('FINAL_SUMMARY '+JSON.stringify({meta:report.meta,overall:report.overall,
      groups:Object.fromEntries(Object.entries(report.groups).map(([k,v])=>[k,{wins:v.winner,meanTime:v.meanTime,scoring:v.territoryDecisions,meanCaptureEvents:v.meanCaptureEvents,meanContestedSeconds:v.meanContestedSeconds,meanKills:v.meanKills}]))}));
}
main();
