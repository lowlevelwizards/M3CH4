/** The actual recorded fact behind a tangible scar or shop stamp.
 * This is a presentation adapter only: nothing writes the service archive.
 */
const whole=v=>Number.isFinite(v)?Math.round(v):0;
const readableTime=t=>Number.isFinite(t)&&t>=946684800000?
  new Date(t).toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'}):
  'DATE UNRECORDED';
export function physicalEvidenceDescription(raw){
  if(raw?.type==='service-tally'){
    const repairs=Number.isSafeInteger(raw.repairs)?raw.repairs:0;
    return Object.freeze({
      title:'SERVICE PLATE',serial:String(raw.serial||''),
      detail:'Documented workshop repairs: '+repairs,
      note:'Shop service count • location not implied',
      date:'',kind:'service',
    });
  }
  if(!raw?.eventId||!raw.serial)return null;
  if(raw.event==='service'){
    const kind=raw.mode==='workshop-rebuild'?'STRUCTURAL REBUILD':
      raw.mode==='pit-triage'?'FIELD SERVICE':'WORKSHOP REPAIR';
    return Object.freeze({
      title:kind,serial:raw.serial,
      detail:raw.coveredEventId?'Welded over a recorded penetration':'Service recorded',
      note:raw.coveredEventId?'Linked to '+raw.coveredEventId:'No precise repair location recorded',
      date:readableTime(raw.timestamp),kind:'service',
    });
  }
  if(raw.event==='impact'&&Number.isFinite(raw.internalDamage)){
    const breach=raw.internalDamage>0;
    return Object.freeze({
      title:breach?'BREACH':'ARMOR STRIKE',
      serial:raw.serial,
      detail:breach?('System damage '+whole(raw.internalDamage)):
        ('Armor absorbed '+whole(raw.armorAbsorbed)),
      note:breach?'Penetration recorded on this physical surface':
        'Impact stopped by armor',
      date:readableTime(raw.timestamp),kind:breach?'breach':'armor',
    });
  }
  return null;
}

/** A restrained context card near the touched point. No inventory edits,
 * no scrolling panel, no source record mutation; touch to dismiss.
 */
export function createPhysicalEvidenceCard() {
  const style=document.createElement('style');
  style.textContent=`
  #physical-evidence-card{position:fixed;z-index:75;width:min(228px,54vw);
    box-sizing:border-box;max-height:60dvh;overflow:auto;padding:10px 12px 9px;
    color:#c7d4bb;background:rgba(14,26,22,.96);border:1px solid #ba965b;
    box-shadow:0 8px 24px #000b;font-family:Oxanium,monospace;
    pointer-events:auto}
  #physical-evidence-card[hidden]{display:none}
  #physical-evidence-card .evidence-close{position:absolute;right:5px;top:4px;
    min-width:28px;min-height:28px;border:1px solid #6b786c;background:#1a2822;
    color:#e4c494;font:800 15px monospace}
  #physical-evidence-card .evidence-title{display:block;padding-right:25px;
    font-size:12px;font-weight:800;color:#ebba74;letter-spacing:.07em}
  #physical-evidence-card .evidence-serial{display:block;margin:4px 0;
    font:700 9px monospace;color:#91b8ad;overflow-wrap:anywhere}
  #physical-evidence-card .evidence-detail{display:block;
    font-size:11px;font-weight:700;color:#e3d2a7}
  #physical-evidence-card .evidence-note{display:block;font-size:9px;
    line-height:1.35;margin:5px 0;color:#a1b5a2;overflow-wrap:anywhere}
  #physical-evidence-card .evidence-date{display:block;font:700 8px monospace;
    color:#899b8f}
  `;
  document.head.append(style);
  const card=document.createElement('section');
  card.id='physical-evidence-card';card.hidden=true;
  card.setAttribute('aria-label','Machine service history');
  const closeButton=document.createElement('button');
  closeButton.className='evidence-close';closeButton.type='button';
  closeButton.textContent='×';closeButton.setAttribute('aria-label','Close damage details');
  const title=document.createElement('strong');title.className='evidence-title';
  const serial=document.createElement('span');serial.className='evidence-serial';
  const detail=document.createElement('span');detail.className='evidence-detail';
  const note=document.createElement('span');note.className='evidence-note';
  const date=document.createElement('small');date.className='evidence-date';
  card.append(closeButton,title,serial,detail,note,date);
  document.body.append(card);
  const close=()=>{card.hidden=true;};
  closeButton.addEventListener('click',close);
  const open=(raw,x,y)=>{
    const fact=physicalEvidenceDescription(raw);
    if(!fact)return false;
    title.textContent=fact.title;serial.textContent=fact.serial;
    detail.textContent=fact.detail;note.textContent=fact.note;
    date.textContent=fact.date;
    const vw=document.documentElement.clientWidth,vh=document.documentElement.clientHeight;
    card.style.left=Math.max(8,Math.min(vw-245,x+17))+'px';
    card.style.top=Math.max(60,Math.min(vh-150,y-33))+'px';
    card.hidden=false;return true;
  };
  return {open,close,element:card};
}
