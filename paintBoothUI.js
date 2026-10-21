/** k.4d — Workshop paint booth. Detached from equipment rules and graphics code:
 * selections are serial-authoritative and the only live mutation is a local
 * preview passed to the garage; saves always go through persistence.
 */
import { BY_ID } from './components.js';
import { factoryFinishFor, normalizePaint, PAINT_CHANNELS, PAINT_PRESETS,
    paintForPart, readUserPalettes, storeUserPalette, deleteUserPalette } from './factoryPaint.js';
import { repaintSerializedParts } from './stable.js';

let selectedRig=null, selectedTarget='rig', draft=null, draftKey=null;
const labels={primary:'MAIN HOUSINGS',secondary:'SECONDARY PANELS',
    armor:'PROTECTIVE PANELS',accent:'TRIM / ACCENTS'};
const e=(tag,cls,txt)=>{
    const node=document.createElement(tag);
    if(cls)node.className=cls;
    if(txt!==undefined)node.textContent=String(txt);
    return node;
};
function b(label,handler,cls=''){
    const node=e('button',cls,label);node.type='button';node.addEventListener('click',handler);return node;
}
function serialsFor(rig){
    return Object.values(rig?.installed||{}).filter(Boolean);
}
function partFor(stable,serial) {
    return stable.inventory.find(part=>part.serial===serial)||null;
}
function targets(rig){
    return selectedTarget==='rig'?serialsFor(rig):[selectedTarget];
}
function ensureDraft(stable,rigId,rig) {
    if(selectedRig!==rigId){
        selectedRig=rigId;selectedTarget='rig';draft=null;draftKey=null;
    }
    const mounted=serialsFor(rig);
    if(selectedTarget!=='rig' && !mounted.includes(selectedTarget)){
        selectedTarget='rig';draftKey=null;
    }
    const key=rigId+':'+selectedTarget;
    if(draftKey!==key || !draft){
        const part=partFor(stable,selectedTarget==='rig'?mounted[0]:selectedTarget);
        draft={...paintForPart(part)};
        draftKey=key;
    }
}
export function clearPaintBoothDraft(){
    selectedRig=null;selectedTarget='rig';draft=null;draftKey=null;
}
export function createPaintBooth({stable,rigId,storage,onPreview,onRefresh,onSaved,onMessage}){
    const rig=stable.rigs.find(item=>item.id===rigId);
    const wrap=e('section','paint-booth');
    if(!rig)return wrap;
    ensureDraft(stable,rigId,rig);
    const mounted=serialsFor(rig);
    wrap.append(e('div','paint-booth-title','WORKSHOP · PAINT & FINISH'),
        e('p','paint-booth-hint','COATING ONLY · BARE STEEL, MECHANISMS AND OPTICS KEEP THEIR MATERIALS'));
    const selector=e('div','paint-booth-targets');
    const all=b('◈ ENTIRE MACHINE',()=>{
        selectedTarget='rig';draftKey=null;onPreview(null);onRefresh();
    },selectedTarget==='rig'?'active':'');
    all.setAttribute('aria-pressed',String(selectedTarget==='rig'));selector.append(all);
    for(const serial of mounted){
        const part=partFor(stable,serial);
        if(!part)continue;
        const label=BY_ID.get(part.definitionId)?.name||part.definitionId;
        const btn=b(label.toUpperCase(),()=>{
            selectedTarget=serial;draftKey=null;onPreview(null);onRefresh();
        },selectedTarget===serial?'active':'');
        btn.setAttribute('aria-pressed',String(selectedTarget===serial));
        btn.title=serial;
        selector.append(btn);
    }
    wrap.append(selector);
    if(!mounted.length){
        wrap.append(e('p','paint-booth-hint','INSTALL A COMPONENT BEFORE APPLYING PAINT'));
        return wrap;
    }
    const chosen=selectedTarget==='rig'?null:partFor(stable,selectedTarget);
    wrap.append(e('div','paint-booth-context',selectedTarget==='rig'?
        'SCHEME APPLIES TO ALL '+mounted.length+' FITTED SERIALS':
        'PAINT FOLLOWS SERIAL '+selectedTarget+' BETWEEN MACHINES'));
    const available=[...PAINT_PRESETS.map(p=>({...p,user:false})),
        ...readUserPalettes(storage).map(p=>({id:'user:'+p.name,name:p.name,colors:p.colors,user:true}))];
    const presets=e('div','paint-booth-presets');
    for(const preset of available){
        const tile=b('',()=>{
            draft={...preset.colors};
            onPreview(targets(rig).map(serial=>({serial,paint:{...draft}})));
            onRefresh();
        },'paint-booth-preset');
        tile.title=preset.name;tile.setAttribute('aria-label','Preview '+preset.name);
        const swatches=e('span','paint-booth-swatches');
        for(const channel of PAINT_CHANNELS){
            const color=e('i');color.style.background=preset.colors[channel];swatches.append(color);
        }
        tile.append(swatches,e('span','',preset.name));
        presets.append(tile);
    }
    wrap.append(e('div','paint-booth-label','PALETTE PRESETS'),presets);
    const controls=e('div','paint-booth-channels');
    for(const channel of PAINT_CHANNELS){
        const row=e('label','paint-booth-channel');
        const heading=e('span','',labels[channel]);
        const value=e('span','paint-booth-hex',draft[channel].toUpperCase());
        const input=e('input','paint-booth-picker');
        input.type='color';input.value=draft[channel];
        input.setAttribute('aria-label',labels[channel]+' paint color');
        input.addEventListener('input',()=>{
            draft[channel]=input.value;
            value.textContent=draft[channel].toUpperCase();
            onPreview(targets(rig).map(serial=>({serial,paint:{...draft}})));
        });
        row.append(heading,input,value);controls.append(row);
    }
    wrap.append(controls);
    const actions=e('div','paint-booth-actions');
    const apply=b('APPLY PAINT',()=>{
        const result=repaintSerializedParts(storage,targets(rig).map(serial=>({serial,paint:{...draft}})));
        onMessage(result.ok?'PAINT SAVED · '+result.count+' SERIAL'+(result.count>1?'S':''):result.reason,!result.ok);
        if(result.ok){draftKey=null;onSaved();}
    },'paint-booth-primary');
    const factory=b('RESTORE FACTORY',()=>{
        const result=repaintSerializedParts(storage,targets(rig).map(serial=>({serial,paint:null})));
        onMessage(result.ok?'ORIGINAL FACTORY FINISH RESTORED':result.reason,!result.ok);
        if(result.ok){draftKey=null;onSaved();}
    },'paint-booth-restore');
    actions.append(apply,factory);wrap.append(actions);
    const saves=e('div','paint-booth-save');
    const input=e('input','paint-booth-name');
    input.type='text';input.placeholder='NAME THIS PALETTE';input.maxLength=28;
    input.setAttribute('aria-label','New saved palette name');
    const save=b('SAVE PALETTE',()=>{
        const ok=storeUserPalette(storage,input.value,{...draft});
        onMessage(ok?'PALETTE SAVED':'NAME REQUIRED · 12 PALETTE LIMIT',!ok);
        if(ok)onRefresh();
    });
    saves.append(input,save);wrap.append(saves);
    const userPalettes=readUserPalettes(storage);
    if(userPalettes.length){
        const saved=e('div','paint-booth-library');
        for(const palette of userPalettes){
            const remove=b('×',()=>{
                if(deleteUserPalette(storage,palette.name))onRefresh();
            },'paint-booth-delete');
            remove.title='Delete saved palette '+palette.name;
            remove.setAttribute('aria-label','Delete '+palette.name+' palette');
            saved.append(e('span','',palette.name),remove);
        }
        wrap.append(saved);
    }
    if(chosen){
        const factory=normalizePaint(chosen.paint)?'OWNER PAINT':'ORIGINAL FACTORY FINISH';
        wrap.append(e('small','paint-booth-foot',factory+
            ' · '+BY_ID.get(chosen.definitionId)?.name.toUpperCase()));
    }else{
        wrap.append(e('small','paint-booth-foot',
            'Factory reset keeps each installed component’s own original finish'));
    }
    return wrap;
}
