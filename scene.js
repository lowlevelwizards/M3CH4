import * as THREE from 'three';
import { canvasFont, whenGameFontsReady } from './typography.js';
import {partMaterial,materialRoleOf} from './partMaterialPalette.js';
import { applyPartFinish } from './partFinish.js';
import {applyIndustrialFinish} from './industrialMaterialSystem.js';
import {createSurfaceScarRenderer} from './surfaceDamageRenderer.js?v=k4z1';
import {physicalFailurePose} from './surfaceDamageLanguage.js';
import {familyFailureAnatomy,conditionFailureFlags} from './familyFailureAnatomy.js';
import {machineWoundPose,recoveryMotion} from './woundedMachine.js';
import {physicalContactWeight} from './physicalContactWeight.js';
import {moduleFailureSignature,failureSurfaceFactor} from './moduleFailureSignatures.js';
import {addPhysicalServiceStamp} from './serviceEvidenceVisuals.js';
import {addFactoryIdentityPlate} from './factoryIdentityVisuals.js';
import {addRigCrewPlate} from './rigCrewVisuals.js';
import {serviceBayFocus} from './serviceBayVisualRules.js';
import {createYardGroundTexture,createWorkshopFloorTexture} from './artStyleProcedural.js';
import {lightingProfile} from './visualLightingLanguage.js';
import {backlotGroundTexture,setBacklotOpenSky,buildBacklotDerbyWorld} from './backlotDerbyWorld.js?v=k5s2';
import {advanceBacklotTerrain,recordBacklotCoverStrike} from './backlotEnvironmentPass.js';
import { normalizePaint } from './factoryPaint.js';
import { buildPartVisual } from './partVisuals.js?v=k4w4';
import {footTrajectory,legPose,familyAnimation,aimArticulation,reloadArticulation} from './articulationMotion.js';
import {attachReloadHardware,poseReloadHardware,poseExistingReloadMagazine} from './weaponVisualKit.js';
import {reloadMechanism,reloadCockpitPresentation} from './reloadMechanism.js';
import {WEAPONS} from './combat.js';
import {advanceFootContacts,createFootContacts,footPresentation,registerFootImpact} from './footContactController.js?v=k5r5';
import { framingOffsetWorld, orbitAzimuthAfterDrag, panInRigSpace } from './inspectionCamera.js';
import { physicsYawToViewYaw } from './locomotion.js';
import {BACKLOT} from './maps/backlot.js?v=k5q2';
import {venueFloorTexture,buildVenueDressing} from './maps/venueVisuals.js';
import { BY_ID, installedPart, SLOT_CENTERS, SLOTS } from './components.js';
import { impactProfile, integrityRatio, persistentFailureProfile } from './damageVisuals.js';
import { combinerTetherFromLook } from './cockpitView.js';
import { firstCoverHit } from './coverTruth.js';
import { muzzleRayFallsShort } from './barrelAimObstruction.js';
import { locallyBlockedMuzzle } from './barrelHudClearance.js';
import { rocketFlightStep } from './projectileSimulation.js';
import { blastDamage } from './explosionResolution.js';
import { createFiringEventState, triggerFiringEvent, advanceFiringEvent, firingProfile } from './firingEvent.js';
import { createHitResponse, injectHitResponse, advanceHitResponse, hitMaterialLanguage } from './hitResponse.js';
import {nearMissEvidence,coverStrikeLanguage,soundBearing,coverProximity} from './battlefieldPressure.js';
import {soundBattlefieldEvent} from './audio.js';
import { shieldedModuleOnRay } from './frameShielding.js';
const C = {
    concrete: 0x777267, concreteDark: 0x4d4b45,
    yellow: 0xa9822f, teal: 0x2f7473, metal: 0x343a39,
    dark: 0x151816, rust: 0x8a4d2d, amber: 0xe0a44c, green: 0x6ea778,
};

const partThumbnailCache = new Map();
const rigThumbnailCache = new Map();
let partThumbnailRenderer = null;
function disposePreviewObject(root) {
    root.traverse(object => {
        if (!object.isMesh) return;
        object.geometry?.dispose?.();
        const materials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of materials) material?.dispose?.();
    });
}
/** Render the same authored gameplay mesh used in the arena into a cached visual
 * inventory card. Condition is quantized so a phone never grows an unbounded cache. */
export function partThumbnailDataUrl(definitionId, state = {}) {
    if (typeof document === 'undefined') return null;
    const definition = BY_ID.get(definitionId);
    if (!definition) return null;
    const condition = Math.max(0, Math.min(1, Number(state.condition) || 0));
    const destroyed = !!state.destroyed || state.status === 'destroyed';
    const key = `k4a:${definitionId}:${state.serial||'PREVIEW'}:${destroyed ? 'x' : Math.round(condition * 10)}:${Math.round((state.wear||0)*20)}:${state.repairs||0}:${state.history?.deployments||0}:${JSON.stringify(normalizePaint(state.paint))}`;
    if (partThumbnailCache.has(key)) return partThumbnailCache.get(key);
    if (!partThumbnailRenderer) {
        partThumbnailRenderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, preserveDrawingBuffer: true, powerPreference: 'low-power' });
        partThumbnailRenderer.outputColorSpace = THREE.SRGBColorSpace;
        partThumbnailRenderer.toneMapping = THREE.ACESFilmicToneMapping;
        partThumbnailRenderer.toneMappingExposure = 1.18;
        partThumbnailRenderer.setSize(96, 72, false);
        partThumbnailRenderer.setPixelRatio(1);
    }
    const serial = typeof state.serial==='string'&&state.serial ? state.serial : 'PREVIEW-001';
    const assembly = { serial: 'PREVIEW', name: 'PREVIEW',
        owned: [{ serial, definitionId, condition: (Number.isFinite(state.condition)?Math.max(0,Math.min(1,state.condition)):1),
            wear:Math.max(0,Math.min(1,Number(state.wear)||0)),
            repairs:Math.max(0,Math.floor(Number(state.repairs)||0)),paint:normalizePaint(state.paint) }],
        installed: { [definition.slot]: serial },
        partHistory:state.history?{[serial]:state.history}:{} };
    const exterior = buildExteriorRig(assembly);
    exterior.root.position.set(-definition.center[0], -definition.center[1], -definition.center[2]);
    const damageTint = new THREE.Color(0x6f2d24);
    for (const mesh of exterior.pickMeshes) {
        const material = mesh.material;
        if (!(material instanceof THREE.MeshStandardMaterial)) continue;
        if (destroyed) {
            material.color.multiplyScalar(.09);
            material.emissive.setHex(0);
        } else if (condition < .999) {
            const severity = 1 - condition;
            material.color.lerp(damageTint, Math.min(.48, severity * .46));
            material.color.multiplyScalar(Math.max(.42, 1 - severity * .36));
            if (condition <= .001) { material.emissive.setHex(0x3b130b); material.emissiveIntensity = .28; }
        }
    }
    const previewScene = new THREE.Scene();
    previewScene.background = new THREE.Color(0x0b100e);
    previewScene.add(exterior.root);
    previewScene.add(new THREE.HemisphereLight(0xa6b9ad, 0x201c18, .78));
    const keyLight = new THREE.DirectionalLight(0xffd49a, 2.5); keyLight.position.set(-4, 6, 5); previewScene.add(keyLight);
    const rim = new THREE.DirectionalLight(0x78aaa5, 1.1); rim.position.set(4, 2, -5); previewScene.add(rim);
    const bounds = new THREE.Box3().setFromObject(exterior.root);
    const sphere = bounds.getBoundingSphere(new THREE.Sphere());
    const camera = new THREE.PerspectiveCamera(36, 96 / 72, .03, 40);
    const radius = Math.max(.35, sphere.radius);
    // Weapon geometry points toward -Z; show muzzle/action, not the rear of the receiver.
    camera.position.set(radius * 1.65, radius * .92,
        definition.slot==='combat'?-radius*2.25:radius*2.25);
    camera.lookAt(0, 0, 0);
    partThumbnailRenderer.render(previewScene, camera);
    const url = partThumbnailRenderer.domElement.toDataURL('image/png');
    partThumbnailCache.set(key, url);
    disposePreviewObject(exterior.root);
    return url;
}
/** Tiny cached three-quarter image of an actual five-part assembly, used by
 * the three paint distributions. No gameplay rig, camera or state is mutated. */
export function rigThumbnailDataUrl(assembly){
    if(typeof document==='undefined'||!assembly)return null;
    const key=JSON.stringify({
        installed:assembly.installed,
        paint:(assembly.owned||[]).filter(p=>Object.values(assembly.installed||{}).includes(p.serial))
            .map(p=>[p.serial,p.definitionId,normalizePaint(p.paint),
                Math.round((p.wear||0)*20),p.repairs||0,
                assembly.partHistory?.[p.serial]?.deployments||0]),
    });
    if(rigThumbnailCache.has(key))return rigThumbnailCache.get(key);
    // Keep browser cache bounded when people tune pigments continuously.
    if(rigThumbnailCache.size>=45)rigThumbnailCache.clear();
    if(!partThumbnailRenderer){
        partThumbnailRenderer=new THREE.WebGLRenderer({antialias:false,alpha:true,
            preserveDrawingBuffer:true,powerPreference:'low-power'});
        partThumbnailRenderer.outputColorSpace=THREE.SRGBColorSpace;
        partThumbnailRenderer.toneMapping=THREE.ACESFilmicToneMapping;
        partThumbnailRenderer.toneMappingExposure=1.18;
        partThumbnailRenderer.setSize(96,72,false);
        partThumbnailRenderer.setPixelRatio(1);
    }
    const visual=buildExteriorRig(assembly);
    const stage=new THREE.Scene();
    stage.background=new THREE.Color(0x0b100e);
    stage.add(visual.root);
    stage.add(new THREE.HemisphereLight(0xa6b9ad,0x201c18,.8));
    const light=new THREE.DirectionalLight(0xffd49a,2.5);light.position.set(-4,6,5);stage.add(light);
    const rim=new THREE.DirectionalLight(0x78aaa5,1.1);rim.position.set(4,2,-5);stage.add(rim);
    const box=new THREE.Box3().setFromObject(visual.root);
    const sphere=box.getBoundingSphere(new THREE.Sphere());
    visual.root.position.sub(sphere.center);
    const radius=Math.max(.35,sphere.radius);
    const camera=new THREE.PerspectiveCamera(36,96/72,.03,60);
    camera.position.set(radius*1.55,radius*.86,radius*2.4);
    camera.lookAt(0,0,0);
    partThumbnailRenderer.render(stage,camera);
    const url=partThumbnailRenderer.domElement.toDataURL('image/png');
    rigThumbnailCache.set(key,url);
    disposePreviewObject(visual.root);
    return url;
}
export function createArenaScene(initial, targetAssembly, arenaMap=BACKLOT) {
    const world=arenaMap.world;
    const playerSpawn=arenaMap.spawns.friendly[0],hostileSpawn=arenaMap.spawns.hostile[0];
    const scene = new THREE.Scene();
    // Recycled ground decals: no permanent textures, runtime allocations on
    // landing, save changes, or hundreds of expensive particle emitters.
    const footEvidenceRoot=new THREE.Group();
    footEvidenceRoot.name='mechanical-footstep-evidence';
    scene.add(footEvidenceRoot);
    const soleGeometry=new THREE.PlaneGeometry(1,1);
    const footEvidencePool=Array.from({length:56},()=>{
      const material=new THREE.MeshBasicMaterial({color:0x282e2b,
        transparent:true,opacity:.15,depthWrite:false,side:THREE.DoubleSide,
        polygonOffset:true,polygonOffsetFactor:-1});
      const mesh=new THREE.Mesh(soleGeometry,material);
      mesh.rotation.order='YXZ';
      mesh.visible=false;
      mesh.renderOrder=3;
      footEvidenceRoot.add(mesh);
      return mesh;
    });
    let footEvidenceIndex=0;
    function recordFootprint(mark){
      if(!mark||!Number.isFinite(mark.x)||!Number.isFinite(mark.z))return;
      const mesh=footEvidencePool[footEvidenceIndex++%footEvidencePool.length];
      mesh.position.set(mark.x,.046+(mark.elevation??0),mark.z);
      mesh.rotation.set(-Math.PI/2,-(mark.yaw??0),0,'YXZ');
      mesh.scale.set(mark.width??.45,mark.length??.7,1);
      mesh.material.color.setHex(mark.surface==='dirt'?0x322518:
        mark.surface==='metal'?0x101c1d:0x2f3028);
      mesh.material.opacity=Math.min(.27,Math.max(.05,mark.opacity??.13));
      mesh.visible=true;
    }
    const fogColor=arenaMap.theme==='concrete'?0x263537:
        arenaMap.theme==='mill'?0x312d24:0x20241f;
    scene.background = new THREE.Color(fogColor);
    scene.fog = new THREE.FogExp2(fogColor,
        arenaMap.theme==='mill'?.013:arenaMap.theme==='concrete'?.0098:.0105);
    if(arenaMap.id==='backlot-dustbowl'||arenaMap.id==='test-yard')setBacklotOpenSky(scene);
    const combatBackground=scene.background;
    const serviceBackground=new THREE.Color(0x0d1210);
    const camera = new THREE.PerspectiveCamera(68, 1, 0.06, 125);
    camera.rotation.order = 'YXZ';
    scene.add(camera);
    // Lower broad ambient wash and let shaped warm/cool sources describe the forms.
    const arenaLight=lightingProfile('arena');
    const arenaHemisphere = new THREE.HemisphereLight(arenaLight.ambientSky,arenaLight.ambientGround,arenaLight.ambient);
    scene.add(arenaHemisphere);
    const sun = new THREE.DirectionalLight(0xffd09c,arenaLight.key);
    sun.position.set(-10, 17, 11);
    sun.castShadow = true;
    // Keep the shadow silhouette coherent at source; the deliberately low-res world
    // framebuffer does the final pixelation instead of destroying the shadow shape first.
    sun.shadow.mapSize.set(arenaLight.shadowSize,arenaLight.shadowSize);
    sun.shadow.camera.left = -38; sun.shadow.camera.right = 38;
    sun.shadow.camera.top = 34; sun.shadow.camera.bottom = -34;
    sun.shadow.camera.near = 2; sun.shadow.camera.far = 65;
    sun.shadow.bias = -.0007; sun.shadow.normalBias = .035;
    scene.add(sun);
    const coolRim = new THREE.DirectionalLight(0x79a9a8,arenaLight.rim);
    coolRim.position.set(12, 6, -16);
    scene.add(coolRim);
    const arenaRoot = new THREE.Group();
    arenaRoot.name = 'arena-environment';
    arenaRoot.userData.mapId=arenaMap.id;
    scene.add(arenaRoot);
    const arenaPresentationRoot = new THREE.Group();
    arenaPresentationRoot.name = 'arena-presentation';
    scene.add(arenaPresentationRoot);
    const worldSolids = buildArenaWorld(arenaRoot,world,arenaMap,playerSpawn,hostileSpawn);
    const backlotEnvironment=arenaMap.id==='backlot-dustbowl'
        ?scene.getObjectByName('backlot-outdoor-derby-world'):null;
    const garageRoot = buildGarageBay();
    // A circuit-side service lane is a different *physical place* from home.
    // Reuse the same authored jacks and diagnostics, not the entire garage.
    const pitRoot=buildPitLane();
    pitRoot.visible=false;scene.add(pitRoot);
    const serviceDressing=buildServiceDressing();
    garageRoot.add(serviceDressing);
    serviceDressing.visible=false;
    let pitPresentation=false,serviceSelectedSlot=null,lastServiceSignature='';
    function setPitPresentation(pit=false,slot=null){
        const next=!!pit;
        if(pitPresentation!==next){
            pitPresentation=next;
            (pitPresentation?pitRoot:garageRoot).add(serviceDressing);
        }
        serviceSelectedSlot=SLOTS.includes(slot)?slot:null;
        garageRoot.visible=inspecting&&!vendorEnabled&&!pitPresentation;
        pitRoot.visible=inspecting&&!vendorEnabled&&pitPresentation;
        lastServiceSignature='';
        refreshPhysicalServiceBay();
    }
    function refreshPhysicalServiceBay(){
        const policy=serviceBayFocus(latestPilotParts||{},serviceSelectedSlot,pitPresentation);
        serviceDressing.visible=inspecting&&!vendorEnabled&&policy.visible;
        if(!serviceDressing.visible)return;
        const stage=serviceDressing.userData.stage;
        if(!stage)return;
        stage.supports.visible=policy.supports;
        stage.warning.material.emissive.setHex(policy.critical?0xae351a:
          policy.intensity>.025?0xc78e36:0x245d50);
        stage.warning.material.color.setHex(policy.critical?0xda7851:
          policy.intensity>.025?0xe1b862:0x5c9c87);
        stage.lamp.intensity=pitPresentation?1.65:.8;
        const station=policy.focus?SLOT_CENTERS[policy.focus]:[0,1.1,0];
        stage.lamp.target.position.set(station[0],Math.max(.6,station[1]),station[2]);
        stage.lamp.target.updateMatrixWorld();
        const signature=[policy.focus,policy.mode,policy.damagedCount,pitPresentation].join(':');
        if(signature!==lastServiceSignature){
            lastServiceSignature=signature;
            const canvas=stage.readout.image;
            const g=canvas.getContext('2d');
            g.fillStyle='#111c19';g.fillRect(0,0,128,64);
            g.fillStyle='#344c43';g.fillRect(2,2,124,60);
            g.fillStyle='#13221b';g.fillRect(5,5,118,54);
            g.fillStyle='#b0c4a8';g.font=canvasFont(11,'data',700);g.fillText(pitPresentation?'PIT DIAGNOSTIC':'SERVICE BAY',10,19);
            g.fillStyle=policy.critical?'#eda16c':'#d9b977';
            g.font=canvasFont(13,'data',700);
            g.fillText(policy.focus?.toUpperCase()?.slice(0,11)||'ALL SYSTEMS',10,37);
            g.font=canvasFont(10,'data',700);
            g.fillStyle=policy.critical?'#ff9876':'#94bfb2';
            g.fillText(policy.mode+' / '+policy.damagedCount+' ALERT',10,51);
            stage.readout.needsUpdate=true;
        }
    }
    garageRoot.name = 'garage-bay';
    garageRoot.visible = false;
    scene.add(garageRoot);
    // Non-gameplay supports make unfinished bays read as machinery undergoing
    // assembly rather than disconnected modules levitating over the service pad.
    const stagingFixtures = new THREE.Group();
    stagingFixtures.name = 'garage-work-fixtures';
    scene.add(stagingFixtures);
    function clearStagingFixtures() {
        stagingFixtures.traverse(node => {
            if (!node.isMesh) return;
            node.geometry?.dispose?.();
            if (Array.isArray(node.material)) node.material.forEach(mat => mat.dispose?.());
            else node.material?.dispose?.();
        });
        stagingFixtures.clear();
    }
    function stagingBox(w,h,d,color,x,y,z) {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w,h,d),
            new THREE.MeshStandardMaterial({color,roughness:.87,metalness:.22}));
        mesh.position.set(x,y,z);
        mesh.castShadow=true;mesh.receiveShadow=true;
        stagingFixtures.add(mesh);
        return mesh;
    }
    function stagingPost(x,z,top) {
        stagingBox(.18,Math.max(.20,top-.11),.18,0x394644,x,(top-.11)/2,z);
        stagingBox(.38,.12,.37,0xae833c,x,top-.04,z);
        stagingBox(.48,.13,.48,0x252e2b,x,.085,z);
    }
    function updateGarageFixtures(assembly) {
        clearStagingFixtures();
        const hasFrame=!!installedPart(assembly,'structure');
        const hasMobility=!!installedPart(assembly,'mobility');
        if (hasFrame && hasMobility) return;
        if (!hasFrame) {
            const loose=['mobility','power','command','combat'].filter(slot=>installedPart(assembly,slot));
            // Put each loose physical module on a real low repair table, keeping its
            // original meshes and ownership/picking tags. No fictional mounting.
            const z=0;
            loose.forEach((slot,index)=>{
                const group=exterior.partGroups.get(slot);
                if(!group)return;
                const x=(index-(loose.length-1)/2)*1.45;
                stagingBox(1.16,.16,1.06,0x47534e,x,.69,z);
                stagingBox(1.25,.09,1.12,0xb38842,x,.81,z);
                for(const dx of [-.45,.45])for(const dz of [-.35,.35])stagingPost(x+dx,z+dz,.62);
                group.position.set(x,1.25,z);
                const bounds=new THREE.Box3().setFromObject(group);
                if(Number.isFinite(bounds.min.y))group.position.y+=.88-bounds.min.y;
            });
            if(!loose.length){
                // The empty bay still has a believable reserved assembly station.
                stagingBox(2.6,.17,1.7,0x3e4842,0,.13,0);
                stagingBox(2.45,.05,1.55,0x80632e,0,.25,0);
                for(const x of [-1.03,1.03])for(const z of [-.65,.65])
                    stagingBox(.20,.07,.20,0xb38c4a,x,.31,z);
            }
        } else if (!hasMobility) {
            // Support an otherwise assembled torso on four garage jack stands.
            for(const x of [-.68,.68])for(const z of [-.49,.49]){
                stagingBox(.48,.14,.50,0x3a423e,x,.1,z);
                stagingBox(.14,1.45,.14,0x78817a,x,.88,z);
                stagingBox(.44,.16,.56,0xb58a42,x,1.62,z);
            }
            stagingBox(2.03,.12,.21,0x57615c,0,1.57,0);
        }
        stagingFixtures.visible=inspecting;
    }
    // Six new-cycle components on two physical rows of a battered dealer's table. The counter is a
    // mutually exclusive garage viewing mode: no combat meshes or extra loadout
    // geometry are created. Cards and these physical objects share lot serials.
    const vendorRoot = new THREE.Group();
    vendorRoot.name='used-parts-counter-table';
    vendorRoot.visible=false;
    scene.add(vendorRoot);
    const vendorPicks=[],vendorPads=new Map();
    let vendorEnabled=false;
    let savedWorkshopOrbit=null;
    function clearVendorTable() {
        vendorRoot.traverse(object=>{
            if(!object.isMesh)return;
            object.geometry?.dispose?.();
            const mats=Array.isArray(object.material)?object.material:[object.material];
            mats.forEach(mat=>{mat?.map?.dispose?.();mat?.dispose?.();});
        });
        vendorRoot.clear();vendorPicks.length=0;vendorPads.clear();
    }
    function vendorBox(width,height,depth,color,x,y,z,parent=vendorRoot) {
        const material=new THREE.MeshStandardMaterial({color,roughness:.89,metalness:.28});
        const mesh=new THREE.Mesh(new THREE.BoxGeometry(width,height,depth),material);
        mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;
        parent.add(mesh);return mesh;
    }
    function setVendorStock(offers=[]) {
        clearVendorTable();
        // A seller's stall, not the garage with a shop window: dark boarded
        // floor, distinct back wall, side uprights, overhead lamps and sign.
        vendorBox(13.0,.13,8.8,0x4a4435,0,-.08,.25);
        vendorBox(12.8,4.4,.18,0x242b25,0,2.12,3.4);
        for(const x of [-6.3,6.3]){
            vendorBox(.27,4.7,.33,0x574932,x,2.25,1.1);
            vendorBox(.4,.22,7.2,0x433b2d,x,4.4,.2);
        }
        vendorBox(12.6,.17,.35,0x6f5837,0,4.3,2.75);
        vendorBox(4.5,.95,.16,0x6e5536,0,3.5,3.06);
        const signCanvas=document.createElement('canvas');
        signCanvas.width=512;signCanvas.height=128;
        const paint=signCanvas.getContext('2d');
        if(paint){
            const drawVendorSign=()=>{
                paint.fillStyle='#243229';paint.fillRect(0,0,512,128);
                paint.fillStyle='#d5b474';paint.font = canvasFont(54, 'identity');
                paint.textAlign='center';paint.fillText('BACKLOT',256,65,485);
                paint.font = canvasFont(25, 'ui');paint.fillText('SALVAGE  /  AS-IS',256,105,485);
            };
            drawVendorSign();
            const texture=new THREE.CanvasTexture(signCanvas);
            texture.colorSpace=THREE.SRGBColorSpace;
            whenGameFontsReady(()=>{drawVendorSign();texture.needsUpdate=true;});
            const sign=new THREE.Mesh(new THREE.PlaneGeometry(4.14,.87),
                new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide}));
            sign.position.set(0,3.50,2.94);sign.rotation.y=Math.PI;
            vendorRoot.add(sign);
        }
        vendorBox(10.0,.18,5.45,0x654632,0,.75,0);
        vendorBox(9.9,.065,5.4,0x967647,0,.865,0);
        for(const x of [-4.3,4.3])for(const z of [-2.35,2.35])
            vendorBox(.23,.72,.23,0x343d38,x,.34,z);
        vendorBox(10.1,.12,.19,0xb38742,0,.95,-2.71);
        // Reclaimed-parts shop: pegboard storage, stacked salvage and a lamp
        // above the counter. All props are cosmetic, with zero extra collision.
        for(const x of [-5.45,5.45]){
            vendorBox(1.65,2.05,.28,0x4b3c2c,x,2.23,3.18);
            for(let row=0;row<4;row++){
                vendorBox(1.38,.14,.55,0x8d7250,x,1.44+row*.42,2.87);
                vendorBox(.47,.25,.38,row%2?0x4e675c:0x8d5d39,x-.35,1.61+row*.42,2.74);
            }
        }
        for(const x of [-5.2,-4.45,4.45,5.2])
            vendorBox(.62,.54,.68,0x5d4d38,x,.31,-3.25);
        (offers||[]).slice(0,6).forEach((offer,i)=>{
            const x=(i%3-1)*3.1,z=(Math.floor(i/3)-.5)*2.65;
            const tray=vendorBox(2.55,.06,2.24,offer.sold?0x333732:0x3e4a42,x,.97,z);
            tray.userData.vendorSerial=offer.serial;vendorPicks.push(tray);
            const light=vendorBox(2.46,.04,.12,offer.sold?0x5b4138:0xb99151,x,1.018,z-1.05);
            vendorPads.set(offer.serial,{light,sold:offer.sold});
            if(offer.sold){
                // Physical sign sits on the empty tray after the purchased
                // serialized part disappears; it is non-selectable.
                const canvas=document.createElement('canvas');
                canvas.width=256;canvas.height=96;
                const ctx=canvas.getContext('2d');
                if(ctx){
                    ctx.fillStyle='#3c261d';ctx.fillRect(0,0,256,96);
                    ctx.strokeStyle='#d7a478';ctx.lineWidth=5;ctx.strokeRect(5,5,246,86);
                    ctx.textAlign='center';ctx.textBaseline='middle';
                    ctx.font=canvasFont(54,'identity');ctx.fillStyle='#f7c18e';
                    ctx.fillText('SOLD OUT',128,47,239);
                    const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;
                    const placard=new THREE.Mesh(new THREE.PlaneGeometry(1.9,.70),
                        new THREE.MeshBasicMaterial({map,side:THREE.DoubleSide}));
                    placard.position.set(x,1.37,z);
                    placard.rotation.x=-.37;
                    vendorRoot.add(placard);
                }
                return;
            }
            const def=BY_ID.get(offer.definitionId);
            if(!def)return;
            const assembly={serial:'COUNTER',name:'VENDOR',owned:[{
                serial:offer.serial,definitionId:offer.definitionId,
                condition:offer.condition,wear:offer.wear,repairs:offer.repairs,
                destroyed:false,
            }],installed:{[def.slot]:offer.serial}};
            const visual=buildExteriorRig(assembly);
            const bounds=new THREE.Box3().setFromObject(visual.root);
            const size=bounds.getSize(new THREE.Vector3());
            const scale=Math.min(1,2.15/Math.max(.1,size.x),
                2.00/Math.max(.1,size.z),1.95/Math.max(.1,size.y));
            visual.root.scale.setScalar(scale);
            visual.root.position.set(x-(bounds.min.x+bounds.max.x)*.5*scale,
                1.04-bounds.min.y*scale,z-(bounds.min.z+bounds.max.z)*.5*scale);
            for(const mesh of visual.pickMeshes){
                mesh.userData.vendorSerial=offer.serial;vendorPicks.push(mesh);
                if(mesh.material instanceof THREE.MeshStandardMaterial && offer.condition<.98){
                    mesh.material.color.lerp(new THREE.Color(0x6e3228),Math.min(.55,(1-offer.condition)*.42));
                    mesh.material.color.multiplyScalar(Math.max(.50,1-(1-offer.condition)*.28));
                }
            }
            vendorRoot.add(visual.root);
        });
        vendorRoot.visible=inspecting&&vendorEnabled;
    }
    function setVendorMode(enabled) {
        enabled=!!enabled;
        if(enabled===vendorEnabled)return;
        vendorEnabled=enabled;
        vendorRoot.visible=inspecting&&vendorEnabled;
        exterior.root.visible=inspecting&&!vendorEnabled;
        garageRoot.visible=inspecting&&!vendorEnabled&&!pitPresentation;
        pitRoot.visible=inspecting&&!vendorEnabled&&pitPresentation;
        stagingFixtures.visible=inspecting&&!vendorEnabled&&!pitPresentation;
        if(vendorEnabled) {
            // A separate tabletop viewing station: don't overwrite the player's
            // garage orbit, so returning to the rig is spatially continuous.
            savedWorkshopOrbit={azimuth,elevation,radius,target:desiredTarget.clone()};
            azimuth=.02;elevation=.32;radius=8.4;
            desiredTarget.set(0,1.45,0);orbitAssist=null;
        } else if(savedWorkshopOrbit) {
            azimuth=savedWorkshopOrbit.azimuth;
            elevation=savedWorkshopOrbit.elevation;
            radius=savedWorkshopOrbit.radius;
            desiredTarget.copy(savedWorkshopOrbit.target);
            savedWorkshopOrbit=null;orbitAssist=null;
        }
    }
    function selectVendorLot(serial) {
        for(const [id,pad] of vendorPads)
            pad.light.material.color.setHex(pad.sold?0x5b4138:id===serial?0xeac572:0xb99151);
    }
    function pickVendorLot(clientX,clientY,canvas) {
        if(!inspecting||!vendorEnabled)return null;
        const rect=canvas.getBoundingClientRect();
        const pointer=new THREE.Vector2(((clientX-rect.left)/rect.width)*2-1,
            -((clientY-rect.top)/rect.height)*2+1);
        vendorRoot.updateWorldMatrix(true,true);
        camera.updateMatrixWorld();
        raycaster.setFromCamera(pointer,camera);
        return raycaster.intersectObjects(vendorPicks,false)[0]?.object.userData.vendorSerial??null;
    }
    const GARAGE_RIG_YAW = -0.10;
    const cockpit = buildCockpit(scene);
    // The information display is still a real Three.js cockpit layer, but it rides the
    // windshield/combiner perimeter instead of sitting as three perspective-skewed blocks
    // on top of the dashboard. Cracks and blackouts remain physically in front of it.
    const combinerHud = new THREE.Group();
    combinerHud.name = 'cockpit-combiner-hud';
    camera.add(combinerHud);
    const combinerLayout = {
        // Keep persistent information on the bezel. The middle of the windshield is
        // reserved for the world, reticle and genuinely transient combat events.
        systems: { position: [-.091, .004, -.105], scale: .066 },
        team:    { position: [ 0.000, .057, -.105], scale: .052 },
        weapon:  { position: [ .091,-.004, -.105], scale: .064 },
        motion:  { position: [-.056,-.052, -.105], scale: .053 },
        drive:   { position: [ .020,-.054, -.105], scale: .053 },
    };
    for (const [name, screen] of Object.entries(cockpit.userData.instrumentScreens)) {
        cockpit.remove(screen.mesh);
        combinerHud.add(screen.mesh);
        const layout = combinerLayout[name];
        screen.mesh.position.set(...layout.position);
        screen.mesh.rotation.set(0, 0, 0);
        screen.mesh.scale.setScalar(layout.scale);
        screen.mesh.renderOrder = 90;
        screen.mesh.material.depthTest = false;
        screen.mesh.material.depthWrite = false;
    }
    const debugColliders = buildDebugColliders(scene,world);
    debugColliders.visible = false;
    const navMarker = new THREE.Mesh(new THREE.RingGeometry(.42, .52, 16), new THREE.MeshBasicMaterial({ color: 0x73dfc8, side: THREE.DoubleSide, depthTest: false }));
    navMarker.rotation.x = -Math.PI / 2;
    navMarker.visible = false;
    debugColliders.add(navMarker);
    const shotAuditMaterial = new THREE.LineBasicMaterial({ color: 0x65ff91, depthTest: false, transparent: true, opacity: .92 });
    const shotAuditLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), shotAuditMaterial);
    shotAuditLine.visible = false;
    debugColliders.add(shotAuditLine);
    function updateShotAudit(contact, clear) {
        if (!contact?.muzzle || !contact?.point) {
            shotAuditLine.visible = false;
            return;
        }
        shotAuditLine.geometry.dispose();
        shotAuditLine.geometry = new THREE.BufferGeometry().setFromPoints([contact.muzzle, contact.point]);
        shotAuditMaterial.color.setHex(clear ? 0x65ff91 : 0xff765d);
        shotAuditLine.visible = true;
    }
    function updateHostileNavigation(point) {
        navMarker.visible = point !== null;
        if (point)
            navMarker.position.set(point.x, .09, point.z);
    }
    // The catalogue's mobility centre is a mounting datum, not ground level.
    // Measuring the real soles avoids the old ~20cm visual hover and works
    // across all three families without shifting connection sockets or
    // altering locomotion/collision calculations.
    const GARAGE_PAD_TOP_Y=.09;
    function calibrateExteriorSoles(visual){
        const feet=[];
        visual.partGroups.get('mobility')?.traverse(node=>{
            if(node.userData?.joint==='foot')feet.push(node);
        });
        if(!feet.length){
            visual.groundOffset=0;
            return 0;
        }
        visual.root.updateWorldMatrix(true,true);
        const baseY=visual.root.getWorldPosition(new THREE.Vector3()).y;
        let bottom=Infinity;
        const bounds=new THREE.Box3();
        for(const foot of feet){
            bounds.setFromObject(foot);
            if(Number.isFinite(bounds.min.y))
                bottom=Math.min(bottom,bounds.min.y-baseY);
        }
        // 1cm deliberate optical tolerance avoids constant surface z-fighting.
        const height=Number.isFinite(bottom)
            ?THREE.MathUtils.clamp(.012-bottom,-.34,.08):0;
        visual.groundOffset=height;
        return height;
    }
    function recalibratePlayerSoles(){
        const offset=calibrateExteriorSoles(exterior);
        exterior.root.position.y=offset+(inspecting?GARAGE_PAD_TOP_Y:0);
        return offset;
    }
    // The moving target is assembled from the SAME definitions and geometry
    // as the player. It has its own installed serials and never inherits player swaps.
    let targetExterior = buildExteriorRig(targetAssembly);
    calibrateExteriorSoles(targetExterior);
    targetExterior.root.position.set(hostileSpawn.x, targetExterior.groundOffset, hostileSpawn.z);
    targetExterior.root.rotation.y = Math.PI; // Look back toward the pilot.
    arenaPresentationRoot.add(targetExterior.root);
    const rangeMarks = new THREE.Group();
    targetExterior.root.add(rangeMarks);
    const sootMarks = [];
    const transientFX = [];
    const targetColors = new WeakMap();
    for (const mesh of targetExterior.pickMeshes) {
        mesh.userData.actorId = 'enemy-0';
        const material = mesh.material;
        if (material instanceof THREE.MeshStandardMaterial)
            targetColors.set(mesh, material.color.clone());
    }
    const makeEmitterBudget = () => new Map(SLOTS.map(slot => [slot, { spark: 0, smoke: 0, arc: 0, fluid: 0 }]));
    const squadCombatants = new Map();
    function makeSquadMarker(team) {
        // Friendlies need a persistent location cue. Hostiles get a tiny
        // acquisition chevron only while genuinely visible, never a wallhack box.
        const friendly=team==='friendly';
        // Restore the original square IFF silhouette, with an unmistakable
        // team colour and a marker placed above the cab rather than in torso
        // geometry. Enemy IFF is still LOS-gated below.
        const radius=friendly?.48:.43;
        const geometry=new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(-radius,-radius,0),
            new THREE.Vector3(radius,-radius,0),
            new THREE.Vector3(radius,radius,0),
            new THREE.Vector3(-radius,radius,0),
        ]);
        const material = new THREE.LineBasicMaterial({
            color: friendly ? 0x7bdfab : 0xf0a07b,
            transparent: true, opacity: friendly?.98:.94,
            depthTest: false, depthWrite: false,
        });
        const marker = new THREE.LineLoop(geometry,material);
        marker.frustumCulled = false;
        marker.renderOrder = 8;
        arenaPresentationRoot.add(marker);
        return marker;
    }
    const capturePartTransforms = exterior => new Map([...exterior.partGroups].map(([slot, group]) => [slot, {
        position: group.position.clone(), rotation: group.rotation.clone(), scale: group.scale.clone(), parent: group.parent,
    }]));
    const captureArticulation = exterior => {
        const joints = [], legs = new Map();
        exterior.partGroups.get('mobility')?.traverse(object => {
            if (!object.userData?.joint) return;
            const side = Number(object.userData.side) || 0;
            joints.push({object,joint:object.userData.joint,side,
                base:object.rotation.clone()});
            if(!legs.has(side))legs.set(side,{});
            legs.get(side)[object.userData.joint]=object;
        });
        for(const chain of legs.values()){
            if(!chain.hip||!chain.knee||!chain.ankle||!chain.foot)continue;
            chain.upper=[chain.knee.position.y,chain.knee.position.z];
            chain.lower=[chain.ankle.position.y,chain.ankle.position.z];
            chain.upperX=chain.knee.position.x;
            chain.lowerX=chain.ankle.position.x;
        }
        return {joints,legs,phase:0,aim:{waist:0,gun:0,elevation:0}};
    };
    const primaryMarker = makeSquadMarker('hostile');
    squadCombatants.set('enemy-0', {
        id: 'enemy-0', team: 'hostile', assembly: targetAssembly, exterior: targetExterior,
        colors: targetColors, marker: primaryMarker, active: true, condition: null,
        emitterBudget: makeEmitterBudget(), disabledSlots: new Set(), destroyedSlots: new Set(), wrecked: false, cleared: false,
        wounds: new Map(SLOTS.map(slot => [slot, []])), woundMarks: [],
        baseParts: capturePartTransforms(targetExterior), articulation: captureArticulation(targetExterior),
        recoilKick: 0, recoilRecovery: 3.2,
        weaponFault: false, weaponServicing: false, serviceSlot: null, serviceSparkBudget: 0, weaponRecoveryKick: 0, recoveryBurstPending: false,
    });
    function colorsFor(exterior) {
        const colors = new WeakMap();
        for (const mesh of exterior.pickMeshes) {
            const material = mesh.material;
            if (material instanceof THREE.MeshStandardMaterial)
                colors.set(mesh, material.color.clone());
        }
        return colors;
    }
    function addCombatant(id, assembly, team, spawn) {
        if (!id || id === 'player' || squadCombatants.has(id))
            throw new Error(`Invalid or duplicate squad combatant: ${id}`);
        const actorExterior = buildExteriorRig(assembly);
        calibrateExteriorSoles(actorExterior);
        actorExterior.root.position.set(spawn.x, actorExterior.groundOffset, spawn.z);
        actorExterior.root.rotation.y = physicsYawToViewYaw(spawn.yaw ?? 0);
        for (const mesh of actorExterior.pickMeshes)
            mesh.userData.actorId = id;
        arenaPresentationRoot.add(actorExterior.root);
        const record = {
            id, team, assembly, exterior: actorExterior, colors: colorsFor(actorExterior),
            marker: makeSquadMarker(team), active: true, condition: null,
            emitterBudget: makeEmitterBudget(), disabledSlots: new Set(), destroyedSlots: new Set(), wrecked: false, cleared: false,
            wounds: new Map(SLOTS.map(slot => [slot, []])), woundMarks: [],
            baseParts: capturePartTransforms(actorExterior), articulation: captureArticulation(actorExterior),
            recoilKick: 0, recoilRecovery: 3.2,
            hitResponse:createHitResponse(),fractureParts:[],lastMobilityHitSide:0,
        weaponFault: false, weaponServicing: false, serviceSlot: null, serviceSparkBudget: 0, weaponRecoveryKick: 0, recoveryBurstPending: false,
        };
        squadCombatants.set(id, record);
        return record;
    }
    /** Update installed coating on an already spawned ally without rebuilding
     * its rig, physics, pose or serialized hardware. Usually called in garage. */
    function repaintCombatant(id){
        const record=squadCombatants.get(id);
        if(!record)return false;
        for(const [slot,group] of record.exterior.partGroups){
            const paint=normalizePaint(installedPart(record.assembly,slot)?.instance?.paint);
            if(!paint)continue;
            group.traverse(node=>{
                if(!node.isMesh||!node.material)return;
                const items=Array.isArray(node.material)?node.material:[node.material];
                for(const material of items){
                    const channel=material?.userData?.paintChannel;
                    if(channel && paint[channel])material.color.set(paint[channel]);
                }
            });
        }
        record.colors=colorsFor(record.exterior);
        return true;
    }
    function setCombatantActive(id, active) {
        const record = squadCombatants.get(id);
        if (!record) return;
        const wasActive = record.active;
        record.active = !!active;
        if (wasActive && !record.active)
            wreckCombatantVisual(record);
        else if (record.active && (!wasActive || record.wrecked || record.destroyedSlots.size || record.disabledSlots.size))
            resetCombatantVisual(record);
        record.marker.material.opacity = record.active ? .82 : .24;
        record.marker.scale.setScalar(record.active ? .86 : .62);
    }
    function setCombatantCleared(id, cleared = true) {
        const record = squadCombatants.get(id);
        if (!record) return;
        record.cleared = !!cleared;
        if (record.cleared) {
            record.marker.visible = false;
            record.exterior.root.position.y = -.14;
            record.exterior.root.rotation.z *= 1.55;
            for (const slot of ['command', 'combat']) {
                const group = record.exterior.partGroups.get(slot);
                if (group) group.scale.setScalar(.72);
            }
        }
    }
    const markerSightRay=new THREE.Raycaster();
    const markerSightPoint=new THREE.Vector3();
    const markerDirection=new THREE.Vector3();
    let markerSightAge=0;
    function updateSquadMarkers(dt=1/60) {
        markerSightAge+=Number.isFinite(dt)?Math.max(0,dt):0;
        // One collision-only visibility query every 0.12s avoids five expensive
        // geometry traversals per 60Hz frame, while reacting promptly to cover.
        const refresh=markerSightAge>=.12;
        if(refresh)markerSightAge=0;
        for (const record of squadCombatants.values()) {
            const friendly=record.team==='friendly';
            const eligible=!inspecting&&!record.cleared&&(friendly||record.active);
            if(!eligible){record.marker.visible=false;continue;}
            record.exterior.root.getWorldPosition(markerSightPoint);
            const position=markerSightPoint.clone();
            // Mark the mech's upper physical silhouette, not empty sky overhead.
            markerSightPoint.y+=1.7;
            if(!friendly && (refresh || record.iffVisible===undefined)){
                const distance=markerDirection.subVectors(markerSightPoint,camera.position).length();
                const blocked=distance>.3 && (()=>{
                    markerSightRay.set(camera.position,markerDirection.normalize());
                    markerSightRay.far=Math.max(0,distance-.25);
                    return markerSightRay.intersectObjects(worldSolids,false).length>0;
                })();
                record.iffVisible=!blocked;
            }
            record.marker.visible=friendly||!!record.iffVisible;
            // Keep the box physically above the cab silhouette, not buried
            // against its armour. The hostile box still requires LOS.
            position.y+=friendly?3.05:2.92;
            record.marker.position.copy(position);
            record.marker.quaternion.copy(camera.quaternion);
        }
    }
    function combatPickMeshes(excludeId = null) {
        const meshes = [];
        for (const record of squadCombatants.values()) {
            if (record.id !== excludeId && !record.cleared)
                meshes.push(...record.exterior.pickMeshes);
        }
        return meshes;
    }
    // 0.0.1f: a deliberately small pooled pixel-particle system. Particles are
    // reused instead of allocated per shot so sustained fire stays friendly to phones.
    const particleRoot = new THREE.Group();
    arenaPresentationRoot.add(particleRoot);
    const particleStates = [];
    function makePool(count, geometry, color, transparent = false) {
        const pool = [];
        for (let i = 0; i < count; i++) {
            const material = new THREE.MeshBasicMaterial({ color, transparent, opacity: transparent ? .55 : 1, depthWrite: !transparent });
            const mesh = new THREE.Mesh(geometry, material);
            mesh.visible = false;
            particleRoot.add(mesh);
            const state = { mesh, velocity: new THREE.Vector3(), life: 0, duration: 0, gravity: 0, grow: 0, baseScale: 1, smoke: false };
            particleStates.push(state);
            pool.push(state);
        }
        return pool;
    }
    const sparkPool = makePool(88, new THREE.BoxGeometry(.042, .042, .18), 0xffc968, true);
    const chipPool = makePool(52, new THREE.BoxGeometry(.085, .060, .11), 0x4a4d46, true);
    // Soft low-resolution billboards read as smoke plumes instead of floating cubes.
    const smokePool = makePool(56, new THREE.PlaneGeometry(.24, .24), 0x252a26, true);
    // Six-rig budget: at most two 3-piece fracture clusters per machine.
    // Shared geometry/materials; markers attach to actual struck triangles and
    // are excluded from pick/raycast lists. No per-frame geometry or raycasts.
    const fractureGeometry=new THREE.BoxGeometry(1,1,1);
    const fractureMaterials=[
        new THREE.MeshStandardMaterial({color:0x080e0e,roughness:1,metalness:.1,flatShading:true}),
        new THREE.MeshStandardMaterial({color:0x958777,roughness:.84,metalness:.42,flatShading:true}),
        new THREE.MeshStandardMaterial({color:0x414842,roughness:.94,metalness:.3,flatShading:true}),
    ];
    function clearFractures(parts){
        if(!parts)return;
        for(const part of parts)part.parent?.remove(part);
        parts.length=0;
    }
    function markBreachedArmor(contact,outcome){
        if(!contact?.actorId||!contact.slot||!contact.surfaceHit)return;
        if(hitMaterialLanguage(outcome)!=='breach'&&
           hitMaterialLanguage(outcome)!=='hydraulic'&&
           hitMaterialLanguage(outcome)!=='electric'&&
           hitMaterialLanguage(outcome)!=='catastrophic')return;
        // An internal strike qualifies only when protection is actually gone.
        if((outcome.remainingArmor??0)>.001&&!outcome.justDestroyed)return;
        const record=squadCombatants.get(contact.actorId);
        const exteriorRig=contact.actorId==='player'?exterior:record?.exterior;
        const parts=contact.actorId==='player'?pilotFractureParts:record?.fractureParts;
        if(!exteriorRig||!parts)return;
        const surface=contact.surfaceHit;
        if(!Array.isArray(surface.localPoint)||!Array.isArray(surface.localNormal))return;
        const group=exteriorRig.partGroups.get(contact.slot);
        if(!group)return;
        let target=null;
        group.traverse(mesh=>{
            if(!target&&mesh.isMesh&&mesh.userData?.surface?.id===surface.surfaceId)
                target=mesh;
        });
        if(!target)return;
        // Keep the oldest established rupture; no more than two persistent
        // 3D details per machine, even under a 60-round repeater barrage.
        if(parts.length>=2)return;
        const cluster=new THREE.Group();
        cluster.name='physical-breach-detail';
        const inner=new THREE.Mesh(fractureGeometry,fractureMaterials[0]);
        inner.scale.set(.19,.14,.010);inner.position.z=.006;cluster.add(inner);
        const left=new THREE.Mesh(fractureGeometry,fractureMaterials[1]);
        left.scale.set(.045,.19,.023);left.position.set(-.12,.01,.023);
        left.rotation.z=.21;left.rotation.y=-.42;cluster.add(left);
        const right=new THREE.Mesh(fractureGeometry,fractureMaterials[2]);
        right.scale.set(.048,.18,.027);right.position.set(.13,-.02,.024);
        right.rotation.z=-.20;right.rotation.y=.38;cluster.add(right);
        cluster.position.set(...surface.localPoint);
        cluster.quaternion.setFromUnitVectors(
            new THREE.Vector3(0,0,1),new THREE.Vector3(...surface.localNormal).normalize());
        const scale=outcome.justDestroyed?1.3:outcome.internalDamage>0?1.0:.80;
        cluster.scale.setScalar(scale);
        target.add(cluster);
        parts.push(cluster);
    }
    function recordHitInertia(contact,outcome){
        if(!contact?.actorId||!contact?.slot||!outcome||!contact.muzzle||!contact.point)return;
        const record=squadCombatants.get(contact.actorId);
        const targetRoot=contact.actorId==='player'?exterior.root:record?.exterior.root;
        const state=contact.actorId==='player'?pilotHitResponse:record?.hitResponse;
        if(!targetRoot||!state)return;
        targetRoot.updateWorldMatrix(true,false);
        const localPoint=targetRoot.worldToLocal(contact.point.clone());
        if(record&&contact.slot==='mobility'&&outcome.internalDamage>0)
            record.lastMobilityHitSide=localPoint.x<0?-1:1;
        const worldDirection=contact.point.clone().sub(contact.muzzle);
        if(worldDirection.lengthSq()<1e-7)return;
        const localDirection=worldDirection.normalize().applyQuaternion(
            targetRoot.getWorldQuaternion(new THREE.Quaternion()).invert());
        injectHitResponse(state,{
            impulseNs:outcome.impactImpulseNs??0,
            massKg:outcome.impactMassKg??2400,brace:outcome.impactBrace??0,
            directionX:localDirection.x,directionZ:localDirection.z,
            pointX:localPoint.x,pointY:localPoint.y,
            armorAbsorbed:outcome.armorAbsorbed,
            internalDamage:outcome.internalDamage,
            disabled:outcome.justDisabled||outcome.justDestroyed,
            slot:outcome.slot,
        });
        // A struck mech catches ACTUAL momentum through its already-planted
        // visual foot contacts. No shove, steering lock, collider movement,
        // second raycast or fabricated traction is introduced.
        const contacts=contact.actorId==='player'?pilotFeet:record?.footContacts;
        if(contacts&&outcome.impactImpulseNs>0){
            const mobility=contact.actorId==='player'
                ?latestPilotParts?.mobility:record?.condition?.parts?.mobility;
            registerFootImpact(contacts,{
                impulseNs:outcome.impactImpulseNs,massKg:outcome.impactMassKg??2400,
                brace:outcome.impactBrace??0,directionX:localDirection.x,
                directionZ:localDirection.z,pointX:localPoint.x,
                damageHealth:mobility?.maxIntegrity>0?
                    mobility.integrity/mobility.maxIntegrity:1,
            });
        }
        markBreachedArmor(contact,outcome);
    }
    let sparkCursor = 0, chipCursor = 0, smokeCursor = 0;
    // Twelve recycled impact streaks; no speculative secondary ballistic rays.
    const ricochetLines=Array.from({length:12},()=>{
        const geometry=new THREE.BufferGeometry();
        geometry.setAttribute('position',new THREE.BufferAttribute(new Float32Array(6),3));
        const material=new THREE.LineBasicMaterial({color:0xffd695,transparent:true,
            opacity:.88,depthWrite:false});
        const line=new THREE.Line(geometry,material);
        line.visible=false;line.frustumCulled=false;particleRoot.add(line);
        return {line,life:0,duration:.15};
    });
    let ricochetCursor=0,lastNearMissAt=-Infinity,lastCoverSoundAt=-Infinity;
    function presentBattlefieldShot(contact,shooterId='player',weaponId='gun-cannon'){
        if(!contact?.point||!contact?.muzzle)return;
        // Evidence comes from the actual muzzle-to-FIRST-impact segment.
        const listener={x:visualX,y:2.42,z:visualZ};
        const now=performance.now();
        const heavy=weaponId==='gun-short'||weaponId==='gun-scatter'||
            weaponId==='gun-breaker'||weaponId==='gun-rocket';
        if(shooterId!=='player'&&contact.actorId!=='player'&&
            !inspecting&&!spectatorRig&&now-lastNearMissAt>175){
            const evidence=nearMissEvidence(listener,contact.muzzle,contact.point);
            if(evidence){
                lastNearMissAt=now;
                soundBattlefieldEvent(heavy?'heavy-flyby':'flyby',{
                    distance:evidence.separation,
                    pan:soundBearing(evidence,listener,visualYaw),
                    strength:evidence.strength*(heavy?1.13:1),
                });
            }
        }
        // Direct rig hits already have armor/core VFX and sound. Only
        // certified world-cover impacts may use this material language.
        if(!contact.blockedBy||contact.actorId)return;
        const obstacle=world.obstacles?.find(o=>o.id===contact.blockedBy);
        const surface=coverStrikeLanguage({...contact,
            coverArt:obstacle?.artKit??obstacle?.art??null});
        if(!surface)return;
        const point=contact.point,normal=contact.normal??new THREE.Vector3(0,1,0);
        const mat=surface.material;
        const palette=mat==='metal'?0xffbb70:mat==='concrete'?0xc5c0ad:
            mat==='earth'?0xa68d61:mat==='rubber'?0x53534e:0x98734d;
        for(let i=0;i<surface.sparks;i++)
            activateParticle(sparkPool,'spark',point,
                randomBurstDirection(normal,.95).multiplyScalar(1.6+Math.random()*3.1),
                .38+Math.random()*.55,.15+Math.random()*.18,-3,0,palette);
        for(let i=0;i<surface.chips;i++)
            activateParticle(chipPool,'chip',point,
                randomBurstDirection(normal,1.4).multiplyScalar(.8+Math.random()*2.4),
                .50+Math.random()*.75,.38+Math.random()*.35,-7.2,0,palette);
        for(let i=0;i<surface.smoke;i++)
            activateParticle(smokePool,'smoke',point,
                new THREE.Vector3((Math.random()-.5)*.5,.28+Math.random()*.5,
                  (Math.random()-.5)*.5),.52+Math.random()*.45,
                .55+Math.random()*.45,0,.9,mat==='earth'?0x514637:0x353632,true);
        if(surface.ricochet){
            const streak=ricochetLines[ricochetCursor++%ricochetLines.length];
            const incoming=point.clone().sub(contact.muzzle).normalize();
            const bounce=incoming.addScaledVector(normal,-2*incoming.dot(normal)).normalize();
            const end=point.clone().addScaledVector(bounce,1.25);
            const attr=streak.line.geometry.attributes.position;
            attr.setXYZ(0,point.x,point.y,point.z);
            attr.setXYZ(1,end.x,end.y,end.z);attr.needsUpdate=true;
            streak.line.visible=true;streak.life=streak.duration=.15;
        }
        const proximity=coverProximity(point,listener,12);
        if(!inspecting&&!spectatorRig&&proximity>.01&&now-lastCoverSoundAt>105){
            lastCoverSoundAt=now;
            soundBattlefieldEvent(surface.ricochet?'ricochet':'cover-'+mat,{
                distance:Math.hypot(point.x-listener.x,point.y-listener.y,point.z-listener.z),
                pan:soundBearing(point,listener,visualYaw),
                strength:(.4+proximity*.85)*(heavy?1.12:1),
            });
            // Nearby cover shudders; never fabricate hit damage or stun.
            if(proximity>.62)hitShakeKick=Math.max(hitShakeKick,.0025*(proximity-.4));
        }
    }
    const fallingParts = new Map();
    const impactLights = Array.from({ length: 5 }, () => {
        const light = new THREE.PointLight(0xffbf6c, 0, 5.5, 2);
        light.visible = false; light.castShadow = false; scene.add(light);
        return { light, life: 0, duration: 0 };
    });
    let impactLightCursor = 0;
    function flashDamageLight(position, color = 0xffbf6c, intensity = 7, duration = .10, distance = 5.5) {
        const state = impactLights[impactLightCursor++ % impactLights.length];
        state.light.position.copy(position); state.light.color.setHex(color);
        state.light.intensity = intensity; state.light.distance = distance; state.light.visible = true;
        state.life = state.duration = duration;
    }

    const glassCanvas = document.createElement('canvas');
    glassCanvas.width = 512; glassCanvas.height = 300;
    const glassTexture = new THREE.CanvasTexture(glassCanvas);
    glassTexture.magFilter = THREE.NearestFilter; glassTexture.minFilter = THREE.NearestFilter;
    const glassMaterial = new THREE.MeshBasicMaterial({ map: glassTexture, transparent: true, opacity: .82, depthTest: false, depthWrite: false, toneMapped: false });
    const glassDamage = new THREE.Mesh(new THREE.PlaneGeometry(.195, .114), glassMaterial);
    glassDamage.position.set(0, 0, -.086); glassDamage.renderOrder = 100; combinerHud.add(glassDamage);
    const blackoutMaterial = new THREE.MeshBasicMaterial({ color: 0x010201, transparent: true, opacity: 0, depthTest: false, depthWrite: false, toneMapped: false });
    const blackout = new THREE.Mesh(new THREE.PlaneGeometry(.205, .12), blackoutMaterial);
    blackout.position.set(0, 0, -.068); blackout.renderOrder = 101; camera.add(blackout);
    // Layer 1 is rendered by a tiny second renderer at display resolution. The world
    // remains intentionally low-res while cockpit telemetry stays legible.
    combinerHud.traverse(object => object.layers.set(1));
    blackout.layers.set(1);
    const pilotHitResponse=createHitResponse();
    const pilotFractureParts=[];
    let hitPitchKick = 0, hitRollKick = 0, hitYawKick = 0, hitShakeKick = 0, gunDamageKick = 0;
    let powerBlackout = 0, powerFlicker = 0, cockpitWarningLevel = 0;
    let persistentPowerHealth = 1, persistentCommandHealth = 1;
    let driveLeftHealth = 1, driveRightHealth = 1, powerArcCooldown = 1.8;
    let cockpitInstrumentKey = '', cockpitMotionKey = '';
    let crackKey = -1;
    function redrawCracks(commandPercent) {
        const level = Math.max(0, Math.min(1, (72 - commandPercent) / 72));
        const key = Math.round(level * 8);
        if (key === crackKey) return;
        crackKey = key;
        const ctx = glassCanvas.getContext('2d');
        ctx.clearRect(0, 0, glassCanvas.width, glassCanvas.height);
        if (key <= 0) { glassTexture.needsUpdate = true; return; }
        const branches = [
            [[.78,.18],[.72,.29],[.76,.39],[.66,.48],[.69,.61]],
            [[.72,.29],[.61,.25],[.55,.31],[.47,.27]],
            [[.66,.48],[.57,.52],[.49,.63],[.39,.66]],
            [[.69,.61],[.77,.70],[.74,.82]],
            [[.34,.14],[.39,.25],[.36,.35],[.44,.44]],
            [[.39,.25],[.29,.31],[.23,.42]],
            [[.44,.44],[.51,.50],[.48,.58]],
            [[.23,.42],[.18,.55],[.24,.68]],
        ];
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        for (let i = 0; i < Math.min(key, branches.length); i++) {
            const points = branches[i];
            ctx.beginPath();
            ctx.moveTo(points[0][0] * 512, points[0][1] * 300);
            for (const [x,y] of points.slice(1)) ctx.lineTo(x * 512, y * 300);
            ctx.strokeStyle = i < 3 ? 'rgba(235,225,190,.72)' : 'rgba(185,205,185,.48)';
            ctx.lineWidth = i < 3 ? 2.0 : 1.25; ctx.stroke();
            ctx.strokeStyle = 'rgba(20,25,22,.58)'; ctx.lineWidth = .7; ctx.stroke();
        }
        glassTexture.needsUpdate = true;
    }
    function panelBase(screen, tone = 'green', alpha = .72) {
        const ctx = screen?.ctx; if (!ctx) return null;
        const w = screen.canvas.width, h = screen.canvas.height;
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = `rgba(7,16,13,${alpha})`; ctx.fillRect(0, 0, w, h);
        ctx.strokeStyle = tone === 'red' ? '#d56753' : tone === 'amber' ? '#cba45d' : '#6e9d7b';
        ctx.lineWidth = 3; ctx.strokeRect(1.5, 1.5, w - 3, h - 3);
        return ctx;
    }
    const systemGlyphs = { structure: '⬡', mobility: '⋀', power: 'ϟ', command: '◉', combat: '✦' };
    function conditionColor(value) {
        const n = Number(value) || 0;
        return n <= 0 ? '#ff6554' : n < 38 ? '#f08a66' : n < 72 ? '#e2bc70' : '#a8d8ac';
    }
    function drawSystemScreen(screen, systems) {
        const values = ['structure','mobility','power','command','combat'].map(slot => Number(systems?.[slot] ?? 0));
        const tone = Math.min(...values) < 38 ? 'red' : Math.min(...values) < 72 ? 'amber' : 'green';
        const ctx = panelBase(screen, tone, .68); if (!ctx) return;
        const w = screen.canvas.width, h = screen.canvas.height;
        const slots = ['structure','mobility','power','command','combat'];
        const row = h / slots.length;
        slots.forEach((slot, index) => {
            const value = Math.max(0, Math.min(100, Math.round(Number(systems?.[slot] ?? 0))));
            const y = row * index;
            if (index) { ctx.strokeStyle = 'rgba(120,154,126,.20)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(7,y); ctx.lineTo(w-7,y); ctx.stroke(); }
            ctx.fillStyle = conditionColor(value);
            ctx.font = canvasFont(25, 'ui'); ctx.textBaseline = 'middle';
            ctx.fillText(systemGlyphs[slot], 10, y + row * .48);
            ctx.font = canvasFont(16, 'data');
            ctx.textAlign = 'right'; ctx.fillText(String(value).padStart(3,' '), w - 9, y + row * .48); ctx.textAlign = 'left';
            ctx.fillStyle = 'rgba(150,196,158,.20)'; ctx.fillRect(9, y + row - 7, w - 18, 3);
            ctx.fillStyle = conditionColor(value); ctx.fillRect(9, y + row - 7, (w - 18) * value / 100, 3);
        });
        screen.texture.needsUpdate = true;
    }
    function drawTeamScreen(screen, team = {}) {
        const friendly = Math.max(0, Math.min(3, Number(team.friendly) || 0));
        const hostile = Math.max(0, Math.min(3, Number(team.hostile) || 0));
        const ctx = panelBase(screen, friendly <= 1 ? 'amber' : 'green', .54); if (!ctx) return;
        const drawPip = (x, y, alive, color) => {
            ctx.save(); ctx.translate(x, y); ctx.rotate(Math.PI / 4);
            ctx.fillStyle = alive ? color : 'rgba(90,101,91,.16)'; ctx.strokeStyle = alive ? color : 'rgba(120,125,116,.38)';
            ctx.lineWidth = 3; ctx.fillRect(-8,-8,16,16); ctx.strokeRect(-8,-8,16,16);
            if (!alive) { ctx.beginPath(); ctx.moveTo(-7,-7); ctx.lineTo(7,7); ctx.stroke(); }
            ctx.restore();
        };
        for (let i = 0; i < 3; i++) drawPip(29 + i * 28, 22, i < friendly, '#79d89a');
        for (let i = 0; i < 3; i++) drawPip(screen.canvas.width - 29 - (2-i) * 28, 22, i < hostile, '#e2a158');
        ctx.strokeStyle = 'rgba(187,187,151,.22)'; ctx.beginPath(); ctx.moveTo(screen.canvas.width/2,8); ctx.lineTo(screen.canvas.width/2,34); ctx.stroke();
        screen.texture.needsUpdate = true;
    }
    function weaponAbbrev(label) {
        const text = String(label ?? '').toUpperCase();
        if (text.includes('TRAINING')) return 'TRN-CAN';
        if (text.includes('STUMP')) return 'STP-CAN';
        if (text.includes('NEEDLE')) return 'NDL-CAN';
        return text.replace(/[^A-Z0-9]/g,'').slice(0,7) || 'NO-GUN';
    }
    function drawWeaponScreen(screen, data) {
        const state = String(data.weaponState ?? 'READY');
        const tone = state === 'LOST' ? 'red' : state === 'DAMAGED' || state === 'FAULT' || state === 'PWR SAG' ? 'amber' : 'green';
        const ctx = panelBase(screen, tone, .66); if (!ctx) return;
        ctx.fillStyle = tone === 'red' ? '#f08a70' : tone === 'amber' ? '#e4bd70' : '#a6d7ad';
        ctx.font = canvasFont(14, 'data'); ctx.textBaseline = 'middle'; ctx.fillText(weaponAbbrev(data.weapon), 9, 16);
        ctx.font = canvasFont(29, 'data'); ctx.fillText(String(data.ammo ?? '—'), 9, 43);
        ctx.font = canvasFont(10, 'data'); ctx.fillStyle = tone === 'green' ? '#789c80' : ctx.fillStyle; ctx.fillText(state, 10, 66);
        screen.texture.needsUpdate = true;
    }
    function drawMotionScreen(screen, data) {
        const ctx = panelBase(screen, 'green', .54); if (!ctx) return;
        ctx.fillStyle = '#a8d5ad'; ctx.textBaseline = 'middle';
        ctx.font = canvasFont(18, 'data'); ctx.fillText(`${data.speed ?? '0.0'} m/s`, 9, 18);
        ctx.font = canvasFont(12, 'data'); ctx.fillStyle = '#d5b66d'; ctx.fillText(data.brace >= 1 ? 'BRACED' : data.brace > 0 ? 'PLANT' : String(data.direction ?? 'IDLE'), 132, 18);
        ctx.fillStyle = '#83a68a'; ctx.fillText(`TURN ${data.turnRate ?? 0}°/s`, 9, 43);
        ctx.font = canvasFont(11, 'data');
        ctx.fillStyle = data.slip > .35 ? '#efb06f' : data.recoil > .2 ? '#e5be77' : '#8ca994';
        ctx.fillText(data.slip > .35 ? 'FOOT SCRAPE' : data.recoil > .2 ? 'RECOIL LOAD' : data.footing > .8 ? 'FEET LOADED' : 'GRIP NOMINAL', 9, 65);
        screen.texture.needsUpdate = true;
    }
    function drawDriveScreen(screen, load = 0, power = null) {
        const value = Math.max(0, Math.min(1, Number(load) || 0));
        const ctx = panelBase(screen, power?.busRatio < .95 || value > .9 ? 'amber' : 'green', .48); if (!ctx) return;
        const w = screen.canvas.width;
        ctx.fillStyle = '#789a7e'; ctx.font = canvasFont(10, 'data'); ctx.textBaseline = 'middle'; ctx.fillText('DRIVE', 9, 12);
        ctx.fillStyle = 'rgba(132,163,136,.18)'; ctx.fillRect(9, 23, w - 18, 10);
        ctx.fillStyle = value > .9 ? '#e2ae59' : '#89c492'; ctx.fillRect(9, 23, (w - 18) * value, 10);
        ctx.fillStyle = '#a9c7ac'; ctx.textAlign = 'right'; ctx.fillText(`${Math.round(value * 100)}%`, w - 9, 12); ctx.textAlign = 'left';
        if (power) {
            const warn = power.busRatio < .95;
            ctx.font = canvasFont(12, 'data');
            ctx.fillStyle = warn ? '#f4ad68' : '#a9c7ac';
            ctx.fillText(warn ? 'BUS SAG' : 'POWER BUS', 9, 49);
            ctx.textAlign = 'right';
            ctx.fillText(`${Math.round(power.busRatio * 100)}%`, w - 9, 49);
            ctx.textAlign = 'left';
            ctx.fillStyle = '#87a997';
            ctx.font = canvasFont(10, 'data');
            ctx.fillText(`${Math.round(power.generationKw)} / ${Math.round(power.demandKw)} kW`, 9, 67);
            ctx.textAlign = 'right';
            ctx.fillText(`RES ${Math.round(power.reserveFraction * 100)}%`, w - 9, 67);
            ctx.textAlign = 'left';
        }
        screen.texture.needsUpdate = true;
    }
    function updateCockpitInstruments(data = {}) {
        const key = JSON.stringify(data);
        if (key === cockpitInstrumentKey) return;
        cockpitInstrumentKey = key;
        const s = data.systems ?? {};
        drawSystemScreen(cockpit.userData.instrumentScreens.systems, s);
        drawWeaponScreen(cockpit.userData.instrumentScreens.weapon, data);
        drawTeamScreen(cockpit.userData.instrumentScreens.team, data.team);
        const values = Object.values(s).map(value => Number(value) || 0);
        const lowest = values.length ? Math.min(...values) : 100;
        cockpitWarningLevel = Math.max(0, Math.min(2, Number(data.warning) || 0));
        persistentPowerHealth = Math.max(0, Math.min(1, Number(s.power ?? 100) / 100));
        persistentCommandHealth = Math.max(0, Math.min(1, Number(s.command ?? 100) / 100));
        driveLeftHealth = Math.max(0, Math.min(1, Number(data.drive?.left ?? 1)));
        driveRightHealth = Math.max(0, Math.min(1, Number(data.drive?.right ?? 1)));
        if (lowest >= 72) cockpitWarningLevel = Math.min(cockpitWarningLevel, 0);
        redrawCracks(Number(s.command ?? 100));
    }
    function updateCockpitMotion(data = {}) {
        const normalized = {
            speed: Number(data.speed ?? 0).toFixed(1),
            direction: String(data.direction ?? 'IDLE'),
            turnRate: Math.round(Number(data.turnRate) || 0),
            driveLoad: Math.round(Math.max(0, Math.min(1, Number(data.driveLoad) || 0)) * 100) / 100,
            brace: Math.round(Math.max(0, Math.min(1, Number(data.brace) || 0)) * 10) / 10,
            slip: Math.round(Math.max(0, Number(data.slip) || 0) * 10) / 10,
            recoil: Math.round(Math.max(0, Math.min(1, Number(data.recoil) || 0)) * 10) / 10,
            footing: Math.round(Math.max(0, Math.min(1, Number(data.footing) || 0)) * 10) / 10,
            power: data.power ? {
                generationKw: Math.round(Number(data.power.generationKw) || 0),
                demandKw: Math.round(Number(data.power.demandKw) || 0),
                busRatio: Math.round(Math.max(0,Math.min(1,Number(data.power.busRatio) || 0))*100)/100,
                reserveFraction: Math.round(Math.max(0,Math.min(1,Number(data.power.reserveFraction) || 0))*100)/100,
            } : null,
        };
        const key = JSON.stringify(normalized);
        if (key === cockpitMotionKey) return;
        cockpitMotionKey = key;
        drawMotionScreen(cockpit.userData.instrumentScreens.motion, normalized);
        drawDriveScreen(cockpit.userData.instrumentScreens.drive, normalized.driveLoad, normalized.power);
    }
    function spawnCockpitPowerArc(strength = 1) {
        cockpit.updateWorldMatrix(true, true);
        const anchors = [
            [-.58,1.88,-.93],[.55,2.10,-.82],[-.72,2.46,-.64],[.67,2.56,-.62],[.18,1.78,-1.04]
        ];
        const a = anchors[Math.floor(Math.random() * anchors.length)];
        let b = anchors[Math.floor(Math.random() * anchors.length)];
        if (b === a) b = anchors[(anchors.indexOf(a) + 1) % anchors.length];
        const start = cockpit.localToWorld(new THREE.Vector3(...a));
        const end = cockpit.localToWorld(new THREE.Vector3(...b));
        const points = [start.clone()];
        const segments = 6;
        for (let i = 1; i < segments; i++) {
            const t = i / segments;
            const p = start.clone().lerp(end, t);
            p.x += (Math.random() - .5) * .12 * strength;
            p.y += (Math.random() - .5) * .10 * strength;
            p.z += (Math.random() - .5) * .08 * strength;
            points.push(p);
        }
        points.push(end.clone());
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({ color: Math.random() > .35 ? 0xc8fff2 : 0xffe58d, transparent: true, opacity: 1, depthTest: false });
        const line = new THREE.Line(geometry, material); line.renderOrder = 30; scene.add(line);
        transientFX.push({ object: line, remaining: .09 + Math.random() * .09, duration: .18, material });
        for (let i = 1; i < points.length - 1; i += 2)
            activateParticle(sparkPool, 'spark', points[i], new THREE.Vector3((Math.random()-.5)*1.5, -.2-Math.random()*1.8, (Math.random()-.5)*1.2), 1.4 * strength, .28 + Math.random()*.24, -3.2, 0, 0xe6fff1);
    }
    function triggerCockpitHit(slot, profile = {}) {
        const severity = Math.max(0, Math.min(1, Number(profile.severity) || 0));
        hitPitchKick += Number(profile.pitch) || 0;
        hitRollKick += Number(profile.roll) || 0;
        hitYawKick += Number(profile.yaw) || 0;
        hitShakeKick = Math.max(hitShakeKick, Number(profile.shake) || 0);
        gunDamageKick = Math.max(gunDamageKick, Number(profile.gunShake) || 0);
        powerBlackout = Math.max(powerBlackout, Number(profile.blackoutSeconds) || 0);
        powerFlicker = Math.max(powerFlicker, Number(profile.flickerSeconds) || 0);
        cockpit.updateWorldMatrix(true, true);
        const localBySlot = {
            structure: [0, 2.05, -.82], mobility: [-.62, 1.58, -.82], power: [-.32, 1.83, -1.02],
            command: [0, 2.72, -.61], combat: [.86, 2.08, -.72],
        };
        const origin = cockpit.localToWorld(new THREE.Vector3(...(localBySlot[slot] ?? [0,2,-.8])));
        const count = Math.max(1, Math.min(18, Math.round(profile.sparkCount ?? 1)));
        const sparkScale = Math.max(.6, Number(profile.sparkScale) || 1);
        for (let i = 0; i < count; i++) {
            const downward = i % 3 === 0;
            const velocity = new THREE.Vector3((Math.random() - .5) * 4.0, downward ? -.4 - Math.random() * 2.0 : .5 + Math.random() * 3.4, (Math.random() - .5) * 3.0);
            activateParticle(sparkPool, 'spark', origin, velocity, sparkScale * (.75 + severity * .95), .24 + Math.random() * .42, -4.7, 0, i % 4 ? 0xffc866 : 0xfff4c2);
        }
        const arcs = Math.max(0, Math.min(5, Math.round(profile.arcCount ?? 0)));
        for (let i = 0; i < arcs; i++) spawnCockpitPowerArc(.85 + severity * .7);
    }
    function resetCockpitTransientFeedback() {
        hitPitchKick = hitRollKick = hitYawKick = hitShakeKick = gunDamageKick = 0;
        pilotFeet=null;pilotLandingKick=0;
        Object.assign(pilotHitResponse,createHitResponse());
        powerBlackout = powerFlicker = 0;
        powerArcCooldown = 1.8;
        combinerHud.position.set(0, 0, 0);
        blackoutMaterial.opacity = 0;
    }
    function activateParticle(pool, cursorName, position, velocity, scale, duration, gravity = 0, grow = 0, color = null, smoke = false) {
        let cursor = cursorName === 'spark' ? sparkCursor : cursorName === 'chip' ? chipCursor : smokeCursor;
        const state = pool[cursor % pool.length];
        if (cursorName === 'spark')
            sparkCursor = (cursor + 1) % pool.length;
        else if (cursorName === 'chip')
            chipCursor = (cursor + 1) % pool.length;
        else
            smokeCursor = (cursor + 1) % pool.length;
        state.mesh.position.copy(position);
        state.velocity.copy(velocity);
        state.life = state.duration = duration;
        state.gravity = gravity;
        state.grow = grow;
        state.baseScale = scale;
        state.smoke = smoke;
        state.mesh.scale.setScalar(scale);
        state.mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        if (color !== null)
            state.mesh.material.color.setHex(color);
        state.mesh.material.opacity = smoke ? .48 : 1;
        state.mesh.visible = true;
    }
    function randomBurstDirection(normal, spread = .9) {
        const random = new THREE.Vector3(Math.random() - .5, Math.random() * .8, Math.random() - .5).normalize();
        return normal.clone().multiplyScalar(1.1).addScaledVector(random, spread).normalize();
    }
    function spawnImpactParticles(position, normal, outcome) {
        const profile = impactProfile(outcome);
        const language=hitMaterialLanguage(outcome);
        const electric=language==='electric'||
            language==='catastrophic'&&outcome?.slot==='power';
        const metalBreach=language==='breach'||language==='hydraulic';
        const primary=electric?0x96ebde:metalBreach?0xffa166:
            language==='armor-break'?0xffd38a:0xffe7aa;
        const debris=language==='hydraulic'?0x58482e:
            language==='armor-break'?0xafa38e:0x56534c;
        if (outcome?.internalDamage > 0)
            flashDamageLight(position, outcome.slot === 'power' ? 0xc8fff2 : 0xffb56b, outcome.slot === 'power' ? 10 : 5.5, .075, 4.6);
        activateParticle(sparkPool, 'spark', position, normal.clone().multiplyScalar(.18), profile.flashScale * 1.25, .085, 0, 0, primary);
        for (let i = 0; i < profile.sparkCount; i++) {
            const direction = randomBurstDirection(normal, 1.15);
            const speed = 1.8 + Math.random() * 3.4;
            activateParticle(sparkPool, 'spark', position, direction.multiplyScalar(speed), .7 + Math.random() * .7, .18 + Math.random() * .22, -4.2, 0, Math.random() > .22 ? primary : 0xfff0bc);
        }
        for (let i = 0; i < profile.chipCount; i++) {
            const direction = randomBurstDirection(normal, 1.35);
            const speed = .8 + Math.random() * 2.1;
            activateParticle(chipPool, 'chip', position, direction.multiplyScalar(speed), .7 + Math.random() * .8, .45 + Math.random() * .45, -7.2, 0, Math.random() > .35 ? debris : 0x8c7956);
        }
        for (let i = 0; i < profile.smokeCount; i++) {
            const drift = new THREE.Vector3((Math.random() - .5) * .25, .28 + Math.random() * .28, (Math.random() - .5) * .25);
            activateParticle(smokePool, 'smoke', position, drift, .72 + Math.random() * .5, .75 + Math.random() * .55, 0, .8, electric?0x1b3431:language==='hydraulic'?0x373b2e:0x242824, true);
        }
        return profile;
    }
    function recordDamageWound(actorId, slot, worldPoint) {
        const record = squadCombatants.get(actorId);
        const group = record?.exterior.partGroups.get(slot);
        if (!record || !group || !worldPoint) return;
        group.updateWorldMatrix(true, false);
        const local = group.worldToLocal(worldPoint.clone());
        const wounds = record.wounds.get(slot) ?? [];
        wounds.push(local.clone());
        if (wounds.length > 2) wounds.shift();
        record.wounds.set(slot, wounds);
        // Keep this actual hit point for subsequent smoke and sparks only.
        // SurfaceDamageRenderer now owns persistent visible scars so one hit
        // cannot become both a round breach and an old generic black blob.
    }
    function weaponServicePoint(record) {
        const group = record?.exterior.partGroups.get('combat');
        const point = new THREE.Vector3(0, .02, .30);
        if (group) {
            group.updateWorldMatrix(true, true);
            return group.localToWorld(point);
        }
        record?.exterior.root.updateWorldMatrix(true, true);
        return record?.exterior.root.localToWorld(new THREE.Vector3(.75, 2.0, -.25)) ?? point;
    }
    function partWorldPoint(record, slot) {
        const group = record?.exterior.partGroups.get(slot);
        const wounds = record?.wounds?.get(slot) ?? [];
        const point = new THREE.Vector3();
        if (group && wounds.length && Math.random() < .82) {
            point.copy(wounds[Math.floor(Math.random() * wounds.length)]);
            group.localToWorld(point);
            point.x += (Math.random() - .5) * .10;
            point.y += (Math.random() - .5) * .08;
            point.z += (Math.random() - .5) * .10;
        } else {
            if (group) group.getWorldPosition(point); else record?.exterior.root.getWorldPosition(point);
            point.x += (Math.random() - .5) * .26;
            point.y += (Math.random() - .5) * .20;
            point.z += (Math.random() - .5) * .26;
        }
        return point;
    }
    function spawnDisableBurst(position, normal, outcome) {
        const flashMat = new THREE.MeshBasicMaterial({ color: outcome?.slot === 'power' ? 0xffd27a : 0xffa75b, transparent: true, opacity: .94, depthWrite: false });
        const flash = new THREE.Mesh(new THREE.IcosahedronGeometry(outcome?.slot === 'power' ? .36 : .27, 0), flashMat);
        flashDamageLight(position, outcome?.slot === 'power' ? 0xd9fff1 : 0xffa75b, outcome?.slot === 'power' ? 13 : 8, .12, 6);
        flash.position.copy(position);
        scene.add(flash);
        transientFX.push({ object: flash, remaining: .16, duration: .16, material: flashMat });
        for (let i = 0; i < (outcome?.wreckHit ? 8 : 6); i++) {
            const direction = randomBurstDirection(normal, 1.65);
            activateParticle(chipPool, 'chip', position, direction.multiplyScalar(1.2 + Math.random() * 3.0), 1.8 + Math.random() * 1.8, .75 + Math.random() * .75, -7.4, 0, Math.random() > .45 ? 0x4a4d46 : 0x9b7542);
        }
        for (let i = 0; i < 3; i++) {
            const drift = new THREE.Vector3((Math.random() - .5) * .45, .35 + Math.random() * .35, (Math.random() - .5) * .45);
            activateParticle(smokePool, 'smoke', position, drift, 1.0 + Math.random() * .55, 1.15 + Math.random() * .8, 0, 1.15, 0x252722, true);
        }
    }
    function markPartDisabledVisual(actorId, slot) {
        const record = squadCombatants.get(actorId);
        if (!record || record.disabledSlots.has(slot)) return;
        record.disabledSlots.add(slot);
        const group = record.exterior.partGroups.get(slot);
        if (!group) return;
        const side = actorId.length % 2 ? 1 : -1;
        group.rotation.z += side * (slot === 'mobility' ? .055 : .11);
        group.rotation.x += slot === 'combat' ? .09 : .035;
        group.position.y -= slot === 'mobility' ? .035 : .065;
    }
    function spawnWorldPowerArc(origin, strength = 1) {
        const end = origin.clone().add(new THREE.Vector3((Math.random()-.5)*1.5, .35+Math.random()*1.25, (Math.random()-.5)*1.5));
        const points = [origin.clone()];
        for (let i = 1; i < 7; i++) {
            const p = origin.clone().lerp(end, i / 7);
            p.x += (Math.random()-.5) * .22 * strength;
            p.y += (Math.random()-.5) * .18 * strength;
            p.z += (Math.random()-.5) * .22 * strength;
            points.push(p);
        }
        points.push(end);
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({ color: Math.random() > .3 ? 0xc8fff2 : 0xffe58d, transparent: true, opacity: 1 });
        const line = new THREE.Line(geometry, material); scene.add(line);
        if (Math.random() < .45) flashDamageLight(origin, 0xc8fff2, 7 * strength, .08, 5.5);
        transientFX.push({ object: line, remaining: .12 + Math.random()*.12, duration: .24, material });
    }
    function spawnCatastrophicBurst(position, normal, outcome) {
        const power = outcome?.slot === 'power';
        const flashMat = new THREE.MeshBasicMaterial({ color: power ? 0xf4ffd9 : 0xffbd70, transparent: true, opacity: 1, depthWrite: false });
        const flash = new THREE.Mesh(new THREE.IcosahedronGeometry(power ? .58 : .46, 0), flashMat);
        flashDamageLight(position, power ? 0xc8fff2 : 0xffbd70, power ? 22 : 14, .18, power ? 8 : 6.5);
        flash.position.copy(position); scene.add(flash);
        transientFX.push({ object: flash, remaining: .22, duration: .22, material: flashMat });
        for (let i = 0; i < (power ? 28 : 22); i++) {
            const direction = randomBurstDirection(normal, 2.0);
            activateParticle(sparkPool, 'spark', position, direction.multiplyScalar(2.2 + Math.random()*5.0), 1.2 + Math.random()*1.5, .28 + Math.random()*.48, -4.5, 0, i % 4 ? 0xffcf70 : 0xfff6c9);
        }
        for (let i = 0; i < (outcome?.slot === 'mobility' ? 18 : 14); i++) {
            const direction = randomBurstDirection(normal, 2.1);
            activateParticle(chipPool, 'chip', position, direction.multiplyScalar(1.4 + Math.random()*3.8), 1.8 + Math.random()*2.3, .75 + Math.random()*.95, -8.2, 0, i % 3 ? 0x30332f : 0x9b7542);
        }
        for (let i = 0; i < (power ? 9 : 6); i++) {
            const drift = new THREE.Vector3((Math.random()-.5)*.42, .35+Math.random()*.52, (Math.random()-.5)*.42);
            activateParticle(smokePool, 'smoke', position, drift, 1.15+Math.random()*.75, 1.5+Math.random()*1.2, 0, 1.45, 0x171a17, true);
        }
        if (power) for (let i = 0; i < 3; i++) spawnWorldPowerArc(position, .9 + Math.random()*.6);
    }
    function settleAttachedPartToFloor(group, clearance = .025) {
        group.updateWorldMatrix(true, true);
        const bounds = new THREE.Box3().setFromObject(group);
        if (Number.isFinite(bounds.min.y) && bounds.min.y > clearance)
            group.position.y -= bounds.min.y - clearance;
    }
    function markPartDestroyedVisual(actorId, slot) {
        const record = squadCombatants.get(actorId);
        if (!record || record.destroyedSlots.has(slot)) return;
        record.destroyedSlots.add(slot);
        const group = record.exterior.partGroups.get(slot);
        if (!group) return;
        const side = actorId.length % 2 ? 1 : -1;
        if (slot === 'combat' || slot === 'power') {
            group.updateWorldMatrix(true, true);
            arenaPresentationRoot.attach(group);
            group.rotation.x += slot === 'combat' ? .46 : .31;
            group.rotation.z += side * (slot === 'combat' ? .78 : .58);
            // A one-time conservative radius avoids a full hierarchy Box3
            // traversal on every airborne frame of a detached module.
            const detachedBounds=new THREE.Box3().setFromObject(group);
            const detachedSphere=detachedBounds.getBoundingSphere(new THREE.Sphere());
            const fallRadius=detachedSphere.radius+
                detachedSphere.center.distanceTo(group.getWorldPosition(new THREE.Vector3()));
            fallingParts.set(`${actorId}:${slot}`, {
                fallRadius,
                actorId, slot, record, group, settled: false,
                velocity: new THREE.Vector3(side * (.28 + Math.random() * .30), .35 + Math.random() * .48, (Math.random() - .5) * .65),
                spin: new THREE.Vector3((Math.random() - .5) * 1.4, (Math.random() - .5) * .65, side * (.8 + Math.random() * 1.1)),
            });
        } else if (slot === 'mobility') {
            const family=installedPart(record.assembly,'mobility')?.definition.id;
            const fail=familyFailureAnatomy(family,{mobilityDestroyed:true});
            group.rotation.z += side * (fail.rootRoll+.20);
            group.rotation.x += fail.rootPitch+.06;
            settleAttachedPartToFloor(group, .02);
        } else if (slot === 'command') {
            group.position.y -= .18; group.rotation.z += side * .27; group.rotation.x += .14;
        } else if (slot === 'structure') {
            record.exterior.root.rotation.z += side * .13;
            record.exterior.root.position.y -= .09;
        }
    }
    function wreckCombatantVisual(record) {
        record.wrecked = true;
        record.cleared = false;
        const side = record.id.length % 2 ? 1 : -1;
        const family=installedPart(record.assembly,'mobility')?.definition.id;
        const fail=familyFailureAnatomy(family,{
            mobilityDisabled:record.disabledSlots.has('mobility'),
            mobilityDestroyed:record.destroyedSlots.has('mobility'),
            structureDisabled:record.disabledSlots.has('structure'),
            structureDestroyed:record.destroyedSlots.has('structure'),
            active:false,
        });
        record.exterior.root.rotation.z = side * (fail.rootRoll+.02);
        record.exterior.root.rotation.x = fail.rootPitch+.018;
        record.exterior.root.position.y = -fail.rootDrop;
        for (const slot of ['power', 'structure']) {
            const group = record.exterior.partGroups.get(slot);
            if (!group) continue;
            const point = group.getWorldPosition(new THREE.Vector3());
            spawnDisableBurst(point, new THREE.Vector3(0, 1, 0), { slot, wreckHit: true });
        }
    }
    function resetCombatantVisual(record) {
        record.wrecked = false;
        record.cleared = false;
        record.recoilKick = 0;
        record.hitResponse=createHitResponse();
        record.lastMobilityHitSide=0;
        record.footContacts=null;
        clearFractures(record.fractureParts);
        if (record.articulation) {
            record.articulation.phase = 0;
            record.articulation.weight = 0;
            record.articulation.aim={waist:0,gun:0,elevation:0};
            for (const joint of record.articulation.joints) joint.object.rotation.copy(joint.base);
        }
        record.disabledSlots.clear();
        record.destroyedSlots.clear();
        record.exterior.root.position.y = 0;
        record.exterior.root.rotation.x = 0;
        record.exterior.root.rotation.z = 0;
        for (const slot of SLOTS) {
            fallingParts.delete(`${record.id}:${slot}`);
            const group = record.exterior.partGroups.get(slot);
            const base = record.baseParts.get(slot);
            if (!group || !base) continue;
            if (base.parent && group.parent !== base.parent) base.parent.add(group);
            group.position.copy(base.position);
            group.rotation.copy(base.rotation);
            group.scale.copy(base.scale);
            record.wounds.set(slot, []);
        }
        while (record.woundMarks.length) {
            const mark = record.woundMarks.pop(); mark.parent?.remove(mark); mark.geometry.dispose(); mark.material.dispose();
        }
    }
    function clearPooledParticles() {
        for(const streak of ricochetLines){streak.life=0;streak.line.visible=false;}
        lastNearMissAt=lastCoverSoundAt=-Infinity;
        for (const state of particleStates) {
            state.life = 0;
            state.mesh.visible = false;
        }
        for (const record of squadCombatants.values()) {
            for (const budget of record.emitterBudget.values()) {
                budget.spark = 0;
                budget.smoke = 0;
                budget.arc = 0;
                budget.fluid = 0;
            }
        }
    }
    // Ring, not another obstacle or an invisible hit volume.
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.75, 1.84, 32), new THREE.MeshBasicMaterial({ color: 0xcf9750, side: THREE.DoubleSide, transparent: true, opacity: .52 }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(hostileSpawn.x, .035, hostileSpawn.z);
    arenaPresentationRoot.add(ring);
    const pilotRing = new THREE.Mesh(new THREE.RingGeometry(1.75, 1.84, 32), new THREE.MeshBasicMaterial({ color: C.green, side: THREE.DoubleSide, transparent: true, opacity: .26 }));
    pilotRing.rotation.x = -Math.PI / 2;
    pilotRing.position.set(playerSpawn.x, .034, playerSpawn.z);
    arenaPresentationRoot.add(pilotRing);
    const objectiveMaterial = new THREE.MeshBasicMaterial({ color: 0xd7a24b, side: THREE.DoubleSide, transparent: true, opacity: .58, depthWrite: false });
    const objectiveRing = new THREE.Mesh(new THREE.RingGeometry(.90, 1, 48), objectiveMaterial);
    objectiveRing.rotation.x = -Math.PI / 2;
    objectiveRing.position.y = .045;
    objectiveRing.visible = false;
    arenaPresentationRoot.add(objectiveRing);
    const dominationMarkers=new Map();
    const dominationRoot=new THREE.Group();
    dominationRoot.name='three-point-territory';
    arenaPresentationRoot.add(dominationRoot);
    function dominationMarker(id) {
        if(dominationMarkers.has(id))return dominationMarkers.get(id);
        const group=new THREE.Group();
        const zoneMat=new THREE.MeshBasicMaterial({
            color:0x89958d,side:THREE.DoubleSide,transparent:true,opacity:.67,depthWrite:false,
        });
        const zone=new THREE.Mesh(new THREE.RingGeometry(.95,1,48),zoneMat);
        zone.rotation.x=-Math.PI/2;zone.position.y=.055;group.add(zone);
        const post=new THREE.Mesh(new THREE.CylinderGeometry(.075,.13,2.25,6),
            new THREE.MeshStandardMaterial({color:0x414a44,metalness:.55,roughness:.72}));
        post.position.y=1.18;group.add(post);
        const beaconMat=new THREE.MeshBasicMaterial({color:0x89958d});
        const beacon=new THREE.Mesh(new THREE.BoxGeometry(.37,.19,.37),beaconMat);
        beacon.position.y=2.39;group.add(beacon);
        // Physically planted letter placard; billboarding preserves readability
        // from either spawn without an intrusive floating giant 3D UI.
        const canvas=document.createElement('canvas');
        canvas.width=128;canvas.height=128;
        const ctx=canvas.getContext('2d');
        const drawMarker=()=>{
            ctx.clearRect(0,0,128,128);
            ctx.fillStyle='#142019';ctx.fillRect(8,8,112,112);
            ctx.strokeStyle='#d6ae62';ctx.lineWidth=8;ctx.strokeRect(9,9,110,110);
            ctx.fillStyle='#f3d28b';ctx.font = canvasFont(86, 'identity');
            ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(id,64,70,104);
        };
        drawMarker();
        const tex=new THREE.CanvasTexture(canvas);
        whenGameFontsReady(()=>{drawMarker();tex.needsUpdate=true;});
        const sprite=new THREE.Sprite(new THREE.SpriteMaterial({
            map:tex,transparent:true,depthTest:false,
        }));
        sprite.position.y=3.35;sprite.scale.set(1.5,1.5,1);group.add(sprite);
        dominationRoot.add(group);
        const marker={group,zone,zoneMat,beaconMat,sprite};
        dominationMarkers.set(id,marker);
        return marker;
    }
    function updateObjectivePresentation(presentation) {
        const domination=presentation?.visible && presentation.type==='domination';
        objectiveRing.visible=!!presentation?.visible&&!domination;
        dominationRoot.visible=!!domination;
        if(domination){
            for(const p of presentation.points??[]){
                const marker=dominationMarker(p.id);
                marker.group.position.set(p.x,0,p.z);
                marker.zone.scale.setScalar(Math.max(2,Number(presentation.radius)||4.7));
                const tone=p.contested?0xe39855:p.owner==='friendly'?0x79c4a0:
                    p.owner==='hostile'?0xd87969:0x9b9e94;
                marker.zoneMat.color.setHex(tone);
                marker.zoneMat.opacity=p.contested?.96:.72;
                marker.beaconMat.color.setHex(tone);
                marker.zone.material.needsUpdate=true;
            }
            return;
        }
        if (!presentation?.visible) return;
        objectiveRing.position.set(presentation.point?.x ?? 0, .045, presentation.point?.z ?? 0);
        const radius = Math.max(1, Number(presentation.radius) || 5);
        objectiveRing.scale.set(radius, radius, radius);
        objectiveMaterial.color.setHex(presentation.contested ? 0xe16d4e : 0xd7a24b);
        objectiveMaterial.opacity = presentation.contested ? .82 : .58;
    }
    const pilotFiringState=createFiringEventState();
    let pilotFiringPose=pilotFiringState.pose;
    let muzzleFlash = 0;
    let pilotWeaponPresentation = { visualRecoil: 1, visualRecovery: 3.6, muzzleFlashSeconds: .10 };
    let pilotWeaponFault = false, pilotWeaponServicing = false, pilotServiceSlot = null, pilotServiceSparkBudget = 0;
    let pilotWeaponRecoveryKick = 0, pilotRecoveryBurstPending = false;
    let exterior = buildExteriorRig(initial);
    calibrateExteriorSoles(exterior);
    for (const mesh of exterior.pickMeshes)
        mesh.userData.actorId = 'player';
    scene.add(exterior.root);
    exterior.root.visible = false;
    const captureColors = (meshes) => {
        const colors = new WeakMap();
        for (const mesh of meshes) {
            const material = mesh.material;
            if (material instanceof THREE.MeshStandardMaterial)
                colors.set(mesh, material.color.clone());
        }
        return colors;
    };
    let pilotColors = captureColors(exterior.pickMeshes);
    let inspectionBaseParts=capturePartTransforms(exterior);
    let inspectionJoints=captureArticulation(exterior).joints;
    function refreshInspectionBase(){
        // The graph bridge may reposition physical stations after buildExteriorRig.
        // Capture that final assembled pose, not the temporary pre-graph position.
        inspectionBaseParts=capturePartTransforms(exterior);
        inspectionJoints=captureArticulation(exterior).joints;
    }
    let latestPilotParts=null;
    function poseDamagedMachineInGarage() {
        if(!inspecting||animationPreviewMode!=='off'||!latestPilotParts)return;
        refreshPhysicalServiceBay();
        const mobility=installedPart(previewAssembly,'mobility')?.definition.id||'legs-yard';
        const failure=familyFailureAnatomy(mobility,conditionFailureFlags(latestPilotParts));
        exterior.root.rotation.x=failure.rootPitch;
        exterior.root.rotation.z=failure.rootRoll;
        exterior.root.position.y=(exterior.groundOffset??0)+GARAGE_PAD_TOP_Y-failure.rootDrop;
        // Reset every joint to its authored rest before applying the damaged
        // posture: no accumulating rotations, regardless of inspection duration.
        for(const joint of inspectionJoints){
            joint.object.rotation.copy(joint.base);
            const side=joint.side;
            const leg=failure.legs.find(item=>item.side===side);
            if(leg && Object.hasOwn(leg,joint.joint))
                joint.object.rotation.x+=leg[joint.joint];
        }
        for(const [slot,group] of exterior.partGroups){
            const base=inspectionBaseParts.get(slot);
            if(!base)continue;
            group.position.copy(base.position);
            group.rotation.copy(base.rotation);
            const pose=physicalFailurePose(slot,latestPilotParts[slot]);
            group.position.y+=pose.y;
            group.rotation.x+=pose.x;
            group.rotation.z+=pose.z;
        }
    }
    // Empty ports are physical, touchable workshop fixtures, not combat hitboxes.
    // Markers only represent stations that can currently be approached on the rig.
    let emptyMountPicks = [];
    function rebuildEmptyMountPicks(assembly) {
        emptyMountPicks = [];
        // An empty pad has no mid-air connection sockets. Station selection is
        // always available on the left rail; transparent targets remain only
        // for empty positions around an actual installed structural frame.
        if (!exterior.root || !installedPart(assembly, 'structure')) return;
        const anchors = new THREE.Group();
        anchors.name = 'garage-empty-mounts';
        for (const slot of SLOTS) {
            if (installedPart(assembly, slot)) continue;
            if (slot !== 'structure' && !installedPart(assembly, 'structure')) continue;
            const point = SLOT_CENTERS[slot];
            const bracket = new THREE.Group();
            bracket.position.set(point[0],point[1],point[2]);
            // Invisible touch geometry only: drawing a plus or floating plate
            // at a catalogue datum implied physical connectors that aren't here.
            const hit = new THREE.Mesh(new THREE.BoxGeometry(.62,.42,.58),
                new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false,side:THREE.DoubleSide}));
            hit.userData.slot=slot;
            bracket.add(hit);
            emptyMountPicks.push(hit);
            anchors.add(bracket);
        }
        exterior.root.add(anchors);
    }
    rebuildEmptyMountPicks(initial);
    const raycaster = new THREE.Raycaster();
    // Mesh raycasts remain responsible for exact module hits. This independent prism
    // certificate makes arena cover authoritative too, so a precision seam or visual
    // cover decoration can never permit a target hit through the obstacle volume.
    function certifiedCoverHit(muzzle, bore, maxDistance, actual) {
        const meshDistance = actual ? muzzle.distanceTo(actual.point) : maxDistance;
        const cover = firstCoverHit(muzzle, bore, world.obstacles, maxDistance, .035);
        if (!cover || cover.distance >= meshDistance - .005) return null;
        return {
            id: cover.id,
            distance: cover.distance,
            point: new THREE.Vector3(...cover.point),
            normal: new THREE.Vector3(...cover.normal),
        };
    }
    let selected = null;
    let inspecting = false;
    let azimuth = 0.68;
    let elevation = 0.25;
    let radius = 6.05;
    let orbitAssist = null; // shortcut-only reveal; manual orbit always wins
    const orbitTarget = new THREE.Vector3(0, 1.85, 0);
    const desiredTarget = orbitTarget.clone();
    let panelRightPx = 0;
    let viewportWidth = 1;
    let viewportHeight = 1;
    // Presentation-only observer of a surviving allied chassis. Its camera
    // state is persistent across frames; never turn it into an actor controller.
    let spectatorRig = null;
    let spectatorCameraReady = false;
    const spectatorCameraPosition = new THREE.Vector3();
    const spectatorDesired = new THREE.Vector3();
    const spectatorLook = new THREE.Vector3();
    let spectatorAzimuth=0,spectatorElevation=.20,spectatorRadius=5.8;
    function orbitSpectatorBy(dx,dy){
        spectatorAzimuth-=dx*.008;
        spectatorElevation=THREE.MathUtils.clamp(spectatorElevation+dy*.006,-.15,.95);
    }
    function zoomSpectatorBy(scale){
        if(Number.isFinite(scale)&&scale>0)spectatorRadius=THREE.MathUtils.clamp(spectatorRadius/scale,3.4,13.5);
    }
    function resetSpectatorOrbit(){spectatorAzimuth=0;spectatorElevation=.20;spectatorRadius=5.8;}
    function setSpectatorRig(rig = null) {
        if (spectatorRig !== rig) spectatorCameraReady = false;
        spectatorRig = rig;
        cockpit.visible = !inspecting && !spectatorRig;
        combinerHud.visible = !inspecting && !spectatorRig;
    }
    let visualYaw = 0;
    let visualX = 0;
    let visualZ = 8;
    let cockpitHeave = 0;
    let cockpitRoll = 0;
    let cockpitPitch = 0;
    const gunPivot = cockpit.userData.gunPivot;
    const flashMesh = cockpit.userData.flashMesh;
    let previewAssembly=initial;
    let animationPreviewMode='off',animationPreviewSpeed=3,previewTime=0,
        previewRecord=null;
    function restoreInspectionPose(){
        if(!previewRecord||previewRecord.exterior!==exterior)return;
        for(const joint of previewRecord.articulation.joints)
            joint.object.rotation.copy(joint.base);
        for(const [slot,base] of previewRecord.baseParts){
            const group=exterior.partGroups.get(slot);
            if(!group)continue;
            group.position.copy(base.position);
            group.rotation.copy(base.rotation);
        }
        const mechanism=exterior.partGroups.get('combat')?.userData.weaponMechanism;
        if(mechanism){
            mechanism.carriage.position.copy(mechanism.rest.carriage);
            if(mechanism.rest.carriageRotation)
                mechanism.carriage.rotation.copy(mechanism.rest.carriageRotation);
            mechanism.bolt.position.copy(mechanism.rest.bolt);
            if(mechanism.cassette && mechanism.rest.cassette){
                mechanism.cassette.position.copy(mechanism.rest.cassette);
                mechanism.cassette.rotation.set(0,0,0);
            }
            poseReloadHardware(mechanism,null);
        }
    }
    // Standalone DEV proving ground uses the actual player model with no AI,
    // combat, expenses or persistent state. A chase camera can inspect feet.
    let pilotingLab=false,labRecord=null;
    function setPilotingLab(enabled,showExterior=true){
        pilotingLab=!!enabled;
        labRecord=null;
        targetExterior.root.visible=!pilotingLab;
        exterior.root.visible=pilotingLab?!!showExterior:inspecting;
        for(const record of squadCombatants.values()){
            record.exterior.root.visible=!pilotingLab&&!inspecting;
            record.marker.visible=!pilotingLab&&!inspecting;
        }
    }
    function updatePilotingLabRig(state,gait,dt){
        if(!pilotingLab)return;
        if(!labRecord||labRecord.exterior!==exterior){
            labRecord={
                id:'piloting-lab',active:true,wrecked:false,cleared:false,
                assembly:previewAssembly,exterior,disabledSlots:new Set(),
                destroyedSlots:new Set(),articulation:captureArticulation(exterior),
                baseParts:capturePartTransforms(exterior),recoilKick:0,
                weaponRecoveryKick:0,
            };
        }
        poseCombatantExterior(labRecord,state,{
            dt,gait,posture:{animationHealth:1},weaponFault:false,
        });
    }
    function pilotingLabFootReadout(){
        const contacts=labRecord?.footContacts;
        return contacts?{
            feet:contacts.feet.map(f=>({side:f.side,mode:f.mode,
                x:f.localX??0,z:f.localZ??0})),
            pivot:contacts.pivot,landings:contacts.landings,
            planted:contacts.stanceCount,loadShift:contacts.weightShift,
            effort:contacts.actuatorEffort,compression:contacts.bodyCompression,
            gaitMode:contacts.gaitMode,maneuver:contacts.maneuver,recovery:contacts.recovery,
            flow:contacts.flow,catchSteps:contacts.catchStepCount,
            preparing:contacts.preparingSide,
        }:null;
    }
    function setAnimationPreview(mode='off',speed=3){
        const safe=['off','walk','strafe-left','strafe-right','turn','reload','disabled'].includes(mode)?mode:'off';
        if(animationPreviewMode!==safe){
            restoreInspectionPose();
            previewTime=0;previewRecord=null;
        }
        animationPreviewMode=safe;
        animationPreviewSpeed=THREE.MathUtils.clamp(Number(speed)||3,.5,6);
        if(safe==='off')restoreInspectionPose();
        return {mode:safe,speed:animationPreviewSpeed};
    }
    function poseInspectionPreview(dt){
        if(animationPreviewMode==='off'||vendorEnabled)return;
        if(!previewRecord||previewRecord.exterior!==exterior){
            previewRecord={
                id:'inspection-preview',active:true,wrecked:false,cleared:false,
                assembly:previewAssembly,exterior,
                disabledSlots:new Set(),destroyedSlots:new Set(),
                articulation:captureArticulation(exterior),
                baseParts:capturePartTransforms(exterior),
                recoilKick:0,weaponRecoveryKick:0,
            };
        }
        const a=previewRecord;
        const sideStep=animationPreviewMode==='strafe-left'?-1:
            animationPreviewMode==='strafe-right'?1:0;
        const moving=animationPreviewMode==='walk'||animationPreviewMode==='turn'||sideStep!==0;
        const family=installedPart(a.assembly,'mobility')?.definition.id;
        const style=familyAnimation(family);
        previewTime+=dt;
        const speed=moving?animationPreviewSpeed:0;
        if(moving)a.articulation.phase+=Math.PI*speed*dt/style.stride;
        a.disabledSlots.clear();
        if(animationPreviewMode==='disabled'){
            a.disabledSlots.add('mobility');
            a.disabledSlots.add('combat');
        }
        const turn=animationPreviewMode==='turn'?Math.sin(previewTime*.63)*.28:0;
        const reloading=animationPreviewMode==='reload';
        const weaponId=installedPart(a.assembly,'combat')?.definition.id;
        const total=WEAPONS[weaponId]?.reloadSeconds??2.5;
        const reloadLeft=reloading?total-(previewTime%total):0;
        poseCombatantExterior(a,{
            x:0,z:0,yaw:turn,vx:sideStep*speed,vz:sideStep?0:speed,
            forwardSpeed:sideStep?0:speed,lateralSpeed:sideStep*speed,yawRate:0,
            brace:0,footingLoad:.10,recoilLoad:0,
        },{
            dt,target:{x:Math.sin(previewTime*.75)*6,z:-8,height:2.1},
            gait:{phase:a.articulation.phase,gaitWeight:moving?1:0},
            weaponFault:animationPreviewMode==='disabled',
            reloadLeft,reloadSeconds:total,
            posture:{animationHealth:animationPreviewMode==='disabled'?.35:1},
        });
        exterior.root.position.set(0,(exterior.groundOffset??0)+GARAGE_PAD_TOP_Y,0);
        exterior.root.rotation.y=GARAGE_RIG_YAW;
    }
    // Presenting foot plants through a damped cab gives actual walking load
    // cues, without the old unrelated wall-clock sine bob.
    let pilotFeet=null,pilotLandingKick=0,cockpitLagX=0,cockpitLagZ=0;
    let pilotRecoveryEvent=null,pilotRecoverySlot=null,pilotRecoveryElapsed=3;
    // Live reference to the same fixed-step state used by the projectile ray.
    // No interpolated second accuracy state and no new raycasts per frame.
    let pilotStabilityPose=null;
    function setPilotStabilizer(state){pilotStabilityPose=state;}
    function updateRigVisual(state, lookYaw, lookPitch, dt, serviceVisual = null) {
        footEvidenceRoot.visible=!inspecting;
        if(serviceVisual?.stability)pilotStabilityPose=serviceVisual.stability;
        if(serviceVisual?.recoveryEventId&&serviceVisual.recoveryEventId!==pilotRecoveryEvent){
            pilotRecoveryEvent=serviceVisual.recoveryEventId;
            pilotRecoverySlot=serviceVisual.recoverySlot;
            pilotRecoveryElapsed=0;
            pilotWeaponRecoveryKick=1;
            pilotRecoveryBurstPending=true;
        }
        pilotRecoveryElapsed+=Math.max(0,dt);
        pilotWeaponFault = !!serviceVisual?.weaponFault;
        pilotWeaponServicing = !!serviceVisual?.weaponServicing;
        pilotServiceSlot = serviceVisual?.serviceSlot ?? (pilotWeaponServicing?'combat':null);
        // Interrupted repairs are not successful hydraulic restarts.
        pilotWeaponRecoveryKick = Math.max(0, pilotWeaponRecoveryKick - dt * 2.25);
        const smoothing = 1 - Math.exp(-16 * dt);
        visualX += (state.x - visualX) * smoothing;
        visualZ += (state.z - visualZ) * smoothing;
        const yawDelta = Math.atan2(Math.sin(state.yaw - visualYaw), Math.cos(state.yaw - visualYaw));
        visualYaw += yawDelta * smoothing;
        const targetPitch = THREE.MathUtils.clamp(
            -state.longitudinalAcceleration * .012 - (state.footingLoad ?? 0) * .008, -.045, .045);
        const targetRoll = THREE.MathUtils.clamp(
            -state.yawRate * Math.abs(state.forwardSpeed) * .008 -
            (state.lateralAcceleration ?? 0) * .004+
            (pilotFeet?.weightShift??0)*.024, -.065, .065);
        if(!inspecting){
            const kind=installedPart(previewAssembly,'mobility')?.definition.id??'legs-yard';
            pilotFeet=serviceVisual?.gait?.contactFeet??advanceFootContacts(pilotFeet,state,kind,dt);
            pilotLandingKick=Math.max(pilotLandingKick*Math.exp(-dt*11),
                pilotFeet.landings?pilotFeet.lastLandingStrength*.023:0);
        }else{pilotFeet=null;pilotLandingKick=0;}
        const pilotRecovery=recoveryMotion(pilotRecoveryElapsed,pilotRecoverySlot,
            installedPart(previewAssembly,'mobility')?.definition.id);
        const footfall=-pilotLandingKick-(pilotFeet?.bodyCompression??0)*.24-pilotRecovery.compression;
        // A cab has its own inertia over the hip structure. Expose just a
        // few centimeters of counter-motion; maintain a stable, aimable view.
        const lagX=THREE.MathUtils.clamp(-(state.lateralAcceleration??0)*.007,-.022,.022);
        const lagZ=THREE.MathUtils.clamp((state.longitudinalAcceleration??0)*.008,-.025,.025);
        cockpitLagX+=(lagX-cockpitLagX)*(1-Math.exp(-dt*6));
        cockpitLagZ+=(lagZ-cockpitLagZ)*(1-Math.exp(-dt*6));
        const impactKick = state.impact * 0.045;
        cockpitPitch += (targetPitch - cockpitPitch) * (1 - Math.exp(-8 * dt));
        cockpitRoll += (targetRoll - cockpitRoll) * (1 - Math.exp(-9 * dt));
        cockpitHeave += ((footfall - impactKick - (state.brace ?? 0) * .032 -
            (state.footingLoad ?? 0) * .015 - (state.recoilLoad ?? 0) * .012) -
            cockpitHeave) * (1 - Math.exp(-12 * dt));
        const renderYaw = physicsYawToViewYaw(visualYaw);
        const nowMs = performance.now();
        const damageWave = Math.sin(nowMs * .043);
        const impactJitter = hitShakeKick * Math.sin(nowMs * .117);
        const driveDamage = 1 - Math.min(driveLeftHealth, driveRightHealth);
        const sustainedDriveRoll=(driveRightHealth-driveLeftHealth)*.035*
            Math.min(1,(state.footingLoad??0)+.25)+
            (pilotFeet?.weightShift??0)*driveDamage*.025;
        const mobilityStumble=(state.footSlipMps??0)*driveDamage*.006;
        // The camera is the pilot's head; the combiner belongs to the mech. Inverse
        // free-look keeps the display on the windshield until chassis body-follow catches up.
        const tether = combinerTetherFromLook(lookYaw, lookPitch);
        combinerHud.rotation.set(
            tether.pitch + cockpitPitch * .65 - hitPitchKick * .35,
            tether.yaw - hitYawKick * .10,
            cockpitRoll * .75 - hitRollKick * .25 + sustainedDriveRoll * .28,
            'YXZ');
        const pilotServiceSag = pilotWeaponFault ? (pilotWeaponServicing ? .20 : .13) : 0;
        const pilotRecoveryLift = pilotWeaponRecoveryKick * .09 + pilotRecovery.bolt;
        // The Stump's service port used to sit behind the camera at the
        // right-hand screen edge. Bring the genuine gun assembly into view
        // while its breech is open, never a duplicate HUD loading animation.
        // Everything is home before combat.js allows the next shot.
        const reload=reloadArticulation(serviceVisual?.reloadLeft??0,
            serviceVisual?.reloadSeconds??0,pilotWeaponPresentation.id);
        const reloadView=reloadCockpitPresentation(reload,pilotWeaponPresentation.id);
        gunPivot.rotation.set(lookPitch*.85 + pilotFiringPose.mount+
            pilotHitResponse.mount*.62+pilotServiceSag-pilotRecoveryLift+
            (pilotStabilityPose?.pitch??0)+reloadView.tilt,
            lookYaw*.85+(pilotStabilityPose?.yaw??0)+reloadView.yaw,
            gunDamageKick*damageWave*.16+pilotHitResponse.roll*.22, 'YXZ');
        gunPivot.position.x=1.16+gunDamageKick*damageWave*.045+reloadView.x;
        gunPivot.position.y=2.04+reloadView.y-pilotRecovery.compression*.25;
        // Powered breech: open, eject, index from the built-in feed,
        // close, then a short charging rack AFTER lock-up.
        cockpit.userData.gunBreech.position.z=-.19+reload.slide*
            (reload.archetype==='breech'?.35:1)+reload.rack+
            pilotFiringPose.bolt*.105;
        cockpit.userData.gunBreech.position.y=reload.bolt*.24+pilotFiringPose.stop*.019;
        cockpit.userData.gunBreech.rotation.x=reload.open*
            (reload.archetype==='breech'?.27:.09);
        cockpit.userData.scatterGreebles.position.y=0;
        const activeKit=cockpit.userData.weaponKits[pilotWeaponPresentation.id];
        if(activeKit?.visible){
            const mech=activeKit.userData.reloadMechanism;
            activeKit.userData.carriage.position.z=pilotFiringPose.bolt*.13+
                reload.slide*(reload.archetype==='breech'?.32:.68)+reload.rack;
            activeKit.userData.carriage.position.y=pilotFiringPose.stop*.024+
                reload.bolt*.28+reload.ram*.025;
            activeKit.userData.carriage.rotation.x=reload.open*
                (reload.archetype==='breech'?.40:reload.archetype==='pod'?.20:.10);
            poseReloadHardware(mech,reload);
        }
        // The heavy loading mechanism transfers a small, visible load into
        // the mounting without disturbing the ballistic barrel's sightline.
        gunPivot.position.z=-.62+pilotFiringPose.travel*.19+
            reload.settle*.016+reloadView.z;
        flashMesh.visible = muzzleFlash > 0;
        cockpit.position.set(visualX + impactJitter * .35 + cockpitLagX, (state.groundHeightM??0)+impactJitter * .18 + mobilityStumble, visualZ + impactJitter * .12 + cockpitLagZ);
        cockpit.rotation.set(cockpitPitch + hitPitchKick + pilotFiringPose.cab + pilotHitResponse.pitch*.82, renderYaw + hitYawKick, cockpitRoll + hitRollKick + sustainedDriveRoll + pilotHitResponse.roll*.75, 'YXZ');
        exterior.root.position.set(visualX, 0, visualZ);
        exterior.root.rotation.y = renderYaw;
        if (inspecting) {
            // Garage inspection is a deliberately separate presentation state. The owned
            // rig always returns to the service pad instead of inheriting its last arena pose.
            exterior.root.position.set(0,(exterior.groundOffset??0)+GARAGE_PAD_TOP_Y,0);
            exterior.root.rotation.y = GARAGE_RIG_YAW;
            poseInspectionPreview(dt);
            poseDamagedMachineInGarage();
            // A hidden rear assembly gets a small, eased reveal from its station
            // shortcut. Never reframe the pivot or fight a manual orbit.
            if (orbitAssist !== null) {
                azimuth += (orbitAssist - azimuth) * Math.min(1, dt * 7.5);
                if (Math.abs(orbitAssist - azimuth) < .003) orbitAssist = null;
            }
            // Keep the center of the physical machine as the orbit pivot on every frame.
            orbitTarget.copy(desiredTarget);
            const around = new THREE.Vector3(
                radius * Math.sin(azimuth) * Math.cos(elevation),
                radius * Math.sin(elevation),
                -radius * Math.cos(azimuth) * Math.cos(elevation),
            ).applyAxisAngle(THREE.Object3D.DEFAULT_UP, GARAGE_RIG_YAW);
            const center = orbitTarget.clone().applyAxisAngle(THREE.Object3D.DEFAULT_UP, GARAGE_RIG_YAW);
            camera.position.copy(center).add(around);
            // Parallel camera translation composes the rig in the FREE viewport
            // to the right of the workshop panel. Never move the orbit pivot
            // toward a selected part or turn the camera away from the rig.
            camera.up.set(0,1,0);
            camera.lookAt(center);
            const screenRight = new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion);
            // Positive reserve = left editor, negative reserve = right-side
            // sortie selection. Both retain the same physical orbit pivot.
            const shift = Math.sign(panelRightPx) *
                framingOffsetWorld(Math.abs(panelRightPx),viewportWidth,viewportHeight,
                radius,camera.fov) * 1.06;
            camera.position.addScaledVector(screenRight,-shift);
            camera.lookAt(center.clone().addScaledVector(screenRight,-shift));
        }
        else if (spectatorRig) {
            const yaw = physicsYawToViewYaw(spectatorRig.yaw ?? 0);
            const angle=yaw+spectatorAzimuth;
            spectatorDesired.set(spectatorRig.x+Math.sin(angle)*spectatorRadius*Math.cos(spectatorElevation),
                1.65+(spectatorRig.groundHeightM??0)+spectatorRadius*Math.sin(spectatorElevation),
                spectatorRig.z+Math.cos(angle)*spectatorRadius*Math.cos(spectatorElevation));
            spectatorLook.set(spectatorRig.x, 1.65+(spectatorRig.groundHeightM??0), spectatorRig.z);
            if (!spectatorCameraReady) {
                spectatorCameraPosition.copy(spectatorDesired);
                spectatorCameraReady = true;
            } else {
                spectatorCameraPosition.lerp(spectatorDesired,
                    1 - Math.exp(-5 * Math.max(0, dt)));
            }
            camera.position.copy(spectatorCameraPosition);
            camera.lookAt(spectatorLook);
        }
        else {
            camera.position.set(visualX + impactJitter * .62, 2.42 + (state.groundHeightM??0)+cockpitHeave - Math.abs(hitPitchKick) * .2 + impactJitter * .28, visualZ + impactJitter * .18);
            camera.rotation.set(lookPitch + cockpitPitch * 0.35 + hitPitchKick * 1.35 + pilotHitResponse.pitch*.28, renderYaw + lookYaw + hitYawKick * 1.1, cockpitRoll * 0.25 + hitRollKick * 1.25 + sustainedDriveRoll * .72 + pilotHitResponse.roll*.24, 'YXZ');
        }
        updateSquadMarkers();
    }
    function poseCombatantExterior(record,state,visual=null){
        const root=record.exterior.root;
        root.position.set(state.x??0,(record.exterior.groundOffset??0)+(state.groundHeightM??0)+
            (record.cleared?-.14:record.wrecked?-.06:0),state.z??0);
        root.rotation.y=physicsYawToViewYaw(state.yaw??0);
        if(record.active&&!record.wrecked&&!record.cleared){
            const dt=Math.max(0,Math.min(.10,visual?.dt??1/60));
            if(visual?.recoveryEventId&&record.lastRecoveryEvent!==visual.recoveryEventId){
                record.lastRecoveryEvent=visual.recoveryEventId;
                record.recoverySlot=visual.recoverySlot;
                record.recoveryElapsed=0;
                record.weaponRecoveryKick=1;
                record.recoveryBurstPending=true;
            }
            record.recoveryElapsed=(record.recoveryElapsed??3)+dt;
            record.weaponFault=!!visual?.weaponFault;
            record.weaponServicing=!!visual?.weaponServicing;
            if(record.serviceSlot && !visual?.serviceSlot) record.lastServiceSlot=record.serviceSlot;
            record.serviceSlot=visual?.serviceSlot??(record.weaponServicing?'combat':null);
            // Cancelled field service does not trigger the finished animation.
            record.weaponRecoveryKick=Math.max(0,(record.weaponRecoveryKick??0)-dt*2);
            const health=THREE.MathUtils.clamp(visual?.posture?.animationHealth??1,.08,1);
            const speed=Math.hypot(state.vx??0,state.vz??0);
            const motion=record.articulation;
            const mobilityId=installedPart(record.assembly,'mobility')?.definition.id??'legs-yard';
            const spec=familyAnimation(mobilityId);
            const visualGait=visual?.gait;
            const mobilityPart=record.condition?.parts?.mobility;
            const mh=mobilityPart?.maxIntegrity>0?
                THREE.MathUtils.clamp(mobilityPart.integrity/mobilityPart.maxIntegrity,0,1):1;
            const left=visual?.driveHealth?.left??mh;
            const right=visual?.driveHealth?.right??mh;
            const wound=machineWoundPose({family:mobilityId,left,right,
                structure:record.condition?.parts?.structure?.integrity/
                    Math.max(1,record.condition?.parts?.structure?.maxIntegrity??1),
                command:record.condition?.parts?.command?.integrity/
                    Math.max(1,record.condition?.parts?.command?.maxIntegrity??1),
                loadLeft:record.footContacts?.feet?.[0]?.load??.5,
                loadRight:record.footContacts?.feet?.[1]?.load??.5,
                driveLoad:state.driveLoad??0});
            const restart=recoveryMotion(record.recoveryElapsed,record.recoverySlot,mobilityId);
            if(visual?.stability)record.stabilityPose=visual.stability;
            if(motion){
                if(visualGait){
                    motion.phase=visualGait.phase??motion.phase;
                    motion.weight=visualGait.gaitWeight??0;
                }else{
                    // Fallback only for inspection or legacy external callers.
                    if(speed>.65)motion.phase+=Math.PI*dt*speed/spec.stride;
                    const target=speed>.65?1:0;
                    motion.weight=(motion.weight??0)+(target-(motion.weight??0))*(1-Math.exp(-dt*7));
                }
                // A stance foot now owns a persistent ground point. Distinct
                // actors use independent contact state; no gameplay force changes.
                record.footContacts=visual?.gait?.contactFeet??advanceFootContacts(record.footContacts,state,mobilityId,dt,{
                    disabled:record.disabledSlots.has('mobility')||record.destroyedSlots.has('mobility'),
                });
                const moving=(motion.weight??0);
                const support=record.footContacts;
                const backward=(state.forwardSpeed??0)<-.3;
                const strafe=(state.lateralSpeed??0)/2.4;
                const forward=(state.forwardSpeed??0)/3.2;
                const blocked=record.disabledSlots.has('mobility')||
                    record.destroyedSlots.has('mobility');
                const damaged=familyFailureAnatomy(mobilityId,{
                    mobilityDisabled:blocked,
                    mobilityDestroyed:record.destroyedSlots.has('mobility'),
                    structureDisabled:record.disabledSlots.has('structure')||
                        record.destroyedSlots.has('structure'),
                    structureDestroyed:record.destroyedSlots.has('structure'),
                    active:record.active&&!record.wrecked,
                });
                for(const [side,leg] of motion.legs){
                    if(!leg.hip||!leg.knee||!leg.ankle||!leg.foot)continue;
                    const pose=legPose(leg.upper,leg.lower,{
                        phase:motion.phase,side,weight:moving,family:mobilityId,
                        backward,strafe,forward,brace:state.brace??0,health,disabled:blocked,
                        upperX:leg.upperX,lowerX:leg.lowerX,
                        contact:footPresentation(record.footContacts,side),
                    });
                    leg.hip.rotation.x=pose.hip;
                    leg.hip.rotation.z=pose.hipRoll+(1-health)*side*.03;
                    leg.knee.rotation.x=pose.knee;
                    leg.knee.rotation.z=pose.kneeRoll;
                    leg.ankle.rotation.x=pose.ankle;
                    leg.ankle.rotation.z=pose.ankleRoll;
                    leg.foot.rotation.x=pose.foot;
                    leg.foot.rotation.z=pose.footRoll;
                    // Support-side compression bends the knee and counters
                    // through the ankle while the actual foot anchor holds.
                    // Hauler absorbs load in its short compression columns;
                    // the runner's longer travel is expressed in its step.
                    const supportFoot=record.footContacts?.feet.find(f=>f.side===side);
                    const hitLoad=(record.footContacts?.hitCatch?.force??0)*
                        (supportFoot?.load??.5);
                    const strutFlex=mobilityId==='legs-hauler'?.13:
                        mobilityId==='legs-compact'?.085:.11;
                    leg.knee.rotation.x-=hitLoad*strutFlex;
                    leg.ankle.rotation.x+=hitLoad*strutFlex*.55;
                    const failedLeg=damaged.legs.find(item=>item.side===side);
                    if(failedLeg){
                        leg.hip.rotation.x+=failedLeg.hip;
                        leg.knee.rotation.x+=failedLeg.knee;
                        leg.ankle.rotation.x+=failedLeg.ankle;
                        leg.foot.rotation.x+=failedLeg.foot;
                    }
                    // The actually injured side carries a rough compression
                    // knee under load. Milliradian-scale secondary metal motion
                    // only; grounded foot anchors and actual gait are untouched.
                    const injury=side<0?wound.left:wound.right;
                    const plantedLoad=supportFoot?.load??.5;
                    // Injured shock struts compress under the ACTUAL
                    // planted-foot load; healthy side stays at authored rest.
                    leg.knee.rotation.x-=injury.kneeCompression*(.35+.65*plantedLoad)+restart.knee;
                    leg.ankle.rotation.x+=injury.ankleSupport*plantedLoad;
                    leg.hip.rotation.z+=side*injury.hipRoll*plantedLoad;
                    leg.foot.rotation.z-=side*injury.hipRoll*.50*plantedLoad;
                }
            }
            const desired=visual?.target
                ?Math.atan2(visual.target.x-state.x,-(visual.target.z-state.z))
                :state.yaw??0;
            const error=Math.atan2(Math.sin(desired-(state.yaw??0)),
                Math.cos(desired-(state.yaw??0)));
            const range=visual?.target
                ?Math.hypot(visual.target.x-state.x,visual.target.z-state.z):20;
            const elevation=visual?.aimPitch??Math.atan2(
                (visual?.target?.height??2.05)-2.0,Math.max(1,range));
            const fault=record.weaponFault||record.disabledSlots.has('combat');
            const previous=motion?.aim??{waist:0,gun:0,elevation:0};
            const aim=aimArticulation(-error,elevation,dt,previous,{health,fault});
            if(motion)motion.aim=aim;
            const frame=record.exterior.partGroups.get('structure');
            const combat=record.exterior.partGroups.get('combat');
            const command=record.exterior.partGroups.get('command');
            const frameBase=record.baseParts.get('structure');
            const combatBase=record.baseParts.get('combat');
            const commandBase=record.baseParts.get('command');
            if(frame&&frameBase){
                // The load-bearing hip moves under the upper hull. This is
                // secondary physical presentation, not yaw or hitbox motion.
                frame.rotation.y=frameBase.rotation.y+aim.waist;
                frame.rotation.z=frameBase.rotation.z+
                    THREE.MathUtils.clamp((record.footContacts?.weightShift??0)*.033,-.036,.036)+
                    (record.footContacts?.hitCatch?.force??0)*
                    (record.footContacts?.hitCatch?.side??0)*.012;
                // Shot shock travels through the structure, not through camera aim.
                frame.rotation.x=frameBase.rotation.x+
                    (record.firingState?.pose.cab??0)*.42+
                    (record.hitResponse?.pitch??0)*.45;
                frame.position.x=frameBase.position.x+
                    (record.footContacts?.weightShift??0)*.018;
                frame.position.y=frameBase.position.y-
                    (record.footContacts?.bodyCompression??0)*.38-wound.bodyDrop*.25;
            }
            if(command&&commandBase&&!record.destroyedSlots.has('command')){
                const commandBroken=record.disabledSlots.has('command');
                command.rotation.y=commandBase.rotation.y+aim.gun*.18;
                command.rotation.x=commandBase.rotation.x+(commandBroken?.19:0);
                command.position.y=commandBase.position.y-(commandBroken?.09:0);
            }
            if(combat&&combatBase&&!record.destroyedSlots.has('combat')){
                const recovery=record.weaponRecoveryKick??0;
                const discharge=record.firingState?.pose;
                const reload=reloadArticulation(visual?.reloadLeft??0,
                    visual?.reloadSeconds??0,
                    installedPart(record.assembly,'combat')?.definition.id);
                combat.rotation.y=combatBase.rotation.y+aim.gun+(record.stabilityPose?.yaw??0);
                combat.rotation.x=combatBase.rotation.x+aim.elevation+
                    (fault?.20:0)-(recovery*.12)+(discharge?.mount??0)+
                    (record.hitResponse?.mount??0)*.56+(record.stabilityPose?.pitch??0);
                combat.rotation.z=combatBase.rotation.z+(fault?.14:0)+
                    (1-health)*(record.stabilityPose?.yaw??0)*.45;
                combat.position.y=combatBase.position.y-(fault?.09:0)+recovery*.014;
                combat.position.z=combatBase.position.z+(record.recoilKick??0)*.70+
                    (discharge?.travel??0)*.085+reload.settle*.027;
                const mechanism=combat.userData.weaponMechanism;
                const weaponId=installedPart(record.assembly,'combat')?.definition.id;
                if(mechanism){
                    const rest=mechanism.rest;
                    mechanism.carriage.position.z=rest.carriage.z+
                        reload.slide*(reload.archetype==='breech'?.32:1)+
                        reload.rack+(record.recoilKick??0)*.35+
                        (discharge?.bolt??0)*.09;
                    mechanism.carriage.position.y=rest.carriage.y+reload.bolt*.14+
                        reload.ram*.032;
                    mechanism.carriage.rotation.x=(rest.carriageRotation?.x??0)+
                        reload.open*(reload.archetype==='breech'?.40:
                            reload.archetype==='pod'?.20:.10);
                    mechanism.bolt.position.z=rest.bolt.z+reload.bolt+
                        reload.ram*.13+reload.rack+
                        (discharge?.bolt??0)*.12;
                    // Existing side drums/cassettes slide ONLY a short
                    // distance on their authored mount. Never fabricate a
                    // duplicate "reload" drum hovering above the weapon.
                    poseExistingReloadMagazine(mechanism,reload,weaponId);
                    poseReloadHardware(mechanism,reload);
                }
            }
            // Actual dynamic load and step contacts compress the physical
            // machine with family-specific settling. This does not touch IK,
            // simulated center of mass or any gameplay collision coordinate.
            const contact=physicalContactWeight(mobilityId,{
                gaitWeight:(record.disabledSlots.has('mobility')||
                    record.destroyedSlots.has('mobility'))?0:(motion?.weight??0),
                phase:motion?.phase??0,
                footingLoad:state.footingLoad??0,
                brace:state.brace??0,
                recoilLoad:state.recoilLoad??0,
                longitudinalAcceleration:state.longitudinalAcceleration??0,
                lateralAcceleration:state.lateralAcceleration??0,
            },record.contactPresentation,dt);
            record.contactPresentation=contact;
            root.position.y-=contact.drop;
            root.position.y-=(record.footContacts?.bodyCompression??0)*.24;
            root.position.y-=wound.bodyDrop+restart.compression;
            const catchLoad=record.footContacts?.hitCatch;
            const catchForce=catchLoad?.force??0;
            const damage=1-health;
            root.rotation.x=THREE.MathUtils.clamp(
                -(state.longitudinalAcceleration??0)*.008+
                damage*Math.sin((motion?.phase??0)*.51)*.022,-.09,.09);
            root.rotation.z=THREE.MathUtils.clamp(
                -(state.lateralSpeed??0)*.014-
                (state.yawRate??0)*speed*.009+
                (record.footContacts?.weightShift??0)*.028+
                damage*Math.sin((motion?.phase??0)*.64)*.032,-.12,.12);
            // Family-specific mechanical collapse is downstream from game
            // mobility health: pose only, no collision or speed adjustments.
            const failed=familyFailureAnatomy(mobilityId,{
                mobilityDisabled:record.disabledSlots.has('mobility')||
                    record.destroyedSlots.has('mobility'),
                mobilityDestroyed:record.destroyedSlots.has('mobility'),
                structureDisabled:record.disabledSlots.has('structure')||
                    record.destroyedSlots.has('structure'),
                structureDestroyed:record.destroyedSlots.has('structure'),
                active:record.active&&!record.wrecked,
            });
            root.position.y-=failed.rootDrop;
            root.rotation.x+=failed.rootPitch+wound.bodyPitch+restart.pitch+
                contact.pitch+(record.hitResponse?.pitch??0)+
                catchForce*(catchLoad?.z??0)*.018;
            root.rotation.z+=failed.rootRoll+wound.bodyRoll+restart.roll+
                contact.roll+(record.hitResponse?.roll??0)-
                catchForce*(catchLoad?.x??0)*.025;
            root.position.y-=Math.abs(record.hitResponse?.translation??0)*.26;
        }
        root.updateWorldMatrix(true,true);
    }
    function updateCombatantRig(id,state,visual=null){
        const record=squadCombatants.get(id);
        if(record)poseCombatantExterior(record,state,visual);
    }
    function updateTargetRigVisual(state) {
        // Backwards-compatible wrapper for the selected contract leader.
        updateCombatantRig('enemy-0', state);
    }
    function setInspection(enabled) {
        if(enabled)endVictoryShowcase();
        inspecting = enabled;
        exterior.root.visible = enabled && !vendorEnabled;
        vendorRoot.visible = enabled && vendorEnabled;
        cockpit.visible = !enabled && !spectatorRig;
        combinerHud.visible = !enabled && !spectatorRig;
        blackout.visible = !enabled;
        arenaRoot.visible = !enabled;
        arenaPresentationRoot.visible = !enabled;
        garageRoot.visible = enabled&&!vendorEnabled&&!pitPresentation;
        pitRoot.visible = enabled&&!vendorEnabled&&pitPresentation;
        if(!enabled)serviceDressing.visible=false;
        else refreshPhysicalServiceBay();
        stagingFixtures.visible = enabled && !vendorEnabled && !pitPresentation;
        arenaHemisphere.visible = !enabled;
        sun.visible = !enabled;
        coolRim.visible = !enabled;
        debugColliders.visible = false;
        // Open-air venues use a sky texture; do not call Color.setHex on it.
        // Garage/service darkness is restored only while that space is visible.
        scene.background=enabled?serviceBackground:combatBackground;
        scene.fog.color.setHex(enabled?0x0d1210:
            (arenaMap.id==='backlot-dustbowl'||arenaMap.id==='test-yard')?0xc5ad8d:0x171915);
        scene.fog.density=enabled?.0075:
            (arenaMap.id==='backlot-dustbowl'||arenaMap.id==='test-yard')?.0048:.0125;
        if (!enabled) setAnimationPreview('off');
        if (enabled) {
            pilotWeaponFault = false; pilotWeaponServicing = false; pilotServiceSlot=null; pilotServiceSparkBudget = 0;
            pilotWeaponRecoveryKick = 0; pilotRecoveryBurstPending = false;
            exterior.root.position.set(0,(exterior.groundOffset??0)+GARAGE_PAD_TOP_Y,0);
            exterior.root.rotation.y = GARAGE_RIG_YAW;
        }
        for (const record of squadCombatants.values()) {
            record.exterior.root.visible = !enabled;
            record.marker.visible = !enabled;
        }
    }
    function rebuildAssembly(assembly) {
        restoreInspectionPose();
        previewRecord=null;
        previewAssembly=assembly;
        const oldRoot = exterior.root;
        // Detach shared scar geometry before the old rig disposal traversal.
        clearFractures(pilotFractureParts);
        Object.assign(pilotHitResponse,createHitResponse());
        surfaceMarks.clear();
        pendingSurfaceMarks.length=0;
        exterior = buildExteriorRig(assembly);
        inspectionBaseParts=capturePartTransforms(exterior);
        inspectionJoints=captureArticulation(exterior).joints;
        calibrateExteriorSoles(exterior);
        updateGarageFixtures(assembly);
        for (const mesh of exterior.pickMeshes)
            mesh.userData.actorId = 'player';
        pilotColors = captureColors(exterior.pickMeshes);
        rebuildEmptyMountPicks(assembly);
        exterior.root.position.copy(oldRoot.position);
        exterior.root.rotation.copy(oldRoot.rotation);
        // Purchases can rebuild the owned assembly while the seller is open.
        // Never reveal the full mech through the vendor counter.
        exterior.root.visible = inspecting && !vendorEnabled;
        scene.add(exterior.root);
        scene.remove(oldRoot);
        restoreSurfaceMarks([...knownSurfaceEvents.values()]);
        // Part swaps can encounter legacy meshes with malformed material
        // data (the original S-6 underbarrel brace had a bare color number).
        // Never crash a player garage while cleaning up a discarded visual.
        // Geometry belongs to this rig; cloned gameplay materials may be
        // referenced by several of its meshes, so dispose each only once.
        const releasedGeometry=new Set(),releasedMaterials=new Set();
        oldRoot.traverse(object => {
            if (!object.isMesh) return;
            if (object.geometry?.dispose && !releasedGeometry.has(object.geometry)) {
                releasedGeometry.add(object.geometry);
                object.geometry.dispose();
            }
            const materials=Array.isArray(object.material)?object.material:[object.material];
            for(const material of materials) {
                if (!material?.isMaterial || typeof material.dispose!=='function' ||
                    releasedMaterials.has(material)) continue;
                releasedMaterials.add(material);
                material.dispose();
            }
        });
        selectPart(selected && installedPart(assembly, selected) ? selected : null);
        const command = installedPart(assembly, 'command')?.definition.id;
        cockpit.userData.armoredCab.visible = command === 'cab-armored';
        cockpit.userData.utilityCab.visible = command === 'cab-utility';
    }
    let paintSelectedSlots = null;
    let previewSlot = null;
    function setPreviewPart(slot=null) {
        previewSlot = slot;
        selectPart(selected);
    }
    function setPaintSelectedSlots(slots=null){
        paintSelectedSlots=Array.isArray(slots)?new Set(slots):null;
        selectPart(selected);
    }
    function selectPart(slot) {
        selected = slot;
        for (const hit of emptyMountPicks) {
            const active = hit.userData.slot === slot;
            const bracket = hit.parent;
            bracket.scale.setScalar(active ? 1.2 : 1);
            for (const piece of bracket.children) {
                if (!piece.material?.isMeshStandardMaterial) continue;
                piece.material.emissive.setHex(active ? 0xa77b2d : 0x42290f);
                piece.material.emissiveIntensity = active ? .75 : .24;
            }
        }
        for (const [groupSlot, meshes] of exterior.partMeshes) {
            for (const mesh of meshes) {
                const material = mesh.material;
                if (!(material instanceof THREE.MeshStandardMaterial))
                    continue;
                const illuminated=paintSelectedSlots ? false : groupSlot===slot;
                material.emissive.setHex(illuminated ? (previewSlot===slot ? 0x287d76 : 0xb78b35) : 0);
                material.emissiveIntensity = illuminated ? .30 : 0;
            }
        }
    }
    function focusPart(slot) {
        // No orbit or pivot changes on inspector selection, deselection or
        // temporary preview; the player's manually chosen view persists.
    }
    function revealPart(slot) {
        // Model taps have already exposed the part. Only explicit shortcut navigation
        // may make a gentle camera assist, and only when the rear power pack is hidden.
        if (slot === 'power' && azimuth > -.6 && azimuth < 1.15)
            orbitAssist = azimuth + Math.min(.40, 1.35 - azimuth);
    }
    function orbitBy(dx, dy) {
        orbitAssist = null;
        azimuth = orbitAzimuthAfterDrag(azimuth, dx);
        elevation = THREE.MathUtils.clamp(elevation + dy * 0.006, -0.18, 1.05);
    }
    function panBy(dx, dy, screenHeight) {
        // Retained only for old external callers. Free panning could move the
        // machine off-screen and destroy the inspection interaction.
    }
    function setInspectorLayout(panelRight, width, height) {
        panelRightPx = panelRight;
        viewportWidth = width;
        viewportHeight = height;
    }
    function zoomBy(scale) {
        if (Number.isFinite(scale) && scale > 0)
            radius = THREE.MathUtils.clamp(radius / scale, 4.0, 11.2);
    }
    function resetOrbit() {
        orbitAssist = null;
        azimuth = 0.68;
        elevation = 0.25;
        radius = 6.05;
        focusPart(null);
    }
    function pickSurfaceEvidence(clientX,clientY,canvas){
        if(!inspecting||vendorEnabled)return null;
        const rect=canvas.getBoundingClientRect();
        if(rect.width<=0||rect.height<=0)return null;
        const pointer=new THREE.Vector2(
            ((clientX-rect.left)/rect.width)*2-1,
            -((clientY-rect.top)/rect.height)*2+1);
        exterior.root.updateWorldMatrix(true,true);
        camera.updateMatrixWorld();
        raycaster.setFromCamera(pointer,camera);
        const picks=[];
        exterior.root.traverse(node=>{
            if(node.isMesh&&node.visible&&
              (node.userData.sourceSurfaceEvent||node.userData.serviceEvidence))
                picks.push(node);
        });
        if(!picks.length)return null;
        const physical=raycaster.intersectObjects(exterior.pickMeshes,false)[0];
        const direct=raycaster.intersectObjects(picks,false)
            .find(hit=>!physical||hit.distance<=physical.distance+.065);
        if(direct)return direct.object.userData.sourceSurfaceEvent||
            {type:'service-tally',...direct.object.userData.serviceEvidence};
        // Small real holes are hard to tap on an iPhone. Grant a limited
        // screen-space hit radius ONLY when the real mesh remains in front;
        // a scar on a hidden back panel must never win through visible metal.
        let nearest=null,closest=27*27;
        const test=new THREE.Vector3();
        for(const node of picks){
            node.getWorldPosition(test);
            const distance=raycaster.ray.origin.distanceTo(test);
            if(physical&&distance>physical.distance+.18)continue;
            test.project(camera);
            if(test.z< -1||test.z>1)continue;
            const sx=rect.left+(test.x+1)*.5*rect.width;
            const sy=rect.top+(1-test.y)*.5*rect.height;
            const d=(sx-clientX)**2+(sy-clientY)**2;
            if(d<closest){nearest=node;closest=d;}
        }
        return nearest?(nearest.userData.sourceSurfaceEvent||
            {type:'service-tally',...nearest.userData.serviceEvidence}):null;
    }
    function pickPart(clientX, clientY, canvas) {
        if (!inspecting)
            return null;
        const rect = canvas.getBoundingClientRect();
        const pointer = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
        exterior.root.updateWorldMatrix(true, true);
        camera.updateMatrixWorld();
        raycaster.setFromCamera(pointer, camera);
        const first = raycaster.intersectObjects([...exterior.pickMeshes,...emptyMountPicks], false)[0];
        return first?.object.userData.slot ?? null;
    }
    function setPilotWeapon(spec) {
        const barrel = cockpit.userData.gunBarrel;
        const breech = cockpit.userData.gunBreech;
        gunPivot.visible = !!spec;
        pilotWeaponPresentation = spec ?? { visualRecoil: 1, visualRecovery: 3.6, muzzleFlashSeconds: .10 };
        pilotFiringState.pulses.length=0;
        pilotFiringPose=pilotFiringState.pose={travel:0,mount:0,cab:0,bolt:0,stop:0,feeder:0,active:false};
        for(const [id,kit] of Object.entries(cockpit.userData.weaponKits))kit.visible=!!spec&&id===spec.id;
        if (!spec)
            return;
        const extension = Math.max(.48, Math.abs(spec.muzzleZ + .62));
        barrel.scale.y = Math.max(.3, (extension - .23) / 1.13);
        barrel.position.z = -(extension + .23) / 2;
        flashMesh.position.z = -extension;
        const scatter=spec.id==='gun-scatter';
        breech.scale.set(scatter?1.40:spec.id==='gun-short'?1.14:spec.id==='gun-light'?.75:1,
            scatter?1.25:spec.id==='gun-short'?1.14:spec.id==='gun-light'?.75:1,
            scatter?1.20:spec.id==='gun-short'?1.14:spec.id==='gun-light'?.75:1);
        barrel.scale.x=scatter?2.40:1;
        barrel.scale.z=scatter?2.40:1;
        barrel.scale.y=scatter?.86:1;
        cockpit.userData.scatterGreebles.visible = scatter;
    }
    // Physical scar anchors are expressed in the actual intersected mesh's
    // local space. Animated legs and moving weapon actions retain their scars.
    function surfaceContact(actual,point,normal) {
        const surface=actual?.object?.userData?.surface;
        if(!surface?.persistable || !surface.id || !point || !normal)return null;
        const node=actual.object;
        const origin=node.worldToLocal(point.clone());
        const tip=node.worldToLocal(point.clone().add(normal));
        const localNormal=tip.sub(origin).normalize();
        const rounded=v=>Math.round(v*10000)/10000;
        return {
            surfaceId:surface.id,surfaceVersion:surface.version,
            localPoint:origin.toArray().map(rounded),
            localNormal:localNormal.toArray().map(rounded),
        };
    }
    const surfaceImpactEvents=[];
    const surfaceMarks=createSurfaceScarRenderer({perSerialLimit:4});
    const knownSurfaceEvents=new Map();
    // Three physical serialized mechs share the game's existing scene, renderer,
    // part builders and leg animation. Never create a second live WebGL canvas.
    let victoryStage=null;
    function endVictoryShowcase() {
        if(!victoryStage)return;
        const old=victoryStage;victoryStage=null;
        old.scars.clear();
        scene.remove(old.root);
        camera.fov=old.cameraFov;
        camera.updateProjectionMatrix();
        for(const entry of old.machines)disposePreviewObject(entry.visual.root);
        old.root.traverse(node=>{
            if(node.isMesh && !old.machines.some(e=>e.visual.root===node)) {
                // Stage-only signs and floor have their own disposable geometry.
                if(node.userData.victoryFixture){
                    node.geometry?.dispose?.();
                    node.material?.dispose?.();
                }
            }
        });
        cockpit.visible=!inspecting&&!spectatorRig;
        combinerHud.visible=!inspecting&&!spectatorRig;
    }
    function beginVictoryShowcase(winners=[]) {
        endVictoryShowcase();
        if(inspecting||!Array.isArray(winners)||!winners.length)return false;
        const root=new THREE.Group();
        root.name='physical-victory-parade';
        root.position.set(0,0,-72);
        const floor=new THREE.Mesh(new THREE.BoxGeometry(14,.13,13),
          new THREE.MeshStandardMaterial({color:0x493e30,roughness:.93,metalness:.08}));
        floor.position.set(0,-.09,-1.8);floor.userData.victoryFixture=true;
        root.add(floor);
        for(const x of [-3.18,0,3.18]){
          const lane=new THREE.Mesh(new THREE.BoxGeometry(2.7,.018,.055),
            new THREE.MeshStandardMaterial({color:0xb28c50,roughness:.84,metalness:.12}));
          lane.position.set(x,.001,1.1);
          lane.userData.victoryFixture=true;
          root.add(lane);
        }
        const rail=new THREE.Mesh(new THREE.BoxGeometry(12,1.15,.22),
          new THREE.MeshStandardMaterial({color:0x24322e,roughness:.88,metalness:.2}));
        rail.position.set(0,.50,-6.5);rail.userData.victoryFixture=true;root.add(rail);
        const key=new THREE.DirectionalLight(0xffd5a0,2.2);
        key.position.set(-5,9,6);root.add(key);
        const rim=new THREE.DirectionalLight(0x7bc8bc,1.5);
        rim.position.set(4,6,-4);root.add(rim);
        const fill=new THREE.HemisphereLight(0xc9cbb4,0x3e3024,.7);
        root.add(fill);
        const scars=createSurfaceScarRenderer({perSerialLimit:4});
        const machines=[];
        for(const [i,winner] of winners.slice(0,3).entries()){
          if(!winner?.assembly)continue;
          const visual=buildExteriorRig(winner.assembly);
          calibrateExteriorSoles(visual);
          const x=(i-(Math.min(winners.length,3)-1)/2)*3.18;
          const operational=winner.operational!==false;
          root.add(visual.root);
          for(const event of knownSurfaceEvents.values())
            scars.apply(visual,event);
          const shadow=new THREE.Mesh(new THREE.CircleGeometry(.9,16),
            new THREE.MeshBasicMaterial({color:0x050c09,transparent:true,
              opacity:.48,depthWrite:false,side:THREE.DoubleSide}));
          shadow.rotation.x=-Math.PI/2;
          shadow.scale.set(1.32,.78,1);
          shadow.position.set(x,.006,-3.8);
          shadow.userData.victoryFixture=true;
          root.add(shadow);
          const record={
            id:'parade-'+i,assembly:winner.assembly,exterior:visual,
            active:true,wrecked:false,cleared:false,
            disabledSlots:new Set(operational?[]:['mobility','combat']),
            destroyedSlots:new Set(),articulation:captureArticulation(visual),
            baseParts:capturePartTransforms(visual),
            recoilKick:0,weaponRecoveryKick:0,weaponServicing:false,
          };
          // Functional distress remains visible; never flatten all the winners
          // to the same clean marketing model after a hard-fought battle.
          for(const [slot,meshes] of visual.partMeshes){
            const part=winner.condition?.parts?.[slot];
            if(!part)continue;
            const severity=1-THREE.MathUtils.clamp(part.integrity/Math.max(1,part.maxIntegrity),0,1);
            for(const mesh of meshes){
              const material=mesh.material;
              if(!material?.isMeshStandardMaterial)continue;
              material.color.multiplyScalar(Math.max(.48,1-severity*.44));
            }
          }
          machines.push({record,visual,x,operational,phase:i*.32,shadow});
        }
        if(!machines.length){scars.clear();return false;}
        scene.add(root);
        victoryStage={root,machines,scars,elapsed:0,cameraFov:camera.fov};
        camera.fov=43;camera.updateProjectionMatrix();
        cockpit.visible=false;
        combinerHud.visible=false;
        return true;
    }
    function updateVictoryShowcase(dt){
        const stage=victoryStage;
        if(!stage)return false;
        stage.elapsed+=Math.max(0,Math.min(.12,dt||0));
        const elapsed=stage.elapsed;
        for(const entry of stage.machines){
          const time=Math.max(0,elapsed-entry.phase);
          const t=THREE.MathUtils.clamp(time/2.25,0,1);
          const eased=1-Math.pow(1-t,2.2);
          const moving=entry.operational&&t<1;
          const gait=moving?Math.min(1,Math.sin(t*Math.PI)*1.35):0;
          // Disabled winners are recovery casualties, not motionless sliding props.
          // They remain where they were staged while operational rigs walk forward.
          const z=entry.operational?-3.8+eased*3.9:-3.8;
          entry.shadow.position.z=z;
          poseCombatantExterior(entry.record,{
            x:entry.x,z,yaw:Math.PI,
            vx:0,vz:moving?1.7:0,
            forwardSpeed:moving?1.7:0,lateralSpeed:0,
            footingLoad:moving?.2:.05,recoilLoad:0,
          },{
            dt:Math.min(.10,dt),target:{x:entry.x,z:10,height:2},
            gait:{phase:time*7.6,gaitWeight:gait},
            posture:{animationHealth:entry.operational?.95:.22},
          });
          // source models have a forward face toward +Z. No gameplay hitboxes
          // are touched; all parade positions live in the distant stage group.
          // Physical source parts face away at yaw 0 (verified in live mobile
          // screenshots). Rotate the COMPLETE rig toward the camera at +Z.
          entry.visual.root.rotation.y=Math.PI;
          if(!entry.operational){
            entry.visual.root.rotation.z=-.095;
            entry.visual.root.position.y-=.07;
          }
        }
        camera.position.set(stage.root.position.x,2.65,
          stage.root.position.z+THREE.MathUtils.lerp(8.7,7.3,
            THREE.MathUtils.clamp(elapsed/4.2,0,1)));
        camera.lookAt(stage.root.position.x,1.48,stage.root.position.z-.6);
        cockpit.visible=false;
        combinerHud.visible=false;
        return true;
    }
    /** Screen anchors for the actual running Three.js winners. UI nameplates
     * follow their individual machine feet, not arbitrary equal-width columns.
     * Returns percentages of the game's full viewport, with a safe fallback.
     */
    function victoryNameplateAnchors(){
        const stage=victoryStage;
        if(!stage)return [];
        stage.root.updateWorldMatrix(true,true);
        camera.updateMatrixWorld();
        return stage.machines.map(entry=>{
            const base=entry.visual.root.localToWorld(new THREE.Vector3(0,-.34,.48));
            const projected=base.project(camera);
            return {
                x:THREE.MathUtils.clamp((projected.x*.5+.5)*100,13,87),
                y:THREE.MathUtils.clamp((1-(projected.y*.5+.5))*100,53,84),
                visible:projected.z>=-1&&projected.z<=1,
            };
        });
    }
    // Serial history is captured synchronously, while triangle clipping is
    // budgeted to two marks per rendered frame to avoid disable/blast hitches.
    const pendingSurfaceMarks=[];
    function restoreSurfaceMarks(events) {
        for(const event of events||[]) {
            if(!event?.eventId||!event?.serial)continue;
            knownSurfaceEvents.set(event.eventId,event);
            pendingSurfaceMarks.push(event);
        }
    }
    function flushSurfaceMarks(maxPerFrame=2){
        for(let i=0;i<maxPerFrame&&pendingSurfaceMarks.length;i++){
            const event=pendingSurfaceMarks.shift();
            if(event.actorId==='player'){
                surfaceMarks.apply(exterior,event);
                continue;
            }
            if(event.actorId){
                const record=squadCombatants.get(event.actorId);
                if(record)surfaceMarks.apply(record.exterior,event);
                continue;
            }
            if(surfaceMarks.apply(exterior,event))continue;
            for(const record of squadCombatants.values()){
                if(surfaceMarks.apply(record.exterior,event))break;
            }
        }
    }
    const surfaceSortieId='sortie-'+(globalThis.crypto?.randomUUID?.()||Date.now().toString(36));
    function noteSurfaceImpact(contact,outcome) {
        const s=contact?.surfaceHit;
        if(!s || !outcome?.serial || !contact?.actorId)return;
        const event={
            eventId:surfaceSortieId+':'+(surfaceImpactEvents.length+1),
            sortieId:surfaceSortieId,serial:outcome.serial,
            surfaceId:s.surfaceId,surfaceVersion:s.surfaceVersion,
            localPoint:s.localPoint,localNormal:s.localNormal,
            armorAbsorbed:outcome.armorAbsorbed||0,
            internalDamage:outcome.internalDamage||0,
            disabled:!!outcome.disabled,destroyed:!!outcome.destroyed,
            timestamp:Date.now(),
        };
        surfaceImpactEvents.push(event);
        // Direct live hits to their struck rig; other actors need not be searched.
        knownSurfaceEvents.set(event.eventId,event);
        pendingSurfaceMarks.push({...event,actorId:contact.actorId});
    }
    function drainSurfaceEvents() {return surfaceImpactEvents.splice(0);}
    /** Return only successive distinct physical modules on a single muzzle ray.
     * World meshes or certified arena cover terminate the shot; overlap meshes
     * belonging to the same physical module are never counted as extra layers.
     */
    function penetrationContacts(primary,intersections,cover,muzzle,bore) {
        if(cover||!primary.actorId||!primary.slot)return [primary];
        const contacts=[primary],seen=new Set([primary.actorId+'/'+primary.slot]);
        for(const hit of intersections.slice(1)) {
            if(contacts.length>=3)break;
            const slot=hit.object.userData.slot,actorId=hit.object.userData.actorId;
            if(!slot||!actorId||hit.object.userData.arenaObstacleId)break;
            if(actorId!==primary.actorId)break;
            const key=actorId+'/'+slot;
            if(seen.has(key))continue;
            seen.add(key);
            const normal=hit.face?.normal
                ? hit.face.normal.clone().transformDirection(hit.object.matrixWorld)
                : bore.clone().negate();
            let driveSide;
            if(slot==='mobility') {
                const hitRoot=actorId==='player'?exterior.root:squadCombatants.get(actorId)?.exterior.root;
                if(hitRoot)driveSide=hitRoot.worldToLocal(hit.point.clone()).x<0?'left':'right';
            }
            contacts.push({actorId,slot,blockedBy:null,shieldedSlot:null,
                point:hit.point.clone(),normal,muzzle,distance:muzzle.distanceTo(hit.point),
                surfaceHit:surfaceContact(hit,hit.point,normal),driveSide});
        }
        return contacts;
    }

    const activeRockets=[];
    const rocketGeometry=new THREE.CylinderGeometry(.11,.11,.47,6);
    const rocketMaterial=new THREE.MeshStandardMaterial({color:0xa87a36,roughness:.78,metalness:.40,flatShading:true});
    function launchRocket({ownerId,muzzle,point,speed=32,radius=3.5,damage=92}) {
        if(!muzzle||!point||activeRockets.length>=18)return false;
        const direction=point.clone().sub(muzzle).normalize();
        if(!Number.isFinite(direction.x)||direction.lengthSq()<.5)return false;
        const mesh=new THREE.Mesh(rocketGeometry,rocketMaterial);
        mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction);
        mesh.position.copy(muzzle).addScaledVector(direction,.45);
        arenaPresentationRoot.add(mesh);
        activeRockets.push({ownerId,mesh,direction,speed,radius,damage,life:4});
        return true;
    }
    /** Blast hits originate only on physically ray-visible surfaces; other
     * plates and solid cover shield internal hardware. No indiscriminate
     * "all slots within radius" health subtraction.
     */
    function blastContacts(position,radius,nominal) {
        const blockers=[...combatPickMeshes(),...exterior.pickMeshes,...worldSolids];
        const rigs=[{id:'player',exterior},...squadCombatants.values()];
        const contacts=[];
        for(const rig of rigs) {
            if(rig.cleared)continue;
            rig.exterior.root.updateWorldMatrix(true,true);
            for(const [slot,group] of rig.exterior.partGroups) {
                const direct=group.getWorldPosition(new THREE.Vector3()).sub(position);
                const length=direct.length();
                if(length>radius+1||length<1e-5)continue;
                direct.divideScalar(length);
                raycaster.set(position,direct);raycaster.far=Math.min(radius+1,length+.8);
                const hit=raycaster.intersectObjects(blockers,false)[0];
                if(!hit)continue;
                const cover=firstCoverHit(position,direct,world.obstacles,raycaster.far,.035);
                if(cover&&cover.distance<hit.distance-.01)continue;
                if(hit.object.userData.actorId!==rig.id||hit.object.userData.slot!==slot)continue;
                const damage=blastDamage(hit.distance,radius,nominal);
                if(damage<=0)continue;
                const normal=hit.face?.normal.clone().transformDirection(hit.object.matrixWorld)
                    ??direct.clone().negate();
                const driveSide=slot==='mobility'
                    ? (rig.exterior.root.worldToLocal(hit.point.clone()).x<0?'left':'right') : undefined;
                contacts.push({contact:{actorId:rig.id,slot,blockedBy:null,
                    point:hit.point.clone(),normal,muzzle:position.clone(),distance:hit.distance,
                    surfaceHit:surfaceContact(hit,hit.point,normal),driveSide},damage});
            }
        }
        return contacts;
    }
    function clearRockets() {
        for(const p of activeRockets)arenaPresentationRoot.remove(p.mesh);
        activeRockets.length=0;
    }
    function advanceRockets(dt) {
        const impacts=[];
        for(let i=activeRockets.length-1;i>=0;i--) {
            const p=activeRockets[i];
            const sweep=rocketFlightStep({position:p.mesh.position,direction:p.direction,speed:p.speed,life:p.life},dt);
            if(!sweep){arenaPresentationRoot.remove(p.mesh);activeRockets.splice(i,1);continue;}
            const start=new THREE.Vector3(sweep.start.x,sweep.start.y,sweep.start.z);
            raycaster.set(start,p.direction);raycaster.far=sweep.distance;
            const hit=raycaster.intersectObjects([
                ...combatPickMeshes(p.ownerId),
                ...(p.ownerId==='player'?[]:exterior.pickMeshes),...worldSolids],false)[0]??null;
            const cover=firstCoverHit(start,p.direction,world.obstacles,sweep.distance,.035);
            const coverFirst=!!cover&&(!hit||cover.distance<hit.distance-.01);
            if(coverFirst||hit) {
                const point=coverFirst?new THREE.Vector3(...cover.point):hit.point.clone();
                flashDamageLight(point,0xffa64f,9,.17,6);
                for(let spark=0;spark<6;spark++)activateParticle(sparkPool,'spark',point,
                    randomBurstDirection(p.direction.clone().negate(),1).multiplyScalar(2.2),
                    .7,.22,-4,0,0xffb25d);
                const contacts=blastContacts(point,p.radius,p.damage);
                // A true direct collision is authoritative even when its
                // surface normal means the radial ray would backface-cull.
                const direct=coverFirst?null:hit;
                if(direct?.object.userData.actorId && direct?.object.userData.slot) {
                    const slot=direct.object.userData.slot,actorId=direct.object.userData.actorId;
                    const old=contacts.findIndex(p=>p.contact.actorId===actorId&&p.contact.slot===slot);
                    if(old>=0)contacts.splice(old,1);
                    const normal=direct.face?.normal.clone().transformDirection(direct.object.matrixWorld)
                        ??p.direction.clone().negate();
                    contacts.unshift({contact:{actorId,slot,blockedBy:null,point:point.clone(),
                        muzzle:point.clone().addScaledVector(p.direction,-.05),normal,
                        distance:0,surfaceHit:surfaceContact(direct,point,normal)},damage:p.damage});
                }
                impacts.push({ownerId:p.ownerId,point,contacts});
                arenaPresentationRoot.remove(p.mesh);activeRockets.splice(i,1);
                continue;
            }
            p.mesh.position.set(sweep.end.x,sweep.end.y,sweep.end.z);
            p.life=sweep.lifeAfter;
            if(p.life<=0){arenaPresentationRoot.remove(p.mesh);activeRockets.splice(i,1);}
        }
        return impacts;
    }
    /** Brief electrical contact: geometry and damage are resolved elsewhere.
     * One cheap warm arc on actual <=6m contact, not an always-on laser ray.
     */
    function showCuttingArc(contact) {
        if(!contact?.muzzle||!contact?.point)return;
        const offset=contact.normal.clone().multiplyScalar(.027);
        const tip=contact.point.clone().add(offset);
        const arc=new THREE.Line(new THREE.BufferGeometry().setFromPoints([contact.muzzle,tip]),
            new THREE.LineBasicMaterial({color:0x8cebd1,transparent:true,opacity:.78}));
        arc.frustumCulled=false;
        arenaPresentationRoot.add(arc);
        transientFX.push({object:arc,remaining:.105,duration:.105,material:arc.material});
        flashDamageLight(tip,0x9deac7,4,.075,2.1);
    }
    function traceShot(spreadX, spreadY, muzzleZ, penetrate=false) {
        camera.updateMatrixWorld();
        cockpit.updateMatrixWorld(true);
        targetExterior.root.updateWorldMatrix(true, true);
        // A sighting ray finds what the pilot sees; the second ray starts at the
        // gun's actual off-center muzzle and is allowed to be obstructed.
        const sightDir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
        const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
        sightDir.addScaledVector(right, spreadX+(pilotStabilityPose?.yaw??0))
            .addScaledVector(up, spreadY+(pilotStabilityPose?.pitch??0)).normalize();
        raycaster.set(camera.position, sightDir);
        raycaster.far = 100;
        const visible = raycaster.intersectObjects([...combatPickMeshes(), ...worldSolids], false)[0];
        const aimPoint = visible ? visible.point : camera.position.clone().addScaledVector(sightDir, 100);
        const muzzle = gunPivot.localToWorld(new THREE.Vector3(0, -.04, muzzleZ + .62));
        const bore = aimPoint.clone().sub(muzzle).normalize();
        raycaster.set(muzzle, bore);
        raycaster.far = 100;
        const intersections = raycaster.intersectObjects([...combatPickMeshes(), ...worldSolids], false);
        const actual = intersections[0];
        const shieldedSlot = shieldedModuleOnRay(intersections, actual);
        const cover = certifiedCoverHit(muzzle, bore, 100, actual);
        const point = cover ? cover.point : actual ? actual.point.clone() : muzzle.clone().addScaledVector(bore, 100);
        const surfaceNormal = cover ? cover.normal : actual?.face
            ? actual.face.normal.clone().transformDirection(actual.object.matrixWorld)
            : bore.clone().negate();
        const slot = cover ? null : actual?.object.userData.slot;
        const actorId = cover ? null : actual?.object.userData.actorId ?? null;
        const blockedBy = cover?.id ?? actual?.object.userData.arenaObstacleId ?? null;
        const impactDistance = muzzle.distanceTo(point);
        const contact={ actorId: slot ? actorId : null, slot: slot ?? null, blockedBy,
            shieldedSlot: cover ? null : shieldedSlot,
            surfaceHit:cover?null:surfaceContact(actual,point,surfaceNormal),
            point, normal: surfaceNormal, muzzle, distance: impactDistance,
            // The sight may deliberately end on a wall/floor/rig. Only warn if
            // a separate first muzzle collision falls meaningfully SHORT of it.
            // The comparison uses real shot geometry and never changes firing.
            aimObstructed: muzzleRayFallsShort(
                muzzle.distanceTo(aimPoint), impactDistance, !!(cover||actual)) };
        if(penetrate)contact.penetrationContacts=penetrationContacts(contact,intersections,cover,muzzle,bore);
        return contact;
    }
    /** UI-only predicted zero-spread line from the *actual barrel*, never a
     * camera-only hit promise. Uses the exact authoritative traceShot path.
     * Throttled by caller; cannot fire, damage, or consume ammunition. */
    function predictShotObstruction(muzzleZ) {
        if(inspecting || !Number.isFinite(muzzleZ)) return null;
        const contact=traceShot(0,0,muzzleZ);
        if(!locallyBlockedMuzzle(contact))return null;
        const hitSquad=contact.actorId?squadCombatants.get(contact.actorId):null;
        if(hitSquad?.team==='friendly')return 'friendly';
        return 'cover';
    }
    function traceCombatantShot(shooterId, targetId, aimSlot, spreadX, spreadY, penetrate=false) {
        const shooter = squadCombatants.get(shooterId);
        const target = targetId === 'player'
            ? { id: 'player', assembly: initial, exterior }
            : squadCombatants.get(targetId);
        if (!shooter || !target)
            return { actorId: null, slot: null, point: new THREE.Vector3(), normal: new THREE.Vector3(0, 1, 0), muzzle: new THREE.Vector3(), distance: 0 };
        shooter.exterior.root.updateWorldMatrix(true, true);
        target.exterior.root.updateWorldMatrix(true, true);
        const combatGroup = shooter.exterior.partGroups.get('combat');
        const weaponId = installedPart(shooter.assembly, 'combat')?.definition.id;
        const muzzleLocalZ = weaponId === 'gun-light' ? -2.16 : weaponId === 'gun-short' ? -1.03 : weaponId==='gun-scatter' ? -1.12 : weaponId === 'gun-rivet' ? -1.30 : weaponId === 'gun-breaker' ? -1.32 : weaponId === 'gun-rocket' ? -1.08 : weaponId === 'gun-arc' ? -1.14 : -1.58;
        const muzzle = combatGroup
            ? combatGroup.localToWorld(new THREE.Vector3(0, -.05, muzzleLocalZ))
            : shooter.exterior.root.localToWorld(new THREE.Vector3(1.17, 2.03, -1.55));
        const aimGroup = target.exterior.partGroups.get(aimSlot);
        const aimPoint = aimGroup
            ? aimGroup.getWorldPosition(new THREE.Vector3())
            : target.exterior.root.localToWorld(new THREE.Vector3(...SLOT_CENTERS[aimSlot]));
        const forward = aimPoint.clone().sub(muzzle).normalize();
        const worldUp = new THREE.Vector3(0, 1, 0);
        let right = new THREE.Vector3().crossVectors(forward, worldUp);
        if (right.lengthSq() < 1e-6) right.set(1, 0, 0); else right.normalize();
        const up = new THREE.Vector3().crossVectors(right, forward).normalize();
        const bore = forward.clone()
            .addScaledVector(right, spreadX+(shooter.stabilityPose?.yaw??0))
            .addScaledVector(up, spreadY+(shooter.stabilityPose?.pitch??0)).normalize();
        raycaster.set(muzzle, bore);
        raycaster.far = 100;
        const blockers = [...combatPickMeshes(shooterId), ...exterior.pickMeshes, ...worldSolids];
        const intersections = raycaster.intersectObjects(blockers, false);
        const actual = intersections[0];
        const shieldedSlot = shieldedModuleOnRay(intersections, actual);
        const cover = certifiedCoverHit(muzzle, bore, 100, actual);
        const point = cover ? cover.point : actual ? actual.point.clone() : muzzle.clone().addScaledVector(bore, 100);
        const surfaceNormal = cover ? cover.normal : actual?.face
            ? actual.face.normal.clone().transformDirection(actual.object.matrixWorld)
            : bore.clone().negate();
        const slot = cover ? null : actual?.object.userData.slot;
        const actorId = cover ? null : actual?.object.userData.actorId ?? null;
        const blockedBy = cover?.id ?? actual?.object.userData.arenaObstacleId ?? null;
        let driveSide;
        if (slot === 'mobility' && actorId) {
            const hitRoot = actorId === 'player' ? exterior.root : squadCombatants.get(actorId)?.exterior.root;
            if (hitRoot) {
                const local = hitRoot.worldToLocal(point.clone());
                driveSide = local.x < 0 ? 'left' : 'right';
            }
        }
        const contact={
            actorId: slot ? actorId : null,
            slot: slot ?? null, blockedBy, shieldedSlot: cover ? null : shieldedSlot,
            point, normal: surfaceNormal, muzzle,
            surfaceHit:cover?null:surfaceContact(actual,point,surfaceNormal),
            distance: muzzle.distanceTo(point), driveSide,
        };
        if(penetrate)contact.penetrationContacts=penetrationContacts(contact,intersections,cover,muzzle,bore);
        return contact;
    }
    function traceHostileShot(state, aimSlot, spreadX, spreadY) {
        return traceCombatantShot('enemy-0', 'player', aimSlot, spreadX, spreadY);
    }
    // Same actual plate hit and same damage. Extra local sparks make the
    // cause legible when a FRAME mesh genuinely intercepts a module behind it.
    function showShieldStrike(contact) {
        if (contact?.slot !== 'structure' || !contact.shieldedSlot) return;
        const point = contact.point.clone().addScaledVector(contact.normal, .045);
        flashDamageLight(point, 0xe8bc72, 2.8, .07, 2.2);
        for (let i = 0; i < 4; i++) {
            activateParticle(sparkPool, 'spark', point,
                randomBurstDirection(contact.normal, .5).multiplyScalar(1.1 + i * .35),
                .55 + i * .13, .13 + i * .04, -3.5, 0, 0xf2da91);
        }
    }
    /** Called ONCE when a round is consumed. Never by pellets or delayed contacts.
     * Preallocated low-poly meshes and pooled particles; no firing-time geometry.
     */
    function triggerPilotFiringEvent(weaponId,{muzzle=null,point=null,brace=0,condition=1,shotIndex=0}={}) {
        const profile=triggerFiringEvent(pilotFiringState,weaponId,{brace,condition});
        muzzleFlash=Math.max(muzzleFlash,weaponId==='gun-arc'?.025:
            weaponId==='gun-rivet'?.043:(pilotWeaponPresentation.muzzleFlashSeconds??.09));
        if(!muzzle||!profile.blast||weaponId==='gun-rivet'&&shotIndex%3!==1)return;
        // Vented soot, close-range pressure dust, and one unshadowed flash.
        // Heavy guns get more particles, but all use existing bounded pools.
        const count=Math.min(5,Math.max(1,Math.ceil(profile.blast*.5)));
        const direction=point?.isVector3?point.clone().sub(muzzle).normalize():
            new THREE.Vector3(0,0,-1).applyQuaternion(gunPivot.getWorldQuaternion(new THREE.Quaternion()));
        if(profile.blast>=4)flashDamageLight(muzzle,0xf1b565,Math.min(4,profile.blast*.40),.055,3);
        for(let i=0;i<count;i++){
            const velocity=direction.clone().multiplyScalar(.65+i*.25)
                .add(new THREE.Vector3((i%2?1:-1)*.24,.12+i*.06,(i%3-1)*.15));
            activateParticle(smokePool,'smoke',muzzle,velocity,.30+i*.09,
                .24+i*.05,0,.26,0x43413a,true);
        }
        if(profile.blast>=6&&muzzle.y<3.6){
            const ground=muzzle.clone();ground.y=Math.max(.07,ground.y-1.65);
            for(let i=0;i<2;i++)
                activateParticle(chipPool,'chip',ground,
                    new THREE.Vector3((i?1:-1)*1.0,.45,-.3),.5,.28,-1.7,0,0x88765a);
        }
    }
    function triggerCombatantFiringEvent(id,weaponId,{brace=0,condition=1}={}) {
        const record=squadCombatants.get(id);
        if(!record)return;
        const profile=firingProfile(weaponId);
        record.recoilKick=Math.min(.42,(record.recoilKick??0)+profile.travel*.21);
        record.recoilRecovery=1/Math.max(.09,profile.recovery);
        // The shooter, not a bullet/pellet impact, owns this impulse animation.
        if(!record.firingState)record.firingState=createFiringEventState();
        triggerFiringEvent(record.firingState,weaponId,{brace,condition});
    }
    function showShot(contact, outcome) {
        // Only actual world-cover hits add marks or rattle welded scraps.
        // This never changes penetration, damage, AI LOS or navigation.
        if(backlotEnvironment)recordBacklotCoverStrike(backlotEnvironment,contact);
        presentBattlefieldShot(contact,'player',pilotWeaponPresentation?.id);
        const hit = outcome !== null;
        const track = new THREE.BufferGeometry().setFromPoints([contact.muzzle, contact.point]);
        const trackMat = new THREE.LineBasicMaterial({ color: hit ? 0xf4c77e : 0xc7a76f, transparent: true, opacity: .92 });
        const tracer = new THREE.Line(track, trackMat);
        tracer.frustumCulled = false;
        scene.add(tracer);
        transientFX.push({ object: tracer, remaining: .14, duration: .14, material: trackMat });
        const impactPoint = contact.point.clone().addScaledVector(contact.normal, .045);
        const profile = spawnImpactParticles(impactPoint, contact.normal, outcome);
        recordHitInertia(contact,outcome);
        noteSurfaceImpact(contact,outcome);
        showShieldStrike(contact);
        if (outcome?.internalDamage > 0 && contact.actorId) recordDamageWound(contact.actorId, outcome.slot, impactPoint);
        if (outcome?.justDestroyed) {
            spawnCatastrophicBurst(impactPoint, contact.normal, outcome);
            markPartDestroyedVisual(contact.actorId, outcome.slot);
        } else if (outcome?.justDisabled || outcome?.wreckHit) {
            spawnDisableBurst(impactPoint, contact.normal, outcome);
            if (outcome.justDisabled) markPartDisabledVisual(contact.actorId, outcome.slot);
        }
        if (hit && contact.actorId === 'enemy-0') {
            // Keep persistent soot on the selected contract leader; auxiliary rigs
            // still receive damage tinting and particles without growing mark pools.
            // A dark local scar belongs to the struck machine. Breaches and disable events
            // leave larger marks, but we do not invent mesh fracture or generic explosions.
            const soot = new THREE.Mesh(new THREE.IcosahedronGeometry(.075 * profile.markScale, 0), new THREE.MeshBasicMaterial({ color: profile.kind === 'penetration' || profile.kind.includes('disable') ? 0x111512 : 0x252720, depthWrite: false }));
            targetExterior.root.updateWorldMatrix(true, false);
            soot.position.copy(targetExterior.root.worldToLocal(impactPoint));
            rangeMarks.add(soot);
            sootMarks.push(soot);
            if (sootMarks.length > 32) {
                const oldest = sootMarks.shift();
                rangeMarks.remove(oldest);
                oldest.geometry.dispose();
                oldest.material.dispose();
            }
        }
    }
    function showHostileShot(contact, outcome) {
        // Only actual world-cover hits add marks or rattle welded scraps.
        // This never changes penetration, damage, AI LOS or navigation.
        if(backlotEnvironment)recordBacklotCoverStrike(backlotEnvironment,contact);
        presentBattlefieldShot(contact,'enemy-0','gun-cannon');
        const hit = outcome !== null;
        const track = new THREE.BufferGeometry().setFromPoints([contact.muzzle, contact.point]);
        const trackMat = new THREE.LineBasicMaterial({ color: hit ? 0xff9e62 : 0xb97955, transparent: true, opacity: .88 });
        const tracer = new THREE.Line(track, trackMat);
        tracer.frustumCulled = false;
        scene.add(tracer);
        transientFX.push({ object: tracer, remaining: .17, duration: .17, material: trackMat });
        // A tiny muzzle flash identifies the hostile rig's firing point without adding a bespoke weapon renderer.
        activateParticle(sparkPool, 'spark', contact.muzzle, new THREE.Vector3(0, .08, 0), 1.15, .09, 0, 0, 0xffd79a);
        const impactPoint = contact.point.clone().addScaledVector(contact.normal, .045);
        spawnImpactParticles(impactPoint, contact.normal, outcome);
        recordHitInertia(contact,outcome);
        noteSurfaceImpact(contact,outcome);
        showShieldStrike(contact);
    }
    /** Apply the physical state after the normal injury tint. Do not spawn
     * lights, effects, materials, colliders or fabricated failures. Optical
     * shutdown, dead radiators, jammed barrels and hydraulic joints are only
     * darkened where their real authored metal/optical surfaces exist.
     */
    function signalPhysicalModuleFailures(exterior,parts){
        if(!parts)return;
        for(const [slot,meshes] of exterior.partMeshes){
            const signal=moduleFailureSignature(slot,parts[slot]);
            if(!signal)continue;
            const group=exterior.partGroups.get(slot);
            if(group)group.userData.functionalSignal={
                status:signal.disabled?'DISABLED':signal.stressed?'DEGRADED':'OPERATING',
                effect:signal.effect,
            };
            if(!signal.disabled&&!signal.stressed)continue;
            for(const mesh of meshes){
                const material=mesh.material;
                if(!material?.isMeshStandardMaterial)continue;
                const surface=mesh.userData?.surface||{};
                const factor=failureSurfaceFactor(signal,{
                    ...surface,name:mesh.name||'',
                });
                if(factor===1)continue;
                material.color.multiplyScalar(factor);
                if(signal.disabled&&
                  (slot==='power'||slot==='command'||slot==='combat')){
                    // Physically dead hardware must not glow as if powered.
                    material.emissive.setHex(0);
                    material.emissiveIntensity=0;
                }
            }
        }
    }
    function updateCombatantDamage(id, condition) {
        const record = squadCombatants.get(id);
        if (!record || !condition?.parts) return;
        record.condition = condition;
        for(const slot of ['mobility','structure','command','power','combat']){
            const part=condition.parts[slot];
            if(part&&!part.destroyed&&part.integrity<=0&&!record.disabledSlots.has(slot))
                markPartDisabledVisual(id,slot);
        }
        // A restarted module should return to its mounting datum. Disabling a
        // subsystem is NOT permanent deformation; only destruction detaches it.
        for(const slot of [...record.disabledSlots]) {
            const part=condition.parts[slot];
            if(!part || part.destroyed || part.integrity<=0)continue;
            const group=record.exterior.partGroups.get(slot);
            const base=record.baseParts.get(slot);
            if(group&&base) {
                group.position.copy(base.position);
                group.rotation.copy(base.rotation);
            }
            record.disabledSlots.delete(slot);
        }
        for (const [slot, meshes] of record.exterior.partMeshes) {
            const state = condition.parts[slot];
            if (!state) continue;
            const damage = 1 - state.integrity / state.maxIntegrity;
            const stripped = 1 - state.armor / state.maxArmor;
            for (const mesh of meshes) {
                const material = mesh.material;
                const color = record.colors.get(mesh);
                if (!(material instanceof THREE.MeshStandardMaterial) || !color) continue;
                if (state.destroyed) {
                    material.color.copy(color).multiplyScalar(.075);
                    material.emissive.setHex(0); material.emissiveIntensity = 0;
                    markPartDestroyedVisual(id, slot);
                } else {
                    material.color.copy(color).multiplyScalar(Math.max(.24, 1 - damage * .68 - stripped * .18));
                    const severe = state.integrity / Math.max(1, state.maxIntegrity) < .32;
                    material.emissive.setHex(state.integrity === 0 ? 0x4b1609 : severe ? 0x241008 : 0);
                    material.emissiveIntensity = state.integrity === 0 ? .58 : severe ? .16 : 0;
                }
            }
        }
        signalPhysicalModuleFailures(record.exterior,condition.parts);
    }
    function updateTargetDamage(condition) {
        updateCombatantDamage('enemy-0', condition);
    }
    function showCombatantShot(shooterId, contact, outcome) {
        // Only actual world-cover hits add marks or rattle welded scraps.
        // This never changes penetration, damage, AI LOS or navigation.
        if(backlotEnvironment)recordBacklotCoverStrike(backlotEnvironment,contact);
        const shooter = squadCombatants.get(shooterId);
        const friendly = shooter?.team === 'friendly';
        presentBattlefieldShot(contact,shooterId,
            installedPart(shooter?.assembly,'combat')?.definition.id??'gun-cannon');
        const track = new THREE.BufferGeometry().setFromPoints([contact.muzzle, contact.point]);
        const trackMat = new THREE.LineBasicMaterial({
            color: friendly ? 0x8be1b0 : 0xff9e62, transparent: true, opacity: .86,
        });
        const tracer = new THREE.Line(track, trackMat);
        tracer.frustumCulled = false;
        scene.add(tracer);
        transientFX.push({ object: tracer, remaining: .16, duration: .16, material: trackMat });
        activateParticle(sparkPool, 'spark', contact.muzzle, new THREE.Vector3(0, .08, 0), 1.05, .08, 0, 0, friendly ? 0xbaf4c9 : 0xffd79a);
        if (outcome) {
            const impactPoint = contact.point.clone().addScaledVector(contact.normal, .045);
            spawnImpactParticles(impactPoint, contact.normal, outcome);
            recordHitInertia(contact,outcome);
            noteSurfaceImpact(contact,outcome);
            showShieldStrike(contact);
            if (outcome.internalDamage > 0 && contact.actorId) recordDamageWound(contact.actorId, outcome.slot, impactPoint);
            if (outcome.justDestroyed) {
                spawnCatastrophicBurst(impactPoint, contact.normal, outcome);
                markPartDestroyedVisual(contact.actorId, outcome.slot);
            } else if (outcome.justDisabled || outcome.wreckHit) {
                spawnDisableBurst(impactPoint, contact.normal, outcome);
                if (outcome.justDisabled) markPartDisabledVisual(contact.actorId, outcome.slot);
            }
        }
    }
    function updatePilotDamage(condition) {
        latestPilotParts=condition?.parts||null;
        surfaceMarks.reconcile(exterior);
        poseDamagedMachineInGarage();
        for (const [slot, meshes] of exterior.partMeshes) {
            const state = condition.parts[slot];
            if (!state)
                continue;
            const damage = 1 - state.integrity / state.maxIntegrity;
            const stripped = 1 - state.armor / state.maxArmor;
            for (const mesh of meshes) {
                const material = mesh.material;
                const color = pilotColors.get(mesh);
                if (!(material instanceof THREE.MeshStandardMaterial) || !color)
                    continue;
                if (state.destroyed) {
                    material.color.copy(color).multiplyScalar(.075);
                    material.emissive.setHex(0); material.emissiveIntensity = 0;
                } else {
                    material.color.copy(color).multiplyScalar(1 - damage * .56 - stripped * .11);
                    material.emissive.setHex(state.integrity === 0 ? 0x30150b : 0);
                    material.emissiveIntensity = state.integrity === 0 ? .35 : 0;
                }
            }
        }
        signalPhysicalModuleFailures(exterior,condition.parts);
    }
    function resetTargetDamage(condition) {
        clearPooledParticles();
        for(const record of squadCombatants.values()){
            clearFractures(record.fractureParts);
            if(record.hitResponse)Object.assign(record.hitResponse,createHitResponse());
        }
        while (sootMarks.length) {
            const mark = sootMarks.pop();
            rangeMarks.remove(mark);
            mark.geometry.dispose();
            mark.material.dispose();
        }
        updateTargetDamage(condition);
    }
    // Repair is a blue welding signature; fitting/removing hardware uses warm,
    // shorter bursts. This is one bounded pooled effect, not a new particle stack.
    function playWorkshopAction(slot='structure',kind='repair'){
        if(!inspecting||vendorEnabled)return false;
        exterior.root.updateWorldMatrix(true,true);
        const group=exterior.partGroups.get(slot);
        const point=new THREE.Vector3();
        if(group)group.getWorldPosition(point);
        else exterior.root.getWorldPosition(point).y+=1.15;
        const service=kind==='repair';
        const palette=service?[0x77dfff,0xd9f9ff,0x559bff]:
            kind==='install'?[0xf3bd70,0xe8d7a7,0xa3ada6]:
            [0xbbaf9d,0xf1bc79,0x757d79];
        if(service)flashDamageLight(point,0x78dfff,2.4,.085,2.4);
        const count=service?20:kind==='install'?12:7;
        for(let i=0;i<count;i++){
            const origin=point.clone().add(new THREE.Vector3(
                (Math.random()-.5)*.58,(Math.random()-.5)*.43,
                (Math.random()-.5)*.52));
            const velocity=new THREE.Vector3(
                (Math.random()-.5)*3.6, .8+Math.random()*2.3,
                (Math.random()-.5)*2.8);
            activateParticle(sparkPool,'spark',origin,velocity,
                .52+Math.random()*.42,.24+Math.random()*.28,-3.0,0,
                palette[i%palette.length]);
        }
        return true;
    }
    const garageFailureBudget=makeEmitterBudget();
    const garageFailureVisual={exterior};
    function updateGarageFailureEffects(dt){
        if(!inspecting||vendorEnabled||!latestPilotParts)return;
        exterior.root.updateWorldMatrix(true,true);
        for(const slot of SLOTS){
            const part=latestPilotParts[slot];
            if(!part)continue;
            const profile=persistentFailureProfile(slot,integrityRatio(part));
            if(profile.severity<.34&&!part.destroyed)continue;
            const budget=garageFailureBudget.get(slot);
            budget.spark+=(profile.sparkRate+(part.destroyed?1.1:0))*dt*.75;
            budget.smoke+=(profile.smokeRate+(part.destroyed ? .6 : 0))*dt*.85;
            budget.arc+=(profile.arcRate+(slot==='power' && part.destroyed ? .7 : 0))*dt*.6;
            while(budget.spark>=1){
                budget.spark-=1;
                const position=partWorldPoint(garageFailureVisual,slot);
                activateParticle(sparkPool,'spark',position,
                    new THREE.Vector3((Math.random()-.5)*1.6,.65+Math.random()*1.35,
                    (Math.random()-.5)*1.6),.55+Math.random()*.4,
                    .19+Math.random()*.24,-3.2,0,slot==='power'?0x9fdcff:0xffb96f);
            }
            while(budget.smoke>=1){
                budget.smoke-=1;
                activateParticle(smokePool,'smoke',partWorldPoint(garageFailureVisual,slot),
                    new THREE.Vector3((Math.random()-.5)*.17,.24+Math.random()*.20,
                    (Math.random()-.5)*.17),.9+profile.severity*.55,
                    1.2+Math.random()*.85,0,1.1,0x222922,true);
            }
            while(budget.arc>=1){
                budget.arc-=1;
                spawnWorldPowerArc(partWorldPoint(garageFailureVisual,slot),.45+profile.severity*.5);
            }
        }
    }
    function updateCombatEffects(dt) {
        if(backlotEnvironment)advanceBacklotTerrain(backlotEnvironment,dt);
        updateGarageFailureEffects(dt);
        // No frame may synchronously clip an unbounded impact queue. Persistent
        // damage is recorded on hit; its cosmetic mesh catches up incrementally.
        flushSurfaceMarks(2);
        surfaceMarks.update();
        victoryStage?.scars.update();
        pilotFiringPose=advanceFiringEvent(pilotFiringState,dt);
        advanceHitResponse(pilotHitResponse,dt);
        for(const record of squadCombatants.values()){
            if(record.firingState)advanceFiringEvent(record.firingState,dt);
            if(record.hitResponse)advanceHitResponse(record.hitResponse,dt);
        }
        muzzleFlash = Math.max(0, muzzleFlash - dt);
        for(const streak of ricochetLines){
            if(streak.life<=0)continue;
            streak.life=Math.max(0,streak.life-dt);
            streak.line.material.opacity=streak.life/streak.duration*.88;
            if(streak.life<=0)streak.line.visible=false;
        }
        for (const record of squadCombatants.values()) record.recoilKick = Math.max(0, (record.recoilKick ?? 0) - dt * (record.recoilRecovery ?? 3.2));
        const hitDecay = Math.exp(-8.5 * dt);
        hitPitchKick *= hitDecay; hitRollKick *= hitDecay; hitYawKick *= hitDecay; hitShakeKick *= Math.exp(-10.5 * dt); gunDamageKick *= Math.exp(-5.2 * dt);
        powerBlackout = Math.max(0, powerBlackout - dt);
        powerFlicker = Math.max(0, powerFlicker - dt);
        powerArcCooldown = Math.max(0, powerArcCooldown - dt);
        if (!inspecting && pilotServiceSlot) {
            cockpit.updateWorldMatrix(true, true);
            pilotServiceSparkBudget += 82 * dt;
            while (pilotServiceSparkBudget >= 1) {
                pilotServiceSparkBudget -= 1;
                const side=Math.random()<.5?-1:1;
                const origin=pilotServiceSlot==='combat' ?
                    gunPivot.localToWorld(new THREE.Vector3(side*.14,.02,.26)) :
                    cockpit.localToWorld(new THREE.Vector3(side*.30,-.30,pilotServiceSlot==='power'?.12:-.25));
                const spread=new THREE.Vector3(side*(1.05+Math.random()*1.5),0,(Math.random()-.5)*1.2)
                    .transformDirection(gunPivot.matrixWorld).multiplyScalar(1.0);
                const velocity=spread.add(new THREE.Vector3(0,1.2+Math.random()*1.7,0));
                activateParticle(sparkPool,'spark',origin,velocity,1.1+Math.random()*.7,.32+Math.random()*.24,-2.0,0,Math.random()>.22?0x76dfff:0xe0fbff);
            }
        } else pilotServiceSparkBudget = 0;
        if (!inspecting && pilotRecoveryBurstPending) {
            cockpit.updateWorldMatrix(true, true);
            const origin = cockpit.localToWorld(new THREE.Vector3(0,-.28,-.15));
            flashDamageLight(origin, 0x76dfff, 5.5, .10, 3.6);
            for (let i = 0; i < 16; i++) {
                const side=i%2===0?-1:1;
                activateParticle(sparkPool,'spark',origin,new THREE.Vector3(side*(1.3+Math.random()*2),1.4+Math.random()*2.1,(Math.random()-.5)*1.7),1.2+Math.random()*.7,.30+Math.random()*.23,-2.4,0,i%3?0x76dfff:0xe0fbff);
            }
            pilotRecoveryBurstPending = false;
        }
        if (!inspecting && persistentPowerHealth < .52 && powerArcCooldown <= 0) {
            const severity = 1 - persistentPowerHealth;
            spawnCockpitPowerArc(.72 + severity * .75);
            powerFlicker = Math.max(powerFlicker, .08 + severity * .11);
            powerArcCooldown = 1.25 + Math.random() * (2.7 - severity);
        }
        const now = performance.now();
        const flickerWave = Math.abs(Math.sin(now * .105));
        const flicker = powerFlicker > 0 ? (flickerWave > .67 ? .68 : .16 + flickerWave * .16) : 0;
        blackoutMaterial.opacity = powerBlackout > 0 ? .995 : flicker;
        const screenOpacity = powerBlackout > 0 ? .01 : powerFlicker > 0 ? (flickerWave > .67 ? .12 : .74) : .92;
        for (const screen of Object.values(cockpit.userData.instrumentScreens)) screen.mesh.material.opacity = screenOpacity;
        const commandDamage = Math.max(0, .62 - persistentCommandHealth) / .62;
        combinerHud.position.x = Math.sin(now * .089) * commandDamage * .00085;
        combinerHud.position.y = Math.sin(now * .071 + 1.8) * commandDamage * .00055;
        for (const state of fallingParts.values()) {
            if (state.settled) continue;
            state.velocity.y -= 7.8 * dt;
            state.group.position.addScaledVector(state.velocity, dt);
            state.group.rotation.x += state.spin.x * dt;
            state.group.rotation.y += state.spin.y * dt;
            state.group.rotation.z += state.spin.z * dt;
            // Only examine individual mesh bounds when the falling assembly
            // can actually reach the floor. Early frames use a conservative
            // bounding-sphere radius rather than walking every child mesh.
            const canTouchFloor=state.group.position.y-(state.fallRadius??0)<=.08;
            if(!canTouchFloor||state.velocity.y>0)continue;
            state.group.updateWorldMatrix(true,true);
            const bounds=new THREE.Box3().setFromObject(state.group);
            if (bounds.min.y <= .025) {
                state.group.position.y += .025 - bounds.min.y;
                state.velocity.set(0, 0, 0); state.spin.multiplyScalar(.18); state.settled = true;
                const hit = state.group.getWorldPosition(new THREE.Vector3()); hit.y = .05;
                for (let i = 0; i < 5; i++) activateParticle(chipPool, 'chip', hit, new THREE.Vector3((Math.random()-.5)*1.1, .35+Math.random()*.65, (Math.random()-.5)*1.1), .8, .45+Math.random()*.3, -6.5, 0, 0x4b4a42);
            }
        }
        for (const state of impactLights) {
            if (state.life <= 0) continue;
            state.life = Math.max(0, state.life - dt);
            state.light.intensity *= Math.exp(-16 * dt);
            if (state.life <= 0) { state.light.intensity = 0; state.light.visible = false; }
        }
        const pulse = .55 + .45 * Math.abs(Math.sin(performance.now() * .008));
        const lamps = cockpit.userData.warningLamps;
        lamps.amberLampMat.emissiveIntensity = cockpitWarningLevel >= 1 ? 1.4 * pulse : .08;
        lamps.redLampMat.emissiveIntensity = cockpitWarningLevel >= 2 ? 2.8 * pulse : .03;
        lamps.amberWash.intensity = cockpitWarningLevel >= 1 ? 1.8 * pulse : 0;
        lamps.redWash.intensity = cockpitWarningLevel >= 2 ? 3.4 * pulse : 0;
        for (let index = transientFX.length - 1; index >= 0; index--) {
            const fx = transientFX[index];
            fx.remaining -= dt;
            if (fx.remaining <= 0) {
                scene.remove(fx.object);
                fx.object.geometry.dispose();
                fx.material.dispose();
                transientFX.splice(index, 1);
            }
            else if ('opacity' in fx.material) {
                fx.material.opacity = fx.remaining / fx.duration;
            }
        }
        for (const state of particleStates) {
            if (!state.mesh.visible)
                continue;
            state.life -= dt;
            if (state.life <= 0) {
                state.mesh.visible = false;
                continue;
            }
            state.velocity.y += state.gravity * dt;
            state.mesh.position.addScaledVector(state.velocity, dt);
            state.mesh.rotation.x += dt * 4.1;
            state.mesh.rotation.z += dt * 3.2;
            const t = state.life / state.duration;
            if (state.smoke) {
                state.mesh.quaternion.copy(camera.quaternion);
                const scale = state.baseScale * (1 + (1 - t) * state.grow);
                state.mesh.scale.setScalar(scale);
                state.mesh.material.opacity = .52 * t;
            }
            else
                state.mesh.material.opacity = Math.min(1, t * 1.8);
        }
        // Every damaged combatant can now communicate distress; the old build only emitted
        // sustained effects from the selected contract leader.
        for (const record of squadCombatants.values()) {
            if (!record.condition?.parts || record.cleared) continue;
            record.exterior.root.updateWorldMatrix(true, true);
            if (record.serviceSlot && record.active && !record.wrecked) {
                record.serviceSparkBudget += 82 * dt;
                while (record.serviceSparkBudget >= 1) {
                    record.serviceSparkBudget -= 1;
                    const side=Math.random()<.5?-1:1;
                    const origin=(record.serviceSlot==='combat'?weaponServicePoint(record):
                        partWorldPoint(record,record.serviceSlot)).add(new THREE.Vector3(side*.12,.04,0));
                    const velocity=new THREE.Vector3(side*(1.05+Math.random()*1.45),1.1+Math.random()*1.8,(Math.random()-.5)*1.6);
                    activateParticle(sparkPool,'spark',origin,velocity,1.15+Math.random()*.65,.32+Math.random()*.22,-2.1,0,Math.random()>.22?0x76dfff:0xe0fbff);
                }
            } else record.serviceSparkBudget = 0;
            if (record.recoveryBurstPending && record.active && !record.wrecked) {
                const origin = partWorldPoint(record,record.lastServiceSlot??'combat');
                flashDamageLight(origin, 0x76dfff, 6.5, .10, 4.2);
                for (let i = 0; i < 18; i++) {
                    const side=i%2===0?-1:1;
                    activateParticle(sparkPool,'spark',origin,new THREE.Vector3(side*(1.3+Math.random()*2.0),1.3+Math.random()*2.1,(Math.random()-.5)*1.8),1.2+Math.random()*.7,.30+Math.random()*.25,-2.4,0,i%3?0x76dfff:0xe0fbff);
                }
                record.recoveryBurstPending = false;
            }
            for (const slot of SLOTS) {
                const part = record.condition.parts[slot];
                if (!part) continue;
                const profile = persistentFailureProfile(slot, integrityRatio(part));
                const budget = record.emitterBudget.get(slot);
                const wreckSmoke = record.wrecked ? .42 : 0;
                const destroyedSpark = part.destroyed ? (slot === 'power' ? 2.8 : 1.2) : 0;
                const destroyedSmoke = part.destroyed ? (slot === 'power' ? 1.15 : .62) : 0;
                budget.spark += (profile.sparkRate + destroyedSpark) * dt * (record.wrecked ? .82 : 1);
                budget.smoke += (profile.smokeRate + wreckSmoke + destroyedSmoke) * dt;
                budget.arc += (profile.arcRate + (part.destroyed && slot === 'power' ? .85 : 0)) * dt;
                // Only a genuine exposed, damaged mobility unit can drip fluid.
                // At most ~1 pooled bead per second, never a new fluid solver.
                if(slot==='mobility'&&part.armor<=.001&&integrityRatio(part)<.55)
                    budget.fluid=Math.min(2,(budget.fluid??0)+
                        (.4+(1-integrityRatio(part))*.65)*dt);
                while(budget.fluid>=1){
                    budget.fluid-=1;
                    const origin=partWorldPoint(record,slot);
                    activateParticle(chipPool,'chip',origin,
                        new THREE.Vector3((Math.random()-.5)*.25,-.12,(Math.random()-.5)*.25),
                        .28,.38+Math.random()*.22,-8,0,0x5e4d32);
                }
                while (budget.spark >= 1) {
                    budget.spark -= 1;
                    const origin = partWorldPoint(record, slot);
                    const velocity = new THREE.Vector3((Math.random() - .5) * 1.8, .5 + Math.random() * 1.6, (Math.random() - .5) * 1.8);
                    activateParticle(sparkPool, 'spark', origin, velocity, .55 + Math.random() * .5, .18 + Math.random() * .22, -3.8, 0, 0xffb951);
                }
                while (budget.smoke >= 1) {
                    budget.smoke -= 1;
                    const origin = partWorldPoint(record, slot);
                    const velocity = new THREE.Vector3((Math.random() - .5) * .18, .30 + Math.random() * .30, (Math.random() - .5) * .18);
                    activateParticle(smokePool, 'smoke', origin, velocity, 1.0 + profile.severity * .85, 1.45 + Math.random() * 1.15, 0, 1.65, slot === 'power' ? 0x171b18 : 0x252823, true);
                }
                while (budget.arc >= 1) {
                    budget.arc -= 1;
                    spawnWorldPowerArc(partWorldPoint(record, slot), .65 + profile.severity * .65);
                }
            }
        }
    }
    function combatantVisualAudit() {
        const misplaced = [];
        for (const record of squadCombatants.values()) {
            for (const [slot, group] of record.exterior.partGroups) {
                let node = group, owned = false;
                while (node) { if (node === record.exterior.root) { owned = true; break; } node = node.parent; }
                const legitimatelyDetached = record.destroyedSlots.has(slot) && (slot === 'combat' || slot === 'power') && group.parent === scene;
                if (!owned && !legitimatelyDetached) misplaced.push(`${record.id}:${slot}`);
            }
        }
        return { ok: misplaced.length === 0, actors: squadCombatants.size, misplaced };
    }
    selectPart(selected);
    return {
        scene, camera, cockpit, debugColliders,
        updateRigVisual, updateTargetRigVisual, updateHostileNavigation, setInspection, setSpectatorRig, orbitSpectatorBy, zoomSpectatorBy, resetSpectatorOrbit, setAnimationPreview, rebuildAssembly, recalibratePlayerSoles, selectPart, setPaintSelectedSlots, setPreviewPart, focusPart,
        setPilotingLab, updatePilotingLabRig, pilotingLabFootReadout, recordFootprint, setPilotStabilizer,
        setVendorStock, setVendorMode, selectVendorLot, pickVendorLot,
        orbitBy, panBy, setInspectorLayout, zoomBy, resetOrbit, pickPart, pickSurfaceEvidence, revealPart,
        drainSurfaceEvents,restoreSurfaceMarks,refreshInspectionBase,
        beginVictoryShowcase,updateVictoryShowcase,endVictoryShowcase,victoryNameplateAnchors,setPitPresentation,
        playWorkshopAction,
        traceShot, predictShotObstruction, showShot, triggerPilotFiringEvent, triggerCombatantFiringEvent, traceHostileShot, showHostileShot, launchRocket, advanceRockets, blastContacts, clearRockets, showCuttingArc, updateTargetDamage, updatePilotDamage, resetTargetDamage, updateCombatEffects, setPilotWeapon,
        addCombatant, repaintCombatant, setCombatantActive, setCombatantCleared, updateCombatantRig, updateCombatantDamage, traceCombatantShot, showCombatantShot, updateShotAudit, updateObjectivePresentation,
        updateCockpitInstruments, updateCockpitMotion, triggerCockpitHit, resetCockpitTransientFeedback, combatantVisualAudit, partThumbnailDataUrl, rigThumbnailDataUrl,
    };
}
function mat(color, roughness = 0.82, metalness = 0.18) {
    return new THREE.MeshStandardMaterial({ color, roughness, metalness, flatShading: true });
}
function box(w, h, d, material) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d, 1, 1, 1), material);
    mesh.castShadow = true; mesh.receiveShadow = true;
    return mesh;
}

/** Bounded decorative pit-service equipment, no picking, solids or physics. */
function buildServiceDressing() {
    const root=new THREE.Group();root.name='physical-service-equipment';
    const supports=new THREE.Group();supports.name='service-jacks';
    const steel=mat(0x495650,.81,.35),deep=mat(0x202a28,.90,.10);
    const warning=mat(0xc79b45,.84,.15),accent=mat(0x5b817b,.72,.25);
    for(const side of [-1,1]){
        const x=side*1.42,z=.54;
        const foot=box(.66,.12,.70,steel);foot.position.set(x,.105,z);supports.add(foot);
        const mast=box(.14,.68,.14,warning);mast.position.set(x,.49,z);supports.add(mast);
        const collar=box(.35,.13,.35,deep);collar.position.set(x,.84,z);supports.add(collar);
        const saddle=box(.54,.08,.22,steel);saddle.position.set(x,.92,z);supports.add(saddle);
    }
    root.add(supports);
    // Oil tray, secondary catch lip, work case. These are shop fixtures rather
    // than fictional dents or extracted machine parts.
    const tray=box(.86,.05,.59,deep);tray.position.set(.08,.075,.96);root.add(tray);
    const trayLip=box(.88,.055,.06,steel);trayLip.position.set(.08,.12,1.23);root.add(trayLip);
    const toolbox=box(.52,.27,.34,warning);toolbox.position.set(-1.9,.20,1.13);root.add(toolbox);
    const handle=box(.23,.045,.06,steel);handle.position.set(-1.9,.37,1.13);root.add(handle);
    // A mobile diagnostic trolley and calibrated mechanical work light.
    // Everything is static mesh except its low-cost light and CRT readout.
    const base=box(.73,.12,.49,deep);base.position.set(2.08,.19,-1.02);root.add(base);
    for(const z of [-1.20,-.83]){
        const axle=box(.12,.16,.13,steel);axle.position.set(2.08,.12,z);root.add(axle);
    }
    const post=box(.11,1.48,.12,steel);post.position.set(2.08,.91,-1.02);root.add(post);
    const monitor=box(.91,.68,.18,deep);monitor.position.set(1.80,1.48,-1.04);
    // The garage camera approaches from negative Z; face the CRT glass toward
    // the mechanic rather than showing its rear shell and mirrored text.
    monitor.rotation.y=Math.PI+.22;root.add(monitor);
    const canvas=document.createElement('canvas');canvas.width=128;canvas.height=64;
    const readout=new THREE.CanvasTexture(canvas);
    readout.colorSpace=THREE.SRGBColorSpace;
    readout.magFilter=THREE.NearestFilter;readout.minFilter=THREE.NearestFilter;
    const glass=new THREE.Mesh(new THREE.PlaneGeometry(.80,.55),
        new THREE.MeshBasicMaterial({map:readout,side:THREE.DoubleSide}));
    glass.position.set(0,0,.101);monitor.add(glass);
    const alertMat=new THREE.MeshStandardMaterial({color:0x5c9c87,emissive:0x245d50,
        emissiveIntensity:.7,roughness:.4});
    const warningLED=box(.11,.085,.025,alertMat);
    warningLED.position.set(.33,-.25,.11);monitor.add(warningLED);
    const arm=box(.58,.095,.095,warning);arm.position.set(1.76,2.08,-1.03);
    arm.rotation.z=.27;root.add(arm);
    const lampHousing=box(.30,.16,.27,steel);
    lampHousing.position.set(1.45,2.18,-1.04);root.add(lampHousing);
    const lampLens=box(.24,.035,.23,accent);
    lampLens.position.set(1.45,2.07,-1.04);root.add(lampLens);
    const lamp=new THREE.SpotLight(0xffce8d,0,4.4,.72,.8,2);
    lamp.position.set(1.45,2.08,-1.04);lamp.castShadow=false;
    root.add(lamp);root.add(lamp.target);
    const cable=box(.035,.48,.035,deep);cable.position.set(2.42,.49,-1.00);
    cable.rotation.z=.13;root.add(cable);
    const hose=box(.035,.29,.035,deep);hose.position.set(2.34,.94,-1.07);
    hose.rotation.z=-.32;root.add(hose);
    root.userData.stage={supports,warning:warningLED,lamp,readout};
    return root;
}
/** Temporary circuit-side recovery lane: dusty concrete, folded awning,
 * borrowed electrical service, low fence and portable job signage. No combat
 * hitboxes or persistent save objects are created here. */
function buildPitLane() {
    const root=new THREE.Group();root.name='circuit-pit-lane';
    const floor=mat(0x4e4938,.99,.03),steel=mat(0x59605a,.80,.28);
    const scaffold=mat(0x3a4e48,.82,.38),rust=mat(0x755036,.87,.16);
    const canvas=mat(0x8b7850,.96,.03),signal=mat(0xc9a456,.92,.08);
    const base=box(15,.17,12,floor);base.position.set(0,-.13,0);root.add(base);
    // Roll-up grit and painted service lanes distinguish the outdoor paddock.
    for(const side of [-1,1]){
        const stripe=box(.11,.016,6.7,signal);
        stripe.position.set(side*2.85,-.02,.12);root.add(stripe);
        for(const x of [side*5.0,side*6.6]){
            const mast=box(.17,3.65,.17,scaffold);
            mast.position.set(x,1.82,2.52);root.add(mast);
            const foot=box(.56,.15,.59,steel);
            foot.position.set(x,.08,2.52);root.add(foot);
        }
        const awning=box(2.30,.14,3.65,canvas);
        awning.position.set(side*5.78,3.54,1.13);awning.rotation.z=side*.048;
        root.add(awning);
        for(let i=0;i<4;i++){
            const spare=box(.77,.35,.55,i%2?rust:steel);
            spare.position.set(side*(3.5+(i%2)*.88),.2+Math.floor(i/2)*.36,2.68);
            root.add(spare);
        }
        const curb=box(.23,.26,5.7,rust);
        curb.position.set(side*7.15,.11,.1);root.add(curb);
    }
    // Low portable crowd railing at the back. The arena still exists outside.
    const backrail=box(13.3,.13,.14,steel);backrail.position.set(0,1.04,4.70);
    root.add(backrail);
    for(let i=-6;i<=6;i+=2){
        const leg=box(.12,1.45,.12,scaffold);leg.position.set(i,.75,4.70);
        root.add(leg);
    }
    const cable=box(5.1,.035,.04,rust);
    cable.position.set(-.4,.02,3.80);cable.rotation.y=.24;root.add(cable);
    // The arena key/hemisphere are intentionally hidden in inspection mode.
    // The separate pit therefore needs its own broad lighting; a short-range
    // single spot cannot illuminate the service pad or the rig on mobile.
    const pitAmbient=new THREE.HemisphereLight(0xb1c0b4,0x514637,1.35);
    root.add(pitAmbient);
    const pitKey=new THREE.DirectionalLight(0xffd5a0,2.25);
    pitKey.position.set(-4,8,6);root.add(pitKey);
    const pitFill=new THREE.DirectionalLight(0x88babc,1.0);
    pitFill.position.set(5,5,-4);root.add(pitFill);
    const flood=new THREE.SpotLight(0xffd4a0,5.0,17,.78,.7,1.2);
    flood.position.set(-3.8,5.10,3.50);root.add(flood);root.add(flood.target);
    flood.target.position.set(0,1.35,0);
    const signCanvas=document.createElement('canvas');
    signCanvas.width=384;signCanvas.height=96;
    const ctx=signCanvas.getContext('2d');
    if(ctx){
        ctx.fillStyle='#3b392d';ctx.fillRect(0,0,384,96);
        ctx.strokeStyle='#bda15c';ctx.lineWidth=5;ctx.strokeRect(4,4,376,88);
        ctx.fillStyle='#e5bd72';ctx.font=canvasFont(42,'identity');
        ctx.textAlign='center';ctx.fillText('FIELD PIT',192,52);
        ctx.fillStyle='#a7b3a2';ctx.font=canvasFont(17,'data',700);
        ctx.fillText('ROUND SERVICE // CREW LANE',192,78);
        const texture=new THREE.CanvasTexture(signCanvas);
        texture.colorSpace=THREE.SRGBColorSpace;
        const placard=new THREE.Mesh(new THREE.PlaneGeometry(3.15,.79),
            new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide}));
        placard.position.set(0,2.98,4.52);placard.rotation.y=Math.PI;
        root.add(placard);
    }
    return root;
}
function buildGarageBay() {
    const root = new THREE.Group();
    const steel = mat(0x2d3431, .72, .55);
    const darkSteel = mat(0x222a27, .84, .44);
    const concrete = mat(0x535248, .98, .02);
    const padMat = mat(0x343a34, .92, .08);
    const safety = mat(0xb18432, .82, .16);
    const teal = mat(0x2c6662, .82, .24);
    const rust = mat(0x714029, .88, .18);

    // Procedural workshop patina: presentation-only slab top, same physical bounds.
    const workshopTop = new THREE.MeshStandardMaterial({map:createWorkshopFloorTexture(),roughness:.99,metalness:0});
    const floor = box(18, .22, 15, [concrete,concrete,workshopTop,concrete,concrete,concrete]);
    floor.position.set(0, -.13, .35);
    root.add(floor);
    const pad = box(5.8, .15, 6.1, padMat);
    pad.position.set(0, .015, 0);
    root.add(pad);
    for (const x of [-3.03, 3.03]) {
        const rail = box(.16, .06, 6.4, safety);
        rail.position.set(x, .11, 0);
        root.add(rail);
    }
    for (const z of [-3.14, 3.14]) {
        const rail = box(6.2, .06, .16, safety);
        rail.position.set(0, .11, z);
        root.add(rail);
    }

    const backWall = box(18, 7.4, .38, darkSteel);
    backWall.position.set(0, 3.55, 6.15);
    root.add(backWall);
    const sideWall = box(.38, 7.4, 12.5, darkSteel);
    sideWall.position.set(-8.15, 3.55, .2);
    root.add(sideWall);

    // Four-post service lift and overhead gantry make the bay read as a place that can
    // actually remove several-ton modules, rather than a decorative arena backdrop.
    for (const x of [-3.55, 3.55]) {
        for (const z of [-2.35, 2.35]) {
            const post = box(.28, 4.9, .28, steel);
            post.position.set(x, 2.47, z);
            root.add(post);
            const foot = box(.65, .16, .65, safety);
            foot.position.set(x, .08, z);
            root.add(foot);
        }
    }
    for (const z of [-2.35, 2.35]) {
        const beam = box(7.7, .32, .34, steel);
        beam.position.set(0, 4.78, z);
        root.add(beam);
    }
    const bridge = box(.42, .38, 5.2, safety);
    bridge.position.set(.75, 5.02, 0);
    root.add(bridge);
    const trolley = box(.82, .42, .72, steel);
    trolley.position.set(.75, 4.72, -.15);
    root.add(trolley);
    for (const x of [.64, .86]) {
        const chain = new THREE.Mesh(new THREE.CylinderGeometry(.022, .022, 1.65, 6), steel);
        chain.position.set(x, 3.68, -.15);
        chain.castShadow = true;
        root.add(chain);
    }
    const hook = new THREE.Mesh(new THREE.TorusGeometry(.18, .045, 5, 10, Math.PI * 1.45), safety);
    hook.position.set(.75, 2.82, -.15);
    hook.rotation.z = Math.PI * .18;
    root.add(hook);

    // Back catwalk, rails and ladder.
    const walk = box(10.8, .18, 1.15, steel);
    walk.position.set(-.6, 3.18, 5.18);
    root.add(walk);
    for (const x of [-5.85, -3.6, -1.35, .9, 3.15, 4.8]) {
        const railPost = box(.08, .92, .08, safety);
        railPost.position.set(x, 3.68, 4.68);
        root.add(railPost);
    }
    const railTop = box(10.8, .08, .08, safety);
    railTop.position.set(-.6, 4.12, 4.68);
    root.add(railTop);
    for (const x of [-6.55, -6.15]) {
        const ladderSide = box(.08, 3.05, .08, safety);
        ladderSide.position.set(x, 1.62, 4.88);
        root.add(ladderSide);
    }
    for (let y = .35; y < 3.05; y += .34) {
        const rung = box(.46, .055, .07, safety);
        rung.position.set(-6.35, y, 4.88);
        root.add(rung);
    }

    // Work/storage dressing: lockers, bench, crates, drums and a spare-part rack.
    for (let i = 0; i < 4; i++) {
        const locker = box(.72, 2.05, .62, i % 2 ? steel : teal);
        locker.position.set(5.55 + (i % 2) * .78, 1.03, 4.25 - Math.floor(i / 2) * .72);
        root.add(locker);
    }
    const bench = box(3.2, .18, .85, rust);
    bench.position.set(-5.1, 1.08, 3.65);
    root.add(bench);
    for (const x of [-6.35, -3.85]) {
        const leg = box(.16, 1.0, .16, steel);
        leg.position.set(x, .54, 3.65);
        root.add(leg);
    }
    const rackA = box(.18, 2.7, .18, steel); rackA.position.set(6.65, 1.35, .75); root.add(rackA);
    const rackB = box(.18, 2.7, .18, steel); rackB.position.set(4.55, 1.35, .75); root.add(rackB);
    for (const y of [.42, 1.28, 2.14]) {
        const shelf = box(2.3, .10, 1.0, steel); shelf.position.set(5.6, y, .75); root.add(shelf);
        const spare = box(.65, .42, .72, y > 2 ? safety : teal); spare.position.set(5.6, y + .28, .75); root.add(spare);
    }
    for (const [x,z,c] of [[-5.9,1.7,0x765034],[-4.9,1.35,0x3b6660],[5.7,-2.7,0x6d432d]]) {
        const crate = box(1.05, .78, .92, mat(c, .92, .08));
        crate.position.set(x, .39, z);
        root.add(crate);
    }
    for (const [x,z] of [[-6.5,-2.9],[-5.75,-3.05],[6.35,3.0]]) {
        const drum = new THREE.Mesh(new THREE.CylinderGeometry(.34, .34, .9, 10), mat(0x4b5550, .78, .36));
        drum.position.set(x, .45, z); drum.castShadow = true; drum.receiveShadow = true; root.add(drum);
    }

    // Make painted structure readable at phone resolution without flattening
    // machinery into uniform studio lighting or adding extra sources.
    const shopLight=lightingProfile('workshop');
    const lampMat = new THREE.MeshStandardMaterial({ color: 0xffdfad, emissive: 0xffb454, emissiveIntensity:shopLight.fixtureEmission, roughness: .45 });
    for (const x of [-2.7, 0, 2.7]) {
        const fixture = box(1.55, .10, .25, lampMat);
        fixture.position.set(x, 5.45, -.3);
        root.add(fixture);
        const lamp = new THREE.PointLight(0xffc178,shopLight.fixtureIntensity,10,2.0);
        lamp.position.set(x, 5.15, -.3);
        root.add(lamp);
    }
    const hemi = new THREE.HemisphereLight(shopLight.ambientSky,shopLight.ambientGround,shopLight.ambient);
    root.add(hemi);
    const key = new THREE.DirectionalLight(0xffd19b,shopLight.key);
    key.position.set(-5, 8, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(shopLight.shadowSize,shopLight.shadowSize);
    key.shadow.camera.left = -9; key.shadow.camera.right = 9;
    key.shadow.camera.top = 8; key.shadow.camera.bottom = -4;
    key.shadow.camera.near = 1; key.shadow.camera.far = 24;
    key.shadow.bias = -.0006; key.shadow.normalBias = .045;
    root.add(key);
    const rim = new THREE.DirectionalLight(0x70a9a4,shopLight.rim);
    rim.position.set(6, 4, -5);
    root.add(rim);
    const fill = new THREE.DirectionalLight(0x8fa99f,shopLight.fill);
    fill.position.set(5, 5, 6);
    root.add(fill);

    return root;
}

function buildArenaWorld(scene,world,arenaMap,playerSpawn,hostileSpawn) {
    const solids = [];
    const width = world.maxX - world.minX;
    const depth = world.maxZ - world.minZ;
    // Terrain is purely visual. Keep one flat, identical collision slab and
    // the existing obstacle definitions; the yard texture never changes cover.
    const groundSide=mat(C.concreteDark,1,0);
    const groundTop=new THREE.MeshStandardMaterial({
        map:arenaMap.id==='backlot-dustbowl'?backlotGroundTexture():venueFloorTexture(arenaMap),
        roughness:.99,metalness:0});
    const floor = box(width + 3, 0.35, depth + 3,
        [groundSide,groundSide,groundTop,groundSide,groundSide,groundSide]);
    floor.position.set((world.minX + world.maxX) / 2, -0.18, (world.minZ + world.maxZ) / 2);
    floor.userData.arenaObstacleId = 'floor';
    scene.add(floor);
    solids.push(floor);
    const gridSize = Math.max(width, depth);
    const grid = new THREE.GridHelper(gridSize, Math.max(16, Math.round(gridSize / 2)), 0x4d4a3e, 0x34342f);
    grid.position.y = 0.01;
    grid.name = 'development-only-arena-grid';
    grid.visible = false;
    scene.add(grid);

    // Backlot is a physically separate open-air venue, not a different skin
    // on the industrial warehouse renderer. Keep every certified gameplay AABB
    // as its exact raycast solid and replace only the surrounding presentation.
    if(arenaMap.id==='backlot-dustbowl'){
        buildBacklotDerbyWorld(scene,world,solids);
        return solids;
    }

    const wallMat = mat(arenaMap.theme==='mill'?0x57594d:arenaMap.theme==='concrete'?0x68706a:C.concrete,.98,.02);
    const wallThickness = 0.6;
    const wallHeight = 8;
    const wallOffset = 1.0;
    const centerX = (world.minX + world.maxX) / 2;
    const centerZ = (world.minZ + world.maxZ) / 2;
    const north = box(width + 2, wallHeight, wallThickness, wallMat);
    north.position.set(centerX, wallHeight / 2, world.minZ - wallOffset);
    north.userData.arenaObstacleId = 'wall-north';
    scene.add(north);
    solids.push(north);
    const south = box(width + 2, wallHeight, wallThickness, wallMat);
    south.position.set(centerX, wallHeight / 2, world.maxZ + wallOffset);
    south.userData.arenaObstacleId = 'wall-south';
    scene.add(south);
    solids.push(south);
    const west = box(wallThickness, wallHeight, depth + 2, wallMat);
    west.position.set(world.minX - wallOffset, wallHeight / 2, centerZ);
    west.userData.arenaObstacleId = 'wall-west';
    scene.add(west);
    solids.push(west);
    const east = box(wallThickness, wallHeight, depth + 2, wallMat);
    east.position.set(world.maxX + wallOffset, wallHeight / 2, centerZ);
    east.userData.arenaObstacleId = 'wall-east';
    scene.add(east);
    solids.push(east);

    const stripeMat = mat(C.yellow, 0.9, 0.08);
    for (const z of [playerSpawn.z + 2.6, hostileSpawn.z - 2.6]) {
        for (let x = world.minX + 4; x <= world.maxX - 4; x += 8) {
            const stripe = box(3.5, 0.03, 0.22, stripeMat);
            stripe.position.set(x, 0.03, z);
            scene.add(stripe);
        }
    }

    const obstacleMaterial = obstacle => {
        if(arenaMap.theme==='concrete')return obstacle.kind==='pillar'
            ?mat(0x41514c,.74,.45):obstacle.kind==='building'
            ?mat(0x707873,.92,.07):mat(0x626b62,.94,.05);
        if(arenaMap.theme==='mill')return obstacle.kind==='pillar'
            ?mat(0x46534b,.78,.37):obstacle.kind==='building'
            ?mat(0x82785f,.88,.09):obstacle.kind==='container'
            ?mat(0x6c704f,.86,.20):mat(0x56564a,.93,.08);
        if (obstacle.kind === 'pillar') return mat(C.metal, .70, .65);
        if (obstacle.kind === 'container') return mat(obstacle.id.endsWith('east') ? C.teal : C.rust, .82, .20);
        if (obstacle.kind === 'building') return mat(0x565750, .96, .05);
        return mat(C.concreteDark, .98, .02);
    };
    for (const obstacle of world.obstacles) {
        const w = obstacle.maxX - obstacle.minX;
        const d = obstacle.maxZ - obstacle.minZ;
        const h = Number.isFinite(obstacle.height) ? obstacle.height : 1.1;
        const object = box(w, h, d, obstacleMaterial(obstacle));
        object.position.set((obstacle.minX + obstacle.maxX) / 2, h / 2, (obstacle.minZ + obstacle.maxZ) / 2);
        object.userData.arenaObstacleId = obstacle.id;
        scene.add(object);
        solids.push(object);
        if (obstacle.kind === 'barrier' || obstacle.kind === 'barrier-low' || obstacle.kind === 'building') {
            const cap = box(w * .88, .08, d * 1.02, stripeMat);
            cap.position.set(object.position.x, h + .04, object.position.z);
            cap.userData.arenaObstacleId = obstacle.id;
            scene.add(cap);
            solids.push(cap);
        }
        if (obstacle.kind === 'container') {
            for (const side of [-1, 1]) {
                const rib = box(.08, h * .86, d * .92, mat(0x303734, .84, .32));
                rib.position.set(object.position.x + side * (w / 2 - .10), h * .5, object.position.z);
                rib.userData.arenaObstacleId = obstacle.id;
                scene.add(rib);
                solids.push(rib);
            }
        }
    }

    const arenaLight=lightingProfile('arena');
    const lightMaterial = new THREE.MeshStandardMaterial({ color: 0xffd39a, emissive: 0xffa43a, emissiveIntensity:arenaLight.fixtureEmission,roughness:.54 });
    for (const z of [-14, 14]) {
        for (const x of [-22, 0, 22]) {
            const fixture = box(3.6, 0.12, 0.28, lightMaterial);
            fixture.position.set(x, 7.2, z);
            scene.add(fixture);
            const light = new THREE.PointLight(0xffb565,arenaLight.fixtureIntensity,14,2.15);
            light.position.set(x, 6.65, z);
            scene.add(light);
        }
    }

    scene.add(buildVenueDressing(arenaMap));
    return solids;
}
/** One physical cockpit constructor for gameplay and the browser's iPhone-sized
 * reload framing audit. Import this base renderer via ?source=k5r6b to bypass
 * the index import-map alias that points './scene.js' to sceneAssembly.js.
 */
export function buildCockpit(scene) {
    const cockpit = new THREE.Group();
    scene.add(cockpit);
    const metal = mat(C.metal, 0.62, 0.72);
    const yellow = mat(C.yellow, 0.85, 0.18);
    const teal = mat(C.teal, 0.82, 0.22);
    const dark = mat(C.dark, 0.9, 0.15);
    const dash = box(1.7, 0.36, 0.62, dark);
    dash.position.set(0, 1.72, -0.88);
    dash.rotation.x = -0.14;
    cockpit.add(dash);
    const hood = box(1.18, 0.24, 1.15, yellow);
    hood.position.set(0, 1.42, -1.42);
    hood.rotation.x = -0.08;
    cockpit.add(hood);
    const leftShoulder = box(0.48, 0.44, 1.05, teal);
    leftShoulder.position.set(-0.94, 1.56, -1.25);
    leftShoulder.rotation.z = 0.08;
    cockpit.add(leftShoulder);
    const rightShoulder = box(0.48, 0.44, 1.05, yellow);
    rightShoulder.position.set(0.94, 1.56, -1.25);
    rightShoulder.rotation.z = -0.08;
    cockpit.add(rightShoulder);
    const strutGeo = new THREE.CylinderGeometry(0.075, 0.09, 1.7, 8);
    for (const side of [-1, 1]) {
        const strut = new THREE.Mesh(strutGeo, metal);
        strut.position.set(side * 0.78, 2.35, -0.62);
        strut.rotation.z = side * 0.18;
        strut.rotation.x = 0.12;
        cockpit.add(strut);
    }
    const roof = box(1.55, 0.12, 0.55, metal);
    roof.position.set(0, 3.06, -0.5);
    cockpit.add(roof);
    const gaugeMat = new THREE.MeshStandardMaterial({ color: C.green, emissive: C.green, emissiveIntensity: 1.8, roughness: 0.8 });
    for (const x of [-0.44, -0.16, 0.16, 0.44]) {
        const gauge = box(0.18, 0.08, 0.025, gaugeMat);
        gauge.position.set(x, 1.93, -1.17);
        cockpit.add(gauge);
    }
    const armoredCab = box(1.23, .20, .23, teal);
    armoredCab.position.set(0, 2.94, -.71);
    armoredCab.visible = false;
    cockpit.add(armoredCab);
    cockpit.userData.armoredCab = armoredCab;
    // Utility cab has an asymmetric high windshield; this is a visual differentiation only.
    const utilityCab = plate(0.60, .20, .08, teal);
    utilityCab.position.set(.34, 2.98, -.68);
    utilityCab.rotation.z = -.10;
    utilityCab.visible = false;
    cockpit.add(utilityCab);
    cockpit.userData.utilityCab = utilityCab;
    // Pilot-view weapon is a moving physical silhouette, not a HUD sprite.
    const gunPivot = new THREE.Group();
    gunPivot.name='cockpit-weapon-pivot';
    gunPivot.position.set(1.16, 2.04, -.62);
    const breech = box(.43, .34, .65, metal);
    breech.position.set(0, 0, -.19);
    gunPivot.add(breech);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(.105, .13, 1.13, 8), metal);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, -.04, -.79);
    gunPivot.add(barrel);
    const muzzleFlashMat = new THREE.MeshBasicMaterial({ color: 0xffce7e, transparent: true, opacity: .9 });
    const flashMesh = new THREE.Mesh(new THREE.IcosahedronGeometry(.18, 0), muzzleFlashMat);
    flashMesh.position.set(0, -.04, -1.27);
    flashMesh.visible = false;
    gunPivot.add(flashMesh);
    cockpit.add(gunPivot);
    cockpit.userData.gunPivot = gunPivot;
    // Reusable (never per-shot) physical scattergun ironwork in pilot view.
    // Dedicated weapon actions: 4–6 chunky primitives each, constructed ONCE.
    // Each is a reusable part of the gun, not a floating decorative HUD graphic.
    const weaponKits={};
    const kit=(id,fixed,moving)=>{
        const group=new THREE.Group(),carriage=new THREE.Group();
        group.name='cockpit-reload-'+id;
        for(const [x,y,z,w,h,d,finish] of fixed){
            const piece=box(w,h,d,finish==='teal'?teal:finish==='dark'?dark:metal);
            piece.position.set(x,y,z);group.add(piece);
        }
        for(const [x,y,z,w,h,d] of moving){
            const piece=box(w,h,d,metal);piece.position.set(x,y,z);carriage.add(piece);
        }
        group.add(carriage);group.userData.carriage=carriage;
        const loader=attachReloadHardware(group,id);
        group.userData.reloadMechanism={loader,weaponId:id,
            feedAxis:reloadMechanism(id).feedAxis};
        group.visible=false;gunPivot.add(group);weaponKits[id]=group;
    };
    kit('gun-cannon',[[-.20,-.15,-.31,.12,.15,.82,'metal'],[.20,-.15,-.31,.12,.15,.82,'metal']],
        [[0,.20,.00,.34,.17,.28]]);
    kit('gun-short',[[-.29,-.12,-.48,.16,.20,.98,'dark'],[.29,-.12,-.48,.16,.20,.98,'dark'],
        [0,.22,-.52,.56,.12,.21,'teal']],[[0,.06,.19,.49,.40,.39]]);
    kit('gun-light',[[-.13,-.10,-.72,.07,.09,1.28,'metal'],
        [.13,-.10,-.72,.07,.09,1.28,'metal']],[[0,.13,.12,.19,.11,.34]]);
    kit('gun-scatter',[[-.31,-.17,-.48,.12,.14,.68,'dark'],
        [.31,-.17,-.48,.12,.14,.68,'dark']],[[0,-.29,.08,.48,.25,.43]]);
    kit('gun-rivet',[[-.22,.10,-.63,.12,.13,1.08,'teal'],
        [.22,.10,-.63,.12,.13,1.08,'teal'],
        [-.24,-.32,-.20,.30,.18,.66,'dark']],[[0,.20,.10,.31,.18,.28]]);
    kit('gun-breaker',[[-.35,-.06,-.69,.21,.27,.89,'dark'],
        [.35,-.06,-.69,.21,.27,.89,'dark'],
        [0,.25,-.92,.58,.17,.20,'teal']],[[0,.08,.26,.62,.41,.38]]);
    kit('gun-rocket',[[-.28,-.09,-.67,.22,.23,1.02,'teal'],
        [.28,-.09,-.67,.22,.23,1.02,'teal'],
        [0,.15,-.78,.22,.23,1.01,'dark']],[[0,.09,.14,.47,.17,.37]]);
    kit('gun-arc',[[-.24,-.09,-.83,.14,.14,.95,'teal'],
        [.24,-.09,-.83,.14,.14,.95,'teal']],[[0,.06,-.29,.30,.29,.28]]);
    cockpit.userData.weaponKits=weaponKits;
    const scatterGreebles=new THREE.Group();
    const chokeRing=new THREE.Mesh(new THREE.CylinderGeometry(.31,.31,.14,8),
        new THREE.MeshStandardMaterial({color:0x8f713e,roughness:.81,metalness:.24}));
    chokeRing.rotation.x=Math.PI/2;
    chokeRing.position.set(0,-.04,-1.15);
    scatterGreebles.add(chokeRing);
    // No extra floating cockpit cassette or decorative cover: the single
    // real loading cassette now lives in this gun's weaponVisualKit receiver.
    // Retain only its chunky muzzle choke as part of the fixed silhouette.
    scatterGreebles.visible=false;
    gunPivot.add(scatterGreebles);
    cockpit.userData.gunBarrel = barrel;
    cockpit.userData.gunBreech = breech;
    cockpit.userData.scatterGreebles = scatterGreebles; // pilot weapon switch owns this assembled kit
    cockpit.userData.flashMesh = flashMesh;

    const makeScreen = (name, width, height, x, y, z, rotationX = -.18) => {
        const canvas = document.createElement('canvas');
        canvas.width = width; canvas.height = height;
        const texture = new THREE.CanvasTexture(canvas);
        texture.magFilter = THREE.NearestFilter; texture.minFilter = THREE.NearestFilter;
        const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, opacity: .94, toneMapped: false });
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width / 250, height / 250), material);
        mesh.name = `cockpit-screen:${name}`;
        mesh.position.set(x, y, z); mesh.rotation.x = rotationX;
        cockpit.add(mesh);
        return { canvas, texture, mesh, ctx: canvas.getContext('2d') };
    };
    const screens = {
        systems: makeScreen('systems', 88, 220, -.43, 1.94, -1.195),
        weapon: makeScreen('weapon', 180, 78, .43, 1.94, -1.195),
        team: makeScreen('team', 200, 44, 0, 2.20, -1.02, -.10),
        motion: makeScreen('motion', 220, 56, -.28, 1.80, -1.19),
        drive: makeScreen('drive', 180, 40, .25, 1.80, -1.19),
    };
    const amberLampMat = new THREE.MeshStandardMaterial({ color: 0x6b572a, emissive: 0xe0a44c, emissiveIntensity: .08, roughness: .65 });
    const redLampMat = new THREE.MeshStandardMaterial({ color: 0x5b281f, emissive: 0xff4938, emissiveIntensity: .03, roughness: .65 });
    const amberLamp = box(.12, .08, .04, amberLampMat); amberLamp.position.set(-.69, 2.14, -1.03); cockpit.add(amberLamp);
    const redLamp = box(.12, .08, .04, redLampMat); redLamp.position.set(.69, 2.14, -1.03); cockpit.add(redLamp);
    const amberWash = new THREE.PointLight(0xe0a44c, 0, 2.8, 2); amberWash.position.set(-.62, 2.22, -.86); cockpit.add(amberWash);
    const redWash = new THREE.PointLight(0xff4938, 0, 3.0, 2); redWash.position.set(.62, 2.22, -.86); cockpit.add(redWash);
    cockpit.userData.instrumentScreens = screens;
    cockpit.userData.warningLamps = { amberLampMat, redLampMat, amberWash, redWash };
    return cockpit;
}
function buildDebugColliders(scene,world) {
    const group = new THREE.Group();
    const material = new THREE.MeshBasicMaterial({ color: 0x65ff91, wireframe: true, transparent: true, opacity: 0.7, depthTest: false });
    for (const obstacle of world.obstacles) {
        const w = obstacle.maxX - obstacle.minX;
        const d = obstacle.maxZ - obstacle.minZ;
        const mesh = box(w + 1.9, 0.4, d + 1.9, material);
        mesh.position.set((obstacle.minX + obstacle.maxX) / 2, 0.25, (obstacle.minZ + obstacle.maxZ) / 2);
        group.add(mesh);
    }
    scene.add(group);
    return group;
}
/** The exterior is rebuilt entirely from the five fitted assembly definitions.
 * Each model is intentionally an uncomplicated, complete serviceable assembly.
 * Nested meshes have ownership tags for inspection; there are no arbitrary visual limbs. */
export function buildExteriorRig(assembly) {
    const root = new THREE.Group();
    const partGroups = new Map();
    const partMeshes = new Map();
    const pickMeshes = [];
    const yellow = 0xb28a39;
    const teal = 0x417f81;
    const steel = 0x363f41;
    const brightSteel = 0x7b827b;
    const m = (color) => mat(color, .82, .31);
    // Legacy generator geometry keeps fresh per-rig materials for damage isolation.
    const pm = key => partMaterial(key).clone();
    for (const slot of SLOTS) {
        const fitted = installedPart(assembly, slot);
        if (!fitted)
            continue;
        const def = fitted.definition;
        const group = new THREE.Group();
        group.name = `${slot}: ${def.name} (${fitted.instance.serial})`;
        group.position.set(...def.center);
        root.add(group);
        partGroups.set(slot, group);
        const meshes = [];
        partMeshes.set(slot, meshes);
        const add = (mesh, x = 0, y = 0, z = 0) => {
            mesh.position.set(x, y, z);
            mesh.userData.slot = slot;
            if (materialRoleOf(mesh.material)) mesh.userData.materialRole = materialRoleOf(mesh.material);
            mesh.castShadow = true; mesh.receiveShadow = true;
            group.add(mesh);
            meshes.push(mesh);
            pickMeshes.push(mesh);
            return mesh;
        };
        const cyl = (radiusTop, radiusBottom, height, material, sides = 10) => new THREE.Mesh(new THREE.CylinderGeometry(radiusTop, radiusBottom, height, sides), (material?.isMaterial ? material : m(material)));
        const sharedVisual = buildPartVisual(def.id, { mode: 'gameplay' });
        if (sharedVisual) {
            group.add(sharedVisual);
            // Mechanism handles belong to the authored weapon geometry, never
            // a second universal bolt attached behind this early continue.
            if (slot === 'combat' && sharedVisual.userData.weaponMechanism)
                group.userData.weaponMechanism = sharedVisual.userData.weaponMechanism;
            sharedVisual.traverse(node => {
                if (!node.isMesh||node.userData.visualOnly) return;
                node.userData.slot = slot;
                node.castShadow = true; node.receiveShadow = true;
                meshes.push(node);
                pickMeshes.push(node);
            });
            continue;
        }
        switch (def.id) {
            case 'power-dynamo': {
                // Rear-mounted generator/cooling pack: fans and exposed teal radiator fins.
                add(plate(1.06, .85, .76, pm('structure')), 0, 0, 0);
                add(plate(1.24, .85, .18, pm('teal')), 0, -.03, .38);
                for (let i = -4; i <= 4; i++)
                    add(box(.064, .63, .085, pm('darkMechanism')), i * .12, -.03, .50);
                const fan = add(cyl(.28, .28, .10, pm('machined'), 12), 0, .12, .56);
                fan.rotation.x = Math.PI / 2;
                add(box(.43, .08, .08, pm('heatSteel')), 0, .12, .65);
                add(box(.08, .43, .08, pm('heatSteel')), 0, .12, .65);
                break;
            }
            case 'power-air': {
                // Compact power core + tall open radiator stack; geometry explains the exposed tradeoff.
                add(plate(.93, .60, .74, pm('structure')), 0, -.20, -.02);
                add(plate(1.04, .21, .71, pm('mustard')), 0, .10, .00);
                for (const side of [-1, 1]) {
                    add(plate(.10, .75, .66, pm('teal')), side * .43, .27, .04);
                    for (let fin = -2; fin <= 2; fin++) {
                        add(plate(.28, .58, .065, pm('rawSteel')), side * .39, .31, fin * .13);
                    }
                }
                const pipe = add(cyl(.09, .09, .55, pm('machined'), 8), -.14, .44, -.17);
                pipe.rotation.z = .17;
                const fan = add(cyl(.24, .24, .10, pm('machined'), 10), 0, .35, .38);
                fan.rotation.x = Math.PI / 2;
                add(plate(.45, .09, .08, pm('heatSteel')), 0, .35, .47);
                add(plate(.09, .45, .08, pm('heatSteel')), 0, .35, .47);
                break;
            }
        }
    }
    // Factory finish is definition-specific; owner paint is serial-specific.
    // All original geometry, physical material roles and mechanism tags remain.
    for (const [slot, group] of partGroups) {
        const fitted=installedPart(assembly,slot);
        if (fitted) {
            applyPartFinish(group,fitted.definition.id,fitted.instance.paint);
            // Appearance is a property of this serialized physical object, not
            // the rig or station. Paint remains authoritative before finishing.
            applyIndustrialFinish(group,{...fitted.instance,slot},
                assembly.partHistory?.[fitted.instance.serial]||null);
            // Honest stamped service tally. Precise welded patches come later
            // from recorded repair events, never from fabricated impact points.
            addPhysicalServiceStamp(group,fitted.instance);
            // One understated factory maker/model stamp per physical module.
            // This follows the same moving surface without becoming a hitbox.
            addFactoryIdentityPlate(group,fitted.definition.id);
        }
    }
    // Crew/unit graphics follow this real serialized rig, not a guessed
    // faction or an arbitrary preview camera billboard.
    addRigCrewPlate(partGroups.get('structure'),assembly);
    // Mount subassemblies to the real hull group. Shared mobility visuals carry
    // their authored interface hardware; mass and compatibility remain graph data.
    const hull = partGroups.get('structure');
    if (hull) {
        for (const [slot, group] of partGroups) {
            if (slot === 'structure')
                continue;
            // The leg carriage is carried by the same physical body but is
            // a sibling of the visual waist. Upper hull can twist without
            // yawing every planted foot. Rest coordinates remain IDENTICAL.
            const isLegs=slot==='mobility';
            (isLegs?root:hull).add(group);
            const c=SLOT_CENTERS[slot];
            const parent=isLegs?[0,0,0]:SLOT_CENTERS.structure;
            group.position.set(c[0]-parent[0],c[1]-parent[1],c[2]-parent[2]);
        }
    }
    return { root, partGroups, partMeshes, pickMeshes };
}
/** Chamfered polygon, deliberately low-poly; avoid the cuboid-only silhouette. */
function plate(width, height, depth, material) {
    const cut = Math.min(.13, width * .15, height * .17);
    const shape = new THREE.Shape();
    shape.moveTo(-width / 2 + cut, -height / 2);
    shape.lineTo(width / 2 - cut, -height / 2);
    shape.lineTo(width / 2, -height / 2 + cut);
    shape.lineTo(width / 2, height / 2 - cut);
    shape.lineTo(width / 2 - cut, height / 2);
    shape.lineTo(-width / 2 + cut, height / 2);
    shape.lineTo(-width / 2, height / 2 - cut);
    shape.closePath();
    const bevel = Math.min(.024, depth / 4);
    const geometry = new THREE.ExtrudeGeometry(shape, {
        depth: depth - bevel * 2, bevelEnabled: true, bevelThickness: bevel,
        bevelSize: bevel, bevelSegments: 1, curveSegments: 1,
    });
    geometry.translate(0, 0, -depth / 2 + bevel);
    // Do not permit raw hex color numbers as Three.js mesh materials.
    // Coerce them to real materials and fail early for unsupported inputs.
    const surface=typeof material==='number'?mat(material,.82,.31):material;
    if(!surface?.isMaterial)throw new TypeError('Plate requires a Three.js material');
    const mesh = new THREE.Mesh(geometry, surface);
    mesh.castShadow = true; mesh.receiveShadow = true;
    return mesh;
}
