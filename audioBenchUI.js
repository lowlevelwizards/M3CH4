/** k.3w.3 / Developer-only sound audition.
 * No production sound decisions or persistent user data are touched.
 */
import { BENCH_WEAPONS, BENCH_VARIATIONS, benchRecipe, makeBenchAudioEngine } from './audioBenchSynth.js';

const opener=document.querySelector('#audio-bench-open');
if(opener) {
  const engine=makeBenchAudioEngine();
  const mix={body:50,metal:50,action:50};
  let weaponId='gun-cannon', variationId='A';
  const el=(tag,className='',label='')=>{
    const node=document.createElement(tag);
    if(className)node.className=className;
    if(label)node.textContent=label;
    return node;
  };
  const button=(label,fn,klass='')=>{
    const node=el('button',klass,label);
    node.type='button';node.addEventListener('click',fn);
    return node;
  };
  const root=el('section','audio-lab-layer hidden');
  root.id='audio-bench';
  root.setAttribute('role','dialog');
  root.setAttribute('aria-modal','true');
  root.setAttribute('aria-label','M3CH4 Audio Test Bench');
  const work=el('div','audio-lab-work');
  const mast=el('header','audio-lab-mast');
  const heading=el('div');
  heading.append(el('small','audio-lab-kicker','M3CH4 / AUDIO SYSTEMS / EXPERIMENTAL'),
    el('h2','','SOUND TEST BENCH'));
  const dismiss=button('CLOSE ×',close,'audio-lab-dismiss');
  mast.append(heading,dismiss);
  const info=el('p','audio-lab-note',
    'Audition only. Not linked to live combat yet. Start at low phone volume; tap each version to hear it.');
  const columns=el('div','audio-lab-columns');
  const left=el('div','audio-lab-left');
  left.append(el('div','audio-lab-section-label','01 / WEAPON'));
  const choices=el('div','audio-lab-choices');
  const weaponButtons=new Map();
  for(const item of BENCH_WEAPONS) {
    const node=button(item.label,()=>{weaponId=item.id;showSelection();},'audio-lab-weapon');
    node.dataset.weapon=item.id;
    weaponButtons.set(item.id,node);
    choices.append(node);
  }
  left.append(choices);
  const right=el('div','audio-lab-right');
  const identity=el('div','audio-lab-identity');
  right.append(el('div','audio-lab-section-label','02 / TONAL RECIPE'),identity);
  const variations=el('div','audio-lab-variations');
  const variantButtons=new Map();
  for(const item of BENCH_VARIATIONS) {
    const node=button(item.id+' · '+item.label,()=>{
      variationId=item.id;showSelection();playSelected();
    },'audio-lab-variant');
    node.dataset.variation=item.id;
    node.setAttribute('aria-label','Play version '+item.id+' '+item.label);
    variantButtons.set(item.id,node);
    variations.append(node);
  }
  right.append(variations);
  const controls=el('div','audio-lab-sliders');
  const sliderMeta=[
    ['body','BODY','Low-frequency weight'],
    ['metal','METAL','Sharpness and iron ring'],
    ['action','ACTION','Bolt, lever, and cycling'],
  ];
  const sliderRows=new Map();
  for(const [key,label,detail] of sliderMeta) {
    const group=el('label','audio-lab-slider');
    const caption=el('span','audio-lab-slider-title');
    caption.append(el('b','',label),el('small','',detail));
    const input=el('input');
    input.type='range';input.min='0';input.max='100';input.step='5';
    input.value=String(mix[key]);input.name='audio-'+key;
    input.setAttribute('aria-label',label+' level');
    const value=el('output','',String(mix[key]));
    input.addEventListener('input',()=>{
      mix[key]=Number(input.value);
      value.textContent=String(mix[key]);
      updateStatus('MIX ADJUSTED · TAP REPLAY');
    });
    group.append(caption,input,value);
    controls.append(group);
    sliderRows.set(key,{input,value});
  }
  right.append(controls);
  const actions=el('div','audio-lab-actions');
  const replay=button('▶ REPLAY',playSelected,'audio-lab-replay');
  replay.id='audio-bench-replay';
  const stop=button('■ STOP',()=>{
    engine.stop();updateStatus('STOPPED');
  },'audio-lab-stop');
  const reset=button('RESET MIX',()=>{
    for(const key of Object.keys(mix)) {
      mix[key]=50;
      const row=sliderRows.get(key);row.input.value='50';row.value.textContent='50';
    }
    updateStatus('DEFAULT MIX · TAP REPLAY');
  },'audio-lab-reset');
  const copy=button('COPY RECIPE',()=>{
    const recipe=benchRecipe(weaponId,variationId,mix);
    const description='M3CH4 SOUND / '+recipe.weapon.label+' / '+recipe.variationId+
      ' / '+recipe.variation.label+' / BODY '+mix.body+' METAL '+mix.metal+' ACTION '+mix.action;
    if(navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(description).then(
        ()=>updateStatus('RECIPE COPIED · SEND IT IN CHAT'),
        ()=>updateStatus(description)
      );
    }else updateStatus(description);
  },'audio-lab-copy');
  actions.append(replay,stop,reset,copy);
  const status=el('div','audio-lab-status','TAP A VERSION TO AUDITION');
  status.id='audio-bench-status';status.setAttribute('role','status');status.setAttribute('aria-live','polite');
  right.append(actions,status);
  columns.append(left,right);
  work.append(mast,info,columns);
  root.append(work);
  document.body.append(root);

  function updateStatus(message) {status.textContent=message;}
  function showSelection() {
    const current=BENCH_WEAPONS.find(x=>x.id===weaponId);
    identity.textContent=current.label+' · '+current.identity;
    for(const [id,node] of weaponButtons) {
      const selected=id===weaponId;
      node.classList.toggle('selected',selected);
      node.setAttribute('aria-pressed',String(selected));
    }
    for(const [id,node] of variantButtons) {
      const selected=id===variationId;
      node.classList.toggle('selected',selected);
      node.setAttribute('aria-pressed',String(selected));
    }
    updateStatus('READY · '+current.label+' / '+variationId+' · TAP TO PLAY');
  }
  function playSelected() {
    const result=engine.play(weaponId,variationId,mix);
    updateStatus(result.ok ? 'TRIGGERED · '+result.recipe.weapon.label+' / '+variationId+
      ' · '+result.state.toUpperCase() : 'AUDIO UNAVAILABLE · '+result.reason);
  }
  function open() {
    root.classList.remove('hidden');
    document.body.classList.add('audio-bench-open');
    showSelection();
    dismiss.focus();
  }
  function close() {
    engine.stop();
    root.classList.add('hidden');
    document.body.classList.remove('audio-bench-open');
    opener.focus();
  }
  root.addEventListener('keydown',event=>{
    if(event.key==='Escape') {event.preventDefault();close();}
    // Basic modal focus containment, without intercepting normal sliders.
    if(event.key==='Tab') {
      const focusable=[...root.querySelectorAll('button:not([disabled]),input:not([disabled])')];
      const first=focusable[0],last=focusable[focusable.length-1];
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
      if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    }
  });
  opener.addEventListener('click',open);
  showSelection();
}
