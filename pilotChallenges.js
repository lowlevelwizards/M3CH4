/** B.3 short, zero-cost handling challenges. Deliberately session-only:
 * no achievements/save files, credits, rewards or combat integrations.
 */
export const PILOT_CHALLENGES=Object.freeze({
 free:Object.freeze({id:'free',label:'FREE WALK',checkpoints:[]}),
 precision:Object.freeze({id:'precision',label:'PRECISION STOP',
   checkpoints:[Object.freeze({x:0,z:13,radius:1.6,stop:true})]}),
 slalom:Object.freeze({id:'slalom',label:'SLOW-SPEED SLALOM',
   checkpoints:[{x:-4,z:16,radius:2.1},{x:4,z:9,radius:2.1},
     {x:-4,z:1,radius:2.2},{x:0,z:-6,radius:1.8,stop:true}]}),
 climb:Object.freeze({id:'climb',label:'LOADING DOCK',
   checkpoints:[{x:0,z:11.5,radius:1.8,stop:true}]}),
 haul:Object.freeze({id:'haul',label:'HEAVY HAUL',
   checkpoints:[Object.freeze({x:0,z:8,radius:2.1,propId:'tool-chest'})]}),
});
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export function createPilotChallenge(id='free'){
 const spec=PILOT_CHALLENGES[id]??PILOT_CHALLENGES.free;
 return {id:spec.id,started:false,complete:false,elapsed:0,
   progress:0,hold:0,best:null,lastProgress:0};
}
export function advancePilotChallenge(challenge,rig,props=[],dt=1/60){
 if(!challenge||challenge.id==='free'||challenge.complete)return challenge;
 const spec=PILOT_CHALLENGES[challenge.id];
 if(!spec)return challenge;
 const safeDt=clamp(Number.isFinite(dt)?dt:0,0,.1);
 if(!challenge.started){
   // No automatic countdown; the first deliberate movement starts the clock.
   if(Math.hypot((rig.x??0),(rig.z??22)-22)>.8)challenge.started=true;
   else return challenge;
 }
 challenge.elapsed+=safeDt;
 const gate=spec.checkpoints[challenge.progress];
 if(!gate)return challenge;
 let target=rig;
 if(gate.propId){
   target=props.find(x=>x.id===gate.propId);
   if(!target)return challenge;
 }
 const inside=Math.hypot((target.x??0)-gate.x,(target.z??0)-gate.z)<=gate.radius;
 const speed=Math.hypot(rig.vx??0,rig.vz??0);
 const settled=!gate.stop||speed<=.30;
 challenge.hold=inside&&settled?challenge.hold+safeDt:0;
 if(challenge.hold>=(gate.stop?.6:.10)){
   challenge.progress++;
   challenge.lastProgress=challenge.elapsed;
   challenge.hold=0;
   if(challenge.progress>=spec.checkpoints.length){
     challenge.complete=true;
     challenge.best=challenge.elapsed;
   }
 }
 return challenge;
}
export function challengePrompt(challenge){
 if(!challenge||challenge.id==='free')return 'FREE WALK · NO SCORE';
 const s=PILOT_CHALLENGES[challenge.id];
 if(challenge.complete)return 'COMPLETE · '+challenge.elapsed.toFixed(1)+' SEC';
 const g=s.checkpoints[challenge.progress];
 if(!g)return 'FINISHED';
 return s.label+' · '+(challenge.progress+1)+'/'+s.checkpoints.length+
   (g.propId?' · PUSH TOOL CHEST':g.stop?' · STOP AND SETTLE':' · DRIVE THROUGH');
}
