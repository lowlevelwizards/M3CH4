/** k.3w.0 — small/medium/expanded variants of the SAME two-layer
 * protection model. Semantics are also in aria-label/title for accessibility.
 * Outer amber arc/track = expendable armor; inner mint = real part integrity.
 */
import { conditionReading,conditionFromPart,formatCondition,stationGlyph,stationLabel } from './uiLanguage.js';
export function createConditionMeter(reading, {compact=false,showNumbers=false,slot=null}={}){
    const value=conditionReading({...reading,serial:reading?.serial??'meter'});
    const root=document.createElement('span');
    root.className='rig-condition'+(compact?' compact':'')+(showNumbers?' expanded':'');
    root.style.setProperty('--armor',Math.round(value.armor*100)+'%');
    root.style.setProperty('--core',Math.round(value.core*100)+'%');
    root.dataset.armor=String(Math.round(value.armor*100));
    root.dataset.integrity=String(Math.round(value.core*100));
    root.dataset.fault=value.fault??'';
    root.setAttribute('role','img');
    root.setAttribute('aria-label',(slot?stationLabel(slot)+' · ':'')+formatCondition(value));
    root.title=formatCondition(value);
    const armor=document.createElement('span');armor.className='rig-meter-armor';
    const core=document.createElement('span');core.className='rig-meter-core';
    root.append(armor,core);
    if(showNumbers){
        const label=document.createElement('span');label.className='rig-meter-numbers';
        label.textContent=Math.round(value.core*100)+' / '+Math.round(value.armor*100);
        root.append(label);
    }
    return root;
}
export function updateConditionMeter(node,part){
    if(!node)return;
    const value=conditionFromPart(part);
    const meter=node.querySelector('.rig-condition');
    if(meter){
        meter.style.setProperty('--armor',Math.round(value.armor*100)+'%');
        meter.style.setProperty('--core',Math.round(value.core*100)+'%');
        meter.dataset.armor=String(Math.round(value.armor*100));
        meter.dataset.integrity=String(Math.round(value.core*100));
        meter.dataset.fault=value.fault??'';
        meter.setAttribute('aria-label',formatCondition(value));
        meter.title=formatCondition(value);
        const numbers=meter.querySelector('.rig-meter-numbers');
        if(numbers)numbers.textContent=Math.round(value.core*100)+' / '+Math.round(value.armor*100);
    }
}
/** Geometric icons are legible in a 40px touch rail without relying on font glyphs.
 * Ordered as assembly workflow: frame, legs, power, cab, weapon. */
const stationPaths={
    structure:'M5 7 L12 3 L19 7 L19 17 L12 21 L5 17 Z M8 11 H16 M12 7 V17',
    mobility:'M6 4 H9 V12 L6 17 V21 M18 4 H15 V12 L18 17 V21 M4 21 H9 M15 21 H20',
    power:'M13 2 L5 13 H11 L10 22 L20 10 H14 L15 2 Z',
    command:'M5 8 L7 4 H17 L19 8 V19 H5 Z M8 9 H16 V14 H8 Z',
    combat:'M4 10 H13 V7 H17 V17 H13 V14 H4 Z M17 12 H22 M20 10 L22 12 L20 14',
};
function stationPictogram(slot) {
    const uri='http://www.w3.org/2000/svg';
    const icon=document.createElementNS(uri,'svg');
    icon.setAttribute('viewBox','0 0 24 24');
    icon.setAttribute('fill','none');icon.setAttribute('stroke','currentColor');
    icon.setAttribute('stroke-width','1.8');
    icon.setAttribute('stroke-linecap','round');
    icon.setAttribute('stroke-linejoin','round');
    icon.classList.add('station-pictogram');
    const path=document.createElementNS(uri,'path');
    path.setAttribute('d',stationPaths[slot]||'M5 5 H19 V19 H5 Z');
    icon.append(path);return icon;
}
/** Stable station tile. Graphical health on the tile, specifics in its drawer. */
export function createStationFace(slot,part){
    const wrap=document.createElement('span');wrap.className='rig-station-face';
    const icon=document.createElement('span');icon.className='rig-station-icon';
    icon.append(stationPictogram(slot));icon.setAttribute('aria-hidden','true');
    const name=document.createElement('span');name.className='rig-station-label';
    name.textContent=stationLabel(slot);
    wrap.append(icon,name);
    if(part?.serial)wrap.append(createConditionMeter(conditionFromPart(part),{compact:true,slot}));
    else {const empty=document.createElement('span');empty.className='rig-station-empty';empty.textContent='+';wrap.append(empty);}
    return wrap;
}
