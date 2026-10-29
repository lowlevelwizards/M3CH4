/** Fresh fantasy-first Kestrel Naked concepts; NO production geometry.
 * The shared U1 .775m top contact and -.775m floor are the ONLY common
 * external interfaces. These are original designs, not V4 reshaping.
 */
export const SILHOUETTE_PRESETS=Object.freeze([
 Object.freeze({id:'raptor',title:'A / RAPTOR SCOUT',
  brief:'Alert high hip · taut angled hock · sharp landing wedges',
  hipSpan:.82,thighMass:.23,shinMass:.17,kneeOffset:.36,
  thighShare:.48,footSize:.82,hipY:.39,hipBow:-.015,ankleZ:-.14,
  toeSplay:.10,carriageDepth:.28}),
 Object.freeze({id:'field',title:'B / FIELD KESTREL',
  brief:'Balanced scout legset · crisp clevis knee · split field shoes',
  hipSpan:1.04,thighMass:.36,shinMass:.245,kneeOffset:.29,
  thighShare:.55,footSize:1.04,hipY:.33,hipBow:-.060,ankleZ:-.10,
  toeSplay:.075,carriageDepth:.33}),
 Object.freeze({id:'perch',title:'C / PERCH RUNNER',
  brief:'Tucked racing leg · deep backward hock · wide perching toe',
  hipSpan:.80,thighMass:.275,shinMass:.18,kneeOffset:.39,
  thighShare:.36,footSize:.77,hipY:.25,hipBow:.040,ankleZ:-.165,
  toeSplay:.22,carriageDepth:.24})
]);
export const TUNABLES=Object.freeze({
 hipSpan:Object.freeze({min:.75,max:1.08,step:.01,label:'Hip span',unit:'m'}),
 thighMass:Object.freeze({min:.20,max:.42,step:.01,label:'Upper casting width',unit:'m'}),
 kneeOffset:Object.freeze({min:.22,max:.395,step:.01,label:'Rear knee offset',unit:'m'}),
 thighShare:Object.freeze({min:.34,max:.60,step:.01,label:'Knee height split',unit:''}),
 footSize:Object.freeze({min:.70,max:1.16,step:.01,label:'Foot scale',unit:'×'})
});
export const KESTREL_STUDY_MOUNT=Object.freeze([0,.775,0]);
export const KESTREL_STUDY_FLOOR=-.775;
export function clampParameter(key,value){
 const c=TUNABLES[key];if(!c)throw Error('Unknown Kestrel control '+key);
 return Number.isFinite(Number(value))?
 Math.min(c.max,Math.max(c.min,Number(value))):c.min;
}
export function candidateById(id){
 const p=SILHOUETTE_PRESETS.find(x=>x.id===id);
 if(!p)throw Error('Unknown Kestrel study '+id);
 return {...p};
}
export function deriveSilhouette(raw){
 const p={...candidateById(raw.id),...raw};
 for(const key of Object.keys(TUNABLES))p[key]=clampParameter(key,p[key]);
 const footWidth=.37*p.footSize,footDepth=.53*p.footSize,footHeight=.145;
 const ankleY=-.53,footY=KESTREL_STUDY_FLOOR+footHeight/2;
 const kneeY=p.hipY+(ankleY-p.hipY)*p.thighShare;
 const legs=[-1,1].map(side=>{
  const hip=[side*p.hipSpan/2,p.hipY,.005];
  const knee=[hip[0]+side*p.hipBow,kneeY,p.kneeOffset];
  const ankle=[side*(p.hipSpan/2+.024),ankleY,p.ankleZ];
  const foot=[ankle[0],footY,ankle[2]-.058];
  return {side,hip,knee,ankle,foot};
 });
 const fullSpan=Math.max(p.hipSpan+p.thighMass*.85,p.hipSpan+.22,
   Math.abs(legs[1].foot[0]-legs[0].foot[0])+footWidth+p.toeSplay*.5);
 return {...p,legs,mount:[...KESTREL_STUDY_MOUNT],floor:KESTREL_STUDY_FLOOR,
  footWidth,footDepth,footHeight,kneeY,fullSpan,footprintSpan:fullSpan,
  isNominalWidth:fullSpan<=1.67};
}
