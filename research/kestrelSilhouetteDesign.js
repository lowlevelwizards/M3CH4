/** Fresh fantasy-first Kestrel Naked concepts; NO production geometry.
 * The shared U1 .775m top contact and -.775m floor are the ONLY common
 * external interfaces. These are original designs, not V4 reshaping.
 */
export const SILHOUETTE_PRESETS=Object.freeze([
 Object.freeze({id:'raptor',title:'A / RAPTOR SCOUT',
  brief:'Alert high hip · taut angled hock · sharp landing wedges',
  hipSpan:.91,thighMass:.25,shinMass:.18,kneeOffset:.43,
  thighShare:.46,footSize:.85,hipY:.33,hipBow:-.018,ankleZ:-.14,
  toeSplay:.10,carriageDepth:.28}),
 Object.freeze({id:'field',title:'B / FIELD KESTREL',
  brief:'Balanced scout legset · crisp clevis knee · split field shoes',
  hipSpan:.89,thighMass:.315,shinMass:.215,kneeOffset:.345,
  thighShare:.50,footSize:.94,hipY:.35,hipBow:-.047,ankleZ:-.10,
  toeSplay:.075,carriageDepth:.33}),
 Object.freeze({id:'perch',title:'C / PERCH RUNNER',
  brief:'Tucked racing leg · deep backward hock · wide perching toe',
  hipSpan:.84,thighMass:.29,shinMass:.19,kneeOffset:.50,
  thighShare:.41,footSize:.79,hipY:.29,hipBow:.035,ankleZ:-.165,
  toeSplay:.16,carriageDepth:.24})
]);
export const TUNABLES=Object.freeze({
 hipSpan:Object.freeze({min:.75,max:1.08,step:.01,label:'Hip span',unit:'m'}),
 thighMass:Object.freeze({min:.20,max:.42,step:.01,label:'Upper casting width',unit:'m'}),
 kneeOffset:Object.freeze({min:.24,max:.59,step:.01,label:'Rear knee offset',unit:'m'}),
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
 const footWidth=.34*p.footSize,footDepth=.49*p.footSize,footHeight=.145;
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
