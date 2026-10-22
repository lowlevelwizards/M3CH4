/** Conditional Hauler nominal draw trial. Uses actual catalogue and inspected
 * mounting/load results; no illegal recipe receives fake handling metrics.
 * node research/haulerElectricalTrial.mjs [--json]
 */
import { pathToFileURL } from 'node:url';
import { runRosterBalanceAudit } from './rosterBalanceAudit.mjs';

export function runHaulerElectricalTrial(){
    const report=runRosterBalanceAudit();
    const liveKw=report.catalogue.find(p=>p.id==='legs-hauler')?.powerKw;
    const currentDraw=-liveKw;
    const candidates=[115,110,105].map(draw=>{
        let total=0,hauler=0,headroom=[];
        for(const row of report.combinations){
            const actualDraw=row.recipe.mobility==='legs-hauler'?currentDraw:0;
            const proposedDraw=row.recipe.mobility==='legs-hauler'?draw:0;
            const predictedHeadroom=row.nominalPowerHeadroomKw+actualDraw-proposedDraw;
            const physical=row.mountingValid && row.structuralLoadMarginKg>=0 && row.mobilityLoadMarginKg>=0;
            if(physical&&predictedHeadroom>=0){
                total++;if(row.recipe.mobility==='legs-hauler'){hauler++;headroom.push(predictedHeadroom);}
            }
        }
        return {drawKw:draw,totalLegal:total,haulerLegal:hauler,
            haulerMinHeadroomKw:headroom.length?Math.min(...headroom):null,
            haulerMaxHeadroomKw:headroom.length?Math.max(...headroom):null};
    });
    return {source:'inspectAssembly structural/mount/power authority, candidate-only nominal demand replacement',
        evidence:'electrical legality, NOT bus transients, competitive win rate or motor response',
        currentDrawKw:currentDraw,candidates};
}
export function formatHaulerElectricalTrial(r=runHaulerElectricalTrial()){
    return ['# Hauler nominal kW candidate legality', '',
        '| Draw kW | Legal recipes | Legal Hauler recipes | Minimum Hauler headroom |',
        '| ---: | ---: | ---: | ---: |',
        ...r.candidates.map(c=> '| '+[c.drawKw,c.totalLegal,c.haulerLegal,c.haulerMinHeadroomKw].join(' | ')+' |'),
        ''].join('\n');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
    const r=runHaulerElectricalTrial();
    process.stdout.write(process.argv.includes('--json')?JSON.stringify(r,null,2)+'\n':formatHaulerElectricalTrial(r));
}
