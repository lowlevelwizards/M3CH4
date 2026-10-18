import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { DEFAULT_WORLD, DEFAULT_RIG_CONFIG, createRigState, stepRig } from '../locomotion.js';
import { createEnemyMotion, advanceEnemyMotion } from '../enemyMotion.js';
import { advanceSortieObjective } from '../sortieObjectives.js';
import { chooseFightPosition, chooseDefendPosition } from '../ai/positioning.js';
import { createWorldModel, observeBattlefield, actorCapabilities } from '../ai/worldModel.js';
import { planTeam } from '../ai/teamPlanner.js';
import { createPilotBrain, decidePilot } from '../ai/pilotBrain.js';
import { planRoute, nextWaypoint } from '../ai/navigation.js';
import { createIntentExecutor, executeIntent } from '../ai/intentExecutor.js';
import { createAiTrace, recordAiDecision, formatAiTrace } from '../ai/debug.js';
import { createSortieObjective } from '../sortieObjectives.js';
import { contractById } from '../contracts.js';

const unit=(id,team,x,z,extra={})=>({id,team,active:true,
    rig:{x,z},condition:{parts:Object.fromEntries(['mobility','power','command','combat','structure'].map(slot=>
        [slot,{integrity:100,maxIntegrity:100,destroyed:false}]))},behavior:{id:'pressure'},...extra});
const objective=()=>createSortieObjective(contractById('domination'));
function build(actors,mutate=null,time=2,memory=createWorldModel()){
    const obj=objective();
    if(mutate)mutate(obj.domination.points);
    return observeBattlefield(memory,actors,obj,DEFAULT_WORLD,time);
}
const team=(snap,t='hostile')=>planTeam(snap,t);
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const code=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');

test('contact knowledge is observable, timestamped, forgotten and never leaks hidden ground-truth positions',()=>{
    const memory=createWorldModel();
    const a=unit('ally-1','friendly',0,20),enemy=unit('enemy-0','hostile',0,15);
    let s=build([a,enemy],null,1,memory);
    assert.equal(s.knowledge.friendly.contacts[0].visible,true);
    enemy.rig={x:0,z:-19}; // behind the central house
    s=build([a,enemy],null,3,memory);
    assert.equal(s.knowledge.friendly.contacts[0].visible,false);
    assert.deepEqual(s.knowledge.friendly.contacts[0].position,{x:0,z:15});
    s=build([a,enemy],null,8,memory);
    assert.equal(s.knowledge.friendly.contacts.length,0);
});
test('team planner assigns different useful zones rather than stationary actor ID lanes',()=>{
    const actors=[unit('enemy-0','hostile',0,-21),unit('enemy-1','hostile',-9,-21),
        unit('enemy-2','hostile',9,-21),unit('ally-1','friendly',0,20)];
    const p=team(build(actors));
    assert.equal(Object.keys(p.orders).length,3);
    assert.equal(new Set(Object.values(p.orders).map(x=>x.objectiveId)).size,3);
    for(const job of Object.values(p.orders))assert.ok(['CAPTURE','CONTEST','DEFEND'].includes(job.goal));
});
test('enemy scoring majority makes a dynamic contest urgent; loss of a flanker reallocates available rigs',()=>{
    const actors=[unit('enemy-0','hostile',0,-20),unit('enemy-1','hostile',-9,-20),
        unit('enemy-2','hostile',9,-20),unit('ally-1','friendly',0,21)];
    const snapshot=build(actors,pts=>{
        pts[0].owner='friendly';pts[0].influence=1;
        pts[1].owner='friendly';pts[1].influence=1;
        pts[2].owner='hostile';pts[2].influence=-1;
    });
    const orders=team(snapshot).orders;
    assert.ok(Object.values(orders).some(o=>o.goal==='CONTEST'),
        JSON.stringify(orders));
    actors[1].active=false;
    const second=team(build(actors,pts=>{
        pts[0].owner='friendly';pts[1].owner='friendly';pts[2].owner='hostile';
    })).orders;
    assert.equal(Object.keys(second).length,2);
    assert.equal(second['enemy-1'],undefined);
    assert.ok(Object.values(second).some(o=>o.goal==='CONTEST'));
});
test('team planners keep moving toward empty territory when no enemy is left to shoot',()=>{
    const actors=[unit('ally-1','friendly',-9,21),unit('ally-2','friendly',9,21)];
    const snap=build(actors);
    assert.equal(snap.knowledge.friendly.contacts.length,0);
    const orders=team(snap,'friendly').orders;
    assert.ok(Object.values(orders).every(o=>o.point));
    assert.ok(Object.values(orders).some(o=>o.goal==='CAPTURE'));
});
test('seriously crippled locomotion cannot be assigned a remote capture route',()=>{
    const broken=unit('enemy-0','hostile',0,-22);
    broken.condition.parts.mobility.integrity=0;
    assert.equal(actorCapabilities(broken).canMove,false);
    const orders=team(build([broken])).orders;
    assert.equal(orders['enemy-0'].goal,'HOLD');
});
test('pilot keeps a tactical commitment despite minor better offers, but critical damage interrupts',()=>{
    const brain=createPilotBrain();
    const actor={id:'enemy-1',position:{x:-12,z:0}};
    const cap={canMove:true,endurance:1,command:1};
    const first=decidePilot(brain,actor,{goal:'CAPTURE',objectiveId:'A',
        point:{x:-17,z:-1},score:.66,reason:'CAPTURE A'},{capability:cap},10);
    const second=decidePilot(brain,actor,{goal:'CONTEST',objectiveId:'B',
        point:{x:0,z:-9},score:.81,reason:'CONTEST B'},{capability:cap},11);
    assert.equal(second.goal,'CAPTURE');
    const critical=decidePilot(brain,actor,{goal:'CONTEST',objectiveId:'B',
        point:{x:0,z:-9},score:.81,reason:'CONTEST B'},{
        capability:{canMove:true,endurance:.05,command:.05},
        retreatPoint:{x:0,z:-20}},11.1);
    assert.equal(critical.goal,'WITHDRAW');
    assert.equal(first.committedUntil,13.4);
});
test('A* finds a collision-clear physical route around the central loading house',()=>{
    const from={x:0,z:22},goal={x:0,z:-19};
    const route=planRoute(DEFAULT_WORLD,from,goal,.9);
    assert.equal(route.ok,true,route.reason);
    assert.ok(route.waypoints.length>=2,JSON.stringify(route));
    let at=from;
    for(const wp of route.waypoints) {
        const samples=Math.ceil(dist(at,wp)/.45);
        for(let i=0;i<=samples;i++){
            const t=i/samples,p={x:at.x+(wp.x-at.x)*t,z:at.z+(wp.z-at.z)*t};
            for(const o of DEFAULT_WORLD.obstacles.filter(o=>!o.dynamic))
                assert.ok(!(p.x>o.minX-1.1&&p.x<o.maxX+1.1&&
                    p.z>o.minZ-1.1&&p.z<o.maxZ+1.1),'Route hits '+o.id);
        }
        at=wp;
    }
    const state={waypoints:route.waypoints,index:0};
    assert.deepEqual(nextWaypoint(state,from),route.waypoints[0]);
});
test('blocked goals are reported instead of generating magical invalid movement',()=>{
    const route=planRoute(DEFAULT_WORLD,{x:0,z:22},{x:0,z:0},1);
    assert.equal(route.ok,false);
    assert.equal(route.reason,'GOAL BLOCKED');
});
test('executor emits a route waypoint intent but never mutates position',()=>{
    const executor=createIntentExecutor();
    const rig={x:0,z:22,yaw:0};
    const intent={goal:'CAPTURE',objectiveId:'B',point:{x:0,z:-9}};
    const command=executeIntent(executor,intent,rig,DEFAULT_WORLD,.9,1/60);
    assert.equal(command.mode,'ORDER');
    assert.equal(rig.z,22);
    assert.ok(command.point);
    const stationary=executeIntent(executor,{goal:'HOLD',point:{x:0,z:22}},
        rig,DEFAULT_WORLD,.9,1/60);
    assert.equal(stationary.mode,'ANCHOR');
});
test('debug decisions are explainable and have bounded history',()=>{
    const brain=createPilotBrain(),trace=createAiTrace();
    for(let i=0;i<40;i++){
        brain.intent={goal:'CAPTURE',objectiveId:'A',reason:'HOLD MAJORITY',utility:.8};
        brain.committedUntil=i+4;
        brain.history.push({time:i,goal:'CAPTURE',reason:'HOLD MAJORITY'});
        if(brain.history.length>18)brain.history.shift();
        recordAiDecision(trace,{id:'enemy-0'},brain,{lastFailure:null},i);
    }
    assert.equal(trace.rows.length,1);
    assert.ok(trace.rows[0].history.length<=5);
    assert.match(formatAiTrace(trace),/HOLD MAJORITY/);
});
test('live loop no longer skips strategic movement when no enemy is targetable',()=>{
    const main=code('main.js'),motion=code('enemyMotion.js');
    assert.match(main,/observeBattlefield\(aiMemory/);
    assert.match(main,/planTeam\(aiSnapshot/);
    assert.match(main,/decidePilot\(actor\.brain/);
    assert.match(main,/executeIntent\(actor\.executor/);
    assert.doesNotMatch(main,/if \(!target\) continue;/);
    assert.doesNotMatch(main,/dominationPointForActor\(sortieObjective,actor\)/);
    assert.match(main,/!target\);\s*if \(shot !== null && target\)/);
    assert.match(motion,/teamIntent\?\.mode==='ORDER'/);
    assert.doesNotMatch(motion,/teamIntent\?\.mode === 'DOMINATE'/);
});
test('cross-mode objectives use the same team/pilot pipeline',()=>{
    const actors=[unit('ally-1','friendly',-9,21),unit('enemy-0','hostile',9,-21)];
    for(const type of ['recovery','control','breakthrough','elimination']){
        const objectiveState={type,point:{x:0,z:0},
            friendlyGoal:{x:0,z:-20},hostileGoal:{x:0,z:20},
            friendlyProgress:0,hostileProgress:0};
        const memory=createWorldModel();
        const snap=observeBattlefield(memory,actors,objectiveState,DEFAULT_WORLD,4);
        const orders=planTeam(snap,'friendly').orders;
        assert.equal(Object.keys(orders).length,1);
        assert.ok(['CAPTURE','SEARCH','ENGAGE','HOLD'].includes(orders['ally-1'].goal));
    }
});

test('unarmed, opponent-free team physically moves onto multiple Domination nodes and starts scoring',()=>{
    const state=objective(),world=DEFAULT_WORLD,dt=1/60;
    const actors=[
        unit('ally-1','friendly',-9,21,{rig:createRigState({x:-9,z:21,yaw:0})}),
        unit('ally-2','friendly',9,21,{rig:createRigState({x:9,z:21,yaw:0})}),
    ];
    for(const actor of actors) {
        actor.motion=createEnemyMotion({id:'pressure',label:'TEST PILOT',
            preferredRangeM:6.2,rangeBandM:1,approachThrottle:.72,
            approachStrafe:.10,retreatThrottle:.62,strafeThrottle:.68,
            strafeSeconds:2.2,braceSeconds:.75,closeAction:'retreat',
            closeRetreatM:0,steerGain:1.75,yawRateDamping:1.15});
        actor.brain=createPilotBrain();actor.executor=createIntentExecutor();
    }
    const memory=createWorldModel();
    let snapshot=null,plan=null;
    for(let tick=0;tick<60*45;tick++) {
        const now=tick*dt;
        if(tick%60===0) {
            snapshot=observeBattlefield(memory,actors,state,world,now);
            plan=planTeam(snapshot,'friendly').orders;
        }
        for(const actor of actors) {
            const cap=snapshot.knowledge.friendly.allies.find(a=>a.id===actor.id).capability;
            const intent=decidePilot(actor.brain,
                {id:actor.id,position:{x:actor.rig.x,z:actor.rig.z}},
                plan[actor.id],{capability:cap,world,personality:'pressure'},now);
            const command=executeIntent(actor.executor,intent,actor.rig,world,.95,dt);
            const motion=advanceEnemyMotion(actor.motion,actor.rig,actor.rig,
                dt,true,world,.95,actor.motion.behavior,command);
            stepRig(actor.rig,motion,dt,DEFAULT_RIG_CONFIG,world);
        }
        advanceSortieObjective(state,actors,dt);
    }
    const owned=state.domination.points.filter(point=>point.owner==='friendly');
    assert.ok(owned.length>=2,
        'Expected 2 captured zones. Actual: '+JSON.stringify({
            rigs:actors.map(a=>({id:a.id,x:a.rig.x,z:a.rig.z,
                route:a.executor.lastFailure,mode:a.motion.phase})),
            zones:state.domination.points.map(p=>({id:p.id,owner:p.owner,influence:p.influence}))
        }));
    assert.ok(state.friendlyProgress>0,'Capture should produce majority score');
});
test('position candidates are static-world valid and do not replace physical steering',()=>{
    const self={x:-9,z:19},enemy={x:16,z:1};
    const fire=chooseFightPosition(DEFAULT_WORLD,self,enemy,7,'skirmisher');
    const guard=chooseDefendPosition(DEFAULT_WORLD,self,{x:-17,z:-1.5});
    for(const p of [fire,guard]) {
        assert.ok(Number.isFinite(p.x)&&Number.isFinite(p.z));
        for(const o of DEFAULT_WORLD.obstacles.filter(o=>!o.dynamic))
            assert.ok(!(p.x>o.minX-1.4&&p.x<o.maxX+1.4&&
                p.z>o.minZ-1.4&&p.z<o.maxZ+1.4),
                'Candidate intersects '+o.id);
    }
});
test('safe servicing retreats away from its abandoned capture target',()=>{
    const brain=createPilotBrain(),actor={id:'enemy-1',position:{x:0,z:0}};
    const out=decidePilot(brain,actor,{goal:'CAPTURE',objectiveId:'B',
        point:{x:0,z:-9},score:.8},{
            capability:{canMove:true,endurance:1,command:1},
            weaponRecovery:{active:true,mode:'WITHDRAW'},
            retreatPoint:{x:0,z:20}
        },10);
    assert.equal(out.goal,'WITHDRAW');
    assert.deepEqual(out.point,{x:0,z:20});
});
test('unreachable routes report a failure once and throttle reattempts',()=>{
    const state=createIntentExecutor(),actor={x:0,z:22};
    const order={goal:'CAPTURE',point:{x:0,z:0}};
    for(let i=0;i<80;i++) {
        const result=executeIntent(state,order,actor,DEFAULT_WORLD,.95,1/60);
        assert.equal(result.mode,'ANCHOR');
    }
    assert.equal(state.failures,1);
});

test('opposing opening squads physically leave spawn and acquire a visible contact without omniscience',()=>{
    const dt=1/60,world=DEFAULT_WORLD;
    const actors=[
        unit('ally-1','friendly',-9,21,{rig:createRigState({x:-9,z:21,yaw:0})}),
        unit('ally-2','friendly',9,21,{rig:createRigState({x:9,z:21,yaw:0})}),
        unit('enemy-0','hostile',0,-22,{rig:createRigState({x:0,z:-22,yaw:Math.PI})}),
        unit('enemy-1','hostile',-9,-21,{rig:createRigState({x:-9,z:-21,yaw:Math.PI})}),
        unit('enemy-2','hostile',9,-21,{rig:createRigState({x:9,z:-21,yaw:Math.PI})}),
    ];
    for(const a of actors){
        a.motion=createEnemyMotion({id:'pressure',label:'SEARCH',
            preferredRangeM:6.2,rangeBandM:1,approachThrottle:.72,approachStrafe:.10,
            retreatThrottle:.62,strafeThrottle:.68,strafeSeconds:2.2,braceSeconds:.75,
            closeAction:'retreat',closeRetreatM:0,steerGain:1.75,yawRateDamping:1.15});
        a.brain=createPilotBrain();a.executor=createIntentExecutor();
    }
    const memory=createWorldModel(),objectiveState={type:'elimination'};
    let contactsFound=false,plans={};
    for(let tick=0;tick<60*35;tick++){
        const time=tick*dt;
        if(tick%60===0){
            const snapshot=observeBattlefield(memory,actors,objectiveState,world,time);
            contactsFound ||= snapshot.knowledge.friendly.contacts.some(c=>c.visible) ||
                snapshot.knowledge.hostile.contacts.some(c=>c.visible);
            plans={
                friendly:planTeam(snapshot,'friendly').orders,
                hostile:planTeam(snapshot,'hostile').orders,
            };
        }
        for(const actor of actors){
            const cap=actorCapabilities(actor);
            const decision=decidePilot(actor.brain,{
                id:actor.id,position:{x:actor.rig.x,z:actor.rig.z}
            },plans[actor.team]?.[actor.id],{capability:cap,world},time);
            const instruction=executeIntent(actor.executor,decision,actor.rig,world,.95,dt);
            const drive=advanceEnemyMotion(actor.motion,actor.rig,actor.rig,dt,
                true,world,.95,actor.motion.behavior,instruction);
            stepRig(actor.rig,drive,dt,DEFAULT_RIG_CONFIG,world);
        }
        if(contactsFound)break;
    }
    assert.equal(contactsFound,true,
        'Crews failed to acquire contact: '+JSON.stringify(actors.map(a=>({
            id:a.id,position:{x:a.rig.x,z:a.rig.z},
            goal:a.brain.intent?.goal,route:a.executor.lastFailure
        }))));
});
