import test from 'node:test';
import assert from 'node:assert/strict';
import {AI_RESEARCH_PROFILES,AI_RESEARCH_DIFFICULTIES,
 getAiResearchProfile,getAiResearchDifficulty,listAiResearchProfiles}
 from '../ai/researchProfiles.js';
import {parseEntrant,entrantId,gradeTeam,approximateWinInterval,
 summarizeTournament} from '../research/aiTournamentCore.mjs';
import {buildSchedule,toMarkdown} from '../research/aiTournament.mjs';
import {runBout} from '../research/headlessDominationStudy.mjs';
import {planTeam} from '../ai/teamPlanner.js';
import {createPilotBrain,decidePilot} from '../ai/pilotBrain.js';

const entrant=id=>parseEntrant(id,getAiResearchProfile,getAiResearchDifficulty);
const p=(x,z)=>({x,z});

test('research registry has eight distinct bounded strategies and four difficulties',()=>{
 assert.equal(listAiResearchProfiles().length,8);
 assert.equal(Object.keys(AI_RESEARCH_DIFFICULTIES).length,4);
 assert.equal(getAiResearchProfile('baseline').weights.duplication,1);
 assert.equal(getAiResearchDifficulty('elite').spreadScale<
  getAiResearchDifficulty('rookie').spreadScale,true);
 assert.throws(()=>getAiResearchProfile('not-a-profile'),RangeError);
 assert.throws(()=>getAiResearchDifficulty('cheat'),RangeError);
 assert.throws(()=>entrant('unknown@pro'),RangeError);
 assert.equal(entrantId('fortress','club'),'fortress@club');
});

test('tournament pairs identical seeds across both sides without self matches',()=>{
 const config={entries:[entrant('baseline@pro'),entrant('blitz@club'),
   entrant('fortress@elite')],accuracy:[0,.7],pairs:2,baseSeed:901};
 const schedule=buildSchedule(config);
 assert.equal(schedule.length,3*2*2*2);
 for(let i=0;i<schedule.length;i+=2){
   const a=schedule[i],b=schedule[i+1];
   assert.equal(a.seed,b.seed);
   assert.equal(a.a.id,b.a.id);assert.equal(a.b.id,b.b.id);
   assert.equal(a.swap,false);assert.equal(b.swap,true);
   assert.notEqual(a.a.id,a.b.id);
 }
 assert.deepEqual(buildSchedule(config),schedule);
});

test('experimental pilot caution changes survival threshold but not mechanical capability',()=>{
 const policy=getAiResearchProfile('cautious'),baseline=getAiResearchProfile('baseline');
 const actor={id:'m',position:p(0,0)},task={goal:'CAPTURE',point:p(18,0),score:.8};
 const ctx={capability:{endurance:.39,command:1,canMove:true,canFight:true},
   underFireSeconds:1,retreatPoint:p(-8,0)};
 assert.equal(decidePilot(createPilotBrain(),actor,task,{...ctx,policy:baseline},4).goal,'CAPTURE');
 assert.equal(decidePilot(createPilotBrain(),actor,task,{...ctx,policy},4).goal,'WITHDRAW');
});

test('normal team assignment remains intact when no research temperament is supplied',()=>{
 const snapshot={kind:'domination',time:0,zoneRadius:4.7,
  zones:[{id:'A',point:p(-14,0),owner:null,contested:false,friendly:0,hostile:0},
   {id:'B',point:p(0,0),owner:null,contested:false,friendly:0,hostile:0},
   {id:'C',point:p(14,0),owner:null,contested:false,friendly:0,hostile:0}],
  score:{friendly:0,hostile:0},
  knowledge:{friendly:{allies:['one','two','three'].map((id,i)=>({
   id,team:'friendly',active:true,position:p((i-1)*9,20),
   capability:{canMove:true,canFight:true,endurance:1,speed:1,weapon:1}})),contacts:[]}}};
 assert.deepEqual(planTeam(snapshot,'friendly').orders,
   planTeam(snapshot,'friendly',{policy:getAiResearchProfile('baseline')}).orders);
});

test('grade does not mistake a higher damage loser for the match winner',()=>{
 const actors=['friendly','hostile'].flatMap((team)=>Array.from({length:3},(_,i)=>({
   team,alive:true,damageDealt:team==='friendly'?50:500,
   kills:0,zoneSeconds:10,captures:0,routeErrors:0,
   stallSeconds:0,collisionImpacts:0,trafficYields:0,routeSwitches:0,targetSwitches:0
 })));
 const bout={win:'friendly',time:90,points:{friendly:50,hostile:10},actors};
 assert.ok(gradeTeam(bout,'friendly').grade>gradeTeam(bout,'hostile').grade);
});

test('approximate confidence interval is wide with tiny samples',()=>{
 const [low,high]=approximateWinInterval(1,0,1);
 assert.ok(low<.5&&high===1);
 assert.deepEqual(approximateWinInterval(0,0,0),[0,1]);
});

test('aggregation records both entrants rather than counting friendly side only',()=>{
 const entries=[entrant('baseline@pro'),entrant('blitz@pro')];
 const dummy={damage:0,kills:0,zoneSeconds:0,captures:0,routeErrors:0,
   trafficYields:0,routeSwitches:0,stallSeconds:0,collisions:0,
   targetSwitches:0,deaths:0,survival:1,teamSize:3};
 const scores={friendly:{grade:75,stats:dummy},hostile:{grade:25,stats:dummy}};
 const record={a:entries[0].id,b:entries[1].id,
  sides:{friendly:entries[0].id,hostile:entries[1].id},
  winner:entries[0].id,grades:scores,points:{friendly:30,hostile:0}};
 const report=summarizeTournament(entries,[record]);
 assert.equal(report.ranking[0].id,entries[0].id);
 assert.equal(report.ranking[0].wins,1);
 assert.equal(report.ranking[1].losses,1);
 const md=toMarkdown({meta:{version:'test',boutCount:1,pairCount:0,
  capturePolicy:'strict',roster:'balanced',maxSeconds:60,accuracies:[.7],
  cautions:[]},...report});
 assert.match(md,/Experimental rankings/);
});

test('short seeded physical bout is repeatable and has live-style policy records',()=>{
 const settings={name:'test',accuracy:0,maxSeconds:2,
  policy:'strict',policyFriendly:'blitz',policyHostile:'fortress',
  difficultyFriendly:'rookie',difficultyHostile:'elite'};
 const a=runBout(80421,settings),b=runBout(80421,settings);
 assert.deepEqual(a,b);
 assert.equal(a.policies.friendly,'blitz');
 assert.equal(a.difficulties.hostile,'elite');
 assert.equal(a.actors.length,6);
 for(const rig of a.actors){
   assert.ok(Number.isFinite(rig.travel));
   assert.ok(Number.isFinite(rig.stallSeconds));
   assert.ok(Number.isFinite(rig.trafficYields));
 }
});
