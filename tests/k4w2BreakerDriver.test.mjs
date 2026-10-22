import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {CATALOG,makeTestAssembly,equip,inspectAssembly} from '../components.js';
import {WEAPONS,createWeaponState,advanceWeapon,fireWeapon,startReload} from '../combat.js';
import {advanceChargedTrigger} from '../weaponController.js';
import {resolvePenetratingContacts} from '../weaponPenetration.js';
const source=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const spec=WEAPONS['gun-breaker'];
test('Breaker is appended after serialized RR-4, remains absent from starter and fits U1',()=>{
 assert.equal(CATALOG[16].id,'gun-rivet');
 assert.equal(CATALOG[17].id,'gun-breaker');
 const rig=makeTestAssembly();equip(rig,'combat','gun-breaker');
 assert.equal(inspectAssembly(rig).ready,true);
});
test('0.7 second pressure charge, early release, exactly one bullet and required rearm',()=>{
 const state=createWeaponState(spec);
 for(let n=0;n<30;n++){advanceWeapon(state,spec,1/60);assert.equal(advanceChargedTrigger(state,spec,true,1/60),false);}
 assert.equal(fireWeapon(state,spec),null,'cannot fire during partial charge');
 advanceChargedTrigger(state,spec,false,1/60);
 assert.equal(state.action.charge,0);
 for(let n=0;n<43;n++){advanceWeapon(state,spec,1/60);advanceChargedTrigger(state,spec,true,1/60);}
 assert.equal(fireWeapon(state,spec),1);
 assert.equal(state.loaded,0);
 assert.equal(advanceChargedTrigger(state,spec,true,4),false,'held input cannot double fire');
 assert.equal(fireWeapon(state,spec),null);
 assert.equal(startReload(state,spec),true);
 advanceWeapon(state,spec,4);
 assert.equal(advanceChargedTrigger(state,spec,true,1),false,'must release before a second shot');
 advanceChargedTrigger(state,spec,false,1/60);
 assert.equal(advanceChargedTrigger(state,spec,true,1/60),false);
});
test('penetration follows physically ordered contacts, shields cut residual energy, hard cover stops',()=>{
 const a={actorId:'enemy-0',slot:'structure'};
 const b={actorId:'enemy-0',slot:'power'};
 const c={actorId:'enemy-0',slot:'command'};
 const fresh=resolvePenetratingContacts([a,a,b,c],{armorAt:t=>t.slot==='structure'?120:0});
 assert.equal(fresh.length,2,'frame consumes enough energy to stop before third layer');
 assert.equal(fresh[0].contact,a);
 assert.equal(fresh[1].contact,b);
 assert.ok(fresh[1].damage<fresh[0].damage);
 const covered=resolvePenetratingContacts([{blockedBy:'crate',slot:null},a,b]);
 assert.deepEqual(covered,[]);
 assert.deepEqual(resolvePenetratingContacts([a,{slot:null},b]).map(x=>x.contact),[a]);
 assert.deepEqual(resolvePenetratingContacts([a,a]),resolvePenetratingContacts([a]));
});
test('player and AI share geometric multi-layer shot authority and authentic attached visuals',()=>{
 const scene=source('scene.js'),main=source('main.js');
 assert.match(scene,/penetrationContacts/);
 assert.match(main,/resolvePenetratingContacts/);
 assert.match(main,/advanceChargedTrigger/);
 assert.match(source('partVisuals.js'),/'gun-breaker': buildBreakerDriverVisual/);
 assert.match(source('breakerDriverVisual.js'),/finishWeapon\(r,\{carriage,bolt\}\)/);
});
