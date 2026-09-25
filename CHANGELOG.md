# MECH ARENA 0.0.1h.1 — Persistent Machine

- Added strictly versioned, validated local owned-rig save and restore.
- Records installed serials, all owned conditions and repairs, side-specific actuator damage and per-part armor/housing damage.
- Autosaves when the machine actually changes; backup flush when page is backgrounded.
- Launches into Garage after restoring; fresh hostile target and ammunition every deployment.
- Handles blocked storage, future/invalid save versions without aborting the prototype.

Deferred: save import/export, backups, repair costs, ownership history, opponent persistence.
