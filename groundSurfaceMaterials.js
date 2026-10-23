/** A.7: explicitly bounded ground materials. No per-triangle terrain solver;
 * a few static, non-colliding rectangles provide deterministic sample data.
 * Current live campaign still has concrete-only traction: opt in via lab.
 */
export const GROUND_MATERIALS=Object.freeze({
 concrete:Object.freeze({id:'concrete',label:'CONCRETE',grip:1,impact:.92,color:0x6c685d}),
 dirt:Object.freeze({id:'dirt',label:'LOOSE DIRT',grip:.72,impact:.74,color:0x674b34}),
 gravel:Object.freeze({id:'gravel',label:'SHIFTING GRAVEL',grip:.56,impact:.84,color:0x50524e}),
 metal:Object.freeze({id:'metal',label:'STEEL DECK',grip:.92,impact:1.2,color:0x4d6b67}),
});
export const PILOTING_GROUND_PATCHES=Object.freeze([
 Object.freeze({id:'dirt-yard',surface:'dirt',minX:-19,maxX:-6,minZ:8,maxZ:24}),
 Object.freeze({id:'gravel-lane',surface:'gravel',minX:6,maxX:20,minZ:5,maxZ:22}),
 Object.freeze({id:'steel-pad',surface:'metal',minX:7,maxX:19,minZ:-23,maxZ:-12}),
]);
export function groundMaterialAt(x,z,patches=PILOTING_GROUND_PATCHES){
 const px=Number(x)||0,pz=Number(z)||0;
 for(let i=patches.length-1;i>=0;i--){
   const r=patches[i];
   if(px>=r.minX&&px<=r.maxX&&pz>=r.minZ&&pz<=r.maxZ)
     return GROUND_MATERIALS[r.surface]??GROUND_MATERIALS.concrete;
 }
 return GROUND_MATERIALS.concrete;
}
export function groundGripScale(surface){
 const n=typeof surface==='string'?GROUND_MATERIALS[surface]?.grip:surface?.grip;
 return Math.max(.35,Math.min(1.15,Number.isFinite(n)?n:1));
}
