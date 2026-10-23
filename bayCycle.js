/** Pure workshop navigation policy: closed-loop, never disabled at an edge. */
export function cycleBayId(ids,currentId,direction) {
    if(!Array.isArray(ids)||!ids.length)return null;
    const index=ids.indexOf(currentId);
    const next=((index<0?0:index)+Math.trunc(Number(direction)||0))%ids.length;
    return ids[(next+ids.length)%ids.length];
}
