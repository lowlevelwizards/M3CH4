import test from 'node:test';
import assert from 'node:assert/strict';
import {MAPS,mapById} from '../maps/mapRegistry.js';
import {auditMapFlow,measureSpawnExposure} from '../maps/mapFlowAudit.js';
import {pointClear} from '../maps/mapValidation.js';
import {planRoute} from '../ai/navigation.js';

test('all three venues support every real squad start and all domination objectives',()=>{
 for(const map of MAPS){
  const audit=auditMapFlow(map);
  console.log('CIRCUIT_MAP_FLOW '+JSON.stringify({
   map:audit.mapId,spawnsWithDirectEnemyLine:audit.exposure.exposed,
   fairRouteBias:audit.routeBias,approaches:audit.objectiveApproaches.map(s=>[s.site,s.clearBearings]),
   meanPathMeters:{friendly:audit.fromSouth?.average,hostile:audit.fromNorth?.average}
  }));
  assert.equal(audit.exposure.total,9,map.id);
  assert.equal(audit.exposure.exposed,0,map.id+' cross-spawn shooting lane '+JSON.stringify(audit.exposure.pairs.filter(p=>p.clear)));
  assert.equal(audit.routes.length,18,map.id);
  assert.ok(audit.routes.every(r=>r.ok),map.id+' '+JSON.stringify(audit.routes.filter(r=>!r.ok)));
  assert.ok(audit.objectiveApproaches.every(o=>o.clearBearings>=3),
   map.id+' lacks alternate approaches '+JSON.stringify(audit.objectiveApproaches));
  assert.ok(audit.routeBias<.55,map.id+' lopsided squad route lengths '+audit.routeBias);
 }
});
test('culvert west, central, east crossings are physical gaps for heavy machines',()=>{
 const map=mapById('culvert-nine');
 for(const x of [-25,0,25]){
  assert.ok(pointClear(map,{x,z:0},1.55),'Blocked culvert crossing '+x);
  const from={x,z:-5},to={x,z:5};
  assert.ok(pointClear(map,from,1.55));
  assert.ok(pointClear(map,to,1.55));
  const route=planRoute(map.world,from,to,1.55);
  assert.equal(route.ok,true,'Heavy cannot pass through crossing '+x);
  assert.ok(route.cost<=20,'Crossing '+x+' forces giant detour '+route.cost);
 }
});
test('grainhouse two mill dividers have actual broad, passable openings',()=>{
 const map=mapById('grainhouse');
 for(const z of [-7,10]){
  const from={x:1.5,z},to={x:9,z};
  assert.ok(pointClear(map,{x:5.3,z},1.55),'Blocked door opening '+z);
  const route=planRoute(map.world,from,to,1.55);
  assert.ok(route.ok,'Hauler cannot traverse grainhouse opening at '+z);
  assert.ok(route.cost<23,'Opening routes around entire building '+z+' '+route.cost);
 }
});
test('center-captain enemy spawn pairs are visually screened, not a shooting gallery',()=>{
 for(const map of MAPS){
  const exposure=measureSpawnExposure(map);
  assert.equal(exposure.pairs.find(p=>p.friendly===0&&p.hostile===0).clear,
    false,map.id+' has direct spawn lane');
 }
});
