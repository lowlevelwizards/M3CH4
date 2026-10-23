/** k5r.6 RETURN TO BATTERY — visible service choreography for the
 * eight current guns. WeaponState.reloadLeft in combat.js stays authoritative.
 * Nothing here chambers a gameplay round, reduces a timer, or grants fire.
 */
const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(n)?n:a));
const eased=(a,b,t)=>{const x=clamp((t-a)/(b-a));return x*x*(3-2*x);};
const hold=(a,b,c,d,t)=>eased(a,b,t)*(1-eased(c,d,t));
export const RELOAD_STAGES=Object.freeze(['unlock','extract','feed','chamber','lock']);
const make=(mass,slide,feed,feedStyle,feedAxis,events)=>Object.freeze({
 mass,slide,feed,feedStyle,feedAxis,events:Object.freeze(events),
});
export const RELOAD_MECHANISMS=Object.freeze({
 'gun-cannon':make(.72,.28,.31,'tray','z',[.045,.18,.36,.66,.85]),
 'gun-short':make(1.25,.42,.40,'shell','z',[.045,.20,.42,.71,.88]),
 'gun-light':make(.40,.21,.28,'clip','z',[.035,.16,.33,.65,.83]),
 'gun-scatter':make(1.08,.32,.44,'cassette','y',[.045,.19,.40,.69,.87]),
 'gun-rivet':make(.88,.22,.47,'drum','x',[.055,.20,.43,.71,.87]),
 'gun-breaker':make(1.65,.48,.48,'penetrator','z',[.045,.22,.44,.73,.89]),
 'gun-rocket':make(1.05,.24,.50,'rack','z',[.045,.18,.42,.74,.90]),
 'gun-arc':make(.55,.23,.39,'cell','y',[.045,.16,.38,.70,.85]),
});
export function reloadMechanism(id){return RELOAD_MECHANISMS[id]??RELOAD_MECHANISMS['gun-cannon'];}
export function reloadPhase(left,total,id='gun-cannon'){
 if(!(Number.isFinite(total)&&total>0&&Number.isFinite(left)&&left>0))
   return {active:false,progress:1,stage:'ready',index:5,
     slide:0,bolt:0,cassette:0,feed:0,feedVisible:false,lock:0,
     ram:0,settle:0,mass:reloadMechanism(id).mass};
 const p=reloadMechanism(id);
 const t=clamp(1-left/total);
 let index=0;
 for(let i=0;i<p.events.length;i++)if(t>=p.events[i])index=i;
 const stage=RELOAD_STAGES[index];
 // Huge mechanisms remain physically OPEN while loading instead of
 // springing shut during the middle of the operation.
 const opening=hold(.05,.24,.77,.94,t);
 const slide=p.slide*opening;
 const bolt=.22*hold(.15,.30,.73,.93,t);
 const cassette=p.feed*hold(.19,.32,.69,.91,t);
 const feed=hold(.30,.48,.66,.81,t);
 // Feed mass advances from an open loader to the actual chamber, but never
 // magically changes a round count before combat.js completes its timer.
 const ram=hold(.58,.76,.80,.96,t);
 const lock=eased(.83,.96,t);
 const settle=hold(.78,.84,.91,.99,t)*p.mass;
 return {active:true,progress:t,stage,index,slide,bolt,cassette,
    feed,feedVisible:t>=.24&&t<.84,lock,ram,settle,mass:p.mass};
}
/** One-stage-at-a-time cue gate. Independent per gun / per AI actor.
 * A skipped render frame does not invent extra events; a new cycle resets.
 * Completion is emitted on actual reloadLeft=0, not by the animated lock.
 */
export function createReloadCueState(){return {active:false,index:-1,lastProgress:0};}
export function advanceReloadCue(state,left,total,id){
 if(!state)return null;
 const phase=reloadPhase(left,total,id);
 if(!phase.active){
   const finished=state.active&&left<=0;
   state.active=false;state.index=-1;state.lastProgress=0;
   return finished?'ready':null;
 }
 if(!state.active||phase.progress+1e-5<state.lastProgress){
   state.active=true;state.index=-1;
 }
 state.lastProgress=phase.progress;
 if(phase.index<=state.index)return null;
 state.index=phase.index;
 return phase.stage;
}
