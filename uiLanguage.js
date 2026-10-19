/** k.3w.0 — player-facing vocabulary and symbolic information contract.
 * Raw simulation slot IDs remain untouched for saves and physical mount logic.
 * One location means one station; its serialized removable object is a part.
 */
export const STATION_ORDER=Object.freeze(['structure','mobility','power','command','combat']);
export const STATIONS=Object.freeze({
    structure:Object.freeze({id:'structure',label:'FRAME',glyph:'⬡',short:'FRM'}),
    mobility:Object.freeze({id:'mobility',label:'DRIVE',glyph:'⋀',short:'DRV'}),
    power:Object.freeze({id:'power',label:'POWER',glyph:'ϟ',short:'PWR'}),
    command:Object.freeze({id:'command',label:'CAB',glyph:'◉',short:'CAB'}),
    combat:Object.freeze({id:'combat',label:'WEAPON',glyph:'✦',short:'WPN'}),
});
export const UI_TERMS=Object.freeze({
    rig:'RIG',bay:'BAY',station:'STATION',part:'PART',
    integrity:'INTEGRITY',armor:'ARMOR',wear:'WEAR',fault:'FAULT',
});
export const UI_COLORS=Object.freeze({
    armor:'#d7a24b',integrity:'#82c3a3',wear:'#a99f83',fault:'#cf7457',
});
export function stationLabel(slot){return STATIONS[slot]?.label??'PART'}
export function stationGlyph(slot){return STATIONS[slot]?.glyph??'·'}
export const limit01=v=>Math.max(0,Math.min(1,Number.isFinite(Number(v))?Number(v):0));
export function conditionReading({condition=0,integrity=null,core=null,armorRatio=1,armor=null,wear=0,destroyed=false,serial=null}={}){
    const coreValue=limit01(integrity??core??condition),shell=limit01(armor??armorRatio);
    const wearRatio=limit01(wear);
    return Object.freeze({
        core:coreValue,armor:shell,wear:wearRatio,destroyed:!!destroyed,
        missing:serial===null,
        fault:!!destroyed?'DESTROYED':coreValue<=.001?'DISABLED':coreValue<.38?'CORE CRITICAL':
            shell<.38?'ARMOR BREACHED':coreValue<.995?'CORE DAMAGED':shell<.995?'ARMOR WORN':null,
    });
}
/** Encodes one authoritative machine condition, never derives armor from CORE. */
export function conditionFromPart(part){
    if(!part)return conditionReading({serial:null});
    return conditionReading({
        serial:part.serial,condition:part.condition,armorRatio:part.armorRatio,
        wear:part.wear,destroyed:part.destroyed,
    });
}
export function formatCondition(reading){
    return 'INTEGRITY '+Math.round(reading.core*100)+'% · ARMOR '+
        Math.round(reading.armor*100)+'% · WEAR '+Math.round(reading.wear*100)+'%'+
        (reading.fault?' · '+reading.fault:'');
}
