/** k4v.9 complementary LIVE-systems lab.
 * Real Three.js first-mesh weapon contacts, and production 60Hz generator/drive.
 * Unlike headlessDominationStudy, these comparisons include six actual pellets
 * and the power bus, but they deliberately do not estimate win rates.
 */
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import {makeTestAssembly,equip,inspectAssembly} from '../components.js';
import {deriveRigConfig} from '../assemblyPhysics.js';
import {createRigState,stepRig} from '../locomotion.js';
import {createFunctionalDamage,functionalOutput,derateRigConfig} from '../functionalDamage.js';
import {createPowerSystem,advancePowerSystem,powerConstrainedOutput,registerPowerShot} from '../powerDynamics.js';
import {WEAPONS,createWeaponState,advanceWeapon,fireWeapon,startReload} from '../combat.js';
import {runWeaponRoleContactAudit} from './weaponRoleContactAudit.mjs';
import {simulatePowerProfile} from './powerResponseStudy.mjs';

const fmt=n=>Math.round(n*10000)/10000;
function haulerRig(generator){
  const assembly=makeTestAssembly();
  for(const [slot,id]of Object.entries({
    structure:'frame-wedge',mobility:'legs-hauler',power:generator,
    command:'cab-cyclops',combat:'gun-short'}))equip(assembly,slot,id);
  const result=inspectAssembly(assembly);
  if(!result.ready)throw Error('Illegal Hauler power cohort '+generator);
  return {assembly,config:deriveRigConfig(assembly),inspection:result};
}
export function simulateHeavyGenerator(id,phase='sustained',condition=1){
  const {assembly,config,inspection}=haulerRig(id);
  const rig=createRigState({x:0,z:0,yaw:0}),power=createPowerSystem(assembly),
    damage=createFunctionalDamage(),spec=WEAPONS['gun-short'],weapon=createWeaponState(spec);
  const dt=1/60,duration=phase==='recovery'?8:phase==='launch'||phase==='burst'?3:12;
  let shots=0,brownoutFrames=0,triggerBlockedFrames=0,minBus=1,minReserve=1,
    peakDemand=0,avgBus=0,totalDrive=0;
  for(let i=0;i<Math.round(duration/dt);i++){
    const moving=phase!=='idle'&&(phase!=='recovery'||i*dt<4);
    const shooting=(phase==='burst'||phase==='sustained'||phase==='recovery')&&moving;
    const input=moving?{throttle:1,strafe:.48,steer:.38,brake:0}:
      {throttle:0,strafe:0,steer:0,brake:0};
    advancePowerSystem(power,assembly,rig,dt,condition);
    const functional=powerConstrainedOutput(functionalOutput(assembly,damage),power);
    stepRig(rig,input,dt,derateRigConfig(config,functional),
      {minX:-1e5,maxX:1e5,minZ:-1e5,maxZ:1e5,obstacles:[]});
    advanceWeapon(weapon,spec,dt);
    if(shooting){
      if(!power.weaponReady)triggerBlockedFrames++;
      else{
        const fired=fireWeapon(weapon,spec);
        if(fired!==null){shots++;registerPowerShot(power,assembly)}
        else if(weapon.loaded===0&&weapon.reloadLeft===0)startReload(weapon,spec);
      }
    }
    minBus=Math.min(minBus,power.busRatio);
    minReserve=Math.min(minReserve,power.reserveFraction);
    brownoutFrames+=Number(power.brownout);
    avgBus+=power.busRatio;
    peakDemand=Math.max(peakDemand,power.demandKw);
    totalDrive+=rig.driveLoad??0;
  }
  return {generator:id,phase,condition,kg:inspection.massKg,
    headroomKw:inspection.powerAvailableKw-inspection.powerUsedKw,
    nominalCapacityKw:power.capacityKw,
    minBus:fmt(minBus),averageBus:fmt(avgBus/(duration/dt)),
    brownoutFrames,triggerBlockedFrames,shots,minReserve:fmt(minReserve),
    endReserve:fmt(power.reserveFraction),peakDemandKw:fmt(peakDemand),
    averageDriveLoad:fmt(totalDrive/(duration/dt)),
    speedMps:fmt(Math.hypot(rig.vx,rig.vz))};
}
function groupWeapon(rows,weapon,range){
  const matching=rows.filter(x=>x.weapon===weapon&&x.rangeM===range);
  const sum=key=>matching.reduce((n,x)=>n+x[key],0);
  return {weapon,rangeM:range,shells:matching.length*16,
    firedProjectiles:sum('rays'),struckProjectiles:sum('totalHitRays'),
    aimedModuleFirstContacts:sum('aimHits'),
    structureFirstContacts:sum('frameFirst'),
    absorbedArmor:fmt(sum('armorRemoved')),internalDamage:fmt(sum('internalDamage')),
    totalResolvedDamage:fmt(sum('armorRemoved')+sum('internalDamage')),
    hitProjectilesPerShell:fmt(sum('totalHitRays')/(matching.length*16)),
    totalResolvedDamagePerShell:fmt((sum('armorRemoved')+sum('internalDamage'))/(matching.length*16))};
}
export function runPhysicalEvidence(){
  const weaponEvidence=runWeaponRoleContactAudit();
  const weaponPairs=['gun-scatter','gun-short','gun-cannon','gun-light'].flatMap(gun=>
    [3,5,8,12,20,30].map(range=>groupWeapon(weaponEvidence.rows,gun,range)));
  const phases=['launch','burst','sustained','recovery'];
  const power=[];
  for(const condition of [1,.65])for(const phase of phases){
    for(const id of ['power-air','power-dynamo','power-forge'])
      power.push({frame:'Kestrel Skeleton Needle',...simulatePowerProfile(id,phase,condition)});
    for(const id of ['power-dynamo','power-forge'])
      power.push({frame:'Hauler Wedge Stump',...simulateHeavyGenerator(id,phase,condition)});
  }
  return {weapon:{realThreeJsFirstMesh:true,rows:weaponPairs,
    shellPerCell:16,frames:3,aimSlots:3,
    note:'Fresh stationary armor per aim/range, deterministic spread and six real pellet rays; not an aiming/AI/tactical scenario. Damage totals are bounded by available armor+integrity.'},
    power:{live60Hz:true,rows:power,
    note:'Same legal fits with actual bus reserve, shots, actuator loading and weapon-ready gating; scripted no-terrain motion, not a full match.'}};
}
export function formatPhysical(r){
  const lines=['# k4v.9 complementary real-system evidence','',
    '## Actual Three.js mesh contacts, 16 shells × 3 frames × 3 aim slots each','',
    '| Weapon | Range m | Hit projectiles per shell | Resolved physical damage per shell | Shells |',
    '| --- | ---: | ---: | ---: | ---: |',
    ...r.weapon.rows.map(x=>'| '+[x.weapon,x.rangeM,x.hitProjectilesPerShell,
      x.totalResolvedDamagePerShell,x.shells].join(' | ')+' |'),
    '',r.weapon.note,'',
    '## Live power bus, derating and genuine ammunition (60Hz)','',
    '| Fit | Power | Health | Phase | kg | kW margin | Low bus | Brownout frames | Shots | Blocked frames | Min reserve |',
    '| --- | --- | ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...r.power.rows.map(x=>'| '+[x.frame,x.id??x.generator,x.condition,x.phase,
      x.massKg??x.kg,x.headroomKw??(x.nominalKw===undefined?'—':(x.capacityKw-x.nominalKw)),
      x.minBus,x.underVoltageTicks??x.brownoutFrames,x.shotCount??x.shots,
      x.powerBlockedTriggers??x.triggerBlockedFrames,x.lowestReserve??x.minReserve].join(' | ')+' |'),
    '',r.power.note,'',
    'Do not equate these controlled physical effects with a win rate; use both evidence layers before balancing.'];
  return lines.join('\n')+'\n';
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const output=process.argv.find(x=>x.startsWith('--out='))?.slice(6)??'study-results/loadout-physical';
  const r=runPhysicalEvidence();
  fs.mkdirSync(output,{recursive:true});
  fs.writeFileSync(output+'/results.json',JSON.stringify(r,null,2)+'\n');
  fs.writeFileSync(output+'/report.md',formatPhysical(r));
  console.log(formatPhysical(r));
}
