/** Training cannon: squared test-machine receiver, box brake and recoil tube. */
import {weaponRoot,group,block,tube,bearing,strut,finishWeapon} from './weaponVisualKit.js';
export function buildTrainingCannonVisual(fixture){
  const r=weaponRoot(fixture,'balanced-industrial-cannon');
  block(r,'TC / rear teal instrument case',[0,.035,.26],[.53,.40,.45],'teal');
  block(r,'TC / boxed mustard main receiver',[0,.005,-.15],[.51,.41,.45],'yellow');
  block(r,'TC / guarded forward barrel beam',[0,-.055,-.74],[.27,.25,.85],'yellow');
  tube(r,'TC / exposed straight pressure barrel',[0,-.05,-1.19],.098,.62,'machined');
  tube(r,'TC / forward barrel collar',[0,-.05,-1.03],.143,.13,'heat');
  block(r,'TC / distinctive rectangular two-port brake',[0,-.05,-1.48],[.36,.25,.20],'steel');
  for(const x of [-.087,.087])
    block(r,'TC / dark brake opening '+x,[x,-.05,-1.583],[.125,.150,.009],'dark');
  tube(r,'TC / separate underslung recoil cylinder',[0,-.257,-.94],.060,.79,'machined');
  tube(r,'TC / recoil cylinder rear pressure seal',[0,-.257,-.54],.097,.22,'steel');
  block(r,'TC / underbarrel joining saddle',[0,-.19,-1.12],[.23,.13,.15],'warmSteel');
  bearing(r,'TC / left trunnion',[-.294,-.135,.16],.225,.14);
  bearing(r,'TC / trunnion outer face',[-.372,-.135,.16],.145,.025,'machined');
  strut(r,'TC / forward yoke plate',[-.20,-.19,-.10],[-.20,-.39,.16],.10,.12,'steel');
  strut(r,'TC / rear yoke plate',[-.20,-.19,.36],[-.20,-.39,.16],.10,.12,'steel');
  block(r,'TC / lower structural mount foot',[-.20,-.393,.16],[.24,.065,.30],'steel');
  const carriage=group(r,'TC / operating carriage',[0,.28,.25]);
  const bolt=group(carriage,'TC / reciprocating bolt');
  block(bolt,'TC / sliding steel service block',[0,0,0],[.35,.17,.32],'machined');
  block(carriage,'TC / guide housing',[0,-.08,-.06],[.29,.075,.38],'steel');
  return finishWeapon(r,{carriage,bolt});
}
