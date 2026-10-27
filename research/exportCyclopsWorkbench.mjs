/** Rebuild all 4 editable Cyclops Workbench assets from cyclopsDesign.js.
 * Run: node research/exportCyclopsWorkbench.mjs [--check]
 */
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {makeCyclopsWorkbenchAsset,assertCyclopsDesignConsistency,
 CYCLOPS_VARIANT_NAMES} from '../cyclopsWorkbenchExport.js';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const directory=resolve(root,'workbench-assets/cyclops');
mkdirSync(directory,{recursive:true});
assertCyclopsDesignConsistency();
for(let tier=0;tier<4;tier++){
 const path=resolve(directory,'cyclops-0'+tier+'-'+CYCLOPS_VARIANT_NAMES[tier]+'.asset.json');
 const content=JSON.stringify(makeCyclopsWorkbenchAsset(tier),null,2)+'\n';
 if(process.argv.includes('--check')){
  if(readFileSync(path,'utf8')!==content)throw Error('Stale Cyclops JSON asset: '+path);
 }else writeFileSync(path,content,'utf8');
 console.log((process.argv.includes('--check')?'CHECK':'WRITE')+' '+path);
}
