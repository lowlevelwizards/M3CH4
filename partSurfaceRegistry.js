/** Stable semantic surface IDs for the physical model. Visual metadata is
 * inherited from primitive names and paint roles, never from a rig/slot index.
 * Unnamed meshes are renderable but cannot receive a durable precise scar.
 */
const clean=value=>String(value||'').toLowerCase().trim()
  .replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,70);
export const EXPOSURE_PROFILES=Object.freeze({
  'lower-exterior':Object.freeze({abrasion:1.0,grime:.85,oxidation:.7,heat:0}),
  'painted-panel':Object.freeze({abrasion:.5,grime:.35,oxidation:.32,heat:0}),
  'protected-interior':Object.freeze({abrasion:.12,grime:.45,oxidation:.12,heat:0}),
  'joint':Object.freeze({abrasion:.85,grime:.95,oxidation:.16,heat:.10}),
  'hot-mechanism':Object.freeze({abrasion:.30,grime:.72,oxidation:.15,heat:1.0}),
  'optical':Object.freeze({abrasion:0,grime:0,oxidation:0,heat:0}),
});
export function classifySurface({name='',role='',slot=''}={}) {
  const n=clean(name),r=clean(role);
  if(r==='optical'||/lens|optic|glass|viewport|windscreen/.test(n))return 'optical';
  if(/muzzle|barrel|exhaust|vent|heat|radiator/.test(n))return 'hot-mechanism';
  if(/pivot|bearing|actuator|rod|hub|hinge|shaft|race|joint/.test(n))return 'joint';
  if(/foot|shoe|sole|toe|heel|shin|calf|ankle/.test(n) && slot==='mobility')
    return 'lower-exterior';
  if(/recess|inside|internal|underside/.test(n)||r==='dark-mechanism')
    return 'protected-interior';
  return 'painted-panel';
}

/** Id uses a named path from the definition root. Repeated sibling names gain
 * disambiguation based on their authored sibling order. Those mappings are
 * versioned: later model rewrites must migrate affected IDs deliberately.
 */
export function assignPartSurfaces(root,definitionId,slot) {
  if(!root?.children) return 0;
  let count=0;
  function walk(parent,path) {
    const seen=new Map();
    for(const child of parent.children||[]){
      const raw=clean(child.name);
      const ordinal=raw?(seen.get(raw)||0):0;
      if(raw)seen.set(raw,ordinal+1);
      const segment=raw?(ordinal?raw+'-'+(ordinal+1):raw):null;
      const next=segment?[...path,segment]:path;
      if(child.isMesh){
        const role=child.material?.userData?.materialRole||
          child.userData?.materialRole||'structure';
        const exposure=classifySurface({name:child.name,role,slot});
        const stable=!!raw;
        const id=stable?[clean(definitionId),...next].join('/') : null;
        child.userData.surface={
          id,version:1,slot,role,exposure,persistable:stable,
        };
        count++;
      }
      walk(child,next);
    }
  }
  walk(root,[]);
  return count;
}
