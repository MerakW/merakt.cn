'use client'
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
    }catch(error){if(generation===run.current){change('idle');setNotice(error instanceof Error?error.message:'暂时无法发车。')}}
  }
  const verdict=ms<200?'Bottas 级别的贴地飞行起步！':ms<=300?'标准 F1 车手反应，一号弯守住内线了。':ms<=400?'跟住前车，下一次争取更快。':'Box Box，你这反应速度连安全车都跟不上……'
  return <section className="lights-out instrument-card" aria-labelledby="lights-title"><header><div><p className="kicker">STARTING GRID / 51</p><h2 id="lights-title">LIGHTS OUT</h2></div><button className="instrument-toggle" aria-pressed={sound} onClick={()=>setSound(!sound)}>SOUND {sound?'ON':'OFF'}</button></header>
    <button className="start-pad" data-phase={phase} onPointerDown={e=>{if(e.button===0){e.preventDefault();e.currentTarget.focus();void press()}}} onKeyDown={e=>{if((e.key===' '||e.key==='Enter')&&!e.repeat){e.preventDefault();void press()}}} onClick={e=>{if(e.detail===0)void press()}} aria-label="准备发车，红灯熄灭后再次按下"><span className="start-lights" aria-hidden="true">{[1,2,3,4,5].map(n=><i key={n} data-lit={n<=lit}/>)}</span><span className="start-readout" aria-live="polite">{phase==='done'?`${(ms/1000).toFixed(3)} s`:phase==='jump'?'JUMP START':phase==='go'?'GO!':phase==='lights'?'HOLD…':phase==='loading'?'CONNECTING…':phase==='cancelled'?'SESSION PAUSED':'STAND BY'}</span><span className="start-caption">{phase==='done'?verdict:phase==='jump'?'抢跑 · PENALTY +5s · 点击重试':phase==='cancelled'?'点击重新发车':phase==='go'?'现在点击':phase==='lights'?'等待五盏红灯熄灭':'准备发车 · 点击 / 空格'}</span></button>
    {phase==='done'&&!saved&&ms>=100&&ms<=10000&&<form className="score-submit" onSubmit={async e=>{e.preventDefault();if(saving)return;setSaving(true);try{const res=await fetch('/api/paddock-signals/send',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind:'reaction',token:token.current,ms,name})}),data=await res.json();if(!res.ok)throw new Error(data.error);setSaved(true);setNotice('成绩已登记，昵称审核后公开。');void refresh()}catch(error){setNotice(error instanceof Error?error.message:'登记失败，请重试。')}finally{setSaving(false)}}}><input aria-label="排行榜昵称" placeholder="昵称（可选）" maxLength={24} value={name} onChange={e=>setName(e.target.value)}/><button disabled={saving}>{saving?'登记中…':'登记成绩'}</button></form>}
    {phase==='done'&&ms<100&&<p>反应低于 0.100 s，本次不计入榜单。</p>}{notice&&<p role="status">{notice}</p>}
    {rankingError&&<p role="status">榜单暂未载入，<button onClick={()=>void refresh()}>重试</button></p>}<div className="pole-board">{[['本月 / MONTH',best.month],['总榜 / ALL TIME',best.allTime]].map(([label,row])=><div key={String(label)}><span>{String(label)} / POLE</span><b>{row&&typeof row==='object'?`${(row.ms/1000).toFixed(3)} s`:'—'}</b><small>{row&&typeof row==='object'?row.name:rankingError?'暂不可用':'等待第一个发车成绩'}</small></div>)}</div><small className="instrument-footnote">浏览器计时 · 排名按北京时间更新</small>
  </section>
}
