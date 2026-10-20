/** k.3w.6 / Standalone, compact and saved sound-design workshop.
 * Intentionally opens separately from the legacy audio lab to keep iPhone
 * landscape usable. Only the dedicated forge key is written to storage.
 */
import {
  FORGE_WEAPONS,FORGE_TEMPLATES,FORGE_ACTIONS,FORGE_CONTROLS,
  readForgeState,saveForgeState,changeForgeWeapon,exportForgeState,
} from './audioPressureForgePresets.js';
import {makePressureForgePlayer} from './audioPressureForgeSynth.js';

const opener=document.querySelector('#pressure-forge-open');
if(opener){
  const engine=makePressureForgePlayer();
  const storage=(()=>{try{return window.localStorage;}catch{return null;}})();
  let saved=readForgeState(storage);
  let weaponId=FORGE_WEAPONS[0].id;
  let page='blast';
  const elem=(tag,className='',text='')=>{
    const x=document.createElement(tag);
    if(className)x.className=className;
    if(text)x.textContent=text;
    return x;
  };
  const btn=(label,onClick,className='')=>{
    const x=elem('button',className,label);
    x.type='button';x.addEventListener('click',onClick);return x;
  };
  const current=()=>saved.weapons[weaponId];
  const sync=(updates)=>{
    saved=changeForgeWeapon(saved,weaponId,updates);
    return saveForgeState(storage,saved);
  };
  const root=elem('section','forge-layer hidden');
  root.id='pressure-forge';
  root.setAttribute('role','dialog');
  root.setAttribute('aria-modal','true');
  root.setAttribute('aria-label','M3CH4 Pressure Forge sound workshop');
  const inner=elem('div','forge-work');
  const header=elem('header','forge-header');
  const caption=elem('div','forge-heading');
  caption.append(elem('span','forge-kicker','M3CH4 / PRESSURE FORGE · EXPERIMENTAL'),
    elem('strong','','WEAPON SOUND DESIGN'));
  const closeButton=btn('CLOSE ×',close,'forge-close');
  header.append(caption,closeButton);
  const guns=elem('nav','forge-guns');
  guns.setAttribute('aria-label','Select weapon to tune');
  const gunButtons=new Map();
  for(const w of FORGE_WEAPONS){
    const b=btn(w.label,()=>{
      weaponId=w.id;
      show();
    },'forge-gun');
    b.dataset.weapon=w.id;
    gunButtons.set(w.id,b);
    guns.append(b);
  }
  const body=elem('div','forge-body');
  const recipes=elem('div','forge-recipes');
  const recipeTitle=elem('span','forge-mini-title','START FROM');
  const recipeButtons=elem('div','forge-recipe-buttons');
  const templateButtons=new Map();
  for(const p of FORGE_TEMPLATES){
    const b=btn(p.name,()=>{
      sync({template:p.id});
      show();
      audition('full');
    },'forge-recipe');
    b.dataset.template=p.id;
    templateButtons.set(p.id,b);
    recipeButtons.append(b);
  }
  recipes.append(recipeTitle,recipeButtons);
  const tabs=elem('div','forge-tabs');
  const tabButtons=new Map();
  const tabNames={blast:'BLAST · 5 CONTROLS',action:'MECHANISM · 4 CONTROLS'};
  for(const key of ['blast','action']){
    const b=btn(tabNames[key],()=>{page=key;show();},'forge-tab');
    b.dataset.tab=key;tabButtons.set(key,b);tabs.append(b);
  }
  const editor=elem('div','forge-edit-pane');
  const actionKinds=elem('div','forge-action-kinds');
  const actionButtons=new Map();
  for(const a of FORGE_ACTIONS){
    const b=btn(a.name,()=>{
      sync({action:a.id});
      show();
      audition('action');
    },'forge-action');
    b.dataset.action=a.id;
    b.title=a.detail;
    actionButtons.set(a.id,b);
    actionKinds.append(b);
  }
  const controls=elem('div','forge-controls');
  const inputs=new Map();
  for(const group of ['blast','action']){
    for(const item of FORGE_CONTROLS[group]){
      const row=elem('label','forge-control');
      row.dataset.group=group;
      const top=elem('span','forge-control-top');
      const name=elem('b','',item.name);
      const output=elem('output','',String(current().settings[item.id]));
      top.append(name,output);
      const input=elem('input');
      input.type='range';input.min='0';input.max='100';input.step='5';
      input.name='forge-'+item.id;
      input.setAttribute('aria-label',item.name+' '+item.hint);
      const desc=elem('span','forge-control-hint',item.hint);
      input.addEventListener('input',()=>{
        const ok=sync({settings:{[item.id]:Number(input.value)}});
        output.textContent=String(current().settings[item.id]);
        markCustom();
        status.textContent=ok?'SAVED · RELEASE TO HEAR':'SESSION ONLY · STORAGE BLOCKED';
      });
      input.addEventListener('change',()=>audition(group==='blast'?'blast':'action'));
      row.append(top,input,desc);
      controls.append(row);
      inputs.set(item.id,{row,input,output,group});
    }
  }
  editor.append(actionKinds,controls);
  body.append(recipes,tabs,editor);
  const footer=elem('footer','forge-footer');
  const buttons=elem('div','forge-actions');
  const fire=btn('▶ FULL SHOT',()=>audition('full'),'forge-play');
  fire.id='forge-play';
  const soloBlast=btn('BLAST ONLY',()=>audition('blast'),'forge-blast');
  const soloAction=btn('ACTION ONLY',()=>audition('action'),'forge-solo');
  const exportButton=btn('COPY ALL FOUR',exportAll,'forge-copy');
  exportButton.id='forge-copy';
  buttons.append(fire,soloBlast,soloAction,exportButton);
  const status=elem('div','forge-status','SELECT A RECIPE · TAP FULL SHOT');
  status.id='forge-status';
  status.setAttribute('role','status');
  status.setAttribute('aria-live','polite');
  footer.append(buttons,status);
  const exportModal=elem('div','forge-export-screen hidden');
  const exportHeading=elem('strong','','COPY ALL FOUR FORGE RECIPES');
  const exportArea=elem('textarea','forge-export-text');
  exportArea.id='forge-export';
  exportArea.readOnly=true;
  const exportClose=btn('BACK TO FORGE',()=>{
    exportModal.classList.add('hidden');exportButton.focus();
  },'forge-close-export');
  exportModal.append(exportHeading,exportArea,exportClose);
  inner.append(header,guns,body,footer,exportModal);
  root.append(inner);
  document.body.append(root);

  function markCustom(){
    for(const [id,b] of templateButtons){
      const sel=current().template===id;
      b.classList.toggle('selected',sel);b.setAttribute('aria-pressed',String(sel));
    }
  }
  function show(){
    for(const [id,b] of gunButtons){
      const selected=id===weaponId;
      b.classList.toggle('selected',selected);
      b.setAttribute('aria-pressed',String(selected));
    }
    markCustom();
    for(const [key,b] of tabButtons){
      const on=key===page;
      b.classList.toggle('selected',on);
      b.setAttribute('aria-pressed',String(on));
    }
    for(const [key,b] of actionButtons){
      const on=key===current().action;
      b.classList.toggle('selected',on);
      b.setAttribute('aria-pressed',String(on));
    }
    actionKinds.classList.toggle('hidden',page!=='action');
    for(const [key,c] of inputs){
      const visible=c.group===page;
      c.row.classList.toggle('hidden',!visible);
      if(visible){
        c.input.value=String(current().settings[key]);
        c.output.textContent=String(current().settings[key]);
      }
    }
    status.textContent=FORGE_WEAPONS.find(w=>w.id===weaponId).name.toUpperCase()+
      ' · '+(current().template==='custom'?'CUSTOM MIX':current().template.toUpperCase())+
      ' · '+current().action.toUpperCase()+' · AUTO-SAVED';
  }
  function audition(mode){
    const result=engine.play(weaponId,current(),mode);
    status.textContent=result.ok ?
      mode.toUpperCase()+' PLAYED · '+FORGE_WEAPONS.find(w=>w.id===weaponId).label+
      ' · '+result.state.toUpperCase() : 'AUDIO ERROR · '+result.reason;
  }
  function exportAll(){
    exportArea.value=exportForgeState(saved);
    exportModal.classList.remove('hidden');
    if(navigator.clipboard?.writeText){
      void navigator.clipboard.writeText(exportArea.value).then(
        ()=>{status.textContent='COPIED ALL FOUR · SEND TO CHAT';},
        ()=>{exportArea.focus();exportArea.select();status.textContent='SELECT TEXT AND COPY';}
      );
    }else{exportArea.focus();exportArea.select();status.textContent='SELECT TEXT AND COPY';}
  }
  function open(){
    root.classList.remove('hidden');
    show();
    closeButton.focus();
  }
  function close(){
    engine.stop();
    exportModal.classList.add('hidden');
    root.classList.add('hidden');
    opener.focus();
  }
  root.addEventListener('keydown',event=>{
    if(event.key==='Escape'){event.preventDefault();
      if(!exportModal.classList.contains('hidden'))exportModal.classList.add('hidden');
      else close();
    }
    if(event.key==='Tab'){
      const nodes=[...root.querySelectorAll('button:not(.hidden),input:not([disabled]),textarea')].
        filter(x=>x.getClientRects().length>0);
      if(!nodes.length)return;
      const first=nodes[0],last=nodes[nodes.length-1];
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
      if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    }
  });
  opener.addEventListener('click',open);
  show();
}
