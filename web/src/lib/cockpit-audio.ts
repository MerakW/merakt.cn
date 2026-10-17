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
  const cleanup=()=>{if(stopped)return;stopped=true;source.disconnect();gain.disconnect();analyser.disconnect();finish()}
  source.onended=cleanup;source.start()
  return {analyser,ended,stop:()=>{try{source.stop()}catch{}finally{cleanup()}}}
}
