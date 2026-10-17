'use client'
import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { usePathname } from 'next/navigation'
import { safeLink } from '@/lib/gallery'
import { imageURL, assetURL } from '@/lib/assets'
import { radioClip, type RadioPlayback } from '@/lib/cockpit-audio'
import { radioPhrases } from '@/lib/radio-phrases'
import ArrowIcon from './ArrowIcon'
type RadioMessage={speaker:string;message:string;id?:string|null}
function Conversation({messages,onComplete}:{messages:RadioMessage[];onComplete:()=>void}) {
 const [elapsed,setElapsed]=useState(0), signature=messages.map(m=>`${m.speaker}:${m.message}`).join('\n')
 useEffect(()=>{
  const total=messages.reduce((n,m)=>n+Math.min(1100,Math.max(180,Array.from(m.message).length*14)),0)
  if(matchMedia('(prefers-reduced-motion: reduce)').matches){setElapsed(Infinity);onComplete();return}
  let frame=0;const start=performance.now()
  const tick=(now:number)=>{setElapsed(now-start);if(now-start<total)frame=requestAnimationFrame(tick);else onComplete()}
  frame=requestAnimationFrame(tick);return()=>cancelAnimationFrame(frame)
 },[signature,onComplete])
 let start=0
 return <div className="radio-conversation">{messages.map((message,index)=>{const chars=Array.from(message.message),duration=Math.min(1100,Math.max(180,chars.length*14)),progress=Math.max(0,Math.min(1,(elapsed-start)/duration));start+=duration;return progress>0?<blockquote key={message.id||index} data-speaker={message.speaker} aria-label={`${message.speaker==='team'?'车队':'车手'}：${message.message}`}><span aria-hidden="true">“{chars.slice(0,Math.ceil(progress*chars.length)).join('')}”</span></blockquote>:null})}</div>
}
export default function TeamRadio({note}:{note?:{text:string;radioMessages?:{speaker:'team'|'driver';message:string;id?:string|null}[]|null;date:string;link?:string|null}}){
 const [open,setOpen]=useState(false),[muted,setMuted]=useState(false),[soundError,setSoundError]=useState(''),[playing,setPlaying]=useState(false),[run,setRun]=useState(0),[started,setStarted]=useState(false),[ready,setReady]=useState(false),[ptt,setPtt]=useState(false),[replies,setReplies]=useState<string[]>([]),[replying,setReplying]=useState(false)
 const trigger=useRef<HTMLButtonElement>(null),sound=useRef<HTMLAudioElement>(null),wave=useRef<HTMLDivElement>(null),playback=useRef<RadioPlayback|null>(null),frame=useRef(0),sequence=useRef(0),request=useRef<AbortController|null>(null),sounding=useRef(false)
 const pathname=usePathname(),complete=useCallback(()=>setReady(true),[]),replyComplete=useCallback(()=>setReplying(false),[])
 const messages=note?.radioMessages?.length?note.radioMessages:[{id:'fallback',speaker:'driver',message:note?.text||'Copy, head down. Next year is our year.'}]
 const stopAudio=()=>{sequence.current++;request.current?.abort();playback.current?.stop();playback.current=null;sound.current?.pause();sounding.current=false;setPlaying(false)}
 const close=()=>{setOpen(false);stopAudio();trigger.current?.focus()}
 useEffect(()=>{setOpen(false);stopAudio();return()=>{sequence.current++;request.current?.abort();playback.current?.stop();cancelAnimationFrame(frame.current);sound.current?.pause()}},[pathname])
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
 async function play(){
  stopAudio();setSoundError('');setReady(false);setStarted(false);setPtt(false);setRun(n=>n+1);setReplies([]);setReplying(false)
  if(muted){setStarted(true);return}
  setPlaying(true);const current=sequence.current,controller=new AbortController();request.current=controller
  const timeout=setTimeout(()=>controller.abort(),4500)
  try{
   const clip=await radioClip(assetURL('/audio/team-radio.wav'),controller.signal);clearTimeout(timeout)
   if(current!==sequence.current){clip.stop();return};playback.current=clip;sounding.current=true;setStarted(true)
   await clip.ended;if(current===sequence.current){sounding.current=false;setPlaying(false);playback.current=null}
  }catch{
   if(current!==sequence.current)return
   try{if(!sound.current)throw new Error();sound.current.currentTime=0;sound.current.volume=.45;await sound.current.play();if(current!==sequence.current){sound.current.pause();return};sounding.current=true;setStarted(true)}catch{setPlaying(false);setStarted(true);setSoundError('提示音未能播放，可点重播重试。')}
  }finally{clearTimeout(timeout)}
 }
 function reply(message:string){if(replying)return;setReplies(values=>[...values,message].slice(-8));setReplying(true);setPtt(false);navigator.vibrate?.(20)}
 if(pathname.startsWith('/manage')||pathname==='/pit-wall')return null
 return <div className="radio-dock" data-open={open}><audio ref={sound} src={assetURL('/audio/team-radio.wav')} preload="auto" onEnded={()=>{setPlaying(false);sounding.current=false}}/>
 <button ref={trigger} className="radio-toggle" aria-expanded={open} aria-controls="team-radio-panel" onClick={()=>{if(open)close();else{setOpen(true);void play()}}}><b>51</b><span>TEAM<br/>RADIO</span><i aria-hidden="true">{open?'−':'+'}</i></button>
 {open&&<aside id="team-radio-panel" className="radio-popup" aria-labelledby="radio-title" data-playing={playing}><button className="radio-close" onClick={close} aria-label="关闭车队电台">×</button><div className="radio-broadcast"><h2 id="radio-title"><span>MERAK</span><br/>RADIO</h2><div className="radio-signal"><b>51</b><img src={imageURL('/team-logos/ferrari-hq.svg')} width="68" height="78" alt="Ferrari"/></div><div ref={wave} className="radio-wave" aria-hidden="true">{[48,83,100,100,84,90,74,57,52].map((height,i)=><span key={i} style={{'--wave-height':`${height}%`} as CSSProperties}><i/><i/></span>)}</div></div>
 {started?<Conversation key={run} messages={messages} onComplete={complete}/>:<p className="radio-connecting" role="status">CONNECTING…</p>}
 {replies.map((text,index)=>index===replies.length-1&&replying?<Conversation key={`reply-${index}-${text}`} messages={[{speaker:'team',message:text}]} onComplete={replyComplete}/>:<div className="radio-conversation" key={`reply-${index}-${text}`}><blockquote data-speaker="team">“{text}”</blockquote></div>)}
 <div className="radio-interactions">{ready&&!replying&&<button className="radio-reply-button" aria-expanded={ptt} onClick={()=>setPtt(!ptt)}><span>PTT / REPLY</span><ArrowIcon/></button>}{ready&&ptt&&<div className="ptt-phrases">{radioPhrases.map(phrase=><button key={phrase} onClick={()=>reply(phrase)}>{phrase}<ArrowIcon/></button>)}</div>}</div>
 <footer><time>{note?note.date.slice(0,10).replaceAll('-','.'):'STANDBY'}</time><div><button onClick={()=>void play()}>重播</button><button aria-pressed={muted} onClick={()=>{setMuted(!muted);stopAudio();if(!started)setStarted(true)}}>{muted?'提示音：关':'提示音：开'}</button>{safeLink(note?.link)&&<a href={safeLink(note?.link)}>原文 <ArrowIcon direction="up-right"/></a>}</div></footer>{soundError&&<p role="status" className="radio-sound-error">{soundError}</p>}</aside>}
 </div>
}
