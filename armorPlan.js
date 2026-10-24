/** k5t3 – DEV-only physical armor packages, not yet live module durability.
 * Bare production cores remain unchanged. Each added panel has its own identity,
 * installed tier, region, mass, and prototype hit/repair state.
 */
export const ARMOR_PROTOTYPES=Object.freeze({
  'cab-cyclops':Object.freeze({
    label:'CYCLOPS / PILOT CELL',slot:'command',baseline:1,
    plates:Object.freeze([
      {id:'cyclops-left-cheek',label:'LEFT FLANK SHIELD',tier:1,region:'left-front',massKg:18,hp:70},
      {id:'cyclops-right-cheek',label:'RIGHT FLANK SHIELD',tier:1,region:'right-front',massKg:18,hp:70},
      {id:'cyclops-brow',label:'SLANTED OPTIC BROW',tier:2,region:'front-high',massKg:27,hp:104},
      {id:'cyclops-chin',label:'LOWER BLAST LIP',tier:2,region:'front-low',massKg:24,hp:100},
      {id:'cyclops-rear',label:'REAR ARMOR CASSETTE',tier:3,region:'rear',massKg:38,hp:115},
      {id:'cyclops-left-wrap',label:'LEFT WRAPAROUND SHOULDER',tier:3,region:'left-side',massKg:29,hp:110},
      {id:'cyclops-right-wrap',label:'RIGHT WRAPAROUND SHOULDER',tier:3,region:'right-side',massKg:29,hp:110},
      {id:'cyclops-crown',label:'THICK UPPER ROOF CAP',tier:3,region:'top',massKg:32,hp:118},
    ]),
  }),
  'legs-compact':Object.freeze({
    label:'KESTREL / OPEN RUNNER',slot:'mobility',baseline:0,
    plates:Object.freeze([
      {id:'kestrel-left-shin',label:'LEFT SHIN GREAVE',tier:1,region:'front-left',massKg:14,hp:72},
      {id:'kestrel-right-shin',label:'RIGHT SHIN GREAVE',tier:1,region:'front-right',massKg:14,hp:72},
      {id:'kestrel-left-knee',label:'LEFT KNEE SHIELD',tier:2,region:'joint-left',massKg:13,hp:75},
      {id:'kestrel-right-knee',label:'RIGHT KNEE SHIELD',tier:2,region:'joint-right',massKg:13,hp:75},
      {id:'kestrel-left-thigh',label:'LEFT FRONT THIGH',tier:2,region:'front-left',massKg:18,hp:90},
      {id:'kestrel-right-thigh',label:'RIGHT FRONT THIGH',tier:2,region:'front-right',massKg:18,hp:90},
      {id:'kestrel-left-flank',label:'LEFT OUTER THIGH',tier:3,region:'outer-left',massKg:18,hp:92},
      {id:'kestrel-right-flank',label:'RIGHT OUTER THIGH',tier:3,region:'outer-right',massKg:18,hp:92},
      {id:'kestrel-left-ankle',label:'LEFT HOCK SHELL',tier:3,region:'joint-left',massKg:10,hp:62},
      {id:'kestrel-right-ankle',label:'RIGHT HOCK SHELL',tier:3,region:'joint-right',massKg:10,hp:62},
      {id:'kestrel-left-boot',label:'LEFT BOOT CAP',tier:3,region:'foot-left',massKg:12,hp:70},
      {id:'kestrel-right-boot',label:'RIGHT BOOT CAP',tier:3,region:'foot-right',massKg:12,hp:70},
    ]),
  }),
});
const clamp=v=>Math.max(0,Math.min(1,Number.isFinite(v)?v:0));
export const clampArmorTier=t=>Math.max(0,Math.min(3,Math.floor(Number.isFinite(t)?t:0)));
export function installedArmorPlates(partId,tier){
  const p=ARMOR_PROTOTYPES[partId];
  return p?p.plates.filter(plate=>plate.tier<=clampArmorTier(tier)):[];
}
export function armorMassKg(partId,tier){
  return installedArmorPlates(partId,tier).reduce((sum,p)=>sum+p.massKg,0);
}
export function armorHit(health,damage,maximum){
  return clamp(clamp(health)-(Math.max(0,Number(damage)||0)/Math.max(1,maximum)));
}
export function armorCrewPatch(health,workers=1){
  return Math.min(.5,clamp(health)+Math.max(0,Math.floor(workers))*.25);
}
export function armorCrewCanPatch(health){return clamp(health)<.5;}
