import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const scene=fs.readFileSync(new URL('../scene.js',import.meta.url),'utf8');
const main=fs.readFileSync(new URL('../main.js',import.meta.url),'utf8');
const index=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const bridge=fs.readFileSync(new URL('../sceneAssembly.js',import.meta.url),'utf8');
test('all five physical modules source bright blue emergency particles during service',()=>{
 assert.match(scene,/record\.serviceSlot && record\.active/);
 assert.match(scene,/partWorldPoint\(record,record\.serviceSlot\)/);
 assert.match(scene,/record\.serviceSparkBudget \+= 82 \* dt/);
 assert.match(scene,/pilotServiceSparkBudget \+= 82 \* dt/);
 assert.match(scene,/0x76dfff/);
});
test('weapon fault sags only a disabled weapon; other restarts use their own physical modules',()=>{
 assert.match(scene,/record\.weaponFault=!!visual\?\.weaponFault/);
 assert.match(scene,/record\.serviceSlot=visual\?\.serviceSlot/);
 assert.match(scene,/record\.weaponRecoveryKick=1/);
 assert.match(main,/weaponServicing: actor\.fieldService\.held && actor\.fieldService\.activeSlot==='combat'/);
});
test('cockpit service status, selected subsystem and ally screening remain physically honest',()=>{
 assert.match(main,/fieldServiceTarget\(playerCondition,fieldService\)/);
 assert.match(main,/cycleFieldServiceTarget\(playerCondition,fieldService\)/);
 assert.match(main,/serviceSlot: fieldService\.held \? fieldService\.activeSlot : null/);
 assert.match(main,/serviceInterruptedByHit = fieldService\.held/);
 assert.match(main,/COVERING · HOLD POSITION FOR FIELD SERVICE/);
 assert.match(main,/ENEMY PART CONDITION UNKNOWN/);
});
test('live and test-yard Safari cache identities load latest combat and scene',()=>{
 for(const module of ['combat','fieldService','functionalDamage','aiFieldService','hostileRig','faultSupport'])
  assert.ok(index.includes(`"./${module}.js?v=k5s1"`) && index.includes(`"./${module}.js":`));
 assert.match(index,/main\.js\?v=k5s1/);
 assert.match(index,/sceneAssembly\.js\?v=k5s1/);
 assert.match(bridge,/scene\.js\?source=k5s1/);
});
