import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {makeTestAssembly} from '../components.js';
import {rigCrewGraphic} from '../rigCrewGraphics.js';
const src=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('unit marks derive deterministically from actual serialized rig names and IDs',()=>{
 const assembly=makeTestAssembly();
 const mark=rigCrewGraphic(assembly);
 assert.ok(mark.crewName.includes('SCRAPYARD'));
 assert.match(mark.unitCode,/^[0-9]{2}$/);
 assert.equal(mark.sourceSerial,assembly.serial);
 assert.deepEqual(rigCrewGraphic(assembly),mark);
 assert.notEqual(rigCrewGraphic({...assembly,serial:'DIFFERENT-UNIT'}).sourceSerial,mark.sourceSerial);
 assert.equal(rigCrewGraphic({name:'NO SERIAL',installed:{}}),null);
});
test('crew labels are owner identity, never invented faction affiliation or war honors',()=>{
 const mark=rigCrewGraphic({serial:'FX-772',name:'Rust & Thunder'});
 assert.equal(mark.crewName,'RUST  THUNDER');
 assert.doesNotMatch(mark.crewName,/FACTION|SPONSOR/);
 assert.ok(Object.isFrozen(mark));
});
test('physical owner markings are attached once to real painted frame, not pick targets',()=>{
 const visuals=src('rigCrewVisuals.js'),scene=src('scene.js');
 assert.match(visuals,/best\.node\.add\(plate\)/);
 assert.match(visuals,/new THREE\.MeshStandardMaterial/);
 assert.match(visuals,/map\.magFilter=THREE\.NearestFilter/);
 assert.match(scene,/addRigCrewPlate\(partGroups\.get\('structure'\),assembly\)/);
 assert.doesNotMatch(visuals,/pickMeshes\.push|localStorage|storeMachine|window\.location/);
 assert.match(visuals,/const map=new THREE\.CanvasTexture\(canvas\)/);
});
