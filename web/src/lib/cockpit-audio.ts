export type RadioPlayback = { analyser: AnalyserNode; stop: () => void; ended: Promise<void> }
let context: AudioContext | undefined
export async function audioContext() {
  context ??= new AudioContext()
  if(context.state==='suspended')await context.resume()
  return context
}
export async function startBeep() {
  const ctx=await audioContext(), osc=ctx.createOscillator(), gain=ctx.createGain()
  osc.frequency.value=880;gain.gain.setValueAtTime(.035,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.09)
  osc.connect(gain).connect(ctx.destination);osc.start();osc.stop(ctx.currentTime+.1)
  osc.onended=()=>{osc.disconnect();gain.disconnect()}
}
const clips=new Map<string,AudioBuffer>()
export async function radioClip(url: string, signal: AbortSignal): Promise<RadioPlayback> {
  const ctx=await audioContext()
  let buffer=clips.get(url)
  if(!buffer){const res=await fetch(url,{mode:'cors',credentials:'omit',signal});if(!res.ok)throw new Error('Audio unavailable');buffer=await ctx.decodeAudioData(await res.arrayBuffer());clips.set(url,buffer)}
  signal.throwIfAborted()
  const source=ctx.createBufferSource(),gain=ctx.createGain(),analyser=ctx.createAnalyser()
  source.buffer=buffer;gain.gain.value=.45;analyser.fftSize=64
  source.connect(gain).connect(analyser).connect(ctx.destination)
  let finish:()=>void=()=>{};const ended=new Promise<void>(resolve=>{finish=resolve});let stopped=false
  const cleanup=()=>{if(stopped)return;stopped=true;signal.removeEventListener('abort',stop);source.disconnect();gain.disconnect();analyser.disconnect();finish()}
  const stop=()=>{if(stopped)return;try{source.stop()}catch{}finally{cleanup()}}
  source.onended=cleanup;signal.addEventListener('abort',stop,{once:true});source.start()
  return {analyser,ended,stop}
}

/** Quiet band-limited static while the radio channel is open. */
export async function radioNoise(signal: AbortSignal): Promise<RadioPlayback> {
  const ctx=await audioContext()
  signal.throwIfAborted()
  const buffer=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate),samples=buffer.getChannelData(0)
  for(let i=0;i<samples.length;i++)samples[i]=Math.random()*2-1
  const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),gain=ctx.createGain(),analyser=ctx.createAnalyser()
  source.buffer=buffer;source.loop=true;filter.type='bandpass';filter.frequency.value=1500;filter.Q.value=.7;gain.gain.value=.018;analyser.fftSize=64
  source.connect(filter).connect(gain).connect(analyser).connect(ctx.destination)
  let stopped=false,finish=()=>{};const ended=new Promise<void>(resolve=>{finish=resolve})
  const stop=()=>{if(stopped)return;stopped=true;source.stop();source.disconnect();filter.disconnect();gain.disconnect();analyser.disconnect();signal.removeEventListener('abort',stop);finish()}
  signal.addEventListener('abort',stop,{once:true});source.start()
  return {analyser,ended,stop}
}

/** HTML audio remains usable when a remote server does not expose CORS. */
export function radioElement(audio: HTMLAudioElement, url: string, signal: AbortSignal): Promise<void> {
  return new Promise((resolve,reject)=>{
    signal.throwIfAborted()
    const cleanup=()=>{audio.removeEventListener('ended',done);audio.removeEventListener('error',fail);signal.removeEventListener('abort',abort)}
    const done=()=>{cleanup();resolve()}
    const fail=()=>{cleanup();reject(new Error('Audio unavailable'))}
    const abort=()=>{audio.pause();cleanup();reject(signal.reason)}
    audio.src=url;audio.currentTime=0;audio.volume=.45
    audio.addEventListener('ended',done,{once:true});audio.addEventListener('error',fail,{once:true});signal.addEventListener('abort',abort,{once:true})
    audio.play().catch(fail)
  })
}
