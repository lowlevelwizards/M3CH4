/** k.3w.6 / Pressure Forge audition recipes, not gameplay/loadout saves.
 * Older Audio Test Bench v2 presets stay completely untouched.
 */
export const FORGE_KEY='m3ch4-pressure-forge-v1';
export const FORGE_VERSION=1;
export const FORGE_WEAPONS=Object.freeze([
  {id:'gun-cannon',label:'TRAINING',name:'Training Cannon',action:'bolt',template:'iron'},
  {id:'gun-short',label:'STUMP',name:'Stump Cannon',action:'breech',template:'heavy'},
  {id:'gun-light',label:'NEEDLE',name:'Needle Cannon',action:'bolt',template:'dry'},
  {id:'gun-scatter',label:'S-6',name:'S-6 Scattergun',action:'pump',template:'rough'},
]);
export const FORGE_TEMPLATES=Object.freeze([
  {id:'iron',name:'IRON PUNCH',settings:{bass:83,punch:83,treble:50,grit:35,tail:32,actionLevel:70,delay:50,mass:75,scrape:25}},
  {id:'heavy',name:'HEAVY THUD',settings:{bass:100,punch:76,treble:22,grit:30,tail:58,actionLevel:73,delay:62,mass:94,scrape:15}},
  {id:'dry',name:'DRY CRACK',settings:{bass:54,punch:100,treble:94,grit:20,tail:12,actionLevel:75,delay:72,mass:53,scrape:46}},
  {id:'rough',name:'DUST & GRIT',settings:{bass:88,punch:88,treble:65,grit:92,tail:64,actionLevel:85,delay:58,mass:82,scrape:80}},
  {id:'bark',name:'SHORT BARK',settings:{bass:70,punch:95,treble:76,grit:56,tail:8,actionLevel:46,delay:37,mass:63,scrape:32}},
]);
export const FORGE_ACTIONS=Object.freeze([
  {id:'bolt',name:'BOLT',detail:'slide / lock'},
  {id:'breech',name:'BREECH',detail:'massive shut'},
  {id:'pump',name:'PUMP',detail:'drag / latch'},
  {id:'piston',name:'PISTON',detail:'double knock'},
  {id:'none',name:'NONE',detail:'blast only'},
]);
export const FORGE_CONTROLS=Object.freeze({
  blast:[
    {id:'bass',name:'BASS',hint:'Body / weight'},
    {id:'punch',name:'PUNCH',hint:'Initial impact'},
    {id:'treble',name:'TREBLE',hint:'Brightness / bite'},
    {id:'grit',name:'GRIT',hint:'Rough breakup'},
    {id:'tail',name:'TAIL',hint:'Blast duration'},
  ],
  action:[
    {id:'actionLevel',name:'LEVEL',hint:'Mechanism volume'},
    {id:'delay',name:'TIMING',hint:'Delay after blast'},
    {id:'mass',name:'MASS',hint:'Heavy / dull'},
    {id:'scrape',name:'SCRAPE',hint:'Friction texture'},
  ],
});
const IDs=new Set(FORGE_WEAPONS.map(x=>x.id));
const templates=new Map(FORGE_TEMPLATES.map(x=>[x.id,x]));
const actions=new Set(FORGE_ACTIONS.map(x=>x.id));
const knobs=[...FORGE_CONTROLS.blast,...FORGE_CONTROLS.action].map(x=>x.id);
const clamp=value=>Number.isFinite(Number(value))?Math.round(Math.max(0,Math.min(100,Number(value)))):50;
function initialWeapon(weapon){
  return {template:weapon.template,action:weapon.action,settings:{...templates.get(weapon.template).settings}};
}
export function defaultForgeState(){
  return {version:FORGE_VERSION,weapons:Object.fromEntries(FORGE_WEAPONS.map(w=>[w.id,initialWeapon(w)]))};
}
export function normalizeForgeState(raw){
  const result=defaultForgeState();
  if(raw?.version!==FORGE_VERSION||!raw.weapons||typeof raw.weapons!=='object')return result;
  for(const w of FORGE_WEAPONS){
    const candidate=raw.weapons[w.id];
    if(!candidate||typeof candidate!=='object')continue;
    const baseline=initialWeapon(w);
    result.weapons[w.id]={
      template:templates.has(candidate.template)||candidate.template==='custom'?candidate.template:baseline.template,
      action:actions.has(candidate.action)?candidate.action:baseline.action,
      settings:Object.fromEntries(knobs.map(k=>[k,clamp(candidate.settings?.[k]??baseline.settings[k])])),
    };
  }
  return result;
}
export function readForgeState(storage){
  try{return normalizeForgeState(JSON.parse(storage?.getItem(FORGE_KEY)??'null'));}
  catch{return defaultForgeState();}
}
export function saveForgeState(storage,state){
  try{if(!storage)return false;storage.setItem(FORGE_KEY,JSON.stringify(normalizeForgeState(state)));return true;}
  catch{return false;}
}
export function changeForgeWeapon(state,id,change={}){
  if(!IDs.has(id))throw Error('Unknown Pressure Forge weapon');
  const next=normalizeForgeState(state);
  const before=next.weapons[id];
  if(change.template!==undefined){
    if(!templates.has(change.template))throw Error('Unknown Pressure Forge template');
    before.template=change.template;
    before.settings={...templates.get(change.template).settings};
  }
  if(change.action!==undefined){
    if(!actions.has(change.action))throw Error('Unknown Pressure Forge action');
    before.action=change.action;
  }
  if(change.settings){
    for(const [key,value] of Object.entries(change.settings)){
      if(!knobs.includes(key))continue;
      before.settings[key]=clamp(value);
    }
    before.template='custom';
  }
  return next;
}
export function exportForgeState(state){
  const saved=normalizeForgeState(state);
  return [
    'M3CH4 PRESSURE FORGE — k.3w.6',
    'Experimental weapon shots · separate from old saved A/B/C recipes',
    ...FORGE_WEAPONS.map(weapon=>{
      const r=saved.weapons[weapon.id];
      return weapon.name.toUpperCase()+' ['+weapon.id+']'+
        ' | RECIPE '+r.template.toUpperCase()+
        ' | ACTION '+r.action.toUpperCase()+
        ' | '+FORGE_CONTROLS.blast.concat(FORGE_CONTROLS.action).map(k=>k.name+' '+r.settings[k.id]).join(' | ');
    }),
    'Not applied to live combat.',
  ].join('\n');
}
