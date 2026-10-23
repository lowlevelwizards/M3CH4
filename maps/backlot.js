/** The local open-rotation proving ground; new layout, not the old warehouse. */
export const BACKLOT=Object.freeze({
 id:'backlot-dustbowl',name:'BACKLOT DUSTBOWL',version:1,theme:'dirt',
 world:{minX:-34,maxX:34,minZ:-28,maxZ:28,obstacles:[
 {id:'tractor-hull',minX:-7.0,maxX:-1.1,minZ:-5.7,maxZ:2.1,height:3.6,kind:'building'},
 {id:'loader-bucket',minX:1.4,maxX:8.8,minZ:-3.2,maxZ:1.9,height:2.8,kind:'container'},
 {id:'coupling-spine',minX:-1.25,maxX:1.65,minZ:-3.1,maxZ:1.5,height:3.4,kind:'barrier'},
 {id:'exposed-engine',minX:-1.7,maxX:3.2,minZ:4.2,maxZ:7.1,height:1.7,kind:'barrier-low'},
 {id:'west-tractor',minX:-27.5,maxX:-22.9,minZ:-12.5,maxZ:-6.0,height:2.8,kind:'container'},
 {id:'west-axles',minX:-27.0,maxX:-22.5,minZ:9,maxZ:13.8,height:2.3,kind:'barrier'},
 {id:'west-plate-north',minX:-19.0,maxX:-12.4,minZ:-13.8,maxZ:-11.7,height:2.7,kind:'barrier'},
 {id:'west-plate-south',minX:-20,maxX:-13.5,minZ:12.5,maxZ:14.8,height:1.9,kind:'barrier-low'},
 {id:'east-implement',minX:23,maxX:28.3,minZ:-10.9,maxZ:-4.1,height:3.0,kind:'container'},
 {id:'east-tyres',minX:23.8,maxX:28.5,minZ:11.1,maxZ:15.1,height:2.2,kind:'barrier'},
 {id:'east-plate-north',minX:12.6,maxX:19.2,minZ:-14.0,maxZ:-11.9,height:1.8,kind:'barrier-low'},
 {id:'east-plate-south',minX:13.3,maxX:19.7,minZ:13.1,maxZ:15.0,height:2.6,kind:'barrier'},
 {id:'near-west',minX:-15.5,maxX:-11.1,minZ:16.9,maxZ:18.4,height:1.65,kind:'barrier-low'},
 {id:'near-east',minX:11.1,maxX:15.5,minZ:16.9,maxZ:18.4,height:1.65,kind:'barrier-low'},
 {id:'far-west',minX:-15.5,maxX:-11.1,minZ:-18.4,maxZ:-16.9,height:1.65,kind:'barrier-low'},
 {id:'far-east',minX:11.1,maxX:15.5,minZ:-18.4,maxZ:-16.9,height:1.65,kind:'barrier-low'},
 ...[-29,29].flatMap(x=>[-23.5,23.5].map(z=>({
   id:'pillar-'+x+'-'+z,minX:x-.34,maxX:x+.34,minZ:z-.34,maxZ:z+.34,
   height:7.5,kind:'pillar',
 }))),
 ]},
 spawns:{
 friendly:[{x:0,z:23,yaw:0},{x:-8.5,z:22,yaw:0},{x:8.5,z:22,yaw:0}],
 hostile:[{x:0,z:-23,yaw:Math.PI},{x:-8.5,z:-22,yaw:Math.PI},{x:8.5,z:-22,yaw:Math.PI}],
 },
 sites:{
 recovery:{x:21,z:5},control:{x:-20,z:4},
 domination:[{id:'A',x:-20,z:4},{id:'B',x:0,z:-11},{id:'C',x:20,z:4}],
 breakthrough:{friendlyGoal:{x:0,z:-22},hostileGoal:{x:0,z:22}},
 },
});