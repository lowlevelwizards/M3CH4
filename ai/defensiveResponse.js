/** Evidence-driven single-screener response to a recent side/rear attack.
 * This module sees only allied state and *shared known contacts*, not hidden
 * current enemy coordinates. One free pilot responds; the others hold fire
 * control/objectives rather than all blindly rotating to a new contact. */
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
export function planCounterFlankResponses(view,orders={},now=0){
    const allies=(view?.allies??[]).filter(a=>a.active&&a.id!=='player');
    const contacts=view?.contacts??[];
    const response={};
    const claimed=new Set();
    const victims=(view?.allies??[]).filter(a=>a.active&&
        a.underFireSeconds>.35&&a.threatPosition)
        .sort((a,b)=>b.underFireSeconds-a.underFireSeconds||a.id.localeCompare(b.id));
    for(const victim of victims){
        const possibilities=allies.filter(a=>a.id!==victim.id&&!claimed.has(a.id)&&
            a.capability?.canMove&&a.capability?.canFight&&
            !orders?.[a.id]?.anchor&&dist(a.position,victim.position)<18)
            .map(a=>({a,cost:dist(a.position,victim.position)+
                (orders?.[a.id]?.goal==='ENGAGE'?2:0)+
                (a.underFireSeconds>.4?8:0)}))
            .sort((a,b)=>a.cost-b.cost||a.a.id.localeCompare(b.a.id));
        const chosen=possibilities[0]?.a;
        if(!chosen)continue;
        const known=contacts.find(c=>c.visible&&c.id===victim.recentAttackerId)||
            contacts.filter(c=>c.visible&&dist(c.position,victim.threatPosition)<9)
                .sort((a,b)=>dist(a.position,victim.threatPosition)-
                    dist(b.position,victim.threatPosition))[0];
        const point=known?.position??victim.threatPosition;
        // Move toward the suspected attack sector but do not authorize
        // firing at a mere sound/impact bearing.
        response[chosen.id]={
            goal:known?'ENGAGE':'SCREEN',role:'COUNTER_FLANK',
            point:{x:point.x,z:point.z},targetActorId:known?.id??null,
            reason:known?'SCREEN ALLY · OBSERVED FLANKER':'SCREEN ALLY · CHECK ATTACK SECTOR',
            emergency:true,score:1,expiresAt:now+1.5,
            threatFacing:{x:point.x,z:point.z},
        };
        claimed.add(chosen.id);
    }
    return response;
}
