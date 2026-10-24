/** k5r.6 RETURN TO BATTERY — visible service choreography for the
 * eight current guns. WeaponState.reloadLeft in combat.js stays authoritative.
 * Nothing here chambers a gameplay round, reduces a timer, or grants fire.
 */
const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,Number.isFinite(n)?n:a));
const eased=(a,b,t)=>{const x=clamp((t-a)/(b-a));return x*x*(3-2*x);};
const hold=(a,b,c,d,t)=>eased(a,b,t)*(1-eased(c,d,t));
// One mechanical choreography, six distinct operating states. Every action
// is powered by the weapon itself. A round never appears from off-machine.
export const RELOAD_STAGES=Object.freeze([
 'unlock','extract','feed','chamber','lock','charge',
]);
const make=(mass,slide,feed,feedStyle,feedAxis,events,archetype,source)=>Object.freeze({
 mass,slide,feed,feedStyle,feedAxis,events:Object.freeze(events),
 archetype,source,
});
/** Machine-integrated source for every weapon. The part that indexes is
 * physically joined to the receiver or an original captive magazine; it is
 * never hand-inserted, floated across space, or rebuilt at runtime.
 */
export const RELOAD_MECHANISMS=Object.freeze({
 'gun-cannon':make(.72,.28,.26,'tray','z',[.045,.18,.37,.65,.82,.92],
   'breech','rear receiver reserve hopper > powered feed tray'),
 'gun-short':make(1.25,.42,.30,'shell','z',[.045,.20,.38,.67,.83,.92],
   'breech','rear shell reservoir > captured steel ram cradle'),
 'gun-light':make(.40,.21,.18,'clip','z',[.035,.17,.38,.65,.82,.92],
   'index','internal box magazine > reciprocating bolt'),
 'gun-scatter':make(1.08,.32,.21,'cassette','y',[.045,.19,.40,.68,.84,.93],
   'index','captive side cassette > powered shell index'),
 'gun-rivet':make(.88,.22,.20,'drum','x',[.055,.20,.39,.68,.84,.93],
   'index','fixed drum axle > pawl-driven belt feed'),
 'gun-breaker':make(1.65,.48,.32,'penetrator','z',[.045,.22,.41,.69,.85,.94],
   'breech','rear demolition-charge reservoir > hydraulic ram'),
 'gun-rocket':make(1.05,.24,.29,'rack','z',[.045,.18,.40,.70,.85,.94],
   'pod','captive rear three-round ordnance carrier > launcher tubes'),
 'gun-arc':make(.55,.23,.16,'cell','y',[.045,.16,.39,.65,.82,.91],
   'capacitor','fixed transformer bus > captive capacitor cell'),
});
export function reloadMechanism(id){return RELOAD_MECHANISMS[id]??RELOAD_MECHANISMS['gun-cannon'];}
export function reloadPhase(left,total,id='gun-cannon'){
 const p=reloadMechanism(id);
 const idle={active:false,progress:1,stage:'ready',index:6,
   slide:0,bolt:0,cassette:0,feed:0,feedVisible:false,lock:0,ram:0,
   settle:0,mass:p.mass,open:0,clear:0,indexMotion:0,close:0,
   charge:0,rack:0,feedTravel:0,archetype:p.archetype};
 if(!(Number.isFinite(total)&&total>0&&Number.isFinite(left)&&left>0))
   return idle;
 const t=clamp(1-left/total);
 let index=0;
 for(let i=0;i<p.events.length;i++)if(t>=p.events[i])index=i;
 const stage=RELOAD_STAGES[index];
 // Unlock, open, eject through a gravity/return chute, and hold open until
 // the ONBOARD feed has indexed its next round.
 const open=eased(.06,.23,t)*(1-eased(.73,.87,t));
 const clear=hold(.18,.27,.33,.47,t);
 // Feed returns to its housed position BEFORE the breech can close.
 const indexMotion=hold(.33,.49,.59,.72,t);
 const close=eased(.75,.88,t);
 // A visible powered return-stroke *after* the bolt is back in battery.
 const charge=hold(.88,.917,.952,.998,t);
 const feedTravel=p.feed*indexMotion;
 const rack=.13*charge;
 const slide=p.slide*open;
 const bolt=.18*open+.16*charge;
 const cassette=p.feed*indexMotion;
 const ram=hold(.50,.61,.68,.75,t);
 const lock=close;
 const settle=(hold(.83,.89,.90,.96,t)+hold(.947,.97,.975,1,t)*.5)*p.mass;
 // A retained shell is visible only through the OPEN chamber; captive
 // drum/cassette/rack/cell remains attached and visible throughout.
 const feedVisible=p.archetype==='index'||p.archetype==='pod'||
   p.archetype==='capacitor'||(t>=.18&&t<.84);
 return {active:true,progress:t,stage,index,slide,bolt,cassette,feed:indexMotion,
    feedVisible,lock,ram,settle,mass:p.mass,open,clear,indexMotion,close,
    charge,rack,feedTravel,archetype:p.archetype};
}
/** k5r.7 — Subtractive, physically integrated reload actions.
 * One service port per gun, placed directly on its EXISTING rear receiver,
 * not another detached miniature machine above it. Side-fed Scatter and
 * Rivet exterior rigs ALREADY have real mounted magazines: reuse those.
 *
 * feed is the center of the receiver opening (meters, gun-local).
 * camera draws the *whole original gun* slightly inboard, never past the
 * crosshair; the original muzzle/aim pose is restored before firing resumes.
 * travel is bounded by the carrier's own receiver overlap.
 */
const view=(feed,camera,step,travel,exposed=false)=>Object.freeze({
 feed:Object.freeze(feed),camera:Object.freeze(camera),step,travel,exposed,
});
export const RELOAD_VISUAL_LAYOUTS=Object.freeze({
 'gun-cannon':view([-.02,.255,.22],[-.30,-.12,-.36,-.075,-.015],'single shell tray',.18),
 'gun-short':view([0,.325,.205],[-.40,-.08,-.43,-.09,.025],'heavy breech shell',.21),
 'gun-light':view([-.025,.21,.18],[-.28,-.13,-.37,-.065,-.01],'fine sliding bolt',.12),
 'gun-scatter':view([-.25,.24,.14],[-.32,-.14,-.35,-.07,.025],'integral side cassette',.14,true),
 'gun-rivet':view([-.25,.205,.20],[-.29,-.16,-.36,-.07,-.015],'integral rotary drum',.14,true),
 'gun-breaker':view([0,.38,.28],[-.38,-.055,-.42,-.085,.035],'enormous penetrator',.21),
 'gun-rocket':view([0,.275,.32],[-.36,-.12,-.39,-.08,.02],'single ordnance carrier',.18),
 'gun-arc':view([-.08,.295,.34],[-.34,-.11,-.38,-.075,-.01],'plug-in power cell',.15,true),
});
export function reloadVisualLayout(id){
 return RELOAD_VISUAL_LAYOUTS[id]??RELOAD_VISUAL_LAYOUTS['gun-cannon'];
}

/** Moves only the physical cockpit gun during a genuine reload. Nonzero
 * presentation lives in the lower-right cockpit region; the crosshair and
 * enemy view stay clear. The interpolation reaches EXACT rest with the
 * canonical authoritative timer; aim and shooting are unchanged at ready.
 */
export function reloadCockpitPresentation(phase,id){
 if(!phase?.active)return {x:0,y:0,z:0,yaw:0,tilt:0};
 const layout=reloadVisualLayout(id);
 const [shiftX,shiftY,shiftZ,yaw,tilt]=layout.camera;
 const t=phase.progress;
 const display=hold(.025,.17,.79,.985,t);
 const action=hold(.055,.18,.72,.95,t);
 const lockImpact=hold(.84,.88,.92,.985,t);
 return {
   x:shiftX*display,
   y:shiftY*display +.013*lockImpact,
   z:shiftZ*display,
   yaw:yaw*display,
   tilt:tilt*action-.018*lockImpact,
 };
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
