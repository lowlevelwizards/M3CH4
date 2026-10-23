import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
    tacticalLineOfSight,tacticalRigVisible,
} from '../tacticalAwareness.js';
import { observeBattlefield,createWorldModel } from '../ai/worldModel.js';
import {
    firingLaneBlocker,chooseClearFiringPoint,
    assessTargetFireLanes,
} from '../ai/firingLane.js';

const rect=(id,height,minX=-2,maxX=2,minZ=-7,maxZ=-5)=>({
    id,minX,maxX,minZ,maxZ,minY:0,maxY:height,height,
});
const arena=obstacles=>({
    minX:-35,maxX:35,minZ:-35,maxZ:35,obstacles,
});
const partCondition=()=>({
    parts:Object.fromEntries(['structure','mobility','power','command','combat']
        .map(slot=>[slot,{integrity:100,maxIntegrity:100}])),
});
const rig=(id,team,x,z,yaw=0)=>({
    id,team,active:true,rig:{x,z,yaw},condition:partCondition(),
});

test('optic detects exposed cab above low cover, but not through tall cover',()=>{
    const from={x:0,z:0},to={x:0,z:-12};
    const low=arena([rect('barricade',2.12)]);
    assert.equal(tacticalLineOfSight(from,to,low),false,
        'old body-height ray remains blocked');
    assert.equal(tacticalRigVisible(from,to,low),true,
        'head/cab remains optically visible');
    assert.equal(tacticalRigVisible(from,to,arena([rect('high-wall',3.25)])),false);
});

test('team shares genuine above-cover contact, but does not see through a full wall',()=>{
    const friendly=rig('ally','friendly',0,0,0);
    const hostile=rig('enemy','hostile',0,-12,Math.PI);
    const memory=createWorldModel();
    const world=arena([rect('barrier',2.15)]);
    const first=observeBattlefield(memory,[friendly,hostile],
        {type:'elimination'},world,1);
    assert.equal(first.knowledge.friendly.contacts[0].visible,true);
    assert.ok(!Object.hasOwn(first.knowledge.friendly.contacts[0],'condition'));
    world.obstacles[0].maxY=3.25;
    const hidden=observeBattlefield(memory,[friendly,hostile],
        {type:'elimination'},world,2);
    assert.equal(hidden.knowledge.friendly.contacts[0].visible,false);
    assert.deepEqual(hidden.knowledge.friendly.contacts[0].position,{x:0,z:-12},
        'only last observed location is retained');
});

test('muzzle corridor can clear low cover but not taller cover',()=>{
    const from={x:0,z:0},to={x:0,z:-12};
    assert.equal(firingLaneBlocker(from,to,arena([rect('low',1.7)])),null);
    assert.equal(firingLaneBlocker(from,to,arena([rect('tall',2.9)])).id,'tall');
});

test('dynamic rig collision boxes without heights still block an ally-first lane',()=>{
    const world=arena([{id:'ally',dynamic:true,
        minX:-1.2,maxX:1.2,minZ:-7,maxZ:-5}]);
    assert.equal(firingLaneBlocker({x:0,z:0},{x:0,z:-12},world,'enemy')?.id,'ally');
});

test('physical fire selects exposed command when frame is blocked',()=>{
    const seen=[];
    const assessment=assessTargetFireLanes(slot=>{
        seen.push(slot);
        return slot==='command'
            ? {actorId:'enemy',slot:'command',blockedBy:null}
            : {actorId:null,slot:null,blockedBy:'barricade'};
    },'enemy','structure');
    assert.equal(assessment.clear,true);
    assert.equal(assessment.aimSlot,'command');
    assert.deepEqual(seen,['structure','combat','command']);
});

test('physical fire rejects blocked and friendly-first shots on every module',()=>{
    const blocked=assessTargetFireLanes(slot=>({
        actorId:slot==='command'?'ally':null,
        slot:slot==='command'?'command':null,
        blockedBy:slot==='command'?null:'steel-wall',
    }),'enemy','command');
    assert.equal(blocked.clear,false);
    assert.equal(blocked.aimSlot,null);
    assert.equal(blocked.blocker,'ally');
});

test('blocked lane produces new side/around-cover movement after failed approach',()=>{
    const world=arena([rect('central-wall',3.25)]);
    const from={x:0,z:0},target={x:0,z:-12};
    const first=chooseClearFiringPoint(from,target,world,{radius:1,side:1,targetId:'enemy'});
    assert.ok(first,'can choose a flanking waypoint');
    assert.ok(Math.hypot(first.x-from.x,first.z-from.z)>1.9);
    assert.ok(!world.obstacles.some(o=>
        first.x>=o.minX-1.45&&first.x<=o.maxX+1.45&&
        first.z>=o.minZ-1.45&&first.z<=o.maxZ+1.45));
    const next=chooseClearFiringPoint(from,target,world,{
        radius:1,side:1,targetId:'enemy',excludePoints:[first],
    });
    assert.ok(next,'stale route is not the sole option');
    assert.ok(Math.hypot(first.x-next.x,first.z-next.z)>=2.3);
});

test('live AI gate is physical target clearance, not stale body-only LOS',()=>{
    const main=fs.readFileSync(new URL('../main.js',import.meta.url),'utf8');
    assert.match(main,/assessTargetFireLanes\(slot=>/);
    assert.match(main,/actor\.fireLane\?\.clear===true/);
    assert.doesNotMatch(main,/actor\.motion\?\.awareness\?\.lineOfSight\s*!==\s*false/);
    assert.match(main,/excludePoints:search\.tried/);
});
