/** Edit session boundaries; previews may be mutated, but never saved without commit. */
import {clone,validateDocument} from './blueprint.js';
export function createEditTransaction(initial,label='Edit'){
 const original=validateDocument(initial);
 let working=clone(original),status='active';
 const active=()=>{if(status!=='active')throw Error('Editing transaction already '+status);};
 return {
  label,
  get status(){return status;},
  get original(){return clone(original);},
  get preview(){return clone(working);},
  update(next){active();working=clone(next);return this.preview;},
  commit(){active();const valid=validateDocument(working);status='committed';return valid;},
  cancel(){active();status='cancelled';return clone(original);}
 };
}
