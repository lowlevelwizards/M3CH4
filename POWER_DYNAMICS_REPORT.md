# M3CH4 — k.3v.4 Generator Power Dynamics

Implemented prototype power response. Continuous rated output, component
loads and loaded serials remain sourced from the existing catalogue.

## Mechanism

The shared `powerDynamics.js` module uses fixed 60Hz simulation:

- kW = instantaneous power. The installed generator's published 145 kW
  (Dynamo) or 112 kW (Draft) remains the **hard continuous output limit**,
  further constrained by its actual health.
- kJ = stored surge energy. One kW for one second consumes one kJ.
  The reserve helps only while the generator has not reached demand.
  There is no positive supply created by reserve without drawing energy.
- Drivetrain demand is the installed motor's catalogue kW with a small idle
  circulation fraction and an active term driven by the **actual stepRig
  driveLoad**. Command and weapon standby use their fitted kW values.
- A successfully consumed round adds a bounded, decaying breech/stabilizer
  electrical pulse. Dry-fire and blocked trigger input cost no rounds and no
  pulse. Magazine/reload timing stays in the existing weapon state machine.
- The generator spools toward demanded electrical output plus limited recharge,
  faster when demand is increasing for Draft than Dynamo. Finite reserve
  covers some of the difference; spare generated output slowly recharges it.
- `busRatio = delivered power / demanded power`. When inadequate,
  `powerConstrainedOutput` passes the same physical force derating already
  used for damaged locomotion. Severe sag inhibits a new trigger pull;
  **no ammunition is consumed** until power returns.
- Generator damage scales its physical continuous capacity and available
  surge-store size, not the machine's nominal garage legality.
- Dynamo: heavier, 145 kW, 16 kJ store, slower output response, more sustained
  supply headroom, 26 kW bounded recharge.
- Draft: lighter, 112 kW, 6 kJ store, faster response, less spare output,
  17 kW bounded recharge.
- These extra dynamics are coarse engineering abstractions, **not** a detailed
  real alternator/engine/fuel/voltage model.

## Shared actor authority

Player and every AI rig get their own independent `createPowerSystem` instance.
The same `advancePowerSystem` and `registerPowerShot` functions execute for
everyone in the fixed-step combat loop. The AI's power-unit condition is taken
from the current combat integrity of its generator, not stale factory part
health. All states reset between sorties or when the active assembly changes.
No new save format or persistent discharge: surge reserve is a transient
combat state. Existing named machines, physical serialized components and
persistent component damage are unchanged.

## Cockpit

The existing drive screen now displays generator kW, dynamic demand kW,
the bus percentage and reserve percentage. A clear amber 'BUS SAG' warning
appears only on actual electrical shortage. The weapon display indicates
'PWR SAG' if voltage is too low for a new round; engine load and physical
damage have separate indicators. The development readout shows the same
unrounded simulation values.

## Reproducible tests

`node research/powerResponseStudy.mjs` compares two LEGAL otherwise
identical Skeleton + Kestrel + Cyclops + Needle machines, fitting either
Dynamo or Draft, over idle, maneuver launch, shot bursts, sustained mixed
drive/firing and four seconds of load followed by four seconds of recovery.
Its `--json` output is CI-artifact friendly. The program uses real
`advanceWeapon`, `fireWeapon`, `startReload`, installed kW, fixed-step
locomotion and the same supply policy as both combat actor types.

`npm test` covers the energy model's conservation/zero-data guards,
physical response, ammo gating, transient demand, condition loss, nominal
legality and deterministic repeatability. The existing part/mobility
benchmarks and 3v3 headless Domination regression remain required.

## Protected scope and known limitations

- No generators, fuel, batteries, additional module categories, temperature
  or heat-related wear have been added.
- This is a low-cost torque/surge model, not a complete powertrain.
- The voltage reduction influences actuator forces and shot readiness,
  not a new precision debuff. It does not retroactively erase momentum.
- Field power demand is only active in the sortie; nominal garage checks
  are intentionally unchanged.
- Headless sim cannot assess readability and audio on actual iPhone Safari.
