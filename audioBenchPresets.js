/** k.3w.4: versioned audition preferences, NOT part of machine/game saves.
 * Each weapon's A/B/C decision and the three sliders live independently.
 */
import { BENCH_WEAPONS, BENCH_VARIATIONS } from './audioBenchSynth.js';
export const AUDIO_BENCH_STORAGE_KEY='m3ch4-audio-bench-presets-v2';
export const AUDIO_BENCH_PRESET_VERSION=2;
const weaponIds=new Set(BENCH_WEAPONS.map(w=>w.id));
const variantIds=new Set(BENCH_VARIATIONS.map(v=>v.id));
const keys=['body','metal','action'];
const value=(v)=>Number.isFinite(Number(v))?Math.max(0,Math.min(100,Number(v))):50;
const defaults=()=>({variation:'A',mix:{body:50,metal:50,action:50}});
const clonePreset=(data)=>({
  variation:variantIds.has(data?.variation)?data.variation:'A',
  mix:Object.fromEntries(keys.map(k=>[k,value(data?.mix?.[k]??50)])),
});
export function defaultBenchPresets(){
  return {version:AUDIO_BENCH_PRESET_VERSION,
    weapons:Object.fromEntries(BENCH_WEAPONS.map(w=>[w.id,defaults()]))};
}
/** Fail closed against corrupt/newer saves, extra keys and prototype pollution.
 * Malformed individual weapons reset without overwriting unrelated weapons.
 */
export function normalizeBenchPresets(raw){
  const result=defaultBenchPresets();
  if(!raw||typeof raw!=='object'||raw.version!==AUDIO_BENCH_PRESET_VERSION)return result;
  for(const w of BENCH_WEAPONS)result.weapons[w.id]=clonePreset(raw.weapons?.[w.id]);
  return result;
}
export function readBenchPresets(storage){
  if(!storage)return defaultBenchPresets();
  try {return normalizeBenchPresets(JSON.parse(storage.getItem(AUDIO_BENCH_STORAGE_KEY))); }
  catch {return defaultBenchPresets();}
}
export function saveBenchPresets(storage,presets){
  if(!storage)return false;
  try{
    storage.setItem(AUDIO_BENCH_STORAGE_KEY,JSON.stringify(normalizeBenchPresets(presets)));
    return true;
  }catch{return false;}
}
export function updateBenchPreset(presets,weaponId,updates={}){
  if(!weaponIds.has(weaponId))throw Error('Unknown sound bench weapon');
  const next=normalizeBenchPresets(presets);
  const old=next.weapons[weaponId];
  next.weapons[weaponId]=clonePreset({
    variation:updates.variation??old.variation,
    mix:{...old.mix,...(updates.mix??{})},
  });
  return next;
}
/** Includes all four selected variations and sliders in stable catalogue order;
 * a human-readable export that can be pasted directly into a future chat.
 */
export function formatAllBenchRecipes(presets){
  const normalized=normalizeBenchPresets(presets);
  return [
    'M3CH4 AUDIO TEST BENCH — k.3w.4',
    'Sound architecture: weapon-specific procedural v2',
    ...BENCH_WEAPONS.map(w=>{
      const p=normalized.weapons[w.id];
      const variation=BENCH_VARIATIONS.find(v=>v.id===p.variation);
      return w.label+' ['+w.id+'] — '+p.variation+' ('+variation.label+')'+
        ' | BODY '+p.mix.body+' | METAL '+p.mix.metal+' | ACTION '+p.mix.action+
        ' | '+w.identity;
    }),
    'These are audition choices, not yet applied to combat.',
  ].join('\n');
}
