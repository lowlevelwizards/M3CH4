/** Grouped semantic loft controls. Apply each affected section exactly once. */
import {clone,validateGeometry} from './blueprint.js';
export function moveLoftControls(geometry,selection,{delta=[0,0,0]}={}){
 if(geometry?.type!=='loft')throw Error('Expected a sectioned loft');
 if(!Array.isArray(delta)||delta.length!==3||delta.some(v=>!Number.isFinite(v)))throw Error('Invalid loft displacement');
 const next=clone(geometry),affected=new Map();
 for(const {index,kind} of selection){
  if(!Number.isInteger(index)||index<0||index>=next.sections.length)throw Error('Invalid loft control');
  if(!['front','back','width','topWidth','topBack'].includes(kind))throw Error('Invalid loft handle');
  const item=affected.get(index)||new Set();item.add(kind);affected.set(index,item);
 }
 for(const [index,types] of affected){
  const p=next.sections[index],base=geometry.sections[index];
  p.y=Number((base.y+delta[1]).toFixed(5));
  if(types.has('width')||types.has('topWidth'))p.width=Number((base.width-2*delta[0]).toFixed(5));
  if(types.has('front'))p.front=Number((base.front+delta[2]).toFixed(5));
  if(types.has('back')||types.has('topBack'))p.back=Number((base.back+delta[2]).toFixed(5));
 }
 return validateGeometry(next);
}
