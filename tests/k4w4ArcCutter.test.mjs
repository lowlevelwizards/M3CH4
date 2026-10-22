import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {CATALOG,makeTestAssembly,equip,inspectAssembly} from '../components.js';
import {WEAPONS,createWeaponState,advanceWeapon,fireWeapon,startReload} from '../combat.js';
import {createThermalCombat,coolThermalCombat,cutContact} from '../thermalCombat.js';
import {setActiveWeaponLoad,createPowerSystem,advancePowerSystem} from '../powerDynamics.js';
const source=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const w=WEAPONS['gun-arc'];
test('Arc Cutter is serialized nonstarter U1 hardware and has real finite electrodes',()=>{
 assert.equal(CATALOG[19].id,'gun-arc');
 const a=makeTestAssembly();equip(a,'combat','gun-arc');
 assert.equal(inspectAssembly(a).ready,true);
 const s=createWeaponState(w);assert.equal(s.loaded,50);
 for(let i=0;i<50;i++){if(s.action.ventLeft>0){advanceWeapon(s,w,2);}assert.notEqual(fireWeapon(s,w),null);advanceWeapon(s,w,.2);}
 assert.equal(s.loaded,0);assert.equal(startReload(s,w),true);
 advanceWeapon(s,w,4);assert.ok(s.loaded>0);
});
test('each unique physical module has independent sparse temporary heat, with cooling',()=>{
 const s=createThermalCombat();
 let first=cutContact(s,'enemy-0/power',.1),last;
 for(let i=0;i<20;i++)last=cutContact(s,'enemy-0/power',.1);
 assert.ok(last.damage>first.damage);
 assert.equal(cutContact(s,'enemy-0/command',.1).damage,first.damage);
 coolThermalCombat(s,4.5);assert.equal(s.has('enemy-0/power'),false);
});
test('actual active electrical draw stresses shared generator bus, without changing static rating',()=>{
 const a=makeTestAssembly();equip(a,'combat','gun-arc');
 const p=createPowerSystem(a);const idle=p.demandKw;
 setActiveWeaponLoad(p,42);advancePowerSystem(p,a,{driveLoad:.8},1/60,1);
 assert.ok(p.demandKw>idle+10);
 setActiveWeaponLoad(p,0);advancePowerSystem(p,a,{driveLoad:0},1/60,1);
 assert.ok(p.activeWeaponKw===0);
});
test('beam cannot damage without a confirmed short-range physical hit',()=>{
 const m=source('main.js');
 assert.match(m,/center\.distance<=weaponSpec\.rangeMeters/);
 assert.match(m,/cutContact\(/);
 assert.match(m,/setActiveWeaponLoad\(/);
 assert.match(source('partVisuals.js'),/'gun-arc': buildArcCutterVisual/);
});
