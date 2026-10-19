/** k.3v.6 — independent deterministic physical pellets from one fired shell.
 * No damage or range multiplier: every pellet must land through the existing
 * actual muzzle→first-mesh→armor→integrity raycast. This produces emergent range.
 */
export function pelletOffsets(shotIndex, spec, spreadScale=1) {
    const pellets=Number.isInteger(spec?.pellets)&&spec.pellets>1?spec.pellets:1;
    if(pellets===1)return null; // legacy cannons keep their original one-ray path
    if(!Number.isFinite(shotIndex)||shotIndex<1)throw Error('A fired shell needs a positive shot index');
    const spread=Math.max(0,Number(spec.spread)||0)*Math.max(0,Number(spreadScale)||0);
    const phase=shotIndex*2.399963229728653; // deterministic barrel orientation
    const result=[[0,0]]; // near-center projectile still hits if carefully aimed
    const satellites=pellets-1;
    for(let i=0;i<satellites;i++){
        const r=spread*Math.sqrt((i+.65)/satellites);
        const theta=phase+i*2.399963229728653;
        result.push([Math.cos(theta)*r,Math.sin(theta)*r]);
    }
    return result;
}
export function shotContacts(shotIndex,spec,spreadScale,trace){
    const offsets=pelletOffsets(shotIndex,spec,spreadScale);
    if(!offsets)throw Error('shotContacts is for genuinely pellet-based weapons only');
    return offsets.map(([x,y],index)=>({index,contact:trace(x,y,index)}));
}
export function pelletDamage(spec) {
    return spec?.pellets>1 ? Math.max(0,Number(spec.damage)||0) : null;
}
