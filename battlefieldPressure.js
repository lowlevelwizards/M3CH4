/** k5r.4 — deterministic evidence from ACTUAL muzzle-to-first-impact segment.
 * No infinite-ray warnings, hits behind cover, simulated ricochet damage,
 * invented sensor positions, or LOS changes. Pure policy: renderer/audio
 * decide how to present the already-resolved physical shot.
 */
const clamp=(v,a,b)=>Math.max(a,Math.min(b,Number.isFinite(v)?v:a));
export function nearMissEvidence(listener,muzzle,impact,{range=4.6,hitPlayer=false}={}){
 if(hitPlayer||!listener||!muzzle||!impact)return null;
 const dx=impact.x-muzzle.x,dy=impact.y-muzzle.y,dz=impact.z-muzzle.z;
 const len2=dx*dx+dy*dy+dz*dz;
 if(len2<.08)return null;
 const t=clamp(((listener.x-muzzle.x)*dx+(listener.y-muzzle.y)*dy+
   (listener.z-muzzle.z)*dz)/len2,0,1);
 // Actual shell must pass near the listener; muzzle proximity by itself
 // doesn't count as a flyby and neither does a shot stopped behind cover.
 if(t<.035||t>.985)return null;
 const x=muzzle.x+dx*t,y=muzzle.y+dy*t,z=muzzle.z+dz*t;
 const separation=Math.hypot(listener.x-x,listener.y-y,listener.z-z);
 if(separation>range)return null;
 return {x,y,z,t,separation,strength:clamp(1-separation/range,.12,1)};
}
export function coverMaterial(contact){
 if(!contact?.blockedBy||contact.actorId)return null;
 const id=String(contact.blockedBy).toLowerCase();
 const art=String(contact.coverArt??'').toLowerCase();
 if(/concrete|stone|masonry/.test(art))return 'concrete';
 if(/tyre|tire|rubber/.test(art))return 'rubber';
 if(/wood|pallet/.test(art))return 'wood';
 if(/floor|ground|soil|dirt|arena/.test(id))return 'earth';
 if(/concrete|pillar|stone|foundation|wall|barrier/.test(id))return 'concrete';
 if(/wheel|tyre|tire|axle|rubber/.test(id))return 'rubber';
 if(/wood|pallet|crate|board/.test(id))return 'wood';
 if(/plate|sheet|corrug|container|rail|coupling|engine|loader|tractor|scrap|pickup|implement|generator|barrel|flatbed|flywheel/.test(id))return 'metal';
 return 'metal'; // Unknown certified cover is utilitarian hard cover, not a creature.
}
export function coverStrikeLanguage(contact){
 const material=coverMaterial(contact);
 if(!material)return null;
 const dx=(contact.point?.x??0)-(contact.muzzle?.x??0),
       dy=(contact.point?.y??0)-(contact.muzzle?.y??0),
       dz=(contact.point?.z??0)-(contact.muzzle?.z??0);
 const length=Math.hypot(dx,dy,dz);
 if(length<.001)return null;
 const normal=contact.normal??{x:0,y:1,z:0};
 const incidence=Math.abs((dx*normal.x+dy*normal.y+dz*normal.z)/length);
 const hard=material==='metal'||material==='concrete';
 // Cosmetic tangent streak only at a plausible shallow strike.
 const ricochet=hard&&incidence<.32;
 return {material,ricochet,incidence,
   sparks:material==='metal'?(ricochet?7:5):material==='concrete'?2:0,
   chips:material==='concrete'?8:material==='earth'?7:material==='wood'?5:material==='metal'?4:2,
   smoke:material==='earth'?4:material==='concrete'?3:material==='wood'?2:1,
   rattle:material==='metal'};
}
export function soundBearing(source,listener,heading=0){
 if(!source||!listener)return 0;
 const dx=source.x-listener.x,dz=source.z-listener.z;
 const distance=Math.hypot(dx,dz);
 if(distance<.001)return 0;
 // Physics yaw: forward (sin yaw,-cos yaw); camera right (cos yaw,sin yaw).
 return clamp((dx*Math.cos(heading)+dz*Math.sin(heading))/distance,-1,1);
}
export function coverProximity(point,listener,range=9){
 if(!point||!listener)return 0;
 const distance=Math.hypot(point.x-listener.x,point.y-listener.y,point.z-listener.z);
 return clamp(1-distance/range,0,1);
}
