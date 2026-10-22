/** k.3t.0 — The Parts Counter. Six new-cycle real, individually serialized used components.
 * Listings turn over only when a complete contract records its campaign sortie.
 * No wall-clock waiting, paid refresh, rarity tiers, free stock, or price guarantees.
 */
import { CATALOG, BY_ID } from './components.js';
import { partCreditValue, basePartValue } from './partEconomy.js';
import { loadMachine, storeMachine } from './persistence.js';

export const COUNTER_KEY = 'm3ch4-used-counter-v1';
export const COUNTER_VERSION = 2;
export const COUNTER_SIZE = 6;
const clamp01 = n => Math.max(0,Math.min(1,Number(n)||0));
const copy = v => JSON.parse(JSON.stringify(v));
function prng(seed) {
    // Predictable per completed-contract cycle; reopening the garage never rerolls.
    let value = (seed + 0x9e3779b9) >>> 0;
    return () => {
        value = (Math.imul(value,1664525)+1013904223) >>> 0;
        return value / 0x100000000;
    };
}
function ten(n) { return Math.max(10, Math.round(n / 10) * 10); }
export function generateCounterStock(cycle=0) {
    const index = Number.isSafeInteger(cycle) && cycle>=0 ? cycle : 0;
    const random = prng(index * 761 + 179);
    const choices = [...CATALOG];
    const offers = [];
    for (let i=0;i<COUNTER_SIZE;i++) {
        // One introductory S-6 only on a new campaign's first rotation;
        // later cycles draw it normally rather than permanently reserving a slot.
        // Lightweight category coverage guarantees usable variety but not tiers.
        const pool=i===0 ? (index===0
            ? choices.filter(part=>part.id==='gun-scatter')
            : choices.filter(part=>part.slot==='combat')) :
            i===1 ? choices.filter(part=>part.slot==='mobility') : choices;
        const definition=pool[Math.floor(random()*pool.length)];
        choices.splice(choices.indexOf(definition),1);
        const roll=random();
        // Most are worn; occasionally a decent module slips through. A seller
        // can have an intact but badly worn component, or a cheap disabled one.
        const condition=roll<.13
            ? Math.round(random()*14)/100
            : roll<.91 ? Math.round((.18+random()*.52)*100)/100
            : Math.round((.79+random()*.18)*100)/100;
        const wear=Math.round((.08+random()*(condition>.78?.27:.60))*100)/100;
        const repairs=Math.floor(random()*5);
        const yardValue=partCreditValue(definition,condition,{wear});
        const markup=1.40+random()*.94; // 140–234% of actual as-is yard value.
        const price=ten(Math.max(yardValue*markup,basePartValue(definition)*.39));
        const serial='CTR-'+String(index).padStart(4,'0')+'-'+String(i+1).padStart(2,'0');
        offers.push({id:serial,serial,definitionId:definition.id,condition,
            wear,repairs,price,sold:false});
    }
    return {version:COUNTER_VERSION,cycle:index,offers};
}
function validStock(state,cycle) {
    // Active four-lot v1 rotations must remain byte-for-byte readable. Their
    // sold status, serials, price and condition persist until the next contract.
    const legacy=state?.version===1&&state?.offers?.length===4;
    const current=state?.version===COUNTER_VERSION&&state?.offers?.length===COUNTER_SIZE;
    if((!legacy&&!current)||state.cycle!==cycle||!Array.isArray(state.offers)) return false;
    const ids=new Set();
    return state.offers.every(offer=>{
        if(!offer||offer.id!==offer.serial||ids.has(offer.serial)||!BY_ID.has(offer.definitionId)||
            typeof offer.sold!=='boolean'||!Number.isSafeInteger(offer.price)||offer.price<10||
            !Number.isFinite(offer.condition)||offer.condition<0||offer.condition>1||
            !Number.isFinite(offer.wear)||offer.wear<0||offer.wear>1||
            !Number.isSafeInteger(offer.repairs)||offer.repairs<0) return false;
        ids.add(offer.serial);return true;
    });
}
export function storeCounter(storage,state) {
    if(!storage)return false;
    try { storage.setItem(COUNTER_KEY,JSON.stringify(state)); return true; }
    catch {return false;}
}
export function loadCounter(storage,cycle=0) {
    const number=Number.isSafeInteger(cycle)&&cycle>=0?cycle:0;
    if(!storage)return {stock:generateCounterStock(number),persisted:false};
    try {
        const parsed=JSON.parse(storage.getItem(COUNTER_KEY)??'null');
        if(validStock(parsed,number))return {stock:parsed,persisted:true};
    } catch { /* first arrival or damaged sidecar */ }
    const fresh=generateCounterStock(number);
    return {stock:fresh,persisted:storeCounter(storage,fresh)};
}
export function counterLot(stock,serial) {
    return stock?.offers?.find(offer=>offer.serial===serial)??null;
}
export function buyCounterLot(storage,cycle,serial,machine) {
    if(!storage||!machine?.assembly?.owned||!Number.isSafeInteger(machine?.economy?.credits))
        return {ok:false,reason:'COUNTER OR MACHINE SAVE UNAVAILABLE'};
    const loaded=loadCounter(storage,cycle);
    if(!loaded.persisted)return {ok:false,reason:'COUNTER STOCK COULD NOT BE SAVED'};
    const lot=counterLot(loaded.stock,serial);
    if(!lot||lot.sold)return {ok:false,reason:'SOLD OUT · WAIT FOR NEXT CONTRACT'};
    if(machine.assembly.owned.some(part=>part.serial===serial))
        return {ok:false,reason:'SERIAL ALREADY OWNED'};
    if(machine.economy.credits<lot.price)return {ok:false,reason:'INSUFFICIENT CREDITS'};
    const previous=loadMachine(storage);
    const part={serial:lot.serial,definitionId:lot.definitionId,condition:lot.condition,
        wear:lot.wear,repairs:lot.repairs,destroyed:false};
    machine.assembly.owned.push(part);
    machine.economy.credits-=lot.price;
    // Commit machine first. If the listing transaction fails, restore the
    // old machine state and in-memory authority rather than duplicating an item.
    if(!storeMachine(storage,machine)){
        machine.assembly.owned.pop();machine.economy.credits+=lot.price;
        return {ok:false,reason:'MACHINE SAVE FAILED · NOTHING PURCHASED'};
    }
    lot.sold=true;
    if(!storeCounter(storage,loaded.stock)){
        lot.sold=false;machine.assembly.owned.pop();machine.economy.credits+=lot.price;
        storeMachine(storage,previous);
        return {ok:false,reason:'VENDOR SAVE FAILED · PURCHASE REVERSED'};
    }
    return {ok:true,part,price:lot.price,credits:machine.economy.credits};
}
