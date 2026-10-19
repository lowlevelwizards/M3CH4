/** Research-only verbatim k3u2 93286524 authority (paths adjusted). */
/**
 * k.3u.2 Strategic state belongs to the TEAM, not a pilot. No physical actions,
 * privileged enemy locations, or capture mutations are performed here.
 * Progress is measured in actual score and zone ownership, not mere movement.
 */
const enemy=team=>team==='friendly'?'hostile':'friendly';
export function createStrategicState(){
    return {teams:{friendly:{lastProgress:0,lastOwnership:'',lastChange:0,
        phase:'OPENING',phaseSince:0,target:null,changes:0},
        hostile:{lastProgress:0,lastOwnership:'',lastChange:0,
            phase:'OPENING',phaseSince:0,target:null,changes:0}}};
}
const owned=(zones,team)=>zones.filter(p=>p.owner===team&&!p.contested).length;
function key(snapshot,team){
    return (snapshot.zones??[]).map(z=>z.id+':'+
        (z.owner===team?'O':z.owner===enemy(team)?'E':'N')+
        (z.contested?'C':'')).join('/');
}
export function evaluateStrategy(memory,snapshot,team){
    const state=memory.teams[team],now=snapshot.time??0,zones=snapshot.zones??[];
    if(snapshot.kind!=='domination'||zones.length===0)
        return {phase:'ENGAGEMENT',target:null,reason:'MISSION PLAN',stalledFor:0,changes:0};
    const ownership=key(snapshot,team),score=snapshot.score?.[team]??0;
    if(ownership!==state.lastOwnership||score>state.lastProgress+.001){
        state.lastChange=now;state.lastOwnership=ownership;state.lastProgress=score;
    }
    const stalledFor=Math.max(0,now-state.lastChange);
    const ours=owned(zones,team),theirs=owned(zones,enemy(team));
    let phase=ours>=2?'HOLD_MAJORITY':theirs>=2?'BREAK_MAJORITY':
        stalledFor>=10?'ROTATE':zones.some(z=>z.contested)?'SPLIT_PRESSURE':'TAKE_GROUND';
    if(phase==='HOLD_MAJORITY'&&zones.some(z=>z.contested))phase='HOLD_MAJORITY';
    const best=[...zones].filter(z=>z.owner!==team||z.contested)
        .sort((a,b)=>{
            // Exposed neutral ground is generally worth more than dogpiling a
            // defended zone. Public occupancies are fair objective information.
            const rank=z=>(z.owner===null?0:z.owner===enemy(team)?1:2)+
                z[enemy(team)]*.8+z[team]*.24;
            return rank(a)-rank(b)||a.id.localeCompare(b.id);
        })[0]??zones.find(z=>z.owner===team)??zones[0];
    if(phase!==state.phase && (now-state.phaseSince>=7 ||
        phase==='BREAK_MAJORITY'||phase==='HOLD_MAJORITY')){
        state.phase=phase;state.phaseSince=now;state.changes++;
        state.target=best.id;
    }
    // Target may become ours before phase cadence expires; never defend a
    // fictitious enemy-controlled point once public objective state changes.
    if(!state.target||!zones.some(z=>z.id===state.target))state.target=best.id;
    const candidate=zones.find(z=>z.id===state.target);
    if((state.phase==='ROTATE'||state.phase==='BREAK_MAJORITY')&&
       candidate?.owner===team&&!candidate.contested)state.target=best.id;
    return {phase:state.phase,target:state.target,reason:
        state.phase==='ROTATE'?'STALEMATE · ROTATE TO WEAKER POINT':
        state.phase==='BREAK_MAJORITY'?'BREAK ENEMY SCORING MAJORITY':
        state.phase==='HOLD_MAJORITY'?'PRESERVE SCORING MAJORITY':
        state.phase==='SPLIT_PRESSURE'?'PRESS SEPARATE OBJECTIVES':
        'SECURE TWO OBJECTIVES',
        stalledFor:+stalledFor.toFixed(2),changes:state.changes,
        friendlyPoints:ours,hostilePoints:theirs};
}
