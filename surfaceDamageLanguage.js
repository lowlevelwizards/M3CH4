/** Pure, deliberately conservative physical damage vocabulary.
 * Outcome comes from combat authority; this never invents penetrations.
 * Scale values are in world metres because M3CH4 uses physical part envelopes.
 */
const clamp=(n,a,b)=>Math.max(a,Math.min(b,Number.isFinite(n)?n:a));
export function surfaceDamageLanguage(event) {
  const absorbed=Math.max(0,Number(event?.armorAbsorbed)||0);
  const internal=Math.max(0,Number(event?.internalDamage)||0);
  const breach=internal>0 || event?.kind==='penetration';
  const catastrophic=breach && !!event?.destroyed;
  const severity=clamp((absorbed+internal*1.65)/80,.12,1);
  const slot=String(event?.surfaceId||'').split('/')[0];
  const heatCues=slot==='power-forge'||slot==='power-dynamo'||slot==='power-air';
  if(catastrophic)return Object.freeze({
    kind:'destroyed-breach',width:.35+severity*.20,height:.33+severity*.20,
    soot:heatCues,shape:'ragged-round',meaning:'structural or housing destruction',
  });
  if(breach)return Object.freeze({
    kind:heatCues?'power-breach':'breach',
    width:.24+severity*.17,height:.24+severity*.17,
    soot:heatCues,shape:'round',meaning:'actual internal penetration',
  });
  return Object.freeze({
    kind:'armor-scrape',
    width:.13+severity*.21,height:.055+severity*.075,
    soot:false,shape:'directional',meaning:'armor absorbed without penetration',
  });
}

/** Functional disablement is separate from the mark produced by its last hit.
 * Do not automatically draw a hole for a fault that didn't penetrate.
 */
export function physicalFailurePose(slot,part) {
  const ratio=part?.maxIntegrity>0
    ?clamp(part.integrity/part.maxIntegrity,0,1):1;
  const destroyed=!!part?.destroyed;
  const disabled=destroyed||ratio<=.001;
  if(!disabled)return Object.freeze({y:0,x:0,z:0,deadOptic:false});
  const poses={
    structure:{y:-.11,x:.035,z:.085},
    mobility:{y:-.09,x:.045,z:-.075},
    power:{y:-.045,x:-.09,z:.11},
    command:{y:-.08,x:.10,z:.13},
    combat:{y:-.10,x:.18,z:-.12},
  };
  const p=poses[slot]||{y:0,x:0,z:0};
  return Object.freeze({...p,deadOptic:slot==='command'});
}
