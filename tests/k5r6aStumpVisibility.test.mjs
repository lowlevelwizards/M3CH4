import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {WEAPONS,createWeaponState,startReload,advanceWeapon,fireWeapon} from '../combat.js';
import {reloadPhase,reloadCockpitPresentation,reloadVisualLayout,RELOAD_VISUAL_LAYOUTS} from '../reloadMechanism.js';
const src=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const near=(a,b,e=1e-8)=>Math.abs(a-b)<e;
const aspect=844/390,verticalTan=Math.tan(68*Math.PI/360);
function projectedLoader(id,progress){
 const weapon=WEAPONS[id],phase=reloadPhase(weapon.reloadSeconds*(1-progress),weapon.reloadSeconds,id);
 const view=reloadCockpitPresentation(phase,id),layout=reloadVisualLayout(id);
 const yaw=view.yaw;
 const px=layout.feed[0]*Math.cos(yaw)+layout.feed[2]*Math.sin(yaw);
 const pz=-layout.feed[0]*Math.sin(yaw)+layout.feed[2]*Math.cos(yaw);
 const x=1.16+view.x+px,z=-.62+view.z+pz;
 const y=2.04+view.y+layout.feed[1];
 return {x,y,z,screenX:(1+x/(-z*verticalTan*aspect))/2,
   screenY:(1-(y-2.42)/(-z*verticalTan))/2};
}
test('all eight unique service bays are authored above their machinery, inboard toward the cockpit',()=>{
 const ids=Object.keys(WEAPONS);
 assert.equal(Object.keys(RELOAD_VISUAL_LAYOUTS).length,ids.length);
 assert.equal(new Set(ids.map(id=>reloadVisualLayout(id).step)).size,ids.length);
 for(const id of ids){
  const layout=reloadVisualLayout(id);
  assert.ok(layout.feed[1]>=.30&&layout.feed[1]<=.70,id);
  assert.ok(layout.feed[0]<=.01&&layout.feed[0]>=-.28,id);
  assert.ok(layout.latch[1]>=layout.feed[1],id+' hatch must be above ammunition');
  assert.ok(layout.lidAngle<=-.50,id+' hatch opens visibly');
  assert.ok(layout.camera[0]<=-.29&&layout.camera[2]<=-.39,id+' moves service side in view');
 }
});
test('ALL eight actual loading bays land inside landscape iPhone viewport, not behind breech',()=>{
 for(const id of Object.keys(WEAPONS)){
  const mid=projectedLoader(id,.51),early=projectedLoader(id,.36);
  // Approximate optical center from the actual cockpit camera (0,2.42,0).
  // These gates are generously inside the 844x390 iPhone landscape frame,
  // on the right and away from the center aiming reticle.
  for(const p of [mid,early]){
   assert.ok(p.z<-.60,id+' loader behind eye: '+JSON.stringify(p));
   assert.ok(p.screenX>.60&&p.screenX<.94,id+' loader off horizontal frame '+JSON.stringify(p));
   assert.ok(p.screenY>.12&&p.screenY<.92,id+' loader off vertical frame '+JSON.stringify(p));
  }
 }
});
test('every weapon has visible reload choreography, staged movement and exact home pose',()=>{
 for(const [id,w] of Object.entries(WEAPONS)){
  const start=reloadCockpitPresentation(reloadPhase(w.reloadSeconds,w.reloadSeconds,id),id);
  const middle=reloadCockpitPresentation(reloadPhase(w.reloadSeconds*.5,w.reloadSeconds,id),id);
  const ending=reloadCockpitPresentation(reloadPhase(0,w.reloadSeconds,id),id);
  for(const value of Object.values(start))assert.ok(near(value,0),id+' start not at rest');
  for(const value of Object.values(ending))assert.ok(near(value,0),id+' ready not at rest');
  assert.ok(middle.x<-.29&&middle.z<-.39,id+' loading port remains offscreen');
  assert.ok(middle.yaw<-.07,id+' loading action lacks silhouette');
  const physical=reloadPhase(w.reloadSeconds*.5,w.reloadSeconds,id);
  assert.equal(physical.feedVisible,true,id);
  assert.ok(physical.slide>.19,id);
 }
});
test('Stump loading is unmistakably larger without changing its real 2.1 second reload',()=>{
 const id='gun-short',seconds=WEAPONS[id].reloadSeconds;
 const mid=reloadCockpitPresentation(reloadPhase(seconds*.5,seconds,id),id);
 assert.ok(mid.x<-.46&&mid.z<-.58);
 assert.ok(projectedLoader(id,.5).screenX>.65);
 const s=createWeaponState(WEAPONS[id]);s.loaded=0;
 assert.equal(startReload(s,WEAPONS[id]),true);
 let max=0;
 for(let i=0;i<211;i++){
  const v=reloadCockpitPresentation(reloadPhase(s.reloadLeft,seconds,id),id);
  max=Math.max(max,Math.abs(v.x));
  if(s.reloadLeft>.001)assert.equal(fireWeapon(s,WEAPONS[id]),null);
  advanceWeapon(s,WEAPONS[id],.01);
 }
 advanceWeapon(s,WEAPONS[id],.02);
 assert.ok(max>.45);
 const home=reloadCockpitPresentation(reloadPhase(s.reloadLeft,seconds,id),id);
 assert.ok(near(home.x,0)&&near(home.z,0));
 assert.ok(s.loaded>0&&s.reloadLeft===0);
});
test('cockpit and exterior weapon builders use the same animated physical hardware',()=>{
 const kit=src('weaponVisualKit.js'),scene=src('scene.js');
 assert.match(kit,/reloadVisualLayout\(id\)/);
 assert.match(kit,/layout\.feed/);assert.match(kit,/layout\.latch/);
 assert.match(kit,/RELOAD \/ oversized shell collar/);
 assert.match(kit,/feed\.visible=!!phase\?\.feedVisible/);
 assert.match(scene,/poseReloadHardware\(mechanism,reload\)/);
 assert.match(scene,/poseReloadHardware\(activeKit\.userData\.reloadMechanism,reload\)/);
 assert.match(scene,/reloadCockpitPresentation\(reload,pilotWeaponPresentation\.id\)/);
});
