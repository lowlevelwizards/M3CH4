/** Isolated, deliberately disposable Yardwalker replacement proportion studies.
 * No production part/IK/catalogue mutations; everything is expressed in metres.
 * Shared U1 mount and nominal ground are fixed, the silhouette is NOT.
 */
export const SILHOUETTE_PRESETS=Object.freeze([
  Object.freeze({id:'strider',title:'A / INDUSTRIAL STRIDER',
    brief:'Tall excavator-like linkages · exposed knee · narrow heavy feet',
    hipSpan:1.14,thighMass:.29,shinMass:.24,kneeOffset:.31,
    thighShare:.54,footSize:.88,hipY:.35,bow:.025,ankleZ:-.045,
    frontToe:.10,carriageDepth:.37}),
  Object.freeze({id:'bruiser',title:'B / DOCKYARD BRUISER',
    brief:'Squat wide load path · huge thigh castings · short powerful shins',
    hipSpan:1.33,thighMass:.49,shinMass:.37,kneeOffset:.16,
    thighShare:.69,footSize:1.10,hipY:.31,bow:.02,ankleZ:-.07,
    frontToe:.10,carriageDepth:.47}),
  Object.freeze({id:'hound',title:'C / UTILITY HOUND',
    brief:'Deep rearward knee · asymmetric bent links · compact weight-catching boots',
    hipSpan:1.12,thighMass:.33,shinMass:.265,kneeOffset:.44,
    thighShare:.53,footSize:.84,hipY:.27,bow:-.055,ankleZ:-.19,
    frontToe:.15,carriageDepth:.32}),
]);
export const TUNABLES=Object.freeze({
  hipSpan:Object.freeze({min:.96,max:1.48,step:.01,label:'Hip span',unit:'m'}),
  thighMass:Object.freeze({min:.21,max:.62,step:.01,label:'Thigh width',unit:'m'}),
  kneeOffset:Object.freeze({min:.06,max:.52,step:.01,label:'Rear knee offset',unit:'m'}),
  thighShare:Object.freeze({min:.40,max:.78,step:.01,label:'Thigh / shin split',unit:''}),
  footSize:Object.freeze({min:.70,max:1.23,step:.01,label:'Boot scale',unit:'×'}),
});
export const U1_SILHOUETTE_MOUNT=Object.freeze([0,.825,0]);
export const SILHOUETTE_GROUND_Y=-.825;
export function clampParameter(key,value){
  const cfg=TUNABLES[key];if(!cfg)throw Error('Unknown silhouette control '+key);
  return Number.isFinite(Number(value))?Math.min(cfg.max,Math.max(cfg.min,Number(value))):cfg.min;
}
export function candidateById(id){
  const p=SILHOUETTE_PRESETS.find(p=>p.id===id);
  if(!p)throw Error('Unknown study candidate '+id);
  return {...p};
}
export function deriveSilhouette(config){
  const p={...candidateById(config.id),...config};
  for(const k of Object.keys(TUNABLES))p[k]=clampParameter(k,p[k]);
  const footWidth=.54*p.footSize;
  const footDepth=.72*p.footSize;
  const footHeight=.19;
  const ankleY=-.578,footY=SILHOUETTE_GROUND_Y+footHeight/2;
  const kneeY=p.hipY+(ankleY-p.hipY)*p.thighShare;
  const kneeZ=p.kneeOffset;
  const legs=[-1,1].map(side=>{
    const hx=side*p.hipSpan/2,kx=hx+side*p.bow,fx=hx+side*.015;
    return {side,
      hip:[hx,p.hipY,.02],
      knee:[kx,kneeY,kneeZ],
      ankle:[fx,ankleY,p.ankleZ],
      foot:[fx,footY,p.ankleZ-p.frontToe],
    };
  });
  return {...p,legs,footWidth,footDepth,footHeight,kneeY,
    mount:[...U1_SILHOUETTE_MOUNT],floor:SILHOUETTE_GROUND_Y,
    footprintSpan:Math.abs(legs[1].foot[0]-legs[0].foot[0])+footWidth,
    isNominalWidth:Math.max(p.hipSpan+p.thighMass*.9,p.hipSpan+.26,p.hipSpan+footWidth)<=2.001,
    fullSpan:Math.max(p.hipSpan+p.thighMass*.9,p.hipSpan+.26,p.hipSpan+footWidth)};
}
