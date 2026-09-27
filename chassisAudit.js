/** k.3a.6 — Nine-combination mechanical fit audit (pure data, no Three/DOM).
 * Uses EXACT authored frame/member anchors plus existing catalogue envelopes.
 * Member proximity checks use simple conservative shapes, NOT triangle/mesh collision.
 * No player-owned parts, save objects or production physics are ever changed.
 */
import { CONCEPT_CHASSIS, validateConceptChassis } from './chassisConcepts.js';
import { AVAILABLE_MOBILITY_FIXTURE_IDS, standardFitFixtures } from './chassisFitFixtures.js';
import { MOBILITY_LAYOUTS, validatePairedMobilityLayout, validateHaulerLayout } from './mobilityDefinitions.js';
import { analyzeFit, structuralAabb, fixtureAabb, rotatePoint } from './chassisFitValidation.js';

export const AUDIT_FRAMES = Object.freeze(CONCEPT_CHASSIS.map(frame => frame.id));
export const AUDIT_MOBILITY = Object.freeze(AVAILABLE_MOBILITY_FIXTURE_IDS.slice());
export const AUDIT_VERSION = 'k.3a.6';
const add=(a,b)=>a.map((n,i)=>n+b[i]);
const sub=(a,b)=>a.map((n,i)=>n-b[i]);
const round=(n)=>Math.round(n*1000)/1000;
const world=(p,pose)=>add(pose.position,rotatePoint(pose.rotation,p));
const note=(level,code,label,at,ref=null)=>({level,code,label,at:at?.map(round)??null,ref});
const aabb=(center,size)=>({min:center.map((v,i)=>v-size[i]/2),max:center.map((v,i)=>v+size[i]/2)});
const boxAt=(center,size,pose)=>{
    const c=world(center,pose);
    const half=size.map(n=>n/2);
    const ext=c.map((_,i)=>pose.rotation.reduce((sum,col,j)=>sum+Math.abs(col[i])*half[j],0));
    return {min:c.map((v,i)=>v-ext[i]),max:c.map((v,i)=>v+ext[i])};
};
const boxCentre=b=>b.min.map((v,i)=>(v+b.max[i])/2);
const unionBoxes=boxes=>({
    min:[0,1,2].map(i=>Math.min(...boxes.map(b=>b.min[i]))),
    max:[0,1,2].map(i=>Math.max(...boxes.map(b=>b.max[i]))),
});
const distance=(a,b)=>Math.hypot(...sub(a,b));

/** Sample a real link's author-defined centerline against a box proxy. This
 * distinguishes an occupied knee/shin from EMPTY catalogue envelope corners.
 * It is still an approximate member-level check, not proof of mesh contact. */
export function linkBoxProximity(from,to,halfThickness,box,samples=32){
    if(![...from,...to,...box.min,...box.max,halfThickness].every(Number.isFinite) || halfThickness<0)
        throw new Error('Malformed link proximity data.');
    let best=Infinity,closest=null;
    for(let i=0;i<=samples;i++){
        const t=i/samples;
        const point=from.map((v,j)=>v+(to[j]-v)*t);
        const nearest=point.map((v,j)=>Math.max(box.min[j],Math.min(box.max[j],v)));
        const gap=distance(point,nearest)-halfThickness;
        if(gap<best){best=gap;closest=nearest;}
    }
    return {clearanceM:best,near:closest};
}

/** Source-faithful MAJOR geometry proxies only. Exact sizing matches the
 * four large recognizable blocks in chassisFitVisuals.js. No empty envelope
 * corner is used as a mechanical collision result. */
function equipmentMemberBoxes(fixture,pose){
    if(!pose)return [];
    const [w,h,d]=fixture.envelope;
    const defs=fixture.id==='gun-cannon' ? [
        ['gun-breech',[0,0,d*.25],[w*.78,h*.72,d*.36]],
        ['gun-recoil-cradle',[0,-h*.25,d*.21],[w*.78,h*.25,d*.23]],
        ['gun-barrel',[0,h*.03,-d*.175],[h*.32,h*.32,d*.64]],
    ] : fixture.id==='cab-cyclops' ? [
        ['cab-occupied-volume',[0,h*.035,d*.055],[w*.85,h*.74,d*.79]],
    ] : fixture.id==='power-dynamo' ? [
        ['generator-housing',[0,-h*.05,d*.08],[w*.84,h*.71,d*.73]],
    ] : [];
    return defs.map(([id,c,s])=>({id,fixtureId:fixture.id,box:boxAt(c,s,pose)}));
}

function limbMembers(layout,pose){
    const idPrefix=layout.catalogId==='legs-yard'?'Y':layout.catalogId==='legs-compact'?'K':'H';
    const names=idPrefix==='Y'?['Y4','Y7','Y6']:idPrefix==='K'?['K6','K10','K8']:['H4','H8','H6'];
    return layout.legs.flatMap(leg=>{
        const side=leg.side<0?'left':'right';
        const suffix=idPrefix==='Y'?['upper-load-link','lower-load-link','drive-actuator']:
            idPrefix==='K'?['upper-link','lower-link','drive-actuator']:
            ['upper-load-link','lower-load-link','drive-actuator'];
        return [
            {id:`${names[0]}-${side}-${suffix[0]}`,from:world(leg.hip,pose),to:world(leg.knee,pose),halfThickness:layout.thighWidth/2,side},
            {id:`${names[1]}-${side}-${suffix[1]}`,from:world(leg.knee,pose),to:world(leg.ankle,pose),halfThickness:layout.shinWidth/2,side},
            {id:`${names[2]}-${side}-${suffix[2]}`,from:world(leg.actuatorTop,pose),to:world(leg.actuatorBottom,pose),halfThickness:.06,side},
        ];
    });
}

function memberChecks(frame,layout,mobilityPose,fixtures,fit){
    const members=limbMembers(layout,mobilityPose);
    const bodies=frame.pieces.filter(p=>p.kind!=='hip-boss' && p.id!==frame.sockets.find(s=>s.id==='mobility')?.supportId)
        .map(p=>({id:p.id,fixtureId:'chassis',box:structuralAabb(p)}));
    const gear=fixtures.filter(f=>f.slot!=='mobility')
        .flatMap(f=>equipmentMemberBoxes(f,fit.poses.get(f.id)));
    const incidents=[];
    for(const member of members){
        for(const other of [...bodies,...gear]){
            // The upper connection is intentionally bolted into the chassis.
            // Only study moving links below the lower support plane, and
            // exclude intended hip-to-saddle contact entirely.
            if(other.fixtureId==='chassis' && Math.max(member.from[1],member.to[1])>=
                frame.sockets.find(s=>s.id==='mobility').position[1]-.12)continue;
            const p=linkBoxProximity(member.from,member.to,member.halfThickness,other.box);
            if(p.clearanceM<-.025){
                incidents.push(note('review','member-proximity',
                    `${member.id} approaches/intersects ${other.id} (proxy depth ${(-p.clearanceM).toFixed(2)} m). Check real meshes and joint travel.`,
                    p.near,{memberId:member.id,otherId:other.id,fixtureId:other.fixtureId}));
            }
        }
    }
    return incidents;
}

export function auditCombination(frame, mobilityId){
    if(!frame||!AUDIT_FRAMES.includes(frame.id)||!AVAILABLE_MOBILITY_FIXTURE_IDS.includes(mobilityId))
        throw new Error('Audit accepts only one of the three authored frames and three catalogue mobility assemblies.');
    const validation=validateConceptChassis(frame);
    if(!validation.valid)throw new Error(`Invalid authored frame: ${validation.errors.join('; ')}`);
    const layout=MOBILITY_LAYOUTS[mobilityId];
    const fixtures=standardFitFixtures({mobilityId});
    const mobility=fixtures[0];
    const layoutValidation=mobilityId==='legs-hauler'?
        validateHaulerLayout(layout,mobility):validatePairedMobilityLayout(layout,mobility);
    if(!layoutValidation.valid)throw new Error(`Invalid authored mobility: ${layoutValidation.errors.join('; ')}`);
    const fit=analyzeFit(frame,fixtures,{mobilityGuides:true});
    const pose=fit.poses.get(mobilityId);
    const findings=[];
    if(!pose){
        findings.push(note('blocked','missing-mobility-pose','Cannot compute foot contact without a valid functional mount.'));
        return {key:`${frame.id}/${mobilityId}`,frameId:frame.id,mobilityId,frame,fixtures,fit,findings,status:'blocked',metrics:null};
    }
    const footBoxes=layout.legs.map(leg=>boxAt(leg.foot,layout.footSize,pose));
    const footContactYs=footBoxes.map(b=>b.min[1]);
    const groundY=Math.min(...footContactYs);
    const footMismatchM=Math.abs(footContactYs[0]-footContactYs[1]);
    if(footMismatchM>.015) findings.push(note('review','uneven-feet',`Rest-pose foot contact difference: ${(footMismatchM*100).toFixed(1)} cm.`,layout.legs[0].foot));
    const footprint=unionBoxes(footBoxes);
    const structuralBoxes=frame.pieces.map(structuralAabb);
    const chassisBottom=Math.min(...structuralBoxes.map(b=>b.min[1]));
    const headboxes=fixtures.filter(f=>f.slot!=='mobility')
        .map(f=>fit.poses.get(f.id)).filter(Boolean)
        .map((p,i)=>fixtureAabb(fixtures.filter(f=>f.slot!=='mobility')[i],p));
    const highest=Math.max(...structuralBoxes.map(b=>b.max[1]),...headboxes.map(b=>b.max[1]));
    const anchors=layout.legs.map(leg=>world(leg.hip,pose));
    const chassisGroundClearanceM=chassisBottom-groundY;
    if(chassisGroundClearanceM<.02) findings.push(note('review','ground-clearance',
        `Chassis underside is only ${Math.max(0,chassisGroundClearanceM).toFixed(2)} m above feet (or lower).`,[0,chassisBottom,0]));
    const sumMass=fixtures.reduce((s,f)=>s+f.massKg+(f.previewAdapter?.massKg??0),0);
    if(fit.guidePlan?.ok!==true)
        findings.push(note('review','guide-incompatible','Two fixed frame-side guides do not both reach authored receivers.',null));
    else if(fit.guidePlan.bridges.some(b=>b.span<.08||b.span>.85))
        findings.push(note('review','guide-span','A calculated guide exceeds the preview reach range.',null));
    if(mobility.nativeStandard==='heavy'){
        if(!mobility.previewAdapter||mobility.previewAdapter.massKg!==110)
            findings.push(note('blocked','missing-adapter','Hauler H2 must have one explicit 110 kg H2/U1 adapter.',null));
        // Inspect actual authored metal pad rather than trusting its declared
        // mounting datum. In the k.3a.5 sheet this uncovers a 10mm mismatch.
        const contactTop=layout.pad.center[1]+layout.pad.size[1]/2;
        const gapM=layout.mountingFace[1]-contactTop;
        if(Math.abs(gapM)>.003)
            findings.push(note('review','adapter-pad-gap',
                `H2/U1 adapter's actual top pad is ${Math.abs(gapM*1000).toFixed(0)} mm ${gapM>0?'below':'above'} the declared mating datum. Correct the sheet/model before certifying the joint.`,
                world([0,contactTop,0],pose),{memberId:'H1-U1-contact-pad'}));
    }
    findings.push(...memberChecks(frame,layout,pose,fixtures,fit));
    const fitErrors=fit.issues.filter(i=>i.severity==='error');
    const status=fitErrors.length||findings.some(f=>f.level==='blocked')?'blocked':
        fit.issues.some(i=>i.severity==='review')||findings.some(f=>f.level==='review')?'review':'measured';
    return {
        key:`${frame.id}/${mobilityId}`,frameId:frame.id,mobilityId,frame,fixtures,fit,findings,status,
        metrics:{
            groundY:round(groundY),groundShiftY:round(-groundY),footMismatchM:round(footMismatchM),
            stanceCentreSeparationM:round(distance(anchors[0],anchors[1])),
            footprintWidthM:round(footprint.max[0]-footprint.min[0]),
            footprintDepthM:round(footprint.max[2]-footprint.min[2]),
            chassisGroundClearanceM:round(chassisGroundClearanceM),
            heightFromGroundM:round(highest-groundY),
            equipmentMassKg:sumMass,adapterMassKg:mobility.previewAdapter?.massKg??0,
            guideSpansM:fit.guidePlan?.ok?fit.guidePlan.bridges.map(b=>round(b.span)):null,
            memberProximities:findings.filter(f=>f.code==='member-proximity').length,
        },
    };
}

export function buildNineCombinationAudit(){
    return CONCEPT_CHASSIS.flatMap(frame=>AUDIT_MOBILITY.map(id=>auditCombination(frame,id)));
}

/** Text representation generated from the same measured case records. */
export function auditTextReport(cases){
    return [`M3CH4 ${AUDIT_VERSION} — NINE-COMBINATION ENGINEERING AUDIT`,
        'Preview-only, rest pose, catalogue equipment dimensions. No frame mass or full-mesh physics.',
        '', ...cases.flatMap(c=>[
            `${c.frame.name} / ${c.fixtures[0].name} [${c.status.toUpperCase()}]`,
            `  Overall height ${c.metrics?.heightFromGroundM??'?'} m · stance ${c.metrics?.stanceCentreSeparationM??'?'} m · chassis clearance ${c.metrics?.chassisGroundClearanceM??'?'} m`,
            `  Equipment mass ${c.metrics?.equipmentMassKg??'?'} kg (adapter ${c.metrics?.adapterMassKg??0} kg; frame/unrated guides excluded)`,
            `  Guide spans ${c.metrics?.guideSpansM?.join(', ')??'UNAVAILABLE'} m · foot-height mismatch ${c.metrics?.footMismatchM??'?'} m`,
            `  ${c.fit.issues.filter(i=>i.severity==='error').length} mounting errors · ${c.fit.issues.filter(i=>i.severity==='review').length} envelope/adapter reviews · ${c.findings.length} geometry findings`,
            ...c.fit.issues.filter(i=>i.severity==='error').map(i=>`  ERROR: ${i.message}`),
            ...c.fit.issues.filter(i=>i.severity==='review').map(i=>`  REVIEW: ${i.message}`),
            ...c.findings.map(i=>`  ${i.level.toUpperCase()}: ${i.label}`),
            '',
        ])].join('\n');
}
