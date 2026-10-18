/** k.3n.2 — compact objective sortie rules.
 *
 * Objectives sit above the existing six-rig combat simulation. They never teleport,
 * damage or pathfind actors; they only observe active rigs, accumulate objective
 * progress, and return a battle outcome when a non-elimination objective is met.
 */
export const OBJECTIVE_TYPES = Object.freeze({
    ELIMINATION: 'elimination',
    CONTROL: 'control',
    DOMINATION: 'domination',
    RECOVERY: 'recovery',
    BREAKTHROUGH: 'breakthrough',
});

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const dist = (a, b) => Math.hypot((a?.x ?? 0) - (b?.x ?? 0), (a?.z ?? 0) - (b?.z ?? 0));
const rigOf = participant => participant?.rig ?? participant;

export function createSortieObjective(contract) {
    const spec = contract?.objective ?? { type: OBJECTIVE_TYPES.ELIMINATION, label: 'ELIMINATE HOSTILE TEAM' };
    return {
        type: spec.type ?? OBJECTIVE_TYPES.ELIMINATION,
        label: spec.label ?? 'OBJECTIVE',
        description: spec.description ?? '',
        point: spec.point ? { ...spec.point } : { x: 0, z: 0 },
        friendlyGoal: spec.friendlyGoal ? { ...spec.friendlyGoal } : { x: 0, z: -24 },
        hostileGoal: spec.hostileGoal ? { ...spec.hostileGoal } : { x: 0, z: 24 },
        radius: Number(spec.radius) || 5,
        holdSeconds: Number(spec.holdSeconds) || 12,
        domination: spec.type===OBJECTIVE_TYPES.DOMINATION ? {
            points: (spec.points??[]).map(p=>({id:p.id,x:p.x,z:p.z,influence:0,owner:null,contested:false,friendly:0,hostile:0})),
            captureSeconds: Number(spec.captureSeconds)||4.2,
            capturePolicy: ['superiority','pressure'].includes(spec.capturePolicy)?
                spec.capturePolicy:'strict',
            scoreToWin: Number(spec.scoreToWin)||60,
            scoreRate: Number(spec.scoreRate)||1.0,
        } : null,
        friendlyProgress: 0,
        hostileProgress: 0,
        contested: false,
        complete: false,
        winner: null,
    };
}

function activeInZone(participants, team, point, radius) {
    return (participants ?? []).filter(participant => participant?.active !== false && participant?.team === team && dist(rigOf(participant), point) <= radius);
}

function updateDomination(state,participants,dt) {
    const spec=state.domination, points=spec.points;
    const tick=Math.min(.25,dt);
    for(const point of points) {
        point.friendly=activeInZone(participants,'friendly',point,state.radius).length;
        point.hostile=activeInZone(participants,'hostile',point,state.radius).length;
        point.contested=point.friendly>0&&point.hostile>0;
        if(!point.contested) {
            const direction=point.friendly>0?1:point.hostile>0?-1:0;
            if(direction)point.influence=clamp(point.influence+direction*tick/spec.captureSeconds,-1,1);
        } else if(['superiority','pressure'].includes(spec.capturePolicy)) {
            // Experimental A/B rule only: 2v1 can slowly push influence,
            // but a physically contested zone NEVER contributes team score.
            const net=point.friendly-point.hostile;
            if(net)point.influence=clamp(point.influence+
                Math.sign(net)*Math.min(Math.abs(net),2)*tick/(spec.captureSeconds*3),-1,1);
        }
        point.owner=point.influence>=.995?'friendly':
            point.influence<=-.995?'hostile':null;
    }
    const weight=(point,team)=>{
        if(point.owner!==team)return 0;
        if(!point.contested)return 1;
        // Experimental pressure policy: even a single lone defender slows
        // scoring drastically, but local 2v1 superiority is not a permanent
        // zero-progress veto. This is NEVER enabled by the authored contract.
        const opponent=team==='friendly'?'hostile':'friendly';
        return spec.capturePolicy==='pressure'&&point[team]>point[opponent] ? .30 : 0;
    };
    const held=team=>points.filter(p=>weight(p,team)>0);
    const ours=held('friendly'),theirs=held('hostile');
    const scoreRate=heldPoints=>heldPoints.reduce((sum,p)=>sum+
        weight(p,p.owner),0)/heldPoints.length;
    if(ours.length>=2 && theirs.length<2)
        state.friendlyProgress=Math.min(spec.scoreToWin,
            state.friendlyProgress+tick*spec.scoreRate*
            (ours.length===3?1.5:1)*scoreRate(ours));
    else if(theirs.length>=2 && ours.length<2)
        state.hostileProgress=Math.min(spec.scoreToWin,
            state.hostileProgress+tick*spec.scoreRate*
            (theirs.length===3?1.5:1)*scoreRate(theirs));
    state.contested=points.some(point=>point.contested);
    if(state.friendlyProgress>=spec.scoreToWin)
        return win(state,'friendly','DOMINATION · FRIENDLY TERRITORY SECURED');
    if(state.hostileProgress>=spec.scoreToWin)
        return win(state,'hostile','DOMINATION · HOSTILE TERRITORY SECURED');
    return null;
}
export function objectivePointForTeam(state, team) {
    if (!state || state.type === OBJECTIVE_TYPES.ELIMINATION) return null;
    if (state.type === OBJECTIVE_TYPES.DOMINATION)
        return state.domination?.points?.[1] ?? null;
    if (state.type === OBJECTIVE_TYPES.BREAKTHROUGH)
        return team === 'friendly' ? state.friendlyGoal : state.hostileGoal;
    return state.point;
}

export function objectivePresentation(state) {
    if (!state || state.type === OBJECTIVE_TYPES.ELIMINATION)
        return { visible: false };
    if(state.type===OBJECTIVE_TYPES.DOMINATION)return {
        visible:true,type:state.type,radius:state.radius,
        points:state.domination.points.map(({id,x,z,owner,contested,influence})=>
            ({id,x,z,owner,contested,influence})),
    };
    const point = objectivePointForTeam(state, 'friendly');
    return {
        visible: true,
        type: state.type,
        point,
        radius: state.radius,
        contested: state.contested,
        progress: clamp(state.friendlyProgress / Math.max(.001, state.holdSeconds), 0, 1),
    };
}

export function objectiveStatusText(state) {
    if (!state) return '';
    if (state.type === OBJECTIVE_TYPES.ELIMINATION)
        return 'OBJ · BREAK HOSTILE TEAM';
    if(state.type===OBJECTIVE_TYPES.DOMINATION) {
        const spec=state.domination;
        const zones=spec.points.map(p=>p.id+':'+(p.contested?'CONTESTED':p.owner==='friendly'?'OURS':p.owner==='hostile'?'HOSTILE':'NEUTRAL')).join(' · ');
        return `DOM · ${Math.floor(state.friendlyProgress)}/${spec.scoreToWin} — ${Math.floor(state.hostileProgress)}/${spec.scoreToWin} · ${zones}`;
    }
    const friendlyPct = Math.round(clamp(state.friendlyProgress / state.holdSeconds, 0, 1) * 100);
    const hostilePct = Math.round(clamp(state.hostileProgress / state.holdSeconds, 0, 1) * 100);
    if (state.type === OBJECTIVE_TYPES.RECOVERY)
        return `OBJ · SECURE WRECK ${friendlyPct}%${state.contested ? ' · CONTESTED' : ''}`;
    if (state.type === OBJECTIVE_TYPES.BREAKTHROUGH)
        return `OBJ · BREAKTHROUGH ${friendlyPct}% · ENEMY ${hostilePct}%`;
    return `OBJ · FIELD CONTROL ${friendlyPct}% · ENEMY ${hostilePct}%${state.contested ? ' · CONTESTED' : ''}`;
}

function win(state, team, reason) {
    state.complete = true;
    state.winner = team;
    return { victory: team === 'friendly', reason };
}

/** Advance one fixed step. Elimination remains handled by squadBattle; objective
 * outcomes are an additional way to resolve a sortie. */
export function advanceSortieObjective(state, participants, dt) {
    if (!state || state.complete || !Number.isFinite(dt) || dt <= 0 || state.type === OBJECTIVE_TYPES.ELIMINATION)
        return null;

    if(state.type===OBJECTIVE_TYPES.DOMINATION)
        return updateDomination(state,participants,dt);

    if (state.type === OBJECTIVE_TYPES.RECOVERY) {
        const friendly = activeInZone(participants, 'friendly', state.point, state.radius).length;
        const hostile = activeInZone(participants, 'hostile', state.point, state.radius).length;
        state.contested = friendly > 0 && hostile > 0;
        if (friendly > 0 && hostile === 0)
            state.friendlyProgress = Math.min(state.holdSeconds, state.friendlyProgress + dt);
        else if (friendly === 0)
            state.friendlyProgress = Math.max(0, state.friendlyProgress - dt * .22);
        if (state.friendlyProgress >= state.holdSeconds)
            return win(state, 'friendly', 'RECOVERY SITE SECURED');
        return null;
    }

    if (state.type === OBJECTIVE_TYPES.CONTROL) {
        const friendly = activeInZone(participants, 'friendly', state.point, state.radius).length;
        const hostile = activeInZone(participants, 'hostile', state.point, state.radius).length;
        state.contested = friendly > 0 && hostile > 0;
        if (friendly > 0 && hostile === 0) {
            state.friendlyProgress = Math.min(state.holdSeconds, state.friendlyProgress + dt);
            state.hostileProgress = Math.max(0, state.hostileProgress - dt * .16);
        }
        else if (hostile > 0 && friendly === 0) {
            state.hostileProgress = Math.min(state.holdSeconds, state.hostileProgress + dt);
            state.friendlyProgress = Math.max(0, state.friendlyProgress - dt * .16);
        }
        if (state.friendlyProgress >= state.holdSeconds)
            return win(state, 'friendly', 'FIELD CONTROL SECURED');
        if (state.hostileProgress >= state.holdSeconds)
            return win(state, 'hostile', 'HOSTILE FIELD CONTROL SECURED');
        return null;
    }

    if (state.type === OBJECTIVE_TYPES.BREAKTHROUGH) {
        const friendly = activeInZone(participants, 'friendly', state.friendlyGoal, state.radius).length;
        const hostile = activeInZone(participants, 'hostile', state.hostileGoal, state.radius).length;
        state.contested = friendly > 0 && hostile > 0;
        state.friendlyProgress = friendly > 0
            ? Math.min(state.holdSeconds, state.friendlyProgress + dt)
            : Math.max(0, state.friendlyProgress - dt * .55);
        state.hostileProgress = hostile > 0
            ? Math.min(state.holdSeconds, state.hostileProgress + dt)
            : Math.max(0, state.hostileProgress - dt * .55);
        if (state.friendlyProgress >= state.holdSeconds)
            return win(state, 'friendly', 'FRIENDLY BREAKTHROUGH COMPLETE');
        if (state.hostileProgress >= state.holdSeconds)
            return win(state, 'hostile', 'HOSTILE BREAKTHROUGH COMPLETE');
    }
    return null;
}
