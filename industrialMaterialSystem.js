/** Industrial pixel surface finish — one MeshStandardMaterial draw per original mesh.
 * No unique serial textures or overlay meshes. Paint remains from partFinish.js;
 * this alters only visible PBR material, never stored paint or combat state.
 */
import {appearanceForPart,appearanceForSurface} from './partAppearance.js';
import {assignPartSurfaces} from './partSurfaceRegistry.js';

const FRAGMENT_DECLARATIONS=`
uniform float artSeed;
uniform float artPainted;
uniform float artAbrasion;
uniform float artGrime;
uniform float artOxidation;
uniform float artHeat;
varying vec3 vArtPosition;
float artHash3(vec3 p) {
  p=fract(p*.1031);
  p+=dot(p,p.yzx+33.33);
  return fract((p.x+p.y)*p.z);
}
`;
const FRAGMENT_COATING=`
#include <color_fragment>
vec3 artCoord=vArtPosition+vec3(artSeed*1.19,artSeed*.67,artSeed*.37);
float artPatch=artHash3(floor(artCoord*8.0));
float artFleck=artHash3(floor(artCoord*28.0)+vec3(11.0,7.0,19.0));
float artStreak=artHash3(vec3(floor(artCoord.x*12.0),
                            floor(artCoord.y*4.0),floor(artCoord.z*12.0)));
float artEdge=max(max(abs(fract(artCoord.x*1.8)-.5),
                      abs(fract(artCoord.y*1.8)-.5)),
                      abs(fract(artCoord.z*1.8)-.5))*2.0;
float artChip=artPainted*step(.88-artAbrasion*.25,artPatch)*
    step(.36,artFleck)*(.55+.45*step(.83,artEdge));
float artScratch=step(.986-artAbrasion*.065,artFleck)*
    step(.40,artStreak);
float artOil=step(.89-artGrime*.22,artPatch)*
    (.4+.6*step(.38,artStreak));
float artRust=step(.97-artOxidation*.23,artStreak)*
    step(.28,artFleck)*(1.0-artHeat*.32);
float artSoot=artHeat*step(.67,artPatch)*(.4+.6*artFleck);
vec3 artSteel=vec3(.20,.24,.23);
vec3 artPrimer=vec3(.28,.22,.17);
float artBare=artChip*step(.66,artFleck);
diffuseColor.rgb=mix(diffuseColor.rgb,artPrimer,artChip*.86);
diffuseColor.rgb=mix(diffuseColor.rgb,artSteel,artBare*.90);
diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.09,.105,.10),artOil*artGrime*.38);
diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.28,.075,.029),artRust*artOxidation*.58*
    (1.0-artPainted+artChip));
diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.085,.082,.078),artSoot*.31);
diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.48,.49,.42),artScratch*artAbrasion*.32);
`;
export function installIndustrialShader(material,visual) {
  if(!material?.isMeshStandardMaterial)return material;
  const uniforms={
    artSeed:{value:(visual.seed%100000)/100000},
    artPainted:{value:visual.painted},
    artAbrasion:{value:visual.abrasion},
    artGrime:{value:visual.grime},
    artOxidation:{value:visual.oxidation},
    artHeat:{value:visual.heat},
  };
  material.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,uniforms);
    shader.vertexShader=shader.vertexShader
      .replace('#include <common>','#include <common>\nvarying vec3 vArtPosition;')
      .replace('#include <begin_vertex>',
        '#include <begin_vertex>\nvArtPosition=position;');
    shader.fragmentShader=shader.fragmentShader
      .replace('#include <common>',
        '#include <common>\n'+FRAGMENT_DECLARATIONS)
      .replace('#include <color_fragment>',FRAGMENT_COATING)
      .replace('#include <metalnessmap_fragment>',
        '#include <metalnessmap_fragment>\nmetalnessFactor=mix(metalnessFactor,.54,artBare*.7);')
      .replace('#include <roughnessmap_fragment>',
        '#include <roughnessmap_fragment>\nroughnessFactor=clamp(roughnessFactor+artOil*artGrime*.10-artScratch*.06,.12,1.0);');
  };
  material.customProgramCacheKey=()=> 'm3ch4-industrial-pixel-v1';
  material.userData={...material.userData,industrialFinish:true};
  material.needsUpdate=true;
  return material;
}

/** Call after applyPartFinish; preserves painted pigment and original meshes. */
export function applyIndustrialFinish(root,part,history=null) {
  if(!root||!part)return root;
  assignPartSurfaces(root,part.definitionId,part.slot||'');
  const state=appearanceForPart(part,history);
  root.userData.appearance={serial:state.serial,seed:state.seed,
    condition:Number.isFinite(part.condition)?part.condition:null,
    repairs:Number.isSafeInteger(part.repairs)?part.repairs:0};
  root.traverse(node=>{
    if(!node.isMesh)return;
    const surface=node.userData.surface;
    if(surface?.role==='optical')return;
    const visual=appearanceForSurface(state,surface);
    const mapMaterial=m=>{
      if(!m?.isMeshStandardMaterial)return m;
      const copy=m.clone();
      return installIndustrialShader(copy,visual);
    };
    node.material=Array.isArray(node.material)?
      node.material.map(mapMaterial):mapMaterial(node.material);
  });
  return root;
}
