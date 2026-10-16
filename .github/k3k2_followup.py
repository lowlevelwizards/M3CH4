from pathlib import Path
p = Path('scene.js')
s = p.read_text()
repls = [
("let hitPitchKick = 0, hitRollKick = 0, hitYawKick = 0, gunDamageKick = 0;", "let hitPitchKick = 0, hitRollKick = 0, hitYawKick = 0, hitShakeKick = 0, gunDamageKick = 0;"),
("        hitYawKick += Number(profile.yaw) || 0;\n        gunDamageKick = Math.max(gunDamageKick, Number(profile.gunShake) || 0);", "        hitYawKick += Number(profile.yaw) || 0;\n        hitShakeKick = Math.max(hitShakeKick, Number(profile.shake) || 0);\n        gunDamageKick = Math.max(gunDamageKick, Number(profile.gunShake) || 0);"),
("        hitPitchKick = hitRollKick = hitYawKick = gunDamageKick = 0;", "        hitPitchKick = hitRollKick = hitYawKick = hitShakeKick = gunDamageKick = 0;"),
("        const damageWave = Math.sin(performance.now() * .043);", "        const damageWave = Math.sin(performance.now() * .043);\n        const impactJitter = hitShakeKick * Math.sin(performance.now() * .117);") ,
("        cockpit.position.set(visualX, 0, visualZ);", "        cockpit.position.set(visualX + impactJitter * .35, impactJitter * .18, visualZ + impactJitter * .12);"),
("            camera.position.set(visualX, 2.42 + cockpitHeave - Math.abs(hitPitchKick) * .2, visualZ);", "            camera.position.set(visualX + impactJitter * .62, 2.42 + cockpitHeave - Math.abs(hitPitchKick) * .2 + impactJitter * .28, visualZ + impactJitter * .18);"),
("        hitPitchKick *= hitDecay; hitRollKick *= hitDecay; hitYawKick *= hitDecay; gunDamageKick *= Math.exp(-5.2 * dt);", "        hitPitchKick *= hitDecay; hitRollKick *= hitDecay; hitYawKick *= hitDecay; hitShakeKick *= Math.exp(-10.5 * dt); gunDamageKick *= Math.exp(-5.2 * dt);")
]
for old,new in repls:
    if old not in s: raise SystemExit(f'missing anchor: {old}')
    s = s.replace(old,new,1)
p.write_text(s)
