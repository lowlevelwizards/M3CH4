import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { makeTestAssembly,equip,inspectAssembly,CATALOG } from '../components.js';
import { SCREEN_DIMENSIONS,COCKPIT_PROFILES,resolveCockpitProfile,auditCockpitLayouts,
    cockpitFailurePresentation } from '../cockpitProfiles.js';
import { drawCockpitChannel,drawDimensionAudit } from '../cockpitDisplays.js';
const ids=['cab-cyclops','cab-utility','cab-armored'];
const channels=['systems','weapon','team','motion','drive'];
function mockScreen(channel){
    const [width,height]=SCREEN_DIMENSIONS[channel];
    const labels=[];
    const context={
        fillStyle:null,strokeStyle:null,lineWidth:0,globalAlpha:1,textAlign:'left',
        clearRect(){},fillRect(){},strokeRect(){},
        fillText(value,x,y){labels.push({value:String(value),x,y});},
    };
    return {canvas:{width,height},ctx:context,texture:{needsUpdate:false},labels};
}
const data={
    systems:{structure:100,mobility:92,power:78,command:36,combat:45},
    weapon:'STUMP CANNON',ammo:'8/48',weaponState:'PWR SAG',
    team:{friendly:2,hostile:1},
    speed:6.4,direction:'FWD',turnRate:28,slip:.43,footing:.88,recoil:.31,brace:0,
    driveLoad:.72,power:{busRatio:.76,reserveFraction:.34,generationKw:94,demandKw:122},
};
test('three cockpit IDs match original serialized command modules and keep their factory ratings',()=>{
    assert.deepEqual(CATALOG.filter(x=>x.slot==='command').map(x=>x.id),
        ['cab-cyclops','cab-armored','cab-utility']);
    for(const id of ids){
        const a=makeTestAssembly();
        equip(a,'command',id);
        assert.equal(inspectAssembly(a).ready,true,id);
        assert.equal(resolveCockpitProfile(id).id,id);
    }
    assert.equal(resolveCockpitProfile('unknown').id,'cab-cyclops');
    assert.deepEqual(Object.keys(COCKPIT_PROFILES).sort(),[...ids].sort());
});
test('each layout fits the existing 68 degree camera combiner and has no overlapping or target-center panels',()=>{
    const results=auditCockpitLayouts();
    assert.equal(results.length,3);
    for(const r of results)assert.deepEqual(r.violations,[],r.id+': '+r.violations.join(', '));
    assert.notDeepEqual(results[0].rects,results[1].rects);
    assert.notDeepEqual(results[1].rects,results[2].rects);
    for(const profile of Object.values(COCKPIT_PROFILES))
        assert.deepEqual(Object.keys(profile.layout).sort(),channels.slice().sort());
});
test('corrected instrument textures physically contain all authored lines',()=>{
    const dims=drawDimensionAudit();
    assert.ok(dims.motionMaxY<dims.motionHeight);
    assert.ok(dims.driveMaxY<dims.driveHeight);
    assert.ok(dims.originalClippedMotionY>dims.originalMotionHeight);
    assert.ok(dims.originalClippedDriveY>dims.originalDriveHeight);
    for(const name of channels){
        const [w,h]=SCREEN_DIMENSIONS[name];
        assert.ok(w>=80&&h>=40);
    }
});
test('each cab produces unique layouts and instrument language from the same true telemetry',()=>{
    const readings=[];
    for(const id of ids){
        const profile=resolveCockpitProfile(id),rendered={};
        for(const channel of channels){
            const screen=mockScreen(channel);
            drawCockpitChannel(screen,channel,data,profile,cockpitFailurePresentation(.36,.78,.76));
            assert.ok(screen.texture.needsUpdate,channel);
            assert.ok(screen.labels.length>0,id+':'+channel);
            for(const item of screen.labels){
                assert.ok(item.x>=0&&item.x<=screen.canvas.width,item.value+': x outside '+channel);
                assert.ok(item.y>=0&&item.y<=screen.canvas.height,item.value+': y outside '+channel);
            }
            rendered[channel]=screen.labels.map(e=>e.value).join(' | ');
        }
        assert.ok(rendered.weapon.includes('8/48'),id);
        assert.ok(rendered.drive.includes('94')&&rendered.drive.includes('122'),id);
        assert.ok(rendered.motion.includes('6.4'),id);
        assert.ok(rendered.systems.includes('36'),id);
        readings.push(rendered);
    }
    assert.notDeepEqual(readings[0],readings[1]);
    assert.notDeepEqual(readings[1],readings[2]);
    assert.match(readings[0].systems,/CYCLOPS/);
    assert.match(readings[1].systems,/VISTA/);
    assert.match(readings[2].systems,/HEARTH/);
});
test('real brownout and command damage drive cosmetic faults without inventing failures',()=>{
    const healthy=cockpitFailurePresentation(1,1,1);
    const damaged=cockpitFailurePresentation(.25,.50,.71);
    assert.equal(healthy.staticStrength,0);
    assert.equal(healthy.busSag,false);
    assert.ok(damaged.staticStrength>healthy.staticStrength);
    assert.equal(damaged.commandSevere,true);
    assert.equal(damaged.busSag,true);
    assert.deepEqual(cockpitFailurePresentation(1,1,1),healthy);
    for(const p of Object.values(COCKPIT_PROFILES)){
        const screen=mockScreen('weapon');
        drawCockpitChannel(screen,'weapon',{...data,weaponState:'READY'},p,damaged);
        assert.ok(screen.labels.some(label=>label.value==='READY'),
            'cosmetic damage must not replace actual weapon readiness');
    }
});
test('scene bridge uses real command fitting, only one active physical kit, and does not affect gameplay controls',()=>{
    const src=f=>fs.readFileSync(new URL(f,import.meta.url),'utf8');
    const bridge=src('../sceneAssembly.js'),kit=src('../cockpitIdentityScene.js'),main=src('../main.js');
    assert.match(bridge,/installCockpitIdentities\(arena, assembly\)/);
    assert.match(bridge,/cockpitIdentity\.apply\(next\)/);
    assert.match(kit,/installedPart\(assembly,'command'\)/);
    assert.match(kit,/kit\.visible=id===current\.id/);
    assert.match(kit,/screen\.canvas\.height=h/);
    assert.match(kit,/updateBaseInstruments\(data\)/);
    assert.match(kit,/lastInstrumentKey=lastMotionKey=''/);
    assert.match(main,/arena\.rebuildAssembly\(assembly\)/);
    assert.match(main,/arena\.updateCockpitMotion/);
    assert.match(main,/arena\.updateCockpitInstruments/);
    assert.doesNotMatch(kit,/localStorage|applyTargetHit|fireWeapon|stepRig/);
    assert.match(kit,/triggerBase\(slot,profile\)/);
    assert.match(kit,/const penetrating=Number\(profile\.internalDamage\)>0/);
});
