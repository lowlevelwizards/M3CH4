/** node research/exportYardwalkerDesign.mjs [--check] */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(fileURLToPath(new URL('..',import.meta.url)));
const read=p=>readFileSync(resolve(root,p),'utf8');
const canonical=JSON.parse(read('yardwalker-design/master.json'));
const moduleString='/** Generated from yardwalker-design/master.json; do not edit by hand. */\n'+
 'export const YARDWALKER_DESIGN = Object.freeze('+JSON.stringify(canonical)+');\n';
const mod=resolve(root,'yardwalkerDesignData.js');
const checking=process.argv.includes('--check');
if(checking){
 if(readFileSync(mod,'utf8')!==moduleString)throw Error('Stale runtime Yardwalker design module');
}else writeFileSync(mod,moduleString,'utf8');
const {makeYardwalkerWorkbenchAsset,assertYardwalkerDesign,
 YARDWALKER_TIERS}=await import('../yardwalkerWorkbenchExport.js');
assertYardwalkerDesign();
const target=resolve(root,'workbench-assets/yardwalker');
mkdirSync(target,{recursive:true});
for(let tier=0;tier<4;tier++){
 const filepath=resolve(target,'yardwalker-0'+tier+'-'+YARDWALKER_TIERS[tier]+'.asset.json');
 const content=JSON.stringify(makeYardwalkerWorkbenchAsset(tier),null,2)+'\n';
 if(checking){
  if(readFileSync(filepath,'utf8')!==content)throw Error('Stale Workbench asset: '+filepath);
 }else writeFileSync(filepath,content,'utf8');
 console.log((checking?'CHECK':'WRITE')+' yardwalker '+tier+' '+YARDWALKER_TIERS[tier]);
}
