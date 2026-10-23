/** Physical body response driven by actual movement state, NOT gameplay.
 * No collision displacement, speed modification, IK re-authoring or timers.
 * This is a small critically damped presentation filter for an industrial
 * chassis with mass that settles against planted feet and recoils under load.
 */
const BODY=Object.freeze({
 'legs-yard':Object.freeze({drop:.042,strike:.018,pitch:.022,roll:.020,response:7.5}),
 'legs-compact':Object.freeze({drop:.028,strike:.011,pitch:.030,roll:.032,response:10}),
 'legs-hauler':Object.freeze({drop:.070,strike:.032,pitch:.014,roll:.013,response:4.6}),
});
const clamp=(n,min,max)=>Math.max(min,Math.min(max,Number.isFinite(n)?n:0));
export function physicalContactWeight(family,state={},previous=null,dt=1/60){
 const f=BODY[family]||BODY['legs-yard'];
 const step=clamp(dt,0,.12);
 const follow=1-Math.exp(-f.response*step);
 const motion=clamp(state.gaitWeight,0,1);
 // Strike peaks twice per full gait cycle: each opposing leg contacts once.
 const contactWave=Math.pow(Math.max(0,Math.cos((state.phase||0)*2)),8);
 const load=clamp(state.footingLoad,0,1);
 const brake=clamp(state.brace,0,1);
 const recoil=clamp(state.recoilLoad,0,1);
 const acceleration=clamp(state.longitudinalAcceleration,-8,8);
 const side=clamp(state.lateralAcceleration,-8,8);
 const targetDrop=clamp(f.drop*(load*.68+brake*.63+recoil*.36)+
   f.strike*contactWave*motion,0,.12);
 const targetPitch=clamp(-acceleration*.003*f.pitch/.022+
   recoil*.35*f.pitch,-.08,.08);
 const targetRoll=clamp(-side*.0028*f.roll/.020,-.055,.055);
 const last=previous||{drop:0,pitch:0,roll:0};
 return Object.freeze({
  drop:last.drop+(targetDrop-last.drop)*follow,
  pitch:last.pitch+(targetPitch-last.pitch)*follow,
  roll:last.roll+(targetRoll-last.roll)*follow,
  plantedContact:contactWave*motion,
 });
}
