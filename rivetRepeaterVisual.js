/** RR-4 rivet repeater: offset steel belt drum and side-access feed.
 * Industrial scrap tool silhouette, not a scaled copy of the range cannons.
 * All hit meshes and finishes share the gameplay/garage authored assembly.
 */
import {weaponRoot,group,block,tube,bearing,strut,finishWeapon} from './weaponVisualKit.js';
export function buildRivetRepeaterVisual(fixture) {
  const r=weaponRoot(fixture,'rattling-belt-fed-fastener');
  block(r,'RR / mustard square receiver',[0,.025,-.10],[.59,.40,.55],'yellow');
  block(r,'RR / separate battered rear drive',[0,.075,.35],[.52,.36,.42],'teal');
  block(r,'RR / gearbox raised guard',[0,.31,.18],[.46,.12,.30],'steel');
  tube(r,'RR / thick jacket barrel',[0,-.055,-.78],.155,.95,'heat');
  tube(r,'RR / open dark muzzle',[0,-.055,-1.27],.16,.045,'dark');
  tube(r,'RR / front barrel rim',[0,-.055,-1.245],.205,.09,'raw');
  tube(r,'RR / sleeve radiator ring 1',[0,-.055,-.80],.183,.055,'machined');
  tube(r,'RR / sleeve radiator ring 2',[0,-.055,-1.02],.183,.055,'machined');
  block(r,'RR / top carrying brace',[0,.41,-.19],[.44,.09,.57],'steel');
  block(r,'RR / loading channel',[.33,.07,-.07],[.16,.18,.57],'dark');
  const cassette=group(r,'RR / removable belt and side drum',[.425,-.13,.23]);
  bearing(cassette,'RR / heavy circular stamped drum',[.09,0,0],.29,.19,'olive');
  bearing(cassette,'RR / drum machined hub',[.21,0,0],.105,.05,'machined');
  for(const z of [-.24,-.12,0,.12]) {
    block(cassette,'RR / exposed rivet belt station '+z,[-.02,.10,z],[.12,.075,.085],'raw');
  }
  block(r,'RR / lower ejection chute',[.02,-.29,.02],[.38,.12,.29],'warmSteel');
  bearing(r,'RR / mount trunnion',[-.36,-.17,.20],.255,.16,'steel');
  strut(r,'RR / front cradle',[-.26,-.19,-.22],[-.26,-.4,.16],.13,.10,'steel');
  block(r,'RR / lower hardpoint',[-.26,-.425,.16],[.34,.08,.31],'steel');
  const carriage=group(r,'RR / moving belt-feed carriage',[0,.33,.20]);
  const bolt=group(carriage,'RR / short ratcheting pawl');
  block(bolt,'RR / rapid cycling steel bolt',[0,0,0],[.22,.12,.22],'machined');
  block(carriage,'RR / guide rails',[0,-.09,-.025],[.35,.08,.43],'steel');
  return finishWeapon(r,{carriage,bolt,cassette});
}
