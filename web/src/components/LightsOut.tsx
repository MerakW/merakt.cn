'use client'
import Localized from '@/components/Localized'
import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { audioContext, startBeep } from '@/lib/cockpit-audio'
type Phase = 'idle'|'loading'|'lights'|'go'|'jump'|'done'|'cancelled'
type Best = {ms:number;name:string}|null
export default function LightsOut() {
  const [phase,setPhase]=useState<Phase>('idle'), [lit,setLit]=useState(0), [ms,setMs]=useState(0),[sound,setSound]=useState(false)
  const [rankingError,setRankingError]=useState(false)
  const [name,setName]=useState(''),[notice,setNotice]=useState(''),[saved,setSaved]=useState(false),[saving,setSaving]=useState(false)
  const [best,setBest]=useState<{month:Best;allTime:Best}>({month:null,allTime:null})
  const live=useRef<Phase>('idle'), frame=useRef(0), token=useRef(''), lightsAt=useRef(0), run=useRef(0)
  const timers=useRef<ReturnType<typeof setTimeout>[]>([])
  const change=(p:Phase)=>{live.current=p;setPhase(p)}
  const clear=()=>{timers.current.forEach(clearTimeout);timers.current=[];cancelAnimationFrame(frame.current)}
  const refresh=()=>fetch('/api/paddock-signals/summary').then(r=>r.ok?r.json():Promise.reject()).then(data=>{setBest(data);setRankingError(false)}).catch(()=>setRankingError(true))
  useEffect(()=>{void refresh();const cancel=()=>{if(['lights','go','loading'].includes(live.current)){run.current++;clear();change('cancelled')}};document.addEventListener('visibilitychange',cancel);window.addEventListener('blur',cancel);return()=>{run.current++;clear();document.removeEventListener('visibilitychange',cancel);window.removeEventListener('blur',cancel)}},[])
  async function press() {
    if(live.current==='loading')return
    if(live.current==='lights'){clear();change('jump');setLit(5);return}
    if(live.current==='go'){const time=Math.round(performance.now()-lightsAt.current);clear();setMs(time);change('done');return}
    clear();change('loading');setLit(0);setSaved(false);setNotice('');const generation=++run.current
    if(sound)void audioContext().catch(()=>{})
    try {
      const res=await fetch('/api/paddock-signals/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind:'start'})}), data=await res.json()
      if(!res.ok)throw new Error(data.error)
      if(generation!==run.current)return
      token.current=data.token;change('lights')
      for(let i=1;i<=5;i++)timers.current.push(setTimeout(()=>{setLit(i);if(sound)void startBeep().catch(()=>{});else navigator.vibrate?.(12)},i*1000))
      timers.current.push(setTimeout(()=>{frame.current=requestAnimationFrame(()=>{flushSync(()=>{setLit(0);change('go')});lightsAt.current=performance.now();timers.current.push(setTimeout(()=>{change('cancelled')},10000))})},5000+data.delay))
    }catch(error){if(generation===run.current){change('idle');setNotice(error instanceof Error?error.message:"@i18n:ui.unableToStartRightNow@")}}
  }
  const verdict=ms<200?"@i18n:ui.aLightningStartWorthyOfBottas@":ms<=300?"@i18n:ui.f1LevelReactionsYouHeldTheInsideInto@":ms<=400?"@i18n:ui.stayWithTheCarAheadQuickerNextTime@":"@i18n:ui.boxBoxEvenTheSafetyCarIsGetting@"
  return <Localized><section className="lights-out instrument-card" aria-labelledby="lights-title"><header><div><p className="kicker">STARTING GRID / 51</p><h2 id="lights-title">LIGHTS OUT</h2></div><button className="instrument-toggle" aria-pressed={sound} onClick={()=>setSound(!sound)}>SOUND {sound?'ON':'OFF'}</button></header>
    <button className="start-pad" data-phase={phase} onPointerDown={e=>{if(e.button===0){e.preventDefault();e.currentTarget.focus();void press()}}} onKeyDown={e=>{if((e.key===' '||e.key==='Enter')&&!e.repeat){e.preventDefault();void press()}}} onClick={e=>{if(e.detail===0)void press()}} aria-label="@i18n:ui.getReadyPressAgainWhenTheLightsGo@"><span className="start-lights" aria-hidden="true">{[1,2,3,4,5].map(n=><i key={n} data-lit={n<=lit}/>)}</span><span className="start-readout" aria-live="polite">{phase==='done'?`${(ms/1000).toFixed(3)} s`:phase==='jump'?'JUMP START':phase==='go'?'GO!':phase==='lights'?'HOLD…':phase==='loading'?'CONNECTING…':phase==='cancelled'?'SESSION PAUSED':'STAND BY'}</span><span className="start-caption">{phase==='done'?verdict:phase==='jump'?"@i18n:ui.jumpStartPenalty5sTryAgain@":phase==='cancelled'?"@i18n:ui.clickToRestart@":phase==='go'?"@i18n:ui.clickNow@":phase==='lights'?"@i18n:ui.waitForAllFiveLightsToGoOut@":"@i18n:ui.readyToStartClickSpace@"}</span></button>
    {phase==='done'&&!saved&&ms>=0&&ms<=10000&&<form className="score-submit" onSubmit={async e=>{e.preventDefault();if(saving)return;setSaving(true);try{const res=await fetch('/api/paddock-signals/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind:'reaction',token:token.current,ms,name})}),data=await res.json();if(!res.ok)throw new Error(data.error);setSaved(true);setNotice("@i18n:ui.resultRecordedYourNicknameWillAppearAfterReview@");void refresh()}catch(error){setNotice(error instanceof Error?error.message:"@i18n:ui.couldNotRecordTheResultTryAgain@")}finally{setSaving(false)}}}><input aria-label="@i18n:ui.leaderboardNickname@" placeholder="@i18n:ui.nicknameOptional@" maxLength={24} value={name} onChange={e=>setName(e.target.value)}/><button disabled={saving}>{saving?"@i18n:ui.recording@":"@i18n:ui.recordResult@"}</button></form>}
    {notice&&<p role="status">{notice}</p>}
    {rankingError&&<p role="status">{"@i18n:ui.leaderboardUnavailable@"}<button onClick={()=>void refresh()}>{"@i18n:common.retry@"}</button></p>}<div className="pole-board">{[["@i18n:ui.thisMonth@",best.month],["@i18n:ui.allTime@",best.allTime]].map(([label,row])=><div key={String(label)}><span>{String(label)} / POLE</span><b>{row&&typeof row==='object'?`${(row.ms/1000).toFixed(3)} s`:'—'}</b><small>{row&&typeof row==='object'?row.name:rankingError?"@i18n:ui.unavailable@":"@i18n:ui.waitingForTheFirstResult@"}</small></div>)}</div><small className="instrument-footnote">{"@i18n:ui.browserTimingRankingsUseBeijingTime@"}</small>
  </section></Localized>
}
