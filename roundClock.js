/** Fixed-step round regulation. No wall-clock or background time.
 * This layer ONLY decides a timeout winner: real scoring, armor/part damage
 * and survivor state remain authoritative in their existing systems.
 */
export const REGULATION_SECONDS=180;
export const OVERTIME_SECONDS=20;
const score=(s,t)=>['domination','control','breakthrough'].includes(s?.type)
  ? Number(s?.[t+'Progress'])||0 : 0;
const owned=(s,t)=>s?.domination?.points?.filter(p=>p.owner===t&&!p.contested).length??0;
const active=(roster,t)=>roster.filter(p=>p?.team===t&&p?.active!==false);
const integrity=roster=>roster.reduce((sum,p)=>{
 const parts=Object.values(p.condition?.parts??{});
 return sum+(parts.length?parts.reduce((n,part)=>
  n+Math.max(0,Math.min(1,Number(part?.integrity??0)/Math.max(1,Number(part?.maxIntegrity??1)))),0)/parts.length:0);
},0);
export function createRoundClock(limitSeconds=REGULATION_SECONDS,overtimeSeconds=OVERTIME_SECONDS){
 return {elapsed:0,limitSeconds:Math.max(1,limitSeconds),
  overtimeSeconds:Math.max(0,overtimeSeconds),overtime:false,complete:false};
}
/** No hidden targeting data: scoreboard, public zones and own visible roster. */
export function timeDecision(s,roster=[]){
 const f=score(s,'friendly'),h=score(s,'hostile');
 if(Math.abs(f-h)>1e-4)return {team:f>h?'friendly':'hostile',criterion:'OBJECTIVE SCORE'};
 if(s?.type==='domination'){
  const a=owned(s,'friendly'),b=owned(s,'hostile');
  if(a!==b)return {team:a>b?'friendly':'hostile',criterion:'SCORING TERRITORY'};
 }
 const a=active(roster,'friendly'),b=active(roster,'hostile');
 if(a.length!==b.length)return {team:a.length>b.length?'friendly':'hostile',criterion:'SURVIVING RIGS'};
 const x=integrity(a),y=integrity(b);
 if(Math.abs(x-y)>1e-4)return {team:x>y?'friendly':'hostile',criterion:'REMAINING INTEGRITY'};
 // Under an exact draw the challenger has not secured the contract.
 return {team:'hostile',criterion:'DEFENDER HOLDS EXACT TIE'};
}
export function advanceRoundClock(c,dt,s,roster=[]){
 if(!c||c.complete||!Number.isFinite(dt)||dt<=0)return null;
 c.elapsed+=dt;
 if(c.elapsed+1e-7<c.limitSeconds)return null;
 const tied=Math.abs(score(s,'friendly')-score(s,'hostile'))<1e-4;
 if(!c.overtime&&c.overtimeSeconds>0&&s?.type==='domination'&&(s.contested||tied))
  c.overtime=true;
 if(c.overtime&&c.elapsed<c.limitSeconds+c.overtimeSeconds-1e-7 &&
    (s?.contested||tied))return null;
 c.complete=true;
 const decision=timeDecision(s,roster);
 return {winner:decision.team,victory:decision.team==='friendly',
  reason:(c.overtime?'OVERTIME':'TIME LIMIT')+' · '+decision.criterion};
}
export function formatRoundClock(c){
 if(!c)return '—';
 const seconds=Math.max(0,Math.ceil(
  (c.overtime?c.limitSeconds+c.overtimeSeconds:c.limitSeconds)-c.elapsed-1e-7));
 const formatted=String(Math.floor(seconds/60)).padStart(2,'0')+':'+
  String(seconds%60).padStart(2,'0');
 return c.overtime?'OT '+formatted:formatted;
}
