/** Dedicated zero-cost mechanical proving ground. Not registered with campaign MAPS. */
export const TEST_YARD = Object.freeze({
  id: 'test-yard', name: 'TEST YARD', version: 1, theme: 'concrete',
  world: {
    minX: -32, maxX: 32, minZ: -48, maxZ: 36,
    obstacles: [
      {id:'lane-wall-west',minX:-31,maxX:-29,minZ:-46,maxZ:34,height:3.0,kind:'barrier'},
      {id:'lane-wall-east',minX:29,maxX:31,minZ:-46,maxZ:34,height:3.0,kind:'barrier'},
      // Obstacle course is offset from the three clear downrange target lanes.
      {id:'cover-left-near',minX:-22,maxX:-17,minZ:8,maxZ:10,height:1.7,kind:'barrier-low'},
      {id:'cover-right-near',minX:17,maxX:22,minZ:8,maxZ:10,height:1.7,kind:'barrier-low'},
      {id:'cover-left-mid',minX:-24,maxX:-19,minZ:-8,maxZ:-6,height:2.4,kind:'barrier'},
      {id:'cover-right-mid',minX:19,maxX:24,minZ:-8,maxZ:-6,height:2.4,kind:'barrier'},
      {id:'slalom-left',minX:-17,maxX:-15,minZ:-21,maxZ:-18,height:2.7,kind:'pillar'},
      {id:'slalom-right',minX:15,maxX:17,minZ:-30,maxZ:-27,height:2.7,kind:'pillar'},
      {id:'backstop',minX:-27,maxX:27,minZ:-46,maxZ:-44,height:5.8,kind:'barrier'},
    ],
  },
  spawns: {
    friendly: [
      {x:0,z:26,yaw:0},
      {x:-26,z:27,yaw:0},
      {x:26,z:27,yaw:0},
    ],
    hostile: [
      {x:0,z:8,yaw:Math.PI},
      {x:-7,z:-5,yaw:Math.PI},
      {x:7,z:-25,yaw:Math.PI},
    ],
  },
  sites: {
    recovery:{x:0,z:3},control:{x:0,z:-9},
    domination:[{id:'A',x:-16,z:10},{id:'B',x:0,z:-8},{id:'C',x:16,z:-25}],
    breakthrough:{friendlyGoal:{x:0,z:-38},hostileGoal:{x:0,z:29}},
  },
});