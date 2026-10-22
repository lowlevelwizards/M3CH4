/** Procedural visual failure anatomy for the three real mobility families.
 * This module never affects physics/collision, health, economy or pathfinding.
 * Results derive from actual module failures; pure so Node and browser agree.
 */
const families=Object.freeze({
  'legs-yard':Object.freeze({
    name:'workmanlike off-center slump',
    rootDrop:.045,rootPitch:.045,rootRoll:.070,
    hip:[-.17,.07],knee:[.22,.10],ankle:[-.08,-.06],foot:[-.05,.07],
    framePitch:.045,frameRoll:.045,
  }),
  'legs-compact':Object.freeze({
    name:'folded runner, broken digitigrade stance',
    rootDrop:.072,rootPitch:.105,rootRoll:.092,
    hip:[-.29,.16],knee:[.42,.12],ankle:[-.21,-.10],foot:[-.07,.11],
    framePitch:.085,frameRoll:.055,
  }),
  'legs-hauler':Object.freeze({
    name:'low hydraulic compression on the heavy drive pods',
    rootDrop:.082,rootPitch:.020,rootRoll:.038,
    hip:[-.12,-.08],knee:[.25,.24],ankle:[-.14,-.13],foot:[.03,-.02],
    framePitch:.016,frameRoll:.020,
  }),
});
const clamp=(v,lo,hi)=>Math.min(hi,Math.max(lo,Number.isFinite(v)?v:lo));
export function familyFailureAnatomy(id,{mobilityDisabled=false,
  mobilityDestroyed=false,structureDisabled=false,structureDestroyed=false,
  active=true}={}){
  const family=families[id]||families['legs-yard'];
  const mobility=mobilityDestroyed?1.35:mobilityDisabled?1:0;
  const frame=structureDestroyed?1.3:structureDisabled?1:0;
  const defeated=active?0:1;
  const factor=Math.max(mobility,frame*.68,defeated*.68);
  const lower=mobile=>mobile*mobility;
  return Object.freeze({
    family:id in families?id:'legs-yard',name:family.name,
    rootDrop:clamp(family.rootDrop*factor,0,.12),
    rootPitch:clamp(family.rootPitch*(mobility+.45*defeated)+family.framePitch*frame,0,.21),
    rootRoll:clamp(family.rootRoll*mobility+family.frameRoll*frame+defeated*.018,-.2,.2),
    legs:Object.freeze([-1,1].map((side,i)=>Object.freeze({
      side,
      hip:lower(family.hip[i]),
      knee:lower(family.knee[i]),
      ankle:lower(family.ankle[i]),
      foot:lower(family.foot[i]),
    }))),
    compromised:factor>0,
  });
}
export function conditionFailureFlags(parts={}) {
  function fails(part) {
    if(!part)return false;
    return !!part.destroyed||(Number.isFinite(part.integrity)&&
      Number.isFinite(part.maxIntegrity)&&part.maxIntegrity>0&&part.integrity<=0);
  }
  return Object.freeze({
    mobilityDisabled:fails(parts.mobility),
    mobilityDestroyed:!!parts.mobility?.destroyed,
    structureDisabled:fails(parts.structure),
    structureDestroyed:!!parts.structure?.destroyed,
  });
}
