import test from 'node:test';import assert from 'node:assert/strict';
import {WEAPONS,createWeaponState,startReload,advanceWeapon} from '../combat.js';
import {RELOAD_MECHANISMS,RELOAD_STAGES,reloadPhase,createReloadCueState,advanceReloadCue} from '../reloadMechanism.js';
test('every authored gun has distinct feed travel/type and real timer remains unchanged',()=>{
 assert.equal(Object.keys(RELOAD_MECHANISMS).length,Object.keys(WEAPONS).length);
 const types=new Set(),travel=new Set();
 for(const [id,weapon] of Object.entries(WEAPONS)){
   const recipe=RELOAD_MECHANISMS[id];types.add(recipe.feedStyle);travel.add(recipe.slide);
   assert.equal(recipe.events.length,6);
   assert.ok(recipe.source.includes('>'),id+' needs physically mounted ammunition/power origin');
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

test('every machine opens, clears, indexes ONBOARD supply, closes then racks after lock',()=>{
 for(const [id,w] of Object.entries(WEAPONS)){
  const p=t=>reloadPhase(w.reloadSeconds*(1-t),w.reloadSeconds,id);
  const opening=p(.25),clearing=p(.32),feeding=p(.56),closed=p(.88),
        charging=p(.938),idle=p(1);
  assert.ok(opening.open>.85,id+' must physically open');
  assert.ok(clearing.clear>0,id+' requires powered ejection/clearance');
  assert.ok(feeding.indexMotion>.7,id+' must index from onboard reserve');
  assert.ok(feeding.open>.9,id+' cannot feed against closed breech');
  assert.ok(closed.close>.9,id+' must re-lock');
  assert.ok(closed.open<.1,id+' cover must be shut before rack');
  assert.ok(charging.charge>.1,id+' must rack AFTER closed');
  assert.equal(idle.charge,0,id+' must settle to rest');
  assert.equal(idle.open,0,id+' no open gun at ready');
  assert.equal(idle.indexMotion,0,id+' no phantom feed at ready');
 }
});
test('reloading is always autonomous rather than magical detachable replacement',()=>{
 const expected={
 'gun-cannon':['breech','rear receiver reserve hopper'],
 'gun-short':['breech','rear shell reservoir'],
 'gun-light':['index','internal box magazine'],
 'gun-scatter':['index','captive side cassette'],
 'gun-rivet':['index','fixed drum axle'],
 'gun-breaker':['breech','rear demolition-charge reservoir'],
 'gun-rocket':['pod','captive rear three-round ordnance carrier'],
 'gun-arc':['capacitor','fixed transformer bus'],
 };
 for(const [id,[type,origin]] of Object.entries(expected)){
  const p=RELOAD_MECHANISMS[id];
  assert.equal(p.archetype,type);
  assert.ok(p.source.startsWith(origin),id);
 }
});
