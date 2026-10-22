import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createSeries,storeSeries,loadSeries,clearSeries} from '../series.js';
import {beginSortieAssignment,loadSortieAssignment,assignRigToSortie,clearSortieAssignment} from '../sortieAssignment.js';
const src=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');
const storage=()=>new class {
    #values=new Map();
    getItem(key){return this.#values.get(key)??null;}
    setItem(key,v){this.#values.set(key,String(v));}
    removeItem(key){this.#values.delete(key);}
}();

test('completed BO3 series can coexist with a new pending assignment and be retired',()=>{
    const saved=storage(),session=storage();
    const previous=createSeries('yard-dog','rig-01');
    previous.phase='complete';previous.finalVictory=true;previous.completedAt=Date.now();
    assert.equal(storeSeries(saved,previous),true);
    assert.equal(loadSeries(saved)?.phase,'complete');
    assert.equal(beginSortieAssignment(session,'domination').ok,true);
    assert.equal(assignRigToSortie(session,'rig-01','SCRAPYARD RIG').ok,true);
    const pending=loadSortieAssignment(session);
    assert.equal(pending.contractId,'domination');
    assert.equal(pending.phase,'pending');
    assert.equal(clearSeries(saved),true);
    assert.equal(loadSeries(saved),null);
    assert.equal(loadSortieAssignment(session).contractId,'domination');
    assert.equal(clearSortieAssignment(session),true);
});
test('taking a job retires completed series but never an active round',()=>{
    const ui=src('unifiedGarageUI.js');
    assert.match(ui,/series\.phase!=='complete'/);
    assert.match(ui,/clearSeries\(storage\)/);
    assert.match(ui,/COULD NOT CLOSE PREVIOUS SORTIE/);
    assert.match(ui,/pending\?\.phase==='pending'\s*&&\s*\(!series \|\| series\.phase==='complete'\)/);
    assert.match(ui,/JOB SELECTED/);
    assert.match(ui,/job\?'DEPLOY':'SELECT JOB'/);
    assert.match(ui,/oldDeploy\.click\(\)/);
});
test('module popup is center-aligned and mathematically bounded by header/footer',()=>{
    const css=src('k4s3Layout.css');
    assert.match(css,/--k4s-footer-safe:83px/);
    assert.match(css,/\.tool-open #unified-garage-dock\{/);
    assert.match(css,/transform:translateY\(-50%\)/);
    assert.match(css,/max-height:calc\(100% - var\(--k4s-header\) - var\(--k4s-footer-safe\)/);
    assert.match(css,/\.drawer-open #unified-garage-dock\{/);
});
test('briefing is one screen, rig name and utility buttons are grouped',()=>{
    const ui=src('unifiedGarageUI.js'),css=src('k4s3Layout.css');
    assert.match(ui,/contract-brief-heading/);
    assert.match(ui,/contract-brief-mission/);
    assert.match(ui,/contract-brief-notes/);
    assert.match(ui,/briefing-open/);
    assert.match(css,/\.briefing-open #unified-garage-dock\{/);
    assert.match(css,/overflow:hidden;justify-content:center/);
    assert.match(ui,/workshop-rig-name/);
    assert.match(css,/\.workshop-top-links\{\s*display:flex;position:static/);
    assert.match(ui,/SERIALIZED MODULES/);
    assert.match(ui,/MODULE RACK/);
});
test('mobile page loads fresh k4s.3 CSS and the deploy fix JS',()=>{
    const html=src('index.html'),adapter=src('garageMountUI.js');
    assert.match(html,/0\.0\.1k\.4(?:s\.3 — Deploy and Layout|y\.1 — Input & Repair Stability)/);
    assert.match(html,/k4s3Layout\.css\?v=k4s3/);
    assert.match(html,/unifiedGarageUI\.js\?v=k4w5/);
    assert.match(adapter,/unifiedGarageUI\.js\?v=k4w5/);
    assert.ok(html.indexOf('k4s3Layout.css')>html.indexOf('k4s2GarageFlow.css'));
});
