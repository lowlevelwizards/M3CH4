import test from 'node:test';
import assert from 'node:assert/strict';
import {createMotionDiagnostic,sampleMotion,motionSummary,
  OLYMPIC_EVENTS,EVENT_IDS,gradeOlympicEvent,summarizeOlympics}
  from '../research/aiOlympicsMetrics.mjs';
import {runOlympicEvent,runOlympics,olympicsMarkdown}
  from '../research/aiOlympics.mjs';

const emptyWorld={minX:-30,maxX:30,minZ:-30,maxZ:30,obstacles:[]};
const moving={mode:'ORDER',point:{x:0,z:-10}};
const hold={mode:'ANCHOR',point:{x:0,z:0}};
const stationaryRig=()=>({x:0,z:0,yaw:0,vx:0,vz:0,yawRate:0,impact:0});

test('Olympic registry has eight unique auditable situations',()=>{
  assert.equal(OLYMPIC_EVENTS.length,8);
  assert.equal(new Set(EVENT_IDS).size,8);
  assert.ok(['mobility','awareness','combat','coordination','survival']
    .every(group=>OLYMPIC_EVENTS.some(e=>e.group===group)));
});

test('intentional guarding and scanning are NOT falsely called stalled travel',()=>{
  const m=createMotionDiagnostic(),rig=stationaryRig();
  for(let i=0;i<180;i++){
    rig.yaw+=.012;rig.yawRate=.72;
    sampleMotion(m,rig,{throttle:0,strafe:0,brake:1},hold,{},emptyWorld,1/60,[],i/60);
  }
  const report=motionSummary(m);
  assert.ok(report.intentionalHold>2.9);
  assert.equal(report.realStall,0);
  assert.ok(report.usefulTurning===0);
});

test('a blocked command becomes a genuine stall after a sustained window',()=>{
  const m=createMotionDiagnostic(),rig=stationaryRig();
  for(let i=0;i<240;i++)
    sampleMotion(m,rig,{throttle:.8,strafe:0},moving,{},emptyWorld,1/60,[],i/60);
  assert.ok(m.realStall>2.5);
  assert.ok(m.unclassifiedStall>2.5);
  assert.equal(m.intentionalHold,0);
});

test('steering and real slow progress suppress spurious stall reports',()=>{
  const m=createMotionDiagnostic(),rig=stationaryRig();
  for(let i=0;i<180;i++){
    rig.yaw+=.012;rig.yawRate=.72;
    sampleMotion(m,rig,{throttle:.25,strafe:.2,steer:.8},moving,{},
      emptyWorld,1/60,[],i/60);
  }
  assert.equal(m.realStall,0);
  const slow=createMotionDiagnostic(),movingRig=stationaryRig();
  for(let i=0;i<180;i++){
    movingRig.z-=.0025;
    movingRig.vz=-.15;
    sampleMotion(slow,movingRig,{throttle:.4},moving,{},emptyWorld,1/60,[],i/60);
  }
  assert.equal(slow.realStall,0);
});

test('event scoring requires genuine task success rather than good-looking movement',()=>{
  const m={realStall:0,collisions:0,routeFailure:0};
  const fail=gradeOlympicEvent('wall-detour',{seconds:40,initialDistance:30,
    finalDistance:28,completed:false,motion:m});
  assert.ok(fail.score<30);assert.equal(fail.pass,false);
  const pass=gradeOlympicEvent('wall-detour',{seconds:20,initialDistance:30,
    finalDistance:1.5,completed:true,motion:m});
  assert.ok(pass.score>90);assert.equal(pass.pass,true);
});

test('seeded scenarios are reproducible and always finite',()=>{
  for(const id of EVENT_IDS){
    const options={seed:4102,family:'yard',profile:'baseline',seconds:2};
    const a=runOlympicEvent(id,options),b=runOlympicEvent(id,options);
    assert.deepEqual(a,b,'nondeterministic drill '+id);
    assert.ok(Number.isFinite(a.score)&&a.score>=0&&a.score<=100,id);
    assert.ok(Number.isFinite(a.motion.intentionalHold),id);
    assert.ok(Number.isFinite(a.motion.realStall),id);
    assert.ok(!a.actors.some(actor=>!Number.isFinite(actor.x)||!Number.isFinite(actor.z)));
  }
});

test('real physical obstacle run cannot instantaneously jump through the wall',()=>{
  const run=runOlympicEvent('wall-detour',{seed:188,family:'yard',seconds:2});
  assert.equal(run.completed,false);
  assert.ok(run.actors[0].z>3,'actor crossed wall in 2 seconds');
  assert.equal(run.motion.collisions>=0,true);
});

test('rear ambush does not grant an omniscient visible attacker',()=>{
  const run=runOlympicEvent('rear-ambush',{seed:33,seconds:6});
  assert.ok(run.actors[0].navigation);
  assert.ok(run.defensiveTurn>=0);
  assert.equal(run.contactsVisible,0);
});

test('scripted contact loss preserves an actual pre-drop visual observation',()=>{
  const run=runOlympicEvent('contact-dropout',{seed:33,seconds:9});
  assert.equal(run.contactLossAt,2.5);
  assert.ok(run.noGhostFraction>.8,'ghost visibility should be rejected');
});

test('simulator honors researched cautious wounded retreat vs unchanged baseline',()=>{
  const baseline=runOlympicEvent('wounded-withdrawal',{
    seed:188,profile:'baseline',seconds:12});
  const cautious=runOlympicEvent('wounded-withdrawal',{
    seed:188,profile:'cautious',seconds:12});
  assert.equal(baseline.withdrawSeconds,null);
  assert.ok(cautious.withdrawSeconds!==null);
  // Selection and physical execution are distinct competencies. The Olympics
  // records a failed escape instead of silently assuming that an order works.
  assert.ok(Number.isFinite(cautious.escapeProgress));
  assert.ok(Number.isFinite(baseline.escapeProgress));
});

test('small Olympics report aggregates scenarios without ranking a single long event higher',()=>{
  const cfg={events:['open-transit','rear-ambush'],families:['yard'],
    profiles:['baseline'],difficulties:['pro'],seeds:1,seed:1001};
  const r=runOlympics(cfg);
  assert.equal(r.bouts.length,2);
  assert.equal(r.summary.events.filter(e=>e.n>0).length,2);
  const markdown=olympicsMarkdown(r);
  assert.match(markdown,/AI Olympics/);
  assert.match(markdown,/True stalled seconds/);
  assert.doesNotMatch(markdown,/\| Lost visual contact \|/);
  assert.ok(r.summary.overall>0,'unselected events should not dilute the score');
  assert.ok(r.summary.overall>=0);
});
