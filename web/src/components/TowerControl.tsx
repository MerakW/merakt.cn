'use client'
import Localized, { useTranslator } from '@/components/Localized'
import { useEffect, useRef, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { copyFrequency, setFlightDeck, setTheme, setTelemetry as toggleTelemetry } from '@/lib/cockpit'
export default function TowerControl({latestFlight}:{latestFlight?:{id:number|string;number:string}}) {
 const t = useTranslator()
 const [history,setHistory]=useState<string[]>(['MERAK CONTROL SHELL / HGH','@i18n:terminal.ready@'])
 const [pit,setPit]=useState<{elapsed:number;duration:number;closing?:boolean}|null>(null)
 const transcript=useRef<HTMLPreElement>(null)
 const dialog=useRef<HTMLDialogElement>(null),input=useRef<HTMLInputElement>(null),opener=useRef<HTMLElement|null>(null)
 const [open,setOpen]=useState(false),[query,setQuery]=useState(''),[picked,setPicked]=useState(0),[toast,setToast]=useState(''),[fps,setFps]=useState(0),[telemetry,setTelemetry]=useState(false)
 const router=useRouter(),path=usePathname(),toastTimer=useRef<ReturnType<typeof setTimeout>|null>(null),pitTimer=useRef<ReturnType<typeof setTimeout>|null>(null),restorePit=useRef<(()=>void)|null>(null)
 const closing=useRef<ReturnType<typeof setTimeout>|null>(null)
 const close=()=>{
  const el=dialog.current
  if(!el?.open){setOpen(false);return}
  if(closing.current)return
  const finish=()=>{el.close();delete el.dataset.closing;setOpen(false);closing.current=null;opener.current?.focus({preventScroll:true})}
  if(matchMedia('(prefers-reduced-motion: reduce)').matches){finish();return}
  el.dataset.closing='true';closing.current=setTimeout(finish,180)
 }
 const show=()=>{opener.current=document.activeElement as HTMLElement;setQuery('');setPicked(0);setOpen(true)}
 function pitStop(){
  restorePit.current?.()
  if(pitTimer.current)clearTimeout(pitTimer.current)
  const old=sessionStorage.getItem('merak-track-preview'),duration=1.8+Math.random()*2.7
  sessionStorage.setItem('merak-track-preview',JSON.stringify({mode:'pit'}));window.dispatchEvent(new Event('merak-track-preview'))
  setPit({elapsed:0,duration})
  const restore=()=>{if(pitTimer.current)clearTimeout(pitTimer.current);if(old)sessionStorage.setItem('merak-track-preview',old);else sessionStorage.removeItem('merak-track-preview');window.dispatchEvent(new Event('merak-track-preview'));restorePit.current=null;setPit(value=>value?{...value,closing:true}:null);pitTimer.current=setTimeout(()=>setPit(null),260)}
  restorePit.current=restore;pitTimer.current=setTimeout(restore,(duration+5)*1000)
 }
 useEffect(()=>{
  if(!pit)return
  const started=performance.now();let raf=0
  const tick=(now:number)=>{setPit(value=>value?{...value,elapsed:(now-started)/1000}:null);raf=requestAnimationFrame(tick)}
  raf=requestAnimationFrame(tick);return()=>cancelAnimationFrame(raf)
 },[pit?.duration])
 const commands=[
  {id:'boarding-pass',label:'Issue Boarding Pass',hint:"@i18n:ui.getABoardingPassPaddockPass@",run:()=>router.push('/visitors')},
  {id:'flight.latest',label:`View Latest Flight${latestFlight?' · '+latestFlight.number:''}`,hint:"@i18n:ui.latestFlight@",run:()=>router.push(latestFlight?`/flights?flight=${latestFlight.id}`:'/flights')},
  {id:'theme.dark',label:'Switch to Dark Mode',hint:"@i18n:ui.darkMode@",run:()=>setTheme('dark')},
  {id:'theme.light',label:'Switch to Light Mode',hint:"@i18n:ui.lightMode@",run:()=>setTheme('light')},
  {id:'cockpit.enter',label:'Enter Cockpit / Flight Deck',hint:"@i18n:ui.cockpitDedicatedNavigationAndInstruments@",run:()=>setFlightDeck(true)},
  {id:'cockpit.exit',label:'Exit Cockpit / Normal Theme',hint:"@i18n:ui.leaveCockpitAndRestoreYourPreviousTheme@",run:()=>setFlightDeck(false)},
  {id:'telemetry',label:'Toggle Telemetry',hint:"@i18n:ui.engineerViewT@",run:()=>toggleTelemetry(!telemetry)},
  {id:'box',label:'Trigger Box Box / Pit Stop',hint:"@i18n:ui.pitStopFor8Seconds@",run:pitStop},
  {id:'lights-out',label:'Lights Out',hint:"@i18n:ui.fiveLightReactionChallenge@",run:()=>router.push('/pit-wall#lights-title')},
  {id:'contact',label:'Ping Merak',hint:"@i18n:ui.copyQqContact@",run:()=>void copyFrequency()},
 ].filter(c=>`${c.id} ${c.label} ${c.hint} ${t(c.hint)}`.toLowerCase().includes(query.toLowerCase()))
 function execute(command: typeof commands[number]){
  setHistory(lines=>[...lines.slice(-9),`merak@hgh:~$ ${command.id}`,`[OK] ${command.label}`]);setQuery('');setPicked(0);command.run()
  if(command.id==='box')close()
 }
 useEffect(()=>{if(transcript.current)transcript.current.scrollTop=transcript.current.scrollHeight},[history])
 useEffect(()=>{
  if(open)document.getElementById(`tower-option-${picked}`)?.scrollIntoView({block:'nearest',behavior:'instant'})
 },[picked,query,open])
 useEffect(()=>{if(open){dialog.current?.showModal();input.current?.focus()}},[open])
 useEffect(()=>{close()},[path])
 useEffect(()=>{
  const key=(e:KeyboardEvent)=>{const el=e.target as HTMLElement,editing=!!el.closest('input,textarea,select,[contenteditable=true]');if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();if(dialog.current?.open)close();else show()}else if(!editing&&!e.metaKey&&!e.ctrlKey&&!e.altKey&&e.key.toLowerCase()==='t'&&!document.querySelector('dialog[open]')){e.preventDefault();toggleTelemetry(document.documentElement.dataset.telemetry!=='true')}}
  const mode=()=>setTelemetry(document.documentElement.dataset.telemetry==='true')
  const notify=(e:Event)=>{setToast(String((e as CustomEvent).detail));if(toastTimer.current)clearTimeout(toastTimer.current);toastTimer.current=setTimeout(()=>setToast(''),3500)}
  mode();window.addEventListener('merak-open-tower',show);window.addEventListener('keydown',key);window.addEventListener('merak-telemetry',mode);window.addEventListener('merak-toast',notify)
  return()=>{window.removeEventListener('merak-open-tower',show);window.removeEventListener('keydown',key);window.removeEventListener('merak-telemetry',mode);window.removeEventListener('merak-toast',notify);if(toastTimer.current)clearTimeout(toastTimer.current);restorePit.current?.();if(pitTimer.current)clearTimeout(pitTimer.current);if(closing.current)clearTimeout(closing.current)}
 },[])
 useEffect(()=>{
  if(!telemetry)return
  let raf=0,last=0,frames=0,elapsed=0
  const nodes=new Set<HTMLElement>()
  const measure=(node:HTMLElement)=>{const rect=node.getBoundingClientRect();node.dataset.dimensions=`${Math.round(rect.width)} × ${Math.round(rect.height)} CSS px`}
  const observer=new ResizeObserver(entries=>entries.forEach(entry=>measure(entry.target as HTMLElement)))
  const sync=()=>{for(const node of nodes)if(!node.isConnected){observer.unobserve(node);nodes.delete(node)}document.querySelectorAll<HTMLElement>('.site-main section,.site-main article,.instrument-card').forEach(node=>{if(!nodes.has(node)){nodes.add(node);observer.observe(node,{box:'border-box'});measure(node)}})}
  sync();const mutations=new MutationObserver(sync);mutations.observe(document.querySelector('.site-main')!,{childList:true,subtree:true})
  const tick=(now:number)=>{if(last){elapsed+=now-last;frames++}last=now;if(elapsed>=1000){setFps(Math.round(frames*1000/elapsed));elapsed=0;frames=0;nodes.forEach(measure)}raf=requestAnimationFrame(tick)}
  const visibility=()=>{cancelAnimationFrame(raf);last=0;frames=0;elapsed=0;setFps(0);if(!document.hidden)raf=requestAnimationFrame(tick)}
  visibility();document.addEventListener('visibilitychange',visibility)
  return()=>{cancelAnimationFrame(raf);observer.disconnect();mutations.disconnect();document.removeEventListener('visibilitychange',visibility);nodes.forEach(n=>delete n.dataset.dimensions)}
 },[telemetry,path])
 useEffect(()=>{
  if(matchMedia('(pointer: coarse), (prefers-reduced-motion: reduce)').matches)return
  const move=(e:PointerEvent)=>{const card=(e.target as HTMLElement).closest<HTMLElement>('.instrument-card,.telemetry-grid article,.home-gallery-card');if(!card)return;const rect=card.getBoundingClientRect();card.style.setProperty('--spot-x',`${e.clientX-rect.left}px`);card.style.setProperty('--spot-y',`${e.clientY-rect.top}px`)}
  document.addEventListener('pointermove',move,{passive:true});return()=>document.removeEventListener('pointermove',move)
 },[])
 return <Localized><><button className="tower-launch" onClick={show}>TOWER CONTROL <kbd>⌘ / Ctrl K</kbd></button>{pit&&<aside className="pit-stop-timing" data-closing={pit.closing} data-working={pit.elapsed>=1.5&&pit.elapsed<1.5+pit.duration} aria-label="Pit stop timing"><header><b>51</b><img src="/team-logos/ferrari-hq.svg" alt="Ferrari" width="22" height="26"/><strong>MERAK</strong><button onClick={()=>restorePit.current?.()} aria-label="@i18n:pit.closeTimer@">×</button></header><div className="pit-readout" key={pit.elapsed<1.5?'entry':pit.elapsed<1.5+pit.duration?'stop':'exit'}><span>{pit.elapsed<1.5?'IN PIT':pit.elapsed<1.5+pit.duration?'STOP TIME':'PIT EXIT'}</span><b>{(pit.elapsed<1.5?pit.elapsed:Math.min(pit.duration,pit.elapsed-1.5)).toFixed(1)}</b></div><small>IN PIT <time>{pit.elapsed.toFixed(1)} s</time></small></aside>}{toast&&<div className="cockpit-toast" role="status">{toast}</div>}{telemetry&&<div className="fps-monitor">TELEMETRY <b title="@i18n:ui.browserRequestanimationframeRateNotActualGpuFrameRate@">{fps||"—"} Hz / rAF</b><button onClick={()=>toggleTelemetry(false)}>EXIT / T</button></div>}<dialog ref={dialog} className="tower-dialog" onCancel={e=>{e.preventDefault();close()}} onClose={()=>{setOpen(false);if(closing.current)clearTimeout(closing.current);closing.current=null}} onClick={e=>{if(e.target===e.currentTarget)close()}}><div className="tower-panel"><header><span>TOWER CONTROL / HGH</span><button onClick={close} aria-label="@i18n:ui.closeCommandPalette@">ESC</button></header><pre ref={transcript} className="tower-history" role="log" aria-label={t('terminal.output')}>{history.map((line,index)=><span className="tower-log-line" key={`${index}-${line}`}>{t(line)}</span>)}</pre><div className="tower-command-line"><label htmlFor="tower-command">merak@hgh:~$</label><input id="tower-command" spellCheck={false} autoComplete="off" ref={input} role="combobox" aria-label="@i18n:ui.searchTowerCommands@" aria-controls="tower-results" aria-expanded="true" aria-activedescendant={commands[picked]?`tower-option-${picked}`:undefined} value={query} placeholder="@i18n:ui.typeACommand@" onChange={e=>{setQuery(e.target.value);setPicked(0)}} onKeyDown={e=>{if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();setPicked(n=>(n+(e.key==='ArrowDown'?1:-1)+commands.length)%Math.max(1,commands.length))}if(e.key==='Enter'&&commands[picked]){e.preventDefault();execute(commands[picked])}else if(e.key==='Enter'&&query==='clear'){setHistory([]);setQuery('')}else if(e.key==='Enter'&&!commands.length){setHistory(lines=>[...lines.slice(-9),`merak@hgh:~$ ${query}`,'@i18n:terminal.notFound@']);setQuery('')}}}/></div><div id="tower-results" role="listbox" aria-label="@i18n:ui.availableCommands@">{commands.map((command,i)=><button role="option" aria-selected={picked===i} id={`tower-option-${i}`} key={command.id} onPointerMove={()=>setPicked(i)} onClick={()=>{execute(command)}}><b><code>{command.id}</code> {command.label}</b><span>{command.hint}</span></button>)}{!commands.length&&<p>{"@i18n:ui.noCommandsFound@"}</p>}</div><footer>{"@i18n:ui.selectEnterRunEscClose@"}</footer></div></dialog></></Localized>
}
