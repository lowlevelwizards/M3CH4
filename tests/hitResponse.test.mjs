import test from 'node:test';
import assert from 'node:assert/strict';
import {createHitResponse,injectHitResponse,advanceHitResponse,HIT_REACTION_LIMITS,hitMaterialLanguage} from '../hitResponse.js';
const hit=(state,overrides={})=>injectHitResponse(state,{impulseNs:2550,massKg:2300,directionX:1,directionZ:0,pointY:2.1,armorAbsorbed:20,...overrides});
test('direction and mount matter, including mirrored incoming fire',()=>{
 const left=hit(createHitResponse()),right=hit(createHitResponse(),{directionX:-1});
 assert.ok(left.vRoll>0&&right.vRoll<0);
 assert.equal(Math.abs(left.vRoll),Math.abs(right.vRoll));
 assert.ok(hit(createHitResponse(),{slot:'combat'}).vMount>left.vMount);
});
test('light unbraced rigs react more than braced heavy rigs',()=>{
 const light=hit(createHitResponse(),{massKg:1500}),heavy=hit(createHitResponse(),{massKg:4000,brace:1});
 assert.ok(light.vRoll>heavy.vRoll*3);
});
test('no thermal kick and no invented ballistic consequences',()=>{
 const state=createHitResponse();injectHitResponse(state,{impulseNs:0,internalDamage:22});
 assert.equal(state.vPitch,0);assert.equal(state.vRoll,0);
});
test('even severe rapid hits stay bounded and settle without an endless oscillation',()=>{
 const state=createHitResponse();
 for(let i=0;i<90;i++){
   hit(state,{impulseNs:6200,internalDamage:80,disabled:true});
   advanceHitResponse(state,1/60);
   assert.ok(Math.abs(state.pitch)<=HIT_REACTION_LIMITS.pitch);
   assert.ok(Math.abs(state.roll)<=HIT_REACTION_LIMITS.roll);
   assert.ok(Math.abs(state.mount)<=HIT_REACTION_LIMITS.mount);
 }
 for(let i=0;i<240;i++)advanceHitResponse(state,1/60);
 assert.ok(Math.abs(state.pitch)+Math.abs(state.roll)+Math.abs(state.mount)<.00001);
});
test('deterministic material language never fabricates a breach',()=>{
 assert.equal(hitMaterialLanguage({armorAbsorbed:17,internalDamage:0,remainingArmor:10}),'armor');
 assert.equal(hitMaterialLanguage({armorAbsorbed:17,internalDamage:0,remainingArmor:0}),'armor-break');
 assert.equal(hitMaterialLanguage({internalDamage:17,slot:'mobility'}),'hydraulic');
 assert.equal(hitMaterialLanguage({internalDamage:17,slot:'power'}),'electric');
 assert.equal(hitMaterialLanguage({internalDamage:17,slot:'combat'}),'breach');
 assert.equal(hitMaterialLanguage({justDestroyed:true,slot:'power'}),'catastrophic');
 assert.equal(hitMaterialLanguage(null),'world');
});
