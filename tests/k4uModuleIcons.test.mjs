/** k4u — approved module pictogram contract. Keep physical shapes across
 * DOM controls and the live canvas cockpit; never mutate slot/save identifiers. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { STATION_ORDER, stationLabel } from '../uiLanguage.js';
import { MODULE_ICON_GEOMETRY,createModuleIcon,drawModuleIcon } from '../moduleIcons.js';

const read=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
class Element {
    constructor(tag){this.tagName=tag;this.children=[];this.attributes={};this.className='';this.textContent='';}
    append(...elements){this.children.push(...elements);}
    setAttribute(name,value){this.attributes[name]=String(value);}
}
test('five approved instrument icons use exact serialized station ids and nonidentical paths',()=>{
    assert.deepEqual(Object.keys(MODULE_ICON_GEOMETRY),STATION_ORDER);
    assert.deepEqual(STATION_ORDER.map(stationLabel),['FRAME','DRIVE','POWER','CAB','WEAPON']);
    const geometry=STATION_ORDER.map(slot=>MODULE_ICON_GEOMETRY[slot]);
    assert.equal(new Set(geometry.map(layers=>layers.map(layer=>layer.d).join('|'))).size,5);
    assert.ok(geometry.every(layers=>Object.isFrozen(layers)));
    // C is retained for frame, power, cab, weapon. Mobility is specifically D.
    assert.match(MODULE_ICON_GEOMETRY.structure[1].d,/M22 19L42 45/);
    assert.match(MODULE_ICON_GEOMETRY.mobility[0].d,/A12 12/);
    assert.match(MODULE_ICON_GEOMETRY.mobility.at(-1).d,/M7 54H25M39 54H57/);
    assert.match(MODULE_ICON_GEOMETRY.power[1].d,/L27 52L47 26/);
    assert.match(MODULE_ICON_GEOMETRY.command[1].d,/M15 27L24 20/);
    assert.match(MODULE_ICON_GEOMETRY.combat[1].d,/M43 25H60/);
});
test('all five pictograms render real SVG geometry with accessible decorative semantics',()=>{
    const original=globalThis.document;
    globalThis.document={
        createElement:tag=>new Element(tag),
        createElementNS:(ns,tag)=>{assert.equal(ns,'http://www.w3.org/2000/svg');return new Element(tag);},
    };
    try{
        for(const slot of STATION_ORDER){
            const icon=createModuleIcon(slot);
            assert.equal(icon.tagName,'svg');
            assert.equal(icon.attributes.viewBox,'0 0 64 64');
            assert.equal(icon.attributes['aria-hidden'],'true');
            assert.equal(icon.children.length,MODULE_ICON_GEOMETRY[slot].length);
            assert.ok(icon.children.every(node=>node.tagName==='path'));
            assert.ok(icon.children.some(node=>Object.values(node.attributes).some(v=>v.includes('module-icon-accent'))));
        }
        const unknown=createModuleIcon('not-a-slot');
        assert.equal(unknown.tagName,'span');
    }finally{globalThis.document=original;}
});
test('canvas draws matching canonical geometry with cached Path2D and no font symbol',()=>{
    const original=globalThis.Path2D;
    let constructed=0;
    globalThis.Path2D=class{constructor(d){this.d=d;constructed++;}};
    const commands=[];
    const ctx={
        save(){commands.push('save');},restore(){commands.push('restore');},
        translate(x,y){commands.push('translate');},scale(x,y){commands.push('scale');},
        fill(path){commands.push('fill');},stroke(path){commands.push('stroke');},
        fillText(){throw new Error('icon unexpectedly rendered as a font');},
    };
    try{
        for(const slot of STATION_ORDER)assert.equal(drawModuleIcon(ctx,slot,2,3,19),true);
        const count=constructed;
        assert.equal(drawModuleIcon(ctx,'mobility',2,3,19),true);
        assert.equal(constructed,count,'paths should be cached across cockpit frames');
        assert.equal(commands.filter(x=>x==='save').length,6);
        assert.equal(commands.filter(x=>x==='restore').length,6);
    }finally{globalThis.Path2D=original;}
});
test('every module-bearing UI consumes shared SVGs and cockpit uses shared canvas shapes',()=>{
    assert.match(read('uiMeters.js'),/createModuleIcon\(slot/);
    assert.match(read('partGridUI.js'),/createModuleIcon\(entry\?\.slot/);
    assert.match(read('unifiedGarageUI.js'),/createStationFace\(item\.slot,item\)/);
    assert.match(read('unifiedGarageUI.js'),/createModuleIcon\(slot/);
    assert.match(read('main.js'),/createModuleIcon\(slot/);
    assert.match(read('seriesUI.js'),/createModuleIcon\(p\.slot\)/);
    assert.match(read('cockpitDisplays.js'),/drawModuleIcon\(ctx,slot/);
    assert.doesNotMatch(read('main.js'),/const symbols = \{/);
    assert.doesNotMatch(read('cockpitDisplays.js'),/STATIONS\[slot\]\.glyph/);
});
