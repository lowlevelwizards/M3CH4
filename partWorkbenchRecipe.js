/**
 * Part Workbench v1: bounded, versioned, mechanically neutral Yardwalker calf
 * shell. This is visual geometry only: no catalogue, socket, IK, or stats data.
 * Pure functions: safe to run in node tests without Three/WebGL.
 */
export const CALF_RECIPE_ID = 'legs-yard/calf-shell';
export const CALF_RECIPE_VERSION = 1;
export const CALF_STATIONS = Object.freeze([0, .25, .5, .75, 1]);
export const CALF_LIMITS = Object.freeze({
  width: [.10, .39],
  front: [-.16, -.035],
  back: [.035, .16],
});
export const DEFAULT_CALF_RECIPE = Object.freeze({
  version: CALF_RECIPE_VERSION,
  id: CALF_RECIPE_ID,
  stations: Object.freeze([
    Object.freeze({width:.29, front:-.085, back:.085}),
    Object.freeze({width:.33, front:-.102, back:.097}),
    Object.freeze({width:.285, front:-.101, back:.091}),
    Object.freeze({width:.225, front:-.077, back:.075}),
    Object.freeze({width:.155, front:-.066, back:.066}),
  ]),
});
const fields = ['width','front','back'];
export const copyCalfRecipe = recipe => ({
  version:recipe.version, id:recipe.id,
  stations:recipe.stations.map(s=>({width:s.width,front:s.front,back:s.back})),
});
const finite = value => typeof value === 'number' && Number.isFinite(value);
export function validateCalfRecipe(input) {
  if (!input || typeof input !== 'object' ||
      input.version !== CALF_RECIPE_VERSION || input.id !== CALF_RECIPE_ID ||
      !Array.isArray(input.stations) || input.stations.length !== CALF_STATIONS.length)
    throw new Error('Not a supported Yardwalker calf recipe (v1).');
  const result = copyCalfRecipe(input);
  for (const [index,station] of result.stations.entries()) {
    for (const field of fields) {
      const value=station[field], [min,max]=CALF_LIMITS[field];
      if (!finite(value) || value < min || value > max)
        throw new Error('Station '+(index+1)+' has invalid '+field+'.');
    }
    if (station.back-station.front < .075)
      throw new Error('Station '+(index+1)+' is too thin.');
  }
  return result;
}
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function editCalfStation(input,index,field,value) {
  const result=validateCalfRecipe(input);
  if (!Number.isInteger(index)||index<0||index>=CALF_STATIONS.length||!fields.includes(field)||!finite(value))
    throw new Error('Invalid profile edit.');
  let [min,max]=CALF_LIMITS[field];
  const station=result.stations[index];
  if(field==='front')max=Math.min(max,station.back-.075);
  if(field==='back')min=Math.max(min,station.front+.075);
  station[field]=Number(clamp(value,min,max).toFixed(4));
  return result;
}
/**
 * Four-corner profile rings along a fixed knee-to-ankle casing axis.
 * The two editable orthographic contours share the same station heights.
 * Corners connect to adjacent corners; only the shell changes.
 * Vertex winding points outward even with Three's default FRONT side.
 */
export function calfMeshData(input,length) {
  const recipe=validateCalfRecipe(input);
  if (!finite(length)||length<=.10||length>=1.5)
    throw new Error('Invalid calf shell length.');
  const vertices=[],indices=[];
  for (let i=0;i<CALF_STATIONS.length;i++) {
    const {width,front,back}=recipe.stations[i], y=CALF_STATIONS[i]*length;
    vertices.push(-width/2,y,front, width/2,y,front,
                   width/2,y,back, -width/2,y,back);
  }
  for(let i=0;i<CALF_STATIONS.length-1;i++){
    const a=4*i,b=a+4;
    for(let j=0;j<4;j++){
      const next=(j+1)%4;
      indices.push(a+j,b+next,a+next, a+j,b+j,b+next);
    }
  }
  indices.push(0,1,2,0,2,3);
  const last=4*(CALF_STATIONS.length-1);
  indices.push(last,last+2,last+1,last,last+3,last+2);
  return {vertices,indices};
}
