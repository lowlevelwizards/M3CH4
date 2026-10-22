import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {winningMachines} from '../winnerTableau.js';
const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const rig=(id,team,active=true)=>({id,label:'RIG '+id,
  team,active,assembly:{name:'RIG '+id,installed:{}}});
test('post-bout winners are chosen by authoritative winning side, not survivor count',()=>{
  const player=rig('player','friendly');
  const allies=[rig('f1','friendly'),rig('f2','friendly',false)];
  const hostiles=[rig('e1','hostile'),rig('e2','hostile'),rig('e3','hostile')];
  assert.deepEqual(winningMachines(true,player,allies,hostiles).map(x=>x.id),
    ['player','f1','f2']);
  assert.deepEqual(winningMachines(false,player,allies,hostiles).map(x=>x.id),
    ['e1','e2','e3']);
  assert.equal(winningMachines(true,player,allies,hostiles)[2].operational,false);
});
test('winner visual cards use actual rig previews and do not change three report pages',()=>{
  const main=source('main.js'),html=source('index.html'),css=source('winnerTableau.css');
  assert.match(main,/renderWinningMachines\(winnerTableau,winners,arena\.rigThumbnailDataUrl\)/);
  assert.match(main,/aiActors\.filter\(actor=>actor\.team===HOSTILE_TEAM\)/);
  assert.match(html,/id="winner-tableau"/);
  assert.match(html,/data-debrief-target="2"/);
  assert.match(css,/grid-template-columns:repeat\(3/);
  assert.match(css,/image-rendering:pixelated/);
  assert.doesNotMatch(source('winnerTableau.js'),/new THREE\.WebGLRenderer|storeMachine|storeStable/);
});
