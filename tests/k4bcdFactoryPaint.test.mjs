import test from 'node:test';
import assert from 'node:assert/strict';
import {
    FACTORY_FINISHES,PAINT_CHANNELS,PAINT_PRESETS,PAINT_ROLE_CHANNEL,
    factoryFinishFor,normalizePaint,validPaint,readUserPalettes,storeUserPalette,
    deleteUserPalette,paintForPart
} from '../factoryPaint.js';
const all=[
    'frame-sr','frame-utility','frame-wedge','legs-yard','legs-compact',
    'legs-hauler','gun-cannon','gun-short','gun-light','gun-scatter',
    'cab-cyclops','cab-utility','cab-armored','power-dynamo','power-air'
];
test('every catalogue part has a restrained, unique factory coating',()=>{
    assert.deepEqual(Object.keys(FACTORY_FINISHES).sort(),all.sort());
    for (const id of all) assert.ok(validPaint(factoryFinishFor(id)),id);
    assert.ok(new Set(all.map(id=>JSON.stringify(factoryFinishFor(id)))).size>=12);
    for (const id of all) assert.ok(!factoryFinishFor(id).primary.startsWith('#b2'),id);
});
test('only four coating roles are paintable and optical/metal are excluded',()=>{
    assert.deepEqual(PAINT_CHANNELS,['primary','secondary','armor','accent']);
    assert.equal(PAINT_ROLE_CHANNEL.machined,undefined);
    assert.equal(PAINT_ROLE_CHANNEL['dark-mechanism'],undefined);
    assert.equal(PAINT_ROLE_CHANNEL.optical,undefined);
    assert.equal(PAINT_ROLE_CHANNEL.structure,undefined);
});
test('owner paint is normalized and does not alias palette defaults',()=>{
    const colors={primary:'#AA00CC',secondary:'#557788',armor:'#e5dec9',accent:'#F1A500'};
    assert.equal(validPaint(colors),true);
    assert.equal(normalizePaint(colors).primary,'#aa00cc');
    assert.equal(normalizePaint({...colors,unknown:'#000000'}),null);
    assert.equal(normalizePaint({...colors,primary:'url(foo)'}),null);
    assert.equal(paintForPart({definitionId:'frame-sr'}),factoryFinishFor('frame-sr'));
    assert.equal(paintForPart({definitionId:'frame-sr',paint:colors}).primary,'#aa00cc');
    assert.ok(PAINT_PRESETS.every(p=>validPaint(p.colors)));
});
test('saved workshop palettes persist safely and reject invalid data',()=>{
    const db=new Map(),storage={getItem:k=>db.get(k),setItem:(k,v)=>db.set(k,v)};
    assert.equal(readUserPalettes(storage).length,0);
    assert.equal(storeUserPalette(storage,'HERITAGE',PAINT_PRESETS[0].colors),true);
    assert.equal(readUserPalettes(storage)[0].name,'HERITAGE');
    assert.equal(storeUserPalette(storage,'heritage',PAINT_PRESETS[1].colors),true);
    assert.equal(readUserPalettes(storage).length,1);
    assert.equal(deleteUserPalette(storage,'heritage'),true); // removing a missing label leaves storage valid
    assert.equal(deleteUserPalette(storage,'HERITAGE'),true);
    assert.equal(readUserPalettes(storage).length,0);
    db.set('m3ch4-paint-palettes-v1','{"broken":true}');
    assert.deepEqual(readUserPalettes(storage),[]);
});
