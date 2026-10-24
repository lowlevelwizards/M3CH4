import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {BACKLOT} from '../maps/backlot.js';
import {BACKLOT_COVER_KITS} from '../backlotObstacleKits.js';
const source=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const machines=source('backlotAnatomicalMachines.js');
const salvage=source('backlotAnatomicalSalvage.js');
const audit=source('backlotAssemblyAudit.js');
const kits=source('backlotObstacleKits.js');
const scenery=source('backlotSceneryAnatomy.js');
const gallery=source('backlotPropGallery.js');

test('loader actually attaches its arm to the outside rear of the bucket',()=>{
 assert.match(machines,/bucket-side-external-hinge-bracket/);
 assert.match(machines,/bucket-side-rear-gusset/);
 assert.match(machines,/rearBucketPin=\[lugX,1\.30,-2\.31\]/);
 assert.match(machines,/const rearX=side\*1\.30,elbowX=side\*1\.79,lugX=side\*2\.72/);
 assert.match(machines,/loader-hydraulic-rod-clevis/);
 assert.doesNotMatch(machines,/\[s\*1\.48,1\.24,-2\.72\]/);
 assert.match(audit,/family==='loader'/);
 assert.match(audit,/arm enters working scoop/);
 assert.match(audit,/loader bucket trunnions/);
});
test('the eleven certified live cover families receive the completion pass',()=>{
 const expected=[
  'shipping-container','tire-stack','barrel-cluster','pickup-wreck',
  'generator-unit','scrap-barricade','flatbed-fragment','turbine-housing',
  'tractor-wreck','combine-harvester','concrete-barrier'
 ];
 assert.deepEqual([...BACKLOT_COVER_KITS].sort(),expected.sort());
 const used=new Set(BACKLOT.world.obstacles.map(o=>o.artKit).filter(Boolean));
 for(const kit of expected)assert.ok(used.has(kit),'Not present on real Backlot: '+kit);
 assert.match(kits,/one-upper-grounded-tractor-tyre/);
 assert.doesNotMatch(kits,/tyre-rack-crossbar/);
 assert.match(kits,/combine-threshing-body/);
 assert.match(kits,/flatbed-load-rusted-body/);
 assert.match(kits,/certified-/);
});
test('salvage models are connected where weight or articulation demands',()=>{
 for(const name of [
  'flatbed-continuous-underdeck','flatbed-live-axle',
  'flatbed-strapped-salvage-plinth','scrap-wall-rear-buttress',
  'container-right-hinge-axis','container-heavy-hinge-pin',
  'open-door-locking-bar','large-concrete-impact-spall'
 ])assert.ok(salvage.includes("'"+name+"'"),name);
 assert.match(salvage,/hinge\.rotation\.y=-\.38/);
 assert.match(salvage,/const x=\(j-1\)\*1\.59/);
});
test('distant support props lose thin repetitive geometry without losing structure',()=>{
 assert.match(scenery,/for\(const xx of \[-4\.19,0,4\.19\]\)/);
 assert.match(scenery,/for\(let i=0;i<5;i\+\+\)/);
 assert.match(scenery,/real-booth-window-mullion/);
 assert.match(scenery,/jib-truss-angled-brace/);
});
test('gallery exposes all polished cover families and distinct DEV prototypes',()=>{
 assert.match(gallery,/styledCoverFamilies:BACKLOT_COVER_KITS/);
 assert.match(gallery,/FINISH V6/);
 assert.match(gallery,/experimentalIds:entries\.filter/);
});
test('finish pass leaves gameplay collision, navigation and save shape unchanged',()=>{
 assert.match(kits,/shell\.userData\.arenaObstacleId=o\.id/);
 assert.equal(BACKLOT.version,3);
 assert.equal(BACKLOT.world.obstacles.length,34);
 assert.equal(BACKLOT.world.obstacles.filter(o=>o.id.startsWith('loader-')).length,5);
 assert.equal(BACKLOT.world.obstacles.filter(o=>o.id.startsWith('tractor-')).length,7);
 for(const file of [machines,salvage,audit,scenery])
  assert.doesNotMatch(file,/world\.obstacles\.push|localStorage|arenaObstacleId\s*=/);
});
