/** Chunky, physically mounted equipment. Every hit-capable mesh is owned by a
 * PRIMARY station (structure or combat), so equipment never adds knockout counts.
 * Utility shells are protective steel; clouds/projectiles are separate world FX.
 */
import * as THREE from 'three';
import { equipmentMounts } from './equipment.js';
import { buildPartVisual } from './partVisuals.js';
const mat=(color,metalness=.62)=>new THREE.MeshStandardMaterial({color,roughness:.78,metalness});
const STEEL=0x424745,BLACK=0x292d2b,RUST=0x805133,YELLOW=0xb38a3a,TEAL=0x387c7c;
export function addEquipmentVisuals(assembly,hull,partMeshes,pickMeshes,combatGroup=null) {
  if(!hull)return;
  const eq=equipmentMounts(assembly);
  const addGroup=(name,x,y,z,slot='structure')=>{
    const group=new THREE.Group();group.name='equipment:'+name;group.position.set(x,y,z);
    (slot==='combat'&&combatGroup?combatGroup:hull).add(group);
    const add=(geometry,color,px,py,pz,angles=null)=>{
      const mesh=new THREE.Mesh(geometry,mat(color));
      mesh.position.set(px,py,pz);
      if(angles)mesh.rotation.set(...angles);
      mesh.castShadow=true;mesh.receiveShadow=true;mesh.userData.slot=slot;
      mesh.userData.equipmentId=name;
      group.add(mesh);pickMeshes.push(mesh);partMeshes.get(slot)?.push(mesh);
      return mesh;
    };
    const box=(w,h,d,c,x=0,y=0,z=0,a)=>add(new THREE.BoxGeometry(w,h,d),c,x,y,z,a);
    const cyl=(r,h,c,x=0,y=0,z=0,axis='y')=>add(new THREE.CylinderGeometry(r,r,h,8),c,x,y,z,
      axis==='z'?[Math.PI/2,0,0]:axis==='x'?[0,0,Math.PI/2]:null);
    return {group,box,cyl};
  };
  for(const [i,mount] of ['utilityLeft','utilityRight'].entries()){
    const id=eq[mount];if(!id)continue;
    const s=i===0?-1:1;
    // Mounted on the left/right external frame rail; avoid leg articulation.
    const a=addGroup(id,s*.77,-.03,.65);
    a.box(.48,.12,.78,STEEL,0,-.12,0);
    if(id==='cinder-smoke'){
      a.box(.40,.30,.58,RUST,0,.10,0);
      for(const z of [-.17,.16]){
        a.cyl(.11,.45,BLACK,0,.25,z,'z');
        a.box(.15,.04,.16,YELLOW,0,.47,z);
      }
    } else if(id==='mule-pump'){
      a.box(.39,.36,.53,TEAL,0,.07,0);
      a.cyl(.18,.22,BLACK,0,.31,.08,'x');
      a.cyl(.075,.45,RUST,s*.08,.24,-.18,'y');
      a.box(.24,.1,.48,STEEL,0,-.03,-.37);
    } else if(id==='ox-jack'){
      a.box(.38,.34,.62,YELLOW,0,.09,0);
      for(const z of [-.22,.22]){
        a.cyl(.085,.62,STEEL,s*.19,-.34,z);
        a.box(.38,.10,.40,BLACK,s*.19,-.69,z);
      }
    }
  }
  if(eq.armorFront==='boarhide'){
    // Far-forward plates intercept frontal rays before they strike the pilot
    // or thin inner housings. Lateral attacks can go around this physical plate.
    const a=addGroup('boarhide',0,.21,-1.01);
    a.box(1.52,.79,.14,STEEL,0,.11,0,[-.22,0,0]);
    a.box(1.33,.10,.16,YELLOW,0,.43,-.08);
    for(const x of [-.64,-.32,.32,.64]){
      a.box(.09,.71,.05,RUST,x,.13,-.09);
    }
    for(const x of [-.57,.57])a.box(.19,.47,.34,BLACK,x,-.13,.14);
  }
  if(eq.combatCradle==='twin-spar'){
    const a=addGroup('twin-spar',-2.08,0,.07,'combat');
    a.box(1.76,.19,.62,STEEL,.75,-.08,.12);
    for(const x of [-.16,1.67]){
      a.cyl(.19,.13,RUST,x,0,.03,'z');
      a.box(.20,.22,.35,BLACK,x,-.04,-.15);
    }
    if(eq.secondaryWeapon){
      const weapon=buildPartVisual(eq.secondaryWeapon,{mode:'gameplay'});
      if(weapon){
        weapon.position.set(-.08,.02,-.13);
        a.group.add(weapon);
        weapon.traverse(mesh=>{
          if(!mesh.isMesh||mesh.userData.visualOnly)return;
          mesh.userData.slot='combat';mesh.userData.equipmentId='secondaryWeapon';
          mesh.castShadow=true;mesh.receiveShadow=true;
          pickMeshes.push(mesh);partMeshes.get('combat')?.push(mesh);
        });
      }
    }
  }
}
