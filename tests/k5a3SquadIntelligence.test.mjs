import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createWorldModel,observeBattlefield} from '../ai/worldModel.js';
import {assessTacticalAdvantage,localAttackWindow,searchSectorPoint,flankApproach} from '../ai/advantageTactics.js';
import {planTeam} from '../ai/teamPlanner.js';
import {createPilotBrain,decidePilot} from '../ai/pilotBrain.js';
import {createIntentExecutor,executeIntent} from '../ai/intentExecutor.js';
import {coordinateSquadArrivals} from '../ai/squadPositioning.js';
import {coordinateCorridors} from '../ai/corridorCoordinator.js';
const pos=(x,z)=>({x,z});
const geometry={minX:-35,maxX:35,minZ:-35,maxZ:35,obstacles:[]};
const cap=(s=1)=>({canMove:true,canFight:true,endurance:s,structure:s,
 mobility:s,power:s,command:s,weapon:s,speed:s});
const own=(id,x,z,s=1)=>({id,team:'friendly',active:true,position:pos(x,z),capability:cap(s)});
const zone=(id,x,z,owner=null,hostile=0)=>({id,point:pos(x,z),owner,
 contested:false,friendly:owner==='friendly'?1:0,hostile});
const snap=(allies,contacts=[],remaining=1,zones=[])=>({
 kind:'domination',time:16,knowledge:{
  friendly:{allies,contacts},
  hostile:{allies:[],contacts:[]}},
 zones,zoneRadius:4.7,remaining:{friendly:allies.length,hostile:remaining},
 score:{friendly:10,hostile:18,max:60}});
test('last-seen position is frozen while real hidden enemy walks away',()=>{
 const f={id:'f',team:'friendly',active:true,rig:{x:0,z:0,yaw:0}};
 const enemy={id:'e',team:'hostile',active:true,rig:{x:0,z:-8,yaw:0},
  condition:{parts:{structure:{integrity:30,maxIntegrity:100},
   mobility:{integrity:100,maxIntegrity:100}}}};
 const memory=createWorldModel(),obj={type:'elimination'};
 let view=observeBattlefield(memory,[f,enemy],obj,geometry,1);
 let contact=view.knowledge.friendly.contacts[0];
 assert.equal(contact.visible,true);
 assert.equal(contact.damageCue,'CRITICAL');
 enemy.rig.z=10;enemy.condition.parts.structure.integrity=100;
 view=observeBattlefield(memory,[f,enemy],obj,geometry,3);
 contact=view.knowledge.friendly.contacts[0];
 assert.equal(contact.visible,false);
 assert.deepEqual(contact.position,pos(0,-8));
 assert.equal(contact.damageCue,'CRITICAL','hidden health cannot magically update');
 assert.ok(contact.searchRadius>2);
 const older=observeBattlefield(memory,[f,enemy],obj,geometry,9).knowledge.friendly.contacts[0];
 assert.ok(older.searchRadius>contact.searchRadius);
 assert.ok(older.confidence<contact.confidence);
 assert.equal(observeBattlefield(memory,[f,enemy],obj,geometry,15).knowledge.friendly.contacts.length,0);
});
test('combat strength uses publicly known survivors and own damaged parts',()=>{
 const healthy=snap([own('a',0,1),own('b',-2,1),own('c',2,1)],
  [{id:'e',visible:true,position:pos(8,1),confidence:1,damageCue:'DAMAGED'}],1);
 const best=assessTacticalAdvantage(healthy,'friendly');
 assert.equal(best.forceEdge,2);
 assert.equal(best.exploit,true);
 assert.equal(best.lastSeenWeak,0);
 const weak=snap([own('a',0,1,.2),own('b',-2,1,.3)],[],3);
 const defensive=assessTacticalAdvantage(weak,'friendly');
 assert.equal(defensive.exploit,false);
 assert.equal(defensive.protect,true);
});
test('two nearby healthy allies recognize actual public/observed 2-to-1',()=>{
 const z=zone('B',6,0,'hostile',1);
 const battlefield=snap([own('a',0,1),own('b',-1,-1)],
  [{id:'e',visible:true,position:pos(7,0),confidence:1}],1,[z]);
 const edge=localAttackWindow(battlefield,'friendly',z);
 assert.equal(edge.majority,true);
 assert.equal(edge.opposed,1);
 assert.equal(localAttackWindow(snap([own('a',0,1)],[],3,[z]),'friendly',z).majority,false);
});
test('different searchers sweep diverging physically admissible sectors',()=>{
 const contact={position:pos(0,0),visible:false,searchRadius:9,confidence:.6};
 const p0=searchSectorPoint(contact,0,3,geometry);
 const p1=searchSectorPoint(contact,1,3,geometry);
 const p2=searchSectorPoint(contact,2,3,geometry);
 assert.notDeepEqual(p0,p1);
 assert.notDeepEqual(p1,p2);
 assert.ok([p0,p1,p2].every(p=>Math.hypot(p.x,p.z)<=9));
 const visible={...contact,visible:true};
 assert.deepEqual(searchSectorPoint(visible,2,3,geometry),pos(0,0));
});
test('route-safe flank never crosses a solid wall or leaves the map',()=>{
 const from=pos(-10,3),goal=pos(9,0),threat=pos(12,6);
 const flank=flankApproach(geometry,from,goal,threat,1);
 assert.ok(flank);
 assert.ok(Math.hypot(flank.x-goal.x,flank.z-goal.z)>3);
 const blocked={...geometry,obstacles:[{id:'gate',minX:-35,maxX:35,minZ:-35,maxZ:35}]};
 assert.equal(flankApproach(blocked,from,goal,threat,1),null);
});
test('squad planner presses weakly defended majority with distinct physical approach',()=>{
 const z=[zone('A',-15,0,'friendly'),
  zone('B',6,-1,'hostile',1),zone('C',17,14,'hostile')];
 const allies=[own('a',0,0),own('b',1,2),own('c',-1,-3)];
 const snapShot=snap(allies,[{id:'e',visible:true,
   position:pos(6,1),confidence:1,lastSeen:16,damageCue:'DAMAGED'}],1,z);
 const plan=planTeam(snapShot,'friendly',{world:geometry,
  strategy:{phase:'BREAK_MAJORITY',target:'B',reason:'BREAK ENEMY MAJORITY'},
  arrivalPolicy:'coordinated',corridorPolicy:'stagger',corridorMemory:{}});
 assert.ok(Object.values(plan.orders).some(o=>o.objectiveId==='B'));
 assert.equal(plan.advantage.forceEdge,2);
 const wing=Object.values(plan.orders).find(o=>o.assaultFlank);
 if(wing){
  assert.equal(wing.role,'FLANKER');
  assert.ok(wing.viaPoint);
 }
});
test('deliberate assault flank persists across brain refresh while enemy is seen',()=>{
 const brain=createPilotBrain(),a={id:'wing',position:pos(0,0)};
 const context={capability:cap(),enemySeen:true};
 const order={goal:'CONTEST',point:pos(10,0),objectiveId:'B',score:.9,
  viaPoint:pos(2,5),assaultFlank:true};
 assert.equal(decidePilot(brain,a,order,context,2).assaultFlank,true);
 const next=decidePilot(brain,a,{...order,viaPoint:pos(3,5)},context,3);
 assert.deepEqual(next.viaPoint,pos(3,5));
});
test('real route coordination policies return bounded assignments and do not mutate source',()=>{
 const actors=[own('a',0,10),own('b',2,10)];
 const orders={a:{goal:'CAPTURE',objectiveId:'B',point:pos(0,-10)},
  b:{goal:'CAPTURE',objectiveId:'B',point:pos(0,-10)}};
 const z=[zone('B',0,-10)];
 const assigned=coordinateSquadArrivals(orders,actors,z,
  {world:geometry,policy:'coordinated',zoneRadius:4.7});
 assert.equal(orders.a.arrivalPoint,undefined);
 assert.ok(assigned.a.arrivalPoint&&assigned.b.arrivalPoint);
 assert.notDeepEqual(assigned.a.arrivalPoint,assigned.b.arrivalPoint);
 const corridors=coordinateCorridors(assigned,actors,geometry,
  {time:2,policy:'stagger',memory:{}});
 assert.equal(Object.keys(corridors.orders).length,2);
 const exec=createIntentExecutor();
 const move=executeIntent(exec,{...corridors.orders.a},pos(0,10),geometry,1.1,1/60,[],
  {now:2,actorId:'a',trafficPolicy:'gated'});
 assert.ok(['ORDER','ANCHOR'].includes(move.mode));
});
test('live and headless games share tactical information and enabled traffic policies',()=>{
 const live=readFileSync(new URL('../main.js',import.meta.url),'utf8');
 const headless=readFileSync(new URL('../research/headlessDominationStudy.mjs',import.meta.url),'utf8');
 for(const marker of ["arrivalPolicy:'coordinated'","corridorPolicy:'stagger'","trafficPolicy:'gated'"])assert.ok(live.includes(marker),marker);
 assert.match(live,/aiCorridorMemory=\{friendly:\{\},hostile:\{\}\}/);
 assert.match(live,/aiClock-c.lastSeen<=6\.0/);
 for(const marker of ["??'coordinated'","??'stagger'","??'gated'"])assert.ok(headless.includes(marker));
});
