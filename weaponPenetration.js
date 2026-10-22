/** k4w.2 — finite penetration through *observed, physically intersected* modules.
 * Never invent an inner hit: scene raycasts own ordering and hard cover stops.
 * Resistance comes from real slot construction and current plate condition.
 */
const resistance=Object.freeze({structure:63,mobility:48,power:38,command:42,combat:35});
export function resolvePenetratingContacts(contacts,{energy=135,damage=85,maxLayers=3,armorAt=()=>0}={}) {
    if(!Array.isArray(contacts)||!Number.isFinite(energy)||energy<=0) return [];
    let remaining=energy;
    const spent=new Set(),out=[];
    for(const contact of contacts) {
        if(out.length>=maxLayers || remaining<=0)break;
        if(!contact?.actorId || !contact.slot || contact.blockedBy)break;
        const id=contact.actorId+'/'+contact.slot;
        if(spent.has(id))continue;
        spent.add(id);
        const armor=Math.max(0,Number(armorAt(contact))||0);
        const entryEnergy=remaining;
        const thickness=(resistance[contact.slot]??55)+Math.min(75,armor*.15);
        out.push({contact,damage:Math.round(damage*Math.min(1,entryEnergy/energy)*100)/100,entryEnergy,exitEnergy:Math.max(0,entryEnergy-thickness)});
        remaining=Math.max(0,entryEnergy-thickness);
    }
    return out;
}
