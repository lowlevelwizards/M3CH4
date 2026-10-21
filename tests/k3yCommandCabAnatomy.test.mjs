/** k.3y registry, mounting and non-gameplay migration regression gates.
 * The browser audit performs real Three.js transformed-mesh/raycast checks.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {BY_ID,CATALOG,makeTestAssembly,equip,inspectAssembly} from '../components.js';
import {fitFixtureFor} from '../chassisFitFixtures.js';
const src=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');
const ids=['cab-cyclops','cab-utility','cab-armored'];
test('the three existing command IDs still own original mass, power and envelope',()=>{
    assert.equal(CATALOG.filter(p=>p.slot==='command').length,3);
    for(const [id,envelope,mass,power] of [
        ['cab-cyclops',[1.24,.90,1.14],350,-8],
        ['cab-utility',[1.14,1.16,1.10],295,-11],
        ['cab-armored',[1.50,1.02,1.24],460,-20],
    ]){
        const part=BY_ID.get(id),fixture=fitFixtureFor(id);
        assert.ok(part&&fixture,id);
        assert.deepEqual(part.envelope,envelope,id);
        assert.deepEqual(fixture.envelope,envelope,id);
        assert.equal(part.massKg,mass,id);
        assert.equal(fixture.massKg,mass,id);
        assert.equal(part.powerKw,power,id);
        assert.equal(fixture.slot,'command');
        assert.equal(fixture.nativeStandard,'medium');
        assert.deepEqual(fixture.mountNormal,[0,-1,0]);
        assert.deepEqual(fixture.mountPoint,[0,-envelope[1]/2,0]);
    }
});
test('all nine chassis/command loadouts remain legal in existing assembly system',()=>{
    for(const frame of ['frame-sr','frame-utility','frame-wedge']){
        for(const id of ids){
            const assembly=makeTestAssembly();
            equip(assembly,'structure',frame);
            equip(assembly,'command',id);
            assert.equal(inspectAssembly(assembly).ready,true,frame+' / '+id);
        }
    }
});
test('only single authored builders service shared registry, legacy cab switch cases are gone',()=>{
    const registry=src('partVisuals.js'),scene=src('scene.js');
    for(const [id,name,file] of [
        ['cab-cyclops','buildCyclopsVisual','cyclopsVisual.js'],
        ['cab-utility','buildVistaVisual','vistaVisual.js'],
        ['cab-armored','buildHearthVisual','hearthVisual.js'],
    ]){
        assert.match(registry,new RegExp("'"+id+"':\\s*"+name));
        assert.ok(src(file).includes('finishCommandVisual'),id);
        assert.doesNotMatch(scene,new RegExp("case '"+id+"'"),id+' legacy model still installed');
    }
    assert.match(scene,/const sharedVisual = buildPartVisual\(def\.id, \{ mode: 'gameplay' \}\)/);
    assert.match(scene,/meshes\.push\(node\)/);
    assert.match(scene,/pickMeshes\.push\(node\)/);
    assert.match(scene,/node\.userData\.slot = slot/);
    for(const name of ['legs-yard','legs-compact','legs-hauler'])
        assert.ok(registry.includes("'"+name+"':"),name+' mobility overwritten');
    for(const name of ['gun-cannon','gun-short','gun-light','gun-scatter'])
        assert.ok(registry.includes("'"+name+"':"),name+' new weapon registry overwritten');
});
test('command construction uses physical primitive shells; no new special damage rules',()=>{
    const kit=src('commandVisualKit.js');
    for(const token of ['new THREE.BoxGeometry','new THREE.CylinderGeometry',
        'new THREE.ExtrudeGeometry','new THREE.BufferGeometry','new THREE.Box3',
        'assertCommandEnvelope','mountCollar'])assert.ok(kit.includes(token),token);
    const cyclops=src('cyclopsVisual.js'),vista=src('vistaVisual.js'),hearth=src('hearthVisual.js');
    assert.match(cyclops,/square structural optical carrier/);
    assert.match(cyclops,/single protected teal objective/);
    assert.match(vista,/single high windscreen/);
    assert.match(vista,/mustard windscreen pillar/);
    assert.match(hearth,/massive lower cream blast wedge/);
    assert.match(hearth,/deep recessed black vision aperture/);
    for(const content of [kit,cyclops,vista,hearth])
        assert.doesNotMatch(content,/applyTargetHit|localStorage|SLOT_CENTERS|addEventListener/);
});
test('true gallery mounts the same command visuals; first-person identities remain separate',()=>{
    const page=src('cab-anatomy.html'),lab=src('commandAnatomyLab.js');
    assert.match(page,/commandAnatomyLab\.js/);
    assert.match(lab,/buildPartVisual\(id\)/);
    assert.match(lab,/setCommandGraybox/);
    assert.match(lab,/renderer\.setScissorTest\(true\)/);
    assert.match(src('sceneAssembly.js'),/installCockpitIdentities/);
    assert.doesNotMatch(src('partVisuals.js'),/cockpitIdentityScene/);
});
