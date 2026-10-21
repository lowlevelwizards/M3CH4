/** Needle cannon: open truss, skinny exposed barrel and small rangefinder. */
import {weaponRoot,group,block,tube,bearing,strut,finishWeapon} from './weaponVisualKit.js';
export function buildNeedleCannonVisual(fixture){
  const r=weaponRoot(fixture,'open-precision-truss');
  block(r,'NC / small teal equipment receiver',[0,.035,.20],[.39,.30,.42],'teal');
  block(r,'NC / yellow forward receiver',[0,.01,-.17],[.30,.27,.31],'teal');
  block(r,'NC / slender mustard support rail',[0,-.032,-.73],[.135,.14,.91],'yellow');
  tube(r,'NC / extraordinarily narrow free barrel',[0,-.05,-1.49],.047,1.30,'machined');
  tube(r,'NC / minimal muzzle sleeve',[0,-.05,-2.118],.087,.083,'heat');
  tube(r,'NC / black bore mouth',[0,-.05,-2.164],.039,.009,'dark');
  tube(r,'NC / barrel-to-rail coupling',[0,-.05,-1.12],.080,.10,'steel');
  strut(r,'NC / main open long underbrace',[0,-.155,-1.16],[0,-.30,-.03],.065,.065,'steel');
  strut(r,'NC / triangular rear stabilizer',[0,-.30,-.03],[0,-.15,-.71],.065,.068,'steel');
  bearing(r,'NC / small truss base pivot',[-.178,-.245,.10],.136,.14,'steel');
  block(r,'NC / light narrow mounting keel',[-.18,-.325,.12],[.20,.085,.28],'steel');
  block(r,'NC / rangefinder teal instrument head',[0,.276,-.56],[.265,.17,.29],'teal');
  block(r,'NC / rangefinder short upright',[0,.164,-.46],[.095,.14,.10],'steel');
  tube(r,'NC / tiny finder forward lens',[0,.277,-.728],.056,.050,'dark');
  const carriage=group(r,'NC / fine rear operating slide',[0,.225,.16]);
  const bolt=group(carriage,'NC / fine bolt');
  block(bolt,'NC / thin sliding breech',[0,0,0],[.15,.07,.19],'machined');
  return finishWeapon(r,{carriage,bolt});
}
