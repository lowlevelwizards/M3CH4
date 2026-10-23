/**
 * RESEARCH ONLY: PR #42 3v3 Domination battle runner (Node, no canvas).
 *
 * LIVE production pure rules called here:
 *  - team/pilot perception, utility, commitments, routes, tactical movement
 *  - 60Hz stepRig physics, family-specific mass/drive, obstacles/collisions
 *  - Domination capture, contesting, score and victory
 *  - actual weapon/target condition, armor-first damage, AI cadence, ammo,
 *    field service, damage-aware derating, disabled-state rules
 *  - optional equipment-fidelity mode: real generator dynamics and six pellets,
 *    with explicitly APPROXIMATE 3D first-contact selection
 *
 * LIMITATIONS: actual Three.js raycast mesh, recoil visual, target occlusion,
 * shooter accuracy at slot centroid are approximated with explicit chance
 * calibrated as LOW/MID/HIGH sensitivity cohorts. There is no human player,
 * rendering, audio, persistence or BO3 between-round repair. This is a
 * randomized battle test, NOT equivalent to headless browser playthrough.
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {getAiResearchProfile,getAiResearchDifficulty} from '../ai/researchProfiles.js';
import {prioritizeVisibleTarget,shouldAttemptTacticalShot,tacticalAimSlot} from '../ai/adaptiveTactics.js';
import {counterFlankOrder,shotThreatEvidence,recordShotEvidence} from '../ai/combatIntelligence.js';
import {recentThreatTargetId} from '../tacticalAwareness.js';
import {TRAFFIC_POLICIES} from '../ai/trafficCoordination.js';
import {ARRIVAL_POLICIES} from '../ai/squadPositioning.js';
import {CORRIDOR_POLICIES} from '../ai/corridorCoordinator.js';
import { makeRangeTarget, createTargetCondition, weaponFor, createWeaponState,
    advanceWeapon, startReload, fireWeapon, applyTargetHit, mirrorTargetCondition,
    applyRecoil } from '../combat.js';
import { pelletOffsets } from '../scattergun.js';
import { createPowerSystem,advancePowerSystem,powerConstrainedOutput,registerPowerShot,setActiveWeaponLoad } from '../powerDynamics.js';
import { advanceChargedTrigger,advanceProjectileTrigger,weaponActionSpreadRadians } from '../weaponController.js';
import { createThermalCombat,coolThermalCombat,cutContact,moduleHeatKey } from '../thermalCombat.js';
import { blastDamage } from '../explosionResolution.js';
import { createRigState, stepRig, DEFAULT_WORLD } from '../locomotion.js';
import { deriveRigConfig } from '../assemblyPhysics.js';
import { installedPart,makeTestAssembly,equip,inspectAssembly,SLOTS } from '../components.js';
import { createSortieObjective, advanceSortieObjective } from '../sortieObjectives.js';
import { contractById } from '../contracts.js';
import { createHostileController, hostileOutput, advanceHostileController,
    hostileAimSlot, hostileMissionKillReason, hostileSpread } from '../hostileRig.js';
import { createEnemyMotion, advanceEnemyMotion, withinFiringArc } from '../enemyMotion.js';
import { tacticalLineOfSight, noteIncomingFire, noteBlockedFire } from '../tacticalAwareness.js';
import { createWorldModel, observeBattlefield } from '../ai/worldModel.js';
import {mapById,contractAtMap} from '../maps/mapRegistry.js';
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
function makeRig(team,n,family,rng,wear=0,difficulty=getAiResearchDifficulty(),spawnSet=null){
    // Balance research can use a full five-station fitted assembly.
    // Respect actual hardware validity; never invent functional rigs.
    const custom=family&&typeof family==='object';
    const identity=custom?family.name:family;
    const pilot=custom?(family.pilot??'yard'):family;
    if(!Object.hasOwn(FAMILIES,pilot))throw Error('Unknown research pilot: '+pilot);
    const assembly=custom?makeTestAssembly():makeRangeTarget(FAMILIES[pilot]);
    if(custom){
      for(const slot of SLOTS){
        if(!family.recipe?.[slot])throw Error('Missing recipe slot '+slot);
        equip(assembly,slot,family.recipe[slot]);
      }
      const check=inspectAssembly(assembly);
      if(!check.ready)throw Error('Illegal research rig '+identity+': '+
        check.checks.filter(x=>!x.passes).map(x=>x.reason).join('; '));
    }
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
    const side=team==='friendly'?1:-1;
    const authored=spawnSet?.[n];
    const x=authored?authored.x:[-9,0,9][n]+(rng()-.5)*4.2;
    const z=authored?authored.z:side*(21+(rng()-.5)*3.4);
    const rig=createRigState({x,z,yaw:authored?.yaw??(team==='friendly'?0:Math.PI)});
    const original=custom&&family.behavior?family.behavior:contractById(FAMILIES[pilot]).behavior;
    const behavior={...original,spreadScale:original.spreadScale*difficulty.spreadScale};
    const id=team==='friendly'?'ally-'+(n+1):'enemy-'+n;
    return {id,team,family:identity,behavior,assembly,condition,rig,
        spawn:{x,z},active:true,killReason:null,
        weaponSpec,weaponState:createWeaponState(weaponSpec),
        power:createPowerSystem(assembly),
        controller:createHostileController(difficulty.acquisitionDelay+n*.15,behavior),
        motion:createEnemyMotion(behavior),baseConfig:deriveRigConfig(assembly),
        driveDamage:{drives:{}},brain:createPilotBrain(),executor:createIntentExecutor(),
        fieldService:createFieldServiceState(),lastScore:0,targetId:null,combatMemory:{},
        lastPosition:{x,z},
        stats:{travel:0,damageDealt:0,armorDamage:0,internalDamage:0,damageTaken:0,
            shotTriggers:0,actualShots:0,hits:0,kills:0,goalChanges:0,
            projectilesFired:0,projectilesHit:0,shotRangeSum:0,
            shotsUnder8m:0,shotsBeyond12m:0,brownoutFrames:0,
            powerBlockedFrames:0,minBusRatio:1,
            captures:0,zoneSeconds:0,routeErrors:0,serviceCount:0,
            firstContact:null,firstShot:null,deathAt:null,
            targetSwitches:0,trafficYields:0,routeSwitches:0,stallSeconds:0,
            trafficQueueSeconds:0,
            collisionImpacts:0,underFireSeconds:0,
            attackBySlot:Object.fromEntries(PARTS.map(s=>[s,0]))}};
}
function configFor(a,physicalEquipment=false){
    const part=a.condition.parts.mobility;
    const mobility=installedPart(a.assembly,'mobility');
    const health=clamp(part.integrity/part.maxIntegrity,0,1);
    a.driveDamage.drives[mobility.instance.serial]={left:health,right:health};
    const output=functionalOutput(a.assembly,a.driveDamage);
    return derateRigConfig(a.baseConfig,physicalEquipment?
      powerConstrainedOutput(output,a.power):output);
}
function nearestVisible(a,roster,snapshot,order=null){
    const known=new Set((snapshot?.knowledge?.[a.team]?.contacts??[])
        .filter(c=>c.visible).map(c=>c.id));
    const live=roster.filter(o=>o.active&&o.team!==a.team&&known.has(o.id));
    const selected=prioritizeVisibleTarget(a,live,snapshot,order,a.targetId,
        recentThreatTargetId(a.motion));
    if(selected?.id&&a.targetId&&a.targetId!==selected.id)a.stats.targetSwitches++;
    a.targetId=selected?.id??null;
    return selected??null;
}
function damage(attacker,target,slot,metrics,t,rng,nominal=attacker.weaponSpec.damage){
    const pre=target.condition.parts[slot].integrity;
    const hit=applyTargetHit(target.condition,slot,nominal);
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
/** Exact live pellet angular offsets, with deliberately APPROXIMATE
 * moving-target contact probabilities (no Three.js scene in this runner).
 * One shell consumes one round; each successful projectile receives its own
 * armor-first application. A radial pellet spread is NOT a fabricated damage
 * multiplier. Explicit model uncertainty: target silhouette and obstructions
 * remain simplified compared with first-mesh raycasts.
 */
export function sampleProxyProjectileHits(spec,shotIndex,distanceM,hitChance,rng){
  if(!(hitChance>0))return 0;
  const offsets=spec.pellets>1?pelletOffsets(shotIndex,spec):[[0,0]];
  let hits=0;
  for(const [x,y] of offsets){
    const radialM=Math.hypot(x,y)*Math.max(0,distanceM);
    const silhouette=Math.exp(-.5*(radialM/.72)**2);
    if(rng()<hitChance*silhouette)hits++;
  }
  return hits;
}
/** Reconstruct the nearby dynamic body AABBs from the live collision layer.
 * Physics stays in stepRig; a bot never teleports around another body.
 * Sampling is sequential as in the browser and side-swapped in tournaments.
 */
function combatWorldFor(me,actors,baseWorld=DEFAULT_WORLD){
  const others=actors.filter(a=>a!==me&&a.active).map(a=>{
    const radius=a.baseConfig?.collisionRadiusM??1;
    return {id:'rig-'+a.id,dynamic:true,
      minX:a.rig.x-radius,maxX:a.rig.x+radius,
      minZ:a.rig.z-radius,maxZ:a.rig.z+radius};
  });
  return {...baseWorld,obstacles:[...baseWorld.obstacles,...others]};
}
export function runBout(seed,settings){
    const arenaMap=settings.mapId?mapById(settings.mapId):null;
    const selectedWorld=arenaMap?.world??DEFAULT_WORLD;
    const traffic={friendly:settings.trafficFriendly??'legacy',
        hostile:settings.trafficHostile??'legacy'};
    const corridorPolicy={friendly:settings.corridorFriendly??'legacy',
      hostile:settings.corridorHostile??'legacy'};
    if(!CORRIDOR_POLICIES.includes(corridorPolicy.friendly)||
       !CORRIDOR_POLICIES.includes(corridorPolicy.hostile))
      throw new RangeError('Invalid corridor coordination policy');
    const arrivals={friendly:settings.arrivalFriendly??'legacy',
      hostile:settings.arrivalHostile??'legacy'};
    if(!ARRIVAL_POLICIES.includes(arrivals.friendly)||
      !ARRIVAL_POLICIES.includes(arrivals.hostile))
      throw new RangeError('Invalid squad destination policy');
    if(!TRAFFIC_POLICIES.includes(traffic.friendly)||
        !TRAFFIC_POLICIES.includes(traffic.hostile))
      throw new RangeError('Invalid squad traffic research policy');
    const rng=random(seed);
    const contract=contractById(settings.contractId??'domination');
    const state=createSortieObjective(arenaMap?contractAtMap(contract,arenaMap):contract);
    // Research-only capture-site proposal. The physical world is unchanged,
    // so no speculative collision, score rule or AI movement advantage exists.
    if(settings.objectivePoints){
      if(!state.domination||settings.objectivePoints.length!==3)
        throw new RangeError('Three domination sites required for map research');
      state.domination.points=settings.objectivePoints.map(p=>({
        id:p.id,x:p.x,z:p.z,influence:0,owner:null,contested:false,friendly:0,hostile:0,
      }));
    }
    const zonePoints=state.domination?.points??[];
    const policies={friendly:getAiResearchProfile(settings.policyFriendly??'baseline'),
        hostile:getAiResearchProfile(settings.policyHostile??'baseline')};
    const difficulties={friendly:getAiResearchDifficulty(settings.difficultyFriendly??'pro'),
        hostile:getAiResearchDifficulty(settings.difficultyHostile??'pro')};
    const maxSeconds=Math.min(600,Math.max(2,settings.maxSeconds??MAX_SECONDS));
    if(state.domination)state.domination.capturePolicy=settings.policy??'strict';
    const strategies=createStrategicState();
    const teams={friendly:[],hostile:[]};
    for(const team of ['friendly','hostile']){
      let recipe=settings.rosters?.[team]??(team===settings.variantTeam?
        settings.variant:['yard','kestrel','hauler']);
      if(!Array.isArray(recipe)||recipe.length<1||recipe.length>3||
          recipe.some(family=>!(typeof family==='object'&&family!==null)||!family.recipe ?
            !Object.hasOwn(FAMILIES,family):!Object.hasOwn(FAMILIES,family.pilot??'yard')))
        throw new RangeError('Invalid three-rig roster for '+team);
      const actors=recipe.map((family,i)=>makeRig(team,i,family,rng,
          team===settings.wornTeam?settings.wear:settings.backgroundWear??0,
          difficulties[team],arenaMap?.spawns?.[
            settings.swapSpawns?(team==='friendly'?'hostile':'friendly'):team]));
      teams[team]=actors;
    }
    const actors=[...teams.friendly,...teams.hostile],memory=createWorldModel();
    const activeHeat=createThermalCombat(),rocketFlights=[];
    const metrics={seed,scenario:settings.name??'research',accuracy:settings.accuracy,
        policies:{friendly:policies.friendly.id,hostile:policies.hostile.id},
        traffic,arrivals,corridorPolicy,
        difficulties:{friendly:difficulties.friendly.id,hostile:difficulties.hostile.id},
        simulation:settings.physicalEquipment?'research-approximate-v4-actions-flight-heat':'research-approximate-v2',
        objectiveType:state.type,contractId:settings.contractId??'domination',
        swappedSpawns:!!settings.swapSpawns,
        variants:{friendly:teams.friendly.map(a=>a.family),hostile:teams.hostile.map(a=>a.family)},
        win:null,winReason:null,time:maxSeconds,points:{friendly:0,hostile:0},
        kills:0,killReasons:{},firstKillAt:null,firstContactAt:null,
        firstCaptureAt:null,firstMajorityAt:null,scoreLeadChanges:0,contestedSeconds:0,
        noMajoritySeconds:0,totalScoringSeconds:0,captureEvents:0,
        contestedEvents:0,recaptureEvents:0,deadlocks:0,damagingShots:0,
        scoreByTeam:{friendly:0,hostile:0},actors:[]};
    let oldOwners=['', '', ''],lastClaimedOwners=[null,null,null],oldContest=[false,false,false],
        oldLeader=null,plans={},snapshot=null,
        planLeft={friendly:0,hostile:0},perceptionLeft={friendly:0,hostile:0};
    const assaults={friendly:{},hostile:{}};
    const corridorMemory={friendly:{},hostile:{}};
    const count=team=>actors.filter(a=>a.team===team&&a.active).length;
    // Each trial is independent; no user-managed player is present.
    for(let tick=0;tick<maxSeconds/DT;tick++){
      const t=tick*DT;
      coolThermalCombat(activeHeat,DT);
      for(let ri=rocketFlights.length-1;ri>=0;ri--){
        const p=rocketFlights[ri];p.left-=DT;
        if(p.left>0)continue;
        rocketFlights.splice(ri,1);
        for(const victim of actors){
          if(!victim.active||victim===p.shooter)continue;
          const range=dist(victim.rig,p.point);
          if(range>p.radius||!tacticalLineOfSight(p.point,victim.rig,selectedWorld))continue;
          const hitDamage=blastDamage(range,p.radius,p.damage);
          if(hitDamage>0){
            damage(p.shooter,victim,p.slot,metrics,t,rng,hitDamage);
            metrics.damagingShots++;
            p.shooter.stats.projectilesHit++;
          }
        }
      }
      for(const team of ['friendly','hostile']){
        planLeft[team]-=DT;perceptionLeft[team]-=DT;
      }
      if(!snapshot||perceptionLeft.friendly<=0||perceptionLeft.hostile<=0){
        const latest=observeBattlefield(memory,actors,state,selectedWorld,t);
        // Public objectives update together; each team receives new contacts
        // on its own perception cadence, never the opponent's faster cadence.
        const knowledge={};
        for(const team of ['friendly','hostile']){
          const ready=!snapshot||perceptionLeft[team]<=0;
          knowledge[team]=ready?latest.knowledge[team]:snapshot.knowledge[team];
          if(ready)perceptionLeft[team]=difficulties[team].perceptionSeconds;
        }
        snapshot={...latest,knowledge};
        if(metrics.firstContactAt===null&&['friendly','hostile'].some(team=>
          snapshot.knowledge[team].contacts.some(c=>c.visible)))
          metrics.firstContactAt=t;
      }
      for(const team of ['friendly','hostile'])if(planLeft[team]<=0||!plans[team]){
        plans[team]=planTeam(snapshot,team,{
          strategy:evaluateStrategy(strategies,snapshot,team),
          policy:policies[team],previousOrders:plans[team]?.orders,
          arrivalPolicy:arrivals[team],world:selectedWorld,
          corridorPolicy:corridorPolicy[team],corridorMemory:corridorMemory[team],
          assaultMemory:assaults[team]});
        planLeft[team]=difficulties[team].planningSeconds;
      }
      for(const a of actors){
        if(!a.active)continue;
        const view=snapshot.knowledge[a.team];
        let job=plans[a.team].orders[a.id]??null;
        const target=nearestVisible(a,actors,snapshot,job);
        const support=counterFlankOrder(view.allies.find(p=>p.id===a.id),
          job,view.allies,view.contacts,selectedWorld,t);
        if(support)job=support;
        const recovery=aiWeaponRecoveryDirective(a,target);
        const capability=view.allies.find(p=>p.id===a.id)?.capability;
        if(settings.physicalEquipment){
          const part=a.condition.parts.power;
          const health=clamp(part.integrity/part.maxIntegrity,0,1);
          const arcActive=a.weaponSpec.fireMode==='continuous'&&
            a.weaponState.loaded>0&&a.weaponState.reloadLeft<=0&&
            a.weaponState.action?.ventLeft<=0&&!!target&&
            dist(a.rig,target.rig)<=a.weaponSpec.rangeMeters;
          setActiveWeaponLoad(a.power,arcActive?(a.weaponSpec.activeKw??0):0);
          advancePowerSystem(a.power,a.assembly,a.rig,DT,health);
          a.stats.brownoutFrames+=Number(a.power.brownout);
          a.stats.minBusRatio=Math.min(a.stats.minBusRatio,a.power.busRatio);
        }
        const config=configFor(a,!!settings.physicalEquipment);
        const physicalWorld=combatWorldFor(a,actors,selectedWorld);
        const allies=actors.filter(p=>p.team===a.team&&p!==a&&p.active);
        const nearbyTraffic=allies.filter(p=>dist(p.rig,a.rig)<7)
          .map(p=>({id:p.id,position:p.rig,radius:p.baseConfig?.collisionRadiusM??1,
            active:p.active,speed:Math.hypot(p.rig.vx??0,p.rig.vz??0),
            velocity:{x:p.rig.vx??0,z:p.rig.vz??0}}));
        const before=a.brain.history.length;
        const decision=decidePilot(a.brain,{id:a.id,position:{x:a.rig.x,z:a.rig.z}},
          job,{capability,weaponRecovery:recovery,world:selectedWorld,
            policy:policies[a.team],personality:a.behavior.id,
            preferredRangeM:a.behavior.preferredRangeM,
            collisionRadius:config.collisionRadiusM+.3,
            enemySeen:!!view.contacts.some(c=>c.visible),
            uncertain:!view.contacts.some(c=>c.visible),
            nearbyAllies:allies.map(p=>({position:p.rig})),
            threatPosition:target?.rig??null,
            preserveMajority:zonePoints.filter(p=>
              p.owner===a.team&&!p.contested).length>=2,
            underFireSeconds:a.motion.awareness?.underFireSeconds??0,
            retreatPoint:{x:a.rig.x,z:a.spawn.z}},t);
        if(a.brain.history.length>before)a.stats.goalChanges++;
        const instruction=executeIntent(a.executor,decision,a.rig,physicalWorld,
          config.collisionRadiusM,DT,nearbyTraffic,
          {trafficPolicy:traffic[a.team],actorId:a.id});
        if(instruction.routeFailure&&!a._lastRouteFailure)a.stats.routeErrors++;
        a._lastRouteFailure=!!instruction.routeFailure;
        if(recovery.begin&&!a.fieldService.held)
          beginFieldService(a.condition,a.fieldService,a.rig);
        const posture=aiWeaponRecoveryPosture(damagePosture(a.condition,a.behavior),recovery);
        let drive=advanceEnemyMotion(a.motion,a.rig,target?.rig??null,DT,
          capability?.canMove??true,physicalWorld,config.collisionRadiusM,
          a.behavior,instruction,config);
        if(a.fieldService.held||recovery.mode==='SETTLE')
          drive={throttle:0,strafe:0,steer:0,brake:1};
        else drive={...drive,
          throttle:drive.throttle*Math.max(.66,posture.paceScale),
          strafe:(drive.strafe??0)*Math.max(.56,posture.strafeScale),
          steer:drive.steer*Math.max(.62,posture.steerScale)};
        const former={x:a.rig.x,z:a.rig.z},previousImpact=a.rig.impact??0;
        stepRig(a.rig,drive,DT,config,physicalWorld);
        const moved=dist(former,a.rig);
        a.stats.travel+=moved;
        a.stats.trafficYields=a.executor.trafficYields;
        a.stats.trafficQueueSeconds=a.executor.trafficQueueSeconds;
        a.stats.corridorWaitSeconds=a.executor.corridorWaitSeconds;
        a.stats.routeSwitches=a.executor.routeSwitches;
        if(a.rig.impact>Math.max(.45,previousImpact+.12))a.stats.collisionImpacts++;
        if(instruction.mode==='ORDER'&&moved<.004&&
            Math.hypot(a.rig.vx,a.rig.vz)<.2)a.stats.stallSeconds+=DT;
        if(a.motion.awareness?.underFireSeconds>.1)a.stats.underFireSeconds+=DT;
        if(recovery.mode==='SETTLE'&&!a.fieldService.held&&fieldServiceStationary(a.rig))
            beginFieldService(a.condition,a.fieldService,a.rig);
        const serviceStep=advanceFieldService(a.condition,a.fieldService,a.rig,DT);
        if(serviceStep.event==='completed'){
            a.stats.serviceCount++;mirrorTargetCondition(a.assembly,a.condition);
        }
        advanceWeapon(a.weaponState,a.weaponSpec,DT);
        if(a.weaponState.loaded<=0 && a.weaponState.reloadLeft===0&&a.weaponState.reserve>0)
            startReload(a.weaponState,a.weaponSpec);
        const fireReady=!!target&&a.weaponState.cooldown<=0&&
          (!settings.physicalEquipment||a.power.weaponReady)&&
          a.weaponState.loaded>0&&a.weaponState.reloadLeft<=0&&
          withinFiringArc(a.rig,target.rig)&&
          (a.weaponSpec.fireMode!=='continuous'||dist(a.rig,target.rig)<=a.weaponSpec.rangeMeters)&&
          tacticalLineOfSight(a.rig,target.rig,selectedWorld)&&
          shouldAttemptTacticalShot(a,target);
        // Trigger authority is the real fitted weapon cycle, regardless of policy.
        if(settings.physicalEquipment&&!a.power.weaponReady&&target&&a.weaponState.loaded>0)
          a.stats.powerBlockedFrames++;
        const fired=advanceHostileController(a.controller,a.condition,DT,!target,fireReady);
        const released=(a._releaseFrames??0)>0;
        if(released)a._releaseFrames--;
        const authorized=a.weaponSpec.fireMode==='charged'
          ? advanceChargedTrigger(a.weaponState,a.weaponSpec,!!fired&&!released,DT)
          : a.weaponSpec.fireMode==='projectile'
            ? advanceProjectileTrigger(a.weaponState,a.weaponSpec,!!fired&&!released)
            : !!fired;
        if(!authorized||!target)continue;
        a.stats.shotTriggers++;
        if(a.stats.firstContact===null)a.stats.firstContact=t;
        if(!withinFiringArc(a.rig,target.rig))continue;
        if(!tacticalLineOfSight(a.rig,target.rig,selectedWorld)){
            noteBlockedFire(a.motion,'STATIC COVER');continue;
        }
        const distance=dist(a.rig,target.rig);
        const errors=hostileOutput(a.condition,a.behavior);
        const spread=hostileSpread(fired,errors.spreadRadians+
          (a.weaponSpec.fireMode==='automatic'?weaponActionSpreadRadians(a.weaponSpec,a.weaponState,a.rig.brace??0):0));
        // Three.js raycast is unavailable: approximate the exposed target hit.
        const chance=clamp((settings.accuracy??.7)-
          (Math.max(0,distance-8)*.006)-
          Math.min(.15,Math.hypot(...spread)*1.2),.12,.98);
        if(fireWeapon(a.weaponState,a.weaponSpec)===null)continue;
        if(['charged','projectile'].includes(a.weaponSpec.fireMode))a._releaseFrames=1;
        a.stats.actualShots++;
        if(settings.physicalEquipment){
          a.stats.shotRangeSum+=distance;
          a.stats.shotsUnder8m+=Number(distance<=8);
          a.stats.shotsBeyond12m+=Number(distance>12);
          registerPowerShot(a.power,a.assembly);
          a.stats.projectilesFired+=a.weaponSpec.pellets??1;
        }
        if(a.stats.firstShot===null)a.stats.firstShot=t;
        const dx=target.rig.x-a.rig.x,dz=target.rig.z-a.rig.z;
        applyRecoil(a.rig,config,dx,dz,a.weaponSpec.recoilImpulseNs);
        // A physically fired but missed/blocked round still creates threat
        // evidence. Lacking 3D ballistics, use the estimated muzzle-to-target
        // segment, not invented coordinates or privileged shooter awareness.
        noteIncomingFire(target.motion,a.rig,a.id,.48,target.rig);
        for(const observer of actors)if(observer.active&&observer.team!==a.team&&
            observer.id!==target.id){
          const evidence=shotThreatEvidence(observer.rig,a.rig,target.rig);
          if(evidence)recordShotEvidence(observer.motion,observer.rig,evidence);
        }
        if(settings.physicalEquipment&&a.weaponSpec.fireMode==='projectile'){
          const hit=rng()<chance;
          const angle=rng()*Math.PI*2,miss=hit?0:4+6*rng();
          rocketFlights.push({shooter:a,point:{x:target.rig.x+Math.cos(angle)*miss,
            z:target.rig.z+Math.sin(angle)*miss},
            left:distance/Math.max(1,a.weaponSpec.projectileSpeed),
            radius:a.weaponSpec.blastRadius,damage:a.weaponSpec.damage,
            slot:hostileAimSlot(fired,a.behavior.aimPriority)});
          continue;
        }
        const projectileHits=settings.physicalEquipment?
          sampleProxyProjectileHits(a.weaponSpec,a.weaponState.firingCount,distance,
            settings.accuracy===0?0:chance,rng):
          (settings.accuracy===0||rng()>chance?0:1);
        if(!projectileHits)continue;
        a.stats.hits+=projectileHits;
        if(settings.physicalEquipment)a.stats.projectilesHit+=projectileHits;
        metrics.damagingShots+=projectileHits;
        const contested=!!job?.objectiveId&&zonePoints.some(p=>
          p.id===job.objectiveId&&p.contested&&dist(target.rig,p)<state.radius);
        const slot=tacticalAimSlot(hostileAimSlot(fired,a.behavior.aimPriority),{
          targetSpeed:Math.hypot(target.rig.vx??0,target.rig.vz??0),
          contesting:contested,visibleService:!!target.fieldService?.held});
        for(let pellet=0;pellet<projectileHits&&target.active;pellet++){
          const amount=a.weaponSpec.fireMode==='continuous'?
            cutContact(activeHeat,moduleHeatKey(target.id,slot,target.condition),
              1/a.weaponSpec.roundsPerSecond,a.weaponSpec.damage).damage:
            a.weaponSpec.damage;
          damage(a,target,slot,metrics,t,rng,amount);
        }
      }
      const prevScore={friendly:state.friendlyProgress,hostile:state.hostileProgress};
      const outcome=advanceSortieObjective(state,actors,DT);
      const ours=zonePoints.filter(p=>p.owner==='friendly'&&!p.contested).length;
      const theirs=zonePoints.filter(p=>p.owner==='hostile'&&!p.contested).length;
      // Real awarded score, not merely ownership count: experimental local
      // majority pressure can award reduced progress while contested.
      const scoring=state.friendlyProgress>prevScore.friendly+1e-9 ||
          state.hostileProgress>prevScore.hostile+1e-9;
      if(scoring){
          metrics.totalScoringSeconds+=DT;
          if(metrics.firstMajorityAt===null)metrics.firstMajorityAt=t;
      }else metrics.noMajoritySeconds+=DT;
      if(zonePoints.some(p=>p.contested))metrics.contestedSeconds+=DT;
      zonePoints.forEach((p,i)=>{
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
      // Live Domination resolves on full squad elimination immediately.
      // Check after objective scoring so simultaneous final events have one result.
      const friendlyRemaining=count('friendly'),hostileRemaining=count('hostile');
      if(friendlyRemaining===0||hostileRemaining===0){
        metrics.win=friendlyRemaining===0&&hostileRemaining===0?'draw':
          friendlyRemaining===0?'hostile':'friendly';
        metrics.winReason='ELIMINATION';metrics.time=t+DT;break;
      }
      // All surviving machines may still be stranded: bounded timed draw.
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
export function groupReport(rows){
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
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))main();
