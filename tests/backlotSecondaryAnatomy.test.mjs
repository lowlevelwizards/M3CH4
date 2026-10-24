import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {BACKLOT} from '../maps/backlot.js';

const src=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const anatomy=src('backlotSecondaryAnatomy.js');
const world=src('backlotDerbyWorld.js');
const environment=src('backlotEnvironmentPass.js');

test('the new batch replaces eighteen existing boxy offsite objects, no new gameplay cover',()=>{
 assert.match(anatomy,/addedAssemblies:18/);
 assert.match(anatomy,/trailers:8,shacks:2,silos:3,poles:3,gates:2/);
 for(const part of [
  'outside-scrap-trailer','outside-trailer-tyre','shack-body',
  'shack-sheet-roof','farm-grain-silo','silo-corrosion-band',
  'distant-power-pole','entry-gate-column','hog-pen-entrance-pylon'
 ])assert.ok(anatomy.includes("'"+part+"'"),part);
 assert.match(environment,/crown\.name='farm-silo-conical-crown'/);
 assert.equal(BACKLOT.version,3);
 assert.equal(BACKLOT.world.obstacles.length,34);
 assert.doesNotMatch(anatomy,/world\.obstacles\s*\.|localStorage|arenaObstacleId/);
});
test('wagon family has actual running gear and two unique chassis/load types',()=>{
 for(const item of [
  'wagon-structural-longitudinal-frame','wagon-strong-crossmember',
  'wagon-solid-cross-axle','wagon-agricultural-wheel',
  'wagon-heavy-deck','wagon-solid-sidewall','wagon-upper-rim-beam',
  'wagon-rear-drop-tailgate','wagon-trailer-drawbar',
  'flatbed-salvage-engine-casting','flatbed-broken-flywheel',
 ])assert.ok(anatomy.includes("'"+item+"'"),item);
 assert.match(anatomy,/i%2\?'salvage-flatbed':'farm-wagon'/);
});
test('shacks have supported pitched roofs, real doors and distinguishable interiors',()=>{
 for(const item of [
  'shack-side-structural-wall','shack-rear-cladding',
  'mechanic-bay-raised-concrete-threshold','mechanic-solid-workbench',
  'fuel-shack-hinged-door-pivot','fuel-shack-actual-timber-door',
  'shack-one-piece-pitched-roof','shack-roof-ridge',
 ])assert.ok(anatomy.includes("'"+item+"'"),item);
});
test('silos, power poles and gates are assemblies rather than single block primitives',()=>{
 for(const item of [
  'silo-corrugated-main-cylinder','silo-functional-cone-roof',
  'silo-service-ladder-rail','silo-horizontal-discharge-pipe',
  'power-heavy-timber-upright','power-transformer-tank',
  'power-ceramic-insulator','gate-heavy-angled-foot',
  'gate-diagonal-truss','gate-main-crossbeam',
 ])assert.ok(anatomy.includes("'"+item+"'"),item);
});
test('live and DEV gallery use exactly the same scenery builder',()=>{
 assert.match(world,/upgradeBacklotSecondaryProps\(root,world\)/);
 assert.match(world,/upgradeBacklotSecondaryProps\(source,world\)/);
 assert.match(world,/secondary-derby-gate/);
 assert.match(world,/secondary-fuel-counter-shack/);
 assert.match(world,/secondary-working-grain-silo-0/);
 assert.match(world,/secondary-trailer-farm-wagon-0/);
 assert.match(world,/secondary-trailer-salvage-flatbed-1/);
 assert.match(world,/batch-completed-secondary-scenery/);
 assert.match(world,/secondaryInstances-secondaryBatches/);
});
test('four in-play floodlight pylons receive real hardware on the correct render path',()=>{
 const idx=world.indexOf('if(pillar){');
 assert.ok(idx>0);
 const rendering=world.slice(idx,idx+1500);
 assert.match(rendering,/arena-light-structural-mast-collar/);
 assert.match(rendering,/arena-light-maintenance-junction-box/);
 assert.match(rendering,/arena-light-outboard-brace/);
 assert.match(rendering,/welded-lamp-mast/);
 assert.equal(BACKLOT.world.obstacles.filter(o=>o.kind==='pillar').length,4);
});
test('secondary updates do not alter the certified obstacle ID or geometry',()=>{
 for(const id of ['tractor-','loader-'])
  assert.ok(BACKLOT.world.obstacles.some(o=>o.id.startsWith(id)));
 assert.equal(BACKLOT.world.obstacles.filter(o=>o.id.startsWith('loader-')).length,5);
 assert.equal(BACKLOT.world.obstacles.filter(o=>o.id.startsWith('tractor-')).length,7);
});
