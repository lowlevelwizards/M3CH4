import { zoneOpportunity, casualtyAssignment, assaultStagingPoint } from './adaptiveTactics.js';
/** Small exhaustive team assignment planner. Six rigs total makes a full general
 * scheduler unnecessary. Jobs are real tactical consequences of the objective.
 * No path, transform, ammo or damage mutation happens here.
 */
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
const clamp=(x,a=0,b=1)=>Math.min(b,Math.max(a,x));
const other=team=>team==='friendly'?'hostile':'friendly';
function zoneJobs(snapshot,team,strategy=null) {
    const zones=snapshot.zones??[], ours=zones.filter(z=>z.owner===team&&!z.contested).length;
    const theirs=zones.filter(z=>z.owner===other(team)&&!z.contested).length;
    const enemyMajority=theirs>=2;
    const ourMajority=ours>=2;
    return zones.flatMap(z=>{
        const enemyOwned=z.owner===other(team);
        const friendlyOwned=z.owner===team;
        const threat=z.contested||enemyOwned;
        const job=enemyOwned?'CONTEST':friendlyOwned?'DEFEND':'CAPTURE';
        // Team-wide match pressure, rather than fixed actor IDs, drives urgency.
        const urgency=enemyMajority&&threat?1.34:
            ourMajority&&friendlyOwned?1.11:
            z.contested?1.18:1;
        let base=(enemyOwned?.94:friendlyOwned?.59:.83)*urgency+
            (zoneOpportunity(z,team,ourMajority)-.95)*.55;
        if(friendlyOwned&&!z.contested&&ourMajority)base+=.18;
        if(strategy?.target===z.id && ['ROTATE','BREAK_MAJORITY'].includes(strategy.phase))
            base+=.55;
        if(strategy?.phase==='ROTATE'&&z.contested&&strategy.target!==z.id)
            base-=.35;
        if(strategy?.phase==='HOLD_MAJORITY'&&friendlyOwned)base+=.13;
        const primary={id:job+':'+z.id,kind:job,objectiveId:z.id,point:{...z.point},zone:z,
            priority:base,defended:friendlyOwned,contested:z.contested,
            note:enemyMajority&&threat?'BREAK ENEMY MAJORITY':
                ourMajority&&friendlyOwned?'PROTECT SCORING MAJORITY':
                enemyOwned?'RECAPTURE':friendlyOwned?'DEFEND':'CLAIM NEUTRAL'};
        // A real two-rig attack: one pilot occupies the scoring footprint
        // while another screens the objective approach, not an extra
        // fixed-ID script. A screen still has physical occupancy and can die.
        if(z.id===strategy?.target &&
           ['BREAK_MAJORITY','ROTATE'].includes(strategy.phase)&&threat)
            return [primary,{id:'SCREEN:'+z.id,kind:'SCREEN',
                objectiveId:z.id,point:{...z.point},zone:z,priority:base-.12,
                defended:false,contested:z.contested,
                note:'SCREEN CAPTURER · INTERCEPT APPROACH'}];
        return [primary];
    });
}
function suitability(actor,job,team) {
    const d=dist(actor.position,job.point);
    const cap=actor.capability;
    if(!cap.canMove&&d>3.5)return -100;
    const travel=d/Math.max(.6,3.6*cap.speed);
    const here=d<3.5;
    const role=actor.behavior;
    const offense=['CONTEST','SCREEN'].includes(job.kind)?
        Math.min(cap.weapon,cap.endurance)*.17:0;
    const toughness=job.kind==='DEFEND'?cap.endurance*.2:0;
    const maneuver=job.kind==='CAPTURE'?(role==='skirmisher'?.12:0)+cap.speed*.16:0;
    const positional=here?.26:0;
    const penalty=Math.min(.62,travel*.021);
    return job.priority+offense+toughness+maneuver+positional-penalty+
        (cap.canFight?.04:-.09)+casualtyAssignment(actor,job,job.zone);
}
function assignExhaustive(actors,jobs,team,playerZoneId=null,strategy=null) {
    const entries=actors.slice(0,4).sort((a,b)=>a.id.localeCompare(b.id));
    let best=-Infinity,bestList=[];
    function walk(i,score,chosen,counts){
        if(i===entries.length) {
            const key=chosen.map(j=>j.id).join('|');
            if(score>best+1e-8 || (Math.abs(score-best)<1e-8&&
                key<bestList.map(j=>j.id).join('|'))){
                best=score;bestList=[...chosen];
            }
            return;
        }
        for(const job of jobs) {
            const value=suitability(entries[i],job,team);
            if(value<0)continue;
            const n=counts.get(job.objectiveId)??0;
            // First unit wins most value. A second can reinforce, but piling the
            // entire team onto one objective wastes the other two positions.
            const concentrating=strategy?.target===job.objectiveId&&
                strategy?.phase==='BREAK_MAJORITY';
            const duplication=(n===0?0:n===1?(concentrating?.19:.43):.88)+
                (playerZoneId===job.objectiveId&&!job.contested?.52:0);
            counts.set(job.objectiveId,n+1);
            chosen.push(job);walk(i+1,score+value-duplication,chosen,counts);
            chosen.pop();if(n)counts.set(job.objectiveId,n);else counts.delete(job.objectiveId);
        }
    }
    walk(0,0,[],new Map());
    return entries.map((actor,i)=>({actor,job:bestList[i]??null}));
}
export function planTeam(snapshot,team,options={}) {
    const view=snapshot?.knowledge?.[team];
    if(!view)return {team,orders:{},reason:'NO KNOWLEDGE'};
    const actors=view.allies.filter(a=>a.id!=='player'&&a.active);
    const orders={};
    if(snapshot.kind==='domination'&&snapshot.zones.length) {
        const strategy=options.strategy??null;
        const jobs=zoneJobs(snapshot,team,strategy);
        // The player's physical occupation counts as team coverage but the
        // squad never issues player input or forces a player to defend a point.
        const player=view.allies.find(a=>a.id==='player');
        const playerZone=player?snapshot.zones.find(z=>
            dist(z.point,player.position)<4.7):null;
        const assignedPairs=assignExhaustive(actors,jobs,team,playerZone?.id,strategy);
        for(const pair of assignedPairs) {
            const {actor,job}=pair;
            if(!job){orders[actor.id]={goal:'HOLD',point:{...actor.position},
                role:'ANCHOR',reason:'UNABLE TO REACH OBJECTIVE',
                note:'UNABLE TO REACH OBJECTIVE',score:0};continue;}
            const suitabilityScore=suitability(actor,job,team);
            const playerCoverage=playerZone?.id===job.objectiveId&&
                !job.contested&&job.kind==='DEFEND';
            orders[actor.id]={goal:job.kind,objectiveId:job.objectiveId,
                point:{...job.point},radius:snapshot.zoneRadius??4.7,
                score:clamp(suitabilityScore/1.7),
                note:playerCoverage?'SUPPORT PLAYER POSITION':job.note,
                reason:strategy?.phase==='ROTATE'&&job.objectiveId===strategy.target?
                    'ROTATE · '+job.note:job.note,
                strategy:strategy?.phase??'TAKE_GROUND',
                role:job.kind==='DEFEND'?'ANCHOR':
                    job.kind==='SCREEN'?'SCREEN':
                    job.kind==='CONTEST'?'INTERCEPT':
                    strategy?.phase==='ROTATE'&&job.objectiveId===strategy.target?
                        'FLANKER':'CAPTURER'};
        }
        // Human pilot is not controllable by the planner. Nearby supporting
        // allies cover approaches instead of crowding the player's point.
        if(playerZone && playerZone.owner===team&&!playerZone.contested) {
            for(const [id,order] of Object.entries(orders)){
                if(order.objectiveId!==playerZone.id||order.goal==='SCREEN')continue;
                const alternatives=jobs.filter(j=>j.objectiveId!==playerZone.id)
                  .sort((a,b)=>b.priority-a.priority);
                if(alternatives.length && order.goal==='DEFEND' &&
                    actors.some(a=>a.id===id&&a.capability?.canMove)){
                    const next=alternatives[0];
                    orders[id]={...order,goal:next.kind,objectiveId:next.objectiveId,
                        point:{...next.point},role:'FLANKER',reason:'PLAYER HOLDS '+playerZone.id,
                        note:'FREE ALLY TO SUPPORT PLAYER',score:clamp(next.priority/1.7)};
                }
            }
        }
        // Synchronize a real two-rig assault for at most four seconds.
        // The staging state cannot hold a squad hostage if one rig is late.
        const memory=options.assaultMemory;
        if(memory && ['ROTATE','BREAK_MAJORITY'].includes(strategy?.phase)) {
            const paired=Object.entries(orders).filter(([,o])=>
                o.objectiveId===strategy.target&&['CONTEST','CAPTURE','SCREEN'].includes(o.goal));
            if(paired.length>=2){
                if(memory.target!==strategy.target){
                    memory.target=strategy.target;memory.since=snapshot.time??0;
                }
                const age=(snapshot.time??0)-(memory.since??0);
                if(age<4){
                    const attackZone=snapshot.zones.find(z=>z.id===strategy.target);
                    const far=paired.filter(([id])=>{
                        const me=actors.find(a=>a.id===id);
                        return me&&dist(me.position,attackZone.point)>7;
                    });
                    if(far.length>0){
                        const [leaderId]=paired[0], leader=actors.find(a=>a.id===leaderId);
                        for(const [id,order] of paired){
                            const me=actors.find(a=>a.id===id);
                            if(!me||!leader)continue;
                            orders[id]={...order,goal:'STAGE',radius:null,
                              point:assaultStagingPoint(me,attackZone.point,leader),
                              role:order.role,reason:'ASSEMBLE FOR ASSAULT · '+strategy.target};
                        }
                    }
                }
            }
        }else if(memory){memory.target=null;}
        return {team,orders,reason:strategy?.reason??'TERRITORY MAJORITY',
            strategy:strategy?.phase??'TAKE_GROUND',
            target:strategy?.target??null,stalledFor:strategy?.stalledFor??0,
            scoring:Math.floor(snapshot.score[team])};
    }
    const contacts=view.contacts.filter(c=>c.confidence>.12);
    for(const [index,actor] of actors.entries()) {
        const nearest=[...contacts].sort((a,b)=>
            dist(actor.position,a.position)-dist(actor.position,b.position))[0];
        if(nearest) orders[actor.id]={goal:nearest.visible?'ENGAGE':'SEARCH',
            targetActorId:nearest.id,point:{...nearest.position},
            score:nearest.confidence,note:nearest.visible?'ENGAGE OBSERVED THREAT':'LAST KNOWN CONTACT'};
        else if(snapshot.missions?.[team]){
            const rally=snapshot.missions[team];
            const search=snapshot.kind==='elimination';
            // Opening search uses a broad front, not a pile-up at the central
            // loading house. It depends on roster order, not permanent pilot IDs.
            const flank=index%2===0?-10:10;
            const point=search?{x:rally.x+flank,z:rally.z}:rally;
            orders[actor.id]={goal:search?'SEARCH':'CAPTURE',point,
                score:.78,note:search?'SWEEP FLANK FOR CONTACT':'ADVANCE OBJECTIVE'};
        }
        else orders[actor.id]={goal:'HOLD',point:{...actor.position},score:.2,note:'NO CONTACT'};
    }
    return {team,orders,reason:contacts.length?'CONTACT':'OBJECTIVE / SEARCH'};
}
