/** Pure geometric preview: detachable frame-side stabilizer links between
 * EXISTING outer hip-boss faces and authored outboard guide receivers.
 * The central U1 flange remains the ONLY playable mobility connection.
 */
import { YARDWALKER_LAYOUT, KESTREL_LAYOUT } from './mobilityDefinitions.js';
const add=(a,b)=>a.map((x,i)=>x+b[i]);
const rotate=(columns,p)=>[0,1,2].map(i=>columns.reduce((sum,col,j)=>sum+col[i]*p[j],0));
const distance=(a,b)=>Math.hypot(...a.map((x,i)=>x-b[i]));

export function planMobilityGuides(frame,pose,layout){
    const errors=[];const bridges=[];
    if(!frame||!pose?.rotation||!pose?.position||!layout)return {ok:false,errors:['Frame, verified mobility pose and layout required.'],bridges};
    const bosses=frame.pieces.filter(p=>p.kind==='hip-boss');
    if(bosses.length!==2)return {ok:false,errors:['Exactly two existing frame hip bosses required.'],bridges};
    for(const r of layout.guideReceivers){
        const boss=bosses.find(p=>Math.sign(p.center[0])===r.side);
        if(!boss){errors.push(`Missing ${r.side<0?'left':'right'} frame boss.`);continue;}
        const clamp=[boss.center[0]+r.side*boss.size[2]/2,boss.center[1],boss.center[2]];
        const receiver=add(pose.position,rotate(pose.rotation,r.contact));
        const span=distance(clamp,receiver);
        if(!(span>.08&&span<.85))errors.push(`${r.side<0?'Left':'Right'} guide needs ${span.toFixed(2)}m unsupported reach; cannot fit without redesign.`);
        bridges.push({side:r.side,bossId:boss.id,clamp,receiver,span,
            clampRadius:Math.min(boss.size[0]*.72,.16),
            status:'preview-unrated-detachable-structure'});
    }
    if(bridges.length!==2)errors.push('Both guides must be present.');
    return {ok:errors.length===0,errors,bridges,notes:'Provisional frame-side guide brackets, NOT independently simulated or mass-rated.'};
}
export function planYardwalkerGuides(frame,pose,layout=YARDWALKER_LAYOUT){
    return planMobilityGuides(frame,pose,layout);
}
export function planKestrelGuides(frame,pose,layout=KESTREL_LAYOUT){
    return planMobilityGuides(frame,pose,layout);
}
