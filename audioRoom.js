/** Shared per-bus industrial interior reflections. No convolution kernel,
 * feedback delay or per-hit reverb chains. Four short dark room bounces
 * suggest concrete/steel while remaining cheap for mobile WebAudio.
 */
export function buildIndustrialRoom(ctx,output,{bassDb=3}={}){
  const body=ctx.createBiquadFilter();
  body.type='lowshelf';body.frequency.value=165;body.gain.value=bassDb;
  body.connect(output);
  const send=ctx.createGain();send.gain.value=1;
  const dark=ctx.createBiquadFilter();dark.type='lowpass';
  dark.frequency.value=1900;
  send.connect(dark);
  const taps=[[.034,.29],[.084,.24],[.147,.15],[.218,.085]];
  for(const [seconds,amount] of taps){
    const delay=ctx.createDelay(.30);delay.delayTime.value=seconds;
    const level=ctx.createGain();level.gain.value=amount;
    dark.connect(delay);delay.connect(level);level.connect(body);
  }
  return {dry:body,send,taps:taps.length};
}
