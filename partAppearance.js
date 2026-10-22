/** Derive repeatable surface appearance from existing physical serial data.
 * No random state, no changes to economy/condition, no save writes.
 */
import {artHash} from './artStyleSeed.js';
import {EXPOSURE_PROFILES} from './partSurfaceRegistry.js';
const clamp=(v)=>Math.max(0,Math.min(1,Number.isFinite(v)?v:0));
const ratio=(v,scale)=>clamp((Number(v)||0)/scale);
export function appearanceForPart(part,history=null) {
  const serial=String(part?.serial||'PREVIEW-001');
  const seed=artHash(serial+'|'+(part?.definitionId||'unknown'));
  const wear=clamp(part?.wear);
  const repairs=Math.max(0,Number(part?.repairs)||0);
  const deployments=Math.max(0,Number(history?.deployments)||0);
  const distance=Math.max(0,Number(history?.distanceTravelledM)||0);
  const fired=Math.max(0,Number(history?.roundsFired)||0);
  const impacts=Math.max(0,Number(history?.impacts)||0);
  const service=Math.max(0,Number(history?.timesFieldServiced)||0);
  // High event counts saturate gracefully, not ever-increasing visual noise.
  const time=clamp(.20*ratio(deployments,35)+.28*wear+.30*ratio(distance,23000)+
    .16*ratio(fired,1800)+.06*ratio(impacts,70));
  return Object.freeze({
    serial,seed,
    abrasion:clamp(.07+time*.74+wear*.16),
    grime:clamp(.08+time*.58+(seed%17)/170),
    oxidation:clamp(.025+time*.32+ratio(impacts,90)*.16),
    heat:clamp(.04+ratio(fired,1200)*.72+time*.13),
    service:clamp(ratio(repairs+service,9)),
  });
}
export function appearanceForSurface(state,descriptor) {
  const profile=EXPOSURE_PROFILES[descriptor?.exposure]||EXPOSURE_PROFILES['painted-panel'];
  if(descriptor?.role==='optical')return Object.freeze({seed:0,painted:0,
    abrasion:0,grime:0,oxidation:0,heat:0,service:0});
  const role=descriptor?.role||'structure';
  const painted=/paint|accent/.test(role);
  const seed=artHash((state?.serial||'PREVIEW')+'|'+(descriptor?.id||'unidentified'));
  return Object.freeze({
    seed,painted:painted?1:0,
    abrasion:clamp((state?.abrasion||0)*profile.abrasion),
    grime:clamp((state?.grime||0)*profile.grime),
    oxidation:clamp((state?.oxidation||0)*profile.oxidation),
    heat:clamp((state?.heat||0)*profile.heat),
    service:clamp(state?.service),
  });
}
