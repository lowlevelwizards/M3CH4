/** Real serialized winner roster, rendered as a light pixel-portrait tableau.
 * Uses the existing 96x72 cached Three.js preview, never a third live renderer.
 */
export function winningMachines(victory,player,friendly,hostile){
  const side=victory?[player,...friendly]:hostile;
  return side.slice(0,3).filter(Boolean).map((actor,index)=>({
    id:actor.id||'winner-'+index,
    name:String(actor.label||actor.assembly?.name||('RIG '+(index+1))).slice(0,30),
    assembly:actor.assembly,
    operational:actor.active!==false,
    index:index+1,
  }));
}
export function renderWinningMachines(host,machines,thumbnail){
  if(!host)return;
  host.replaceChildren();
  for(const m of machines){
    const card=document.createElement('div');
    card.className='winner-rig'+(m.operational?'':' winner-rig-disabled');
    const image=document.createElement('img');
    image.alt=m.name+' physical machine';
    image.loading='eager';
    const url=m.assembly?thumbnail(m.assembly):null;
    if(url) image.src=url;
    const name=document.createElement('strong');
    name.textContent=m.name;
    const status=document.createElement('small');
    status.textContent=m.operational?'STANDING':'DISABLED';
    card.append(image,name,status);host.append(card);
  }
}

/** Text labels for the true in-world winning machines. Unlike portrait mode,
 * this never renders, captures, or caches a second offscreen canvas.
 */
export function renderWinnerNameplates(host,machines){
  if(!host)return;
  host.replaceChildren();
  for(const machine of machines){
    const label=document.createElement('div');
    label.className='winner-nameplate'+(machine.operational?'':' is-disabled');
    const name=document.createElement('strong');
    name.textContent=machine.name;
    const status=document.createElement('small');
    status.textContent=machine.operational?'STANDING':'DISABLED';
    label.append(name,status);host.append(label);
  }
}
