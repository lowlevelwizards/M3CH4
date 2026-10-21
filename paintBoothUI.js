/** k.4e — Select physical serials, compose one palette, preview one of three
 * distribution variants, and commit only deliberately selected hardware.
 * All buttons are real actions; preview never writes to storage.
 */
import { BY_ID, SLOTS } from './components.js';
import { PAINT_CHANNELS, PAINT_PRESETS, PAINT_VARIANTS,
    paintForPart, paintVariant,
    readUserPalettes, storeUserPalette, deleteUserPalette } from './factoryPaint.js';
import { readTeamLivery, storeTeamLivery, clearTeamLivery } from './crewLivery.js';
import { repaintSerializedParts } from './stable.js';

let selectedRig=null, selectedSerials=new Set(), draft=null, variant=0;
const shortNames={structure:'FRAME',mobility:'LEGS',power:'POWER',command:'CAB',combat:'WEAPON'};
const labels={primary:'MAIN',secondary:'SECOND',armor:'ARMOR',accent:'TRIM'};
const e=(tag,cls,txt)=>{
    const node=document.createElement(tag);
    if(cls)node.className=cls;
    if(txt!==undefined)node.textContent=String(txt);
    return node;
};
function b(label,handler,cls=''){
    const node=e('button',cls,label);
    node.type='button';node.addEventListener('click',handler);return node;
}
const serialsFor=rig=>SLOTS.map(slot=>rig?.installed?.[slot]).filter(Boolean);
const partFor=(stable,serial)=>stable.inventory.find(part=>part.serial===serial)||null;
const colors=()=>paintVariant(draft,variant);
function ensureDraft(stable,rigId,rig){
    const mounted=serialsFor(rig);
    if(selectedRig!==rigId){
        selectedRig=rigId;selectedSerials=new Set(mounted);
        const part=partFor(stable,mounted[0]);
        draft={...paintForPart(part)};
        variant=0;
    }
    selectedSerials=new Set([...selectedSerials].filter(serial=>mounted.includes(serial)));
    if(!draft)draft={...paintForPart(partFor(stable,mounted[0]))};
}
function selection(stable,rig){
    return SLOTS.filter(slot=>selectedSerials.has(rig.installed?.[slot]));
}
function edits(){
    const paint=colors();
    return [...selectedSerials].map(serial=>({serial,paint:{...paint}}));
}
/** Restore the live candidate coating after inspector-based target toggles. */
export function paintBoothCurrentEdits(){
    return selectedSerials.size?edits():null;
}
export function clearPaintBoothDraft(){
    selectedRig=null;selectedSerials=new Set();draft=null;variant=0;
}
/** Surface selection from the existing 3D inspector click event. */
export function togglePaintBoothSlot(stable,rigId,slot){
    const rig=stable.rigs.find(item=>item.id===rigId);
    if(!rig || !SLOTS.includes(slot) || !rig.installed?.[slot])return false;
    ensureDraft(stable,rigId,rig);
    const serial=rig.installed[slot];
    if(selectedSerials.has(serial))selectedSerials.delete(serial);
    else selectedSerials.add(serial);
    return true;
}
export function createPaintBooth({
    stable,rigId,storage,onPreview,onRefresh,onSaved,onTeamSaved,onMessage,onSelection,thumbnailFor,rigThumbnailFor,
}){
    const rig=stable.rigs.find(item=>item.id===rigId);
    const wrap=e('section','paint-booth');
    if(!rig)return wrap;
    ensureDraft(stable,rigId,rig);
    const mounted=serialsFor(rig);
    const syncSelection=()=>onSelection?.(selection(stable,rig));
    const preview=()=>onPreview(selectedSerials.size?edits():null);
    const refreshSelection=()=>{
        syncSelection();preview();onRefresh();
    };
    wrap.append(e('div','paint-booth-title','PAINT · WORKSHOP'));
    const heading=e('div','paint-booth-section-head');
    heading.append(e('strong','','01 / PARTS'),e('small','',selectedSerials.size+' OF '+mounted.length+' SELECTED'));
    wrap.append(heading);
    const strip=e('div','paint-booth-targets');
    for(const slot of SLOTS){
        const serial=rig.installed?.[slot];
        const part=partFor(stable,serial);
        if(!part)continue;
        const pressed=selectedSerials.has(serial);
        const tile=b('',()=>{
            if(selectedSerials.has(serial))selectedSerials.delete(serial);
            else selectedSerials.add(serial);
            refreshSelection();
        },'paint-booth-target'+(pressed?' active':''));
        tile.setAttribute('aria-label',(pressed?'Deselect ':'Select ')+shortNames[slot]+' '+serial);
        tile.setAttribute('aria-pressed',String(pressed));
        tile.title=BY_ID.get(part.definitionId)?.name||serial;
        const thumb=thumbnailFor?.(part.definitionId,{paint:part.paint,condition:part.condition,destroyed:part.destroyed});
        if(thumb){
            const img=e('img','paint-booth-target-img');img.src=thumb;
            img.alt='';img.loading='lazy';tile.append(img);
        }else tile.append(e('span','paint-booth-target-icon',({structure:'⬡',mobility:'⋀',power:'ϟ',command:'◉',combat:'✦'})[slot]));
        tile.append(e('span','paint-booth-target-label',shortNames[slot]),e('span','paint-booth-target-state',pressed?'✓':'○'));
        strip.append(tile);
    }
    wrap.append(strip);
    const quick=e('div','paint-booth-quick');
    quick.append(b('ALL',()=>{selectedSerials=new Set(mounted);refreshSelection();}),
        b('NONE',()=>{selectedSerials.clear();refreshSelection();}));
    wrap.append(quick);
    if(!mounted.length){
        wrap.append(e('p','paint-booth-hint','INSTALL PARTS BEFORE PAINTING'));
        syncSelection();return wrap;
    }

    wrap.append(e('div','paint-booth-section-head','02 / PALETTE'));
    const available=[...PAINT_PRESETS.map(p=>({...p,user:false})),
        ...readUserPalettes(storage).map(p=>({id:'user:'+p.name,name:p.name,colors:p.colors,user:true}))];
    const presets=e('div','paint-booth-presets');
    for(const preset of available){
        const tile=b('',()=>{draft={...preset.colors};preview();onRefresh();},'paint-booth-preset');
        tile.title=preset.name;tile.setAttribute('aria-label','Preview '+preset.name);
        const swatches=e('span','paint-booth-swatches');
        for(const channel of PAINT_CHANNELS){
            const swatch=e('i');swatch.style.background=preset.colors[channel];swatches.append(swatch);
        }
        tile.append(swatches,e('span','',preset.name));presets.append(tile);
    }
    wrap.append(presets);
    wrap.append(e('div','paint-booth-section-head','03 / DISTRIBUTION'));
    const variants=e('div','paint-booth-variants');
    const previewAssembly={owned:mounted.map(serial=>({...partFor(stable,serial)})),
        installed:{...rig.installed}};
    for(let i=0;i<PAINT_VARIANTS.length;i++){
        const option=PAINT_VARIANTS[i],distributed=paintVariant(draft,i);
        const tile=b('',()=>{variant=i;preview();onRefresh();},
            'paint-booth-variant'+(variant===i?' active':''));
        tile.setAttribute('aria-label','Select '+option.name+' paint distribution');
        tile.setAttribute('aria-pressed',String(variant===i));
        const candidate={...previewAssembly,
            owned:previewAssembly.owned.map(part=>selectedSerials.has(part.serial)?{...part,paint:distributed}:part)};
        const image=rigThumbnailFor?.(candidate);
        if(image){const img=e('img','paint-booth-variant-img');img.src=image;img.alt='';tile.append(img);}
        const swatches=e('span','paint-booth-swatches');
        for(const channel of PAINT_CHANNELS){
            const swatch=e('i');swatch.style.background=distributed[channel];swatches.append(swatch);
        }
        tile.append(swatches,e('span','',option.name));
        variants.append(tile);
    }
    wrap.append(variants);
    const controls=e('details','paint-booth-fine-tune');
    const summary=e('summary','','04 / FINE TUNE · FOUR PIGMENTS');controls.append(summary);
    const channels=e('div','paint-booth-channels');
    for(const channel of PAINT_CHANNELS){
        const row=e('label','paint-booth-channel');
        const title=e('span','',labels[channel]);
        const input=e('input','paint-booth-picker');
        input.type='color';input.value=draft[channel];
        input.setAttribute('aria-label',labels[channel]+' palette pigment');
        const hex=e('span','paint-booth-hex',draft[channel].toUpperCase());
        input.addEventListener('change',()=>onRefresh());
        input.addEventListener('input',()=>{
            draft[channel]=input.value;hex.textContent=draft[channel].toUpperCase();preview();
            // Recompute variant color strips, without replacing the native color picker.
            [...variants.children].forEach((child,i)=>{
                const next=paintVariant(draft,i);
                child.querySelectorAll('.paint-booth-swatches i').forEach((item,index)=>{
                    item.style.background=next[PAINT_CHANNELS[index]];
                });
            });
        });
        row.append(title,input,hex);channels.append(row);
    }
    controls.append(channels);wrap.append(controls);

    const actions=e('div','paint-booth-actions');
    const apply=b('APPLY TO '+selectedSerials.size+' PART'+(selectedSerials.size===1?'':'S'),()=>{
        const result=repaintSerializedParts(storage,edits());
        onMessage(result.ok?'PAINT SAVED · '+result.count+' SERIAL'+(result.count===1?'':'S'):result.reason,!result.ok);
        if(result.ok)onSaved();
    },'paint-booth-primary');
    apply.disabled=selectedSerials.size===0;
    const factory=b('RESET SELECTED',()=>{
        const result=repaintSerializedParts(storage,[...selectedSerials].map(serial=>({serial,paint:null})));
        onMessage(result.ok?'SELECTED PARTS RESTORED':result.reason,!result.ok);
        if(result.ok)onSaved();
    },'paint-booth-restore');
    factory.disabled=selectedSerials.size===0;
    actions.append(apply,factory);wrap.append(actions);

    const team=e('div','paint-booth-team');
    const teamPalette=readTeamLivery(storage);
    team.append(e('div','paint-booth-section-head','CREW LIVERY'),
        e('small','paint-booth-hint',teamPalette?'CUSTOM · ALLIES USE ALT A / B':'AUTO · ALLIES FOLLOW YOUR PAINT'));
    team.append(b('USE PALETTE FOR CREW',()=>{
        const result=storeTeamLivery(storage,draft);
        onMessage(result?'TEAM LIVERY SAVED · ALLIES INHERIT VARIANTS':'TEAM PALETTE COULD NOT SAVE',!result);
        if(result){onTeamSaved?.();onRefresh();}
    },'paint-booth-team-action'));
    if(teamPalette)team.append(b('FOLLOW MY PAINT',()=>{
        const result=clearTeamLivery(storage);
        onMessage(result?'TEAM WILL FOLLOW YOUR PAINT':'COULD NOT RESET TEAM PALETTE',!result);
        if(result){onTeamSaved?.();onRefresh();}
    }));
    wrap.append(team);

    const saves=e('details','paint-booth-fine-tune');
    saves.append(e('summary','','PALETTE LIBRARY'));
    const saveRow=e('div','paint-booth-save');
    const name=e('input','paint-booth-name');
    name.type='text';name.placeholder='PALETTE NAME';name.maxLength=28;
    name.setAttribute('aria-label','New saved palette name');
    saveRow.append(name,b('SAVE PALETTE',()=>{
        const ok=storeUserPalette(storage,name.value,draft);
        onMessage(ok?'PALETTE SAVED':'NAME REQUIRED · 12 PALETTE LIMIT',!ok);
        if(ok)onRefresh();
    }));
    saves.append(saveRow);
    for(const palette of readUserPalettes(storage)){
        const row=e('div','paint-booth-library');
        row.append(e('span','',palette.name),b('×',()=>{
            if(deleteUserPalette(storage,palette.name))onRefresh();
        },'paint-booth-delete'));
        saves.append(row);
    }
    wrap.append(saves);
    wrap.append(e('small','paint-booth-foot','PAINT FOLLOWS EACH PART SERIAL · FACTORY RESET NEVER ALTERS BARE METAL'));
    syncSelection();
    return wrap;
}
