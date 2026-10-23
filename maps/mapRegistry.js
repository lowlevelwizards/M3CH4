import {BACKLOT} from './backlot.js?v=k5q2';
import {CULVERT_NINE} from './culvertNine.js';
import {GRAINHOUSE} from './grainhouse.js';
import {TEST_YARD} from './testYard.js';

export const MAPS=Object.freeze([BACKLOT,CULVERT_NINE,GRAINHOUSE]);
const BY_ID=new Map(MAPS.map(map=>[map.id,map]));
export const DEFAULT_MAP_ID='backlot-dustbowl';
export function mapById(id){return BY_ID.get(id)||BY_ID.get(DEFAULT_MAP_ID);}
export function mapForContract(contract){
  if(contract?.trainingGround === true)return TEST_YARD;
  const id=contract?.mapId||DEFAULT_MAP_ID;
  if(!BY_ID.has(id))throw Error('Unknown authored contract map '+id);
  return BY_ID.get(id);
}
/** Every objective coordinate comes from the selected arena's authored sites.
 * Preserve existing contract victory/capture/hold settings and payouts.
 */
export function contractAtMap(contract,map=mapForContract(contract)){
 if(!contract)return null;
 const objective=contract.objective||{};
 const sites=map.sites;
 let position={};
 if(objective.type==='domination')position={points:sites.domination.map(p=>({...p}))};
 if(objective.type==='control')position={point:{...sites.control}};
 if(objective.type==='recovery')position={point:{...sites.recovery}};
 if(objective.type==='breakthrough')position={
  friendlyGoal:{...sites.breakthrough.friendlyGoal},
  hostileGoal:{...sites.breakthrough.hostileGoal},
 };
 return {...contract,objective:{...objective,...position}};
}
export function orderedTeamSpawns(map,team){return map.spawns[team].map(s=>({...s}));}
