/** Backlot venue authored identity, kept physically separate from authoritative
 * arena AABBs. Terrain, berms, distant farm buildings and crowd structures
 * NEVER enter world.obstacles or the combat raycaster.
 * Low-resolution meshes and deterministic placement suit iPhone WebGL.
 */
import * as THREE from 'three';
const materials=new Map(),cubeGeom=new THREE.BoxGeometry(1,1,1);
const PI2=Math.PI*2;
function surface(color,{metalness=.12,emissive=0,transparent=false,opacity=1}={}){
 const key=[color,metalness,emissive,transparent,opacity].join(':');
 if(!materials.has(key))materials.set(key,new THREE.MeshStandardMaterial({
  color,roughness:.93,metalness,flatShading:true,
  emissive:emissive?color:0,emissiveIntensity:emissive,transparent,opacity,
  depthWrite:!transparent,
 }));
 return materials.get(key);
}
const clay=surface(0x766044),pale=surface(0x9c8258),
 dark=surface(0x473b31),timber=surface(0x644936),red=surface(0x8e5637),
 metal=surface(0x4e5650,{metalness:.39}),tyre=surface(0x272b29),
 amber=surface(0xe1bb78,{emissive:.58}),leaf=surface(0x505b40);
function cuboid(group,name,w,h,d,x,y,z,material,angle=0){
 const obj=new THREE.Mesh(cubeGeom,material);obj.name=name;
 obj.position.set(x,y,z);obj.scale.set(w,h,d);obj.rotation.y=angle;
 obj.receiveShadow=true;obj.userData.visualOnly=true;group.add(obj);return obj;
}
function cylinder(group,name,top,bottom,height,x,y,z,material,segments=8){
 const mesh=new THREE.Mesh(new THREE.CylinderGeometry(top,bottom,height,segments),material);
 mesh.name=name;mesh.position.set(x,y,z);
 mesh.userData.visualOnly=true;group.add(mesh);return mesh;
}
function planeLabel(group,name,title,subtitle,x,y,z,width=7,backwards=false){
 const canvas=document.createElement('canvas');
 canvas.width=512;canvas.height=160;
 const g=canvas.getContext('2d');
 g.fillStyle='#3b342a';g.fillRect(0,0,512,160);
 g.strokeStyle='#b9935d';g.lineWidth=9;g.strokeRect(7,7,498,146);
 g.fillStyle='#e4c88b';g.font='bold 60px monospace';g.textAlign='center';
 g.fillText(title,256,77,476);
 g.font='bold 25px monospace';g.fillText(subtitle,256,123,470);
 const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;
 tex.magFilter=tex.minFilter=THREE.NearestFilter;
 const obj=new THREE.Mesh(new THREE.PlaneGeometry(width,width*.3125),
  new THREE.MeshBasicMaterial({map:tex,side:THREE.DoubleSide}));
 obj.name=name;obj.position.set(x,y,z);
 if(backwards)obj.rotation.y=Math.PI;
 obj.userData.visualOnly=true;group.add(obj);return obj;
}
function rng(seed=0x2618ad){return ()=>{
 seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;
};}
const signPow=(v,p)=>Math.sign(v)*Math.pow(Math.abs(v),p);
function edge(t,rx,rz){
 return {x:signPow(Math.cos(t),.265)*rx,z:signPow(Math.sin(t),.265)*rz};
}
function ribbon(group,name,path,width,color,opacity=.18,y=.045){
 const vertices=[];
 for(let i=0;i<path.length-1;i++){
  const a=path[i],b=path[i+1],dx=b.x-a.x,dz=b.z-a.z;
  const k=width/(2*Math.max(.001,Math.hypot(dx,dz)));
  const px=-dz*k,pz=dx*k;
  vertices.push(a.x+px,y,a.z+pz,a.x-px,y,a.z-pz,b.x+px,y,b.z+pz,
   a.x-px,y,a.z-pz,b.x-px,y,b.z-pz,b.x+px,y,b.z+pz);
 }
 const geom=new THREE.BufferGeometry();
 geom.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
 geom.computeVertexNormals();
 const mesh=new THREE.Mesh(geom,new THREE.MeshBasicMaterial({
  color,transparent:true,opacity,depthWrite:false,side:THREE.DoubleSide}));
 mesh.name=name;mesh.userData.visualOnly=true;group.add(mesh);return mesh;
}
function ribbonScuffs(group,paths,color){
 // One geometry for dozens of isolated tire scuffs. Connecting those paths
 // would draw false long lines across the combat field.
 const verts=[];
 for(const [a,b,width] of paths){
  const dx=b.x-a.x,dz=b.z-a.z,k=width/(2*Math.max(.001,Math.hypot(dx,dz)));
  const px=-dz*k,pz=dx*k,y=.053;
  verts.push(a.x+px,y,a.z+pz,a.x-px,y,a.z-pz,b.x+px,y,b.z+pz,
   a.x-px,y,a.z-pz,b.x-px,y,b.z-pz,b.x+px,y,b.z+pz);
 }
 const geo=new THREE.BufferGeometry();
 geo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));
 geo.computeVertexNormals();
 const mesh=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({
  color,transparent:true,opacity:.13,depthWrite:false,side:THREE.DoubleSide}));
 mesh.name='random-scraped-earth';mesh.userData.visualOnly=true;group.add(mesh);
}
function bermGeometry(group,rx,rz){
 const verts=[],normals=[],indices=[];
 const rings=[{r:.990,y:-.04},{r:1.032,y:.33},{r:1.095,y:.55},{r:1.16,y:-.11}];
 const N=96;
 for(const ring of rings)for(let i=0;i<=N;i++){
  const a=PI2*i/N,p=edge(a,rx*ring.r,rz*ring.r);
  const height=ring.y+.055*Math.sin(a*9)+.03*Math.cos(a*17);
  verts.push(p.x,height,p.z);
 }
 for(let j=0;j<rings.length-1;j++)for(let i=0;i<N;i++){
  const a=j*(N+1)+i,b=a+N+1;indices.push(a,b,a+1,b,b+1,a+1);
 }
 const geo=new THREE.BufferGeometry();
 geo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));
 geo.setIndex(indices);geo.computeVertexNormals();
 const obj=new THREE.Mesh(geo,clay);obj.name='uneven-oval-dirt-berm';
 obj.userData.visualOnly=true;obj.receiveShadow=true;group.add(obj);
}
/** The visible arena fence is OUTSIDE the rectangular gameplay bounds, so a
 * pilot never encounters an invented curved collision wall or false blocker.
 * The round shoulders replace the previous four straight stockyard walls.
 */
export function buildBacklotOval(root,w){
 const g=new THREE.Group();g.name='oval-rodeo-perimeter';root.add(g);
 const rx=(w.maxX-w.minX)/2+5,rz=(w.maxZ-w.minZ)/2+5;
 const cx=(w.minX+w.maxX)/2,cz=(w.minZ+w.maxZ)/2;
 bermGeometry(g,rx,rz);
 const SEGMENTS=72;
 for(let i=0;i<SEGMENTS;i++){
  const a=PI2*i/SEGMENTS,b=PI2*(i+1)/SEGMENTS;
  const p=edge(a,rx*1.043,rz*1.043),q=edge(b,rx*1.043,rz*1.043);
  const x=cx+(p.x+q.x)/2,z=cz+(p.z+q.z)/2;
  const length=Math.hypot(q.x-p.x,q.z-p.z);
  const yaw=Math.atan2(q.x-p.x,q.z-p.z);
  for(const y of [.74,1.42,2.10])
   cuboid(g,'bent-ring-rail',.12,.13,length+.12,x,y,z,
    i%7===0?red:i%5===0?metal:timber,yaw);
  if(i%2===0)cuboid(g,'uneven-fence-post',.23,2.28,.24,
    cx+p.x,1.14,cz+p.z,i%5===0?metal:timber);
  if(i%6===0){
   const t=edge(a,rx*1.068,rz*1.068);
   for(let j=0;j<2;j++)
     cylinder(g,'fence-tractor-tyres',.54,.54,.34,
      cx+t.x, .53+j*.63,cz+t.z,tyre,9);
  }
 }
 const stats={rails:SEGMENTS*3,posts:SEGMENTS/2,roundedCorners:true,
  outsidePlayableBounds:true,earthwork:'oval berm'};
 g.userData.perimeterStats=stats;
 return stats;
}
function floorContext(root,w){
 // Prevent the stark void beyond the playable ground slab; not walkable.
 cuboid(root,'offsite-farm-earth',245,.20,220,0,-.37,0,clay);
 const r=rng(8314);
 for(let i=0;i<45;i++){
  let x=(r()-.5)*176,z=(r()-.5)*148;
  if(Math.abs(x)<43&&Math.abs(z)<38)continue;
  const long=.5+r()*3.6;
  cuboid(root,'offsite-stone-or-clod',long,.15+r()*.32,.45+r()*2,
    x,-.15,z,i%3===0?dark:pale,r()*PI2);
 }
}
function horizonFarm(root,w){
 const g=new THREE.Group();g.name='farmyard-horizon';root.add(g);
 // Clearly readable silhouettes against open sky, never behind invisible cover.
 const barns=[[-69,-66,16,10,12], [67,-70,12,8,10],[-65,57,10,7,10]];
 for(const [x,z,ww,hh,dd] of barns){
  cuboid(g,'distant-farm-barn',ww,hh,dd,x,hh/2,z,red);
  const roof=cuboid(g,'barn-steel-roof',ww+1,1.35,dd+1,x,hh+.2,z,metal);
  roof.rotation.z=.11;
  cuboid(g,'barn-sagging-door',ww*.23,hh*.62,.14,x,hh*.31,z+dd*.51,dark);
 }
 for(const [x,z,h] of [[-86,-39,19],[76,-48,23],[82,39,15]]){
  cylinder(g,'farm-grain-silo',4.0,4.3,h,x,h/2,z,surface(0x888b7c,{metalness:.25}),12);
  const crown=new THREE.Mesh(new THREE.ConeGeometry(4.25,2.7,12),metal);
  crown.name='farm-silo-conical-crown';
  crown.position.set(x,h+1.2,z);crown.userData.visualOnly=true;g.add(crown);
  for(const y of [2.1,h*.45,h*.88])
   cylinder(g,'silo-corrosion-band',4.22,4.22,.2,x,y,z,red,12);
 }
 for(const [x,z] of [[-48,-62],[43,-65],[60,69]]){
  cuboid(g,'distant-power-pole',.38,12,.38,x,6,z,dark);
  cuboid(g,'crossbeam-insulator',4.7,.27,.28,x,11.3,z,metal);
  for(const dx of [-1.7,0,1.7])
   cylinder(g,'power-ceramic-cap',.20,.20,.45,x+dx,11.6,z,pale,6);
 }
 // Ranges of sparse low-poly trees: crisp horizon, no costly moving foliage.
 const r=rng(917);
 const sharedCrown=new THREE.IcosahedronGeometry(1,0);
 const sharedHill=new THREE.SphereGeometry(1,8,5);
 for(let i=0;i<28;i++){
  const x=-107+i*7.8+(r()-.5)*2.5;
  const z=i%2===0?-78-r()*7:81+r()*8;
  const h=5+r()*7;
  cuboid(g,'distant-trunk',.45,h*.64,.45,x,h*.32,z,timber);
  const canopy=new THREE.Mesh(sharedCrown,leaf);
  canopy.name='distant-tree-crown';canopy.position.set(x,h*.85,z);
  canopy.scale.set(h*.35,h*.35*1.3,h*.35);canopy.userData.visualOnly=true;g.add(canopy);
 }
 // Cheap irregular hills break the 'flat wall at the horizon' reading.
 for(let i=0;i<10;i++){
  const x=-109+i*24,z=i%2===0?-101:101;
  const mound=new THREE.Mesh(sharedHill,surface(0x615f49));
  mound.name='distant-earth-ridge';mound.position.set(x,-1,z);
  mound.scale.set(19+i%3*3,7+i%4,8);mound.userData.visualOnly=true;g.add(mound);
 }
}
function arenaFacilities(root,w){
 const g=new THREE.Group();g.name='backlot-spectator-and-service-yard';root.add(g);
 const n=w.minZ;
 const boothZ=n-10.5;
 // Raised announcer / organizer booth between asymmetric junk bleachers.
 cuboid(g,'announcer-platform',10,.42,5.5,0,3.7,boothZ,timber);
 for(const x of [-4.35,4.35])for(const z of [-2.15,2.15])
  cuboid(g,'announcer-scaffold-post',.25,4,.25,x,2,boothZ+z,metal);
 cuboid(g,'announcer-station',8.7,3.4,3.8,0,5.65,boothZ,red);
 cuboid(g,'announcer-corrugated-roof',10.3,.34,5.0,0,7.46,boothZ,metal,.04);
 cuboid(g,'announcer-open-window',5.9,1.15,.14,0,6.0,boothZ+1.95,dark);
 for(let x=-3.9;x<=3.9;x+=1.95)
  cuboid(g,'booth-window-batten',.13,1.4,.16,x,6,boothZ+2.03,timber);
 planeLabel(g,'derby-announcer-sign','HOG PEN','SALVAGE • COMBAT • NO REFUNDS',
   0,8.96,boothZ+2.0,9.2);
 // A believable scoreboard and concession / mechanic sheds at the fence.
 const sx=w.maxX+12,sz=-5;
 for(const z of [sz-5,sz+5])
  cuboid(g,'manual-scoreboard-leg',.4,9,.4,sx,4.5,z,metal);
 cuboid(g,'patched-steel-scoreboard',.35,4.8,12.0,sx,9,sz,dark);
 // Main readable board faces inward along X. Draw on a flat texture panel.
 const score=planeLabel(g,'backlot-manual-scoreboard','HOG PEN',
   'HOME 0  •  VISITORS 0',0,0,0,6);
 score.position.set(sx-.22,9,sz);score.rotation.y=-Math.PI/2;
 for(const [x,z] of [[w.minX-11,14],[w.maxX+11,14]]){
  cuboid(g,'shack-body',7,3.4,5.5,x,1.7,z,iShade(x));
  cuboid(g,'shack-sheet-roof',8,.28,6.1,x,3.56,z,metal);
  cuboid(g,'shack-door',1.7,2.45,.12,x,1.24,z-2.85,dark);
  cuboid(g,'shack-exhaust',.31,1.8,.31,x+2,4.3,z-1,tyre);
  for(let j=0;j<4;j++)
   cylinder(g,'yard-fuel-can',.58,.58,1.55,x-4+j*.95,.78,z+3.6,
    j%3===0?red:metal,8);
 }
 // Enormous static lifting crane / chain hoist, entirely off-site.
 const craneX=w.minX-19,craneZ=-10;
 cuboid(g,'scrapyard-hoist-mast',.9,14,.9,craneX,7,craneZ,metal);
 cuboid(g,'scrapyard-hoist-jib',.55,.55,14,craneX+6.4,13.6,craneZ,red);
 cuboid(g,'hoist-cable',.09,5.2,.09,craneX+12.4,10.7,craneZ,dark);
 const hook=new THREE.Mesh(new THREE.TorusGeometry(.52,.11,5,7,Math.PI*1.55),metal);
 hook.rotation.y=Math.PI/2;hook.position.set(craneX+12.4,7.85,craneZ);
 hook.name='hoist-hook';g.add(hook);
 // A marquee that faces the actual friendly spawn (looking north).
 // Earlier venue signage sat dozens of meters BEHIND the player or hidden
 // behind the far boundary. This unmistakable grandstand landmark is high
 // above the sightline and outside the north playable line.
 const portalZ=w.minZ-3.55;
 for(const xx of [-10.3,10.3]){
   cuboid(g,'hog-pen-entrance-pylon',.68,8.4,.73,
     xx,4.2,portalZ-1.1,red);
   cuboid(g,'hog-pen-warning-cap',1.5,.4,1.5,
     xx,8.48,portalZ-1.1,amber);
 }
 cuboid(g,'hog-pen-scorebridge-girder',21.5,.53,.83,
   0,8.5,portalZ-1.1,metal);
 planeLabel(g,'north-facing-hog-pen-marquee','HOG PEN','BACKLOT DERBY  •  KEEP MOVING',
   0,10.2,portalZ,16.2);
 // Asymmetric signal flags form readable silhouettes above the ring without
 // adding extra collision, navigation blockers, dynamic lights or shadows.
 for(const [xx,paint] of [[-24,red],[26,pale]]){
   cuboid(g,'derby-marshals-flagstaff',.14,9.4,.14,
      xx,4.7,w.minZ-1.9,metal);
   const flag=cuboid(g,'derby-marshals-flag',3,1.35,.11,
      xx+1.55,8.6,w.minZ-1.9,paint);
   flag.rotation.z=-.12;
 }
 // The derby's route markers don't obstruct routes or pretend to be cover.
 for(const [x,z,t] of [[-20,-4,'A'],[0,-11,'B'],[20,0,'C']]){
  const disc=new THREE.Mesh(new THREE.RingGeometry(2.3,2.43,24),
   new THREE.MeshBasicMaterial({color:0x8f7b54,side:THREE.DoubleSide,
    transparent:true,opacity:.32,depthWrite:false}));
  disc.name='worn-objective-track-'+t;disc.rotation.x=-Math.PI/2;
  disc.position.set(x,.065,z);disc.userData.visualOnly=true;g.add(disc);
 }
 return g;
}
function iShade(x){return x<0?red:timber;}
export function buildBacklotTerrainAndFacilities(root,w){
 floorContext(root,w);
 const perimeter=buildBacklotOval(root,w);
 horizonFarm(root,w);arenaFacilities(root,w);
 // Road and tire tracks are flat decals: not new obstacles or fake elevation.
 const rx=(w.maxX-w.minX)/2-4,rz=(w.maxZ-w.minZ)/2-5;
 for(let wheel=0;wheel<3;wheel++){
  const coords=[];
  for(let i=0;i<=96;i++){
   const p=edge(i*PI2/96,rx-wheel*.67,rz-wheel*.45);
   coords.push(p);
  }
  ribbon(root,'continuous-churned-oval-rut',coords,.22,0x372d28,.26,.052+wheel*.003);
 }
 const r=rng(930);
 const scratches=[[],[]];
 for(let i=0;i<55;i++){
  const x=(r()-.5)*57,z=(r()-.5)*45;
  scratches[i%3===0?1:0].push([
   {x,z},{x:x+(r()-.5)*2,z:z+1+r()*4},.16+r()*.24]);
 }
 ribbonScuffs(root,scratches[0],0x43392e);
 ribbonScuffs(root,scratches[1],0xc9ab7c);
 // Dedicated mutable group is excluded from static instance batching.
 const reactive=new THREE.Group();reactive.name='backlot-reaction-pool';
 root.add(reactive);
 const smokeMat=new THREE.MeshBasicMaterial({color:0xbda078,transparent:true,
  opacity:.12,depthWrite:false,side:THREE.DoubleSide});
 const dust=[];
 for(let i=0;i<12;i++){
  const mote=new THREE.Mesh(new THREE.PlaneGeometry(1,1),smokeMat.clone());
  mote.name='airborne-dust';mote.position.set((r()-.5)*63,
   1+r()*4,(r()-.5)*53);mote.scale.setScalar(1.5+r()*2.9);
  mote.userData.visualOnly=true;reactive.add(mote);
  dust.push({mesh:mote,phase:r()*PI2,speed:.11+r()*.14});
 }
 const impactPool=[];
 const impactMaterial=new THREE.MeshBasicMaterial({
  color:0x42372d,transparent:true,opacity:.58,depthWrite:false,
  polygonOffset:true,polygonOffsetFactor:-1,side:THREE.DoubleSide,
 });
 for(let i=0;i<24;i++){
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(.35,.35),impactMaterial);
  mesh.name='real-cover-impact-scar';mesh.visible=false;mesh.userData.visualOnly=true;
  reactive.add(mesh);impactPool.push(mesh);
 }
 const puffPool=[];
 for(let i=0;i<12;i++){
  const mesh=new THREE.Mesh(new THREE.PlaneGeometry(1,1),
   smokeMat.clone());mesh.name='impact-dirt-puff';
  mesh.visible=false;mesh.userData.visualOnly=true;
  reactive.add(mesh);puffPool.push({mesh,life:0});
 }
 // Scrappy metal strips attached directly to actual barrier faces.
 const hangers=[];
 for(const cover of w.obstacles.filter(x=>/plate|near-|far-|coupling/.test(x.id))){
  const x=(cover.minX+cover.maxX)/2,z=cover.minZ+.055;
  const pivot=new THREE.Group();pivot.position.set(x,cover.height*.83,z);
  pivot.name='impact-rattling-sheet-'+cover.id;reactive.add(pivot);
  cuboid(pivot,'worn-welded-hanging-sheet',Math.min(1.5,(cover.maxX-cover.minX)*.48),
   Math.min(.65,cover.height*.31),.065,0,-.34,0,red);
  hangers.push({id:cover.id,pivot,velocity:0,angle:0});
 }
 root.userData.backlotReactivity={time:0,dust,impactPool,puffPool,
  scarIndex:0,puffIndex:0,hangers};
 return {perimeter,dustMotes:dust.length,coverScars:impactPool.length,
  hitPuffs:puffPool.length,reactiveSheets:hangers.length};
}
export function advanceBacklotTerrain(root,dt){
 const state=root?.userData?.backlotReactivity;
 if(!state||!Number.isFinite(dt))return;
 dt=Math.max(0,Math.min(.06,dt));
 state.time+=dt;
 for(const item of state.dust){
  item.mesh.position.x+=item.speed*dt;
  if(item.mesh.position.x>34)item.mesh.position.x=-34;
  item.mesh.position.y+=Math.sin(state.time*.32+item.phase)*dt*.08;
  item.mesh.material.opacity=.07+.045*(.5+.5*Math.sin(state.time*.3+item.phase));
  item.mesh.rotation.y=state.time*.12+item.phase;
 }
 for(const p of state.puffPool){
  if(p.life<=0)continue;
  p.life-=dt;
  p.mesh.visible=p.life>0;
  p.mesh.material.opacity=Math.max(0,p.life)*.3;
  p.mesh.scale.multiplyScalar(1+dt*.85);
  p.mesh.position.y+=dt*.23;
 }
 for(const sheet of state.hangers){
  sheet.velocity+=-sheet.angle*11*dt;
  sheet.velocity*=Math.exp(-3.6*dt);
  sheet.angle+=sheet.velocity*dt;
  sheet.pivot.rotation.z=sheet.angle;
 }
}
const forward=new THREE.Vector3(0,0,1);
export function recordBacklotCoverStrike(root,contact){
 const state=root?.userData?.backlotReactivity;
 if(!state||!contact?.blockedBy||contact.blockedBy==='floor'||
   !contact.point||!contact.normal)return;
 const p=contact.point,normal=contact.normal;
 const scar=state.impactPool[state.scarIndex++%state.impactPool.length];
 scar.visible=true;scar.position.copy(p).addScaledVector(normal,.055);
 scar.quaternion.setFromUnitVectors(forward,normal.clone().normalize());
 scar.rotateZ(state.scarIndex*2.39);
 scar.scale.setScalar(.75+(state.scarIndex%4)*.23);
 const puff=state.puffPool[state.puffIndex++%state.puffPool.length];
 puff.mesh.visible=true;
 puff.mesh.position.copy(p).addScaledVector(normal,.08);
 puff.mesh.quaternion.copy(scar.quaternion);
 puff.mesh.scale.setScalar(.7);
 puff.mesh.material.opacity=.31;
 puff.life=.56;
 const hanger=state.hangers.find(s=>s.id===contact.blockedBy);
 if(hanger)hanger.velocity+=(state.scarIndex%2?1:-1)*5.4;
}
