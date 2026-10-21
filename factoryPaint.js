/** k.4b–d. Manufacturer finishes, owner paint and saved palettes are separate data.
 * The four channels color coating only; structural steel, mechanisms, optics and
 * damage never become paint channels. No WebGL or browser dependency here.
 */
export const PAINT_CHANNELS = Object.freeze(['primary', 'secondary', 'armor', 'accent']);
export const PAINT_ROLE_CHANNEL = Object.freeze({
    'primary-paint': 'primary',
    'secondary-paint': 'secondary',
    'protective-paint': 'armor',
    accent: 'accent',
});
const finish = (primary,secondary,armor,accent) =>
    Object.freeze({primary,secondary,armor,accent});
const BASE = Object.freeze(finish('#898c83','#626b68','#b0aea0','#8d7860'));
export const FACTORY_FINISHES = Object.freeze({
    'frame-sr': finish('#767a76','#515958','#93968e','#8d745d'),
    'frame-utility': finish('#9a988d','#687272','#a9ada4','#81665e'),
    'frame-wedge': finish('#727b7c','#606966','#8b9290','#9a8168'),
    'legs-yard': finish('#929488','#6a736b','#aaa99a','#947457'),
    'legs-compact': finish('#868c87','#667676','#a4aca5','#8f6d58'),
    'legs-hauler': finish('#7e8376','#636b5e','#9b9e8e','#846b53'),
    'gun-cannon': finish('#90918a','#666f70','#a5a69e','#887561'),
    'gun-short': finish('#7e837e','#596262','#9d9b90','#947a60'),
    'gun-light': finish('#919b9b','#69767c','#a9b0a9','#817362'),
    'gun-scatter': finish('#87867e','#696f69','#a5a093','#936b50'),
    'cab-cyclops': finish('#828986','#606e6b','#b3b2a6','#927764'),
    'cab-utility': finish('#9e9d92','#737873','#b5b5ab','#8a725c'),
    'cab-armored': finish('#838781','#636968','#b3aba0','#9b7d64'),
    'power-dynamo': finish('#7e8988','#697778','#a6a79a','#987558'),
    'power-air': finish('#8b8f85','#6c7675','#a4aba8','#907a62'),
});
export const FACTORY_BASE = BASE;
export const PAINT_PRESETS = Object.freeze([
    Object.freeze({id:'safety',name:'SAFETY YELLOW',colors:finish('#bc9a45','#59645c','#d0c1a4','#995e43')}),
    Object.freeze({id:'race',name:'RACING RED',colors:finish('#a94237','#38434a','#d4c8b6','#d9a35c')}),
    Object.freeze({id:'dust',name:'DUSTBOWL',colors:finish('#82765d','#5c675b','#a99d84','#856b4e')}),
    Object.freeze({id:'coastal',name:'BLUE SHIFT',colors:finish('#62849a','#435b67','#bfc2b5','#bf8957')}),
    Object.freeze({id:'works',name:'WORKS GREY',colors:finish('#898c84','#545f60','#b4b2a6','#a37651')}),
]);
/** Three distributions of the SAME four pigments. No new inventory or
 * material roles: only which pigment feeds each coating channel changes. */
export const PAINT_VARIANTS = Object.freeze([
    Object.freeze({id:'default',name:'DEFAULT',channels:Object.freeze(['primary','secondary','armor','accent'])}),
    Object.freeze({id:'alternate-a',name:'ALT A',channels:Object.freeze(['secondary','primary','armor','accent'])}),
    Object.freeze({id:'alternate-b',name:'ALT B',channels:Object.freeze(['armor','primary','secondary','accent'])}),
]);
export function paintVariant(palette, variant=0) {
    const colors=normalizePaint(palette);
    if (!colors) return null;
    const index=Number.isInteger(variant) && variant>=0 && variant<PAINT_VARIANTS.length ? variant : 0;
    return Object.fromEntries(PAINT_CHANNELS.map((channel,i)=>[channel,colors[PAINT_VARIANTS[index].channels[i]]]));
}
export const USER_PALETTES_KEY = 'm3ch4-paint-palettes-v1';
export function factoryFinishFor(definitionId) {
    return FACTORY_FINISHES[definitionId] || BASE;
}
const isRecord = value => !!value && typeof value === 'object' && !Array.isArray(value);
export const isPaintHex = value => typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);
export function validPaint(paint) {
    return isRecord(paint) && Object.keys(paint).length === PAINT_CHANNELS.length &&
        Object.keys(paint).every(channel => PAINT_CHANNELS.includes(channel)) &&
        PAINT_CHANNELS.every(channel => isPaintHex(paint[channel]));
}
export function normalizePaint(paint) {
    if (!validPaint(paint)) return null;
    return Object.fromEntries(PAINT_CHANNELS.map(channel=>[channel,paint[channel].toLowerCase()]));
}
export function paintForPart(part) {
    return normalizePaint(part?.paint) || factoryFinishFor(part?.definitionId);
}
export function readUserPalettes(storage) {
    try {
        const entries=JSON.parse(storage?.getItem(USER_PALETTES_KEY) || '[]');
        if (!Array.isArray(entries)) return [];
        return entries.filter(item=>isRecord(item) && typeof item.name==='string' &&
            item.name.trim().length>0 && item.name.length<=28 && validPaint(item.colors))
            .slice(0,12).map(item=>({name:item.name.trim(),colors:normalizePaint(item.colors)}));
    } catch { return []; }
}
export function storeUserPalette(storage,name,colors) {
    if (!storage || typeof name!=='string' || !name.trim() || name.trim().length>28 || !validPaint(colors))
        return false;
    const entries=readUserPalettes(storage);
    const cleanName=name.trim();
    const index=entries.findIndex(item=>item.name.toLowerCase()===cleanName.toLowerCase());
    if (index<0 && entries.length>=12) return false;
    const record={name:cleanName,colors:normalizePaint(colors)};
    if (index<0) entries.push(record);
    else entries[index]=record;
    try { storage.setItem(USER_PALETTES_KEY,JSON.stringify(entries)); return true; }
    catch { return false; }
}
export function deleteUserPalette(storage,name) {
    const entries=readUserPalettes(storage);
    try {
        storage?.setItem(USER_PALETTES_KEY,JSON.stringify(entries.filter(item=>item.name!==name)));
        return !!storage;
    } catch { return false; }
}
