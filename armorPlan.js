/** k5t1 DEV armor prototype: authored plate identities, not a replacement for live module HP.
 * Named mounts are stable across rebuilds. Installation is symmetrical by tier,
 * damage may be asymmetric, and pit labor restores only installed, intact plates.
 */
export const ARMOR_PROTOTYPES = Object.freeze({
  'cab-cyclops': Object.freeze({
    label:'CYCLOPS / PILOT CELL', slot:'command', baseline:1,
    plates:Object.freeze([
      {id:'cyclops-left-cheek',label:'LEFT CHEEK',tier:1,region:'left-front',massKg:18,hp:70},
      {id:'cyclops-right-cheek',label:'RIGHT CHEEK',tier:1,region:'right-front',massKg:18,hp:70},
      {id:'cyclops-brow',label:'OPTIC BROW',tier:2,region:'front-high',massKg:20,hp:88},
      {id:'cyclops-chin',label:'LOWER SILL',tier:2,region:'front-low',massKg:15,hp:82},
      {id:'cyclops-rear',label:'REAR ELECTRONICS SHIELD',tier:3,region:'rear',massKg:29,hp:95},
    ]),
  }),
  'legs-compact': Object.freeze({
    label:'KESTREL / OPEN RUNNER',slot:'mobility',baseline:0,
    plates:Object.freeze([
      {id:'kestrel-left-shin',label:'LEFT SHIN GREAVE',tier:1,region:'front-left',massKg:14,hp:72},
      {id:'kestrel-right-shin',label:'RIGHT SHIN GREAVE',tier:1,region:'front-right',massKg:14,hp:72},
      {id:'kestrel-left-knee',label:'LEFT KNEE CAP',tier:2,region:'joint-left',massKg:9,hp:58},
      {id:'kestrel-right-knee',label:'RIGHT KNEE CAP',tier:2,region:'joint-right',massKg:9,hp:58},
      {id:'kestrel-left-thigh',label:'LEFT OUTER THIGH GUARD',tier:3,region:'outer-left',massKg:16,hp:82},
      {id:'kestrel-right-thigh',label:'RIGHT OUTER THIGH GUARD',tier:3,region:'outer-right',massKg:16,hp:82},
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
