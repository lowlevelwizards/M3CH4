/** k3u6: cheap public-objective and OWN-actor tactical judgments.
 * This module never moves a rig, infers hidden parts, or awards score. */
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const enemy=team=>team==='friendly'?'hostile':'friendly';
export const nearZone=(actor,zone,radius=4.7)=>
  dist(actor.position??actor.rig??actor,zone.point)<=radius;
export function scoreForecast(zone,team,majority=false){
  const ours=zone[team]??0,theirs=zone[enemy(team)]??0;
  const owned=zone.owner===team,hostile=zone.owner===enemy(team);
  const uncontested=owned&&!zone.contested;
  const gain=uncontested?(majority?1.85:1.28):
    hostile?(zone.contested?.77:.99):zone.contested?.80:1.20;
  const risk=Math.max(0,theirs-ours)*.18+(zone.contested?.22:0);
  return gain-risk;
}
export function assignmentSwitchCost(actor,job,previous,zone,team,needMajority=false){
  if(!previous||!job)return 0;
  if(previous.objectiveId===job.objectiveId){
    return previous.goal===job.kind?-.18:-.06; // preserving work is a bonus
  }
  if(zone?.owner===team&&!zone.contested&&nearZone(actor,zone,3.8)){
    // Owned but insufficient for scoring is not a paying majority. Leaving
    // one such circle to secure a second is often the *winning* move.
    return needMajority?.08:.62;
  }
  return .12;
}
/** Own-team anchors are retained independently of the raid scheduler.
 * One human actually present in a safe point may count as physical coverage,
 * but the planner cannot force that pilot to remain. */
export function reserveAnchors(actors,zones,team,player=null,radius=4.7){
  const remaining=new Set(actors.map(a=>a.id)),orders=[];
  const paying=zones.filter(z=>z.owner===team&&!z.contested);
  // Hard reservations only protect an ACTUAL paying majority. Before that,
  // holding one point must remain a flexible choice or three rigs lose the
  // ability to create the second uncontested scoring position.
  if(paying.length<2)return [];
  paying.sort((a,b)=>{
    const rank=z=>z[enemy(team)]??0;
    return rank(b)-rank(a)||a.id.localeCompare(b.id);
  });
  for(const zone of paying){
    const playerOn=player&&nearZone(player,zone,radius-.5);
    const close=actors.filter(a=>remaining.has(a.id)&&a.capability?.canMove&&
      nearZone(a,zone,radius+.8)).sort((a,b)=>{
      const sa=(a.capability?.endurance??1)*.22-dist(a.position,zone.point)*.05;
      const sb=(b.capability?.endurance??1)*.22-dist(b.position,zone.point)*.05;
      return sb-sa||a.id.localeCompare(b.id);
    });
    if(!close.length)continue;
    if(playerOn && paying.length<2)continue; // do not dogpile lone point
    const actor=close[0];
    remaining.delete(actor.id);
    orders.push({actor,zone});
  }
  return orders;
}
export function canStageAssault({pair,actors,zone,team,now,memory,majorityHeld=false}){
  if(!zone||!pair||pair.length<2||majorityHeld||memory?.cooldownUntil>now)return false;
  if((zone[enemy(team)]??0)<1)return false; // no visible objective opposition
  const chosen=pair.slice(0,2).map(([id])=>actors.find(a=>a.id===id));
  if(chosen.some(a=>!a?.capability?.canMove||!a.capability?.canFight))return false;
  // Staging is for teammates already close enough to converge quickly.
  return chosen.every(a=>dist(a.position,zone.point)<11);
}
export function teamPosture(snapshot,team){
  const allies=snapshot.knowledge?.[team]?.allies??[];
  const opponents=snapshot.knowledge?.[team]?.contacts??[];
  const friendlies=allies.filter(a=>a.active);
  const knownThreats=opponents.filter(c=>c.visible&&c.confidence>.4).length;
  const enemyRemaining=snapshot.remaining?.[enemy(team)]??null;
  const held=snapshot.zones?.filter(z=>z.owner===team&&!z.contested).length??0;
  const opponentHeld=snapshot.zones?.filter(z=>z.owner===enemy(team)&&!z.contested).length??0;
  const fightable=friendlies.filter(a=>a.capability?.canFight&&a.capability?.canMove).length;
  // No omniscience: enemy roster counts are never inferred from hidden contacts.
  return {held,opponentHeld,fightable,knownThreats,
    preserve:held>=2,disadvantaged:fightable<=1&&opponentHeld>=2,
    canPress:fightable>=2&&held>=1&&!opponentHeld,
    enemyRemaining,finishOpportunity:enemyRemaining===1&&fightable>=2&&
      held>=2&&knownThreats>0};
}
