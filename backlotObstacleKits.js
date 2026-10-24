/** M3CH4 / Backlot k.5q.2 — reusable physical-cover prop kits.
 *
 * Shape truth: exactly ONE opaque named certified collider AABB per authored
 * obstacle. Steel skins, wheels, doors and machinery are purely visual,
 * never used for ballistics or AI navigation. No cosmetic hollow windows,
 * drive-through gaps or wheels claim to offer a path not in map geometry.
 *
 * These are intentionally chunked and built from shared box/cylinder meshes.
 * backlotDerbyWorld batches identical meshes into WebGL InstancedMesh.
 */
const C=Object.freeze({
 rust:0x945337,brown:0x604333,sand:0xbb9a69,cream:0xd0b783,
 teal:0x42716b,tealDark:0x304b48,yellow:0xc49b48,
 olive:0x57614c,green:0x39463d,ink:0x282b29,
 rubber:0x202422,steel:0x565e59,silver:0x9b9d86,
 window:0x30494c,white:0xb7b7a1,concrete:0x938876,
});
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const shade=(n)=>[C.rust,C.olive,C.teal,C.yellow,C.green][n%5];

/** Render a certifiably solid backing shell, with all ballistic surfaces
 * visible. We dress it with fittings rather than painting away solid faces. */
function cover(root,o,solids,api,color){
 const w=o.maxX-o.minX,d=o.maxZ-o.minZ,h=o.height;
 const x=(o.minX+o.maxX)*.5,z=(o.minZ+o.maxZ)*.5;
 const shell=api.block(root,'certified-'+o.artKit+'-'+o.id,w,h,d,x,h*.5,z,color,.32);
 shell.userData.arenaObstacleId=o.id;
 shell.userData.coverFamily=o.artKit;
 shell.userData.visualCoverShell=true;
 solids.push(shell);
 return {root,o,w,d,h,x,z,
   front:o.minZ-.014,back:o.maxZ+.014,
   left:o.minX-.014,right:o.maxX+.014,
   box:(name,w,h,d,x,y,z,c,metal=.22)=>api.block(root,name,w,h,d,x,y,z,c,metal),
   cyl:(name,r,length,x,y,z,c,axis='y',segments=10)=>
     api.drum(root,name,r,length,x,y,z,c,axis,segments),
 };
}
function rim(c,name,x,y,z,w,d,color=C.steel){
 c.box(name+'-front',w,.075,.08,x,y,z-d*.5+.045,color);
 c.box(name+'-back',w,.075,.08,x,y,z+d*.5-.045,color);
 for(const s of [-1,1])
   c.box(name+'-side',.09,.075,d,x+s*(w*.5-.05),y,z,color);
}
function rivetRow(c,name,x0,x1,y,z,n=5){
 for(let i=0;i<n;i++)
  c.box(name,.072,.071,.04,x0+(x1-x0)*i/Math.max(1,n-1),y,z,C.cream,.39);
}
function shippingContainer(c){
 const {w,d,h,x,z}=c;
 // Full-height cargo hull is structurally solid, and now has side ribs,
 // four cast corner posts, contrasting doors, hinges and locking bars.
 const face=c.front-.006,other=c.back+.006;
 for(const s of [-1,1]){
  for(const xx of [x-s*w*.475,x+s*w*.475])
   c.box('container-corner-casting',.18,h*.96,.23,xx,h*.5,
     z+s*d*.46,C.ink,.43);
  c.box('container-upper-corner-band',w*.97,.13,.13,
      x,h-.11,z+s*d*.468,C.ink,.41);
 }
 for(const s of [-1,1]){
  const zz=s<0?face:other;
  c.box('container-rear-doors',w*.94,h*.84,.037,x,h*.52,zz,C.tealDark,.38);
  c.box('container-central-door-seam',.065,h*.77,.048,x,h*.52,
    zz+s*.036,C.ink,.40);
  for(const off of [-.32,.32]){
   c.box('container-lock-rod',.075,h*.72,.055,x+w*off,h*.55,
     zz+s*.055,C.silver,.55);
   for(const yy of [.24,.78])
    c.box('container-lock-clamp',.23,.12,.074,x+w*off,h*yy,
      zz+s*.079,C.ink,.41);
  }
  for(const off of [-.44,-.06,.06,.44])
   c.box('container-hinge',.13,.22,.055,x+w*off,h*.65,zz+s*.065,C.rust,.38);
 }
 // Corrugation on BOTH broad sides for all camera angles.
 const n=clamp(Math.floor(w/.52),5,12);
 for(let i=0;i<n;i++){
   const px=c.o.minX+w*(i+.5)/n;
   c.box('container-corrugation',w/(n*2.7),h*.79,.068,
     px,h*.52,face,C.cream,.32);
   c.box('container-rear-corrugation',w/(n*2.7),h*.79,.068,
     px,h*.52,other,C.teal,.34);
 }
 for(const s of [-1,1]){const xx=x+s*w*.503;
  const ribs=clamp(Math.floor(d/.73),3,7);
  for(let i=0;i<ribs;i++)c.box('container-end-pressed-rib',
    .064,h*.71,d/(ribs*2.8),xx,h*.53,c.o.minZ+d*(i+.5)/ribs,C.olive,.35);
 }
 c.box('container-top-rust-patch',w*.61,.075,d*.36,x-w*.14,h+.015,z,C.rust,.14);
 rim(c,'container-base-sill',x,.10,z,w*.95,d*.94,C.ink);
}
function tyreStacks(c){
 const {w,d,h,x,z}=c;
 // A solid, backed pile, not an implausible rack/axle sculpture. The
 // certified opaque AABB behind it remains visible and hit-blocking.
 const radius=Math.min(.64,h*.31,w*.26,d*.29);
 const n=Math.max(2,Math.min(3,Math.floor(w/(radius*1.70))));
 const centers=Array.from({length:n},(_,i)=>x+(i-(n-1)*.5)*(radius*1.82));
 c.box('tyre-pile-grounded-foot',w*.94,Math.max(.18,h*.17),d*.82,
   x,Math.max(.11,h*.13),z,C.rubber,.13);
 for(let i=0;i<n;i++){
  const px=centers[i],zz=z+(i%2===0?-.07:.09);
  const bottom=Math.max(radius*.32,.26);
  // Chunky sidewalls and dark central sockets; never advertise a
  // walk-through hole in certified solid collision geometry.
  c.cyl('chunky-reclaimed-tractor-tire',radius,radius*.52,px,bottom+radius*.30,zz,
    C.rubber,'y',10);
  c.cyl('tyre-visible-sidewall',radius*.67,radius*.075,px,
    bottom+radius*.61,zz,C.steel,'y',10);
  c.cyl('tyre-recessed-centre',radius*.33,radius*.082,px,
    bottom+radius*.67,zz,C.ink,'y',8);
 }
 // One partially overlapping upper tyre makes this read as a stack at
 // gameplay distance; no thin steel rack pretending to hold 10 tires.
 c.cyl('one-upper-grounded-tractor-tyre',radius*.92,radius*.50,
   x,bottom+radius*.79,z,C.rubber,'y',10);
 c.cyl('upper-tyre-recessed-sidewall',radius*.53,radius*.08,
   x,bottom+radius*1.05,z,C.steel,'y',10);
}
function drums(c){
 const {w,d,h,x,z}=c;
 const n=clamp(Math.round(w/1.07),2,4),radius=Math.min(.44,d*.30,w/n*.43);
 // Dense pallet & backboard match the actual solid AABB. All visible
 // barrels remain separated visually but not falsely penetrable.
 c.box('oil-drum-pallet',w*.94,.19,d*.9,x,.16,z,C.brown,.20);
 for(let i=0;i<n;i++){
  const px=c.o.minX+w*(i+.5)/n,py=Math.min(h*.48,.8);
  const color=i%3===0?C.rust:i%3===1?C.teal:C.yellow;
  c.cyl('steel-55-gallon-drum',radius,Math.min(h*.77,1.40),px,py,
    z+(i%2===0?-.04:.04),color,'y',10);
  for(const j of [-1,1])
   c.cyl('drum-rolled-rim',radius*1.015,.055,px,
     py+j*Math.min(h*.37,.65),z,C.ink,'y',10);
  c.cyl('drum-lid',radius*.76,.037,px,
    py+Math.min(h*.385,.69),z,C.steel,'y',10);
  c.cyl('drum-bung',radius*.14,.045,px+radius*.33,
    py+Math.min(h*.392,.70),z-radius*.24,C.cream,'y',8);
  c.box('faded-barrel-warning-band',radius*1.75,.095,.055,
    px,py+.18,c.front-.012,C.cream,.22);
 }
 rim(c,'drum-pallet',x,.13,z,w*.91,d*.84,C.ink);
}
function pickup(c){
 const {x,z,w,d,h}=c;
 const cabx=x-w*.13;
 c.box('pickup-cab-panel',w*.40,h*.55,d*.94,cabx,h*.71,z,C.rust,.29);
 c.box('pickup-black-windshield',w*.30,h*.24,.035,
    cabx,h*.77,c.front-.01,C.window,.13);
 c.box('pickup-door-seam',.066,h*.36,.04,cabx+w*.18,h*.51,c.front-.05,C.ink);
 c.box('pickup-hood',w*.29,h*.27,d*.86,x+w*.34,h*.54,z,C.olive,.31);
 c.box('pickup-truck-bed-rails',w*.34,.12,d*.93,x-w*.33,h*.76,z,C.steel);
 c.box('pickup-rusted-tailgate',.09,h*.37,d*.86,c.o.minX+.09,h*.47,z,C.rust);
 for(const px of [x-w*.32,x+w*.34]){
  for(const side of [-1,1]){
   const zz=z+side*d*.51;
   const radius=Math.min(.41,h*.23);
   c.cyl('pickup-wheel-sidewall',radius,.087,px,h*.25,zz,C.rubber,'z',10);
   c.cyl('pickup-wheel-metal-hub',radius*.41,.093,px,h*.25,
     zz+side*.025,C.silver,'z',8);
  }
 }
 c.box('pickup-radiator-grille',.04,h*.25,d*.67,c.o.maxX-.07,h*.37,z,C.ink);
 for(let i=-1;i<=1;i++)c.box('pickup-grille-slats',
   .055,.05,d*.10,c.o.maxX-.029,h*.38,z+i*d*.18,C.cream,.4);
 c.box('pickup-dented-roof',w*.41,.09,d*.91,cabx,h*.94,z,C.brown);
}
function generator(c){
 const {x,z,w,d,h}=c;
 const face=c.front-.008;
 // Service doors, cooling grille, spark arrester, mounting skids, pipe.
 rim(c,'generator-skid',x,.13,z,w*.94,d*.88,C.ink);
 c.box('generator-service-hatch',w*.34,h*.57,.07,
     x-w*.24,h*.52,face,C.olive,.22);
 c.box('generator-hatch-seal',w*.30,.05,.074,
     x-w*.24,h*.77,face-.028,C.ink,.24);
 for(let i=0;i<7;i++)
  c.box('generator-cooling-louvre',w*.36,.05,.095,
     x+w*.20,h*(.28+i*.135),face-.037,i%3===0?C.silver:C.ink,.40);
 c.box('generator-horizontal-exhaust',w*.18,.16,d*.12,
     x+w*.39,h*.87,z-d*.27,C.rust);
 c.box('generator-panel-label',w*.22,.16,.082,
     x-w*.23,h*.61,face-.039,C.yellow);
 for(const p of [-1,1])c.box('generator-handling-hook',.18,.2,.17,
     x+p*w*.38,h+.025,z,C.steel,.38);
}
function scrapWall(c){
 const {w,h,x,z}=c,front=c.front-.019;
 // Large uneven patched armor plates — meaningful solid blocker behind
 // the small sheet stagger; never advertise a shoot-through slit.
 const plates=clamp(Math.floor(w/1.55),3,5);
 for(let i=0;i<plates;i++){
  const pw=w/plates,px=c.o.minX+pw*(i+.5);
  const ph=h*(.56+(i%3)*.12);
  c.box('salvage-welded-plate',pw*.96,ph,.10,px,ph*.5,
    front,shade(i),.45);
  c.box('weld-bead-seam',.08,h*.71,.12,px+pw*.45,h*.52,front-.034,
    C.ink,.39).rotation.z=(i%2?-.06:.09);
  if(i%2===0)c.box('scrap-structural-diagonal',.11,h*.63,.15,
     px,h*.53,front-.065,C.steel,.40).rotation.z=i%4===0?.27:-.27;
 }
 rivetRow(c,'scrap-plate-rivet-row',c.o.minX+w*.1,c.o.maxX-w*.1,h*.71,
   front-.09,clamp(Math.ceil(w/1.20),3,6));
 c.box('scrap-brace-top-angle',w*.93,.14,.24,x,h-.07,z,C.ink,.39);
}
function flatbed(c){
 const {x,z,w,d,h}=c;
 // The obstacle is a trailer carrying an enormous unsecured scrap load.
 c.box('flatbed-rail-upper',w*.98,.16,.19,x,h*.48,c.front,C.rust,.32);
 c.box('flatbed-rail-lower',w*.98,.18,.19,x,h*.19,c.front,C.ink,.43);
 for(let i=0;i<4;i++)c.box('flatbed-stake',.12,h*.76,.14,
   c.o.minX+w*(i+.5)/4,h*.5,c.front-.07,C.ink,.32);
 for(const px of [x-w*.33,x+w*.33]){
  c.cyl('flatbed-tyres',Math.min(.46,h*.19),.14,px,h*.25,
    c.front-.029,C.rubber,'z',10);
  c.cyl('flatbed-rust-hub',.18,.16,px,h*.25,
    c.front-.049,C.steel,'z',8);
 }
 c.box('junked-flatbed-motor',w*.28,h*.28,d*.58,
   x-w*.28,h*.83,z,C.olive);
 c.box('flatbed-load-rusted-body',w*.36,h*.34,d*.62,
   x+w*.22,h*.82,z,C.rust);
 for(let i=0;i<2;i++)c.box('flatbed-angled-scrap',w*.13,.17,d*.82,
   c.o.minX+w*(i+.50)/2,h*.91,z,i%2?C.steel:C.yellow,.39)
   .rotation.z=i%2===0?.12:-.14;
}
function turbine(c){
 const {x,z,w,d,h}=c,rad=Math.min(w*.42,h*.40),face=c.front-.029;
 c.cyl('turbine-cast-fan-body',rad,.13,x,h*.53,face,C.ink,'z',12);
 c.cyl('turbine-steel-housing',rad*.86,.16,x,h*.53,face-.03,
   C.silver,'z',12);
 for(let i=0;i<8;i++){
  const a=i*Math.PI/4,rr=rad*.58;
  const blade=c.box('turbine-fan-vane',rad*.43,.13,.13,
     x+Math.cos(a)*rr,h*.53+Math.sin(a)*rr,face-.19,C.olive,.49);
  blade.rotation.z=a+.42;
 }
 c.cyl('turbine-centre-hub',rad*.23,.24,x,h*.53,face-.23,C.rust,'z',10);
 for(let j=0;j<3;j++)
  c.box('turbine-hot-heat-rib',w*.70,.11,d*.78,
    x,h*(.22+j*.15),z,C.steel,.39);
 c.box('turbine-pipe-case',w*.50,h*.16,d*.13,x,h*.90,
    z+d*.20,C.yellow,.37);
}
function tractor(c){
 const {x,z,w,d,h}=c;
 const front=c.front-.01;
 c.box('farm-tractor-raised-cab',w*.66,h*.42,d*.40,
   x,h*.78,z+d*.20,C.rust,.36);
 c.box('farm-tractor-glass',w*.48,h*.19,.045,
   x,h*.79,front,C.window,.20);
 c.box('farm-tractor-hood',w*.81,h*.23,d*.50,
   x,h*.47,z-d*.20,C.yellow,.34);
 c.box('farm-tractor-radiator',w*.55,h*.28,.05,
   x,h*.36,front,C.ink,.45);
 for(const side of [-1,1])for(const dz of [-d*.25,d*.25]){
  const rr=Math.min(.53,h*.19,d*.20);
  const xx=x+side*w*.47;
  c.cyl('farm-tractor-giant-drive-wheel',rr,.19,
    xx,rr+.10,z+dz,C.rubber,'x',12);
  c.cyl('farm-tractor-dusty-drive-hub',rr*.43,.20,
    xx+side*.04,rr+.10,z+dz,C.silver,'x',8);
 }
 c.box('farm-tractor-stacked-exhaust',.12,h*.23,.14,
   x+w*.24,h*.91,z-d*.14,C.ink,.44);
 c.box('farm-tractor-roof',w*.71,.14,d*.51,x,h-.09,z+d*.19,C.olive,.30);
}
function harvester(c){
 const {x,z,w,d,h}=c;
 tractor(c);
 // Wider agricultural header and crop intake distinguish the combine
 // from a truck or another anonymous wall.
 c.box('combine-harvester-header',w*.91,.23,d*.16,
   x,h*.26,c.front+.15,C.rust,.32);
 for(let i=0;i<7;i++)
  c.box('combine-harvester-header-tooth',.10,.13,d*.17,
    c.o.minX+w*(i+.5)/5,h*.18,c.front+.08,C.ink,.30);
 c.box('combine-grain-bin',w*.67,h*.16,d*.63,
   x,h*.88,z+d*.12,C.yellow,.27);
 c.box('combine-unloader-boom',w*.13,.13,d*.68,
   x+w*.39,h*.91,z,C.steel,.47);
}
function concreteBarrier(c){
 const {x,z,w,h}=c;
 const face=c.front-.022;
 // Solid Jersey-style shape with two taper bands cast against its face.
 c.box('concrete-barrier-wide-foot',w*.99,h*.24,.17,x,h*.15,face,C.concrete,.01);
 c.box('concrete-barrier-sloping-upper',w*.90,h*.49,.13,x,h*.58,
    face+.022,C.white,.04).rotation.x=-.13;
 for(let i=0;i<3;i++){
  const xx=c.o.minX+w*(i+.5)/3;
  c.box('concrete-barrier-chipped-seam',.12,h*.58,.04,
    xx,h*.47,face-.063,C.brown,.06);
 }
 c.box('concrete-barrier-warning-stripe',w*.80,.13,.045,
   x,h*.75,face-.08,C.yellow,.14);
}
const KITS=Object.freeze({
 'shipping-container':shippingContainer,
 'tire-stack':tyreStacks,
 'barrel-cluster':drums,
 'pickup-wreck':pickup,
 'generator-unit':generator,
 'scrap-barricade':scrapWall,
 'flatbed-fragment':flatbed,
 'turbine-housing':turbine,
 'tractor-wreck':tractor,
 'combine-harvester':harvester,
 'concrete-barrier':concreteBarrier,
});
export const BACKLOT_COVER_KITS=Object.freeze(Object.keys(KITS));
export function buildBacklotObstacleKit(root,obstacle,solids,api){
 const fn=KITS[obstacle.artKit];
 if(!fn)throw Error('Unregistered Backlot cover prop: '+obstacle.artKit);
 const c=cover(root,obstacle,solids,api,
   obstacle.artKit==='tire-stack'?C.rubber:
   obstacle.artKit==='shipping-container'?C.teal:
   obstacle.artKit==='generator-unit'?C.olive:
   obstacle.artKit==='barrel-cluster'?C.rust:
   obstacle.artKit==='concrete-barrier'?C.concrete:
   obstacle.artKit==='pickup-wreck'?C.brown:
   obstacle.artKit==='scrap-barricade'?C.rust:
   obstacle.artKit==='flatbed-fragment'?C.steel:
   obstacle.artKit==='turbine-housing'?C.olive:
   obstacle.artKit==='combine-harvester'?C.yellow:C.rust);
 fn(c);
 return c;
}
