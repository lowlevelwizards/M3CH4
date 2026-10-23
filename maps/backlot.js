/** The local open-rotation proving ground; new layout, not the old warehouse. */
export const BACKLOT=Object.freeze({
 id:'backlot-dustbowl',name:'BACKLOT DUSTBOWL',version:2,theme:'dirt',
 world:{minX:-34,maxX:34,minZ:-28,maxZ:28,obstacles:[
 // Each large rectangular obstacle was previously a single solid monolith.
 // These machine bodies, cabins, buckets and exposed wheels are instead
 // individual *real* colliders. The visible silhouette is the cover shape.
 // Parts overlap like real machine assemblies, leaving readable sky gaps.
 {id:'tractor-chassis',minX:-6.2,maxX:-2.05,minZ:-5.35,maxZ:1.15,height:1.66,kind:'container',art:'tractor-chassis'},
 {id:'tractor-cab',minX:-6.15,maxX:-3.05,minZ:-5.32,maxZ:-2.65,height:3.34,kind:'building',art:'tractor-cab'},
 {id:'tractor-bonnet',minX:-4.25,maxX:-1.22,minZ:-1.3,maxZ:1.86,height:1.98,kind:'container',art:'tractor-bonnet'},
 {id:'tractor-wheel-fl',minX:-6.96,maxX:-6.08,minZ:-4.97,maxZ:-3.03,height:1.43,kind:'barrier-low',art:'tractor-wheel'},
 {id:'tractor-wheel-rl',minX:-6.96,maxX:-6.08,minZ:-.43,maxZ:1.30,height:1.43,kind:'barrier-low',art:'tractor-wheel'},
 {id:'tractor-wheel-fr',minX:-2.08,maxX:-1.16,minZ:-4.97,maxZ:-3.03,height:1.43,kind:'barrier-low',art:'tractor-wheel'},
 {id:'tractor-wheel-rr',minX:-2.08,maxX:-1.16,minZ:-.43,maxZ:1.30,height:1.43,kind:'barrier-low',art:'tractor-wheel'},
 {id:'loader-scoop',minX:1.60,maxX:7.89,minZ:-3.15,maxZ:-1.82,height:1.48,kind:'barrier-low',art:'loader-scoop'},
 {id:'loader-engine',minX:3.62,maxX:8.36,minZ:-1.79,maxZ:1.74,height:1.88,kind:'container',art:'loader-engine'},
 {id:'loader-cab',minX:5.31,maxX:8.35,minZ:-1.57,maxZ:.27,height:2.77,kind:'building',art:'loader-cab'},
 {id:'loader-track-left',minX:2.25,maxX:3.69,minZ:-1.73,maxZ:1.65,height:1.04,kind:'barrier-low',art:'loader-track'},
 {id:'loader-track-right',minX:7.29,maxX:8.67,minZ:-1.73,maxZ:1.65,height:1.04,kind:'barrier-low',art:'loader-track'},
 {id:'coupling-gearcase',minX:-.79,maxX:1.10,minZ:-2.78,maxZ:.77,height:2.38,kind:'barrier',art:'engine-case'},
 {id:'coupling-crossbeam',minX:-1.21,maxX:1.43,minZ:.64,maxZ:1.47,height:1.48,kind:'barrier-low',art:'engine-case'},
 {id:'exposed-engine-rail',minX:-1.49,maxX:3.05,minZ:4.91,maxZ:6.19,height:1.21,kind:'barrier-low',art:'engine-rail'},
 {id:'exposed-engine-left',minX:-1.55,maxX:-.04,minZ:4.34,maxZ:6.83,height:1.63,kind:'barrier-low',art:'engine-bank'},
 {id:'exposed-engine-right',minX:.94,maxX:2.94,minZ:4.34,maxZ:6.83,height:1.63,kind:'barrier-low',art:'engine-bank'},
 {id:'scrap-flywheel-screen',minX:-10.5,maxX:-7.45,minZ:-3.8,maxZ:-.5,height:2.85,kind:'barrier'},
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
 domination:[{id:'A',x:-20,z:-4},{id:'B',x:0,z:-11},{id:'C',x:20,z:0}],
 breakthrough:{friendlyGoal:{x:0,z:-22},hostileGoal:{x:0,z:22}},
 },
});