/** k3w8 systems sounds audition / one category at a time for iPhone.
 * A tap both auditions AND marks the chosen recipe; selections persist only
 * in a dedicated sound-lab localStorage key.
 */
import {SYSTEM_SOUND_GROUPS,SYSTEM_SOUNDS,makeSystemSoundPlayer} from './audioSystemsSynth.js';
import {
  readSystemsSelection,saveSystemsSelection,selectSystemsVariant,
  formatSystemsSelection,
} from './audioSystemsPresets.js';
const openButton=document.getElementById('systems-sound-open');
if(openButton){
  const audio=makeSystemSoundPlayer();
  let storage=null;
  try{storage=window.localStorage;}catch{}
  let saved=readSystemsSelection(storage);
  let group='damage';
  const el=(tag,cls='',message='')=>{
    const result=document.createElement(tag);
    if(cls)result.className=cls;
    if(message)result.textContent=message;
    return result;
  };
  const button=(label,onClick,cls='')=>{
    const item=el('button',cls,label);
    item.type='button';
    item.addEventListener('click',onClick);
    return item;
  };
  const overlay=el('section','systems-lab-overlay hidden');
  overlay.id='systems-sound-lab';
  overlay.setAttribute('role','dialog');
  overlay.setAttribute('aria-modal','true');
  overlay.setAttribute('aria-label','M3CH4 systems sound audition');
  const workspace=el('div','systems-lab-work');
  const header=el('header','systems-lab-header');
  const identity=el('div','systems-lab-identity');
  identity.append(el('small','','M3CH4 / SOUND ENGINEERING · EXPERIMENTAL'),
    el('strong','','SYSTEMS SOUND LAB'));
  const dismiss=button('CLOSE ×',close,'systems-lab-close');
  header.append(identity,dismiss);
  const tabs=el('nav','systems-lab-tabs');
  tabs.setAttribute('aria-label','Sound families');
  const tabButtons=new Map();
  for(const category of SYSTEM_SOUND_GROUPS){
    const count=SYSTEM_SOUNDS.filter(s=>s.group===category.id).length;
    const b=button(category.label+' · '+count,()=>{group=category.id;audio.stop();refresh();},'systems-lab-tab');
    b.dataset.group=category.id;
    tabButtons.set(category.id,b);
    tabs.append(b);
  }
  const intro=el('div','systems-lab-instructions',
    'k.3w.9 MATERIAL PASS · Re-audition your saved picks · Tap A/B/C to hear and save · Weapons unchanged');
  const list=el('div','systems-lab-list');
  const cards=new Map();
  for(const item of SYSTEM_SOUNDS){
    const card=el('article','systems-lab-card');
    card.dataset.sound=item.id;
    const heading=el('div','systems-lab-card-label');
    heading.append(el('strong','',item.label),el('small','',item.subtitle));
    const choices=el('div','systems-lab-choices');
    const buttons=[];
    for(let i=0;i<3;i++){
      const letter=String.fromCharCode(65+i);
      const b=button(letter+' · '+item.variants[i],()=>{
        saved=selectSystemsVariant(saved,item.id,i);
        const ok=saveSystemsSelection(storage,saved);
        refreshCard(item.id);
        const result=audio.play(item.id,i);
        state.textContent=result.ok ?
          item.label+' / '+letter+' — '+item.variants[i]+(ok?' · SAVED':' · SESSION ONLY') :
          'AUDIO ERROR: '+result.reason;
      },'systems-lab-variant');
      b.dataset.variant=String(i);
      b.setAttribute('aria-label',item.label+' version '+letter+' '+item.variants[i]);
      buttons.push(b);
      choices.append(b);
    }
    card.append(heading,choices);
    list.append(card);
    cards.set(item.id,{card,buttons});
  }
  const footer=el('footer','systems-lab-footer');
  const actions=el('div','systems-lab-actions');
  const stop=button('■ STOP',()=>{audio.stop();state.textContent='STOPPED';},'systems-lab-stop');
  const copy=button('COPY ALL 13 CHOICES',()=>{
    const output=formatSystemsSelection(saved);
    exportText.value=output;
    exportPanel.classList.remove('hidden');
    if(navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(output).then(
        ()=>{state.textContent='ALL 13 COPIED · PASTE IN CHAT';},
        ()=>{exportText.focus();exportText.select();state.textContent='SELECT TEXT BELOW TO COPY';}
      );
    }else{
      exportText.focus();exportText.select();
      state.textContent='SELECT TEXT BELOW TO COPY';
    }
  },'systems-lab-copy');
  actions.append(stop,copy);
  const state=el('div','systems-lab-status','READY · CHOOSE A SOUND');
  state.id='systems-sound-status';
  state.setAttribute('role','status');
  state.setAttribute('aria-live','polite');
  footer.append(actions,state);
  const exportPanel=el('div','systems-lab-export hidden');
  exportPanel.append(el('strong','','ALL SYSTEMS SOUND CHOICES'));
  const exportText=el('textarea','systems-lab-export-text');
  exportText.id='systems-sound-export';
  exportText.readOnly=true;
  exportText.setAttribute('aria-label','Complete systems audio audition choices');
  const exportClose=button('BACK TO SOUNDS',()=>{exportPanel.classList.add('hidden');copy.focus();},'systems-lab-export-close');
  exportPanel.append(exportText,exportClose);
  workspace.append(header,tabs,intro,list,footer,exportPanel);
  overlay.append(workspace);
  document.body.append(overlay);
  function refreshCard(id){
    const b=cards.get(id);
    if(!b)return;
    for(let i=0;i<3;i++){
      const selected=saved.choices[id]===i;
      b.buttons[i].classList.toggle('selected',selected);
      b.buttons[i].setAttribute('aria-pressed',String(selected));
    }
  }
  function refresh(){
    for(const [id,node] of tabButtons){
      const active=id===group;
      node.classList.toggle('selected',active);
      node.setAttribute('aria-pressed',String(active));
    }
    for(const item of SYSTEM_SOUNDS){
      const card=cards.get(item.id).card;
      card.classList.toggle('hidden',item.group!==group);
      refreshCard(item.id);
    }
    list.scrollTop=0;
    state.textContent=SYSTEM_SOUND_GROUPS.find(s=>s.id===group).label+
      ' · TAP A VARIANT TO AUDITION';
  }
  function close(){
    audio.stop();
    exportPanel.classList.add('hidden');
    overlay.classList.add('hidden');
    openButton.focus();
  }
  function open(){
    overlay.classList.remove('hidden');
    refresh();
    dismiss.focus();
  }
  overlay.addEventListener('keydown',event=>{
    if(event.key==='Escape'){
      event.preventDefault();
      if(!exportPanel.classList.contains('hidden'))exportPanel.classList.add('hidden');
      else close();
    }
    if(event.key==='Tab'){
      const candidates=[...overlay.querySelectorAll('button,textarea')].
        filter(n=>n.getClientRects().length>0&&!n.disabled);
      if(!candidates.length)return;
      const first=candidates[0],last=candidates[candidates.length-1];
      if(event.shiftKey&&document.activeElement===first){
        event.preventDefault();last.focus();
      }else if(!event.shiftKey&&document.activeElement===last){
        event.preventDefault();first.focus();
      }
    }
  });
  openButton.addEventListener('click',open);
  refresh();
}
