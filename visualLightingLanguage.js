/** Art-only light grammar for the scrapyard and service workshop.
 * All values tune EXISTING Three.js lights. No extra sources/shadow maps.
 * Warm fixtures reveal painted metal while restrained cool rims separate
 * silhouettes from concrete. The cockpit and real damage remain readable.
 */
export const VISUAL_LIGHTING=Object.freeze({
  arena:Object.freeze({
    ambient:.84,key:2.85,rim:1.30,
    fixtureEmission:2.25,fixtureIntensity:21.0,
    shadowSize:512,
    ambientSky:0xb9c5b3,ambientGround:0x353024,
    background:0x20241f,
  }),
  workshop:Object.freeze({
    ambient:1.02,key:2.06,rim:1.42,fill:.91,
    fixtureEmission:1.75,fixtureIntensity:9.2,
    shadowSize:256,
    ambientSky:0xb1c5b7,ambientGround:0x393228,
  }),
});
export function lightingProfile(stage){
  return VISUAL_LIGHTING[stage]||VISUAL_LIGHTING.arena;
}
