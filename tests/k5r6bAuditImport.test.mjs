import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('the actual cockpit render audit bypasses the game scene import-map wrapper',()=>{
 const html=source('index.html');
 const audit=source('research/browserStartupSmoke.mjs');
 const realScene=source('scene.js');
 const wrapper=source('sceneAssembly.js');
 assert.match(html,/"\.\/scene\.js": "\.\/sceneAssembly\.js\?v=k5r8"/);
 assert.match(wrapper,/scene\.js\?source=k5r8/);
 assert.match(realScene,/export function buildCockpit\(scene\)/);
 assert.match(audit,/import\('\.\/scene\.js\?source=k5r8'\)/);
 assert.match(audit,/RELOAD COCKPIT: PASS/);
 assert.match(audit,/k5r8-all-eight-cockpit-reloads\.png/);
});
