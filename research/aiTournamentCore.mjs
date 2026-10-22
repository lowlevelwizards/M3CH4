/** Scoring and matched-side accounting for the M3CH4 AI research tournament.
 * This is an exploratory multi-objective grade, not an intrinsic AI IQ score.
 * All source metrics remain in the report for independent interpretation.
 */
export const GRADE_WEIGHTS=Object.freeze({match:50,territory:20,combat:15,
  movement:10,survival:5});
const clamp=(n,a=0,b=1)=>Math.min(b,Math.max(a,n));
const sum=(array,key)=>array.reduce((a,item)=>a+(Number(key(item))||0),0);
const mean=values=>values.length?sum(values,x=>x)/values.length:0;
const round=(n,d=3)=>Number(n.toFixed(d));
export function entrantId(strategy,difficulty='pro'){return strategy+'@'+difficulty;}
export function parseEntrant(id,getStrategy,getDifficulty){
  const [strategy,difficulty='pro',extra]=String(id).split('@');
  if(!strategy||extra)throw new Error('Invalid entrant: '+id);
  getStrategy(strategy);getDifficulty(difficulty);
  return Object.freeze({id:entrantId(strategy,difficulty),strategy,difficulty});
}
function sideMetrics(bout,team){
  const rigs=bout.actors.filter(a=>a.team===team);
  return {damage:sum(rigs,a=>a.damageDealt),
    kills:sum(rigs,a=>a.kills),zoneSeconds:sum(rigs,a=>a.zoneSeconds),
    captures:sum(rigs,a=>a.captures),routeErrors:sum(rigs,a=>a.routeErrors),
    trafficYields:sum(rigs,a=>a.trafficYields),
    routeSwitches:sum(rigs,a=>a.routeSwitches),
    stallSeconds:sum(rigs,a=>a.stallSeconds),
    collisions:sum(rigs,a=>a.collisionImpacts),
    targetSwitches:sum(rigs,a=>a.targetSwitches),
    deaths:rigs.filter(a=>!a.alive).length,
    survival:rigs.filter(a=>a.alive).length/Math.max(1,rigs.length),
    teamSize:rigs.length};
}
export function gradeTeam(bout,team){
  const rival=team==='friendly'?'hostile':'friendly';
  const own=sideMetrics(bout,team),opponent=sideMetrics(bout,rival);
  const match=bout.win==='draw'?.5:bout.win===team?1:0;
  const territory=clamp(.5+(bout.points[team]-bout.points[rival])/120);
  const combat=clamp(.5+(own.damage-opponent.damage)/
    (2*Math.max(1,own.damage+opponent.damage)));
  const duration=Math.max(1,bout.time),size=Math.max(1,own.teamSize);
  // Use a per-rig per-second fault RATE. A legitimate stationary defender
  // is not penalized: stalled seconds accrue only during an active route.
  const badness=(own.stallSeconds*.20+own.routeErrors*1.5+
    own.collisions*.5)/(size*duration);
  const movement=clamp(1-badness);
  const survival=own.survival;
  const components={match,territory,combat,movement,survival};
  const grade=Object.entries(GRADE_WEIGHTS).reduce((total,[key,weight])=>
    total+components[key]*weight,0);
  return {grade:round(grade,2),components:Object.fromEntries(
    Object.entries(components).map(([k,v])=>[k,round(v,4)])),
    stats:own};
}
/** Wilson-style approximate interval for win-equivalents, draws = half.
 * Useful for warning against tiny samples; paired bootstrap is recommended
 * before accepting a policy for production. */
export function approximateWinInterval(wins,draws,n,z=1.96){
  if(!n)return [0,1];
  const p=(wins+draws*.5)/n,z2=z*z,den=1+z2/n;
  const center=(p+z2/(2*n))/den;
  const half=z/den*Math.sqrt(p*(1-p)/n+z2/(4*n*n));
  return [round(clamp(center-half)),round(clamp(center+half))];
}
export function summarizeTournament(entries,results){
  const table=new Map(entries.map(e=>[e.id,{id:e.id,strategy:e.strategy,
    difficulty:e.difficulty,bouts:0,wins:0,losses:0,draws:0,
    grades:[],zones:[],damage:[],stalls:[],collisions:[],routes:[],
    services:[],scores:[],outcomes:{}}]));
  const byPair={};
  for(const record of results){
    const key=[record.a,record.b].sort().join(' vs ');
    const pair=byPair[key]??={entrants:[...new Set([record.a,record.b])].sort(),
      bouts:0,wins:{},draws:0,meanGrade:{}};
    pair.bouts++;
    if(record.winner==='draw')pair.draws++;
    else pair.wins[record.winner]=(pair.wins[record.winner]??0)+1;
    for(const side of ['friendly','hostile']){
      const id=record.sides[side];
      const row=table.get(id);
      if(!row)throw new Error('Unregistered entrant '+id);
      const score=record.grades[side],stats=score.stats;
      row.bouts++;
      if(record.winner==='draw')row.draws++;
      else if(record.winner===id)row.wins++;
      else row.losses++;
      row.grades.push(score.grade);
      row.zones.push(stats.zoneSeconds);
      row.damage.push(stats.damage);
      row.stalls.push(stats.stallSeconds);
      row.collisions.push(stats.collisions);
      row.routes.push(stats.routeErrors);
      row.scores.push(record.points[side]);
      (pair.meanGrade[id]??=[]).push(score.grade);
    }
  }
  const ranks=[...table.values()].map(row=>({
    id:row.id,strategy:row.strategy,difficulty:row.difficulty,
    matches:row.bouts,wins:row.wins,losses:row.losses,draws:row.draws,
    winEquivalent:round((row.wins+.5*row.draws)/Math.max(1,row.bouts)),
    approximateWin95:approximateWinInterval(row.wins,row.draws,row.bouts),
    grade:round(mean(row.grades),2),
    meanZoneSeconds:round(mean(row.zones),2),
    meanDamage:round(mean(row.damage),2),
    meanStallSeconds:round(mean(row.stalls),2),
    meanCollisions:round(mean(row.collisions),2),
    meanRouteErrors:round(mean(row.routes),2),
    meanObjectivePoints:round(mean(row.scores),2)
  })).sort((a,b)=>b.winEquivalent-a.winEquivalent||
    b.grade-a.grade||a.id.localeCompare(b.id));
  return {ranking:ranks,headToHead:Object.fromEntries(
    Object.entries(byPair).map(([name,p])=>[name,{
      entrants:p.entrants,bouts:p.bouts,draws:p.draws,wins:p.wins,
      meanGrade:Object.fromEntries(Object.entries(p.meanGrade)
        .map(([id,grades])=>[id,round(mean(grades),2)]))
    }]))};
}
