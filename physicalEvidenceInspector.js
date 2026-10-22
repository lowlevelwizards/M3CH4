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
