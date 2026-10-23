import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createLabProps,resetLabProps,stepLabProps,LAB_PROP_DEFINITIONS} from '../labPropPhysics.js';
const src=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('all prop interactions are bounded to four factory trial items',()=>{
 const props=createLabProps();
 assert.equal(props.length,4);
 assert.equal(LAB_PROP_DEFINITIONS.length,4);
 for(const p of props)assert.ok(p.massKg>=50&&p.radius>.1&&p.massKg<600);
});
test('light barrel and heavy rig exchange equal and opposite momentum',()=>{
 const props=createLabProps();
 props[0].x=1.1;props[0].z=0;
 for(let i=1;i<props.length;i++){props[i].x=90;props[i].z=90;}
 const rig={x:0,z:0,vx:3,vz:0};
 const totalBefore=4200*rig.vx+props[0].massKg*props[0].vx;
 const impacts=stepLabProps(props,rig,{massKg:4200,radiusM:.95},1/60);
 assert.equal(impacts.length,1);
 assert.ok(rig.vx<3,'rig reacts to contact');
 assert.ok(props[0].vx>0,'barrel is pushed');
 const totalAfter=4200*rig.vx+props[0].massKg*props[0].vx;
 assert.ok(Math.abs(totalBefore-totalAfter)<1e-6,'momentum conserved by contact impulse');
 assert.ok(Number.isFinite(props[0].x)&&Number.isFinite(rig.x));
});
test('stationary contact does not create energy or a perpetual jitter loop',()=>{
 const props=createLabProps();
 props[0].x=1.0;props[0].z=0;
 for(let i=1;i<props.length;i++){props[i].x=90;props[i].z=90;}
 const rig={x:0,z:0,vx:0,vz:0};
 let hits=0;
 for(let i=0;i<240;i++)hits+=stepLabProps(props,rig,{massKg:4300,radiusM:.95},1/60).length;
 assert.equal(hits,0);
 assert.equal(props[0].vx,0);
 assert.equal(props[0].vz,0);
 assert.ok(Number.isFinite(rig.x)&&Number.isFinite(rig.z));
});
test('rolling scrap loses velocity to ground friction and resets without saves',()=>{
 const props=createLabProps();props[0].vx=2;props[0].vz=1;
 for(let i=0;i<500;i++)stepLabProps(props,{x:-40,z:-40,vx:0,vz:0},{massKg:4200,radiusM:.95},1/60);
 assert.ok(Math.hypot(props[0].vx,props[0].vz)<.01);
 resetLabProps(props);
 assert.equal(props[0].x,LAB_PROP_DEFINITIONS[0].x);
 assert.equal(props[0].vx,0);
 assert.equal(props[0].contactCount,0);
});
test('piloting lab uses actual contact events and visual world state, no economy',()=>{
 const lab=src('pilotingLab.js'),html=src('piloting-lab.html');
 assert.match(lab,/stepLabProps\(looseProps,state/);
 assert.match(lab,/propImpacts\+=hits\.length/);
 assert.match(lab,/mesh\.position\.x=p\.x/);
 assert.match(html,/id="props-mode"/);
 assert.doesNotMatch(lab,/storeMachine\(|settleSortie\(|localStorage/);
});
