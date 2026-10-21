import * as THREE from 'three';
import {partMaterial,materialRoleOf} from './partMaterialPalette.js';
import { applyPartFinish } from './partFinish.js';
import { normalizePaint } from './factoryPaint.js';
import { buildPartVisual } from './partVisuals.js?v=k3z';
import {footTrajectory,legPose,familyAnimation,aimArticulation,reloadArticulation} from './articulationMotion.js';
import { framingOffsetWorld, orbitAzimuthAfterDrag, panInRigSpace } from './inspectionCamera.js';
import { DEFAULT_WORLD, HOSTILE_SPAWN, PLAYER_SPAWN, physicsYawToViewYaw } from './locomotion.js';
import { BY_ID, installedPart, SLOT_CENTERS, SLOTS } from './components.js';
import { impactProfile, integrityRatio, persistentFailureProfile } from './damageVisuals.js';
import { combinerTetherFromLook } from './cockpitView.js';
import { firstCoverHit } from './coverTruth.js';
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
    const key = `k4a:${definitionId}:${destroyed ? 'x' : Math.round(condition * 10)}:${JSON.stringify(normalizePaint(state.paint))}`;
    if (partThumbnailCache.has(key)) return partThumbnailCache.get(key);
    if (!partThumbnailRenderer) {
        partThumbnailRenderer = new THREE.WebGLRenderer({ antialias: false, alpha: true, preserveDrawingBuffer: true, powerPreference: 'low-power' });
        partThumbnailRenderer.outputColorSpace = THREE.SRGBColorSpace;
        partThumbnailRenderer.toneMapping = THREE.ACESFilmicToneMapping;
        partThumbnailRenderer.toneMappingExposure = 1.18;
        partThumbnailRenderer.setSize(96, 72, false);
        partThumbnailRenderer.setPixelRatio(1);
    }
    const serial = 'PREVIEW-001';
    const assembly = { serial: 'PREVIEW', name: 'PREVIEW', owned: [{ serial, definitionId, condition: 1, wear: 0, repairs: 0, paint:normalizePaint(state.paint) }], installed: { [definition.slot]: serial } };
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
    camera.position.set(radius * 1.65, radius * .92, radius * 2.25);
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
            .map(p=>[p.serial,p.definitionId,normalizePaint(p.paint)]),
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
export function createArenaScene(initial, targetAssembly) {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x171915);
    scene.fog = new THREE.FogExp2(0x171915, 0.0125);
    const camera = new THREE.PerspectiveCamera(68, 1, 0.06, 125);
    camera.rotation.order = 'YXZ';
    scene.add(camera);
    // Lower broad ambient wash and let shaped warm/cool sources describe the forms.
    const arenaHemisphere = new THREE.HemisphereLight(0x9dafaa, 0x171511, .56);
    scene.add(arenaHemisphere);
    const sun = new THREE.DirectionalLight(0xffd29a, 3.15);
    sun.position.set(-10, 17, 11);
    sun.castShadow = true;
    // Keep the shadow silhouette coherent at source; the deliberately low-res world
    // framebuffer does the final pixelation instead of destroying the shadow shape first.
    sun.shadow.mapSize.set(512, 512);
    sun.shadow.camera.left = -38; sun.shadow.camera.right = 38;
    sun.shadow.camera.top = 34; sun.shadow.camera.bottom = -34;
    sun.shadow.camera.near = 2; sun.shadow.camera.far = 65;
    sun.shadow.bias = -.0007; sun.shadow.normalBias = .035;
    scene.add(sun);
    const coolRim = new THREE.DirectionalLight(0x79a9a8, .90);
    coolRim.position.set(12, 6, -16);
    scene.add(coolRim);
    const arenaRoot = new THREE.Group();
    arenaRoot.name = 'arena-environment';
    scene.add(arenaRoot);
    const arenaPresentationRoot = new THREE.Group();
    arenaPresentationRoot.name = 'arena-presentation';
    scene.add(arenaPresentationRoot);
    const worldSolids = buildWarehouse(arenaRoot);
    const garageRoot = buildGarageBay();
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
    // Four real components on one battered dealer's table. The counter is a
    // mutually exclusive garage viewing mode: no combat meshes or extra loadout
    // geometry are created. Cards and these physical objects share lot serials.
    const vendorRoot = new THREE.Group();
    vendorRoot.name='used-parts-counter-table';
    vendorRoot.visible=false;
    scene.add(vendorRoot);
    const vendorPicks=[],vendorPads=new Map();
    let vendorEnabled=false;
    function clearVendorTable() {
        vendorRoot.traverse(object=>{
            if(!object.isMesh)return;
            object.geometry?.dispose?.();
            const mats=Array.isArray(object.material)?object.material:[object.material];
            mats.forEach(mat=>mat?.dispose?.());
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
        vendorBox(10.0,.18,2.65,0x654632,0,.75,0);
        vendorBox(9.9,.065,2.6,0x967647,0,.865,0);
        for(const x of [-4.3,4.3])for(const z of [-.98,.98])
            vendorBox(.23,.72,.23,0x343d38,x,.34,z);
        vendorBox(10.1,.12,.19,0xb38742,0,.95,-1.27);
        (offers||[]).slice(0,4).forEach((offer,i)=>{
            const x=(i-1.5)*2.40;
            const tray=vendorBox(2.14,.06,2.17,offer.sold?0x333732:0x3e4a42,x,.97,0);
            tray.userData.vendorSerial=offer.serial;vendorPicks.push(tray);
            const light=vendorBox(2.09,.04,.12,offer.sold?0x5b4138:0xb99151,x,1.018,-1.02);
            vendorPads.set(offer.serial,{light,sold:offer.sold});
            if(offer.sold)return;
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
            const scale=Math.min(1,1.86/Math.max(.1,size.x),
                1.86/Math.max(.1,size.z),1.95/Math.max(.1,size.y));
            visual.root.scale.setScalar(scale);
            visual.root.position.set(x-(bounds.min.x+bounds.max.x)*.5*scale,
                1.04-bounds.min.y*scale,-(bounds.min.z+bounds.max.z)*.5*scale);
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
        vendorEnabled=!!enabled;
        vendorRoot.visible=inspecting&&vendorEnabled;
        exterior.root.visible=inspecting&&!vendorEnabled;
        stagingFixtures.visible=inspecting&&!vendorEnabled;
        if(vendorEnabled) {
            desiredTarget.set(0,1.30,0);
            radius=Math.max(radius,9.6);
        } else focusPart(null);
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
    const debugColliders = buildDebugColliders(scene);
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
    targetExterior.root.position.set(HOSTILE_SPAWN.x, targetExterior.groundOffset, HOSTILE_SPAWN.z);
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
    const makeEmitterBudget = () => new Map(SLOTS.map(slot => [slot, { spark: 0, smoke: 0, arc: 0 }]));
    const squadCombatants = new Map();
    function makeSquadMarker(team) {
        const geometry = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(-.72, -.72, 0), new THREE.Vector3(.72, -.72, 0),
            new THREE.Vector3(.72, .72, 0), new THREE.Vector3(-.72, .72, 0),
        ]);
        const material = new THREE.LineBasicMaterial({
            color: team === 'friendly' ? 0x73e29a : 0xf0a05d,
            transparent: true, opacity: .92, depthTest: true, depthWrite: false,
        });
        const marker = new THREE.LineLoop(geometry, material);
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
        weaponFault: false, weaponServicing: false, serviceSparkBudget: 0, weaponRecoveryKick: 0, recoveryBurstPending: false,
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
        weaponFault: false, weaponServicing: false, serviceSparkBudget: 0, weaponRecoveryKick: 0, recoveryBurstPending: false,
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
    function updateSquadMarkers() {
        for (const record of squadCombatants.values()) {
            record.marker.visible = !inspecting && !record.cleared;
            if (inspecting || record.cleared) continue;
            const point = new THREE.Vector3();
            record.exterior.root.getWorldPosition(point);
            point.y += 3.55;
            record.marker.position.copy(point);
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
    let sparkCursor = 0, chipCursor = 0, smokeCursor = 0;
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
            ctx.font = 'bold 25px monospace'; ctx.textBaseline = 'middle';
            ctx.fillText(systemGlyphs[slot], 10, y + row * .48);
            ctx.font = 'bold 16px monospace';
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
        ctx.font = 'bold 14px monospace'; ctx.textBaseline = 'middle'; ctx.fillText(weaponAbbrev(data.weapon), 9, 16);
        ctx.font = 'bold 29px monospace'; ctx.fillText(String(data.ammo ?? '—'), 9, 43);
        ctx.font = 'bold 10px monospace'; ctx.fillStyle = tone === 'green' ? '#789c80' : ctx.fillStyle; ctx.fillText(state, 10, 66);
        screen.texture.needsUpdate = true;
    }
    function drawMotionScreen(screen, data) {
        const ctx = panelBase(screen, 'green', .54); if (!ctx) return;
        ctx.fillStyle = '#a8d5ad'; ctx.textBaseline = 'middle';
        ctx.font = 'bold 18px monospace'; ctx.fillText(`${data.speed ?? '0.0'} m/s`, 9, 18);
        ctx.font = 'bold 12px monospace'; ctx.fillStyle = '#d5b66d'; ctx.fillText(data.brace >= 1 ? 'BRACED' : data.brace > 0 ? 'PLANT' : String(data.direction ?? 'IDLE'), 132, 18);
        ctx.fillStyle = '#83a68a'; ctx.fillText(`TURN ${data.turnRate ?? 0}°/s`, 9, 43);
        ctx.font = 'bold 11px monospace';
        ctx.fillStyle = data.slip > .35 ? '#efb06f' : data.recoil > .2 ? '#e5be77' : '#8ca994';
        ctx.fillText(data.slip > .35 ? 'FOOT SCRAPE' : data.recoil > .2 ? 'RECOIL LOAD' : data.footing > .8 ? 'FEET LOADED' : 'GRIP NOMINAL', 9, 65);
        screen.texture.needsUpdate = true;
    }
    function drawDriveScreen(screen, load = 0, power = null) {
        const value = Math.max(0, Math.min(1, Number(load) || 0));
        const ctx = panelBase(screen, power?.busRatio < .95 || value > .9 ? 'amber' : 'green', .48); if (!ctx) return;
        const w = screen.canvas.width;
        ctx.fillStyle = '#789a7e'; ctx.font = 'bold 10px monospace'; ctx.textBaseline = 'middle'; ctx.fillText('DRIVE', 9, 12);
        ctx.fillStyle = 'rgba(132,163,136,.18)'; ctx.fillRect(9, 23, w - 18, 10);
        ctx.fillStyle = value > .9 ? '#e2ae59' : '#89c492'; ctx.fillRect(9, 23, (w - 18) * value, 10);
        ctx.fillStyle = '#a9c7ac'; ctx.textAlign = 'right'; ctx.fillText(`${Math.round(value * 100)}%`, w - 9, 12); ctx.textAlign = 'left';
        if (power) {
            const warn = power.busRatio < .95;
            ctx.font = 'bold 12px monospace';
            ctx.fillStyle = warn ? '#f4ad68' : '#a9c7ac';
            ctx.fillText(warn ? 'BUS SAG' : 'POWER BUS', 9, 49);
            ctx.textAlign = 'right';
            ctx.fillText(`${Math.round(power.busRatio * 100)}%`, w - 9, 49);
            ctx.textAlign = 'left';
            ctx.fillStyle = '#87a997';
            ctx.font = 'bold 10px monospace';
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
        if (outcome?.internalDamage > 0)
            flashDamageLight(position, outcome.slot === 'power' ? 0xc8fff2 : 0xffb56b, outcome.slot === 'power' ? 10 : 5.5, .075, 4.6);
        activateParticle(sparkPool, 'spark', position, normal.clone().multiplyScalar(.18), profile.flashScale * 1.25, .085, 0, 0, profile.kind === 'power-disable' ? 0xffe199 : 0xffcf70);
        for (let i = 0; i < profile.sparkCount; i++) {
            const direction = randomBurstDirection(normal, 1.15);
            const speed = 1.8 + Math.random() * 3.4;
            activateParticle(sparkPool, 'spark', position, direction.multiplyScalar(speed), .7 + Math.random() * .7, .18 + Math.random() * .22, -4.2, 0, Math.random() > .2 ? 0xffc35f : 0xfff0a2);
        }
        for (let i = 0; i < profile.chipCount; i++) {
            const direction = randomBurstDirection(normal, 1.35);
            const speed = .8 + Math.random() * 2.1;
            activateParticle(chipPool, 'chip', position, direction.multiplyScalar(speed), .7 + Math.random() * .8, .45 + Math.random() * .45, -7.2, 0, Math.random() > .35 ? 0x3c403b : 0x78684d);
        }
        for (let i = 0; i < profile.smokeCount; i++) {
            const drift = new THREE.Vector3((Math.random() - .5) * .25, .28 + Math.random() * .28, (Math.random() - .5) * .25);
            activateParticle(smokePool, 'smoke', position, drift, .72 + Math.random() * .5, .75 + Math.random() * .55, 0, .8, 0x242824, true);
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
        const mark = new THREE.Mesh(new THREE.IcosahedronGeometry(.065, 0), new THREE.MeshBasicMaterial({ color: 0x0d100e }));
        mark.position.copy(local); mark.scale.set(1.35, .32, 1.35); group.add(mark);
        record.woundMarks.push(mark);
        if (record.woundMarks.length > 10) {
            const oldest = record.woundMarks.shift(); oldest.parent?.remove(oldest); oldest.geometry.dispose(); oldest.material.dispose();
        }
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
            fallingParts.set(`${actorId}:${slot}`, {
                actorId, slot, record, group, settled: false,
                velocity: new THREE.Vector3(side * (.28 + Math.random() * .30), .35 + Math.random() * .48, (Math.random() - .5) * .65),
                spin: new THREE.Vector3((Math.random() - .5) * 1.4, (Math.random() - .5) * .65, side * (.8 + Math.random() * 1.1)),
            });
        } else if (slot === 'mobility') {
            group.rotation.z += side * .42; group.rotation.x += .19;
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
        record.exterior.root.rotation.z = side * .075;
        record.exterior.root.rotation.x = .025;
        record.exterior.root.position.y = -.06;
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
        for (const state of particleStates) {
            state.life = 0;
            state.mesh.visible = false;
        }
        for (const record of squadCombatants.values()) {
            for (const budget of record.emitterBudget.values()) {
                budget.spark = 0;
                budget.smoke = 0;
                budget.arc = 0;
            }
        }
    }
    // Ring, not another obstacle or an invisible hit volume.
    const ring = new THREE.Mesh(new THREE.RingGeometry(1.75, 1.84, 32), new THREE.MeshBasicMaterial({ color: 0xcf9750, side: THREE.DoubleSide, transparent: true, opacity: .52 }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(HOSTILE_SPAWN.x, .035, HOSTILE_SPAWN.z);
    arenaPresentationRoot.add(ring);
    const pilotRing = new THREE.Mesh(new THREE.RingGeometry(1.75, 1.84, 32), new THREE.MeshBasicMaterial({ color: C.green, side: THREE.DoubleSide, transparent: true, opacity: .26 }));
    pilotRing.rotation.x = -Math.PI / 2;
    pilotRing.position.set(PLAYER_SPAWN.x, .034, PLAYER_SPAWN.z);
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
        ctx.clearRect(0,0,128,128);
        ctx.fillStyle='#142019';ctx.fillRect(8,8,112,112);
        ctx.strokeStyle='#d6ae62';ctx.lineWidth=8;ctx.strokeRect(9,9,110,110);
        ctx.fillStyle='#f3d28b';ctx.font='bold 86px monospace';
        ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(id,64,70);
        const tex=new THREE.CanvasTexture(canvas);
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
    let muzzleKick = 0;
    let muzzleFlash = 0;
    let pilotWeaponPresentation = { visualRecoil: 1, visualRecovery: 3.6, muzzleFlashSeconds: .10 };
    let pilotWeaponFault = false, pilotWeaponServicing = false, pilotServiceSparkBudget = 0;
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
    // Empty ports are physical, touchable workshop fixtures, not combat hitboxes.
    // Markers only represent stations that can currently be approached on the rig.
    let emptyMountPicks = [];
    function rebuildEmptyMountPicks(assembly) {
        emptyMountPicks = [];
        if (!exterior.root) return;
        const anchors = new THREE.Group();
        anchors.name = 'garage-empty-mounts';
        for (const slot of SLOTS) {
            if (installedPart(assembly, slot)) continue;
            if (slot !== 'structure' && !installedPart(assembly, 'structure')) continue;
            const point = SLOT_CENTERS[slot];
            const bracket = new THREE.Group();
            bracket.position.set(point[0],point[1],point[2]);
            const metal = new THREE.MeshStandardMaterial({color:0x6d7467,roughness:.88,metalness:.28});
            const signal = new THREE.MeshStandardMaterial({color:0xdaa85b,emissive:0x644016,emissiveIntensity:.36,roughness:.74});
            const plate = new THREE.Mesh(new THREE.BoxGeometry(.38,.07,.28),metal);
            bracket.add(plate);
            const bar = new THREE.Mesh(new THREE.BoxGeometry(.22,.035,.07),signal);
            bar.position.y=.065;bracket.add(bar);
            const cross = new THREE.Mesh(new THREE.BoxGeometry(.07,.035,.22),signal.clone());
            cross.position.y=.067;bracket.add(cross);
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
        const cover = firstCoverHit(muzzle, bore, DEFAULT_WORLD.obstacles, maxDistance, .035);
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
    let radius = 7.20;
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
            mechanism.bolt.position.copy(mechanism.rest.bolt);
            if(mechanism.cassette && mechanism.rest.cassette)
                mechanism.cassette.position.copy(mechanism.rest.cassette);
        }
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
        const total=installedPart(a.assembly,'combat')?.definition.id==='gun-scatter'?3.15:2.5;
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
    function updateRigVisual(state, lookYaw, lookPitch, dt, serviceVisual = null) {
        const wasServicing = pilotWeaponServicing;
        pilotWeaponFault = !!serviceVisual?.weaponFault;
        pilotWeaponServicing = !!serviceVisual?.weaponServicing;
        if (wasServicing && !pilotWeaponServicing && !pilotWeaponFault) {
            pilotWeaponRecoveryKick = 1;
            pilotRecoveryBurstPending = true;
        }
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
            (state.lateralAcceleration ?? 0) * .004, -.055, .055);
        const footfall = Math.sin(performance.now() * 0.009 + state.forwardSpeed) * Math.min(Math.abs(state.forwardSpeed) / 7.4, 1) * 0.012;
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
        const sustainedDriveRoll = (driveRightHealth - driveLeftHealth) * .032 +
            Math.sin(nowMs * .017) * driveDamage * Math.min(Math.abs(state.forwardSpeed) / 2.2, 1) * .008;
        const mobilityStumble = Math.sin(nowMs * .026) * driveDamage * Math.min(Math.abs(state.forwardSpeed) / 2.8, 1) * .008;
        // The camera is the pilot's head; the combiner belongs to the mech. Inverse
        // free-look keeps the display on the windshield until chassis body-follow catches up.
        const tether = combinerTetherFromLook(lookYaw, lookPitch);
        combinerHud.rotation.set(
            tether.pitch + cockpitPitch * .65 - hitPitchKick * .35,
            tether.yaw - hitYawKick * .10,
            cockpitRoll * .75 - hitRollKick * .25 + sustainedDriveRoll * .28,
            'YXZ');
        const pilotServiceSag = pilotWeaponFault ? (pilotWeaponServicing ? .20 : .13) : 0;
        const pilotRecoveryLift = pilotWeaponRecoveryKick * .09;
        gunPivot.rotation.set(lookPitch * .85 + muzzleKick * .042 + pilotServiceSag - pilotRecoveryLift, lookYaw * .85, gunDamageKick * damageWave * .16, 'YXZ');
        gunPivot.position.x = 1.16 + gunDamageKick * damageWave * .045;
        gunPivot.position.z = -0.62 + muzzleKick * .19;
        // Actual reload timer drives the pilot-visible breech. A moving
        // mechanism is shown even though the audio recipe stays unchanged.
        const reload=reloadArticulation(serviceVisual?.reloadLeft??0,
            serviceVisual?.reloadSeconds??0,pilotWeaponPresentation.id);
        cockpit.userData.gunBreech.position.z=-.19+reload.slide;
        cockpit.userData.gunBreech.position.y=reload.bolt*.24;
        cockpit.userData.scatterGreebles.position.y=-reload.cassette;
        flashMesh.visible = muzzleFlash > 0;
        cockpit.position.set(visualX + impactJitter * .35, impactJitter * .18 + mobilityStumble, visualZ + impactJitter * .12);
        cockpit.rotation.set(cockpitPitch + hitPitchKick, renderYaw + hitYawKick, cockpitRoll + hitRollKick + sustainedDriveRoll, 'YXZ');
        exterior.root.position.set(visualX, 0, visualZ);
        exterior.root.rotation.y = renderYaw;
        if (inspecting) {
            // Garage inspection is a deliberately separate presentation state. The owned
            // rig always returns to the service pad instead of inheriting its last arena pose.
            exterior.root.position.set(0,(exterior.groundOffset??0)+GARAGE_PAD_TOP_Y,0);
            exterior.root.rotation.y = GARAGE_RIG_YAW;
            poseInspectionPreview(dt);
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
            const shift = framingOffsetWorld(panelRightPx,viewportWidth,viewportHeight,
                radius,camera.fov) * 1.06;
            camera.position.addScaledVector(screenRight,-shift);
            camera.lookAt(center.clone().addScaledVector(screenRight,-shift));
        }
        else if (spectatorRig) {
            const yaw = physicsYawToViewYaw(spectatorRig.yaw ?? 0);
            const angle=yaw+spectatorAzimuth;
            spectatorDesired.set(spectatorRig.x+Math.sin(angle)*spectatorRadius*Math.cos(spectatorElevation),
                1.65+spectatorRadius*Math.sin(spectatorElevation),
                spectatorRig.z+Math.cos(angle)*spectatorRadius*Math.cos(spectatorElevation));
            spectatorLook.set(spectatorRig.x, 1.65, spectatorRig.z);
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
            camera.position.set(visualX + impactJitter * .62, 2.42 + cockpitHeave - Math.abs(hitPitchKick) * .2 + impactJitter * .28, visualZ + impactJitter * .18);
            camera.rotation.set(lookPitch + cockpitPitch * 0.35 + hitPitchKick * 1.35, renderYaw + lookYaw + hitYawKick * 1.1, cockpitRoll * 0.25 + hitRollKick * 1.25 + sustainedDriveRoll * .72, 'YXZ');
        }
        updateSquadMarkers();
    }
    function poseCombatantExterior(record,state,visual=null){
        const root=record.exterior.root;
        root.position.set(state.x??0,(record.exterior.groundOffset??0)+
            (record.cleared?-.14:record.wrecked?-.06:0),state.z??0);
        root.rotation.y=physicsYawToViewYaw(state.yaw??0);
        if(record.active&&!record.wrecked&&!record.cleared){
            const dt=Math.max(0,Math.min(.10,visual?.dt??1/60));
            const wasServicing=record.weaponServicing;
            record.weaponFault=!!visual?.weaponFault;
            record.weaponServicing=!!visual?.weaponServicing;
            if(wasServicing&&!record.weaponServicing&&!record.weaponFault){
                record.weaponRecoveryKick=1;
                record.recoveryBurstPending=true;
            }
            record.weaponRecoveryKick=Math.max(0,(record.weaponRecoveryKick??0)-dt*2);
            const health=THREE.MathUtils.clamp(visual?.posture?.animationHealth??1,.08,1);
            const speed=Math.hypot(state.vx??0,state.vz??0);
            const motion=record.articulation;
            const mobilityId=installedPart(record.assembly,'mobility')?.definition.id??'legs-yard';
            const spec=familyAnimation(mobilityId);
            const visualGait=visual?.gait;
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
                const moving=(motion.weight??0);
                const backward=(state.forwardSpeed??0)<-.3;
                const strafe=(state.lateralSpeed??0)/2.4;
                const forward=(state.forwardSpeed??0)/3.2;
                const blocked=record.disabledSlots.has('mobility')||
                    record.destroyedSlots.has('mobility');
                for(const [side,leg] of motion.legs){
                    if(!leg.hip||!leg.knee||!leg.ankle||!leg.foot)continue;
                    const pose=legPose(leg.upper,leg.lower,{
                        phase:motion.phase,side,weight:moving,family:mobilityId,
                        backward,strafe,forward,brace:state.brace??0,health,disabled:blocked,
                        upperX:leg.upperX,lowerX:leg.lowerX,
                    });
                    leg.hip.rotation.x=pose.hip;
                    leg.hip.rotation.z=pose.hipRoll+(1-health)*side*.03;
                    leg.knee.rotation.x=pose.knee;
                    leg.knee.rotation.z=pose.kneeRoll;
                    leg.ankle.rotation.x=pose.ankle;
                    leg.ankle.rotation.z=pose.ankleRoll;
                    leg.foot.rotation.x=pose.foot;
                    leg.foot.rotation.z=pose.footRoll;
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
                // Structure is upper-waist visual; mobility is root sibling.
                frame.rotation.y=frameBase.rotation.y+aim.waist;
            }
            if(command&&commandBase&&!record.destroyedSlots.has('command')){
                const commandBroken=record.disabledSlots.has('command');
                command.rotation.y=commandBase.rotation.y+aim.gun*.18;
                command.rotation.x=commandBase.rotation.x+(commandBroken?.19:0);
                command.position.y=commandBase.position.y-(commandBroken?.09:0);
            }
            if(combat&&combatBase&&!record.destroyedSlots.has('combat')){
                const recovery=record.weaponRecoveryKick??0;
                const reload=reloadArticulation(visual?.reloadLeft??0,
                    visual?.reloadSeconds??0,
                    installedPart(record.assembly,'combat')?.definition.id);
                combat.rotation.y=combatBase.rotation.y+aim.gun;
                combat.rotation.x=combatBase.rotation.x+aim.elevation+
                    (fault?.20:0)-(recovery*.12);
                combat.rotation.z=combatBase.rotation.z+(fault?.14:0);
                combat.position.y=combatBase.position.y-(fault?.09:0)+recovery*.014;
                combat.position.z=combatBase.position.z+(record.recoilKick??0);
                const mechanism=combat.userData.weaponMechanism;
                if(mechanism){
                    const rest=mechanism.rest;
                    mechanism.carriage.position.z=rest.carriage.z+reload.slide+
                        (record.recoilKick??0)*.35;
                    mechanism.carriage.position.y=rest.carriage.y+reload.bolt*.14;
                    mechanism.bolt.position.z=rest.bolt.z+reload.bolt;
                    if(mechanism.cassette && rest.cassette)
                        mechanism.cassette.position.y=rest.cassette.y-reload.cassette;
                }
            }
            const load=Math.min(1,(state.footingLoad??0)*.7+
                (state.recoilLoad??0)*.3);
            const grounded=motion?.weight??0;
            // A supporting step has a visible compressed chassis (not a
            // floating perfectly sinusoidal machine on rigid legs).
            root.position.y-=load*spec.compression+(state.brace??0)*.032;
            root.position.y+=Math.abs(Math.sin(motion?.phase??0))*
                grounded*(spec.compression*.43);
            const damage=1-health;
            root.rotation.x=THREE.MathUtils.clamp(
                -(state.longitudinalAcceleration??0)*.008+
                damage*Math.sin((motion?.phase??0)*.51)*.022,-.09,.09);
            root.rotation.z=THREE.MathUtils.clamp(
                -(state.lateralSpeed??0)*.014-
                (state.yawRate??0)*speed*.009+
                damage*Math.sin((motion?.phase??0)*.64)*.032,-.12,.12);
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
        inspecting = enabled;
        exterior.root.visible = enabled && !vendorEnabled;
        vendorRoot.visible = enabled && vendorEnabled;
        cockpit.visible = !enabled && !spectatorRig;
        combinerHud.visible = !enabled && !spectatorRig;
        blackout.visible = !enabled;
        arenaRoot.visible = !enabled;
        arenaPresentationRoot.visible = !enabled;
        garageRoot.visible = enabled;
        stagingFixtures.visible = enabled && !vendorEnabled;
        arenaHemisphere.visible = !enabled;
        sun.visible = !enabled;
        coolRim.visible = !enabled;
        debugColliders.visible = false;
        scene.background.setHex(enabled ? 0x0d1210 : 0x171915);
        scene.fog.color.setHex(enabled ? 0x0d1210 : 0x171915);
        scene.fog.density = enabled ? 0.0075 : 0.0125;
        if (!enabled) setAnimationPreview('off');
        if (enabled) {
            pilotWeaponFault = false; pilotWeaponServicing = false; pilotServiceSparkBudget = 0;
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
        exterior = buildExteriorRig(assembly);
        calibrateExteriorSoles(exterior);
        updateGarageFixtures(assembly);
        for (const mesh of exterior.pickMeshes)
            mesh.userData.actorId = 'player';
        pilotColors = captureColors(exterior.pickMeshes);
        rebuildEmptyMountPicks(assembly);
        exterior.root.position.copy(oldRoot.position);
        exterior.root.rotation.copy(oldRoot.rotation);
        exterior.root.visible = inspecting;
        scene.add(exterior.root);
        scene.remove(oldRoot);
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
        // A selected station is an inspector state, NOT a camera focus target.
        // Paint and part selection must not move, zoom or reset the orbit.
        desiredTarget.set(0,1.85,0);
    }
    function orbitBy(dx, dy) {
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
        azimuth = 0.68;
        elevation = 0.25;
        radius = 7.20;
        focusPart(null);
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
    function traceShot(spreadX, spreadY, muzzleZ) {
        camera.updateMatrixWorld();
        cockpit.updateMatrixWorld(true);
        targetExterior.root.updateWorldMatrix(true, true);
        // A sighting ray finds what the pilot sees; the second ray starts at the
        // gun's actual off-center muzzle and is allowed to be obstructed.
        const sightDir = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
        const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
        sightDir.addScaledVector(right, spreadX).addScaledVector(up, spreadY).normalize();
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
        return { actorId: slot ? actorId : null, slot: slot ?? null, blockedBy,
            shieldedSlot: cover ? null : shieldedSlot,
            point, normal: surfaceNormal, muzzle, distance: muzzle.distanceTo(point) };
    }
    function traceCombatantShot(shooterId, targetId, aimSlot, spreadX, spreadY) {
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
        const muzzleLocalZ = weaponId === 'gun-light' ? -2.16 : weaponId === 'gun-short' ? -1.03 : weaponId==='gun-scatter' ? -1.12 : -1.58;
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
        const bore = forward.clone().addScaledVector(right, spreadX).addScaledVector(up, spreadY).normalize();
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
        return {
            actorId: slot ? actorId : null,
            slot: slot ?? null, blockedBy, shieldedSlot: cover ? null : shieldedSlot,
            point, normal: surfaceNormal, muzzle,
            distance: muzzle.distanceTo(point), driveSide,
        };
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
    function showShot(contact, outcome) {
        muzzleKick = Math.min(1.6, muzzleKick + (pilotWeaponPresentation.visualRecoil ?? 1));
        muzzleFlash = pilotWeaponPresentation.muzzleFlashSeconds ?? .10;
        const hit = outcome !== null;
        const track = new THREE.BufferGeometry().setFromPoints([contact.muzzle, contact.point]);
        const trackMat = new THREE.LineBasicMaterial({ color: hit ? 0xf4c77e : 0xc7a76f, transparent: true, opacity: .92 });
        const tracer = new THREE.Line(track, trackMat);
        tracer.frustumCulled = false;
        scene.add(tracer);
        transientFX.push({ object: tracer, remaining: .14, duration: .14, material: trackMat });
        const impactPoint = contact.point.clone().addScaledVector(contact.normal, .045);
        const profile = spawnImpactParticles(impactPoint, contact.normal, outcome);
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
        showShieldStrike(contact);
    }
    function updateCombatantDamage(id, condition) {
        const record = squadCombatants.get(id);
        if (!record || !condition?.parts) return;
        record.condition = condition;
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
    }
    function updateTargetDamage(condition) {
        updateCombatantDamage('enemy-0', condition);
    }
    function showCombatantShot(shooterId, contact, outcome) {
        const shooter = squadCombatants.get(shooterId);
        const friendly = shooter?.team === 'friendly';
        if (shooter) {
            const weaponId = installedPart(shooter.assembly, 'combat')?.definition.id;
            const profile = weaponId === 'gun-scatter' ? {kick:.36,recovery:1.55} : weaponId === 'gun-short' ? { kick: .24, recovery: 1.9 } : weaponId === 'gun-light' ? { kick: .085, recovery: 4.2 } : { kick: .15, recovery: 2.8 };
            shooter.recoilKick = Math.min(.42, (shooter.recoilKick ?? 0) + profile.kick);
            shooter.recoilRecovery = profile.recovery;
        }
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
    }
    function resetTargetDamage(condition) {
        clearPooledParticles();
        while (sootMarks.length) {
            const mark = sootMarks.pop();
            rangeMarks.remove(mark);
            mark.geometry.dispose();
            mark.material.dispose();
        }
        updateTargetDamage(condition);
    }
    function updateCombatEffects(dt) {
        muzzleKick = Math.max(0, muzzleKick - dt * (pilotWeaponPresentation.visualRecovery ?? 3.6));
        muzzleFlash = Math.max(0, muzzleFlash - dt);
        for (const record of squadCombatants.values()) record.recoilKick = Math.max(0, (record.recoilKick ?? 0) - dt * (record.recoilRecovery ?? 3.2));
        const hitDecay = Math.exp(-8.5 * dt);
        hitPitchKick *= hitDecay; hitRollKick *= hitDecay; hitYawKick *= hitDecay; hitShakeKick *= Math.exp(-10.5 * dt); gunDamageKick *= Math.exp(-5.2 * dt);
        powerBlackout = Math.max(0, powerBlackout - dt);
        powerFlicker = Math.max(0, powerFlicker - dt);
        powerArcCooldown = Math.max(0, powerArcCooldown - dt);
        if (!inspecting && pilotWeaponServicing) {
            cockpit.updateWorldMatrix(true, true);
            pilotServiceSparkBudget += 28 * dt;
            while (pilotServiceSparkBudget >= 1) {
                pilotServiceSparkBudget -= 1;
                const origin = gunPivot.localToWorld(new THREE.Vector3(0, .01, .26));
                const velocity = new THREE.Vector3((Math.random() - .5) * 1.4, -.25 - Math.random() * 1.55, (Math.random() - .5) * 1.15);
                activateParticle(sparkPool, 'spark', origin, velocity, .62 + Math.random() * .42, .22 + Math.random() * .22, -2.4, 0, Math.random() > .25 ? 0x76dfff : 0xc8fff2);
            }
        } else pilotServiceSparkBudget = 0;
        if (!inspecting && pilotRecoveryBurstPending) {
            cockpit.updateWorldMatrix(true, true);
            const origin = gunPivot.localToWorld(new THREE.Vector3(0, .01, .26));
            flashDamageLight(origin, 0x76dfff, 5.5, .10, 3.6);
            for (let i = 0; i < 7; i++)
                activateParticle(sparkPool, 'spark', origin, new THREE.Vector3((Math.random()-.5)*2.0, .2+Math.random()*1.5, (Math.random()-.5)*1.7), .7+Math.random()*.45, .20+Math.random()*.24, -2.8, 0, i % 3 ? 0x76dfff : 0xe0fbff);
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
            state.group.updateWorldMatrix(true, true);
            const bounds = new THREE.Box3().setFromObject(state.group);
            if (bounds.min.y <= .025 && state.velocity.y <= 0) {
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
            if (record.weaponServicing && record.active && !record.wrecked) {
                record.serviceSparkBudget += 26 * dt;
                while (record.serviceSparkBudget >= 1) {
                    record.serviceSparkBudget -= 1;
                    const origin = weaponServicePoint(record);
                    const velocity = new THREE.Vector3((Math.random() - .5) * 1.6, -.18 - Math.random() * 1.7, (Math.random() - .5) * 1.35);
                    activateParticle(sparkPool, 'spark', origin, velocity, .60 + Math.random() * .45, .21 + Math.random() * .24, -2.5, 0, Math.random() > .25 ? 0x76dfff : 0xc8fff2);
                }
            } else record.serviceSparkBudget = 0;
            if (record.recoveryBurstPending && record.active && !record.wrecked) {
                const origin = weaponServicePoint(record);
                flashDamageLight(origin, 0x76dfff, 6.5, .10, 4.2);
                for (let i = 0; i < 8; i++)
                    activateParticle(sparkPool, 'spark', origin, new THREE.Vector3((Math.random()-.5)*2.2, .25+Math.random()*1.65, (Math.random()-.5)*1.8), .72+Math.random()*.48, .20+Math.random()*.26, -2.9, 0, i % 3 ? 0x76dfff : 0xe0fbff);
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
        setVendorStock, setVendorMode, selectVendorLot, pickVendorLot,
        orbitBy, panBy, setInspectorLayout, zoomBy, resetOrbit, pickPart,
        traceShot, showShot, traceHostileShot, showHostileShot, updateTargetDamage, updatePilotDamage, resetTargetDamage, updateCombatEffects, setPilotWeapon,
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

function buildGarageBay() {
    const root = new THREE.Group();
    const steel = mat(0x2d3431, .72, .55);
    const darkSteel = mat(0x222a27, .84, .44);
    const concrete = mat(0x535248, .98, .02);
    const padMat = mat(0x343a34, .92, .08);
    const safety = mat(0xb18432, .82, .16);
    const teal = mat(0x2c6662, .82, .24);
    const rust = mat(0x714029, .88, .18);

    const floor = box(18, .22, 15, concrete);
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

    // Lower fixture glare while raising broad fill: the bay should be dim, not black.
    const lampMat = new THREE.MeshStandardMaterial({ color: 0xffdfad, emissive: 0xffb454, emissiveIntensity: 2.25, roughness: .45 });
    for (const x of [-2.7, 0, 2.7]) {
        const fixture = box(1.55, .10, .25, lampMat);
        fixture.position.set(x, 5.45, -.3);
        root.add(fixture);
        const lamp = new THREE.PointLight(0xffc178, 11.5, 10, 2.0);
        lamp.position.set(x, 5.15, -.3);
        root.add(lamp);
    }
    const hemi = new THREE.HemisphereLight(0xa9c0b4, 0x2b241b, .86);
    root.add(hemi);
    const key = new THREE.DirectionalLight(0xffd19b, 1.95);
    key.position.set(-5, 8, 5);
    key.castShadow = true;
    key.shadow.mapSize.set(256, 256);
    key.shadow.camera.left = -9; key.shadow.camera.right = 9;
    key.shadow.camera.top = 8; key.shadow.camera.bottom = -4;
    key.shadow.camera.near = 1; key.shadow.camera.far = 24;
    key.shadow.bias = -.0006; key.shadow.normalBias = .045;
    root.add(key);
    const rim = new THREE.DirectionalLight(0x70a9a4, 1.15);
    rim.position.set(6, 4, -5);
    root.add(rim);
    const fill = new THREE.DirectionalLight(0x8fa99f, .72);
    fill.position.set(5, 5, 6);
    root.add(fill);

    return root;
}

function buildWarehouse(scene) {
    const solids = [];
    const width = DEFAULT_WORLD.maxX - DEFAULT_WORLD.minX;
    const depth = DEFAULT_WORLD.maxZ - DEFAULT_WORLD.minZ;
    const floor = box(width + 3, 0.35, depth + 3, mat(C.concreteDark, 1, 0));
    floor.position.set((DEFAULT_WORLD.minX + DEFAULT_WORLD.maxX) / 2, -0.18, (DEFAULT_WORLD.minZ + DEFAULT_WORLD.maxZ) / 2);
    floor.userData.arenaObstacleId = 'floor';
    scene.add(floor);
    solids.push(floor);
    const gridSize = Math.max(width, depth);
    const grid = new THREE.GridHelper(gridSize, Math.max(16, Math.round(gridSize / 2)), 0x4d4a3e, 0x34342f);
    grid.position.y = 0.01;
    scene.add(grid);

    const wallMat = mat(C.concrete, 0.98, 0.02);
    const wallThickness = 0.6;
    const wallHeight = 8;
    const wallOffset = 1.0;
    const centerX = (DEFAULT_WORLD.minX + DEFAULT_WORLD.maxX) / 2;
    const centerZ = (DEFAULT_WORLD.minZ + DEFAULT_WORLD.maxZ) / 2;
    const north = box(width + 2, wallHeight, wallThickness, wallMat);
    north.position.set(centerX, wallHeight / 2, DEFAULT_WORLD.minZ - wallOffset);
    north.userData.arenaObstacleId = 'wall-north';
    scene.add(north);
    solids.push(north);
    const south = box(width + 2, wallHeight, wallThickness, wallMat);
    south.position.set(centerX, wallHeight / 2, DEFAULT_WORLD.maxZ + wallOffset);
    south.userData.arenaObstacleId = 'wall-south';
    scene.add(south);
    solids.push(south);
    const west = box(wallThickness, wallHeight, depth + 2, wallMat);
    west.position.set(DEFAULT_WORLD.minX - wallOffset, wallHeight / 2, centerZ);
    west.userData.arenaObstacleId = 'wall-west';
    scene.add(west);
    solids.push(west);
    const east = box(wallThickness, wallHeight, depth + 2, wallMat);
    east.position.set(DEFAULT_WORLD.maxX + wallOffset, wallHeight / 2, centerZ);
    east.userData.arenaObstacleId = 'wall-east';
    scene.add(east);
    solids.push(east);

    const stripeMat = mat(C.yellow, 0.9, 0.08);
    for (const z of [PLAYER_SPAWN.z + 2.6, HOSTILE_SPAWN.z - 2.6]) {
        for (let x = DEFAULT_WORLD.minX + 4; x <= DEFAULT_WORLD.maxX - 4; x += 8) {
            const stripe = box(3.5, 0.03, 0.22, stripeMat);
            stripe.position.set(x, 0.03, z);
            scene.add(stripe);
        }
    }

    const obstacleMaterial = obstacle => {
        if (obstacle.kind === 'pillar') return mat(C.metal, .70, .65);
        if (obstacle.kind === 'container') return mat(obstacle.id.endsWith('east') ? C.teal : C.rust, .82, .20);
        if (obstacle.kind === 'building') return mat(0x565750, .96, .05);
        return mat(C.concreteDark, .98, .02);
    };
    for (const obstacle of DEFAULT_WORLD.obstacles) {
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

    const lightMaterial = new THREE.MeshStandardMaterial({ color: 0xffd39a, emissive: 0xffa43a, emissiveIntensity: 3.2, roughness: .5 });
    for (const z of [-14, 14]) {
        for (const x of [-22, 0, 22]) {
            const fixture = box(3.6, 0.12, 0.28, lightMaterial);
            fixture.position.set(x, 7.2, z);
            scene.add(fixture);
            const light = new THREE.PointLight(0xffb565, 26, 14, 2.15);
            light.position.set(x, 6.65, z);
            scene.add(light);
        }
    }

    const signCanvas = document.createElement('canvas');
    signCanvas.width = 384;
    signCanvas.height = 64;
    const ctx = signCanvas.getContext('2d');
    if (ctx) {
        ctx.fillStyle = '#161a18';
        ctx.fillRect(0, 0, signCanvas.width, signCanvas.height);
        ctx.fillStyle = '#d6a64a';
        ctx.font = 'bold 23px monospace';
        ctx.fillText('SCRAPYARD BEGINNER YARD', 20, 39);
    }
    const texture = new THREE.CanvasTexture(signCanvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(8.4, 1.4), new THREE.MeshBasicMaterial({ map: texture }));
    sign.position.set(centerX, 5, DEFAULT_WORLD.minZ - .67);
    scene.add(sign);
    return solids;
}
function buildCockpit(scene) {
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
    const scatterGreebles=new THREE.Group();
    const chokeRing=new THREE.Mesh(new THREE.CylinderGeometry(.31,.31,.14,8),
        new THREE.MeshStandardMaterial({color:0x8f713e,roughness:.81,metalness:.24}));
    chokeRing.rotation.x=Math.PI/2;
    chokeRing.position.set(0,-.04,-1.15);
    scatterGreebles.add(chokeRing);
    const cassette=box(.50,.26,.34,metal);
    cassette.position.set(-.06,-.34,.08);
    scatterGreebles.add(cassette);
    const rib=box(.52,.09,.66,teal);
    rib.position.set(0,.19,-.55);
    scatterGreebles.add(rib);
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
function buildDebugColliders(scene) {
    const group = new THREE.Group();
    const material = new THREE.MeshBasicMaterial({ color: 0x65ff91, wireframe: true, transparent: true, opacity: 0.7, depthTest: false });
    for (const obstacle of DEFAULT_WORLD.obstacles) {
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
                if (!node.isMesh) return;
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
        if (fitted) applyPartFinish(group,fitted.definition.id,fitted.instance.paint);
    }
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
