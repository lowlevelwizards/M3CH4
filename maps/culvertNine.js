/** Two parallel roads, three broad crossings; actual collider geometry. */
export const CULVERT_NINE=Object.freeze({
 id:'culvert-nine',name:'CULVERT NINE',version:1,theme:'concrete',
 world:{minX:-39,maxX:39,minZ:-26,maxZ:26,obstacles:[
 // Concrete drain walls. Gaps at x about -25, 0, +25 are ACTUAL openings.
 {id:'sluice-west-end',minX:-39,maxX:-32,minZ:-2.1,maxZ:2.1,height:3.3,kind:'barrier'},
 {id:'sluice-west-middle',minX:-18.2,maxX:-7.1,minZ:-2.1,maxZ:2.1,height:3.3,kind:'barrier'},
 {id:'sluice-east-middle',minX:7.1,maxX:18.2,minZ:-2.1,maxZ:2.1,height:3.3,kind:'barrier'},
 {id:'sluice-east-end',minX:32,maxX:39,minZ:-2.1,maxZ:2.1,height:3.3,kind:'barrier'},
 {id:'north-pump-house',minX:-4.2,maxX:4.2,minZ:-13.8,maxZ:-9.0,height:4.8,kind:'building'},
 {id:'south-filter',minX:10,maxX:17,minZ:11,maxZ:14.5,height:3.1,kind:'building'},
 {id:'n-valve-west',minX:-33,maxX:-29,minZ:-16,maxZ:-11.5,height:2.8,kind:'container'},
 {id:'n-valve-east',minX:26.8,maxX:31.3,minZ:-17,maxZ:-12.4,height:3.0,kind:'container'},
 {id:'s-generator-west',minX:-31.8,maxX:-27.0,minZ:11.2,maxZ:15.8,height:2.9,kind:'container'},
 {id:'s-pipes-east',minX:28,maxX:33,minZ:10,maxZ:14.2,height:2.9,kind:'container'},
 {id:'north-shield-west',minX:-23,maxX:-18.5,minZ:-17.7,maxZ:-16.2,height:1.6,kind:'barrier-low'},
 {id:'north-shield-east',minX:16,maxX:22,minZ:-17.7,maxZ:-16.2,height:1.8,kind:'barrier-low'},
 {id:'south-shield-west',minX:-19,maxX:-13.8,minZ:16,maxZ:17.9,height:1.6,kind:'barrier-low'},
 {id:'south-shield-east',minX:19,maxX:24.4,minZ:17.1,maxZ:18.6,height:1.8,kind:'barrier-low'},
 // Behind-edge supports, never new obstructions in passage lanes.
 ...[-34,34].flatMap(x=>[-22,22].map(z=>({
  id:'pillar-'+x+'-'+z,minX:x-.32,maxX:x+.32,minZ:z-.32,maxZ:z+.32,height:7.5,kind:'pillar',
 }))),
 ]},
 spawns:{
 friendly:[{x:0,z:21,yaw:0},{x:-8,z:21,yaw:0},{x:8,z:21,yaw:0}],
 hostile:[{x:0,z:-21,yaw:Math.PI},{x:-8,z:-21,yaw:Math.PI},{x:8,z:-21,yaw:Math.PI}],
 },
 sites:{
 recovery:{x:25,z:8},control:{x:-25,z:8},
 domination:[{id:'A',x:-25,z:-8},{id:'B',x:0,z:5.8},{id:'C',x:25,z:8}],
 breakthrough:{friendlyGoal:{x:0,z:-20},hostileGoal:{x:0,z:20}},
 },
});