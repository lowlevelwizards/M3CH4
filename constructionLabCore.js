/** Standalone laboratory state. Reuses production parts, serials and graph validation.
 * No DOM, Three.js, savegame or campaign dependencies. The lab never mutates
 * the main game's persistent machine and never claims arbitrary socket editing.
 */
import {
  SLOTS, BY_ID, makeTestAssembly, equip, inspectAssembly, assemblyGraph,
  setGeneratorMount, generatorMount, validateGraph
} from './components.js';

export const LAB_BLUEPRINT_VERSION=1;
export const LAB_SLOTS=Object.freeze([...SLOTS]);
export const LAB_PARTS=Object.freeze([...BY_ID.values()]);
export const DEFAULT_LAB_SELECTION=Object.freeze({slot:'structure',tab:'catalog'});

export function createLabMachine(){return makeTestAssembly();}

export function labInspection(assembly){
  const graph=assemblyGraph(assembly);
  const graphCheck=validateGraph(graph,assembly,BY_ID);
  const machineCheck=inspectAssembly(assembly);
  return {graph,graphCheck,machineCheck,valid:graphCheck.valid,ready:machineCheck.ready};
}

/** Stage 02–05: slot swaps remain transactions through existing production rules.
 * Later bespoke construction code will use proposeAttachment on generic child nodes.
 */
export function labEquip(assembly,slot,definitionId){
  if(!LAB_SLOTS.includes(slot)) return {ok:false,reason:'Unknown station.'};
  const def=BY_ID.get(definitionId);
  if(!def || def.slot!==slot) return {ok:false,reason:'Part cannot occupy this station.'};
  const prior=generatorMount(assembly);
  // Snapshot must precede *all* mutations, including moving the outrigger.
  const snapshot=structuredClone(assembly);
  try {
    if(prior==='offset') {
      const reset=setGeneratorMount(assembly,'standard');
      if(!reset.ok) throw new Error(reset.reason);
    }
    equip(assembly,slot,definitionId);
    const verdict=labInspection(assembly);
    if(!verdict.valid) throw new Error(verdict.graphCheck.errors.join(' '));
    if(prior==='offset' && slot!=='power') {
      const restore=setGeneratorMount(assembly,'offset');
      if(!restore.ok) throw new Error(restore.reason);
    }
    return {ok:true,assembly};
  }catch(error){
    Object.keys(assembly).forEach(key=>delete assembly[key]);
    Object.assign(assembly,snapshot);
    return {ok:false,reason:error.message};
  }
}
export function labSetGeneratorMount(assembly,position){
  if(!['standard','offset'].includes(position))return {ok:false,reason:'Unknown generator mount.'};
  return setGeneratorMount(assembly,position);
}
export function labBlueprint(assembly){
  const inspection=labInspection(assembly);
  if(!inspection.valid)throw new Error('Invalid assembly graph cannot be exported.');
  const stations={};
  for(const slot of LAB_SLOTS) {
    const part=assembly.owned.find(p=>p.serial===assembly.installed[slot]);
    stations[slot]=part?.definitionId || null;
  }
  return {format:'m3ch4-construction-lab',version:LAB_BLUEPRINT_VERSION,
    stations,generatorMount:generatorMount(assembly)};
}
export function loadLabBlueprint(input){
  if(!input||input.format!=='m3ch4-construction-lab'||input.version!==LAB_BLUEPRINT_VERSION
    ||!input.stations||typeof input.stations!=='object'
    ||Object.keys(input.stations).some(k=>!LAB_SLOTS.includes(k)))
      throw new Error('Unsupported or invalid lab blueprint.');
  const machine=createLabMachine();
  // Fixed stage 1–5 format: all five stations are required.
  for(const slot of LAB_SLOTS){
    if(typeof input.stations[slot]!=='string')
      throw new Error('Blueprint must declare all five current stations.');
    const r=labEquip(machine,slot,input.stations[slot]);
    if(!r.ok)throw new Error(r.reason);
  }
  if(input.generatorMount==='offset'){
    const r=labSetGeneratorMount(machine,'offset');
    if(!r.ok)throw new Error(r.reason);
  }else if(input.generatorMount!=='standard')
    throw new Error('Unsupported generator mount.');
  const result=labInspection(machine);
  if(!result.valid)throw new Error(result.graphCheck.errors.join(' '));
  return machine;
}
export function labNodeList(assembly){
  const graph=assemblyGraph(assembly);
  const output=[];
  const seen=new Set();
  function visit(serial,depth){
    if(seen.has(serial))return;
    const node=graph.nodes[serial];
    if(!node)return;
    seen.add(serial);
    const def=BY_ID.get(node.definitionId);
    output.push({serial,definitionId:node.definitionId,
      name:def?.name || (node.definitionId==='hip-h2-u1'?'H2/U1 hip conversion ring':'Generator offset bracket'),
      parentSerial:node.parentSerial,parentSocket:node.parentSocket,
      virtual:!!node.virtual,depth});
    Object.values(graph.nodes).filter(n=>n.parentSerial===serial)
      .forEach(child=>visit(child.serial,depth+1));
  }
  if(graph.root)visit(graph.root,0);
  return output;
}
