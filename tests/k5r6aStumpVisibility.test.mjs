import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {WEAPONS,createWeaponState,startReload,advanceWeapon,fireWeapon} from '../combat.js';
import {reloadPhase,reloadCockpitPresentation} from '../reloadMechanism.js';
const src=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const near=(a,b,e=1e-9)=>Math.abs(a-b)<e;
test('Stump loading assembly is exposed in the cockpit, not behind the right edge',()=>{
 const id='gun-short',seconds=WEAPONS[id].reloadSeconds;
 const start=reloadCockpitPresentation(reloadPhase(seconds,seconds,id),id);
 const mid=reloadCockpitPresentation(reloadPhase(seconds*.50,seconds,id),id);
 const ending=reloadCockpitPresentation(reloadPhase(0,seconds,id),id);
 assert.ok(mid.x<-.40);
 assert.ok(mid.z<-.50);
 assert.ok(mid.yaw<-.10);
 // Reference physical housing: ordinary pilot x1.16, z=-.62; the
 // shell sits at local x0, z+.18. Inboard pivot yields direct view.
 const beforeSlope=Math.abs((1.16+0)/(-.62+.18));
 const duringSlope=Math.abs((1.16+mid.x)/(-.62+mid.z+.18));
 assert.ok(beforeSlope>2.5);
 assert.ok(duringSlope<.9);
 for(const v of Object.values(start))assert.ok(near(v,0));
 for(const v of Object.values(ending))assert.ok(near(v,0));
});
test('loading view smoothly returns home before firing can resume',()=>{
 const w=WEAPONS['gun-short'],s=createWeaponState(w);
 s.loaded=0;
 assert.equal(startReload(s,w),true);
 let maximum=0;
 for(let i=0;i<210;i++){
   const pose=reloadCockpitPresentation(reloadPhase(s.reloadLeft,w.reloadSeconds,w.id),w.id);
   maximum=Math.max(maximum,Math.abs(pose.x));
   if(s.reloadLeft>.001){
     assert.equal(fireWeapon(s,w),null,'no shot before actual reload complete');
   }
   advanceWeapon(s,w,.01);
 }
 assert.ok(maximum>.40);
 const end=reloadCockpitPresentation(reloadPhase(s.reloadLeft,w.reloadSeconds,w.id),w.id);
 assert.ok(near(end.x,0));assert.ok(near(end.z,0));
 assert.ok(s.loaded>0);assert.equal(s.reloadLeft,0);
});
test('other weapons keep exactly their current visual geometry and aim pose',()=>{
 for(const id of Object.keys(WEAPONS)){
  if(id==='gun-short')continue;
  const pose=reloadCockpitPresentation(reloadPhase(WEAPONS[id].reloadSeconds*.5,WEAPONS[id].reloadSeconds,id),id);
  assert.deepEqual(pose,{x:0,y:0,z:0,yaw:0,tilt:0});
 }
});
test('Stump animation uses a top-loading shell and a large mechanical locking gate',()=>{
 const kit=src('weaponVisualKit.js'),scene=src('scene.js');
 assert.match(kit,/stump\?\[0,\.55,\.18\]/);
 assert.match(kit,/stump\?\[0,\.73,\.05\]/);
 assert.match(kit,/RELOAD \/ oversized shell collar/);
 assert.match(kit,/loader\.stump\?-.90:-.42/);
 assert.match(scene,/reloadCockpitPresentation\(reload,pilotWeaponPresentation\.id\)/);
 assert.match(scene,/gunPivot\.position\.x=1\.16\+gunDamageKick\*damageWave\*\.045\+reloadView\.x/);
});
