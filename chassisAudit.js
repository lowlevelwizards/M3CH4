/** k.3a.7.4 preview-only nine-combination engineering audit.
 * Original catalogue envelopes & frame poses remain authoritative.
 * Member proxies study REST geometry only: not triangle contact, swept gait,
 * collision physics, load strength or static tipping stability.
 */
import {CONCEPT_CHASSIS,validateConceptChassis} from './chassisConcepts.js';
import {AVAILABLE_MOBILITY_FIXTURE_IDS,standardFitFixtures} from './chassisFitFixtures.js';
import {MOBILITY_LAYOUTS,validatePairedMobilityLayout,validateHaulerLayout} from './mobilityDefinitions.js';
import {analyzeFit,structuralAabb,fixtureAabb,rotatePoint} from './chassisFitValidation.js';

export const AUDIT_FRAMES=Object.freeze(CONCEPT_CHASSIS.map(frame=>frame.id));
export const AUDIT_MOBILITY=Object.freeze(AVAILABLE_MOBILITY_FIXTURE_IDS.slice());
export const AUDIT_VERSION='k.3a.7.4';
const add=(a,b)=>a.map((n,i)=>n+b[i]);
const sub=(a,b)=>a.map((n,i)=>n-b[i]);
const distance=(a,b)=>Math.hypot(...sub(a,b));
const round=n=>Math.round(n*1000)/1000;
const world=(p,pose)=>add(pose.position,rotatePoint(pose.rotation,p));
const note=(level,code,label,at,ref=null)=>({level,code,label,at:at?.map(round)??null,ref});
const boxCentre=b=>b.min.map((v,i)=>(v+b.max[i])/2);
const unionBoxes=boxes=>({
    min:[0,1,2].map(i=>Math.min(...boxes.map(b=>b.min[i]))),
    max:[0,1,2].map(i=>Math.max(...boxes.map(b=>b.max[i]))),
});
/** Exact authored axis-aligned block bounds, conservatively AABB-rotated by a
 * fitted frame pose. A bevel is always strictly INSIDE the named block size.
 */
const boxAt=(center,size,pose)=>{
    const c=world(center,pose),half=size.map(n=>n/2);
    const ext=c.map((_,i)=>pose.rotation.reduce((sum,col,j)=>sum+Math.abs(col[i])*half[j],0));
    return {min:c.map((v,i)=>v-ext[i]),max:c.map((v,i)=>v+ext[i])};
};
/** Centreline vs major equipment volume, intentionally conservative. */
export function linkBoxProximity(from,to,halfThickness,box,samples=32){
    if(![...from,...to,...box.min,...box.max,halfThickness].every(Number.isFinite)||halfThickness<0)
        throw new Error('Malformed link proximity data.');
    let best=Infinity,closest=null;
    for(let i=0;i<=samples;i++){
        const t=i/samples,point=from.map((v,j)=>v+(to[j]-v)*t),
            nearest=point.map((v,j)=>Math.max(box.min[j],Math.min(box.max[j],v))),
            gap=distance(point,nearest)-halfThickness;
        if(gap<best){best=gap;closest=nearest;}
    }
    return {clearanceM:best,near:closest};
}
/** Signed AABB separation: negative = overlap along all three world axes.
 * Only use as REVIEW-level evidence, never an assertion of actual mesh impact.
 */
export function boxBoxProximity(a,b){
    const separations=[0,1,2].map(i=>Math.max(b.min[i]-a.max[i],a.min[i]-b.max[i],0));
    const separation=Math.hypot(...separations);
    const overlap=[0,1,2].map(i=>Math.min(a.max[i],b.max[i])-Math.max(a.min[i],b.min[i]));
    const clearanceM=separation>0?separation:Math.min(...overlap)<=0?0:-Math.min(...overlap);
    const near=boxCentre(a).map((v,i)=>Math.max(b.min[i],Math.min(b.max[i],v)));
    return {clearanceM,near};
}
/** Matches named major equipment members from existing fit visuals. */
function equipmentMemberBoxes(fixture,pose){
    if(!pose)return [];
    const [w,h,d]=fixture.envelope;
    const defs=fixture.id==='gun-cannon' ? [
        ['gun-heavy-breech',[0,0,d*.25],[w*.78,h*.72,d*.36]],
        ['gun-recoil-cradle',[0,-h*.25,d*.21],[w*.78,h*.25,d*.23]],
        ['front-pointing-gun-barrel',[0,h*.03,-d*.175],[h*.32,h*.32,d*.64]],
    ] : fixture.id==='cab-cyclops' ? [
        ['cab-primary-occupied-volume',[0,h*.035,d*.055],[w*.85,h*.74,d*.79]],
    ] : fixture.id==='power-dynamo' ? [
        ['generator-serviceable-housing',[0,-h*.05,d*.08],[w*.84,h*.71,d*.73]],
    ] : [];
    return defs.map(([id,c,s])=>({id,fixtureId:fixture.id,box:boxAt(c,s,pose)}));
}
/** New k.3a.7 member IDs correspond to ACTUAL mesh names in each dedicated
 * family constructor; click-to-highlight resolves the implicated object.
 */
function limbMembers(layout,pose){
    const specs={
        'legs-yard':{upper:'Y4',upperName:'angled-upper-load-beam',
            lower:'Y7',lowerName:'shaped-olive-calf',drive:'Y6',driveName:'practical-linear-drive'},
        'legs-compact':{upper:'K5',upperName:'rearward-swept-cream-upper-spar',
            lower:'K7',lowerName:'long-forward-cream-shin',drive:'K6',driveName:'short-knee-spring'},
        'legs-hauler':{upper:'H4',upperName:'recessed-short-yoke',
            lower:'H7',lowerName:'compression-column',drive:'H10',driveName:'short-drive-actuator'},
    };
    const s=specs[layout.catalogId];
    // Conservative radial envelopes also include the *offset* protective
    // calf/shock facets and working actuator lugs, not only the central rod.
    // These are rest-pose proximity proxies, NEVER detailed OBB mesh fits.
    const radial={
        'legs-yard':{upper:.19,lower:.235,drive:.09},
        'legs-compact':{upper:.12,lower:.11,drive:.07},
        'legs-hauler':{upper:.22,lower:.22,drive:.10},
    }[layout.catalogId];
    return layout.legs.flatMap(leg=>{ 
        const side=leg.side<0?'left':'right';
        return [
            {id:`${s.upper}-${side}-${s.upperName}`,from:world(leg.hip,pose),to:world(leg.knee,pose),
                halfThickness:Math.max(layout.thighWidth/2,radial.upper),side},
            {id:`${s.lower}-${side}-${s.lowerName}`,from:world(leg.knee,pose),to:world(leg.ankle,pose),
                halfThickness:Math.max(layout.shinWidth/2,radial.lower),side},
            {id:`${s.drive}-${side}-${s.driveName}`,from:world(leg.actuatorTop,pose),
                to:world(leg.actuatorBottom,pose),halfThickness:radial.drive,side},
        ];
    });
}
/** Member AABB proxies for genuinely large solid masses. These are computed
 * from the NEW authored pads, PODS and actual multi-part sole union (the
 * wedge shoe + supported two-prong toes together occupy footSize exactly).
 */
export function mobilitySolidProxies(layout,pose){
    const pods=(layout.pods||[]).map(p=>({
        id:`H3-${p.side<0?'left':'right'}-giant-fixed-drive-pod`,
        kind:'fixed-drive-pod',side:p.side,box:boxAt(p.center,p.size,pose),
    }));
    const feet=layout.legs.map(l=>({
        id:layout.catalogId==='legs-yard'?`Y9-${l.side<0?'left':'right'}-continuous-work-boot-sole`:
            layout.catalogId==='legs-compact'?`K9-${l.side<0?'left':'right'}-minimal-supported-runner-sole`:
            `H9-${l.side<0?'left':'right'}-structural-load-shoe`,
        kind:'footprint',side:l.side,box:boxAt(l.foot,layout.footSize,pose),
    }));
    return [...pods,...feet];
}
function memberChecks(frame,layout,pose,fixtures,fit){
    const members=limbMembers(layout,pose),solids=mobilitySolidProxies(layout,pose);
    const support=frame.sockets.find(s=>s.id==='mobility');
    const bodies=frame.pieces.filter(p=>p.kind!=='hip-boss'&&p.id!==support?.supportId)
        .map(p=>({id:p.id,fixtureId:'chassis',box:structuralAabb(p)}));
    const gear=fixtures.filter(f=>f.slot!=='mobility')
        .flatMap(f=>equipmentMemberBoxes(f,fit.poses.get(f.id)));
    const others=[...bodies,...gear],incidents=[];
    for(const member of members){
        for(const other of others){
            // The upper connection intentionally occupies the primary chassis
            // saddle. A link spanning this top support isn't a collision result.
            if(other.fixtureId==='chassis'&&Math.max(member.from[1],member.to[1])>=support.position[1]-.12)
                continue;
            const p=linkBoxProximity(member.from,member.to,member.halfThickness,other.box);
            if(p.clearanceM<-.025){
                incidents.push(note('review','member-proximity',
                    `${member.id} approaches/intersects ${other.id} (proxy depth ${(-p.clearanceM).toFixed(2)} m). Check real meshes and joint travel.`,
                    p.near,{memberId:member.id,otherId:other.id,fixtureId:other.fixtureId}));
            }
        }
    }
    for(const solid of solids){
        for(const other of others){
            // Avoid calling the intentional structural mount/guide bosses collisions.
            // The separately-authored pod or foot CAN still conflict with a gun,
            // cab or other real structural member; preserve that review.
            const p=boxBoxProximity(solid.box,other.box);
            if(p.clearanceM<-.025){
                incidents.push(note('review',solid.kind==='fixed-drive-pod'?'fixed-pod-proximity':'foot-solid-proximity',
                    `${solid.id} intersects ${other.id} (conservative member-box depth ${(-p.clearanceM).toFixed(2)} m). Static rest pose only.`,
                    p.near,{memberId:solid.id,otherId:other.id,fixtureId:other.fixtureId}));
            }
        }
    }
    return incidents;
}
export function auditCombination(frame,mobilityId){
    if(!frame||!AUDIT_FRAMES.includes(frame.id)||!AUDIT_MOBILITY.includes(mobilityId))
        throw new Error('Audit accepts exactly the three authored frames and three catalogue mobility assemblies.');
    const frameValidation=validateConceptChassis(frame);
    if(!frameValidation.valid)throw new Error(`Invalid authored frame: ${frameValidation.errors.join('; ')}`);
    const layout=MOBILITY_LAYOUTS[mobilityId],fixtures=standardFitFixtures({mobilityId}),mobility=fixtures[0];
    const layoutValidation=mobilityId==='legs-hauler'?validateHaulerLayout(layout,mobility):
        validatePairedMobilityLayout(layout,mobility);
    if(!layoutValidation.valid)throw new Error(`Invalid authored mobility: ${layoutValidation.errors.join('; ')}`);
    const fit=analyzeFit(frame,fixtures,{mobilityGuides:true}),pose=fit.poses.get(mobilityId),findings=[];
    if(!pose){
        findings.push(note('blocked','missing-mobility-pose','Cannot compute foot contact without a valid functional mount.'));
        return {key:`${frame.id}/${mobilityId}`,frameId:frame.id,mobilityId,frame,fixtures,fit,
            findings,status:'blocked',metrics:null};
    }
    const footBoxes=mobilitySolidProxies(layout,pose).filter(x=>x.kind==='footprint').map(x=>x.box);
    const footContactYs=footBoxes.map(b=>b.min[1]),groundY=Math.min(...footContactYs),
        footMismatchM=Math.abs(footContactYs[0]-footContactYs[1]);
    if(footMismatchM>.015)findings.push(note('review','uneven-feet',
        `Rest-pose foot contact difference: ${(footMismatchM*100).toFixed(1)} cm.`,layout.legs[0].foot));
    const footprint=unionBoxes(footBoxes),structuralBoxes=frame.pieces.map(structuralAabb),
        chassisBottom=Math.min(...structuralBoxes.map(b=>b.min[1]));
    const otherFixtures=fixtures.filter(f=>f.slot!=='mobility');
    const headboxes=otherFixtures.map(f=>({f,pose:fit.poses.get(f.id)}))
        .filter(x=>!!x.pose).map(x=>fixtureAabb(x.f,x.pose));
    const highest=Math.max(...structuralBoxes.map(b=>b.max[1]),...headboxes.map(b=>b.max[1]));
    const anchors=layout.legs.map(leg=>world(leg.hip,pose));
    const chassisGroundClearanceM=chassisBottom-groundY;
    if(chassisGroundClearanceM<.02)findings.push(note('review','ground-clearance',
        `Chassis underside is only ${Math.max(0,chassisGroundClearanceM).toFixed(2)} m above feet (or lower).`,
        [0,chassisBottom,0]));
    const sumMass=fixtures.reduce((s,f)=>s+f.massKg+(f.previewAdapter?.massKg??0),0);
    if(fit.guidePlan?.ok!==true)
        findings.push(note('review','guide-incompatible','Two fixed frame-side guides do not both reach authored receivers.',null));
    else if(fit.guidePlan.bridges.some(b=>b.span<.08||b.span>.85))
        findings.push(note('review','guide-span','A calculated guide exceeds the preview reach range.',null));
    if(mobility.nativeStandard==='heavy'){
        if(!mobility.previewAdapter||mobility.previewAdapter.massKg!==110)
            findings.push(note('blocked','missing-adapter','Hauler H2 must have one explicit 110 kg H2/U1 adapter.',null));
        // Preserve k.3a.6's physical pad warning with STRICT 1mm tolerance.
        // Layout validation also fails closed for mismatched pads.
        const contactTop=layout.pad.center[1]+layout.pad.size[1]/2,
            gapM=layout.mountingFace[1]-contactTop;
        if(Math.abs(gapM)>.001)
            findings.push(note('review','adapter-pad-gap',
                `H2/U1 adapter's actual top pad is ${Math.abs(gapM*1000).toFixed(1)} mm ${gapM>0?'below':'above'} the declared mating datum. Correct physical metal, not the warning.`,
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
            podProximities:findings.filter(f=>f.code==='fixed-pod-proximity').length,
            footProximities:findings.filter(f=>f.code==='foot-solid-proximity').length,
        },
    };
}
export function buildNineCombinationAudit(){
    return CONCEPT_CHASSIS.flatMap(frame=>AUDIT_MOBILITY.map(id=>auditCombination(frame,id)));
}
/** Same measured case records drive both UI and plain-text export. */
export function auditTextReport(cases){
    return [`M3CH4 ${AUDIT_VERSION} — NINE-COMBINATION ENGINEERING AUDIT`,
        'Preview-only, rest pose, authored major-member proxies. No frame mass or full-mesh physics.',
        '',...cases.flatMap(c=>[
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
