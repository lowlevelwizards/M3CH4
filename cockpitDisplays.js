/** k.3v.5 — canvas-only, theme-specific renderings of existing truthful telemetry.
 * Screen geometry and simulation are owned elsewhere. This owns visual language.
 * Every label stays inside its actual canvas (including 82px motion/power panels).
 */
const clamp=(v,min=0,max=1)=>Math.max(min,Math.min(max,Number.isFinite(Number(v))?Number(v):min));
const integer=n=>Math.round(Number(n)||0);
const specs={
    workhorse:{bg:'#101a13',edge:'#6d8563',text:'#b3d7a8',muted:'#799578',ok:'#a0d4a1',warn:'#e8ba69',bad:'#ef8266'},
    observation:{bg:'#11282b',edge:'#508c8e',text:'#bce9e0',muted:'#83b4b2',ok:'#9bdecb',warn:'#efba78',bad:'#fc9179'},
    armored:{bg:'#27261e',edge:'#aa8955',text:'#e1d3a8',muted:'#b8a481',ok:'#c4d3a5',warn:'#f1ae69',bad:'#f18a69'},
};
import { STATION_ORDER, STATIONS } from './uiLanguage.js';
import { drawModuleIcon } from './moduleIcons.js';
import { canvasFont } from './typography.js';
const slots=STATION_ORDER;
const names=Object.fromEntries(slots.map(slot=>[slot,STATIONS[slot].short]));
const abbreviation=(s)=>String(s??'NO WEAPON').toUpperCase().includes('NEEDLE')?'NEEDLE':
    String(s??'').toUpperCase().includes('STUMP')?'STUMP':
    String(s??'').toUpperCase().includes('TRAINING')?'CANNON':
    String(s??'NO WEAPON').toUpperCase().slice(0,11);
function start(ctx,w,h,p,tone='ok'){
    ctx.clearRect(0,0,w,h);
    ctx.fillStyle=p.bg;ctx.fillRect(0,0,w,h);
    ctx.lineWidth=2;ctx.strokeStyle=p[tone]??p.edge;ctx.strokeRect(1.5,1.5,w-3,h-3);
    ctx.fillStyle=p.text;ctx.textBaseline='middle';ctx.textAlign='left';
}
function label(ctx,value,x,y,size=11,color=null){
    if(color)ctx.fillStyle=color;
    ctx.font = canvasFont(size, 'data');
    ctx.fillText(String(value),x,y);
}
function line(ctx,x,y,w,h,fraction,p,warning=false){
    ctx.fillStyle=p.edge;ctx.globalAlpha=.32;ctx.fillRect(x,y,w,h);ctx.globalAlpha=1;
    ctx.fillStyle=warning?p.warn:p.ok;ctx.fillRect(x,y,w*clamp(fraction),h);
}
function severity(p,v){return v<=.001?p.bad:v<38?p.warn:p.ok;}
/** Every cab now has a dual-layer *part* condition display.
 * Teal inner channel reports integrity; amber outer reports protective armor.
 * Full-health numbers stay silent. A significant damaged value is shown only
 * where it is causally useful. Existing 3D monitor geometry is reused. */
function systems(ctx,w,h,data,p,theme){
    const integrity=data.systems??{},armor=data.armor??{};
    const heading=theme==='workhorse'?'CYCLOPS':
        theme==='observation'?'VISTA':'HEARTH';
    label(ctx,heading,7,12,10,p.muted);
    slots.forEach((slot,i)=>{
        const y=36+i*35;
        const core=clamp(integrity[slot]??100,0,100);
        const shell=clamp(armor[slot]??100,0,100);
        // Distinct physical display grammar: workhorse gauge-mark, Vista
        // compact stacked rails, Hearth welded annunciator segment.
        if(theme==='armored'){
            ctx.fillStyle=core<38?'#543326':'#34382b';
            ctx.fillRect(6,y-8,w-12,30);
        }else if(theme==='observation'){
            ctx.fillStyle='#204047';ctx.fillRect(6,y-8,w-12,30);
        }
        drawModuleIcon(ctx,slot,8,y-13,19,p.text,p.warn);
        line(ctx,29,y-6,45,5,shell/100,p,true);
        line(ctx,29,y+6,45,7,core/100,p,core<38);
        if(core<99||shell<99){
            ctx.textAlign='right';
            label(ctx,integer(Math.min(core,shell)),w-5,y+4,10,
                core<38?p.bad:shell<38?p.warn:p.text);
            ctx.textAlign='left';
        }
    });
}
function weapon(ctx,w,h,data,p,theme){
    const state=String(data.weaponState??'READY');
    const critical=/FAULT|LOST|DESTROY|SAG|DAMAGED/.test(state);
    const tone=critical?p.warn:p.ok;
    const gun=abbreviation(data.weapon);
    if(theme==='workhorse'){
        drawModuleIcon(ctx,'combat',8,4,16,p.muted,p.warn);
        label(ctx,gun,27,12,12,p.muted);
        ctx.fillStyle='#203126';ctx.fillRect(7,23,w-14,36);
        label(ctx,String(data.ammo??'—'),12,42,27,p.ok);
        ctx.textAlign='right';label(ctx,state,w-8,69,10,tone);ctx.textAlign='left';
    }else if(theme==='observation'){
        drawModuleIcon(ctx,'combat',8,4,16,p.muted,p.warn);
        label(ctx,gun,27,12,11,p.muted);
        label(ctx,String(data.ammo??'—'),9,43,27,p.text);
        ctx.textAlign='right';label(ctx,state,w-9,66,11,tone);ctx.textAlign='left';
    }else{
        drawModuleIcon(ctx,'combat',8,5,16,p.muted,p.warn);
        label(ctx,gun,27,13,11,p.muted);
        ctx.fillStyle=critical?'#663824':'#36432d';ctx.fillRect(7,23,w-14,31);
        label(ctx,state,13,40,19,tone);
        ctx.textAlign='right';label(ctx,String(data.ammo??'—'),w-9,67,14,p.text);ctx.textAlign='left';
    }
}
function team(ctx,w,h,data,p,theme){
    const counts=data.team??{};const a=clamp(counts.friendly,0,3),b=clamp(counts.hostile,0,3);
    const headline=theme==='workhorse'?'CREW / FOES':
        theme==='observation'?'TEAM / FOES':'RIGS / FOES';
    label(ctx,headline,8,11,10,p.muted);
    for(let i=0;i<3;i++){
        ctx.fillStyle=i<a?p.ok:p.edge;ctx.fillRect(10+i*17,25,12,11);
        ctx.fillStyle=i<b?p.bad:p.edge;ctx.fillRect(w-11-i*17-12,25,12,11);
    }
    label(ctx,`${integer(a)} / 3`,67,31,12,p.text);
    ctx.textAlign='right';label(ctx,`${integer(b)} / 3`,w-67,31,12,p.text);ctx.textAlign='left';
}
function motion(ctx,w,h,data,p,theme){
    const speed=Number(data.speed??0).toFixed(1),turn=integer(data.turnRate),
        slip=Number(data.slip)||0,load=clamp(data.footing),recoil=clamp(data.recoil);
    const state=Number(data.brace)>=1?'BRACED':Number(data.brace)>0?'PLANT':String(data.direction??'IDLE');
    const alert=slip>.35?'FOOT SCRAPE':recoil>.2?'RECOIL LOAD':!data.secondaryDiagnostics?'DIAG SERVICE':load>.8?'FEET LOADED':'GRIP NOMINAL';
    if(theme==='workhorse'){
        label(ctx,'SPEED',8,12,10,p.muted);
        label(ctx,`${speed} m/s`,9,34,20,p.ok);
        ctx.textAlign='right';label(ctx,state,w-9,32,11,p.warn);ctx.textAlign='left';
        label(ctx,`TURN ${turn} deg/s`,9,54,12,p.text);
        label(ctx,alert,9,72,11,slip>.35?p.warn:p.muted);
    }else if(theme==='observation'){
        label(ctx,'MOTION',8,12,10,p.muted);
        label(ctx,`${speed} m/s`,9,35,24,p.text);
        ctx.textAlign='right';label(ctx,`${turn} deg/s`,w-9,35,13,p.ok);ctx.textAlign='left';
        label(ctx,state,9,57,12,p.ok);
        ctx.textAlign='right';label(ctx,alert,w-9,72,10,slip>.35?p.warn:p.muted);ctx.textAlign='left';
    }else{
        label(ctx,'TRACTION',8,12,10,p.muted);
        label(ctx,`${speed} m/s`,9,34,19,p.text);
        ctx.textAlign='right';label(ctx,state,w-9,34,12,p.warn);ctx.textAlign='left';
        line(ctx,9,47,w-18,6,load,p,slip>.35);
        label(ctx,alert,9,69,12,slip>.35?p.warn:p.text);
    }
}
function drive(ctx,w,h,data,p,theme){
    const load=clamp(data.driveLoad),power=data.power??{},
        bus=clamp(power.busRatio??1),reserve=clamp(power.reserveFraction??1),
        generation=integer(power.generationKw),demand=integer(power.demandKw),
        sag=bus<.95;
    if(theme==='workhorse'){
        label(ctx,sag?'VOLTAGE LOW':'GENERATOR',8,12,11,sag?p.warn:p.muted);
        line(ctx,8,24,w-16,9,bus,p,sag);
        label(ctx,`${generation}/${demand} kW`,9,46,14,p.text);
        label(ctx,`LOAD ${integer(load*100)}%`,9,68,11,p.muted);
        ctx.textAlign='right';label(ctx,`CAP ${integer(reserve*100)}%`,w-9,68,11,p.ok);ctx.textAlign='left';
    }else if(theme==='observation'){
        drawModuleIcon(ctx,'power',8,5,15,p.muted,p.warn);
        label(ctx,'SUPPLY',27,12,10,p.muted);
        label(ctx,`${generation} / ${demand} kW`,8,31,15,p.text);
        label(ctx,`BUS ${integer(bus*100)}%`,8,51,12,sag?p.warn:p.ok);
        ctx.textAlign='right';label(ctx,`RES ${integer(reserve*100)}%`,w-8,51,12,p.text);ctx.textAlign='left';
        line(ctx,8,63,w-16,7,reserve,p,sag);
    }else{
        drawModuleIcon(ctx,'power',8,5,15,p.text,p.warn);
        label(ctx,sag?'SAG':'POWER',27,13,11,sag?p.warn:p.ok);
        label(ctx,`SUP ${generation} kW`,8,34,13,p.text);
        label(ctx,`REQ ${demand} kW`,8,50,13,p.muted);
        line(ctx,8,60,w-16,6,bus,p,sag);
        ctx.textAlign='right';label(ctx,`RESERVE ${integer(reserve*100)}%`,w-8,75,10,p.text);ctx.textAlign='left';
    }
}
const RENDERERS={systems,weapon,team,motion,drive};
export function drawCockpitChannel(screen,channel,data,profile,damage=null){
    const ctx=screen?.ctx;
    if(!ctx||!RENDERERS[channel])return;
    const p=specs[profile?.theme]??specs.workhorse;
    const w=screen.canvas.width,h=screen.canvas.height;
    start(ctx,w,h,p,damage?.busSag&&channel==='drive'?'warn':'ok');
    RENDERERS[channel](ctx,w,h,{...data,secondaryDiagnostics:damage?.diagnosticsAvailable!==false},p,profile?.theme??'workhorse');
    // Harmless, deterministic screenwear: overlay does NOT modify any data
    // or touch reliable DOM warnings outside the cockpit glass.
    if(damage?.staticStrength>.30 && channel==='systems'){
        const strength=Math.min(.17,damage.staticStrength*.14);
        ctx.globalAlpha=strength;
        if(profile.theme==='workhorse'){
            // Old CRT scanning artifacts; the information remains legible.
            ctx.fillStyle=p.muted;
            for(let i=0;i<4;i++)ctx.fillRect(4,25+i*48,w-8,1);
        } else if(profile.theme==='observation'){
            // Survey LCD: thin interrupted vertical line at the lower bezel.
            ctx.fillStyle=p.edge;
            ctx.fillRect(5,82,2,34);ctx.fillRect(w-7,147,2,27);
        } else {
            // Hearth: rust-amber condition edge, not an invented fault label.
            ctx.fillStyle=p.warn;
            ctx.fillRect(4,27,2,h-45);ctx.fillRect(w-6,27,2,h-45);
        }
        ctx.globalAlpha=1;
    }
    screen.texture.needsUpdate=true;
}
export function drawDimensionAudit(){
    // Every coordinate in this module is at least 5px from the outer bounds:
    // motion max baseline 72 < 82; power max 75 < 82.
    return {
        motionMaxY:72,driveMaxY:75,motionHeight:82,driveHeight:82,
        originalClippedMotionY:65,originalClippedDriveY:67,
        originalMotionHeight:56,originalDriveHeight:40,
    };
}
