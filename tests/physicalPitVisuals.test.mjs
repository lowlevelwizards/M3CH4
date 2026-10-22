import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {serviceCondition,serviceBayFocus} from '../serviceBayVisualRules.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const state=(integrity,maxIntegrity=100,armor=100,maxArmor=100,destroyed=false)=>
  ({integrity,maxIntegrity,armor,maxArmor,destroyed});
test('normal healthy garage does not clutter the pit, pit can display a clean standby bay',()=>{
 const healthy={mobility:state(100),structure:state(100),combat:state(100)};
 const garage=serviceBayFocus(healthy,null,false);
 const pit=serviceBayFocus(healthy,null,true);
 assert.equal(garage.visible,false);
 assert.equal(pit.visible,true);
 assert.equal(pit.mode,'STANDBY');
 assert.equal(pit.focus,null);
 assert.equal(pit.supports,false);
});
test('true failing mobility draws support jacks and contextual work focus',()=>{
 const parts={mobility:state(0),structure:state(90),combat:state(70)};
 const p=serviceBayFocus(parts,null,false);
 assert.equal(p.visible,true);
 assert.equal(p.focus,'mobility');
 assert.equal(p.supports,true);
 assert.equal(p.mode,'DISABLED');
 assert.ok(p.damagedCount>=2);
});
test('work light can follow a selected installed station even if another has worse condition',()=>{
 const parts={mobility:state(0),power:state(60),combat:state(30)};
 const p=serviceBayFocus(parts,'power',true);
 assert.equal(p.focus,'power');
 assert.equal(p.mode,'INSPECT');
 assert.equal(p.supports,true);
});
test('armor loss can request attention but cannot imply mechanical disablement',()=>{
 const p=serviceCondition(state(100,100,15,100));
 assert.equal(p.critical,false);
 assert.ok(p.needsService);
 const bay=serviceBayFocus({combat:state(100,100,15,100)},null,false);
 assert.equal(bay.visible,false);
});
test('pit uses a single actual rendered machine and non-colliding diagnostic equipment',()=>{
 const scene=read('scene.js'),ui=read('unifiedGarageUI.js');
 assert.match(ui,/arena\?\.setPitPresentation\?\.\(state==='pit',selectedSlot\)/);
 assert.match(scene,/function refreshPhysicalServiceBay\(\)/);
 assert.match(scene,/const policy=serviceBayFocus\(latestPilotParts\|\|\{\}/);
 assert.match(scene,/root\.userData\.stage=\{supports,warning:warningLED,lamp,readout\}/);
 assert.match(scene,/new THREE\.SpotLight\(0xffce8d/);
 assert.match(scene,/setPitPresentation,/);
 const section=scene.slice(scene.indexOf('function buildServiceDressing()'),
    scene.indexOf('function buildGarageBay()'));
 assert.doesNotMatch(section,/solids\.push|pickMeshes\.push|arenaObstacleId/);
});
