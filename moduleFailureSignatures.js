/** Grounded failure language for the five actual physical modules.
 * These are visual consequences of authoritative integrity/destroyed state,
 * NEVER an extra gameplay failure roll or imaginary leak/spark.
 */
const rules=Object.freeze({
 structure:Object.freeze({exposure:'painted-panel',factor:.59,effect:'buckled plate / stressed frame'}),
 mobility:Object.freeze({exposure:'joint',factor:.46,effect:'unpowered hydraulic linkage'}),
 power:Object.freeze({exposure:'hot-mechanism',factor:.38,effect:'dead radiator / no running light'}),
 command:Object.freeze({exposure:'optical',factor:.12,effect:'dark optical carrier'}),
 combat:Object.freeze({exposure:'hot-mechanism',factor:.41,effect:'jammed muzzle / seized breech'}),
});
export function moduleFailureSignature(slot,part){
 const rule=rules[slot];
 if(!rule||!part)return null;
 const maximum=Number(part.maxIntegrity)||0;
 const remaining=Number(part.integrity);
 const fraction=maximum>0&&Number.isFinite(remaining)?
   Math.max(0,Math.min(1,remaining/maximum)):1;
 const destroyed=!!part.destroyed;
 const disabled=destroyed||fraction<=0;
 const stressed=!disabled&&fraction<.35;
 return Object.freeze({
   slot,disabled,destroyed,stressed,
   exposure:rule.exposure,
   effect:disabled?rule.effect:stressed?'heavy visible mechanical wear':'operational',
   surfaceFactor:disabled?rule.factor:stressed?.84:1,
   lightEnabled:!disabled,
 });
}
export function failureSurfaceFactor(signal,surface={}){
 if(!signal||signal.surfaceFactor===1)return 1;
 const exposure=surface.exposure||'';
 const role=surface.role||'';
 const name=surface.name||'';
 const matches=exposure===signal.exposure||
   (signal.slot==='command'&&(/optic|lens|glass|viewport/.test(name)||role==='optical'))||
   (signal.slot==='power'&&/radiator|vent|heat|generator/.test(name))||
   (signal.slot==='combat'&&/barrel|muzzle|breech/.test(name))||
   (signal.slot==='mobility'&&/actuator|piston|bearing|hub/.test(name))||
   (signal.slot==='structure'&&/protective-paint|structure/.test(role));
 return matches?signal.surfaceFactor:1;
}
