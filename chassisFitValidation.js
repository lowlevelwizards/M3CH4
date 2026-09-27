/** k.3a.4 -- PURE preview alignment and conservative envelope-fit diagnostics.
 * No Three.js, DOM, live assembly graph, inventory, physics or save mutations.
 */
import { standardFitFixtures } from './chassisFitFixtures.js';
import { YARDWALKER_LAYOUT, KESTREL_LAYOUT } from './mobilityDefinitions.js';
import { planYardwalkerGuides, planKestrelGuides } from './mobilityGuide.js';

const UNIT_AXES = [
    [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1],
];
const dot = (a, b) => a.reduce((sum, n, i) => sum + n * b[i], 0);
const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const negate = a => a.map(n => -n);
const vecAdd = (a, b) => a.map((n, i) => n + b[i]);
const vecSub = (a, b) => a.map((n, i) => n - b[i]);
const distance=(a,b)=>Math.hypot(...a.map((n,i)=>n-b[i]));
const issue=(severity,code,fixtureIds,message,socketId=null) => ({severity,code,fixtureIds,message,socketId});
export function rotatePoint(columns, vector) {
    return [0,1,2].map(i => columns[0][i]*vector[0]+columns[1][i]*vector[1]+columns[2][i]*vector[2]);
}
export const CUBE_ROTATIONS = Object.freeze(
    UNIT_AXES.flatMap(x => UNIT_AXES.filter(y => dot(x,y)===0).map(y => [x, y, cross(x,y)]))
);
const unitCardinal = vector => Array.isArray(vector) && vector.length===3 &&
    vector.every(Number.isFinite) && UNIT_AXES.some(axis => dot(axis,vector)===1);

export function mateOrientation(socketNormal, componentFaceNormal, localForward=[0,0,-1]) {
    if (![socketNormal,componentFaceNormal,localForward].every(unitCardinal)) return null;
    const facing=negate(socketNormal);
    let best=null, highest=-Infinity;
    for (const columns of CUBE_ROTATIONS) {
        if (dot(rotatePoint(columns,componentFaceNormal),facing)!==1) continue;
        const forward=rotatePoint(columns,localForward);
        const up=rotatePoint(columns,[0,1,0]);
        const score=10*dot(forward,[0,0,-1])+dot(up,[0,1,0]);
        if(score>highest){best=columns;highest=score;}
    }
    return best;
}

export function placeFitFixture(chassis, fixture, socketId=fixture?.socketId) {
    const socket=chassis?.sockets?.find(s=>s.id===socketId);
    if(!fixture) return {ok:false,reason:'Unknown equipment fixture.'};
    if(!socket) return {ok:false,reason:`${chassis?.name??'Frame'} has no ${socketId} socket.`,fixtureId:fixture.id};
    if(socket.roleHint!==fixture.slot)
        return {ok:false,reason:`${socket.id} is a ${socket.roleHint} socket, not ${fixture.slot}.`,fixtureId:fixture.id,socketId};
    if(socket.standard!==fixture.standard)
        return {ok:false,reason:`${fixture.name} needs ${fixture.standard}; ${socket.id} offers ${socket.standard}.`,fixtureId:fixture.id,socketId};
    const rotation=mateOrientation(socket.normal,fixture.mountNormal,fixture.forward);
    if(!rotation)
        return {ok:false,reason:`${fixture.name}: ${socket.id} has an unsupported mating-face orientation.`,fixtureId:fixture.id,socketId};
    const position=vecSub(socket.position,rotatePoint(rotation,fixture.mountPoint));
    return {ok:true,fixtureId:fixture.id,socketId,position,rotation,
        matingWorld:vecAdd(position,rotatePoint(rotation,fixture.mountPoint)),
        surfaceNormal:rotatePoint(rotation,fixture.mountNormal)};
}

export function fixtureAabb(fixture, pose) {
    const half=fixture.envelope.map(v=>v/2);
    const ext=[0,1,2].map(i=>pose.rotation.reduce((sum,column,j)=>sum+Math.abs(column[i])*half[j],0));
    return {min:pose.position.map((n,i)=>n-ext[i]),max:pose.position.map((n,i)=>n+ext[i])};
}
export function structuralAabb(piece) {
    const half=piece.kind==='hip-boss'?[piece.size[2]/2,piece.size[0],piece.size[0]]:
        piece.kind==='sloped-bulkhead'?[piece.size[0]/2,piece.size[1]/2+.04,piece.size[2]/2+.04]:
        piece.size.map(v=>v/2);
    return {min:piece.center.map((n,i)=>n-half[i]),max:piece.center.map((n,i)=>n+half[i])};
}
export function intersectionDepths(a,b) {
    return [0,1,2].map(i=>Math.min(a.max[i],b.max[i])-Math.max(a.min[i],b.min[i]));
}
const significantOverlap=(a,b,tolerance=.035)=>intersectionDepths(a,b).every(depth=>depth>tolerance);

function mobilityGuideDefinition(fixtureId){
    if(fixtureId==='legs-yard')return {layout:YARDWALKER_LAYOUT, plan:planYardwalkerGuides, shortName:'Yardwalker'};
    if(fixtureId==='legs-compact')return {layout:KESTREL_LAYOUT, plan:planKestrelGuides, shortName:'Kestrel'};
    return null;
}

function detectUnbracketedGuideGap(frame,fixture,pose){
    const def=mobilityGuideDefinition(fixture?.id);
    if(!def)return null;
    const bosses=frame.pieces.filter(p=>p.kind==='hip-boss');
    if(bosses.length!==2)return null;
    const spans=[];
    for(const receiver of def.layout.guideReceivers){
        const boss=bosses.find(p=>Math.sign(p.center[0])===receiver.side);
        if(!boss)return null;
        const clamp=[boss.center[0]+receiver.side*boss.size[2]/2,boss.center[1],boss.center[2]];
        const target=vecAdd(pose.position,rotatePoint(pose.rotation,receiver.contact));
        spans.push(distance(clamp,target));
    }
    return spans.length===2?Math.min(...spans):null;
}

export function analyzeFit(chassis, fixtures=standardFitFixtures(), options={}) {
    const poses=new Map(),issues=[],sockets=new Map();
    if(!chassis||!Array.isArray(chassis.sockets)||!Array.isArray(chassis.pieces))
        return {status:'blocked',poses,issues:[issue('error','bad-frame',[],'Missing chassis geometry or sockets.')],components:[]};
    const used=new Set();
    for(const fixture of fixtures){
        const result=placeFitFixture(chassis,fixture);
        if(!result.ok){issues.push(issue('error','unmountable',[fixture.id],result.reason,result.socketId??null));continue;}
        if(used.has(result.socketId)){
            issues.push(issue('error','occupied',[fixture.id],`Socket ${result.socketId} is occupied.`,result.socketId));
            continue;
        }
        used.add(result.socketId);poses.set(fixture.id,result);sockets.set(fixture.id,chassis.sockets.find(s=>s.id===result.socketId));
        issues.push(issue('pass','aligned',[fixture.id],`${fixture.name}: mating faces meet at ${result.socketId}.`,result.socketId));
        const socket=sockets.get(fixture.id);
        if(fixture.massKg>socket.maxLoadKg)
            issues.push(issue('error','overload',[fixture.id],`${fixture.name}: ${fixture.massKg} kg exceeds ${socket.maxLoadKg} kg PROVISIONAL ${result.socketId} limit.`,result.socketId));
        else issues.push(issue('pass','load',[fixture.id],`${fixture.name}: ${fixture.massKg} / ${socket.maxLoadKg} kg provisional socket capacity.`,result.socketId));
    }
    for (let i=0;i<fixtures.length;i++) for(let j=i+1;j<fixtures.length;j++) {
        const a=fixtures[i],b=fixtures[j],pa=poses.get(a.id),pb=poses.get(b.id);
        if(pa&&pb&&significantOverlap(fixtureAabb(a,pa),fixtureAabb(b,pb)))
            issues.push(issue('review','equipment-envelope-overlap',[a.id,b.id],
                `Envelope overlap: ${a.name} / ${b.name}. Inspect detailed shapes; not proof of collision.`));
    }
    for(const fixture of fixtures){
        const pose=poses.get(fixture.id);if(!pose)continue;
        const ownSupport=sockets.get(fixture.id)?.supportId;
        const box=fixtureAabb(fixture,pose);
        for(const piece of chassis.pieces){
            if(piece.id===ownSupport)continue;
            if(significantOverlap(box,structuralAabb(piece)))
                issues.push(issue('review','chassis-envelope-overlap',[fixture.id],
                    `${fixture.name} envelope intersects ${piece.id}; verify visible geometry before approving this fit.`,pose.socketId));
        }
    }
    const mobilityFixture=fixtures.find(f=>f.slot==='mobility');
    const mobility=mobilityFixture&&poses.get(mobilityFixture.id);
    let guidePlan=null;
    if(mobility&&options.mobilityGuides){
        const def=mobilityGuideDefinition(mobilityFixture.id);
        if(def){
            guidePlan=def.plan(chassis,mobility);
            if(guidePlan.ok)issues.push(issue('review','guides-provisional',[mobilityFixture.id],
                `Two REAL frame-side drop guides reach the ${def.shortName} receiver faces. Preview fit only: clamp strength and adapter mass are not yet rated.`, 'mobility'));
            else issues.push(issue('review','guides-incompatible',[mobilityFixture.id],
                `Guide brackets cannot be authored: ${guidePlan.errors.join(' ')}`,'mobility'));
        }
    }
    if(mobility&&!options.mobilityGuides){
        const span=detectUnbracketedGuideGap(chassis,mobilityFixture,mobility);
        if(span>.04)issues.push(issue('review','hip-guide-gap',[mobilityFixture.id],
            `The paired module meets its central saddle, but the side stabilizer receivers remain ~${span.toFixed(2)} m from the frame bosses. An authored physical coupler may be needed.`,mobility.socketId));
    }
    return {status:issues.some(i=>i.severity==='error')?'blocked':issues.some(i=>i.severity==='review')?'review':'clear',
        poses,issues,guidePlan,components:fixtures.map(f=>({fixtureId:f.id,fixture:f,pose:poses.get(f.id)??null}))};
}
