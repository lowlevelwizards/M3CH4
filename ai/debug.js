/** Bounded decision trace, intentionally limited to developer diagnostics. */
export function recordAiDecision(trace,actor,brain,executor,time){
    const rows=trace?.rows??[];
    const current=brain?.intent;
    if(!current)return;
    const previous=rows.find(x=>x.actorId===actor.id);
    const row={actorId:actor.id,goal:current.goal,
        objectiveId:current.objectiveId??null,
        role:current.role??null,strategy:current.strategy??null,
        reason:current.reason,utility:Math.round((current.utility??0)*100),
        committedFor:Math.max(0,Math.round((brain.committedUntil-time)*10)/10),
        routeFailure:executor?.lastFailure??null,
        trafficYields:executor?.trafficYields??0,
        scoringSettles:executor?.zoneSettles??0,
        routeSwitches:executor?.routeSwitches??0,
        anchor:!!current.anchor,history:brain.history.slice(-5)};
    if(previous)rows.splice(rows.indexOf(previous),1);
    rows.push(row);
    trace.rows=rows.sort((a,b)=>a.actorId.localeCompare(b.actorId));
}
export function createAiTrace(){return {rows:[]};}
export function formatAiTrace(trace){
    return (trace?.rows??[]).map(r=>r.actorId+' '+r.goal+
        (r.objectiveId?' '+r.objectiveId:'')+
        (r.role?' ['+r.role+']':'')+
        (r.strategy?' {'+r.strategy+'}':'')+
        ' · '+r.utility+'% · '+
        r.committedFor.toFixed(1)+'s'+(r.routeFailure?' · '+r.routeFailure:'')+
        (r.anchor?' · ANCHORED':'')+
        (r.trafficYields?' · YIELDS '+r.trafficYields:'')+
        (r.routeSwitches?' · ROUTES '+r.routeSwitches:'')+
        ' · '+r.reason).join('\n');
}
