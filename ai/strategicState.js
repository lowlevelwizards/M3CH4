/**
 * k.3u.2 Strategic state belongs to the TEAM, not a pilot. No physical actions,
 * privileged enemy locations, or capture mutations are performed here.
 * Progress is measured in actual score and zone ownership, not mere movement.
 */
const enemy=team=>team==='friendly'?'hostile':'friendly';
export function createStrategicState(){
    return {teams:{friendly:{lastProgress:0,lastOwnership:'',lastChange:0,lastScoreAt:0,lastScore:0,lastEnemyScore:0,lastAnyScoreAt:0,
        deadlockSince:0,failedAssaults:0,
        phase:'OPENING',phaseSince:0,target:null,changes:0},
        hostile:{lastProgress:0,lastOwnership:'',lastChange:0,lastScoreAt:0,lastScore:0,lastEnemyScore:0,lastAnyScoreAt:0,
        deadlockSince:0,failedAssaults:0,
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
    const ownership=key(snapshot,team),score=snapshot.score?.[team]??0,
        enemyScore=snapshot.score?.[enemy(team)]??0;
    if(ownership!==state.lastOwnership){
        state.lastChange=now;state.lastOwnership=ownership;
    }
    // Point ownership can churn without either team advancing the match.
    if(score>state.lastScore+.001){
        state.lastScore=score;state.lastProgress=score;state.lastScoreAt=now;
        state.deadlockSince=0;state.failedAssaults=0;
    }
    if(enemyScore>state.lastEnemyScore+.001){
        state.lastEnemyScore=enemyScore;state.lastAnyScoreAt=now;
    }
    if(score>state.lastProgress+.001)state.lastAnyScoreAt=now;
    const stalledFor=Math.max(0,now-state.lastScoreAt);
    const globalStall=Math.max(0,now-Math.max(state.lastAnyScoreAt,state.lastScoreAt));
    const repeatedlyContested=zones.some(z=>z.contested);
    if(stalledFor>=10&&repeatedlyContested&&!state.deadlockSince)
        state.deadlockSince=now;
    if(stalledFor<6)state.deadlockSince=0;
    const ours=owned(zones,team),theirs=owned(zones,enemy(team));
    const paying=ours>=2,enemyPaying=theirs>=2;
    const phase=paying?'HOLD_MAJORITY':
        enemyPaying?'BREAK_MAJORITY':
        globalStall>=14&&!paying?'ROTATE':
        repeatedlyContested?'SPLIT_PRESSURE':'TAKE_GROUND';
    const best=[...zones].filter(z=>z.owner!==team||z.contested)
        .sort((a,b)=>{
            // Exposed neutral ground is generally worth more than dogpiling a
            // defended zone. Public occupancies are fair objective information.
            const rank=z=>(z.owner===null?0:z.owner===enemy(team)?1:2)+
                z[enemy(team)]*.8+z[team]*.24;
            return rank(a)-rank(b)||a.id.localeCompare(b.id);
        })[0]??zones.find(z=>z.owner===team)??zones[0];
    if(phase!==state.phase && (now-state.phaseSince>=7 ||
        phase==='BREAK_MAJORITY'||phase==='HOLD_MAJORITY'||phase==='ROTATE'||
        (state.phase==='ROTATE'&&stalledFor<6))){
        state.phase=phase;state.phaseSince=now;state.changes++;
        state.target=best.id;
    }else if(phase==='ROTATE'&&now-state.phaseSince>=8){
        const alternatives=zones.filter(z=>z.id!==state.target&&
            (z.owner!==team||z.contested));
        if(alternatives.length){
            state.failedAssaults++;
            state.target=alternatives[state.failedAssaults%alternatives.length].id;
            state.phaseSince=now;state.changes++;
        }
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
        stalledFor:+stalledFor.toFixed(2),
        globalStall:+globalStall.toFixed(2),changes:state.changes,
        failedAssaults:state.failedAssaults,deadlockSince:state.deadlockSince,
        friendlyPoints:ours,hostilePoints:theirs};
}
