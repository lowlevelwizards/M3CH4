import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {STANCES,STANCE_IDS,GAIT,calculateKestrelPose}
 from '../research/kestrelSilhouetteKinematics.js';
import {SILHOUETTE_PRESETS,TUNABLES,candidateById,deriveSilhouette,clampParameter}
 from '../research/kestrelSilhouetteDesign.js';
import {ARMOR_LEVELS,ENCASED_FORMS,ARMOR_ANATOMY,ARMOR_ZONES,armorRecipe,normalizeArmorSettings}
 from '../research/kestrelArmorSpec.js';
const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');

test('three fresh birdlike silhouettes have genuinely independent mechanical proportions',()=>{
 assert.deepEqual(SILHOUETTE_PRESETS.map(p=>p.id),['raptor','field','perch']);
 assert.equal(new Set(SILHOUETTE_PRESETS.map(p=>p.kneeOffset)).size,3);
 assert.equal(new Set(SILHOUETTE_PRESETS.map(p=>p.thighShare)).size,3);
 assert.equal(new Set(SILHOUETTE_PRESETS.map(p=>p.footSize)).size,3);
 assert.equal(new Set(SILHOUETTE_PRESETS.map(p=>p.hipSpan)).size,3);
 assert.ok(SILHOUETTE_PRESETS.every(p=>Object.isFrozen(p)));
});
test('all variants have real compact fit, matching U1 and grounded feet',()=>{
 for(const preset of SILHOUETTE_PRESETS){
  const p=deriveSilhouette(preset);
  assert.deepEqual(p.mount,[0,.775,0]);
  assert.equal(p.floor,-.775);
  assert.ok(p.isNominalWidth);
  assert.ok(p.fullSpan<1.67);
  assert.equal(p.legs.length,2);
  assert.ok(p.footWidth<.40);
  for(const leg of p.legs){
   assert.ok(leg.knee[2]-leg.hip[2]>.24,'signature birdlike rear knee');
   assert.ok(leg.knee[2]-leg.ankle[2]>.35,'forward-sweeping shin');
   assert.ok(leg.hip[1]>leg.knee[1]&&leg.knee[1]>leg.ankle[1]);
   assert.ok(Math.abs((leg.foot[1]-p.footHeight/2)-p.floor)<1e-9);
  }
  for(const joint of ['hip','knee','ankle','foot']){
   assert.ok(p.legs.every(l=>l[joint].every(Number.isFinite)));
  }
 }
});
test('editing one prototype is independent and never changes immutable defaults',()=>{
 const a=candidateById('raptor'),b=candidateById('field');
 const before=deriveSilhouette(b).fullSpan;
 a.hipSpan=clampParameter('hipSpan',1.06);
 assert.equal(deriveSilhouette(b).fullSpan,before);
 assert.equal(candidateById('raptor').hipSpan,.82);
 assert.equal(clampParameter('footSize',22),TUNABLES.footSize.max);
 assert.equal(clampParameter('thighMass',-.1),TUNABLES.thighMass.min);
 assert.throws(()=>clampParameter('NO',4),/Unknown/);
});
test('Kestrel prototype stays outside playable registry; one deliberate casting and toe design per candidate',()=>{
 const geom=read('../research/kestrelSilhouetteGeometry.js');
 const js=read('../research/kestrelSilhouetteLab.js');
 const html=read('../kestrel-silhouette.html');
 const index=read('../index.html');
 const registry=read('../partVisuals.js');
 assert.match(geom,/single swept thigh/);
 assert.match(geom,/primary forward shin/);
 assert.match(geom,/sharp field talon/);
 assert.match(geom,/split traction toe/);
 assert.match(geom,/wide perching toe/);
 assert.match(geom,/new THREE\.CylinderGeometry/);
 assert.match(js,/buildExteriorRig\(makeTestAssembly\(\)\)/);
 assert.match(js,/createArticulatedKestrel/);
 assert.match(js,/selected:'raptor'/);
 assert.doesNotMatch(js,/selected:'strider'/);
 assert.doesNotMatch(geom,/buildKestrelVisual|armorTier:3|addArmorToLeg/);
 assert.doesNotMatch(registry,/kestrelSilhouetteGeometry|kestrelSilhouetteDesign/);
 assert.match(registry,/'legs-compact': buildKestrelVisual/);
 assert.match(index,/id="kestrel-silhouette-open"/);
 assert.match(html,/src="\.\/research\/kestrelSilhouetteLab\.js"/);
 assert.doesNotMatch(html,/src="\.\/research\/yardwalkerSilhouetteLab\.js"/);
 assert.match(html,/data-id="raptor"/);
 assert.match(html,/data-id="field"/);
 assert.match(html,/data-id="perch"/);
 assert.match(html,/id="full-rig"/);
 assert.match(html,/id="legs-only"/);
 assert.match(html,/id="arena"/);
 assert.match(html,/id="silhouette"/);
 assert.match(html,/id="focus"/);
 assert.match(html,/data-armor-tier="3"/);
 assert.match(html,/id="boot-plate"/);
 // The playable registry remains the original production Kestrel.
 assert.doesNotMatch(registry,/kestrelSilhouetteArmor|kestrelArmorSpec/);
});

test('three stance treatments preserve rigid link lengths and ground each foot',()=>{
 assert.deepEqual(STANCE_IDS,['perched','balanced','crouched']);
 for(const candidate of SILHOUETTE_PRESETS){
  const source=deriveSilhouette(candidate);
  const base=calculateKestrelPose(source,{stance:'balanced'});
  // Reparenting to articulated groups must not change Naked rest vertices.
  for(let i=0;i<2;i++){
   for(const joint of ['hip','knee','ankle','foot'])
    for(let n=0;n<3;n++)
     assert.ok(Math.abs(base.joints[i][joint][n]-source.legs[i][joint][n])<1e-7,
      candidate.id+' rest geometry '+joint+'/'+n);
  }
  for(const stance of STANCE_IDS){
   for(const phase of [0,.025,.12,.25,.35,.5,.53,.65,.85,.99,1]){
    const result=calculateKestrelPose(source,{stance,motion:'walk',phase});
    assert.equal(result.stance,stance);
    assert.ok(result.maxReachError<.00001,
     candidate.id+'/'+stance+'/'+phase+' reach '+result.maxReachError);
    assert.ok(result.joints.every(j=>j.reachable));
    for(const joint of result.joints){
     const a=joint.hip,b=joint.knee,c=joint.ankle;
     const upper=Math.hypot(b[1]-a[1],b[2]-a[2]);
     const lower=Math.hypot(c[1]-b[1],c[2]-b[2]);
     assert.ok(Math.abs(upper-joint.upperLength)<1e-6,'fixed thigh');
     assert.ok(Math.abs(lower-joint.lowerLength)<1e-6,'fixed shin');
     assert.ok(joint.footLift>=-1e-9,'foot cannot penetrate floor');
     assert.ok(Math.abs(joint.worldFoot[1]-joint.footLift-source.legs[joint.side<0?0:1].foot[1])<1e-6);
    }
   }
  }
 }
});
test('treadmill step loop has identical limb-local endpoints and firmly planted support feet',()=>{
 for(const p of SILHOUETTE_PRESETS){
  const source=deriveSilhouette(p);
  const start=calculateKestrelPose(source,{motion:'walk',phase:0});
  const end=calculateKestrelPose(source,{motion:'walk',phase:1});
  for(let i=0;i<2;i++){
   for(const j of ['hip','knee','ankle','foot'])
    assert.ok(start.joints[i][j].every((c,k)=>Math.abs(c-end.joints[i][j][k])<1e-6),
     p.id+' seamless gait endpoint '+j);
  }
  const before=calculateKestrelPose(source,{motion:'walk',phase:.48});
  const after=calculateKestrelPose(source,{motion:'walk',phase:.51});
  // Right foot is the support during first half; its world contact doesn't move.
  assert.ok(Math.abs(before.joints[1].worldFoot[2]-after.joints[1].worldFoot[2])<1e-7);
  assert.equal(before.joints[1].footLift,0);
  assert.equal(after.joints[1].footLift,0);
 }
 assert.ok(GAIT.stride>0&&GAIT.lift>0);
});
test('V2 controls and articulated module remain lab-only, with compare and scrub UI',()=>{
 const js=read('../research/kestrelSilhouetteLab.js');
 const html=read('../kestrel-silhouette.html');
 const kinematics=read('../research/kestrelSilhouetteKinematics.js');
 const geom=read('../research/kestrelSilhouetteMotion.js');
 const registry=read('../partVisuals.js');
 for(const id of ['compare-designs','compare-stances','stance-perched',
  'stance-balanced','stance-crouched','mode-stand','mode-walk',
  'mode-inspect','toggle-play','gait-speed','gait-phase','pose-status'])
  assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(js,/calculateKestrelPose|\.study\.pose/);
 assert.match(js,/displayFor/);
 assert.match(geom,/createArticulatedKestrel/);
 assert.match(geom,/attachPiece\(thigh,mesh\)/);
 assert.match(kinematics,/solveRearHock/);
 assert.doesNotMatch(registry,/kestrelSilhouetteMotion|kestrelSilhouetteKinematics/);
});

test('Kestrel 0/1/2/3 build physically distinct and removable armor inventories',()=>{
 assert.deepEqual(ARMOR_LEVELS.map(l=>l.tier),[0,1,2,3]);
 assert.deepEqual(ENCASED_FORMS.map(f=>f.id),['swept','pod','split']);
 assert.equal(Object.keys(ARMOR_ANATOMY).length,3);
 for(const preset of SILHOUETTE_PRESETS){
  const none=armorRecipe(preset.id,{tier:0});
  assert.equal(none.parts.length,0,'Naked remains untouched');
  const light=armorRecipe(preset.id,{tier:1});
  assert.equal(light.parts.length,4);
  assert.deepEqual(light.parts.map(p=>p.zone).sort(),['shin','shin','thigh','thigh']);
  assert.ok(light.parts.every(p=>p.role==='front'));
  const heavy=armorRecipe(preset.id,{tier:2});
  assert.equal(heavy.parts.length,10);
  assert.ok(heavy.parts.filter(p=>p.zone==='hip').length===2);
  assert.ok(heavy.parts.filter(p=>p.role==='side').length===4);
  for(const form of ENCASED_FORMS.map(f=>f.id)){
   const encased=armorRecipe(preset.id,{tier:3,form,boot:true});
   assert.equal(encased.parts.filter(p=>p.zone==='foot').length,2);
   assert.equal(encased.parts.filter(p=>p.role==='shell').length,form==='split'?4:2);
   assert.equal(encased.parts.length,form==='split'?12:10);
   assert.ok(encased.parts.every(p=>ARMOR_ZONES.includes(p.zone)));
   assert.equal(armorRecipe(preset.id,{tier:3,form,boot:false}).parts.length,
    encased.parts.length-2);
  }
 }
 assert.notEqual(ARMOR_ANATOMY.raptor.flare,ARMOR_ANATOMY.perch.flare);
 assert.ok(ARMOR_ANATOMY.field.heavy>ARMOR_ANATOMY.raptor.heavy);
 assert.equal(normalizeArmorSettings({tier:12,form:'invalid'}).tier,3);
 assert.equal(normalizeArmorSettings({tier:12,form:'invalid'}).form,'swept');
 assert.throws(()=>armorRecipe('yardwalker',{tier:3}),/Unknown Kestrel/);
});
test('Kestrel armor geometry stays independent, follows rigid bones and never registers combat armor',()=>{
 const code=read('../research/kestrelSilhouetteArmor.js');
 const lab=read('../research/kestrelSilhouetteLab.js');
 const html=read('../kestrel-silhouette.html');
 const registry=read('../partVisuals.js');
 const live=read('../research/kestrelSilhouetteMotion.js');
 for(const phrase of ['enclosureGeometry','plateGeometry','mountOn','limb.thigh',
  'limb.shin','limb.foot','experimentalOnly','armorZone','present','dispose'])
  assert.ok(code.includes(phrase),phrase);
 for(const id of ['compare-armor','armor-only','armor-explode','armor-reset-view','encased-form',
  'boot-plate','armor-description'])
  assert.match(html,new RegExp('id="'+id+'"'));
 for(const tier of [0,1,2,3])assert.match(html,new RegExp('data-armor-tier="'+tier+'"'));
 for(const zone of ARMOR_ZONES)assert.match(html,new RegExp('data-armor-zone="'+zone+'"'));
 assert.match(lab,/installKestrelArmor/);
 assert.match(lab,/state\.comparison==='armor'/);
 assert.match(lab,/rig\.armor\.present/);
 assert.match(lab,/armorTier:state\.armorTier/);
 assert.doesNotMatch(live,/installKestrelArmor|addArmorToLeg/);
 assert.doesNotMatch(registry,/kestrelSilhouetteArmor|kestrelArmorSpec/);
});
