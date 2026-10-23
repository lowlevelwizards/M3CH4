/** Stable industrial maker/model graphics. Design vocabulary uses the exact
 * catalogue definition ID, never a guessed maker from the player's paint.
 * A model's graphic is shared by every serialized unit of that definition;
 * individual patina, paint, scars and repairs remain uniquely serialized.
 */
const makers=Object.freeze({
 frame:'SALVAGE WORKS',
 legs:'YARD MACHINE',
 power:'DYNAMO DIV.',
 cab:'FIELD OPTICS',
 gun:'RIG ARMAMENT',
});
const family=Object.freeze({
 'legs-yard':'YW / YARDWALKER',
 'legs-compact':'YW / KESTREL',
 'legs-hauler':'YW / HAULER H2',
 'frame-sr':'SW / BRUISER',
 'frame-utility':'SW / SKELETON',
 'frame-wedge':'SW / WEDGE',
 'power-dynamo':'DD / G2 DYNAMO',
 'power-air':'DD / DRAFT A1',
 'power-forge':'DD / FORGE H4',
 'cab-cyclops':'FO / CYCLOPS',
 'cab-armored':'FO / HEARTH',
 'cab-utility':'FO / VISTA',
});
export function factoryGraphic(definitionId){
 if(typeof definitionId!=='string'||!/^(frame|legs|power|cab|gun)-[a-z0-9-]{1,50}$/.test(definitionId))
   return null;
 const prefix=definitionId.split('-')[0];
 return Object.freeze({
   maker:makers[prefix],
   model:family[definitionId]||definitionId.toUpperCase().replaceAll('-',' / ').slice(0,24),
   // Pilot identity and serial history are NOT encoded in factory model art.
   type:'FACTORY MODEL / EQUIPMENT',
 });
}
