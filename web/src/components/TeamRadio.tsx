'use client'
import Localized, { useTranslator } from '@/components/Localized'
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { usePathname } from 'next/navigation'
import { safeLink } from '@/lib/gallery'
import { imageURL, assetURL } from '@/lib/assets'
import { radioClip, radioNoise, radioElement, type RadioPlayback } from '@/lib/cockpit-audio'
import { radioPhrases } from '@/lib/radio-phrases'
import ArrowIcon from './ArrowIcon'
type RadioMessage={speaker:string;message:string;id?:string|null}
function Conversation({messages,onComplete}:{messages:RadioMessage[];onComplete:()=>void}) {
 const t = useTranslator()
 const [elapsed,setElapsed]=useState(0), signature=messages.map(m=>`${m.speaker}:${m.message}`).join('\n')
 useEffect(()=>{
  const total=messages.reduce((n,m)=>n+Math.min(1100,Math.max(180,Array.from(m.message).length*14)),0)
  if(matchMedia('(prefers-reduced-motion: reduce)').matches){setElapsed(Infinity);onComplete();return}
  let frame=0;const start=performance.now()
  const tick=(now:number)=>{setElapsed(now-start);if(now-start<total)frame=requestAnimationFrame(tick);else onComplete()}
  frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame)
 },[signature,onComplete])
 let start=0
 return <Localized><div className="radio-conversation">{messages.map((message,index)=>{const chars=Array.from(message.message),duration=Math.min(1100,Math.max(180,chars.length*14)),progress=Math.max(0,Math.min(1,(elapsed-start)/duration));start+=duration;return progress>0?<blockquote data-i18n="off" key={message.id||index} data-speaker={message.speaker} aria-label={`${t(message.speaker==='team'?'ui.team2':'ui.driver')}：${message.message}`}><span aria-hidden="true">“{chars.slice(0,Math.ceil(progress*chars.length)).join('')}”</span></blockquote>:null})}</div></Localized>
}
export default function TeamRadio({note}:{note?:{text:string;radioMessages?:{speaker:'team'|'driver';message:string;id?:string|null}[]|null;date:string;link?:string|null}}){
 const [replied,setReplied]=useState(false),[ending,setEnding]=useState(false),[countdown,setCountdown]=useState<number|null>(null)
 const [open,setOpen]=useState(false),[muted,setMuted]=useState(false),[soundError,setSoundError]=useState(''),[playing,setPlaying]=useState(false),[run,setRun]=useState(0),[started,setStarted]=useState(false),[ready,setReady]=useState(false),[ptt,setPtt]=useState(false),[replies,setReplies]=useState<string[]>([]),[replying,setReplying]=useState(false)
 const noiseTimer=useRef<ReturnType<typeof setTimeout>|null>(null)
 const trigger=useRef<HTMLButtonElement>(null),sound=useRef<HTMLAudioElement>(null),wave=useRef<HTMLDivElement>(null),playback=useRef<RadioPlayback|null>(null),frame=useRef(0),sequence=useRef(0),request=useRef<AbortController|null>(null),sounding=useRef(false)
 const pathname=usePathname(),complete=useCallback(()=>setReady(true),[]),replyComplete=useCallback(()=>{setReplying(false);setEnding(true)},[])
 const messages=note?.radioMessages?.length?note.radioMessages:[{id:'fallback',speaker:'driver',message:note?.text||'Copy, head down. Next year is our year.'}]
 const stopAudio=()=>{sequence.current++;if(noiseTimer.current)clearTimeout(noiseTimer.current);request.current?.abort();playback.current?.stop();playback.current=null;sound.current?.pause();sounding.current=false;setPlaying(false)}
 const close=useCallback(()=>{setOpen(false);setEnding(false);setCountdown(null);sequence.current++;if(noiseTimer.current)clearTimeout(noiseTimer.current);request.current?.abort();playback.current?.stop();playback.current=null;sound.current?.pause();sounding.current=false;setPlaying(false);trigger.current?.focus()},[])
 useEffect(()=>{setOpen(false);stopAudio();return()=>{sequence.current++;if(noiseTimer.current)clearTimeout(noiseTimer.current);request.current?.abort();playback.current?.stop();cancelAnimationFrame(frame.current);sound.current?.pause()}},[pathname])
 useEffect(()=>{if(!open)return;const key=(e:KeyboardEvent)=>{if(e.key==='Escape')close()};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key)},[open])
 useEffect(()=>{
  if(!open)return
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches
  const tick=(time:number)=>{
   const analyser=playback.current?.analyser, bins=analyser?new Uint8Array(analyser.frequencyBinCount):null
   if(analyser&&bins)analyser.getByteFrequencyData(bins)
   wave.current?.querySelectorAll<HTMLElement>('span').forEach((bar,i)=>{const level=bins&&sounding.current?14+bins[i*3]/255*86:reduced?48:30+Math.abs(Math.sin(time/330+i*.7))*45+Math.sin(time/137+i)*8;bar.style.setProperty('--wave-height',`${level}%`)})
   frame.current=requestAnimationFrame(tick)
  }
  frame.current=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame.current)
 },[open])
 async function cue(url:string,controller:AbortController,current:number){
  const timeout=setTimeout(()=>controller.abort(),8000)
  try{
   try{
    const clip=await radioClip(url,controller.signal)
    if(current!==sequence.current){clip.stop();return}
    playback.current=clip;sounding.current=true;await clip.ended
   }catch{
    controller.signal.throwIfAborted()
    if(!sound.current)throw new Error('Audio unavailable')
    sounding.current=true;await radioElement(sound.current,url,controller.signal)
   }
  }finally{clearTimeout(timeout);if(current===sequence.current){sounding.current=false;playback.current=null;setPlaying(false)}}
 }
 async function play(){
  stopAudio();setSoundError('');setReady(false);setStarted(true);setPtt(false);setRun(n=>n+1);setReplies([]);setReplying(false);setReplied(false);setEnding(false);setCountdown(null)
  if(muted){setStarted(true);return}
  setPlaying(true);const current=sequence.current,controller=new AbortController();request.current=controller
  try{await cue(assetURL('/audio/f1-radio-start.mp3'),controller,current)}catch{if(current===sequence.current)setSoundError('@i18n:ui.audioCouldNotPlaySelectReplayToTry@')}
  if(current!==sequence.current)return
  setStarted(true)
  if(!controller.signal.aborted){try{playback.current=await radioNoise(controller.signal);sounding.current=true;noiseTimer.current=setTimeout(()=>{if(current===sequence.current){playback.current?.stop();playback.current=null;sounding.current=false}},700)}catch{}}
 }
 useEffect(()=>{
  if(!open||!ending)return
  stopAudio();const current=sequence.current,controller=new AbortController();request.current=controller
  async function finish(){
   if(!muted){setPlaying(true);try{await cue(assetURL('/audio/f1-radio-end.mp3'),controller,current)}catch{if(current===sequence.current)setSoundError('@i18n:ui.audioCouldNotPlaySelectReplayToTry@')}}
   if(current===sequence.current){setEnding(false);setCountdown(5)}
  }
  void finish()
  return()=>controller.abort()
 },[open,ending,muted])
 useEffect(()=>{
  if(!open||countdown===null)return
  if(countdown===0){close();return}
  const timer=setTimeout(()=>setCountdown(n=>n===null?null:n-1),1000)
  return()=>clearTimeout(timer)
 },[open,countdown,close])
 function reply(message:string){if(replying||replied)return;stopAudio();setReplied(true);setReplies([message]);setReplying(true);setPtt(false);navigator.vibrate?.(20)}
 if(pathname.startsWith('/manage')||pathname==='/pit-wall')return null
 return <Localized><div className="radio-dock" data-open={open}><audio ref={sound} src={assetURL('/audio/f1-radio-start.mp3')} preload="none"/>
 <button ref={trigger} className="radio-toggle" aria-expanded={open} aria-controls="team-radio-panel" onClick={()=>{if(open)close();else{setOpen(true);void play()}}}><b>51</b><span>TEAM<br/>RADIO</span><i aria-hidden="true">{open?'−':'+'}</i></button>
 {open&&<aside id="team-radio-panel" className="radio-popup" aria-labelledby="radio-title" data-playing={playing}><button className="radio-close" onClick={close} aria-label="@i18n:ui.closeTeamRadio@">×</button><div className="radio-broadcast"><h2 id="radio-title"><span>MERAK</span><br/>RADIO</h2><div className="radio-signal"><b>51</b><img src={imageURL('/team-logos/ferrari-hq.svg')} width="68" height="78" alt="Ferrari"/></div><div ref={wave} className="radio-wave" aria-hidden="true">{[48,83,100,100,84,90,74,57,52].map((height,i)=><span key={i} style={{'--wave-height':`${height}%`} as CSSProperties}><i/><i/></span>)}</div></div>
 {started?<Conversation key={run} messages={messages} onComplete={complete}/>:null}
 {replies.map((text,index)=>index===replies.length-1&&replying?<Conversation key={`reply-${index}-${text}`} messages={[{speaker:'team',message:text}]} onComplete={replyComplete}/>:<div className="radio-conversation" key={`reply-${index}-${text}`}><blockquote data-i18n="off" data-speaker="team">“{text}”</blockquote></div>)}
 <div className="radio-interactions">{ready&&!replied&&<button className="radio-reply-button" aria-expanded={ptt} onClick={()=>setPtt(!ptt)}><span>PTT / REPLY</span><ArrowIcon/></button>}{ready&&!replied&&ptt&&<div className="ptt-phrases">{radioPhrases.map(phrase=><button key={phrase} onClick={()=>reply(phrase)}>{phrase}<ArrowIcon/></button>)}</div>}</div>
 <p className="radio-countdown" role="status">{countdown!==null?`@i18n:radio.closeIn:${encodeURIComponent(JSON.stringify([countdown]))}@`:ending?"@i18n:radio.signingOff@":null}</p><footer><time>{note?note.date.slice(0,10).replaceAll('-','.'):'STANDBY'}</time><div><button onClick={()=>void play()}>{"@i18n:ui.replay@"}</button><button aria-pressed={muted} onClick={()=>{setMuted(!muted);stopAudio();if(!started)setStarted(true)}}>{muted?"@i18n:ui.soundOff@":"@i18n:ui.soundOn@"}</button>{safeLink(note?.link)&&<a href={safeLink(note?.link)}>{"@i18n:ui.original@ "}<ArrowIcon direction="up-right"/></a>}</div></footer>{soundError&&<p role="status" className="radio-sound-error">{soundError}</p>}</aside>}
 </div></Localized>
}
