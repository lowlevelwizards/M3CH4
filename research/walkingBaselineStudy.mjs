/** Headless A.0 handling baselines: compare old coast vs bounded active
 * walking, using installed masses and real 60Hz simulation (no render/DOM).
 * node research/walkingBaselineStudy.mjs [--json]
 */
import {pathToFileURL} from 'node:url';
import {makeTestAssembly,equip} from '../components.js';
import {deriveRigConfig} from '../assemblyPhysics.js';
import {createRigState,stepRig} from '../locomotion.js';
const DT=1/60,WORLD={minX:-300,maxX:300,minZ:-300,maxZ:300,obstacles:[]};
const blank={throttle:0,strafe:0,steer:0,brake:0};
function simulate(config,phases,assist=true){
 const s=createRigState({x:0,z:0,yaw:0});
 let maxSlip=0,tractionTicks=0,distance=0,oldX=0,oldZ=0;
 const adjusted={...config,walkingAssistEnabled:assist};
 for(const [seconds,input] of phases)for(let i=0;i<Math.round(seconds/DT);i++){
  stepRig(s,input,DT,adjusted,WORLD);
  distance+=Math.hypot(s.x-oldX,s.z-oldZ);oldX=s.x;oldZ=s.z;
  maxSlip=Math.max(maxSlip,s.footSlipMps);
  if(s.tractionSaturated)tractionTicks++;
 }
 return {distance,speed:Math.hypot(s.vx,s.vz),yaw:s.yaw*180/Math.PI,maxSlip,tractionTicks};
}
export function runWalkingBaselineStudy(){
 const rows=[];
 for(const [name,id] of [['Kestrel','legs-compact'],['Yardwalker','legs-yard'],['Hauler H2','legs-hauler']]){
  const a=makeTestAssembly();equip(a,'mobility',id);const config=deriveRigConfig(a);
  const old=simulate(config,[[1,{...blank,throttle:1}],[1.5,blank]],false);
  const assisted=simulate(config,[[1,{...blank,throttle:1}],[1.5,blank]],true);
  const reverse=simulate(config,[[1,{...blank,throttle:1}],[1.5,{...blank,throttle:-1}]]);
  const pivot=simulate(config,[[1.5,{...blank,steer:1}]]);
  const lateral=simulate(config,[[1,{...blank,strafe:1}]]);
  rows.push({name,id,massKg:config.massKg,
   coastSpeed:old.speed,settledSpeed:assisted.speed,
   coastPath:old.distance,settlePath:assisted.distance,
   reversalSpeed:reverse.speed,pivotDegrees:pivot.yaw,
   lateralDisplacement:lateral.distance,
   lateralGripSaturation:lateral.tractionTicks});
 }
 return rows;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const rows=runWalkingBaselineStudy();
 if(process.argv.includes('--json'))console.log(JSON.stringify(rows,null,2));
 else{
  console.log('A.0/A.1 Physical Walking Baseline · 60Hz · installed catalog builds');
  for(const row of rows)console.log(row.name+': coast '+row.coastSpeed.toFixed(2)+' m/s → assisted '+row.settledSpeed.toFixed(2)+' m/s; turn '+row.pivotDegrees.toFixed(1)+'°');
 }
}
