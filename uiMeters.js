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
/** Stable station tile. Graphical health on the tile, specifics in its drawer. */
export function createStationFace(slot,part){
    const wrap=document.createElement('span');wrap.className='rig-station-face';
    const icon=document.createElement('span');icon.className='rig-station-icon';
    icon.textContent=stationGlyph(slot);icon.setAttribute('aria-hidden','true');
    const name=document.createElement('span');name.className='rig-station-label';
    name.textContent=stationLabel(slot);
    wrap.append(icon,name);
    if(part?.serial)wrap.append(createConditionMeter(conditionFromPart(part),{compact:true,slot}));
    else {const empty=document.createElement('span');empty.className='rig-station-empty';empty.textContent='+';wrap.append(empty);}
    return wrap;
}
