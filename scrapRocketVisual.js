/** Three mismatched welded launch tubes, scratched shield and external wire chase. */
import {weaponRoot,group,block,tube,bearing,strut,finishWeapon} from './weaponVisualKit.js';
export function buildScrapRocketVisual(fixture) {
 const r=weaponRoot(fixture,'salvaged-triple-exhaust-rack');
 block(r,'SR / mustard welded cradle',[0,-.12,.23],[.61,.30,.65],'yellow');
 block(r,'SR / heat-stained aft cowling',[0,.12,.39],[.52,.30,.29],'heat');
 for(const [i,x,y,rad] of [[0,-.25,.15,.165],[1,.25,.15,.165],[2,0,-.13,.19]]) {
  tube(r,'SR / launch tube '+i,[x,y,-.52],rad,.98,i===2?'raw':'olive');
  tube(r,'SR / deep open muzzle '+i,[x,y,-1.03],rad*.78,.012,'dark');
  tube(r,'SR / bolted lip ring '+i,[x,y,-1.01],rad*1.10,.064,'steel');
  block(r,'SR / fire-wire channel '+i,[x+.10,y+.14,-.34],[.05,.06,.72],'teal');
 }
 block(r,'SR / upper steel blast partition',[0,.36,-.45],[.57,.09,.91],'steel');
 block(r,'SR / rear tube mount',[0,-.30,.34],[.44,.21,.47],'warmSteel');
 bearing(r,'SR / offset trunnion',[-.39,-.18,.24],.22,.14);
 strut(r,'SR / cradle front',[-.37,-.21,-.18],[-.37,-.46,.28],.10,.10,'steel');
 block(r,'SR / U1 shoe',[-.37,-.48,.26],[.32,.075,.34],'steel');
 const carriage=group(r,'SR / pressure-trigger housing',[0,.46,.23]);
 const bolt=group(carriage,'SR / firing ratchet');
 block(bolt,'SR / electrical trigger arm',[0,0,0],[.41,.15,.34],'machined');
 block(carriage,'SR / insulated guide',[0,-.09,-.05],[.36,.08,.45],'dark');
 return finishWeapon(r,{carriage,bolt});
}
