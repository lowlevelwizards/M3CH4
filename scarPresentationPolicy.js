/** Bounded mobile scar selection. The service story is more important than
 * whichever superficial scratch happened most recently. Never edit archives.
 * Prefer real physical repairs, structural breaches, and newest recent hits.
 */
export function scarPriority(event) {
  if(event?.event==='service')return event.coveredEventId?100:85;
  if(event?.destroyed && Number(event.internalDamage)>0)return 80;
  if(Number(event?.internalDamage)>0)return 60;
  return 20;
}
export function keepPhysicalScars(marks,limit=4) {
  const cap=Math.max(0,Math.floor(Number(limit)||0));
  if(!cap)return [];
  const ranked=marks.map((mark,index)=>({
    mark,index,event:mark?.userData?.sourceSurfaceEvent,
  })).sort((a,b)=>scarPriority(b.event)-scarPriority(a.event)||
    (b.event?.timestamp||0)-(a.event?.timestamp||0)||b.index-a.index);
  const keep=new Set(ranked.slice(0,cap).map(x=>x.mark));
  return marks.filter(mark=>keep.has(mark));
}
