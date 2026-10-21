import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CATALOG,BY_ID,makeTestAssembly,equip,inspectAssembly,SLOT_CENTERS} from '../components.js';
import {fitFixtureFor} from '../chassisFitFixtures.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const entries=[
    ['frame-sr','bruiserFrameVisual.js','buildBruiserFrameVisual',1580,5100,[1.78,1,1.62]],
    ['frame-utility','skeletonFrameVisual.js','buildSkeletonFrameVisual',1290,4120,[1.55,.94,1.46]],
    ['frame-wedge','wedgeFrameVisual.js','buildWedgeFrameVisual',1450,4850,[1.88,.84,1.88]],
];
test('existing frames preserve identity, serial ordering, ratings and untouched catalogue sockets',()=>{
    assert.deepEqual(CATALOG.filter(p=>p.slot==='structure').map(p=>p.id),entries.map(e=>e[0]));
    assert.deepEqual(SLOT_CENTERS.structure,[0,1.82,.13]);
    for(const [id,, ,mass,limit,envelope] of entries){
        const p=BY_ID.get(id),f=fitFixtureFor(id);
        assert.equal(p.massKg,mass);assert.equal(p.loadLimitKg,limit);
        assert.deepEqual(p.envelope,envelope);assert.deepEqual(f.envelope,envelope);
        assert.equal(f.massKg,mass);assert.equal(f.loadLimitKg,limit);
        assert.deepEqual(f.center,p.center);assert.deepEqual(f.sockets,p.sockets);
        assert.deepEqual(f.sockets.map(s=>s.id),['mobility','power','command','combat','service-light','left-rear-utility']);
        for(const name of ['mobility','power','command','combat'])
            assert.deepEqual(f.sockets.find(s=>s.id===name).position,
                SLOT_CENTERS[name].map((n,i)=>n-SLOT_CENTERS.structure[i]));
    }
});
test('frame ID is a builder switch only; old three legacy cases are removed',()=>{
    const registry=read('partVisuals.js'),scene=read('scene.js');
    for(const [id,file,name] of entries){
        assert.ok(registry.includes("'"+id+"': "+name),id);
        assert.ok(read(file).includes('export function '+name),file);
        assert.doesNotMatch(scene,new RegExp("case '"+id+"'"),id);
    }
    assert.match(scene,/const sharedVisual = buildPartVisual\(def\.id, \{ mode: 'gameplay' \}\)/);
    assert.match(scene,/node\.userData\.slot = slot/);
    assert.match(scene,/pickMeshes\.push\(node\)/);
    for(const id of ['legs-yard','legs-compact','legs-hauler','gun-cannon','gun-short',
        'gun-light','gun-scatter','cab-cyclops','cab-utility','cab-armored'])
        assert.ok(registry.includes("'"+id+"':"),'lost existing builder '+id);
});
test('existing factory assemblies remain deployable and frame switches preserve serialization',()=>{
    for(const [id] of entries){
        const a=makeTestAssembly();
        const before=a.owned.map(item=>item.serial);
        equip(a,'structure',id);
        assert.equal(inspectAssembly(a).ready,true,id);
        assert.deepEqual(a.owned.map(item=>item.serial),before);
    }
});
test('authoring is actual opaque Three.js construction, no phantom hit or new game rule',()=>{
    const kit=read('frameVisualKit.js'),scene=read('scene.js');
    assert.match(kit,/toNonIndexed\(\)/);
    assert.match(kit,/finishFrameVisual/);
    assert.match(kit,/fixture\.sockets/);
    for(const [,file] of entries){
        const s=read(file);
        assert.ok(s.includes('finishFrameVisual(r,fixture)'));
        assert.ok(s.includes("socket(fixture,'mobility')"));
        assert.ok(s.includes("socket(fixture,'combat')"));
        assert.doesNotMatch(s,/applyTargetHit|localStorage|SLOT_CENTERS|damageMultiplier|MeshBasicMaterial/);
    }
    assert.doesNotMatch(scene,/function wedgeHull\(/);
    assert.ok(read('frameAnatomyLab.js').includes('buildExteriorRig(a)'));
    assert.ok(read('frameAnatomyLab.js').includes('buildPartVisual(id)'));
});
