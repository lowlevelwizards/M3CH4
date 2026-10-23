import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {factoryGraphic} from '../factoryIdentityPolicy.js';
import {CATALOG} from '../components.js';
const src=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('every physical catalogue part has a small, stable maker and model mark',()=>{
 for(const def of CATALOG){
   const graphic=factoryGraphic(def.id);
   assert.ok(graphic,def.id);
   assert.ok(graphic.maker.length>=5&&graphic.maker.length<32);
   assert.ok(graphic.model.length>=4&&graphic.model.length<=24);
   assert.ok(!graphic.maker.includes('SERIAL'));
 }
 assert.equal(factoryGraphic('not-a-part'),null);
});
test('factory markings never impersonate a serialized owner or change paint data',()=>{
 const a=factoryGraphic('legs-compact');
 assert.equal(a.maker,'YARD MACHINE');
 assert.equal(a.model,'YW / KESTREL');
 assert.equal(factoryGraphic('legs-hauler').model,'YW / HAULER H2');
 assert.ok(Object.isFrozen(a));
 const visuals=src('factoryIdentityVisuals.js');
 assert.match(visuals,/const materials=new Map\(\)/);
 assert.match(visuals,/new THREE\.MeshStandardMaterial/);
 assert.match(visuals,/map\.magFilter=THREE\.NearestFilter/);
 assert.match(visuals,/node\.add\(plate\)/);
 assert.doesNotMatch(visuals,/pickMeshes\.push|owned\.push|storeMachine\(|damagePart\(|localStorage\.|indexedDB\./);
});
test('real build only adds model decals after physical part finish and service history',()=>{
 const scene=src('scene.js');
 const mark=scene.indexOf('addFactoryIdentityPlate(group,fitted.definition.id)');
 const paint=scene.indexOf('applyPartFinish(group,fitted.definition.id,fitted.instance.paint)');
 const service=scene.indexOf('addPhysicalServiceStamp(group,fitted.instance)');
 assert.ok(mark>service&&service>paint);
 const renderer=src('factoryIdentityVisuals.js');
 assert.match(renderer,/!\['BoxGeometry','ExtrudeGeometry'\]\.includes/);
 assert.match(renderer,/w<\.55\|\|h<\.34/);
});
