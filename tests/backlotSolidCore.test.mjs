import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {BACKLOT} from '../maps/backlot.js';
const source=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const machines=source('backlotAnatomicalMachines.js');
const salvage=source('backlotAnatomicalSalvage.js');
const tractor=source('backlotAnatomicalTractor.js');
const audit=source('backlotAssemblyAudit.js');
const gallery=source('backlotPropGallery.js');
const catalog=source('backlotDerbyWorld.js');

test('machine cores connect existing working assemblies without erasing intended apertures',()=>{
 for(const p of [
  'loader-main-transmission-belly','loader-front-bulkhead','loader-operator-pedestal',
  'combine-solid-thresher-core','combine-supported-grain-bin',
  'combine-cab-rear-firewall','combine-operator-footwell',
  'combine-reinforced-feeder-case','combine-header-receiving-trough',
  'pickup-deep-engine-bay','pickup-solid-rear-cab-wall',
  'pickup-firewall-bellhousing','pickup-lower-dashboard',
  'engine-structural-gearbox-bell','coupling-lower-bearing-plinth',
 ])
  assert.ok(machines.includes("'"+p+"'"),p);
 for(const p of ['tractor-integrated-clutch-bellhousing',
  'tractor-rear-gearbox-backbone','tractor-driver-running-board-edge',
  'tractor-side-fuel-tank'])
  assert.ok(tractor.includes("'"+p+"'"),p);
 assert.match(machines,/welded-hollow-bucket-floor/);
 assert.match(machines,/rollover-cage-upright/);
 assert.match(tractor,/visible-steering-wheel/);
});
test('tire salvage is a compact physically arranged pile with hollow bead geometry',()=>{
 assert.match(salvage,/GROUNDED THREE-TYRE AGRICULTURAL SCRAP PILE/);
 assert.match(salvage,/individual-grounded-tractor-tyre-/);
 assert.match(salvage,/open-rubber-tyre-inner-bead/);
 assert.match(salvage,/broad-circumferential-tyre-lug/);
 assert.match(salvage,/tilt:\.84/);
 assert.doesNotMatch(salvage,/old-rack-upright|old-rack-beam/);
});
test('salvage machines and cargo gain joined physical supports',()=>{
 for(const p of ['generator-coupled-machinery-bed',
  'generator-alternator-bottom-cradle','turbine-structural-bearing-stand',
  'turbine-centre-bearing-case','gear-cargo-support-cradle',
  'continuous-scrap-wall-foundation','continuous-container-roof-deck'])
  assert.ok(salvage.includes("'"+p+"'"),p);
});
test('assembly adjacency checks run on real DEV specimens before instancing',()=>{
 for(const f of ['tractor','loader','combine','pickup','engine',
  'coupling','generator','turbine','flatbed','container','barricade'])
  assert.ok(audit.includes(f+':['),f);
 assert.match(audit,/new THREE\.Box3\(\)\.setFromObject/);
 assert.match(audit,/separation>maxGap/);
 assert.match(audit,/family==='tyres'/);
 assert.match(catalog,/auditBacklotAssembly\(newPart,exhibit\.id\)/);
 assert.match(catalog,/auditBacklotAssembly\(newPart,'tractor'\)/);
 assert.match(gallery,/assemblyAudits:entries\.filter/);
 assert.match(gallery,/gallery-angle-cycle/);
});
test('structural prototype work leaves the exact live obstacle layout and damage rules intact',()=>{
 assert.equal(BACKLOT.version,3);
 assert.equal(BACKLOT.world.obstacles.length,34);
 assert.equal(BACKLOT.world.obstacles.filter(o=>o.id.startsWith('tractor-')).length,7);
 assert.equal(BACKLOT.world.obstacles.filter(o=>o.id.startsWith('loader-')).length,5);
 for(const src of [machines,salvage,tractor,audit])
  assert.doesNotMatch(src,/world\.obstacles\.push|localStorage|arenaObstacleId/);
});
