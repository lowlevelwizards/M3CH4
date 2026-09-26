# 0.0.1k.2 — First Real Assembly

- Added one load-rated, 85 kg left-rear generator bracket with a nested medium output socket and safe rehoming back to the original mount.
- Repositioned the actual existing generator mesh through graph-derived transforms while keeping j.2 combat, mobile controls and enemy navigation untouched.
- Made the relocated generator's inspection focus and hostile aim follow its physical mount.
- Added compact POWER garage mount buttons and visible, preflighted installation / parent-removal errors.
- Reopened incomplete saved rigs with an inert garage-only configuration rather than crashing at startup.
- Advanced saves to v3 in a *new* localStorage key, preserving the original v1/v2 save for rollback.
- Bundled graph regression tests and added mount, migration and startup tests. Deliberately deferred ghost previews and general-purpose socket placement.

See `K2_NOTES.md` for deployment and testing guidance.
