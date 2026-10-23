/** Three physically grounded local-light palettes for the early circuit.
 * The scene reuses its existing hemisphere/key/rim/floodlights and shadow maps.
 * Fog conveys dirt, damp runoff or grain dust without emitting particles.
 * There are no lighting-driven gameplay or AI-visibility exceptions.
 */
export const MAP_ATMOSPHERE=Object.freeze({
 'backlot-dustbowl':Object.freeze({
  background:0x27231d,fog:0x51432f,fogDensity:.0098,
  hemisphereSky:0xbaa991,hemisphereGround:0x453729,
  sunlight:0xffc38d,rim:0x7ca39b,fixture:0xffb565,
  keyMultiplier:1,rimMultiplier:.91,
  mood:'dust / warm worklights',
 }),
 'culvert-nine':Object.freeze({
  background:0x1b272b,fog:0x344548,fogDensity:.0085,
  hemisphereSky:0x9dafab,hemisphereGround:0x263b38,
  sunlight:0xd0c5a6,rim:0x75a5ac,fixture:0xffc074,
  keyMultiplier:.91,rimMultiplier:1.12,
  mood:'cold concrete / sodium service light',
 }),
 grainhouse:Object.freeze({
  background:0x27251b,fog:0x4b4230,fogDensity:.012,
  hemisphereSky:0xb3a88e,hemisphereGround:0x393528,
  sunlight:0xffd39d,rim:0x719287,fixture:0xffaa60,
  keyMultiplier:.83,rimMultiplier:.96,
  mood:'dust motes / abandoned co-op',
 }),
});
export function atmosphereForMap(map){
 const key=typeof map==='string'?map:map?.id;
 const profile=MAP_ATMOSPHERE[key];
 if(!profile)throw Error('Unknown physical arena atmosphere '+key);
 return profile;
}
