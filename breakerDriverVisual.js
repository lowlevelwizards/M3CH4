/** Breaker Driver: huge single-bore demolition ram and open return piston. */
import {weaponRoot,group,block,tube,bearing,strut,finishWeapon} from './weaponVisualKit.js';
export function buildBreakerDriverVisual(fixture) {
 const r=weaponRoot(fixture,'hydraulic-demolition-ram');
 block(r,'BD / mustard giant squared pressure receiver',[0,.04,.15],[.62,.59,.67],'yellow');
 block(r,'BD / olive rear hydraulic accumulator',[0,.10,.50],[.58,.50,.32],'olive');
 tube(r,'BD / stout metal penetrator barrel',[0,-.11,-.76],.22,.87,'heat');
 tube(r,'BD / raw-steel muzzle reinforcing ring',[0,-.11,-1.24],.255,.15,'raw');
 tube(r,'BD / pitch-black bore',[0,-.11,-1.322],.188,.008,'dark');
 block(r,'BD / upper service rail',[0,.39,-.34],[.43,.14,.72],'steel');
 for(const x of [-.3,.3]) {
   tube(r,'BD / side hydraulic pressure shaft '+x,[x,-.31,-.63],.095,.90,'machined');
   tube(r,'BD / rear piston seal '+x,[x,-.31,-.24],.14,.20,'steel');
 }
 bearing(r,'BD / giant trunnion',[-.40,-.20,.26],.32,.21,'steel');
 strut(r,'BD / welded lower cradle',[-.35,-.30,-.2],[-.35,-.52,.3],.15,.11,'steel');
 block(r,'BD / hardpoint foot',[-.35,-.55,.22],[.35,.08,.40],'steel');
 const carriage=group(r,'BD / hydraulic sliding breech',[0,.46,.30]);
 const bolt=group(carriage,'BD / enormous steel breech block');
 block(bolt,'BD / reciprocating breech',[0,0,0],[.54,.25,.39],'machined');
 block(carriage,'BD / piston track',[0,-.12,-.02],[.53,.11,.53],'steel');
 return finishWeapon(r,{carriage,bolt});
}
