/** Hauler H2 fantasy-first design contracts. NO dependency on haulerVisual.js.
 * Source: three approved concept-art directions. Only the real catalogue
 * interface/envelope is shared with production, not its shape or animation.
 * All units metres; +Z rearward, floor at -0.84 in mobility-local space.
 */
export const H2_INTERFACE=Object.freeze({
 catalogId:'legs-hauler',width:2.55,height:1.68,depth:1.35,
 mount:[0,.84,0],floor:-.84,adapterKg:110,
 native:'H2',receiver:'U1'
});
export const HAULER_PRESETS=Object.freeze([
 Object.freeze({id:'dock',letter:'A',title:'DOCKYARD LIFTER',
  brief:'A dock machine with broad stationary drive pods and short compression stacks',
  role:'LOW / WIDE / PLANTED',hipSpan:1.89,hipY:.21,kneeY:-.18,kneeZ:.15,
  ankleY:-.63,ankleZ:-.02,footWidth:.62,podScale:1.0,stride:.115,lift:.058,
  recovery:1.65,stance:'very-wide',mechanism:'compression-stack'}),
 Object.freeze({id:'strider',letter:'B',title:'INDUSTRIAL STRIDER',
  brief:'Tall heavy hydraulic columns, suspended yoke and long load-bearing reach',
  role:'REACH / TRAVEL / COLUMN',hipSpan:1.80,hipY:.30,kneeY:-.17,kneeZ:.06,
  ankleY:-.64,ankleZ:-.06,footWidth:.61,podScale:.86,stride:.18,lift:.092,
  recovery:1.35,stance:'upright',mechanism:'hydraulic-column'}),
 Object.freeze({id:'crane',letter:'C',title:'YARD CRANE',
  brief:'Crank-driven triangular leverage, coupled push-rods and load-spreading feet',
  role:'TRIANGLE / LEVER / CATCH',hipSpan:1.86,hipY:.23,kneeY:-.24,kneeZ:.25,
  ankleY:-.64,ankleZ:-.12,footWidth:.60,podScale:.90,stride:.145,lift:.075,
  recovery:1.50,stance:'braced',mechanism:'crank-linkage'})
]);
export const HAULER_TUNABLES=Object.freeze({
 hipSpread:Object.freeze({label:'Hip stance',min:-.035,max:.035,step:.005,unit:'m'}),
 footScale:Object.freeze({label:'Load shoe size',min:.88,max:1.06,step:.01,unit:'×'}),
 podScale:Object.freeze({label:'Drive housing size',min:.85,max:1.07,step:.01,unit:'×'}),
 stroke:Object.freeze({label:'Stride travel',min:.75,max:1.22,step:.01,unit:'×'})
});
export function preset(id){
 const value=HAULER_PRESETS.find(p=>p.id===id);
 if(!value)throw Error('Unknown Hauler fantasy concept '+id);
 return {...value,hipSpread:0,footScale:1,podScale:value.podScale,stroke:1};
}
export function adjust(id,edit={}){
 const p={...preset(id)};
 for(const [key,rule] of Object.entries(HAULER_TUNABLES)){
  const raw=Number(edit[key]??p[key]);
  p[key]=Number.isFinite(raw)?Math.max(rule.min,Math.min(rule.max,raw)):p[key];
 }
 return p;
}
export function haulerDimensions(config){
 const p=adjust(config.id,config);
 const hipX=p.hipSpan*.5+p.hipSpread;
 const leg=[-1,1].map(side=>{
  const x=side*hipX;
  const hip=[x,p.hipY,.025];
  const knee=[x,p.kneeY,p.kneeZ];
  const ankle=[x,p.ankleY,p.ankleZ];
  const foot=[x,-.750,p.ankleZ-.10];
  return {side,hip,knee,ankle,foot};
 });
 const soleWidth=p.footWidth*p.footScale;
 return {...p,legs:leg,soleWidth,soleDepth:.88*p.footScale,
  topContact:[...H2_INTERFACE.mount],ground:H2_INTERFACE.floor,
  maxFootX:hipX+soleWidth*.5,
  strideDistance:p.stride*p.stroke};
}
export const HAULER_IDS=Object.freeze(HAULER_PRESETS.map(p=>p.id));
