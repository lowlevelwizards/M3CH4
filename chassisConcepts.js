/** k.3a.1: three independently authored BARE chassis studies.
 * Pure preview data: NO catalogue, owned inventory, live graph or save writes.
 * Coordinates: local +X right, +Y up, -Z front, metres.
 * The one `mobility` socket is for the existing paired-leg assembly. Its two
 * visibly separate hip bosses are NOT independent player-installable legs.
 * All masses and game balancing remain deliberately unspecified.
 */
export const CONCEPT_REVISION = 'k.3a.1';
const pos = (x,y,z) => [x,y,z];
const piece = (id, kind, center, size, tone, purpose, extra={}) =>
    ({id,kind,center,size,tone,purpose,...extra});
const socket = (id, roleHint, position, normal, supportId, maxLoadKg, standard='medium') =>
    ({id,roleHint,position,normal,supportId,maxLoadKg,standard,
      ratingStatus:'provisional-preview-only'});

/** Main body H1, two side reinforcements H2, two hip bosses H3, underside
 * through-saddle H4 and one actual paired-mobility flange H5. H6-H10 are
 * explicitly connected module lands, NOT attached systems. */
const hubPieces = [
    piece('H1-core','chamfer-block',pos(0,0,.02),pos(1.10,.60,.88),'paint',
        'Concentrated structural mass; transfers payload forces into side supports.'),
    ...[-1,1].map(side=>piece(`H2-side-${side}`,'block',pos(side*.53,-.10,.10),pos(.23,.45,.62),'iron',
        'Thickened core wall transferring hip loads into H1.')),
    ...[-1,1].map(side=>piece(`H3-hip-${side}`,'hip-boss',pos(side*.68,-.30,.10),pos(.20,.20,.16),'machined',
        'Visible left/right hip bearing face; NOT a separate playable socket.',{axis:'x'})),
    piece('H4-through-saddle','block',pos(0,-.44,.10),pos(1.24,.23,.32),'iron',
        'Cross-frame member connecting both hip reinforcements.'),
    piece('H5-mobility-flange','block',pos(0,-.575,.10),pos(.48,.09,.40),'machined',
        'One playable paired-leg mount under the cross-saddle.'),
    piece('H6-command-deck','chamfer-block',pos(0,.345,-.12),pos(.62,.13,.50),'machined',
        'Centered, supported top cab interface; NOT a cockpit.'),
    piece('H7-power-land','block',pos(0,.03,.50),pos(.64,.52,.12),'iron',
        'Rear mounting plate bonded into main core.'),
    piece('H8-right-hardpoint','block',pos(.67,.12,-.23),pos(.27,.37,.42),'iron',
        'Right-front combat trunnion reinforcement entering H1.'),
    piece('H9-front-land','block',pos(0,.04,-.465),pos(.40,.36,.11),'machined',
        'Forward reserved tooling receiver braced into H1.'),
    piece('H10-utility-land','block',pos(-.58,.13,.36),pos(.28,.27,.12),'iron',
        'Short rear-left mounting land connected to H1.'),
];
const hubSockets = [
    socket('mobility','mobility',pos(0,-.62,.10),pos(0,-1,0),'H5-mobility-flange',2000),
    socket('command','command',pos(0,.41,-.12),pos(0,1,0),'H6-command-deck',900),
    socket('power','power',pos(0,.03,.56),pos(0,0,1),'H7-power-land',900),
    socket('combat','combat',pos(.805,.12,-.23),pos(1,0,0),'H8-right-hardpoint',1200),
    socket('front-hardpoint','combat',pos(0,.04,-.52),pos(0,0,-1),'H9-front-land',1200),
    socket('left-rear-utility','utility',pos(-.58,.13,.42),pos(0,0,1),'H10-utility-land',800),
];

/** L1 longitudinal rails are the identity: all bridge loads must enter BOTH
 * rails, and the inner space must stay open when all modules are removed. */
const ladderPieces = [
    ...[-1,1].map(side=>piece(`L1-rail-${side}`,'chamfer-block',pos(side*.56,.06,0),pos(.18,.24,1.70),'paint',
        'Primary fore-aft load-bearing rail.')),
    ...[-.65,.10,.65].map((z,i)=>piece(`L${i+2}-crossmember`,'block',pos(0,.06,z),pos(1.16,.16,.16),'iron',
        'Transverse shear brace connecting both continuous rails.')),
    ...[-1,1].map(side=>piece(`L5-hip-node-${side}`,'block',pos(side*.68,-.23,.05),pos(.29,.35,.40),'iron',
        'Lower side load node intersecting its rail and the underbody saddle.')),
    ...[-1,1].map(side=>piece(`L5-boss-${side}`,'hip-boss',pos(side*.81,-.23,.05),pos(.19,.19,.12),'machined',
        'Visible paired-hip bearing face; NOT a separate playable socket.',{axis:'x'})),
    piece('L6-mobility-saddle','block',pos(0,-.46,.05),pos(1.10,.17,.32),'iron',
        'Through-saddle collects loads from both hip nodes.'),
    piece('L6-bottom-flange','block',pos(0,-.565,.05),pos(.52,.09,.38),'machined',
        'Single paired-leg functional input below L6.'),
    piece('L7-command-bridge','block',pos(0,.165,-.40),pos(1.20,.11,.32),'machined',
        'Cross-rail command support; overlaps top surface of both rails.'),
    piece('L7-command-land','block',pos(0,.26,-.40),pos(.70,.10,.48),'machined',
        'Raised command module land bonded to cross-rail support.'),
    piece('L8-rear-support','block',pos(0,.06,.70),pos(1.16,.16,.40),'iron',
        'Rear cantilever platform supported by both rails and rear crossmember.'),
    piece('L8-power-land','block',pos(0,.08,.86),pos(.66,.35,.12),'machined',
        'Rear-facing generator interface on rear platform.'),
    ...[-1,1].map(side=>piece(`L9-side-hardpoint-${side}`,'block',pos(side*.70,.15,-.38),pos(.24,.30,.40),'iron',
        'Side hardpoint reinforcement directly overlapping its rail.')),
    piece('L11-front-outrigger','block',pos(0,.06,-.79),pos(1.14,.16,.30),'iron',
        'Forward load distributor tied to both rails and front crossmember.'),
    piece('L11-front-land','block',pos(0,.05,-.90),pos(.46,.31,.12),'machined',
        'Reserved forward interface on the front load distributor.'),
    piece('L12-utility-land','block',pos(-.70,.12,.56),pos(.16,.30,.30),'iron',
        'Small left-rear equipment land physically overlapping left rail.'),
    piece('L13-service-land','block',pos(0,.20,.24),pos(.34,.16,.24),'machined',
        'Light accessory mount tied to the central crossmember.'),
];
const ladderSockets = [
    socket('mobility','mobility',pos(0,-.61,.05),pos(0,-1,0),'L6-bottom-flange',2000),
    socket('command','command',pos(0,.31,-.40),pos(0,1,0),'L7-command-land',900),
    socket('power','power',pos(0,.08,.92),pos(0,0,1),'L8-power-land',900),
    socket('combat','combat',pos(.82,.15,-.38),pos(1,0,0),'L9-side-hardpoint-1',1200),
    socket('left-hardpoint','combat',pos(-.82,.15,-.38),pos(-1,0,0),'L9-side-hardpoint--1',1200),
    socket('front-hardpoint','combat',pos(0,.05,-.96),pos(0,0,-1),'L11-front-land',1200),
    socket('left-rear-utility','utility',pos(-.78,.12,.56),pos(-1,0,0),'L12-utility-land',800),
    socket('service-light','utility',pos(0,.28,.24),pos(0,1,0),'L13-service-land',150,'light'),
];

/** T1-T5 are the load-bearing shell itself: floor, side walls, bulkheads and
 * lips. There is NO hidden beam/ladder frame inside the monocoque. */
const tubPieces = [
    piece('T1-belly','block',pos(0,-.31,0),pos(1.52,.13,1.42),'iron',
        'Stressed floor panel connecting sidewalls and major mount reinforcements.'),
    ...[-1,1].map(side=>piece(`T2-sidewall-${side}`,'shell-side',pos(side*.76,.02,0),pos(.14,.67,1.48),'shell',
        'Continuous load-bearing side wall of shell; front edge tapers slightly.',{side})),
    piece('T3-front-bulkhead','sloped-bulkhead',pos(0,-.015,-.68),pos(1.50,.64,.15),'shell',
        'Continuous slightly sloping forward wall connecting the load-bearing sides.'),
    piece('T4-rear-bulkhead','block',pos(0,.02,.68),pos(1.50,.68,.13),'shell',
        'Rear closing wall tying both sides and carrying rear generator interface.'),
    ...[-1,1].map(side=>piece(`T5-upper-lip-${side}`,'block',pos(side*.755,.377,0),pos(.17,.09,1.40),'machined',
        'Upper sidewall stiffness without covering the open central bay.')),
    piece('T6-hip-through-panel','block',pos(0,-.33,.10),pos(1.48,.19,.35),'iron',
        'Transverse load spreader integrated into shell floor and sidewalls.'),
    ...[-1,1].map(side=>piece(`T7-hip-${side}`,'hip-boss',pos(side*.88,-.31,.10),pos(.205,.205,.16),'machined',
        'Hip penetration ring integrated into thick lower sidewall.',{axis:'x'})),
    piece('T8-mobility-stem','block',pos(0,-.50,.10),pos(.54,.17,.43),'iron',
        'Direct vertical load path from central belly into lower paired mobility flange.'),
    piece('T8-mobility-flange','block',pos(0,-.60,.10),pos(.52,.12,.43),'machined',
        'Single bottom paired-leg functional input.'),
    piece('T9-command-crossdeck','block',pos(0,.345,-.29),pos(1.48,.12,.54),'iron',
        'Local structural bridge spanning both shell lips over command aperture.'),
    piece('T9-command-collar','chamfer-block',pos(0,.435,-.29),pos(.70,.11,.54),'machined',
        'Visible replaceable command-module collar atop crossdeck.'),
    piece('T10-power-land','block',pos(0,.02,.79),pos(.72,.48,.12),'machined',
        'Rear generator fastening face attached to T4 bulkhead.'),
    piece('T11-right-hardpoint','block',pos(.82,.06,-.34),pos(.28,.36,.46),'iron',
        'Right-forward reinforced shell opening for primary weapon.'),
    piece('T12-front-hardpoint','block',pos(0,.03,-.79),pos(.44,.34,.18),'iron',
        'Center-front tool interface built into forward bulkhead.'),
    piece('T13-left-utility','block',pos(-.885,.12,.48),pos(.13,.30,.28),'iron',
        'Local sidewall reinforcement for rear-left offset bracket.'),
    piece('T14-rear-service-bridge','block',pos(0,.375,.39),pos(1.48,.11,.18),'iron',
        'Rear cross-lip reinforcement and light accessory mounting land.'),
    piece('T14-service-land','block',pos(0,.445,.39),pos(.31,.03,.18),'machined',
        'Thin light accessory fastening face directly on rear bridge.'),
];
const tubSockets = [
    socket('mobility','mobility',pos(0,-.66,.10),pos(0,-1,0),'T8-mobility-flange',2000),
    socket('command','command',pos(0,.49,-.29),pos(0,1,0),'T9-command-collar',900),
    socket('power','power',pos(0,.02,.85),pos(0,0,1),'T10-power-land',900),
    socket('combat','combat',pos(.96,.06,-.34),pos(1,0,0),'T11-right-hardpoint',1200),
    socket('front-hardpoint','combat',pos(0,.03,-.88),pos(0,0,-1),'T12-front-hardpoint',1200),
    socket('left-rear-utility','utility',pos(-.95,.12,.48),pos(-1,0,0),'T13-left-utility',800),
    socket('service-light','utility',pos(0,.46,.39),pos(0,1,0),'T14-service-land',150,'light'),
];

export const CONCEPT_CHASSIS = Object.freeze([
    { id:'concept-hub',family:'central-hub',name:'01 — Central Hub',profile:'hub-structural',
      structure:'A concentrated machined core feeding two lower hip bosses through a short through-saddle.',
      bounds:[1.70,1.05,1.35],origin:[0,0,0],pieces:hubPieces,sockets:hubSockets,
      mobilityController:'paired-legacy',implementation:'isolated-design-study',balanceStatus:'no gameplay mass or frame rating yet' },
    { id:'concept-ladder',family:'twin-rail',name:'02 — Twin-Rail / Ladder',profile:'ladder-structural',
      structure:'Two uninterrupted fore-aft rails, sparse shear crossmembers and an open inner machinery bay.',
      bounds:[1.64,0.92,2.06],origin:[0,0,0],pieces:ladderPieces,sockets:ladderSockets,
      mobilityController:'paired-legacy',implementation:'isolated-design-study',balanceStatus:'no gameplay mass or frame rating yet' },
    { id:'concept-tub',family:'monocoque',name:'03 — Structural Tub / Monocoque',profile:'tub-structural',
      structure:'A continuous stressed floor, sidewalls and bulkheads; hip loads enter the shell through thickened openings.',
      bounds:[2.06,1.20,1.86],origin:[0,0,0],pieces:tubPieces,sockets:tubSockets,
      mobilityController:'paired-legacy',implementation:'isolated-design-study',balanceStatus:'no gameplay mass or frame rating yet' },
]);
export const getConceptChassis = id => CONCEPT_CHASSIS.find(f=>f.id===id)??null;
const near = (a,b,eps=.022)=>Math.abs(a-b)<=eps;

/** Geometry and authority validation for authored preview data. This is a
 * design-time check, not a claim that concept frames can deploy yet. */
export function validateConceptChassis(frame){
    const errors=[];
    if(!frame||frame.implementation!=='isolated-design-study')return {valid:false,errors:['Not an isolated chassis concept.']};
    if(!Array.isArray(frame.bounds)||frame.bounds.length!==3||frame.bounds.some(n=>!Number.isFinite(n)||n<=0))errors.push('Invalid body dimensions.');
    if(!Array.isArray(frame.origin)||frame.origin.length!==3||frame.origin.some(n=>!Number.isFinite(n)))errors.push('Invalid chassis origin.');
    if(frame.mobilityController!=='paired-legacy')errors.push('Concepts cannot claim independent leg controllers.');
    if(!Array.isArray(frame.pieces)||!Array.isArray(frame.sockets))return {valid:false,errors:[...errors,'Missing pieces or sockets.']};
    const pieceIds=new Set(),socketIds=new Set();
    const byPiece=new Map();
    for(const p of frame.pieces){
        if(!p?.id||pieceIds.has(p.id))errors.push(`Duplicate/bad structural piece ${p?.id}.`);
        else{pieceIds.add(p.id);byPiece.set(p.id,p);}
        if(!Array.isArray(p?.center)||p.center.length!==3||p.center.some(v=>!Number.isFinite(v))||
           !Array.isArray(p?.size)||p.size.length!==3||p.size.some(v=>!Number.isFinite(v)||v<=0))errors.push(`Invalid piece geometry ${p?.id}.`);
        if(!p?.purpose||p.purpose.length<18)errors.push(`Missing structural purpose ${p?.id}.`);
    }
    for(const s of frame.sockets){
        if(!s?.id||socketIds.has(s.id))errors.push(`Duplicate/bad socket ${s?.id}.`);else socketIds.add(s.id);
        if(!['light','medium','heavy'].includes(s.standard))errors.push(`Unknown standard ${s?.id}.`);
        if(!['mobility','command','power','combat','utility'].includes(s.roleHint))errors.push(`Unknown role ${s?.id}.`);
        if(!Array.isArray(s?.position)||s.position.length!==3||s.position.some(v=>!Number.isFinite(v)))errors.push(`Invalid socket position ${s?.id}.`);
        if(!Array.isArray(s?.normal)||s.normal.length!==3||s.normal.some(v=>!Number.isFinite(v))||
           !near(Math.hypot(...s.normal),1,.001))errors.push(`Invalid surface normal ${s?.id}.`);
        if(!Number.isFinite(s.maxLoadKg)||s.maxLoadKg<=0||s.ratingStatus!=='provisional-preview-only')errors.push(`Missing provisional load annotation ${s?.id}.`);
        const p=byPiece.get(s.supportId);
        if(!p)errors.push(`Socket ${s.id} is floating: no supporting structural piece.`);
        else if(Array.isArray(s.position)&&Array.isArray(s.normal)&&p.kind!=='sloped-bulkhead'){
            // For a six-axis pad the declared mount surface must coincide with a
            // face of its explicitly named anchor, NOT an arbitrary free-space point.
            const axis=s.normal.findIndex(v=>Math.abs(v)===1);
            if(axis===-1||!near(s.position[axis],p.center[axis]+s.normal[axis]*p.size[axis]/2))
                errors.push(`Socket ${s.id} does not touch face of ${p.id}.`);
            for(let i=0;i<3;i++)if(i!==axis && Math.abs(s.position[i]-p.center[i])>p.size[i]/2+.015)
                errors.push(`Socket ${s.id} lies outside face of ${p.id}.`);
        }
    }
    // Prevent the exact failure of the previous schematic pass: a plate or
    // mount may be correctly annotated yet FLOAT without a real load path.
    // Conservative AABB intersection is sufficient for these minimal greybox
    // primitives; the tiny tolerance represents a plausible bolted seam.
    const extents=p=>p.kind==='hip-boss'?[p.size[2]/2,p.size[0],p.size[0]]:
        p.kind==='sloped-bulkhead'?[p.size[0]/2,p.size[1]/2+.04,p.size[2]/2+.04]:
        p.size.map(v=>v/2);
    const touching=(a,b)=>[0,1,2].every(i=>
        Math.abs(a.center[i]-b.center[i])<=extents(a)[i]+extents(b)[i]+.025);
    if(frame.pieces.length){
        const connected=new Set([frame.pieces[0].id]);
        let changed=true;
        while(changed){
            changed=false;
            for(const p of frame.pieces){
                if(connected.has(p.id))continue;
                if(frame.pieces.some(q=>connected.has(q.id)&&touching(p,q))){
                    connected.add(p.id);changed=true;
                }
            }
        }
        for(const p of frame.pieces)if(!connected.has(p.id))
            errors.push(`Disconnected structural member ${p.id}; no route to main structure.`);
    }
    for(const id of ['mobility','command','power','combat','left-rear-utility'])if(!socketIds.has(id))errors.push(`Missing initial functional mount ${id}.`);
    if(frame.sockets.filter(s=>s.id==='mobility').length!==1)errors.push('Paired legs require exactly one functional mobility socket.');
    return {valid:errors.length===0,errors};
}
