/** k.4a | Fixed physical surface roles for non-mobility parts.
 * Default color is not physical identity. Gameplay owns cloned instances.
 * The existing three mobility families deliberately do not import this file.
 */
import * as THREE from 'three';
export const MATERIAL_ROLES=Object.freeze({
  STRUCTURE:'structure',PRIMARY_PAINT:'primary-paint',
  SECONDARY_PAINT:'secondary-paint',PROTECTIVE_PAINT:'protective-paint',
  MACHINED:'machined',DARK_MECHANISM:'dark-mechanism',
  OPTICAL:'optical',ACCENT:'accent',
});
// key => [color, roughness, metalness, physical role]
const SPEC=Object.freeze({
  structure:[0x363f41,.78,.31,'structure'],
  loadSteel:[0x41494a,.78,.34,'structure'],
  machined:[0x7b827b,.65,.47,'machined'],
  rawSteel:[0x68736e,.72,.42,'machined'],
  darkMechanism:[0x171c1c,.93,.14,'dark-mechanism'],
  heatSteel:[0x292e2f,.85,.38,'dark-mechanism'],
  mustard:[0xb28a39,.84,.15,'primary-paint'],
  wornMustard:[0xa7813a,.89,.13,'primary-paint'],
  teal:[0x417f81,.85,.14,'secondary-paint'],
  cream:[0xd0c6ad,.88,.12,'protective-paint'],
  olive:[0x78866b,.87,.18,'protective-paint'],
  oxide:[0x9a5136,.90,.13,'accent'],
  glazing:[0x182b2e,.52,.07,'optical'],
  optic:[0x3f898c,.48,.19,'optical'],
  opticalRecess:[0x121d1e,.90,.10,'optical'],
  mechanicalRecess:[0x121d1e,.90,.10,'dark-mechanism'],
});
export const PART_MATERIALS=Object.freeze(Object.fromEntries(
  Object.entries(SPEC).map(([key,[hex,roughness,metalness,role]])=>{
    const material=new THREE.MeshStandardMaterial({color:hex,roughness,metalness,flatShading:true});
    material.name='M3CH4:'+key;
    material.userData.materialRole=role;
    return [key,material];
  })
));
export function partMaterial(key){
  const material=PART_MATERIALS[key];
  if(!material)throw Error('Unknown industrial material: '+key);
  return material;
}
export const materialRoleOf=material=>material?.userData?.materialRole??null;
