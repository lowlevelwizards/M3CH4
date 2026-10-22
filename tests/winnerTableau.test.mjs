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
test('in-engine winners animate as real physical rigs without a third WebGL renderer',()=>{
  const main=source('main.js'),html=source('index.html'),css=source('winnerTableau.css');
  const scene=source('scene.js');
  assert.match(main,/arena\.beginVictoryShowcase\(presentation\)/);
  assert.match(main,/arena\.updateVictoryShowcase\(frameDt\)/);
  assert.match(main,/arena\.endVictoryShowcase\(\)/);
  assert.match(main,/renderWinnerNameplates\(winnerTableau,presentation\)/);
  assert.match(scene,/poseCombatantExterior\(entry\.record/);
  assert.match(scene,/createSurfaceScarRenderer\(\{perSerialLimit:4\}\)/);
  assert.match(scene,/camera\.lookAt\(stage\.root\.position\.x/);
  assert.doesNotMatch(scene.slice(scene.indexOf('function beginVictoryShowcase'),scene.indexOf('function restoreSurfaceMarks')),/new THREE\.WebGLRenderer/);
  assert.match(main,/aiActors\.filter\(actor=>actor\.team===HOSTILE_TEAM\)/);
  assert.match(html,/id="winner-tableau"/);
  assert.match(html,/data-debrief-target="2"/);
  assert.match(css,/grid-template-columns:repeat\(3/);
  assert.match(css,/\.sortie-outro\.physical-showcase/);
  assert.match(scene,/entry\.visual\.root\.rotation\.y=Math\.PI/);
  assert.match(scene,/camera\.fov=43/);
  assert.match(main,/document\.body\.classList\.toggle\('victory-showcase',started\)/);
  assert.match(main,/document\.body\.classList\.remove\('victory-showcase'\)/);
  assert.match(css,/body\.victory-showcase #allied-observation/);
  assert.match(css,/body\.victory-showcase #fault-strip/);
  assert.ok(html.indexOf('id="winner-tableau"') > html.indexOf('</div>\n    <div id="winner-tableau"') || 
    /<\/div>\s*<div id="winner-tableau"/.test(html));
  assert.doesNotMatch(css,/\.sortie-outro:has\(\.winner-tableau/);
  assert.doesNotMatch(source('winnerTableau.js'),/new THREE\.WebGLRenderer|storeMachine|storeStable/);
});
