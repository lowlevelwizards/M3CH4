import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {physicalEvidenceDescription} from '../physicalEvidenceInspector.js';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
test('exact individual battle scars reveal genuine recorded outcomes',()=>{
 const strike=physicalEvidenceDescription({event:'impact',eventId:'a',serial:'S-4',
   armorAbsorbed:20,internalDamage:0,timestamp:1780000000000});
 const hole=physicalEvidenceDescription({event:'impact',eventId:'b',serial:'S-4',
   armorAbsorbed:3,internalDamage:16,timestamp:1780000000000});
 assert.equal(strike.title,'ARMOR STRIKE');
 assert.match(strike.detail,/20/);
 assert.equal(hole.title,'BREACH');
 assert.match(hole.detail,/16/);
 assert.equal(strike.serial,'S-4');
});
test('welded patch displays service event and real linked penetration, not invented geometry',()=>{
 const repair=physicalEvidenceDescription({event:'service',eventId:'repair-1',
   serial:'R-2',mode:'workshop-repair',coveredEventId:'impact-17',timestamp:1780000000000});
 assert.equal(repair.title,'WORKSHOP REPAIR');
 assert.match(repair.note,/impact-17/);
 const noLocation=physicalEvidenceDescription({event:'service',eventId:'repair-2',
   serial:'R-2',mode:'pit-triage',coveredEventId:null,timestamp:1780000000000});
 assert.match(noLocation.note,/No precise repair location/);
});
test('shop tally is a record of repairs and not a fake local bullet hit',()=>{
 const tally=physicalEvidenceDescription({type:'service-tally',serial:'SR12',repairs:4});
 assert.equal(tally.title,'SERVICE PLATE');
 assert.match(tally.detail,/4/);
 assert.match(tally.note,/location not implied/);
});
test('real physics-free evidence picking preserves the existing garage bay tool flow',()=>{
 const main=read('main.js'),scene=read('scene.js'),inspector=read('physicalEvidenceInspector.js');
 assert.match(scene,/function pickSurfaceEvidence\(clientX,clientY,canvas\)/);
 assert.match(scene,/raycaster\.intersectObjects\(picks,false\)/);
 assert.match(scene,/\.\.\.nearest\.userData\.serviceEvidence/);
 assert.match(main,/arena\.pickSurfaceEvidence\(event\.clientX,event\.clientY,renderer\.domElement\)/);
 assert.match(main,/physicalEvidenceCard\.open\(evidence,event\.clientX,event\.clientY\)/);
 assert.match(main,/const slot = arena\.pickPart\(/);
 assert.match(inspector,/card\.hidden=false;return true/);
 assert.doesNotMatch(inspector,/localStorage|storeMachine|storeSurfaceEvents|updateParent/);
});
