/** Stump cannon: huge axial yellow ram and heavyweight A-frame. */
import {weaponRoot,group,block,tube,bearing,strut,finishWeapon} from './weaponVisualKit.js';
export function buildStumpCannonVisual(fixture){
  const r=weaponRoot(fixture,'compact-heavy-breech');
  block(r,'SC / teal rear machinery case',[0,.01,.025],[.57,.50,.54],'teal');
  block(r,'SC / rear yellow service cap',[0,.015,.36],[.50,.43,.20],'heat');
  tube(r,'SC / eight-sided giant mustard breech',[0,.005,-.50],.327,.55,'yellow');
  tube(r,'SC / rear breech reinforcing collar',[0,.005,-.255],.332,.075,'steel');
  tube(r,'SC / front reinforcing band',[0,.005,-.77],.323,.095,'heat');
  tube(r,'SC / deep circular front steel muzzle',[0,.005,-.922],.285,.20,'heat');
  tube(r,'SC / large dark hollow bore inset',[0,.005,-1.029],.220,.010,'dark');
  bearing(r,'SC / high load left trunnion',[-.338,-.13,-.10],.257,.22,'steel');
  bearing(r,'SC / trunnion machined hub',[-.465,-.13,-.10],.155,.025,'machined');
  strut(r,'SC / A-frame forward thick leg',[-.24,-.12,-.53],[-.24,-.39,.05],.155,.18,'raw');
  strut(r,'SC / A-frame rear thick leg',[-.24,-.13,.36],[-.24,-.39,.05],.155,.18,'machined');
  block(r,'SC / bottom yoke shoe',[-.24,-.402,.05],[.28,.075,.42],'steel');
  bearing(r,'SC / heavy lifting-eye lug',[0,.365,-.38],.095,.11,'steel');
  tube(r,'SC / top lifting eye dark center',[0,.366,-.38],.040,.118,'dark');
  const carriage=group(r,'SC / short heavy reciprocating action',[0,.30,.24]);
  const bolt=group(carriage,'SC / rear breech slider');
  block(bolt,'SC / sliding machined block',[0,0,0],[.47,.22,.34],'machined');
  block(carriage,'SC / action channel',[0,-.11,-.05],[.48,.11,.41],'steel');
  return finishWeapon(r,{carriage,bolt});
}
