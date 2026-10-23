import test from 'node:test';
import assert from 'node:assert/strict';
import { createRoundClock,advanceRoundClock,formatRoundClock,timeDecision,
 REGULATION_SECONDS,OVERTIME_SECONDS } from '../roundClock.js';
import { readFileSync } from 'node:fs';
const part=(fraction=1)=>({integrity:fraction*100,maxIntegrity:100});
const mech=(team,active=true,health=1)=>({team,active,condition:{parts:{
 structure:part(health),mobility:part(health),power:part(health),
 command:part(health),combat:part(health)}}});
const zone=(id,owner=null,contested=false)=>({id,owner,contested});
const dom=(friendlyProgress=0,hostileProgress=0,points=[
 zone('A','friendly'),zone('B',null),zone('C','hostile')
],contested=false)=>({type:'domination',friendlyProgress,hostileProgress,
 domination:{points},contested});
test('regulation never expires before three full minutes of actual fixed-step simulation',()=>{
 const c=createRoundClock();
 let result=null;
 for(let i=0;i<REGULATION_SECONDS*60-1;i++)
   result=advanceRoundClock(c,1/60,dom(5,3),[mech('friendly'),mech('hostile')]);
 assert.equal(result,null);
 assert.equal(formatRoundClock(c),'00:01');
 result=advanceRoundClock(c,1/60,dom(5,3),[mech('friendly'),mech('hostile')]);
 assert.equal(result.winner,'friendly');
 assert.match(result.reason,/TIME LIMIT · OBJECTIVE SCORE/);
 assert.equal(advanceRoundClock(c,60,dom()),null,'no duplicate payouts / results');
});
test('real public objective score wins at regulation even with fewer survivors',()=>{
 const c=createRoundClock(2,3),team=[mech('friendly'),mech('hostile'),mech('hostile')];
 const result=advanceRoundClock(c,2,dom(31,12),team);
 assert.equal(result.winner,'friendly');
});
test('contested zone receives at most twenty seconds of overtime',()=>{
 const c=createRoundClock(1,2),s=dom(18,14,undefined,true);
 assert.equal(advanceRoundClock(c,1,s),null);
 assert.equal(c.overtime,true);
 assert.equal(formatRoundClock(c),'OT 00:02');
 assert.equal(advanceRoundClock(c,1.5,s),null);
 const result=advanceRoundClock(c,.5,s);
 assert.equal(result.winner,'friendly');
 assert.match(result.reason,/OVERTIME/);
});
test('overtime ends as soon as contact clears and scoreboard is no longer tied',()=>{
 const c=createRoundClock(1,20),s=dom(3,2,undefined,true);
 assert.equal(advanceRoundClock(c,1,s),null);
 s.contested=false;
 const result=advanceRoundClock(c,.1,s);
 assert.equal(result.winner,'friendly');
 assert.ok(c.elapsed<2);
});
test('score tie without current capture still gives finite short overtime',()=>{
 const c=createRoundClock(2,4),s=dom(4,4);
 assert.equal(advanceRoundClock(c,2,s),null);
 assert.equal(c.overtime,true);
 assert.equal(advanceRoundClock(c,4,s).winner,'hostile',
 'if no team secures a decision, defender retains exact draw');
});
test('territory, survivors and surviving physical system condition decide score ties',()=>{
 const territory=dom(12,12,[zone('A','friendly'),zone('B','friendly'),zone('C','hostile')]);
 assert.deepEqual(timeDecision(territory,[mech('hostile'),mech('hostile')]),{
  team:'friendly',criterion:'SCORING TERRITORY'});
 const even=dom(11,11);
 assert.equal(timeDecision(even,[mech('friendly'),mech('friendly'),mech('hostile')]).team,'friendly');
 assert.equal(timeDecision(even,[mech('friendly',true,.65),mech('hostile',true,.91)]).team,'hostile');
 assert.equal(timeDecision(even,[mech('friendly',true,1),mech('hostile',true,1)]).criterion,
  'DEFENDER HOLDS EXACT TIE');
});
test('the timer never runs while app hidden: only explicit simulation dt counts',()=>{
 const c=createRoundClock(10,0);
 assert.equal(advanceRoundClock(c,0,dom()),null);
 assert.equal(advanceRoundClock(c,-1,dom()),null);
 assert.equal(advanceRoundClock(c,NaN,dom()),null);
 assert.equal(c.elapsed,0);
});
test('live battle integrates round clock once, and still resolves through normal bout settlement',()=>{
 const main=readFileSync(new URL('../main.js',import.meta.url),'utf8');
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.match(main,/roundClock=createRoundClock\(\)/);
 assert.match(main,/advanceRoundClock\(roundClock,FIXED_DT,sortieObjective,battleParticipants\(\)\)/);
 assert.match(main,/if\(timeout\)finishSortie\(timeout.victory,timeout.reason\)/);
 assert.match(main,/renderRoundClock\(\)/);
 assert.match(html,/roundClock\.js\?v=k5a2/);
 assert.match(html,/main\.js\?v=k5p8/);
});

test('time decisions do not falsely claim the opposition was eliminated',()=>{
 const main=readFileSync(new URL('../main.js',import.meta.url),'utf8');
 assert.match(main,/const timedDecision=reason\?\.startsWith\('TIME LIMIT'\)/);
 assert.match(main,/ROUND WON · TIME DECISION/);
 assert.match(main,/ROUND LOST · TIME DECISION/);
});
