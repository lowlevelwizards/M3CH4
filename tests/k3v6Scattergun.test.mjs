import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CATALOG, makeTestAssembly, equip, inspectAssembly, BY_ID, installedPart } from '../components.js';
import { WEAPONS,createWeaponState,fireWeapon,advanceWeapon,startReload,applyRecoil,applyTargetHit,createTargetCondition } from '../combat.js';
import { pelletOffsets, shotContacts } from '../scattergun.js';
import { runScatterStudy,patternAtRange } from '../research/scattergunStudy.mjs';
import { deriveRigConfig } from '../assemblyPhysics.js';
import { createRigState } from '../locomotion.js';
import { basePartValue } from '../partEconomy.js';
const textFile=p=>fs.readFileSync(new URL(p,import.meta.url),'utf8');
const legacy=['frame-sr','legs-yard','legs-hauler','power-dynamo','cab-cyclops','cab-armored',
    'gun-cannon','gun-short','frame-utility','legs-compact','power-air','cab-utility','gun-light','frame-wedge'];
const spec=WEAPONS['gun-scatter'];
function scatterAssembly(){
    const a=makeTestAssembly();equip(a,'combat','gun-scatter');return a;
}
test('scrapyard shotgun adds one physical U1 serial without rewriting fourteen legacy serial definitions',()=>{
    assert.deepEqual(CATALOG.slice(0,14).map(x=>x.id),legacy);
    assert.equal(CATALOG[14].id,'gun-scatter');
    assert.equal(new Set(CATALOG.map(x=>x.id)).size,15);
    const owned=makeTestAssembly().owned;
    assert.equal(owned[14].serial,'SR01-015');
    assert.equal(owned[14].definitionId,'gun-scatter');
    assert.equal(BY_ID.get('gun-scatter').slot,'combat');
    assert.equal(BY_ID.get('gun-scatter').massKg,375);
    assert.equal(BY_ID.get('gun-scatter').powerKw,-12);
    assert.equal(basePartValue('gun-scatter'),1250);
    assert.equal(inspectAssembly(scatterAssembly()).ready,true);
    assert.equal(installedPart(scatterAssembly(),'combat').definition.id,'gun-scatter');
    assert.equal(WEAPONS['gun-cannon'].pellets,undefined,'original cannon stays a single ray');
});
test('one consumed shell produces exactly six unique deterministic independent pellet vectors',()=>{
    assert.equal(spec.pellets,6);
    const gun=createWeaponState(spec);
    const shell=fireWeapon(gun,spec);
    assert.equal(shell,1);
    assert.equal(gun.loaded,spec.magazine-1);
    const first=pelletOffsets(shell,spec),again=pelletOffsets(shell,spec);
    assert.deepEqual(first,again);
    assert.equal(first.length,spec.pellets);
    assert.deepEqual(first[0],[0,0]);
    assert.equal(new Set(first.map(p=>p.map(n=>n.toFixed(7)).join(','))).size,spec.pellets);
    const traced=shotContacts(shell,spec,1,(x,y,index)=>({x,y,index}));
    assert.equal(traced.length,6);
    assert.equal(traced[5].contact.index,5);
    assert.equal(gun.firingCount,1);
    assert.equal(pelletOffsets(3,WEAPONS['gun-short']),null);
});
test('spread loses hits with range because the rays diverge, never because of a hidden damage multiplier',()=>{
    const near=patternAtRange(4),far=patternAtRange(28),medium=patternAtRange(12);
    assert.equal(near.shots,16);
    assert.equal(near.possiblePellets,96);
    assert.ok(near.pelletHits>medium.pelletHits);
    assert.ok(medium.pelletHits>far.pelletHits);
    assert.ok(far.pelletHits>=16,'the near-center ray must remain hittable');
    assert.equal(near.totalNominalDamage,near.pelletHits*spec.damage);
    assert.equal(far.totalNominalDamage,far.pelletHits*spec.damage);
    assert.deepEqual(runScatterStudy(),runScatterStudy());
});
test('each landed pellet exercises original independent armor-then-integrity damage and physical protection',()=>{
    const target=createTargetCondition(makeTestAssembly());
    const before=target.parts.combat;
    const shell=fireWeapon(createWeaponState(spec),spec);
    const pellets=pelletOffsets(shell,spec);
    const maxArmor=before.maxArmor;
    const hits=pellets.map(()=>applyTargetHit(target,'combat',spec.damage));
    assert.equal(hits.length,6);
    assert.equal(target.shotsHit,6,'one shell can make six actual physical hits');
    assert.ok(Math.abs(hits.reduce((n,h)=>n+h.armorAbsorbed,0) - (maxArmor-target.parts.combat.armor))<1e-8);
    assert.equal(hits[0].internalDamage,0,'fresh external plating must stop early fragments');
    assert.ok(hits.every(h=>h.internalDamage>=0&&h.armorAbsorbed>=0));
});
test('heavy recoil, four-shell magazine and three-second reload preserve original cycling rules',()=>{
    assert.ok(spec.recoilImpulseNs>WEAPONS['gun-short'].recoilImpulseNs);
    assert.ok(spec.roundsPerSecond<WEAPONS['gun-short'].roundsPerSecond);
    const gun=createWeaponState(spec);
    for(let i=0;i<spec.magazine;i++){
        assert.notEqual(fireWeapon(gun,spec),null);
        advanceWeapon(gun,spec,1/spec.roundsPerSecond+.001);
    }
    assert.equal(gun.loaded,0);
    assert.equal(fireWeapon(gun,spec),null);
    assert.equal(startReload(gun,spec),true);
    assert.equal(fireWeapon(gun,spec),null);
    advanceWeapon(gun,spec,spec.reloadSeconds+.001);
    assert.equal(gun.loaded,4);
    assert.equal(gun.reserve,spec.spareRounds-4);
    const config=deriveRigConfig(scatterAssembly());
    const rig=createRigState();
    applyRecoil(rig,config,0,-1,spec.recoilImpulseNs);
    assert.ok(Math.hypot(rig.vx,rig.vz)>0);
    assert.ok(rig.recoilLoad>0);
});
test('both player and AI share physical six-ray traces but only one ammo/recoil/sound/power event per shell',()=>{
    const main=textFile('../main.js'),scene=textFile('../scene.js'),audio=textFile('../audio.js');
    assert.match(main,/shotContacts\(shot,weaponSpec,degradedSpread/);
    assert.match(main,/shotContacts\(shotIndex,actor\.weaponSpec/);
    assert.match(main,/arena\.traceShot\(baseX\+x,baseY\+y,weaponSpec\.muzzleZ\)/);
    assert.match(main,/arena\.traceCombatantShot\(actor\.id,target\.id,aimSlot/);
    assert.match(main,/function resolvePlayerShotContact\(contact,damage/);
    assert.match(main,/function resolveAiShotContact\(actor,target,contact,damage/);
    assert.match(main,/applyAiHitToPlayer\(actor, contact, damage/);
    assert.match(main,/shotContacts\(shotIndex/);
    assert.match(main,/if\(multi\)soundScatter\(\);else soundFire\(\)/);
    assert.match(main,/registerPowerShot\(playerPower, assembly\)/);
    assert.match(main,/registerPowerShot\(actor\.powerSystem, actor\.assembly\)/);
    assert.match(scene,/case 'gun-scatter'/);
    assert.match(scene,/weaponId==='gun-scatter'/);
    assert.match(scene,/scatterGreebles\.visible=scatter/);
    assert.match(audio,/export function soundScatter\(\)/);
});
