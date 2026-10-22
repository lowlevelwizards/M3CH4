/** Build 5 weapon role audit: real first-hit meshes, never theoretical DPS as hit proof.
 * Requires temporary Three.js 0.186.0 for Node CI.
 * node research/weaponRoleContactAudit.mjs [--json] [--assert]
 */
import * as THREE from 'three';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { makeTestAssembly, equip, inspectAssembly } from '../components.js';
import { WEAPONS,shotSpread,createTargetCondition,applyTargetHit } from '../combat.js';
import { pelletOffsets } from '../scattergun.js';
import { buildExteriorRig } from '../scene.js';

const FRAMES=['frame-sr','frame-utility','frame-wedge'];
const RANGES=[3,5,8,12,20,30];
const AIM=['command','power','mobility'];
const SHOTS=16;
function asTarget(frame){
    const assembly=makeTestAssembly();
    equip(assembly,'structure',frame);equip(assembly,'combat','gun-short');
    assert.equal(inspectAssembly(assembly).ready,true,frame);
    return {assembly,model:buildExteriorRig(assembly)};
}
function auditContacts(assembly,model,spec,range,aimSlot){
    model.root.position.set(0,0,-range);
    model.root.updateMatrixWorld(true);
    const aim=new THREE.Box3().setFromObject(model.partGroups.get(aimSlot))
        .getCenter(new THREE.Vector3());
    const origin=new THREE.Vector3(0,2.03,0);
    const forward=aim.clone().sub(origin).normalize();
    const right=new THREE.Vector3().crossVectors(forward,new THREE.Vector3(0,1,0)).normalize();
    const up=new THREE.Vector3().crossVectors(right,forward).normalize();
    const ray=new THREE.Raycaster();ray.far=70;
    const condition=createTargetCondition(assembly);
    const firstHits={};
    let rays=0,miss=0,aimHits=0,armor=0,internal=0,structureFirst=0;
    for(let shot=1;shot<=SHOTS;shot++){
        const offsets=spec.pellets>1?pelletOffsets(shot,spec):[shotSpread(shot,spec.spread)];
        for(const [u,v] of offsets){
            const vec=forward.clone().addScaledVector(right,u).addScaledVector(up,v).normalize();
            ray.set(origin,vec);
            const h=ray.intersectObjects(model.pickMeshes,false)[0];
            rays++;
            if(!h){miss++;continue;}
            const struck=h.object.userData.slot;
            if(!struck){miss++;continue;}
            firstHits[struck]=(firstHits[struck]||0)+1;
            if(struck==='structure' && aimSlot!=='structure')structureFirst++;
            if(struck===aimSlot)aimHits++;
            // The same armor-first module condition code used in the game.
            const response=applyTargetHit(condition,struck,spec.damage);
            armor+=response.armorAbsorbed;
            internal+=response.internalDamage;
        }
    }
    return {frame:assembly.installed.structure,weapon:spec.id,damagePerProjectile:spec.damage,
        rangeM:range,aimSlot,shots:SHOTS,rays,miss,
        aimHits,frameFirst:structureFirst,firstHits,
        armorRemoved:Math.round(armor*100)/100,
        internalDamage:Math.round(internal*100)/100,
        totalHitRays:rays-miss};
}
export function runWeaponRoleContactAudit(){
    const rows=[];
    for(const frame of FRAMES){
        const {assembly,model}=asTarget(frame);
        for(const spec of Object.values(WEAPONS)){
            const variants=spec.id==='gun-cannon'?
                [spec,{...spec,id:'gun-cannon:spread-0033',spread:.0033}]:
                spec.id==='gun-scatter'?
                [spec,{...spec,id:'gun-scatter:18',damage:18},{...spec,id:'gun-scatter:16',damage:16}]:
                [spec];
            for(const trial of variants)for(const range of RANGES)for(const aimSlot of AIM){
                rows.push(auditContacts(assembly,model,trial,range,aimSlot));
            }
        }
        model.root.traverse(node=>{
            if(!node.isMesh)return;
            node.geometry?.dispose();
            const mats=Array.isArray(node.material)?node.material:[node.material];
            mats.forEach(m=>m?.dispose?.());
        });
    }
    return {schemaVersion:1,evidence:'actual same-model first-hit Three.js rays + armor-first damage',
        limitations:'fixed-stationary exact module-center aim; not moving accuracy, AI aim competence, pilot recoil, or mobile feel',
        ranges:RANGES,shellsPerCohort:SHOTS,rows};
}
export function verifyWeaponRoleContactAudit(report=runWeaponRoleContactAudit()){
    assert.equal(report.rows.length,FRAMES.length*RANGES.length*AIM.length*7);
    for(const row of report.rows){
        assert.equal(Object.values(row.firstHits).reduce((a,b)=>a+b,0)+row.miss,row.rays);
        assert.ok(row.aimHits>=0&&row.aimHits<=row.totalHitRays);
        assert.ok(row.armorRemoved>=0&&row.internalDamage>=0);
        assert.ok(row.rays===SHOTS*(row.weapon.startsWith('gun-scatter')?6:1));
    }
    const near=report.rows.filter(r=>r.weapon==='gun-scatter'&&r.rangeM===3)
        .reduce((n,r)=>n+r.totalHitRays,0);
    const far=report.rows.filter(r=>r.weapon==='gun-scatter'&&r.rangeM===30)
        .reduce((n,r)=>n+r.totalHitRays,0);
    assert.ok(near>far,'actual six-pellet rays must spread with distance');
    return report;
}
export function formatWeaponRoleContactAudit(report=runWeaponRoleContactAudit()){
    const groups=Object.values(WEAPONS).map(spec=>{
        const rows=report.rows.filter(r=>r.weapon===spec.id);
        const mean=rows.reduce((n,r)=>n+r.aimHits/r.rays,0)/Math.max(1,rows.length);
        return {weapon:spec.id,directFraction:Math.round(mean*1000)/1000,
            armor:Math.round(rows.reduce((n,r)=>n+r.armorRemoved,0)),
            internals:Math.round(rows.reduce((n,r)=>n+r.internalDamage,0))};
    });
    return ['# Build 5 / Current 15-part actual mesh contact comparison','',
        'Results are sampled central-aim real geometry, not win-rate, recoil recovery, AI skill, or fictional damage falloff.','',
        '| Weapon | Direct aim-slot fraction | Total armor removed | Total internal damage |',
        '| --- | ---: | ---: | ---: |',
        ...groups.map(x=>'| '+[x.weapon,x.directFraction,x.armor,x.internals].join(' | ')+' |'),''].join('\n');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const r=runWeaponRoleContactAudit();
 if(process.argv.includes('--assert'))verifyWeaponRoleContactAudit(r);
 process.stdout.write(process.argv.includes('--json')?JSON.stringify(r,null,2)+'\n':formatWeaponRoleContactAudit(r));
}
