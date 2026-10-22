import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {CATALOG,makeTestAssembly,equip,inspectAssembly} from '../components.js';
import {WEAPONS,createWeaponState,advanceWeapon,fireWeapon} from '../combat.js';
import {rocketFlightStep} from '../projectileSimulation.js';
import {blastDamage} from '../explosionResolution.js';
import {advanceProjectileTrigger} from '../weaponController.js';
const source=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('Scrap Rocket Rack is new U1 serial, not a starter part and not a hitscan weapon',()=>{
  assert.equal(CATALOG[18].id,'gun-rocket');const a=makeTestAssembly();
  equip(a,'combat','gun-rocket');assert.equal(inspectAssembly(a).ready,true);
  assert.equal(WEAPONS['gun-rocket'].fireMode,'projectile');
});
test('one press launches one finite rocket; release resets and actual cooldown still governs fire',()=>{
 const s=createWeaponState(WEAPONS['gun-rocket']),w=WEAPONS['gun-rocket'];
 assert.equal(advanceProjectileTrigger(s,w,true),true);
 assert.equal(fireWeapon(s,w),1);
 assert.equal(advanceProjectileTrigger(s,w,true),false);
 advanceWeapon(s,w,1.4);
 assert.equal(advanceProjectileTrigger(s,w,true),false);
 advanceProjectileTrigger(s,w,false);
 assert.equal(advanceProjectileTrigger(s,w,true),true);
 assert.equal(fireWeapon(s,w),2);
 assert.equal(s.loaded,1);
});
test('fixed-step rocket sweep cannot tunnel a 0.5m wall when traveling 32m/s',()=>{
 const p={position:{x:0,y:1,z:0},direction:{x:0,y:0,z:-1},speed:32,life:4};
 let frames=0,collision=false;
 while(!collision&&frames<120){const step=rocketFlightStep(p,1/60);p.position=step.end;p.life=step.lifeAfter;frames++;
  collision=step.start.z>=-8&&step.end.z<=-8;
 }
 assert.equal(collision,true);assert.ok(frames<=16);
 assert.deepEqual(rocketFlightStep({position:{x:1,y:2,z:3},direction:{x:1,y:0,z:0},speed:32,life:0},1/60),null);
});
test('real blast falloff is bounded, no damage outside radius',()=>{
 assert.equal(blastDamage(0,3.5,90),90);
 assert.ok(blastDamage(1,3.5,90)>blastDamage(3,3.5,90));
 assert.equal(blastDamage(3.5,3.5,90),0);
 assert.equal(blastDamage(8,3.5,90),0);
});
test('rocket movement and physical blast contacts are scene authoritative',()=>{
 const scene=source('scene.js'),main=source('main.js');
 for(const id of ['launchRocket','advanceRockets','blastContacts'])assert.match(scene,new RegExp(id));
 assert.match(main,/arena\.advanceRockets\(FIXED_DT\)/);
 assert.match(main,/arena\.launchRocket\(/);
 assert.match(source('partVisuals.js'),/'gun-rocket': buildScrapRocketVisual/);
});
