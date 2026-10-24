/** Close-contact electric demolition tool: industrial electrodes, cooling fins, cables. */
import {weaponRoot,group,block,tube,bearing,strut,finishWeapon} from './weaponVisualKit.js';
export function buildArcCutterVisual(fixture) {
 const r=weaponRoot(fixture,'electric-contact-cutter');
 block(r,'AC / robust yellow dielectric transformer cover',[0,.01,.18],[.62,.47,.60],'yellow');
 block(r,'AC / rear teal converter',[0,.04,.47],[.54,.43,.32],'teal');
 block(r,'AC / raw copper-like cutter spindle',[0,-.07,-.51],[.29,.27,.66],'heat');
 block(r,'AC / twin black ceramic electrode guard',[0,-.06,-.86],[.48,.33,.31],'dark');
 for(const x of [-.16,.16]){
   tube(r,'AC / exposed cutting electrode '+x,[x,-.07,-1.15],.055,.52,'machined');
   tube(r,'AC / insulated feed line '+x,[x,.23,-.12],.070,.61,'dark');
 }
 for(let i=0;i<6;i++)
   block(r,'AC / open heat sink fin '+i,[0,.34,.29-i*.12],[.53,.085,.05],'raw');
 block(r,'AC / cable reinforced underside',[.24,-.31,.18],[.15,.15,.64],'steel');
 bearing(r,'AC / left drive bearing',[-.38,-.18,.22],.24,.15,'steel');
 strut(r,'AC / load cradle',[-.32,-.22,-.24],[-.32,-.43,.25],.12,.11,'steel');
 block(r,'AC / U1 mount',[-.31,-.45,.27],[.30,.07,.36],'steel');
 const carriage=group(r,'AC / sliding electrode assembly',[0,.46,-.14]);
 const bolt=group(carriage,'AC / insulated feed actuator');
 block(bolt,'AC / electrode ratchet',[0,0,0],[.42,.16,.29],'machined');
 block(carriage,'AC / guide hood',[0,-.08,-.025],[.40,.08,.39],'steel');
 return finishWeapon(r,{carriage,bolt});
}
