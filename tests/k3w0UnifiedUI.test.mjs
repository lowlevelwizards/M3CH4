import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {STATION_ORDER,STATIONS,stationLabel,stationGlyph,
  conditionReading,conditionFromPart,formatCondition,UI_COLORS} from '../uiLanguage.js';
import {createConditionMeter,createStationFace,updateConditionMeter} from '../uiMeters.js';
const source=path=>fs.readFileSync(new URL('../'+path,import.meta.url),'utf8');
class Node {
    constructor(tag){this.tagName=tag;this.children=[];this.attributes={};this.dataset={};
      this.style={values:{},setProperty:(k,v)=>{this.style.values[k]=v}};this.className='';this.textContent='';}
    append(...nodes){this.children.push(...nodes)}
    setAttribute(k,v){this.attributes[k]=String(v)}
    querySelector(selector){return this.walk().find(x=>('.'+x.className.split(' ').join(' .')).includes(selector))??null}
    walk(){return [this,...this.children.flatMap(x=>x.walk?x.walk():[])]}
}
test('player terminology has exactly five immutable shared stations and distinct integrity/armor roles',()=>{
    assert.deepEqual(STATION_ORDER,['structure','mobility','power','command','combat']);
    assert.deepEqual(STATION_ORDER.map(stationLabel),['FRAME','DRIVE','POWER','CAB','WEAPON']);
    assert.equal(new Set(STATION_ORDER.map(stationGlyph)).size,5);
    assert.equal(new Set(STATION_ORDER.map(slot=>STATIONS[slot].label)).size,5);
    assert.notEqual(UI_COLORS.integrity,UI_COLORS.armor);
    assert.ok(Object.isFrozen(STATIONS));
});
test('armor may be completely stripped while internal integrity remains healthy',()=>{
    const x=conditionReading({serial:'SR-TEST',condition:1,armorRatio:.10,wear:.38});
    assert.equal(x.core,1);assert.equal(x.armor,.10);assert.equal(x.wear,.38);
    assert.equal(x.fault,'ARMOR BREACHED');
    assert.match(formatCondition(x),/INTEGRITY 100% · ARMOR 10% · WEAR 38%/);
    const y=conditionReading({serial:'SR-TEST',condition:.2,armorRatio:1});
    assert.equal(y.fault,'CORE CRITICAL');
    assert.equal(conditionReading({serial:'SR-TEST',condition:1,armorRatio:1}).fault,null);
    assert.equal(conditionReading({serial:'SR-TEST',condition:1,armorRatio:0,destroyed:true}).fault,'DESTROYED');
});
test('meters share one source, expose exact accessible percentages and scale at three sizes',()=>{
    const previous=globalThis.document;
    globalThis.document={createElement:tag=>new Node(tag)};
    try{
        const part={slot:'power',serial:'SR-001',condition:1,armorRatio:.23,wear:.12};
        const compact=createConditionMeter(conditionFromPart(part),{compact:true,slot:'power'});
        assert.match(compact.attributes['aria-label'],/POWER · INTEGRITY 100% · ARMOR 23%/);
        assert.equal(compact.style.values['--armor'],'23%');
        assert.equal(compact.style.values['--core'],'100%');
        assert.ok(compact.className.includes('compact'));
        const expanded=createConditionMeter(conditionFromPart(part),{showNumbers:true,slot:'power'});
        assert.equal(expanded.querySelector('.rig-meter-numbers').textContent,'100 / 23');
        updateConditionMeter(expanded,{serial:'SR-001',condition:.38,armorRatio:.05,wear:.14});
        assert.equal(expanded.style.values['--core'],'38%');
        assert.equal(expanded.style.values['--armor'],'5%');
        const face=createStationFace('power',part);
        assert.equal(face.children[1].textContent,'POWER');
        assert.ok(face.querySelector('.rig-condition'));
        const empty=createStationFace('combat',{serial:null});
        assert.ok(empty.querySelector('.rig-station-empty'));
    } finally{globalThis.document=previous}
});
test('garage uses same vocabulary and compact selected part + single swipe rack, no duplicate ownership authority',()=>{
    const ui=source('unifiedGarageUI.js'),css=source('uiRedesign.css'),bay=source('garageBay.js');
    assert.match(bay,/stationLabel\(slot\)/);
    assert.match(ui,/createStationFace\(item\.slot,item\)/);
    assert.match(ui,/createConditionMeter\(/);
    assert.match(ui,/rackView==='other'\?elsewhereParts:available/);
    assert.match(ui,/const tabs=el\('div','rig-gallery-tabs'\)/);
    assert.match(ui,/selectedHardwareSerial=focused\.serial/);
    assert.match(ui,/actionDisabled: !!elsewhere/);
    assert.match(ui,/onAction: \(\) => editModule\(slot,here \? null : focused\.serial\)/);
    assert.match(ui,/selectBay\(owner\.id\)/);
    assert.match(ui,/arena\.selectPart\(selectedSlot\)/);
    assert.match(css,/scroll-snap-type:x mandatory/);
    assert.match(css,/\.rig-part-focus/);
    assert.match(css,/--garage-dock-width:clamp\(308px,43vw,450px\)/);
});
test('cockpit gets real armor data and two distinct physical damage events without sensor perks',()=>{
    const main=source('main.js'),c=source('cockpitDisplays.js'),bridge=source('cockpitIdentityScene.js');
    assert.match(main,/const systems = \{\}, armor = \{\}/);
    assert.match(main,/part\.armor\/part\.maxArmor/);
    assert.match(main,/systems, armor, team: counts/);
    assert.match(c,/const integrity=data\.systems\?\?\{\},armor=data\.armor\?\?\{\}/);
    assert.match(c,/STATIONS\[slot\]\.glyph/);
    assert.match(c,/line\(ctx,29,y-6,45,5,shell\/100,p,true\)/);
    assert.match(bridge,/const penetrating=Number\(profile\.internalDamage\)>0/);
    assert.match(bridge,/triggerBase\(slot,profile\)/);
    assert.doesNotMatch(source('uiLanguage.js'),/accuracy|aimAssist|penetrationBonus/);
});
test('intermission reports compact truthful dual gauges and reveal detailed readings on tap',()=>{
    const src=source('seriesUI.js'),garage=source('unifiedGarageUI.js'),css=source('uiRedesign.css');
    assert.match(src,/createConditionMeter\(conditionFromPart\(reading\)/);
    assert.match(src,/bayModuleQuote\(stable,round\.rigId,part\.slot\)/);
    assert.match(src,/row\.addEventListener\('click',toggle\)/);
    assert.match(src,/aria-expanded/);
    assert.match(garage,/createConditionMeter\(conditionFromPart\(current\)/);
    assert.match(css,/\.rig-condition-row\.expanded/);
});
test('bundled entry and mobile versions include exact changed assets and no new save contract',()=>{
    const html=source('index.html'),mount=source('garageMountUI.js');
    assert.match(html,/0\.0\.1k\.3w\.10 — Live Systems Soundscape/);
    assert.match(html,/uiRedesign\.css\?v=k3w0/);
    assert.match(html,/main\.js\?v=k3w10/);
    assert.match(html,/garageMountUI\.js\?v=k3v6/);
    assert.match(html,/cockpitDisplays\.js\?v=k3w0/);
    assert.match(html,/cockpitIdentityScene\.js\?v=k3w0/);
    assert.match(html,/uiLanguage\.js\?v=k3w0/);
    assert.match(mount,/unifiedGarageUI\.js\?v=k3v6/);
    assert.match(mount,/seriesUI\.js\?v=k3w0/);
});
