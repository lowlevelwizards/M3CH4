/** B.3 bounded footprint evidence from committed ground contacts. */
export const FOOTPRINT_POOL_CAP=56;
export const FAMILY_SOLES=Object.freeze({
 'legs-yard':Object.freeze({width:.48,length:.70}),
 'legs-compact':Object.freeze({width:.31,length:.54}),
 'legs-hauler':Object.freeze({width:.64,length:.98}),
});
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function groundFootprint(contact,rig,family='legs-yard',surface='concrete'){
 if(!contact||contact.landings<=0)return null;
 const foot=contact.feet.find(f=>f.side===contact.lastLandingSide);
 if(!foot||!Number.isFinite(foot.x)||!Number.isFinite(foot.z))return null;
 const sole=FAMILY_SOLES[family]??FAMILY_SOLES['legs-yard'];
 return {x:foot.x,z:foot.z,yaw:rig.yaw??0,side:foot.side,
    width:sole.width,length:sole.length,surface,
    opacity:clamp((contact.lastLandingStrength??.4)*.17+.08,.08,.27)};
}
