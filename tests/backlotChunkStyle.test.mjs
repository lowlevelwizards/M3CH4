import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {BACKLOT} from '../maps/backlot.js';

const source=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const machines=source('backlotAnatomicalMachines.js');
const salvage=source('backlotAnatomicalSalvage.js');
const tractor=source('backlotAnatomicalTractor.js');
const primitives=source('propAnatomyPrimitives.js');
const gallery=source('backlotPropGallery.js');
const html=source('backlot-prop-gallery.html');

test('loader reads as large bucket, broad tracks and heavy connected machinery',()=>{
 assert.match(machines,/FINISH V6/);
 assert.match(machines,/i<=6;i\+\+\)route\.push/);
 assert.match(machines,/for\(let tooth=0;tooth<6;tooth\+\+\)/);
 assert.match(machines,/connected-crawler-track-shoe',\.85,\.23,\.48/);
 assert.match(machines,/for\(let i=0;i<5;i\+\+\)\{\s*const xx=-2\.15\+i\*1\.08/);
 assert.match(machines,/welded-bucket-backplate/);
 assert.match(machines,/exposed-chrome-piston/);
});
test('combine and pickup have chunky recognizable mass rather than tiny repeated detail',()=>{
 assert.match(machines,/grain-hopper-tapered-bin/);
 assert.match(machines,/for\(let t=0;t<4;t\+\+\)/);
 assert.match(machines,/for\(let i=0;i<6;i\+\+\)\{\s*const x=-2\.50\+i\*1\.0/);
 assert.match(machines,/harvester-cab-roof',2\.68,\.26/);
 assert.match(machines,/truck-pneumatic-tyre/);
 assert.match(machines,/radius:\.66,width:\.39,hub:\.20,treadCount:8/);
 assert.match(machines,/creased-cab-roof',2\.36,\.26/);
 assert.match(machines,/for\(let i=0;i<3;i\+\+\)metal\(g,'truck-open-radiator-slat'/);
});
test('engine and salvage resolve into major assemblies with fewer details',()=>{
 assert.match(machines,/for\(let i=0;i<3;i\+\+\)\{\s*const z=-1\.02\+i\*1\.02/);
 assert.match(machines,/giant-open-flywheel',\.91,\.34/);
 assert.match(salvage,/for\(let i=0;i<5;i\+\+\)\{\s*const a=i\*Math\.PI\*2\/5/);
 assert.match(salvage,/individual-grounded-tractor-tyre-/);
 assert.match(salvage,/const placement=\[/);
 assert.match(salvage,/real-open-tyre-sidewall/);
 assert.match(salvage,/for\(let i=0;i<2;i\+\+\)\{\s*const x=-\.71\+i\*1\.42/);
 assert.match(salvage,/for\(let i=0;i<7;i\+\+\)\{\s*const z=-2\.49\+i\*\.83/);
 assert.doesNotMatch(salvage,/for\(let i=0;i<10;i\+\+\)cylinder\(g,'individual-weld-head'/);
 assert.match(salvage,/FINISH V6/);
});
test('shared tyres and tractor trim match broad silhouette hierarchy',()=>{
 assert.match(primitives,/treadCount=8/);
 assert.match(primitives,/radius\*\.78,radius\*\.27/);
 assert.match(tractor,/cab-floating-canopy-roof',2\.98,\.27/);
 assert.match(tractor,/front-steered-wheel/);
 assert.match(tractor,/diesel-four-cylinder-head/);
 assert.match(tractor,/operator-cage-vertical-post/);
});
test('gallery labels are specific to each experiment and do not mislabel pickup as tractor',()=>{
 assert.match(html,/id="gallery-experiment-title"/);
 assert.doesNotMatch(html,/TRACTOR REBUILD LAB/);
 assert.match(gallery,/\$\('gallery-experiment-title'\)\.textContent=e\.label/);
 assert.match(gallery,/FINISH V6/);
});
test('stylistic rebuild does not change certified Backlot combat geometry',()=>{
 assert.equal(BACKLOT.version,3);
 assert.equal(BACKLOT.world.obstacles.length,34);
 assert.equal(BACKLOT.world.obstacles.filter(o=>o.id.startsWith('tractor-')).length,7);
 assert.equal(BACKLOT.world.obstacles.filter(o=>o.id.startsWith('loader-')).length,5);
 for(const s of [machines,salvage,tractor,primitives])
  assert.doesNotMatch(s,/arenaObstacleId|world\.obstacles\.push|localStorage/);
});
