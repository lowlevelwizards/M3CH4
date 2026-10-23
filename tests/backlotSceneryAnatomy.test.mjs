import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {BACKLOT} from '../maps/backlot.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const scene=read('backlotSceneryAnatomy.js');
const derby=read('backlotDerbyWorld.js');
test('spectator rebuilds are physical assemblies not flat anonymous boxes',()=>{
 for(const feature of [
  'real-scaffold-upright','scaffold-cross-brace','raised-booth-plank-deck',
  'real-booth-window-mullion','rear-ladder-rung','individual-wooden-bleacher-bench',
  'bleacher-side-hand-rail','canopy-wire-guy','actual-sloping-barn-roof',
  'suspended-sliding-barn-door','crane-mast-leg',
  'steel-lattice-diagonal','jib-truss-angled-brace','crane-winch-drum',
  'vertical-hoist-cable','scoreboard-header-lintel'])
  assert.ok(scene.includes(feature),feature);
 assert.match(scene,/export function upgradeBacklotScenery\(root,world\)/);
});
test('live and gallery draw identical scenic upgrades with original signs preserved',()=>{
 assert.match(derby,/dirtMarks\(root,world\);spectatorYard\(root,world\);\s*upgradeBacklotScenery\(root,world\)/);
 assert.match(derby,/spectatorYard\(source,world\);\s*upgradeBacklotScenery\(source,world\)/);
 assert.ok(!scene.includes("'derby-announcer-sign'"));
 assert.ok(!scene.includes("'backlot-manual-scoreboard'"));
 assert.match(scene,/visualOnly:true/);
});
test('spectator upgrade never adjusts cover/AI or modifies Backlot navigation',()=>{
 assert.doesNotMatch(scene,/arenaObstacleId|world\.obstacles\.|localStorage|raycaster|collisionSolids/);
 assert.equal(BACKLOT.world.obstacles.length,34);
 assert.equal(BACKLOT.version,3);
});
