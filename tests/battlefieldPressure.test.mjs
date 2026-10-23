import test from 'node:test';
import assert from 'node:assert/strict';
import {nearMissEvidence,coverMaterial,coverStrikeLanguage,soundBearing,coverProximity} from '../battlefieldPressure.js';
const muzzle={x:-8,y:2.2,z:0},point={x:8,y:2.2,z:0};
test('segment-near miss requires real 3D proximity and segment interior',()=>{
 const near=nearMissEvidence({x:0,y:2.2,z:2.1},muzzle,point);
 assert.ok(near&&near.separation>2&&near.t>.45);
 assert.equal(nearMissEvidence({x:0,y:10,z:0},muzzle,point),null);
 assert.equal(nearMissEvidence({x:14,y:2.2,z:0},muzzle,point),null);
 assert.equal(nearMissEvidence({x:0,y:2.2,z:2},muzzle,point,{hitPlayer:true}),null);
 assert.equal(nearMissEvidence({x:-8,y:2.2,z:0},muzzle,point),null);
});
test('certified cover ends a path: shots that hit early cannot warn behind it',()=>{
 assert.equal(nearMissEvidence({x:4,y:2.2,z:0},muzzle,{x:-2,y:2.2,z:0}),null);
});
test('actual material IDs produce distinct feedback, not imaginary penetration',()=>{
 assert.equal(coverMaterial({blockedBy:'tractor-cab'}),'metal');
 assert.equal(coverMaterial({blockedBy:'far-east'}),'metal');
 assert.equal(coverMaterial({blockedBy:'pillar-1-3'}),'concrete');
 assert.equal(coverMaterial({blockedBy:'concrete-barrier'}),'concrete');
 assert.equal(coverMaterial({blockedBy:'floor'}),'earth');
 assert.equal(coverMaterial({blockedBy:'tractor-wheel-rl'}),'rubber');
 assert.equal(coverMaterial({actorId:'enemy-0',blockedBy:'tractor-cab'}),null);
});
test('ricochet requires physically shallow first contact on hard cover',()=>{
 const face=(normal,blockedBy='tractor-cab')=>coverStrikeLanguage({point:{x:8,y:2.2,z:0},muzzle:{x:0,y:2.2,z:0},normal,blockedBy});
 assert.equal(face({x:1,y:0,z:0}).ricochet,false);
 assert.equal(face({x:0,y:0,z:1}).ricochet,true);
 assert.equal(face({x:0,y:0,z:1},'floor').ricochet,false);
 assert.equal(face({x:0,y:0,z:1},'concrete-wall').ricochet,true);
 assert.equal(face({x:0,y:0,z:1},'wood-pallet').ricochet,false);
});
test('sound pans by listener facing without leaking exact source identity',()=>{
 const listener={x:0,z:0};
 assert.ok(soundBearing({x:4,z:0},listener,0)>.99);
 assert.ok(soundBearing({x:-4,z:0},listener,0)<-.99);
 assert.ok(Math.abs(soundBearing({x:0,z:-4},listener,0))<.01);
 assert.equal(coverProximity({x:3,y:2,z:0},{x:0,y:2,z:0}),2/3);
});
