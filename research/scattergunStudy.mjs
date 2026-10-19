/** k.3v.6: same fired shell, same ray angles, compare close and long sightlines.
 * This analytic hit-cone study is isolated from the authoritative THREE geometry
 * audit. No fake gameplay hit chances are used in combat.
 */
import { pathToFileURL } from 'node:url';
import { WEAPONS,fireWeapon,createWeaponState,advanceWeapon,startReload } from '../combat.js';
import { pelletOffsets } from '../scattergun.js';
const spec=WEAPONS['gun-scatter'];
const n=v=>Math.round(v*1000)/1000;
export function patternAtRange(rangeMeters,shots=16,targetRadiusM=.67){
    let pelletHits=0,shellsFired=0,uniqueHits=0;
    for(let shell=1;shell<=shots;shell++){
        const offsets=pelletOffsets(shell,spec);
        const impacts=offsets.map(([x,y])=>Math.hypot(x,y)*rangeMeters<=targetRadiusM);
        const count=impacts.filter(Boolean).length;
        pelletHits+=count;shellsFired++;uniqueHits+=Number(count>0);
    }
    return {rangeMeters,shots:shellsFired,possiblePellets:shellsFired*spec.pellets,
        pelletHits,hitFraction:n(pelletHits/(shellsFired*spec.pellets)),
        totalNominalDamage:pelletHits*spec.damage,shellsWithHit:uniqueHits};
}
export function runScatterStudy(){
    const shotgun=createWeaponState(spec);let consumed=0;let ticks=0,reloads=0;
    for(let i=0;i<60*18;i++){
        if(shotgun.loaded===0&&shotgun.reloadLeft===0&&startReload(shotgun,spec))reloads++;
        if(fireWeapon(shotgun,spec)!==null)consumed++;
        advanceWeapon(shotgun,spec,1/60);ticks++;
    }
    return {shotgun:{id:spec.id,pellets:spec.pellets,damagePerPellet:spec.damage,
        magazine:spec.magazine,recoilImpulseNs:spec.recoilImpulseNs,
        roundsFired:consumed,reloads,remainingRounds:shotgun.loaded+shotgun.reserve,
        seconds:ticks/60},
        comparison:[4,7,12,20,28].map(range=>patternAtRange(range))};
}
export function formatScatterStudy(report=runScatterStudy()){
    return [
        '# k.3v.6 Scattergun — 16-shell deterministic dispersion study',
        'Target: a circular 0.67m physical-sized aim area. Not invented damage falloff.',
        'Each trace can hit a different target/part in the actual game. This table ONLY measures geometric pellet dispersion.',
        '| Distance (m) | Shells | Pellet rays | Rays in target disk | Fraction | Nominal landed damage |',
        '| ---: | ---: | ---: | ---: | ---: | ---: |',
        ...report.comparison.map(row=>`| ${row.rangeMeters} | ${row.shots} | ${row.possiblePellets} | ${row.pelletHits} | ${row.hitFraction} | ${row.totalNominalDamage} |`),
        `Fired ${report.shotgun.roundsFired} shells in ${report.shotgun.seconds}s, with ${report.shotgun.reloads} actual magazine reloads.`,
    ].join('\n')+'\n';
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
    const report=runScatterStudy();
    process.stdout.write(process.argv.includes('--json')?JSON.stringify(report,null,2)+'\n':formatScatterStudy(report));
}
