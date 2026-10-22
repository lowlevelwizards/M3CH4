/** Build 8: small mirrored tactical smoke of AUTHORIZED legal five-module rigs.
 * No fabricated handling metrics for rejected catalogue recipes.
 *
 * node research/rosterCompetitiveStudy.mjs --pairs=2 --seconds=12
 * node research/rosterCompetitiveStudy.mjs --pairs=30 --seconds=150 --json
 *
 * Crucial limitation: the legacy Domination study approximates physical
 * first-hit mesh contacts, accuracy and some power response. This is a tactical
 * research proxy, NOT a demonstration of exact rendered combat balance.
 */
import { pathToFileURL } from 'node:url';
import { runRosterBalanceAudit } from './rosterBalanceAudit.mjs';
import { runBout } from './headlessDominationStudy.mjs';

const FAMILY={
    'legs-yard':'yard',
    'legs-compact':'kestrel',
    'legs-hauler':'hauler',
};
export const COHORTS=Object.freeze({
    'light-raiders-vs-workhorses':Object.freeze({
        a:['Lightweight precision','Lightweight raider','Lightweight precision'],
        b:['Balanced workhorse','Balanced workhorse','Balanced workhorse'],
    }),
    'heavy-anchors-vs-light-raiders':Object.freeze({
        a:['Heavy anchor','Heavy protected command','Heavy anchor'],
        b:['Lightweight precision','Lightweight raider','Lightweight precision'],
    }),
    'mixed-vs-specialized':Object.freeze({
        a:['Balanced workhorse','Lightweight precision','Heavy anchor'],
        b:['Balanced workhorse','Balanced workhorse','Balanced workhorse'],
    }),
});
const counter=x=>Math.round(x*10000)/10000;
const mean=x=>x.length?counter(x.reduce((s,n)=>s+n,0)/x.length):null;
/** Two-sided Wilson interval for match wins, counting a draw as half-win. */
export function winConfidence(wins,draws,n){
    if(!n)return {low:0,high:1};
    const p=(wins+draws*.5)/n,z=1.96,d=1+z*z/n;
    const centre=(p+z*z/(2*n))/d;
    const extent=z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/d;
    return {low:counter(Math.max(0,centre-extent)),high:counter(Math.min(1,centre+extent))};
}
function recipeFor(name,reference){
    const record=reference[name];
    if(!record)throw Error('Unknown tournament reference '+name);
    if(!record.ready)throw Error('Do not enter illegal assembly '+name);
    const recipe=record.recipe;
    return {name,pilot:FAMILY[recipe.mobility],recipe};
}
export function runRosterCompetitiveStudy({pairs=2,seconds=12,accuracy=.7,seed=20261022}={}){
    if(!Number.isInteger(pairs)||pairs<1||pairs>200)throw Error('pairs must be integer 1–200');
    if(!(seconds>=1&&seconds<=210))throw Error('seconds outside 1–210');
    if(!(accuracy>=0&&accuracy<=1))throw Error('accuracy outside 0–1');
    const roster=runRosterBalanceAudit();
    const results=[];
    for(const [name,selection] of Object.entries(COHORTS)){
        const a=selection.a.map(x=>recipeFor(x,roster.references));
        const b=selection.b.map(x=>recipeFor(x,roster.references));
        const bouts=[];
        for(let pair=0;pair<pairs;pair++)for(const swapped of [false,true]){
            const friendly=swapped?b:a,hostile=swapped?a:b;
            const seedValue=seed+pair*7919+Object.keys(COHORTS).indexOf(name)*104729;
            const bout=runBout(seedValue,{
                name,accuracy,policy:'strict',maxSeconds:seconds,
                rosters:{friendly,hostile},
            });
            const aTeam=swapped?'hostile':'friendly';
            const won=bout.win==='draw'?'draw':bout.win===aTeam?'a':'b';
            const actors=bout.actors.filter(x=>x.team===aTeam);
            bouts.push({
                seed:seedValue,swapped,winner:won,ending:bout.winReason,
                seconds:bout.time,
                aScore:bout.points[aTeam],
                bScore:bout.points[aTeam==='friendly'?'hostile':'friendly'],
                aDamage:counter(actors.reduce((n,x)=>n+x.damageDealt,0)),
                aTravel:counter(actors.reduce((n,x)=>n+x.travel,0)),
                aCaptures:actors.reduce((n,x)=>n+x.captures,0),
                aRouteErrors:actors.reduce((n,x)=>n+x.routeErrors,0),
                shotTriggers:actors.reduce((n,x)=>n+x.shotTriggers,0),
                aSurvivors:actors.filter(x=>x.alive).length,
            });
        }
        const wins=bouts.filter(x=>x.winner==='a').length,
            losses=bouts.filter(x=>x.winner==='b').length,
            draws=bouts.length-wins-losses;
        results.push({
            name,
            recipes:{a:selection.a,b:selection.b},
            bouts:bouts.length,
            wins,losses,draws,winRate:counter((wins+draws/2)/bouts.length),
            win95:winConfidence(wins,draws,bouts.length),
            meanADamage:mean(bouts.map(x=>x.aDamage)),
            meanACaptures:mean(bouts.map(x=>x.aCaptures)),
            meanARouteErrors:mean(bouts.map(x=>x.aRouteErrors)),
            boutRecords:bouts,
        });
    }
    return {
        schemaVersion:1,
        evidence:'validated live catalogue, shared AI tactics, physical locomotion, objective scoring; paired seeds and team-side reversals',
        modelLimitations:'headless aiming, module hit probabilities and electrical transients approximate actual gameplay; use real-mesh and power cohorts as separate evidence',
        sample:{pairs,seconds,accuracy,seed}, roster:{definitions:roster.summary.definitions,
            legal:roster.summary.legal,rejected:roster.summary.rejected},
        cohorts:results,
    };
}
export function formatRosterCompetitiveStudy(report=runRosterCompetitiveStudy()){
    return ['# M3CH4 Build 8 — preliminary tactical proxy (NOT final balance verdict)','',
        'Sample: '+JSON.stringify(report.sample)+'; real-assembly legality '+JSON.stringify(report.roster)+'.',
        '**Critical caveat:** '+report.modelLimitations+'.','',
        '| Cohort | Bouts | A wins | B wins | Draws | A win rate | 95% Wilson interval | Mean A damage | Mean A route faults |',
        '| --- | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: |',
        ...report.cohorts.map(c=>'| '+[c.name,c.bouts,c.wins,c.losses,c.draws,c.winRate,
            c.win95.low+'–'+c.win95.high,c.meanADamage,c.meanARouteErrors].join(' | ')+' |'),
        '',
        'Do not tune equipment from small proxy win-rate gaps. Corroborate with renderer-backed contacts, generator brownouts and iPhone testing.',
    ].join('\n')+'\n';
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
    const argument=(key,fallback)=>process.argv.find(s=>s.startsWith('--'+key+'='))?.split('=')[1]??fallback;
    const report=runRosterCompetitiveStudy({
        pairs:Number(argument('pairs',2)),seconds:Number(argument('seconds',12)),
        accuracy:Number(argument('accuracy',.7)),seed:Number(argument('seed',20261022)),
    });
    process.stdout.write(process.argv.includes('--json')?
        JSON.stringify(report,null,2)+'\n':formatRosterCompetitiveStudy(report));
}
