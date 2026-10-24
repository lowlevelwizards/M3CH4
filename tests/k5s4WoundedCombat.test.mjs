import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {WEAPONS,createWeaponState,startReload,advanceWeapon,fireWeapon,reloadDuration} from '../combat.js';
import {weaponDamageResponse,electricalDistress,frameDistress} from '../woundResponse.js';
import {weaponCycleMultiplier,weaponSpreadMultiplier} from '../functionalDamage.js';
import {hostileOutput} from '../hostileRig.js';
import {cockpitFailurePresentation} from '../cockpitProfiles.js';
import {reloadPhase,RELOAD_STAGES,createReloadCueState,advanceReloadCue} from '../reloadMechanism.js';
const src=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const condition=health=>({parts:Object.fromEntries(['structure','mobility','power','command','combat']
  .map(k=>[k,{integrity:k==='combat'?health*100:100,maxIntegrity:100}]))});
test('real weapon deterioration smoothly and deterministically worsens every measured rate',()=>{
  let prev=weaponDamageResponse(1);
  assert.equal(prev.cycleMultiplier,1);
  assert.equal(prev.reloadMultiplier,1);
  assert.equal(prev.spreadMultiplier,1);
  for(const health of [.75,.5,.25,0]){
    const next=weaponDamageResponse(health);
    assert.ok(next.cycleMultiplier>prev.cycleMultiplier);
    assert.ok(next.reloadMultiplier>prev.reloadMultiplier);
    assert.ok(next.spreadMultiplier>prev.spreadMultiplier);
    assert.ok(next.actionRate<prev.actionRate);
    assert.ok(next.cycleMultiplier<2);
    assert.ok(next.reloadMultiplier<2.5);
    assert.ok(next.spreadMultiplier<2.5);
    assert.deepEqual(next,weaponDamageResponse(health));
    assert.equal(weaponCycleMultiplier({weapon:health}),next.cycleMultiplier);
    assert.equal(weaponSpreadMultiplier({weapon:health}),next.spreadMultiplier);
    prev=next;
  }
});
test('worn live gun takes longer to load, with the same visible mechanism phases, across all eight weapons',()=>{
  const slow=weaponDamageResponse(.15,.78).reloadMultiplier;
  for(const gun of Object.values(WEAPONS)){
    const fresh=createWeaponState(gun),worn=createWeaponState(gun);
    fresh.loaded=0;worn.loaded=0;
    assert.equal(startReload(fresh,gun),true,gun.id);
    assert.equal(startReload(worn,gun,slow),true,gun.id);
    assert.equal(reloadDuration(fresh,gun),gun.reloadSeconds);
    assert.ok(reloadDuration(worn,gun)>gun.reloadSeconds,gun.id);
    assert.equal(startReload(worn,gun,slow),false,'one reload at a time');
    advanceWeapon(fresh,gun,gun.reloadSeconds+.001);
    advanceWeapon(worn,gun,gun.reloadSeconds+.001);
    assert.equal(fresh.loaded,gun.magazine,gun.id);
    assert.equal(worn.loaded,0,gun.id+' early ammo injection');
    assert.equal(fireWeapon(worn,gun),null,gun.id+' premature shot');
    const cues=createReloadCueState(),observed=[];
    for(let i=0;i<=240;i++){
      const left=reloadDuration(worn,gun)*(1-i/241);
      const phase=reloadPhase(left,reloadDuration(worn,gun),gun.id);
      assert.ok(phase.progress>=0&&phase.progress<=1);
      const cue=advanceReloadCue(cues,left,reloadDuration(worn,gun),gun.id);
      if(cue)observed.push(cue);
    }
    assert.deepEqual(observed,RELOAD_STAGES,gun.id);
    advanceWeapon(worn,gun,reloadDuration(worn,gun));
    assert.equal(worn.loaded,gun.magazine,gun.id);
    assert.equal(worn.reserve,Infinity,gun.id);
  }
});
test('pilot and AI compute wounds from same health, not privileged accuracy or magic jams',()=>{
  for(const health of [1,.7,.4,.1]){
    const ai=hostileOutput(condition(health),{spreadScale:1});
    const shared=weaponDamageResponse(health);
    assert.ok(Math.abs(ai.spreadRadians-.010*shared.spreadMultiplier)<1e-9);
  }
  const main=src('main.js');
  assert.match(main,/actor\.weaponState\.cooldown \*= weaponDamageResponse\(actorOutput\.weapon/);
  assert.match(main,/weaponState\.cooldown \*= weaponDamageResponse\(weaponIntegrityRatio\(playerCondition\)/);
  assert.match(main,/startReload\(actor\.weaponState, actor\.weaponSpec,/);
  assert.match(main,/function startPlayerReload/);
  assert.match(main,/reloadDuration\(actor\.weaponState,actor\.weaponSpec\)/);
  assert.match(main,/reloadDuration\(weaponState,weaponSpec\)/);
  assert.doesNotMatch(main,/actor\.weaponState\.cooldown \*= 1\+/);
});
test('bus voltage affects physical operability and legible cockpit distress without inventing energy',()=>{
  const normal=electricalDistress(1,1),sag=electricalDistress(.68,.45);
  assert.equal(normal.dim,0);
  assert.ok(sag.dim>normal.dim);
  assert.ok(sag.dim<=.48);
  assert.ok(sag.loadStrain>.4);
  assert.ok(weaponDamageResponse(.5,.68).reloadMultiplier>weaponDamageResponse(.5,1).reloadMultiplier);
  assert.ok(cockpitFailurePresentation(.3,.45,.68).powerDim>0);
  assert.equal(cockpitFailurePresentation(1,1,1).diagnosticsAvailable,true);
});
test('damaged frames respond to actual actuator load rather than passive screen noise',()=>{
  assert.equal(frameDistress(1,1).sag,0);
  assert.equal(frameDistress(.1,0).creak,0);
  assert.ok(frameDistress(.1,1).sag>frameDistress(.1,0).sag);
  assert.ok(frameDistress(.1,1).creak>.8);
});
test('glass stays fractured through an emergency restart and live sound events are throttled',()=>{
  const scene=src('scene.js'),main=src('main.js');
  assert.match(scene,/worstCabPercent = inspecting \? commandPercent : Math\.min\(worstCabPercent,commandPercent\)/);
  assert.match(scene,/powerDistress=electricalDistress\(persistentBusRatio,persistentPowerHealth\)/);
  assert.match(scene,/frameWound=frameDistress\(serviceVisual\?\.frameHealth/);
  assert.match(main,/const woundedAcoustics=new WeakMap\(\)/);
  assert.match(main,/if\(!local&&distance>12\)return/);
  assert.match(main,/playServiceRestart\(slot\)/);
  assert.match(main,/emitWoundedHardwareSounds\(actor\.rig,actor\.condition/);
});

test('wounded AI conserves actual generator draw and waits for visible mount settling',()=>{
  const main=src('main.js');
  assert.match(main,/const canConserve=!!target&&actorOutput\.power<\.7/);
  assert.match(main,/actor\.powerSystem\.busRatio<\.90/);
  assert.match(main,/\['WITHDRAW','CAPTURE','CONTEST','SEARCH'\]/);
  assert.match(main,/actor\.stabilizer\.settled>\.32\+\.32\*weaponDamageResponse\(actorOutput\.weapon\)\.mountStress/);
  assert.match(main,/Math\.hypot\(target\.rig\.x-actor\.rig\.x,/);
});
