import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MAPS} from '../maps/mapRegistry.js';
import {MAP_ATMOSPHERE,atmosphereForMap} from '../maps/mapAtmosphere.js';
const scene=readFileSync(new URL('../scene.js',import.meta.url),'utf8');

test('each circuit venue has a distinct and restrained physical atmosphere',()=>{
 assert.equal(MAPS.length,3);
 const profiles=MAPS.map(atmosphereForMap);
 assert.equal(new Set(profiles.map(x=>x.background)).size,3);
 assert.equal(new Set(profiles.map(x=>x.fog)).size,3);
 assert.ok(profiles.every(p=>p.fogDensity>=.005&&p.fogDensity<=.015));
 assert.ok(profiles.every(p=>p.keyMultiplier>=.78&&p.keyMultiplier<=1.2));
 assert.ok(profiles.every(p=>p.rimMultiplier>=.78&&p.rimMultiplier<=1.2));
 assert.ok(profiles.every(Object.isFrozen));
 assert.ok(Object.isFrozen(MAP_ATMOSPHERE));
 assert.throws(()=>atmosphereForMap({id:'forgotten-warehouse'}));
});
test('all three atmospheres reuse the actual gameplay scene lights',()=>{
 assert.match(scene,/const venueAtmosphere=atmosphereForMap\(arenaMap\)/);
 assert.match(scene,/new THREE\.Color\(venueAtmosphere\.background\)/);
 assert.match(scene,/new THREE\.FogExp2\(venueAtmosphere\.fog,venueAtmosphere\.fogDensity\)/);
 assert.match(scene,/new THREE\.HemisphereLight\(venueAtmosphere\.hemisphereSky,venueAtmosphere\.hemisphereGround,arenaLight\.ambient\)/);
 assert.match(scene,/new THREE\.DirectionalLight\(venueAtmosphere\.sunlight,arenaLight\.key\*venueAtmosphere\.keyMultiplier\)/);
 assert.match(scene,/new THREE\.DirectionalLight\(venueAtmosphere\.rim,arenaLight\.rim\*venueAtmosphere\.rimMultiplier\)/);
 assert.match(scene,/new THREE\.PointLight\(practicalAtmosphere\.fixture,arenaLight\.fixtureIntensity,14,2\.15\)/);
 assert.equal((scene.match(/sun\.shadow\.mapSize\.set/g)||[]).length,1);
});
