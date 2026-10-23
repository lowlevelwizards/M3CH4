/** Linked packing floor, silo yard and loading dock. No false doors. */
export const GRAINHOUSE=Object.freeze({
 id:'grainhouse',name:'THE GRAINHOUSE',version:1,theme:'mill',
 world:{minX:-33,maxX:33,minZ:-28,maxZ:28,obstacles:[
 // West packing floor: substantial machinery, not dozens of tiny boxes.
 {id:'grain-separator',minX:-23,maxX:-15,minZ:-12,maxZ:-6,height:4.1,kind:'building'},
 {id:'feed-conveyor',minX:-20,maxX:-12,minZ:0,maxZ:3.3,height:2.65,kind:'container'},
 {id:'packing-press',minX:-9,maxX:-3.5,minZ:-6.4,maxZ:-2,height:3.6,kind:'building'},
 {id:'central-meal-hopper',minX:-2.1,maxX:2.1,minZ:-11.1,maxZ:-7.0,height:3.7,kind:'building'},
 // The east silo yard has two large hard-cover banks with broad gaps.
 {id:'silo-north',minX:13,maxX:22,minZ:-14.5,maxZ:-6,height:7,kind:'building'},
 {id:'silo-south',minX:14,maxX:23,minZ:3.8,maxZ:12,height:7,kind:'building'},
 {id:'silo-utility-bank',minX:7.5,maxX:10.5,minZ:-4.2,maxZ:-.9,height:2.9,kind:'container'},
  {id:'silo-service',minX:26,maxX:29.5,minZ:-3.5,maxZ:1.3,height:2.7,kind:'container'},
 // Structural partition has TWO actual openings: z=-9..-2 and z=6..13.
 {id:'mill-divider-top',minX:4.3,maxX:6.3,minZ:-24,maxZ:-12.3,height:5,kind:'barrier'},
 {id:'mill-divider-mid',minX:4.3,maxX:6.3,minZ:-1.7,maxZ:5.4,height:5,kind:'barrier'},
 {id:'mill-divider-bottom',minX:4.3,maxX:6.3,minZ:15,maxZ:20.2,height:5,kind:'barrier'},
 // The lower loading dock keeps three alternate access routes.
 {id:'dock-pallet-west',minX:-25,maxX:-20,minZ:15.5,maxZ:18,height:2.2,kind:'container'},
 {id:'dock-pallet-east',minX:22,maxX:27,minZ:16.5,maxZ:19,height:2.3,kind:'container'},
 {id:'dock-loader',minX:-4.5,maxX:4.4,minZ:11.6,maxZ:13.5,height:1.6,kind:'barrier-low'},
 {id:'packing-baffle',minX:-29,maxX:-26.5,minZ:-1.8,maxZ:6.5,height:2.7,kind:'barrier'},
 {id:'silo-baffle',minX:28,maxX:30,minZ:7.5,maxZ:12.6,height:2.9,kind:'barrier'},
 ...[-29,29].flatMap(x=>[-24,24].map(z=>({
  id:'pillar-'+x+'-'+z,minX:x-.33,maxX:x+.33,minZ:z-.33,maxZ:z+.33,height:7.5,kind:'pillar',
 }))),
 ]},
 spawns:{
 friendly:[{x:0,z:23,yaw:0},{x:-9,z:22,yaw:0},{x:9,z:22,yaw:0}],
 hostile:[{x:0,z:-22,yaw:Math.PI},{x:-9,z:-22,yaw:Math.PI},{x:9,z:-22,yaw:Math.PI}],
 },
 sites:{
 recovery:{x:-12,z:7},control:{x:-12,z:-9},
 domination:[{id:'A',x:-10,z:-13},{id:'B',x:24.5,z:-8},{id:'C',x:11,z:14}],
 breakthrough:{friendlyGoal:{x:0,z:-21},hostileGoal:{x:0,z:22}},
 },
});