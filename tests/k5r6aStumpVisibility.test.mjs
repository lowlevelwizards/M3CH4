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
test('eight distinct receiver ports are physically IN the authored gun, not floating above it',()=>{
 const ids=Object.keys(WEAPONS);
 assert.equal(Object.keys(RELOAD_VISUAL_LAYOUTS).length,ids.length);
 assert.equal(new Set(ids.map(id=>reloadVisualLayout(id).step)).size,ids.length);
 for(const id of ids){
  const l=reloadVisualLayout(id);
  assert.ok(l.feed[1]>=.19&&l.feed[1]<=.40,id+' open port above chassis');
  assert.ok(l.feed[0]<=0&&l.feed[0]>=-.28,id+' mounted on receiver');
  assert.ok(l.feed[2]>=.12&&l.feed[2]<=.42,id+' behind barrel, in breech');
  assert.ok(l.travel>=.10&&l.travel<=.22,id+' short stroke stays in port');
  assert.ok(l.camera[0]<=-.27&&l.camera[0]>=-.42,id);
  assert.ok(l.camera[2]<=-.33&&l.camera[2]>=-.46,id);
 }
});
test('ALL eight receiver-mounted reloads remain visible at landscape iPhone aspect',()=>{
 for(const id of Object.keys(WEAPONS)){
  const mid=projectedLoader(id,.51),early=projectedLoader(id,.36);
  for(const p of [mid,early]){
   assert.ok(p.z<-.60,id+' receiver behind eye: '+JSON.stringify(p));
   assert.ok(p.screenX>.58&&p.screenX<.95,id+' receiver offscreen '+JSON.stringify(p));
   assert.ok(p.screenY>.12&&p.screenY<.93,id+' receiver offscreen '+JSON.stringify(p));
  }
 }
});
test('every weapon uses one short deliberate action with exact home pose',()=>{
 for(const [id,w] of Object.entries(WEAPONS)){
  const start=reloadCockpitPresentation(reloadPhase(w.reloadSeconds,w.reloadSeconds,id),id);
  const middle=reloadCockpitPresentation(reloadPhase(w.reloadSeconds*.5,w.reloadSeconds,id),id);
  const ending=reloadCockpitPresentation(reloadPhase(0,w.reloadSeconds,id),id);
  for(const value of Object.values(start))assert.ok(near(value,0),id+' start not at rest');
  for(const value of Object.values(ending))assert.ok(near(value,0),id+' ready not at rest');
  assert.ok(middle.x<-.26&&middle.z<-.31,id+' receiver remains at screen edge');
  const physical=reloadPhase(w.reloadSeconds*.5,w.reloadSeconds,id);
  assert.ok(physical.feedVisible&&physical.slide>.15,id);
 }
});
test('Stump moves one enormous shell while retaining the original 2.1 second lockout',()=>{
 const id='gun-short',seconds=WEAPONS[id].reloadSeconds;
 const mid=reloadCockpitPresentation(reloadPhase(seconds*.5,seconds,id),id);
 assert.ok(mid.x<-.37&&mid.z<-.40);
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
 assert.ok(max>.37);
 const home=reloadCockpitPresentation(reloadPhase(s.reloadLeft,seconds,id),id);
 assert.ok(near(home.x,0)&&near(home.z,0));
 assert.ok(s.loaded>0&&s.reloadLeft===0);
});
test('subtractive geometry uses existing breech and real magazines, not detachable add-on clutter',()=>{
 const kit=src('weaponVisualKit.js'),scene=src('scene.js');
 assert.match(kit,/const loader=cassette\?null:attachReloadHardware/);
 assert.match(kit,/poseExistingReloadMagazine/);
 assert.match(kit,/RELOAD \/ receiver socket/);
 assert.ok(!kit.includes('RELOAD / withdrawn'));
 assert.ok(!kit.includes('RELOAD / battery locking jaw'));
 assert.ok(!kit.includes('RELOAD / fixed ammunition feed track'));
 assert.ok(!scene.includes('scatterGreebles.add(cassette)'));
 assert.ok(!scene.includes('scatterGreebles.add(rib)'));
 assert.match(scene,/poseExistingReloadMagazine\(mechanism,reload,weaponId\)/);
 assert.match(scene,/poseReloadHardware\(activeKit\.userData\.reloadMechanism,reload\)/);
 assert.match(scene,/reloadCockpitPresentation\(reload,pilotWeaponPresentation\.id\)/);
});
