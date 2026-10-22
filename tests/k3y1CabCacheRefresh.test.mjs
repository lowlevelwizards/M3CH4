import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
test('k3z cache refresh has one coherent real-game module identity',()=>{
    const html=read('index.html'),bridge=read('sceneAssembly.js'),scene=read('scene.js');
    assert.match(html, /"\.\/scene\.js": "\.\/sceneAssembly\.js\?v=k4w1"/);
    assert.match(html, /src="\.\/main\.js\?v=k4w1"/);
    assert.match(html, /0\.0\.1k\.4s\.3 — Deploy and Layout/);
    assert.match(bridge, /from '\.\/scene\.js\?source=k4w1'/);
    assert.match(scene, /from '\.\/partVisuals\.js\?v=k4w1'/);
    assert.doesNotMatch(html, /sceneAssembly\.js\?v=k3x|main\.js\?v=k3x/);
    assert.doesNotMatch(bridge, /scene\.js\?source=k3x/);
    assert.doesNotMatch(scene, /partVisuals\.js\?v=k3x/);
});
test('updated live part registry retains cab, weapon and mobility builders',()=>{
    const registry=read('partVisuals.js');
    for(const id of ['cab-cyclops','cab-utility','cab-armored','gun-cannon',
        'gun-short','gun-light','gun-scatter','gun-rivet','gun-breaker','legs-yard','legs-compact','legs-hauler'])
        assert.ok(registry.includes("'"+id+"':"),'missing shared builder: '+id);
    assert.match(read('scene.js'),/const sharedVisual = buildPartVisual\(def\.id, \{ mode: 'gameplay' \}\)/);
});
