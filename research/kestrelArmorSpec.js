/** Kestrel V3 armor intent / pure design data. Lab-only and no saved game parts.
 * 3 anatomy-specific fittings, NOT scaled copies of Yardwalker plates.
 */
export const ARMOR_LEVELS=Object.freeze([
 Object.freeze({tier:0,name:'NAKED',description:'The untouched exposed runner; no armor meshes',count:0}),
 Object.freeze({tier:1,name:'LIGHT',description:'Narrow fitted front strike plates on thigh and shin',count:4}),
 Object.freeze({tier:2,name:'HEAVY',description:'Front and outer-side protection on each link, plus small hip brows',count:10}),
 Object.freeze({tier:3,name:'ENCASED',description:'Swept upper fairings, armored shins and optional instep protection',count:0})
]);
export const ENCASED_FORMS=Object.freeze([
 Object.freeze({id:'swept',name:'SWEPT FAIRING',description:'Broad hip, tapered birdlike hock exit'}),
 Object.freeze({id:'pod',name:'THIGH POD',description:'Beveled, utilitarian industrial housing'}),
 Object.freeze({id:'split',name:'SPLIT SHELL',description:'Two separated protective halves leave a machine spine visible'})
]);
export const ARMOR_ZONES=Object.freeze(['hip','thigh','shin','foot']);
const byId=Object.freeze({
 raptor:Object.freeze({front:.73,heavy:.83,flare:1,hip:.88,shin:.76,splitGap:.17}),
 field:Object.freeze({front:.83,heavy:.92,flare:1.10,hip:1.04,shin:.88,splitGap:.14}),
 perch:Object.freeze({front:.70,heavy:.80,flare:.77,hip:.78,shin:.73,splitGap:.19})
});
export const ARMOR_ANATOMY=byId;
export function normalizeArmorSettings(raw={}){
 const tier=Math.max(0,Math.min(3,Math.round(Number(raw.tier)||0)));
 const form=ENCASED_FORMS.some(x=>x.id===raw.form)?raw.form:'swept';
 return {tier,form,boot:raw.boot!==false};
}
export function armorRecipe(id,raw={}){
 const anatomy=byId[id];
 if(!anatomy)throw Error('Unknown Kestrel armor anatomy '+id);
 const settings=normalizeArmorSettings(raw);
 const {tier,form,boot}=settings;
 const zones=ARMOR_ZONES;
 const parts=[];
 if(tier===0)return {id,...settings,anatomy,parts};
 for(const side of [-1,1]){
  const leg=side<0?'L':'R';
  if(tier===3){
   const pieces=form==='split'?2:1;
   for(let i=0;i<pieces;i++)
    parts.push({name:leg+'/thigh '+(form==='split'?'split cheek '+i:form+' fairing'),
     zone:'thigh',role:'shell',side,form,piece:i});
  }else{
   parts.push({name:leg+'/thigh front strike',zone:'thigh',role:'front',side});
   if(tier>=2)parts.push({name:leg+'/thigh outer cheek',zone:'thigh',role:'side',side});
  }
  parts.push({name:leg+'/shin front strike',zone:'shin',role:'front',side});
  if(tier>=2)parts.push({name:leg+'/shin outer cheek',zone:'shin',role:'side',side});
  if(tier>=2)parts.push({name:leg+'/hip brow',zone:'hip',role:'brow',side});
  if(tier===3&&boot)parts.push({name:leg+'/instep shield',zone:'foot',role:'instep',side});
 }
 return {id,...settings,anatomy,parts,zones};
}
