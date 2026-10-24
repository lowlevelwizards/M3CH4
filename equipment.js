/** Auxiliary hardware does not create a sixth mission-kill station.
 * Physical fittings consume frame mass, generator load and limited sockets.
 * These identifiers are versioned independently from historical owned serials.
 */
export const EQUIPMENT_DEFS=Object.freeze({
  'cinder-smoke':{id:'cinder-smoke',name:'Cinder S-2 Smoke Pot',mount:'utility',massKg:95,powerKw:-3,credits:1650,
    description:'Two broad visual-concealment discharges per round. Smoke hides both sides; it is not ballistic cover.'},
  'mule-pump':{id:'mule-pump',name:'Mule Emergency Service Pump',mount:'utility',massKg:145,powerKw:-12,credits:2650,
    description:'Dedicated pressure bypass: field repairs run 30% faster, but still only one system at a time.'},
  'ox-jack':{id:'ox-jack',name:'Ox-Jack Ground Stabilizers',mount:'utility',massKg:205,powerKw:-7,credits:2350,
    description:'Extra brace recoil absorption when truly stationary and planted. Maneuver to release.'},
  'boarhide':{id:'boarhide',name:'Boarhide Forward Plate Kit',mount:'armor',massKg:265,powerKw:0,credits:2100,
    description:'Localized front housing shield. Heavier and stronger from ahead; flanks remain vulnerable.'},
  'twin-spar':{id:'twin-spar',name:'Twin-Spar Weapon Cradle',mount:'cradle',massKg:185,powerKw:-4,credits:3200,
    description:'A second light weapon socket with independently kept magazines and reloads. Toggle weapons in battle.'},
});
export const UTILITY_SOCKETS=Object.freeze(['utilityLeft','utilityRight']);
export const ARMOR_SOCKET='armorFront';
export const CRADLE_SOCKET='combatCradle';
export const SECONDARY_SOCKET='secondaryWeapon';
export const MOUNT_KEYS=Object.freeze([...UTILITY_SOCKETS,ARMOR_SOCKET,CRADLE_SOCKET,SECONDARY_SOCKET]);
export const SECONDARY_WEAPONS=Object.freeze(['gun-light','gun-short','gun-scatter','gun-rivet','gun-cannon']);
export const FRAME_UTILITY_LIMITS=Object.freeze({'frame-sr':2,'frame-utility':2,'frame-wedge':1});
export function equipmentDefinition(id){return EQUIPMENT_DEFS[id]??null;}
export function equipmentMounts(assembly){return assembly?.equipment&&typeof assembly.equipment==='object'&&!Array.isArray(assembly.equipment)?assembly.equipment:{};}
export function equipmentHas(assembly,id){return Object.values(equipmentMounts(assembly)).includes(id);}
export function normalizeEquipment(input){
  if(!input||typeof input!=='object'||Array.isArray(input))return {};
  const result={};
  for(const mount of MOUNT_KEYS){
    const id=input[mount];
    if(id==null)continue;
    if(typeof id!=='string')throw new Error('Invalid equipment part ID.');
    if(mount===SECONDARY_SOCKET){
      if(!SECONDARY_WEAPONS.includes(id))throw new Error('Unsupported secondary weapon.');
    } else {
      const def=equipmentDefinition(id);
      const type=UTILITY_SOCKETS.includes(mount)?'utility':mount===ARMOR_SOCKET?'armor':'cradle';
      if(def?.mount!==type)throw new Error('Equipment socket does not match part.');
    }
    result[mount]=id;
  }
  if(Object.keys(input).some(key=>!MOUNT_KEYS.includes(key)))
    throw new Error('Unknown equipment socket.');
  if(result.utilityLeft&&result.utilityLeft===result.utilityRight)
    throw new Error('Duplicate auxiliary equipment.');
  if(result.secondaryWeapon&&!result.combatCradle)
    throw new Error('Secondary weapon requires a Twin-Spar cradle.');
  return result;
}
export function checkEquipment(assembly,lookup){
  let equipment;
  try{equipment=normalizeEquipment(equipmentMounts(assembly));}
  catch(e){return {valid:false,reason:e.message,massKg:0,powerUsedKw:0};}
  const frameId=lookup('structure')?.id;
  const allowance=FRAME_UTILITY_LIMITS[frameId]??0;
  if(equipment.utilityRight&&allowance<2)
    return {valid:false,reason:'This frame has only one utility socket.',massKg:0,powerUsedKw:0};
  if((equipment.utilityLeft||equipment.utilityRight)&&allowance===0)
    return {valid:false,reason:'This frame has no utility sockets.',massKg:0,powerUsedKw:0};
  let massKg=0,powerUsedKw=0;
  for(const [mount,id] of Object.entries(equipment)){
    const def=mount===SECONDARY_SOCKET?lookup('secondary',id):equipmentDefinition(id);
    if(!def)return {valid:false,reason:'Unknown mounted equipment.',massKg:0,powerUsedKw:0};
    massKg+=def.massKg;
    powerUsedKw+=Math.max(0,-def.powerKw);
  }
  return {valid:true,reason:'Auxiliary equipment within frame/socket limits.',massKg,powerUsedKw};
}
export function setEquipmentMount(assembly,mount,id){
  if(!MOUNT_KEYS.includes(mount))return {ok:false,reason:'Unknown equipment socket.'};
  const before={...equipmentMounts(assembly)};
  const next={...before};
  if(!id)delete next[mount];else next[mount]=id;
  if(mount===CRADLE_SOCKET&&!id)delete next.secondaryWeapon;
  try{assembly.equipment=normalizeEquipment(next);return {ok:true,equipment:assembly.equipment};}
  catch(error){return {ok:false,reason:error.message};}
}
/** Systems continue to count only five primary stations for emergency recovery. */
export function servicePumpRate(assembly){return equipmentHas(assembly,'mule-pump')?1.30:1;}
export function stabilizerRecoilMultiplier(assembly,rig){
  if(!equipmentHas(assembly,'ox-jack'))return 1;
  const speed=Math.hypot(rig?.vx||0,rig?.vz||0);
  return speed<.18&&(rig?.brace??0)>.94?.45:1;
}
