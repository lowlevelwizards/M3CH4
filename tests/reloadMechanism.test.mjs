import test from 'node:test';import assert from 'node:assert/strict';
import {WEAPONS,createWeaponState,startReload,advanceWeapon} from '../combat.js';
import {RELOAD_MECHANISMS,RELOAD_STAGES,reloadPhase,createReloadCueState,advanceReloadCue} from '../reloadMechanism.js';
test('every authored gun has distinct feed travel/type and real timer remains unchanged',()=>{
 assert.equal(Object.keys(RELOAD_MECHANISMS).length,Object.keys(WEAPONS).length);
 const types=new Set(),travel=new Set();
 for(const [id,weapon] of Object.entries(WEAPONS)){
   const recipe=RELOAD_MECHANISMS[id];types.add(recipe.feedStyle);travel.add(recipe.slide);
   assert.equal(recipe.events.length,5);
   assert.equal(reloadPhase(weapon.reloadSeconds,weapon.reloadSeconds,id).stage,'unlock');
   assert.equal(reloadPhase(0,weapon.reloadSeconds,id).stage,'ready');
   const state=createWeaponState(weapon);state.loaded=0;const reserve=state.reserve;
   assert.ok(startReload(state,weapon));let chamberObserved=false;
   for(let i=0;i<120;i++){
     const pose=reloadPhase(state.reloadLeft,weapon.reloadSeconds,id);
     if(pose.stage==='chamber'){chamberObserved=true;assert.equal(state.loaded,0);}
     advanceWeapon(state,weapon,weapon.reloadSeconds/120);
   }
   advanceWeapon(state,weapon,.01);
   assert.ok(chamberObserved,id);assert.ok(state.loaded>0,id);
   assert.ok(state.reserve<reserve,id);assert.equal(state.reloadLeft,0,id);
 }
 assert.ok(types.size>=6);assert.ok(travel.size>=6);
});
test('stages strictly progress, mechanisms are bounded and settle to exact home pose',()=>{
 for(const id of Object.keys(RELOAD_MECHANISMS)){
   let previous=0;
   for(let i=0;i<100;i++){
     const p=reloadPhase(3*(1-i/100),3,id);
     assert.ok(p.index>=previous);previous=p.index;
     assert.ok(p.slide>=0&&p.slide<=.5);
     assert.ok(p.bolt>=0&&p.bolt<=.23);
     assert.ok(p.feed>=0&&p.feed<=1);
   }
   const home=reloadPhase(0,3,id);
   assert.equal(home.feedVisible,false);
   assert.equal(home.slide,0);assert.equal(home.lock,0);
 }
});
test('mechanical sound cues fire exactly once each, only ready when actual timer finishes',()=>{
 const state=createReloadCueState(),id='gun-short',total=2.1,events=[];
 assert.equal(advanceReloadCue(state,0,total,id),null);
 for(let i=0;i<=105;i++){
   const remaining=total*(1-i/106);
   const cue=advanceReloadCue(state,remaining,total,id);
   if(cue)events.push(cue);
 }
 assert.deepEqual(events,RELOAD_STAGES);
 assert.equal(advanceReloadCue(state,.005,total,id),null);
 assert.equal(advanceReloadCue(state,0,total,id),'ready');
 assert.equal(advanceReloadCue(state,0,total,id),null);
 assert.equal(advanceReloadCue(state,total,total,id),'unlock');
});
test('the visible chamber cannot alter weapon ammunition during its animation',()=>{
 const w=WEAPONS['gun-breaker'];const s=createWeaponState(w);s.loaded=0;startReload(s,w);
 const original=s.reserve;
 for(let i=0;i<30;i++){advanceWeapon(s,w,.075);
   reloadPhase(s.reloadLeft,w.reloadSeconds,w.id);
   assert.equal(s.loaded,0);assert.equal(s.reserve,original);
 }
});
