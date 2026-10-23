/** Range-only full-catalogue assembly and touch-first bench.
 * Own preset key; never touches the campaign machine/stable/career records.
 */
import { CATALOG, SLOTS, equip, installedPart, inspectAssembly, makeTestAssembly } from './components.js';
export { TEST_YARD } from './maps/testYard.js';
const PRESET_KEY = 'm3ch4-test-yard-loadout-v1';
const LABELS = {structure:'FRAME',mobility:'LEGS / DRIVE',power:'GENERATOR',command:'COCKPIT',combat:'WEAPON'};
function storedPreset() {
  try {
    const data = JSON.parse(window.localStorage.getItem(PRESET_KEY) || 'null');
    return data && data.version === 1 && data.parts && typeof data.parts === 'object' ? data.parts : null;
  } catch { return null; }
}
export function readTestYardAssembly() {
  const assembly = makeTestAssembly();
  assembly.name = 'TEST YARD RIG';
  const preset = storedPreset();
  if (preset) {
    // Frame first. A failed/obsolete saved choice cannot strand the entire range.
    for (const slot of SLOTS) {
      const id = preset[slot];
      if (typeof id !== 'string' || !CATALOG.some(def => def.id === id && def.slot === slot)) continue;
      try { equip(assembly, slot, id); } catch { /* use the factory-safe fit */ }
    }
  }
  return assembly;
}
export function storeTestYardAssembly(assembly) {
  const parts = Object.fromEntries(SLOTS.map(slot => [slot, installedPart(assembly, slot)?.definition.id ?? null]));
  try { window.localStorage.setItem(PRESET_KEY, JSON.stringify({version:1,parts})); return true; }
  catch { return false; }
}
export function clearTestYardAssembly() {
  try { window.localStorage.removeItem(PRESET_KEY); } catch { /* private mode */ }
}
function element(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}
function button(label, action, cls='') {
  const el = element('button',cls,label);
  el.type='button';
  el.addEventListener('click',action);
  return el;
}
export function createTestYardPanel({assembly,onInstall,onDeploy,onGarage,onTargets,onReset,onMode,onResetLoadout,onCenter}) {
  const shell = element('div','yard-shell');
  shell.id='test-yard-shell';
  const bar = element('nav','yard-toolbar');
  bar.setAttribute('aria-label','Test yard controls');
  const tag=element('strong','yard-tag','▣ TEST YARD');
  const back=element('a','yard-link','CAMPAIGN');
  back.href='./index.html';back.title='Exit the sandbox; your campaign was not changed';
  const benchButton=button('BENCH',()=>{panel.classList.toggle('collapsed');benchButton.setAttribute('aria-expanded',String(!panel.classList.contains('collapsed')));});
  benchButton.setAttribute('aria-expanded','true');
  const changeButton=button('DEPLOY',()=>onDeploy());
  const resetButton=button('RESET RIG',()=>onReset());
  const targetsButton=button('REBUILD TARGETS',()=>onTargets());
  const modeButton=button('DUMMIES',()=>onMode());
  const centerButton=button('CENTER',()=>onCenter());
  bar.append(tag,benchButton,changeButton,resetButton,targetsButton,modeButton,centerButton,back);
  const panel=element('section','yard-bench');
  panel.setAttribute('aria-label','Full catalogue mech bench');
  const heading=element('div','yard-bench-title','BUILD ANY RIG');
  const help=element('p','yard-help','Complete test inventory · zero credits · no campaign wear. Pick a module and inspect the real 3D rig.');
  const list=element('div','yard-parts');
  const stats=element('div','yard-stats');
  const feedback=element('div','yard-feedback');
  feedback.setAttribute('role','status');
  const resetLoadout=button('RESTORE DEFAULT LOADOUT',onResetLoadout,'yard-secondary');
  panel.append(heading,help,list,stats,feedback,resetLoadout);
  shell.append(bar,panel);document.body.append(shell);
  let inspecting=true,mode='static';
  function render() {
    list.replaceChildren();
    for(const slot of SLOTS) {
      const fitted=installedPart(assembly,slot);
      const item=element('label','yard-part');
      const label=element('span','yard-part-label',LABELS[slot]);
      const select=element('select','yard-select');
      select.setAttribute('aria-label',LABELS[slot]);
      for(const part of CATALOG.filter(def=>def.slot===slot)){
        const option=element('option','',part.name.replace(/^Deactivated /,''));
        option.value=part.id;
        option.selected=part.id===fitted?.definition.id;
        select.append(option);
      }
      const note=element('small','yard-part-note',
        fitted ? `${fitted.definition.massKg.toLocaleString()} kg · ${fitted.definition.powerKw>0?'+':''}${fitted.definition.powerKw} kW · ${fitted.definition.description}` : 'No module installed');
      select.addEventListener('change',()=>{
        try { onInstall(slot,select.value); feedback.textContent='MODULE FITTED · '+LABELS[slot]; }
        catch(error) { feedback.textContent='CANNOT FIT · '+(error?.message||'Invalid mount'); }
        render();
      });
      item.append(label,select,note);list.append(item);
    }
    const result=inspectAssembly(assembly);
    const failed=result.checks.filter(c=>!c.passes);
    stats.classList.toggle('not-ready',!result.ready);
    stats.textContent=`${result.ready?'● FIELDABLE':'● NOT FIELDABLE'}  ·  ${Math.round(result.massKg).toLocaleString()} kg  ·  ${result.powerUsedKw} / ${result.powerAvailableKw} kW` +
      (failed.length?' · '+failed.map(c=>c.reason).join(' / '):'');
    changeButton.disabled=!result.ready;
  }
  function setInspecting(value){
    inspecting=!!value;
    shell.classList.toggle('garage',inspecting);
    changeButton.textContent=inspecting?'DEPLOY':'GARAGE';
    changeButton.onclick=null; // click listener below uses inspecting state
    benchButton.hidden=!inspecting;
    panel.hidden=!inspecting;
    resetButton.hidden=inspecting;
    targetsButton.hidden=inspecting;
    modeButton.hidden=inspecting;
    centerButton.hidden=inspecting;
    if(inspecting)render();
  }
  // One action works in either phase; no overlapping transparent native controls.
  changeButton.replaceWith(changeButton);
  changeButton.addEventListener('click',()=>{if(!inspecting)onGarage();});
  // The original handler is harmless while in combat; onDeploy is guarded by phase in main.
  function setMode(next) { mode=next;modeButton.textContent=mode==='static'?'DUMMIES':'LIVE AI';modeButton.setAttribute('aria-pressed',String(mode==='live')); }
  function announce(message){feedback.textContent=message;}
  setInspecting(true);setMode('static');
  return {render,setInspecting,setMode,announce};
}