/** Background PCM warmup for production audio (not the audition labs).
 * Worker keeps synthesis off the animation/physics thread. No WebAudio
 * context or audio node exists until a real user gesture unlocks playback.
 */
const prepared=new Map();
let worker=null,started=false,failed=false,finished=false,received=0;
const key=(family,id,variant=0)=>family+'/'+id+'/'+variant;
export function warmPCM(family,id,variant=0){return prepared.get(key(family,id,variant))??null;}
export function cacheWarmPCM(family,id,variant,pcm,rate){
  if(!(pcm instanceof Float32Array)||!pcm.length||!Number.isFinite(rate))return;
  prepared.set(key(family,id,variant),{pcm,rate});
}
export function warmupStatus(){
  return {started,finished,failed,received,count:prepared.size};
}
export function beginAudioWarmup(){
  if(started)return;
  started=true;
  if(typeof Worker==='undefined'){
    failed=true;
    return;
  }
  try {
    worker=new Worker(new URL('./audioWarmWorker.js?v=k4w4',import.meta.url),{type:'module'});
    worker.onmessage=({data})=>{
      if(data?.ready){finished=true;worker.terminate();worker=null;return;}
      if(data?.pcm instanceof Float32Array){
        cacheWarmPCM(data.family,data.id,data.variant,data.pcm,data.rate);
        received++;
      }
    };
    worker.onerror=()=>{
      failed=true;
      if(worker){worker.terminate();worker=null;}
    };
  }catch{failed=true;}
}
