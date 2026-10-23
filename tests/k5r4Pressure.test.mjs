import test from 'node:test';
import assert from 'node:assert/strict';
import {shotThreatEvidence,recordShotEvidence} from '../ai/combatIntelligence.js';
import {createTacticalAwareness,advanceTacticalAwareness} from '../tacticalAwareness.js';

test('AI only hears actually close 3D paths, not high overflights',()=>{
 const me={x:0,z:0,groundHeightM:0};
 assert.equal(shotThreatEvidence(me,{x:-8,y:12,z:0},{x:8,y:12,z:0}),null);
 const e=shotThreatEvidence(me,{x:-8,y:2,z:1},{x:8,y:2,z:1});
 assert.ok(e&&e.severity>.5);
 assert.equal(shotThreatEvidence(me,{x:-8,y:2,z:8},{x:8,y:2,z:8}),null);
});
test('sustained fire raises bounded tactical pressure but one scatter discharge is one incident',()=>{
 const motion={awareness:createTacticalAwareness()};
 const observer={x:0,z:0};
 const evidence={severity:.85,bearing:{x:1,z:0},distance:1};
 assert.equal(recordShotEvidence(motion,observer,evidence,1),true);
 assert.equal(recordShotEvidence(motion,observer,evidence,1),false);
 assert.equal(recordShotEvidence(motion,observer,evidence,1.01),false);
 assert.equal(motion.awareness.shotWarnings,1);
 const originalUrgency=motion.awareness.urgency;
 for(let i=1;i<=10;i++)recordShotEvidence(motion,observer,evidence,1+i*.12);
 assert.ok(motion.awareness.urgency>originalUrgency);
 assert.ok(motion.awareness.shotSequence<=8);
 assert.ok(motion.awareness.shotWarnings<=8);
 assert.equal(motion.awareness.recentAttackerId,null);
 assert.equal(motion.awareness.unseenThreat,true);
 assert.deepEqual(motion.awareness.lastThreat,{x:9,z:0});
});
test('the AI releases suppression rather than freezing objective play indefinitely',()=>{
 const state=createTacticalAwareness();
 const evidence={severity:.8,bearing:{x:0,z:1},distance:1};
 recordShotEvidence(state,{x:1,z:2},evidence,0);
 assert.ok(state.underFireSeconds>0);
 for(let i=0;i<340;i++)advanceTacticalAwareness(state,{x:1,z:2},null,1/60,{obstacles:[]},1.1,{id:'pressure'});
 assert.equal(state.underFireSeconds,0);
 assert.equal(state.shotSequence,0);
 assert.equal(state.shotWarnings,0);
 assert.equal(state.recentAttackerId,null);
 assert.equal(state.lineOfSight,false);
});
