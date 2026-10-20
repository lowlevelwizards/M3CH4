/** k3w11: worker-side synthesis. No WebAudio nodes or DOM in this thread.
 * Precompute only sounds used in actual combat. Transfer raw PCM rather than
 * generating thousands of trig / exp samples inside an active physics frame.
 */
import {renderSystemSound} from './audioSystemsSynth.js?v=k3w11';
import {renderPressureForgePCM} from './audioPressureForgeSynth.js?v=k3w6';
import {LIVE_WEAPON_RECIPES} from './liveWeaponAudio.js?v=k3w11';
const rate=24000;
const tasks=[
  ...Object.keys(LIVE_WEAPON_RECIPES).map(id=>['weapon',id,0]),
  ['system','glance',0],['system','glance',1],['system','glance',2],
  ['system','armor',2],['system','part',2],
  ['system','destruction',0],['system','destruction',1],['system','destruction',2],
  ['system','sparks',2],['system','zap',1],['system','recharge',1],
  ['system','engine',0],
  ...['yardwalker','kestrel','hauler','hydraulics'].flatMap(id=>[0,1,2].map(v=>['system',id,v])),
];
for(const [family,id,variant] of tasks){
  try {
    const pcm=family==='weapon'
      ?renderPressureForgePCM(id,LIVE_WEAPON_RECIPES[id],rate,'full')
      :renderSystemSound(id,variant,rate);
    self.postMessage({family,id,variant,rate,pcm},[pcm.buffer]);
  }catch(error){
    self.postMessage({family,id,variant,error:String(error)});
  }
}
self.postMessage({ready:true,count:tasks.length});
