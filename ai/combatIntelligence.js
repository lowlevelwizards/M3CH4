/** k.3u.7: physically grounded threat evidence and combat-support advice.
 * This file changes neither physics nor hit authority. An inferred bearing
 * must NEVER be promoted to a visible contact or aim target.
 */
import { tacticalLineOfSight, tacticalCoverBlocker } from '../tacticalAwareness.js';

const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const at=(o)=>o?.position??o?.rig??o;
const other=t=>t==='friendly'?'hostile':'friendly';

/** Distance to actual muzzle-impact segment, not an infinitely extended ray.
 * Gives nearby rigs a warning, without revealing which enemy fired it. */
export function shotThreatEvidence(observer,muzzle,impact,range=5.2){
 if(!observer||!muzzle||!impact)return null;
 const dx=impact.x-muzzle.x,dz=impact.z-muzzle.z,len2=dx*dx+dz*dz;
 if(len2<.01)return null;
 const t=clamp(((observer.x-muzzle.x)*dx+(observer.z-muzzle.z)*dz)/len2);
 const closest={x:muzzle.x+dx*t,z:muzzle.z+dz*t};
 const separation=dist(observer,closest);
 if(separation>range)return null;
 const d=Math.sqrt(len2);
 // Facing *toward* the shot's origin is a sector hint, not an exact position.
 const toward={x:-dx/d,z:-dz/d};
 return {severity:clamp(1.1-separation/range*.85,.22,1.1),
   bearing:toward,distance:separation};
}
export function recordShotEvidence(awareness,observer,evidence){
 if(!awareness||!observer||!evidence)return false;
 const state=awareness.awareness??awareness;
 state.underFireSeconds=Math.max(state.underFireSeconds??0,1.6+evidence.severity);
 state.urgency=Math.max(state.urgency??0,evidence.severity);
 state.underFireElapsed=Math.max(state.underFireElapsed??0,0);
 state.lastThreat={x:observer.x+evidence.bearing.x*9,
   z:observer.z+evidence.bearing.z*9};
 state.unseenThreat=true;
 state.shotWarnings=(state.shotWarnings??0)+1;
 return true;
}
/** Only public observed contacts may be used for a combat support decision.
 * An anchor holding an uncontested paying majority may not be reassigned. */
export function counterFlankOrder(actor,order,allies,contacts,world,now=0){
 if(!actor||order?.anchor||!actor.capability?.canMove||!actor.capability?.canFight)
   return null;
 const ally=(allies??[]).filter(a=>a.id!==actor.id&&a.active&&
    a.underFireSeconds>1.05&&dist(at(a),at(actor))<16)
    .sort((a,b)=>dist(at(a),at(actor))-dist(at(b),at(actor)))[0];
 if(!ally)return null;
 const threat=(contacts??[]).filter(c=>c.visible&&c.confidence>=.7)
   .filter(c=>dist(c.position,at(ally))<16)
   .sort((a,b)=>dist(a.position,at(ally))-dist(b.position,at(ally)))[0];
 if(!threat)return null;
 if(dist(at(actor),threat.position)>20)return null;
 const allyPos=at(ally),me=at(actor),target=threat.position;
 const dx=target.x-allyPos.x,dz=target.z-allyPos.z,n=Math.max(1,Math.hypot(dx,dz));
 const flank={x:target.x-dz/n*3,z:target.z+dx/n*3};
 // A support order has to stay safely reachable; prefer known contact if
 // the flank point crosses an obstacle or leaves arena bounds.
 const pad=1.5;
 const valid=world&&flank.x>world.minX+pad&&flank.x<world.maxX-pad&&
  flank.z>world.minZ+pad&&flank.z<world.maxZ-pad&&
  !(world.obstacles??[]).some(o=>!o.dynamic&&
    flank.x>o.minX-pad&&flank.x<o.maxX+pad&&
    flank.z>o.minZ-pad&&flank.z<o.maxZ+pad);
 const point=valid?flank:target;
 return {goal:'ENGAGE',role:'INTERCEPT',point:{...point},targetActorId:threat.id,
    reason:'INTERCEPT OBSERVED ATTACKER',note:'COVER ALLY UNDER FIRE',
    score:.90,expiresAt:now+2.4};
}
/** When nobody is seen, bias a long exposed crossing toward a real corner
 * offering a protected staging position. Never replace the final objective. */
export function cautiousApproach(world,from,to,radius=1.4,style='pressure'){
 if(!world||!from||!to||dist(from,to)<11)return null;
 const d=dist(from,to),dx=(to.x-from.x)/d,dz=(to.z-from.z)/d;
 const tolerance=style==='bruiser'?5:style==='skirmisher'?10:7;
 let best=null,score=Infinity;
 for(const o of world.obstacles??[]){
  if(o.dynamic||(o.height??o.maxY??0)<2.25)continue;
  const pad=radius+.8;
  const candidates=[
   {x:o.minX-pad,z:o.minZ-pad},{x:o.minX-pad,z:o.maxZ+pad},
   {x:o.maxX+pad,z:o.minZ-pad},{x:o.maxX+pad,z:o.maxZ+pad}
  ];
  for(const p of candidates){
   const advance=(p.x-from.x)*dx+(p.z-from.z)*dz;
   if(advance<2||advance>Math.min(d-5,15))continue;
   const lateral=Math.abs((p.x-from.x)*dz-(p.z-from.z)*dx);
   if(lateral>tolerance)continue;
   if(p.x<world.minX+pad||p.x>world.maxX-pad||
      p.z<world.minZ+pad||p.z>world.maxZ-pad)continue;
   if((world.obstacles??[]).some(q=>!q.dynamic&&
      p.x>q.minX-radius&&p.x<q.maxX+radius&&
      p.z>q.minZ-radius&&p.z<q.maxZ+radius))continue;
   // Cover must actually interrupt exposure to the destination sector.
   if(!tacticalCoverBlocker(p,to,world,1.6))continue;
   if(!tacticalLineOfSight(from,p,world))continue;
   const additional=dist(from,p)+dist(p,to)-d;
   if(additional>tolerance)continue;
   const utility=additional+.10*dist(from,p)+(tacticalLineOfSight(from,p,world)?0:1);
   if(utility<score){score=utility;best=p;}
  }
 }
 return best;
}
export function threatFacingPoint(actor,awareness){
 const state=awareness?.awareness??awareness;
 if(!state?.lastThreat||state.underFireSeconds<=.2)return null;
 return {x:state.lastThreat.x,z:state.lastThreat.z};
}

/** Two or more real impacts on a weakening serialized subsystem constitute a
 * repeat-targeting pattern; a single stray hit does not trigger panic. */
export function recordSubsystemHit(memory,slot,now){
 if(!memory||!slot)return;
 if(memory.focusSlot===slot&&now-(memory.lastSystemHitAt??-100)<3)
   memory.focusHits=(memory.focusHits??0)+1;
 else {memory.focusSlot=slot;memory.focusHits=1;}
 memory.lastSystemHitAt=now;
}
export function threatenedSubsystem(memory,condition,now){
 if(!memory||now-(memory.lastSystemHitAt??-100)>2.8||
    (memory.focusHits??0)<2)return null;
 const part=condition?.parts?.[memory.focusSlot];
 if(!part||part.destroyed)return null;
 const fraction=part.integrity/Math.max(1,part.maxIntegrity);
 return fraction<.72?{slot:memory.focusSlot,remaining:fraction,hits:memory.focusHits}:null;
}
