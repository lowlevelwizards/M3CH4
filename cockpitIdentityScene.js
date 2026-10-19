/** k.3v.5 — transform the existing renderer's ONE cockpit, do not fork it.
 * The base scene continues to own camera, gun pivot, hit impulses, flicker,
 * armor geometry, legitimate raycasts, instruments and warning light logic.
 * This small bridge installs three persistent physical shells and reskins
 * the existing five canvas surfaces when a real command module is installed.
 */
import * as THREE from 'three';
import { installedPart } from './components.js';
import { SCREEN_DIMENSIONS, resolveCockpitProfile, cockpitFailurePresentation } from './cockpitProfiles.js';
import { drawCockpitChannel } from './cockpitDisplays.js';

const STEEL=0x3a403e, OCHRE=0xa9822f, TEAL=0x3c7876, DARK=0x202725;
function material(color){return new THREE.MeshStandardMaterial({
    color, roughness:.84, metalness:.19, flatShading:true,
});}
const PALETTE={steel:material(STEEL),ochre:material(OCHRE),teal:material(TEAL),dark:material(DARK)};
function plate(group,wide,high,deep,finish,x,y,z,rx=0,rz=0){
    const mesh=new THREE.Mesh(new THREE.BoxGeometry(wide,high,deep),PALETTE[finish]);
    mesh.position.set(x,y,z);
    mesh.rotation.set(rx,0,rz);
    mesh.receiveShadow=true;
    group.add(mesh);
    return mesh;
}
function createVistaKit(){
    const g=new THREE.Group();g.name='pilot-interior:vista';
    // Open observation cab: low instruments, narrow roof beam, long glass area.
    plate(g,1.60,.20,.56,'dark',0,1.68,-.89,-.12);
    plate(g,.64,.15,.35,'teal',-.47,1.85,-1.11);
    plate(g,.62,.15,.35,'teal',.47,1.85,-1.11);
    for(const side of [-1,1]){
        plate(g,.13,1.13,.18,'steel',side*.97,2.44,-.61,.06,side*.065);
        plate(g,.30,.24,.31,'teal',side*.76,1.88,-1.13);
        plate(g,.35,.075,.18,'ochre',side*.51,2.01,-1.15);
        plate(g,.22,.23,.10,'dark',side*.83,2.31,-.76);
    }
    plate(g,1.84,.085,.20,'teal',0,3.01,-.61);
    plate(g,.37,.095,.36,'steel',.45,2.97,-.67,0,-.08);
    plate(g,.48,.065,.26,'steel',0,1.94,-1.08);
    return g;
}
function createHearthKit(){
    const g=new THREE.Group();g.name='pilot-interior:hearth';
    // Thick mechanical framing, deliberately OPEN at reticle center.
    plate(g,1.90,.42,.75,'dark',0,1.64,-1.04,-.14);
    plate(g,1.69,.17,.57,'ochre',0,1.91,-1.14,-.10);
    for(const side of [-1,1]){
        plate(g,.43,1.42,.37,'steel',side*.97,2.30,-.72,.04,side*.08);
        plate(g,.26,.78,.30,'ochre',side*.75,2.58,-1.01,-.10,side*.11);
        plate(g,.45,.21,.39,'teal',side*.69,1.99,-1.24);
        plate(g,.26,.22,.14,'steel',side*.90,2.02,-1.30);
    }
    plate(g,1.87,.33,.42,'steel',0,3.00,-.72);
    plate(g,1.27,.09,.20,'ochre',0,2.81,-.95);
    plate(g,1.12,.10,.18,'dark',0,1.99,-1.22);
    return g;
}
function groupOriginalWorkhorse(cockpit){
    // Preserve the existing gun and genuine warning-light meshes/lights,
    // reparent only the base structural dashboard and upper windshield.
    const g=new THREE.Group();g.name='pilot-interior:cyclops';cockpit.add(g);
    const lamps=cockpit.userData.warningLamps??{};
    for(const child of [...cockpit.children]){
        if(child===g || child===cockpit.userData.gunPivot || child.isLight ||
            child.material===lamps.amberLampMat || child.material===lamps.redLampMat)
            continue;
        g.add(child);
    }
    // Add a deep salvaged CRT hood and separate oversized cable/switch panel.
    plate(g,.63,.27,.38,'steel',-.55,2.12,-1.14);
    plate(g,.54,.20,.07,'teal',-.55,2.12,-1.36);
    for(const x of [-.44,-.17,.16,.43])
        plate(g,.11,.07,.06,'ochre',x,1.99,-1.15);
    return g;
}

export function installCockpitIdentities(arena,assembly){
    const cockpit=arena.cockpit;
    if(!cockpit?.userData?.instrumentScreens)throw Error('Cockpit identity requires existing instrument ownership.');
    const base=groupOriginalWorkhorse(cockpit);
    const kits={
        'cab-cyclops':base,
        'cab-utility':createVistaKit(),
        'cab-armored':createHearthKit(),
    };
    cockpit.add(kits['cab-utility'],kits['cab-armored']);
    cockpit.userData.cabKits=kits;
    const screens=cockpit.userData.instrumentScreens;
    const displayGroup=arena.camera.children.find(g=>g.name==='cockpit-combiner-hud');
    if(!displayGroup)throw Error('Missing existing camera-combiner group.');
    for(const [name,screen] of Object.entries(screens)){
        const [w,h]=SCREEN_DIMENSIONS[name];
        if(screen.canvas.width===w && screen.canvas.height===h)continue;
        // Fix preexisting clipped lines at y=65/67 in 56/40px textures.
        screen.canvas.width=w;screen.canvas.height=h;
        screen.mesh.geometry.dispose();
        screen.mesh.geometry=new THREE.PlaneGeometry(w/250,h/250);
        screen.texture.needsUpdate=true;
    }
    const updateBaseInstruments=arena.updateCockpitInstruments.bind(arena);
    const updateBaseMotion=arena.updateCockpitMotion.bind(arena);
    let current=resolveCockpitProfile(installedPart(assembly,'command')?.definition.id);
    let lastInstrumentKey='',lastMotionKey='',commandHealth=1,powerHealth=1,busRatio=1;
    let lastInstrumentData=null,hitFlashTimer=null;
    function apply(assembly){
        current=resolveCockpitProfile(installedPart(assembly,'command')?.definition.id);
        for(const [id,kit] of Object.entries(kits))kit.visible=id===current.id;
        // The preexisting Hearth/Vista brow ornaments are part of the original
        // kit; their original toggles remain safe but are not duplicated.
        cockpit.userData.armoredCab.visible=false;
        cockpit.userData.utilityCab.visible=false;
        for(const [name,screen] of Object.entries(screens)){
            const layout=current.layout[name];
            screen.mesh.position.set(...layout.position);
            screen.mesh.scale.setScalar(layout.scale);
        }
        lastInstrumentKey=lastMotionKey='';
    }
    apply(assembly);
    arena.updateCockpitInstruments=data=>{
        updateBaseInstruments(data); // authoritative warnings, crack damage
        lastInstrumentData=data;
        const key=current.id+'|'+JSON.stringify(data);
        if(key===lastInstrumentKey)return;
        lastInstrumentKey=key;
        commandHealth=Math.max(0,Math.min(1,(Number(data.systems?.command)??100)/100));
        powerHealth=Math.max(0,Math.min(1,(Number(data.systems?.power)??100)/100));
        const faults=cockpitFailurePresentation(commandHealth,powerHealth,busRatio);
        for(const channel of ['systems','weapon','team'])
            drawCockpitChannel(screens[channel],channel,data,current,faults);
    };
    arena.updateCockpitMotion=data=>{
        updateBaseMotion(data); // existing motion/footing, cockpit effects
        const key=current.id+'|'+JSON.stringify(data);
        if(key===lastMotionKey)return;
        lastMotionKey=key;
        busRatio=data.power?.busRatio??1;
        const faults=cockpitFailurePresentation(commandHealth,powerHealth,busRatio);
        for(const channel of ['motion','drive'])
            drawCockpitChannel(screens[channel],channel,data,current,faults);
    };
    const triggerBase=arena.triggerCockpitHit.bind(arena);
    arena.triggerCockpitHit=(slot,profile={})=>{
        triggerBase(slot,profile);
        const index=['structure','mobility','power','command','combat'].indexOf(slot);
        if(index<0||!lastInstrumentData)return;
        const screen=screens.systems,ctx=screen.ctx;
        // Physical armor impact = amber; actual core penetration = red.
        // The flash overlays the correct row of the genuine cab monitor.
        const penetrating=Number(profile.internalDamage)>0;
        if(hitFlashTimer!==null)clearTimeout(hitFlashTimer);
        const faults=cockpitFailurePresentation(commandHealth,powerHealth,busRatio);
        drawCockpitChannel(screen,'systems',lastInstrumentData,current,faults);
        ctx.fillStyle=penetrating?'#da795d':'#e6b966';
        ctx.globalAlpha=.88;
        ctx.fillRect(2,27+index*35,4,29);
        ctx.globalAlpha=1;
        screen.texture.needsUpdate=true;
        hitFlashTimer=setTimeout(()=>{
            hitFlashTimer=null;
            drawCockpitChannel(screen,'systems',lastInstrumentData,current,
                cockpitFailurePresentation(commandHealth,powerHealth,busRatio));
        },380);
    };
    return { apply, getProfile:()=>current, kits, screens, displayGroup };
}
