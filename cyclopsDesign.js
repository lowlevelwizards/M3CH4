/** CYCLOPS approved-concept geometry master. All dimensions in metres; -Z is forward.
 * Geometry descriptors use the exact Workbench V2 geometry schema. Pure data: safe in Node.
 * The named 8 armor identities remain aligned with armorPlan.js. Do not edit generated JSON
 * independently; run node research/exportCyclopsWorkbench.mjs after source changes.
 */
export const CYCLOPS_CORE = Object.freeze([
  {
    "group": "cell",
    "id": "operator-tub",
    "name": "dark occupied operator tub",
    "geometry": {
      "type": "chamfer",
      "size": [
        0.94,
        0.66,
        0.84
      ],
      "bevel": 0.075
    },
    "position": [
      0,
      -0.035,
      0.07
    ],
    "rotation": [
      0,
      0,
      0
    ],
    "material": "iron"
  },
  {
    "group": "cell",
    "id": "pressure-casing",
    "name": "mustard central outer casing",
    "geometry": {
      "type": "chamfer",
      "size": [
        0.805,
        0.54,
        0.59
      ],
      "bevel": 0.075
    },
    "position": [
      0,
      -0.075,
      -0.095
    ],
    "rotation": [
      0,
      0,
      0
    ],
    "material": "ochre"
  },
  {
    "group": "cell",
    "id": "lower-sill",
    "name": "reinforced lower sill",
    "geometry": {
      "type": "box",
      "size": [
        0.89,
        0.09,
        0.81
      ]
    },
    "position": [
      0,
      -0.339,
      0.025
    ],
    "rotation": [
      0,
      0,
      0
    ],
    "material": "loadSteel"
  },
  {
    "group": "cell",
    "id": "front-lower",
    "name": "mustard front lower load bridge",
    "geometry": {
      "type": "box",
      "size": [
        0.8,
        0.17,
        0.115
      ]
    },
    "position": [
      0,
      -0.245,
      -0.338
    ],
    "rotation": [
      0,
      0,
      0
    ],
    "material": "ochre"
  },
  {
    "group": "cell",
    "id": "front-right",
    "name": "mustard front upright frame",
    "geometry": {
      "type": "box",
      "size": [
        0.13,
        0.49,
        0.13
      ]
    },
    "position": [
      0.345,
      -0.052,
      -0.328
    ],
    "rotation": [
      0,
      0,
      0
    ],
    "material": "ochre"
  },
  {
    "group": "cell",
    "id": "front-left",
    "name": "dark left optical load pillar",
    "geometry": {
      "type": "box",
      "size": [
        0.085,
        0.49,
        0.13
      ]
    },
    "position": [
      -0.416,
      -0.04,
      -0.322
    ],
    "rotation": [
      0,
      0,
      0
    ],
    "material": "loadSteel"
  },
  {
    "group": "cell",
    "id": "upper-rail",
    "name": "top mechanical load rail",
    "geometry": {
      "type": "box",
      "size": [
        0.84,
        0.075,
        0.68
      ]
    },
    "position": [
      0,
      0.287,
      0.04
    ],
    "rotation": [
      0,
      0,
      0
    ],
    "material": "loadSteel"
  },
  {
    "group": "cell",
    "id": "floor-rail",
    "name": "bottom mechanical load rail",
    "geometry": {
      "type": "box",
      "size": [
        0.86,
        0.07,
        0.55
      ]
    },
    "position": [
      0,
      -0.332,
      0.2
    ],
    "rotation": [
      0,
      0,
      0
    ],
    "material": "iron"
  },
  {
    "group": "optics",
    "id": "optical-carrier",
    "name": "square structural optical carrier",
    "geometry": {
      "type": "chamfer",
      "size": [
        0.562,
        0.535,
        0.135
      ],
      "bevel": 0.055
    },
    "position": [
      -0.066,
      0.066,
      -0.421
    ],
    "rotation": [
      0,
      0,
      0
    ],
    "material": "iron"
  },
  {
    "group": "optics",
    "id": "optical-well",
    "name": "deep dark square optical well",
    "geometry": {
      "type": "chamfer",
      "size": [
        0.472,
        0.442,
        0.012
      ],
      "bevel": 0.032
    },
    "position": [
      -0.066,
      0.066,
      -0.498
    ],
    "rotation": [
      0,
      0,
      0
    ],
    "material": "opticRecess"
  },
  {
    "group": "optics",
    "id": "well-depth",
    "name": "dark inner optical bore",
    "geometry": {
      "type": "cylinder",
      "radius": 0.208,
      "length": 0.012,
      "sides": 12,
      "axis": "z"
    },
    "position": [
      -0.066,
      0.066,
      -0.505
    ],
    "rotation": [
      0,
      0,
      0
    ],
    "material": "recess"
  },
  {
    "group": "optics",
    "id": "outer-bezel",
    "name": "outer machined circular bezel",
    "geometry": {
      "type": "tube",
      "outerRadius": 0.236,
      "innerRadius": 0.178,
      "length": 0.033,
      "sides": 12,
      "axis": "z"
    },
    "position": [
      -0.066,
      0.066,
      -0.521
    ],
    "rotation": [
      0,
      0,
      0
    ],
    "material": "bright"
  },
  {
    "group": "optics",
    "id": "lens-surround",
    "name": "recessed protective optical ring",
    "geometry": {
      "type": "tube",
      "outerRadius": 0.181,
      "innerRadius": 0.147,
      "length": 0.018,
      "sides": 12,
      "axis": "z"
    },
    "position": [
      -0.066,
      0.066,
      -0.54
    ],
    "rotation": [
      0,
      0,
      0
    ],
    "material": "opticRecess"
  },
  {
    "group": "optics",
    "id": "teal-objective",
    "name": "single protected teal objective",
    "geometry": {
      "type": "cylinder",
      "radius": 0.151,
      "length": 0.016,
      "sides": 12,
      "axis": "z"
    },
    "position": [
      -0.066,
      0.066,
      -0.549
    ],
    "rotation": [
      0,
      0,
      0
    ],
    "material": "optic"
  },
  {
    "group": "optics",
    "id": "optical-aperture",
    "name": "dark central optical aperture",
    "geometry": {
      "type": "cylinder",
      "radius": 0.078,
      "length": 0.009,
      "sides": 12,
      "axis": "z"
    },
    "position": [
      -0.066,
      0.066,
      -0.564
    ],
    "rotation": [
      0,
      0,
      0
    ],
    "material": "glass"
  },
  {
    "group": "optics",
    "id": "carrier-underbrace",
    "name": "lower optical mounting bridge",
    "geometry": {
      "type": "box",
      "size": [
        0.48,
        0.06,
        0.22
      ]
    },
    "position": [
      -0.064,
      -0.252,
      -0.391
    ],
    "rotation": [
      0,
      0,
      0
    ],
    "material": "loadSteel"
  },
  {
    "group": "optics",
    "id": "carrier-left-bracket",
    "name": "left optical retaining strut",
    "geometry": {
      "type": "box",
      "size": [
        0.065,
        0.355,
        0.19
      ]
    },
    "position": [
      -0.368,
      0.07,
      -0.395
    ],
    "rotation": [
      0,
      0,
      0
    ],
    "material": "loadSteel"
  },
  {
    "group": "optics",
    "id": "carrier-right-bracket",
    "name": "right optical retaining strut",
    "geometry": {
      "type": "box",
      "size": [
        0.067,
        0.35,
        0.19
      ]
    },
    "position": [
      0.236,
      0.07,
      -0.395
    ],
    "rotation": [
      0,
      0,
      0
    ],
    "material": "loadSteel"
  },
  {
    "group": "frame",
    "id": "left-long-rail",
    "name": "left exposed armor mounting rail",
    "geometry": {
      "type": "box",
      "size": [
        0.073,
        0.076,
        0.78
      ]
    },
    "position": [
      -0.47,
      -0.02,
      0.066
    ],
    "rotation": [
      0,
      0,
      0
    ],
    "material": "loadSteel"
  },
  {
    "group": "frame",
    "id": "right-long-rail",
    "name": "right exposed armor mounting rail",
    "geometry": {
      "type": "box",
      "size": [
        0.074,
        0.076,
        0.78
      ]
    },
    "position": [
      0.47,
      -0.025,
      0.066
    ],
    "rotation": [
      0,
      0,
      0
    ],
    "material": "loadSteel"
  },
  {
    "group": "frame",
    "id": "left-upper-strut",
    "name": "left upper exoskeletal structure",
    "geometry": {
      "type": "box",
      "size": [
        0.08,
        0.085,
        0.68
      ]
    },
    "position": [
      -0.448,
      0.243,
      0.1
    ],
    "rotation": [
      0,
      0,
      0
    ],
    "material": "iron"
  },
  {
    "group": "frame",
    "id": "right-upper-strut",
    "name": "right upper exoskeletal structure",
    "geometry": {
      "type": "box",
      "size": [
        0.08,
        0.085,
        0.68
      ]
    },
    "position": [
      0.448,
      0.243,
      0.1
    ],
    "rotation": [
      0,
      0,
      0
    ],
    "material": "iron"
  },
  {
    "group": "frame",
    "id": "left-aft-post",
    "name": "left rear structural upright",
    "geometry": {
      "type": "box",
      "size": [
        0.086,
        0.54,
        0.08
      ]
    },
    "position": [
      -0.45,
      -0.02,
      0.38
    ],
    "rotation": [
      0,
      0,
      0
    ],
    "material": "iron"
  },
  {
    "group": "frame",
    "id": "right-aft-post",
    "name": "right rear structural upright",
    "geometry": {
      "type": "box",
      "size": [
        0.086,
        0.54,
        0.08
      ]
    },
    "position": [
      0.45,
      -0.02,
      0.38
    ],
    "rotation": [
      0,
      0,
      0
    ],
    "material": "iron"
  },
  {
    "group": "frame",
    "id": "front-left-hardpoint",
    "name": "left armor hardpoint",
    "geometry": {
      "type": "box",
      "size": [
        0.1,
        0.1,
        0.13
      ]
    },
    "position": [
      -0.48,
      -0.09,
      -0.27
    ],
    "rotation": [
      0,
      0,
      0
    ],
    "material": "bright"
  },
  {
    "group": "frame",
    "id": "front-right-hardpoint",
    "name": "right armor hardpoint",
    "geometry": {
      "type": "box",
      "size": [
        0.1,
        0.1,
        0.13
      ]
    },
    "position": [
      0.48,
      -0.09,
      -0.27
    ],
    "rotation": [
      0,
      0,
      0
    ],
    "material": "bright"
  },
  {
    "group": "access",
    "id": "access-hatch",
    "name": "large ochre pilot service hatch",
    "geometry": {
      "type": "plate",
      "profile": [
        [
          -0.29,
          -0.205
        ],
        [
          0.25,
          -0.205
        ],
        [
          0.285,
          -0.16
        ],
        [
          0.285,
          0.19
        ],
        [
          0.235,
          0.235
        ],
        [
          -0.27,
          0.235
        ]
      ],
      "depth": 0.034
    },
    "position": [
      0.511,
      -0.04,
      0.095
    ],
    "rotation": [
      0,
      1.5707963267948966,
      0
    ],
    "material": "ochre"
  },
  {
    "group": "access",
    "id": "hatch-hinge-upper",
    "name": "service hatch upper hinge",
    "geometry": {
      "type": "box",
      "size": [
        0.07,
        0.075,
        0.102
      ]
    },
    "position": [
      0.504,
      0.135,
      0.314
    ],
    "rotation": [
      0,
      0,
      0
    ],
    "material": "bright"
  },
  {
    "group": "access",
    "id": "hatch-hinge-lower",
    "name": "service hatch lower hinge",
    "geometry": {
      "type": "box",
      "size": [
        0.07,
        0.075,
        0.102
      ]
    },
    "position": [
      0.504,
      -0.198,
      0.314
    ],
    "rotation": [
      0,
      0,
      0
    ],
    "material": "bright"
  },
  {
    "group": "access",
    "id": "hatch-recess-latch",
    "name": "large inset maintenance latch",
    "geometry": {
      "type": "box",
      "size": [
        0.012,
        0.073,
        0.041
      ]
    },
    "position": [
      0.534,
      -0.06,
      -0.08
    ],
    "rotation": [
      0,
      0,
      0
    ],
    "material": "iron"
  },
  {
    "group": "rear",
    "id": "rear-carrier",
    "name": "rear equipment cage",
    "geometry": {
      "type": "chamfer",
      "size": [
        0.765,
        0.46,
        0.24
      ],
      "bevel": 0.054
    },
    "position": [
      0,
      -0.045,
      0.429
    ],
    "rotation": [
      0,
      0,
      0
    ],
    "material": "iron"
  },
  {
    "group": "rear",
    "id": "electronics-cassette",
    "name": "teal rear service cassette",
    "geometry": {
      "type": "chamfer",
      "size": [
        0.676,
        0.368,
        0.085
      ],
      "bevel": 0.036
    },
    "position": [
      0,
      -0.045,
      0.508
    ],
    "rotation": [
      0,
      0,
      0
    ],
    "material": "teal"
  },
  {
    "group": "rear",
    "id": "rear-lock-rail",
    "name": "rear service module lower lock rail",
    "geometry": {
      "type": "box",
      "size": [
        0.67,
        0.045,
        0.095
      ]
    },
    "position": [
      0,
      -0.271,
      0.485
    ],
    "rotation": [
      0,
      0,
      0
    ],
    "material": "loadSteel"
  },
  {
    "group": "roof",
    "id": "roof-processor",
    "name": "low roof electronics unit",
    "geometry": {
      "type": "box",
      "size": [
        0.31,
        0.148,
        0.26
      ]
    },
    "position": [
      0.183,
      0.343,
      0.17
    ],
    "rotation": [
      0,
      0,
      0
    ],
    "material": "loadSteel"
  },
  {
    "group": "roof",
    "id": "roof-processor-cap",
    "name": "teal processor top lid",
    "geometry": {
      "type": "box",
      "size": [
        0.288,
        0.014,
        0.234
      ]
    },
    "position": [
      0.183,
      0.422,
      0.17
    ],
    "rotation": [
      0,
      0,
      0
    ],
    "material": "teal"
  },
  {
    "group": "roof",
    "id": "handle-left",
    "name": "carrying handle left stem",
    "geometry": {
      "type": "box",
      "size": [
        0.036,
        0.123,
        0.041
      ]
    },
    "position": [
      -0.207,
      0.382,
      0.332
    ],
    "rotation": [
      0,
      0,
      0
    ],
    "material": "iron"
  },
  {
    "group": "roof",
    "id": "handle-right",
    "name": "carrying handle right stem",
    "geometry": {
      "type": "box",
      "size": [
        0.036,
        0.123,
        0.041
      ]
    },
    "position": [
      -0.013,
      0.382,
      0.332
    ],
    "rotation": [
      0,
      0,
      0
    ],
    "material": "iron"
  },
  {
    "group": "roof",
    "id": "handle-crossbar",
    "name": "carrying handle top crossbar",
    "geometry": {
      "type": "box",
      "size": [
        0.231,
        0.029,
        0.044
      ]
    },
    "position": [
      -0.11,
      0.434,
      0.332
    ],
    "rotation": [
      0,
      0,
      0
    ],
    "material": "iron"
  },
  {
    "group": "mount",
    "id": "contact-collar",
    "name": "U1 machined contact ring",
    "geometry": {
      "type": "cylinder",
      "radius": 0.198,
      "length": 0.056,
      "sides": 12,
      "axis": "y"
    },
    "position": [
      0,
      -0.422,
      0.045
    ],
    "rotation": [
      0,
      0,
      0
    ],
    "material": "bright"
  },
  {
    "group": "mount",
    "id": "index-boss",
    "name": "U1 inner index boss",
    "geometry": {
      "type": "cylinder",
      "radius": 0.122,
      "length": 0.032,
      "sides": 12,
      "axis": "y"
    },
    "position": [
      0,
      -0.377,
      0.045
    ],
    "rotation": [
      0,
      0,
      0
    ],
    "material": "iron"
  },
  {
    "group": "mount",
    "id": "lower-left-gusset",
    "name": "underside left load gusset",
    "geometry": {
      "type": "box",
      "size": [
        0.1,
        0.094,
        0.19
      ]
    },
    "position": [
      -0.25,
      -0.339,
      0.055
    ],
    "rotation": [
      0,
      0,
      -0.26
    ],
    "material": "iron"
  },
  {
    "group": "mount",
    "id": "lower-right-gusset",
    "name": "underside right load gusset",
    "geometry": {
      "type": "box",
      "size": [
        0.1,
        0.094,
        0.19
      ]
    },
    "position": [
      0.25,
      -0.339,
      0.055
    ],
    "rotation": [
      0,
      0,
      0.26
    ],
    "material": "iron"
  }
]);
export const CYCLOPS_ARMOR = Object.freeze({
  "cyclops-left-cheek": {
    "group": "CYCLOPS / DETACHABLE CHEEKS",
    "name": "LEFT FLANK SHIELD",
    "material": "cream",
    "variants": [
      {
        "level": 1,
        "geo": {
          "type": "plate",
          "profile": [
            [
              -0.31,
              -0.235
            ],
            [
              0.26,
              -0.235
            ],
            [
              0.31,
              -0.18
            ],
            [
              0.31,
              0.18
            ],
            [
              0.255,
              0.24
            ],
            [
              -0.27,
              0.24
            ]
          ],
          "depth": 0.066
        },
        "pos": [
          -0.543,
          -0.041,
          0.01
        ],
        "rot": [
          0,
          -1.5707963267948966,
          0
        ]
      },
      {
        "level": 2,
        "geo": {
          "type": "plate",
          "profile": [
            [
              -0.38,
              -0.275
            ],
            [
              0.31,
              -0.275
            ],
            [
              0.37,
              -0.21
            ],
            [
              0.35,
              0.23
            ],
            [
              0.235,
              0.308
            ],
            [
              -0.32,
              0.308
            ]
          ],
          "depth": 0.105
        },
        "pos": [
          -0.557,
          -0.01,
          -0.024
        ],
        "rot": [
          0,
          -1.5707963267948966,
          0
        ]
      },
      {
        "level": 3,
        "geo": {
          "type": "plate",
          "profile": [
            [
              -0.4,
              -0.302
            ],
            [
              0.31,
              -0.302
            ],
            [
              0.4,
              -0.215
            ],
            [
              0.39,
              0.24
            ],
            [
              0.26,
              0.33
            ],
            [
              -0.32,
              0.33
            ]
          ],
          "depth": 0.103
        },
        "pos": [
          -0.562,
          -0.006,
          -0.055
        ],
        "rot": [
          0,
          -1.5707963267948966,
          0
        ]
      }
    ]
  },
  "cyclops-right-cheek": {
    "group": "CYCLOPS / DETACHABLE CHEEKS",
    "name": "RIGHT FLANK SHIELD",
    "material": "cream",
    "variants": [
      {
        "level": 1,
        "geo": {
          "type": "plate",
          "profile": [
            [
              -0.29,
              -0.23
            ],
            [
              0.26,
              -0.23
            ],
            [
              0.29,
              -0.175
            ],
            [
              0.29,
              0.19
            ],
            [
              0.26,
              0.228
            ],
            [
              -0.27,
              0.228
            ]
          ],
          "depth": 0.07
        },
        "pos": [
          0.543,
          -0.058,
          0.017
        ],
        "rot": [
          0,
          1.5707963267948966,
          0
        ]
      },
      {
        "level": 2,
        "geo": {
          "type": "plate",
          "profile": [
            [
              -0.35,
              -0.278
            ],
            [
              0.3,
              -0.278
            ],
            [
              0.37,
              -0.21
            ],
            [
              0.34,
              0.22
            ],
            [
              0.24,
              0.28
            ],
            [
              -0.31,
              0.28
            ]
          ],
          "depth": 0.106
        },
        "pos": [
          0.555,
          -0.012,
          -0.02
        ],
        "rot": [
          0,
          1.5707963267948966,
          0
        ]
      },
      {
        "level": 3,
        "geo": {
          "type": "plate",
          "profile": [
            [
              -0.39,
              -0.305
            ],
            [
              0.3,
              -0.305
            ],
            [
              0.4,
              -0.218
            ],
            [
              0.39,
              0.245
            ],
            [
              0.25,
              0.33
            ],
            [
              -0.32,
              0.33
            ]
          ],
          "depth": 0.11
        },
        "pos": [
          0.56,
          -0.005,
          -0.05
        ],
        "rot": [
          0,
          1.5707963267948966,
          0
        ]
      }
    ]
  },
  "cyclops-brow": {
    "group": "CYCLOPS / FRONT BLAST GUARDS",
    "name": "SLANTED OPTIC BROW",
    "material": "cream",
    "variants": [
      {
        "level": 2,
        "geo": {
          "type": "plate",
          "profile": [
            [
              -0.478,
              -0.095
            ],
            [
              0.478,
              -0.095
            ],
            [
              0.4,
              0.074
            ],
            [
              -0.4,
              0.074
            ]
          ],
          "depth": 0.098
        },
        "pos": [
          -0.015,
          0.326,
          -0.476
        ],
        "rot": [
          0,
          0,
          0
        ]
      },
      {
        "level": 3,
        "geo": {
          "type": "plate",
          "profile": [
            [
              -0.515,
              -0.104
            ],
            [
              0.515,
              -0.104
            ],
            [
              0.424,
              0.105
            ],
            [
              -0.424,
              0.105
            ]
          ],
          "depth": 0.112
        },
        "pos": [
          -0.015,
          0.33,
          -0.484
        ],
        "rot": [
          0,
          0,
          0
        ]
      }
    ]
  },
  "cyclops-chin": {
    "group": "CYCLOPS / FRONT BLAST GUARDS",
    "name": "LOWER BLAST LIP",
    "material": "cream",
    "variants": [
      {
        "level": 2,
        "geo": {
          "type": "plate",
          "profile": [
            [
              -0.45,
              -0.07
            ],
            [
              0.45,
              -0.07
            ],
            [
              0.37,
              0.075
            ],
            [
              -0.37,
              0.075
            ]
          ],
          "depth": 0.109
        },
        "pos": [
          0,
          -0.321,
          -0.463
        ],
        "rot": [
          0,
          0,
          0
        ]
      },
      {
        "level": 3,
        "geo": {
          "type": "plate",
          "profile": [
            [
              -0.505,
              -0.08
            ],
            [
              0.505,
              -0.08
            ],
            [
              0.43,
              0.106
            ],
            [
              -0.43,
              0.106
            ]
          ],
          "depth": 0.119
        },
        "pos": [
          0,
          -0.31,
          -0.465
        ],
        "rot": [
          0,
          0,
          0
        ]
      }
    ]
  },
  "cyclops-rear": {
    "group": "CYCLOPS / ENCLOSURE",
    "name": "REAR ARMOR CASSETTE",
    "material": "cream",
    "variants": [
      {
        "level": 3,
        "geo": {
          "type": "plate",
          "profile": [
            [
              -0.395,
              -0.25
            ],
            [
              0.395,
              -0.25
            ],
            [
              0.433,
              -0.2
            ],
            [
              0.433,
              0.23
            ],
            [
              0.344,
              0.28
            ],
            [
              -0.344,
              0.28
            ],
            [
              -0.433,
              0.23
            ],
            [
              -0.433,
              -0.2
            ]
          ],
          "depth": 0.055
        },
        "pos": [
          0,
          -0.028,
          0.53
        ],
        "rot": [
          0,
          0,
          0
        ]
      }
    ]
  },
  "cyclops-left-wrap": {
    "group": "CYCLOPS / ENCLOSURE",
    "name": "LEFT WRAPAROUND SHOULDER",
    "material": "cream",
    "variants": [
      {
        "level": 3,
        "geo": {
          "type": "plate",
          "profile": [
            [
              -0.21,
              -0.274
            ],
            [
              0.26,
              -0.274
            ],
            [
              0.3,
              -0.2
            ],
            [
              0.29,
              0.21
            ],
            [
              0.2,
              0.267
            ],
            [
              -0.2,
              0.267
            ]
          ],
          "depth": 0.075
        },
        "pos": [
          -0.567,
          -0.01,
          0.335
        ],
        "rot": [
          0,
          -1.5707963267948966,
          0
        ]
      }
    ]
  },
  "cyclops-right-wrap": {
    "group": "CYCLOPS / ENCLOSURE",
    "name": "RIGHT WRAPAROUND SHOULDER",
    "material": "cream",
    "variants": [
      {
        "level": 3,
        "geo": {
          "type": "plate",
          "profile": [
            [
              -0.21,
              -0.271
            ],
            [
              0.26,
              -0.271
            ],
            [
              0.3,
              -0.21
            ],
            [
              0.29,
              0.215
            ],
            [
              0.2,
              0.267
            ],
            [
              -0.2,
              0.267
            ]
          ],
          "depth": 0.077
        },
        "pos": [
          0.567,
          -0.009,
          0.335
        ],
        "rot": [
          0,
          1.5707963267948966,
          0
        ]
      }
    ]
  },
  "cyclops-crown": {
    "group": "CYCLOPS / ENCLOSURE",
    "name": "THICK UPPER ROOF CAP",
    "material": "cream",
    "variants": [
      {
        "level": 3,
        "geo": {
          "type": "plate",
          "profile": [
            [
              -0.43,
              -0.438
            ],
            [
              0.43,
              -0.438
            ],
            [
              0.51,
              -0.22
            ],
            [
              0.51,
              0.35
            ],
            [
              0.42,
              0.43
            ],
            [
              -0.42,
              0.43
            ],
            [
              -0.51,
              0.35
            ],
            [
              -0.51,
              -0.22
            ]
          ],
          "depth": 0.065
        },
        "pos": [
          0,
          0.402,
          -0.03
        ],
        "rot": [
          1.5707963267948966,
          0,
          0
        ]
      }
    ]
  }
});
export const CYCLOPS_GROUPS = Object.freeze({
  "mount": "CYCLOPS / MOUNTING CRADLE",
  "cell": "CYCLOPS / PILOT CELL",
  "optics": "CYCLOPS / OPTIC ASSEMBLY",
  "access": "CYCLOPS / SIDE ACCESS",
  "frame": "CYCLOPS / SIDE FRAME",
  "rear": "CYCLOPS / REAR ELECTRONICS",
  "roof": "CYCLOPS / ROOF EQUIPMENT"
});
export const CYCLOPS_REFERENCE_COLORS = Object.freeze({
  "iron": 3555137,
  "loadSteel": 4278602,
  "ochre": 11700793,
  "cream": 13682349,
  "teal": 4292481,
  "optic": 4163980,
  "opticRecess": 1187102,
  "recess": 1514524,
  "glass": 1583918,
  "raw": 6845294,
  "bright": 8094331
});
export function cyclopsVariantShapes(tier=0) {
 const n=Math.max(0,Math.min(3,Math.floor(tier)));
 const all=CYCLOPS_CORE.map(x=>({...x,armorId:null}));
 for(const [id,a] of Object.entries(CYCLOPS_ARMOR)){
   const variant=[...a.variants].reverse().find(v=>v.level<=n);
   if(variant)all.push({group:a.group,id,name:a.name,material:a.material,
     geometry:variant.geo,position:variant.pos,rotation:variant.rot,armorId:id});
 }
 return all;
}
