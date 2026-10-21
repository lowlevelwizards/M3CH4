/** S-6 scattergun: broad octagonal cream choke and visible red shell cassette.
 * One mouth; six gameplay pellets remain six rays from the same weapon origin.
 */
import {weaponRoot,group,block,tube,taper,bearing,strut,finishWeapon} from './weaponVisualKit.js';
export function buildScattergunVisual(fixture){
  const r=weaponRoot(fixture,'salvaged-single-choke-scatter');
  block(r,'S6 / squat yellow workshop breech',[0,.025,.02],[.58,.44,.53],'yellow');
  block(r,'S6 / teal rear machinery block',[0,.08,.31],[.51,.35,.34],'teal');
  tube(r,'S6 / large front pressure chamber',[0,-.045,-.43],.265,.47,'heat');
  tube(r,'S6 / choke rear coupling collar',[0,-.045,-.66],.290,.12,'raw');
  taper(r,'S6 / huge cream eight-sided flared choke',[0,-.045,-.88],.22,.405,.48,'cream');
  tube(r,'S6 / dark recessed single bore',[0,-.045,-1.117],.320,.012,'dark');
  block(r,'S6 / stepped upper slide chassis',[0,.305,.115],[.37,.115,.64],'steel');
  block(r,'S6 / upper teal action enclosure',[0,.39,.22],[.40,.15,.29],'heat');
  block(r,'S6 / workshop handle top span',[-.05,.51,.135],[.38,.09,.10],'steel');
  block(r,'S6 / handle forward upright',[-.05,.448,-.018],[.105,.18,.095],'steel');
  block(r,'S6 / handle rear upright',[-.05,.448,.29],[.105,.18,.095],'steel');
  bearing(r,'S6 / left side heavy trunnion',[-.34,-.19,.20],.240,.16,'steel');
  strut(r,'S6 / short load cradle',[-.24,-.16,-.12],[-.24,-.39,.19],.11,.13,'steel');
  block(r,'S6 / underbody hard mounting shoe',[-.24,-.408,.18],[.30,.075,.30],'steel');
  // The two visibly stacked cylinders are the cassette silhouette, not two barrels.
  const cassette=group(r,'S6 / movable side cassette',[.367,-.17,.07]);
  block(cassette,'S6 / cassette backing plate',[.08,-.04,0],[.12,.39,.52],'steel');
  for(const y of [.075,-.15])
    tube(cassette,'S6 / horizontal red industrial shell '+y,[.055,y,-.04],.105,.46,'shells');
  block(cassette,'S6 / front cassette retention bar',[.072,-.04,-.28],[.155,.34,.075],'steel');
  const carriage=group(r,'S6 / heavy exposed operating slide',[0,.31,.39]);
  const bolt=group(carriage,'S6 / cycling steel block');
  block(bolt,'S6 / reciprocating action block',[0,0,0],[.30,.12,.23],'machined');
  block(carriage,'S6 / top track',[0,-.085,-.03],[.35,.075,.36],'steel');
  return finishWeapon(r,{carriage,bolt,cassette});
}
