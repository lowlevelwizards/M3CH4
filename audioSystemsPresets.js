/** Independent saved auditions; never edits ownership, weapon or campaign keys. */
import {SYSTEM_SOUNDS} from './audioSystemsSynth.js';
export const SYSTEMS_SOUND_KEY='m3ch4-systems-sound-lab-v1';
const known=new Set(SYSTEM_SOUNDS.map(x=>x.id));
export function defaultSystemsSelection(){
  return {version:1,choices:Object.fromEntries(SYSTEM_SOUNDS.map(x=>[x.id,0]))};
}
export function normalizeSystemsSelection(raw){
  const state=defaultSystemsSelection();
  if(raw?.version!==1||!raw.choices||typeof raw.choices!=='object')return state;
  for(const item of SYSTEM_SOUNDS){
    const v=raw.choices[item.id];
    if(Number.isInteger(v)&&v>=0&&v<=2)state.choices[item.id]=v;
  }
  return state;
}
export function readSystemsSelection(storage){
  try{return normalizeSystemsSelection(JSON.parse(storage?.getItem(SYSTEMS_SOUND_KEY)??'null'));}
  catch{return defaultSystemsSelection();}
}
export function saveSystemsSelection(storage,selection){
  try{
    if(!storage)return false;
    storage.setItem(SYSTEMS_SOUND_KEY,JSON.stringify(normalizeSystemsSelection(selection)));
    return true;
  }catch{return false;}
}
export function selectSystemsVariant(selection,id,variant){
  if(!known.has(id)||!Number.isInteger(variant)||variant<0||variant>2)
    throw Error('Unknown systems effect or version');
  const next=normalizeSystemsSelection(selection);
  next.choices[id]=variant;
  return next;
}
export function formatSystemsSelection(selection){
  const state=normalizeSystemsSelection(selection);
  return [
    'M3CH4 SYSTEMS SOUND LAB — k.3w.8',
    'Audition selections ONLY; no new combat sounds installed yet.',
    ...SYSTEM_SOUNDS.map(item=>{
      const idx=state.choices[item.id];
      return item.group.toUpperCase()+' | '+item.label+
        ' ['+item.id+'] | '+String.fromCharCode(65+idx)+
        ' — '+item.variants[idx];
    }),
  ].join('\n');
}
