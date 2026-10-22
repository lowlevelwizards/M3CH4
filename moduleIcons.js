/** M3CH4 k4u — approved five-module pictograms. One geometry registry for
 * workshop/parts SVG and raster cockpit canvas. Never keyed by display label:
 * persistent station ids are structure, mobility, power, command, combat.
 * Original instrument family C, with approved rotary-drive variant D.
 */
import { stationGlyph } from './uiLanguage.js';

const s=(d,width,color='base')=>Object.freeze({d,width,color,operation:'stroke'});
const f=(d,color='base')=>Object.freeze({d,color,operation:'fill'});
export const MODULE_ICON_GEOMETRY=Object.freeze({
    structure:Object.freeze([
        s('M20 9H44L55 20V44L44 55H20L9 44V20Z',4),
        s('M22 19L42 45M42 19L22 45',5,'accent'),
    ]),
    mobility:Object.freeze([
        s('M44 22A12 12 0 1 1 20 22A12 12 0 1 1 44 22Z',5),
        f('M37 22A5 5 0 1 1 27 22A5 5 0 1 1 37 22Z','accent'),
        s('M22 30L17 42L10 49H25M42 30L47 42L54 49H39',6),
        s('M7 54H25M39 54H57',4,'accent'),
    ]),
    power:Object.freeze([
        s('M56 32A24 24 0 1 1 8 32A24 24 0 1 1 56 32Z',5),
        f('M34 14L19 36H31L27 52L47 26H34Z','accent'),
    ]),
    command:Object.freeze([
        s('M17 12H47L54 21V44L44 53H20L10 44V21Z',4),
        f('M15 27L24 20H43L49 27V38H15Z','accent'),
        s('M22 47H42',3),
    ]),
    combat:Object.freeze([
        s('M10 20H34L44 29L34 39H10Z',4),
        f('M43 25H60V33H43Z','accent'),
        s('M23 40V50H46M16 53H50',5),
        f('M28 29A4 4 0 1 1 20 29A4 4 0 1 1 28 29Z','accent'),
    ]),
});
const SVG_NS='http://www.w3.org/2000/svg';
const DEFAULT_ACCENT='#e8b54d';
const knownSlot=slot=>Object.hasOwn(MODULE_ICON_GEOMETRY,slot);

/** Accessible naming comes from the parent control; each decorative svg is hidden.
 * The fallback exists only for legacy no-SVG test DOMs. */
export function createModuleIcon(slot,{className=''}={}){
    if(!knownSlot(slot)||typeof document.createElementNS!=='function'){
        const fallback=document.createElement('span');
        fallback.className='module-icon-fallback'+(className?' '+className:'');
        fallback.textContent=stationGlyph(slot);
        fallback.setAttribute('aria-hidden','true');
        return fallback;
    }
    const svg=document.createElementNS(SVG_NS,'svg');
    svg.setAttribute('viewBox','0 0 64 64');
    svg.setAttribute('focusable','false');
    svg.setAttribute('aria-hidden','true');
    svg.setAttribute('width','24');
    svg.setAttribute('height','24');
    svg.setAttribute('class','module-icon'+(className?' '+className:''));
    for(const layer of MODULE_ICON_GEOMETRY[slot]){
        const path=document.createElementNS(SVG_NS,'path');
        path.setAttribute('d',layer.d);
        const tone=layer.color==='accent'?'var(--module-icon-accent, '+DEFAULT_ACCENT+')':'currentColor';
        path.setAttribute('fill',layer.operation==='fill'?tone:'none');
        if(layer.operation==='stroke'){
            path.setAttribute('stroke',tone);
            path.setAttribute('stroke-width',String(layer.width));
            path.setAttribute('stroke-linejoin','bevel');
        }
        svg.append(path);
    }
    return svg;
}

// Path2D instances are created lazily, once per distinct module and path.
// Avoid allocating SVG or Paths every cockpit frame.
const pathCache=new Map();
export function drawModuleIcon(ctx,slot,x,y,size=20,baseColor='#e8e6d9',accentColor=DEFAULT_ACCENT){
    if(!knownSlot(slot)||!ctx)return false;
    if(typeof Path2D!=='function'||typeof ctx.save!=='function'){
        // Non-browser test canvases and old WebViews retain a legible abbreviation.
        if(typeof ctx.fillText==='function') {
            ctx.fillStyle=baseColor;
            ctx.fillText(stationGlyph(slot),x,y+size*.8);
        }
        return false;
    }
    if(!pathCache.has(slot))pathCache.set(slot,MODULE_ICON_GEOMETRY[slot].map(layer=>new Path2D(layer.d)));
    ctx.save();
    ctx.translate(x,y);
    ctx.scale(size/64,size/64);
    ctx.lineJoin='bevel';
    MODULE_ICON_GEOMETRY[slot].forEach((layer,i)=>{
        const color=layer.color==='accent'?accentColor:baseColor;
        if(layer.operation==='fill'){
            ctx.fillStyle=color;ctx.fill(pathCache.get(slot)[i]);
        }else{
            ctx.strokeStyle=color;ctx.lineWidth=layer.width;
            ctx.stroke(pathCache.get(slot)[i]);
        }
    });
    ctx.restore();
    return true;
}
