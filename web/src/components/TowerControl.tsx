'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { copyFrequency, setFlightDeck, setTheme, setTelemetry as toggleTelemetry } from '@/lib/cockpit'
export default function TowerControl({latestFlight}:{latestFlight?:{id:number|string;number:string}}) {
 const dialog=useRef<HTMLDialogElement>(null),input=useRef<HTMLInputElement>(null),opener=useRef<HTMLElement|null>(null)
 const [open,setOpen]=useState(false),[query,setQuery]=useState(''),[picked,setPicked]=useState(0),[toast,setToast]=useState(''),[fps,setFps]=useState(0),[telemetry,setTelemetry]=useState(false)
 const router=useRouter(),path=usePathname(),toastTimer=useRef<ReturnType<typeof setTimeout>|null>(null),pitTimer=useRef<ReturnType<typeof setTimeout>|null>(null),restorePit=useRef<(()=>void)|null>(null)
 const close=()=>{dialog.current?.close();setOpen(false);opener.current?.focus({preventScroll:true})}
 const show=()=>{opener.current=document.activeElement as HTMLElement;setQuery('');setPicked(0);setOpen(true)}
 function pitStop(){restorePit.current?.();const old=sessionStorage.getItem('merak-track-preview');sessionStorage.setItem('merak-track-preview',JSON.stringify({mode:'pit'}));window.dispatchEvent(new Event('merak-track-preview'));window.dispatchEvent(new CustomEvent('merak-toast',{detail:'BOX BOX / PIT LANE 51'}));const restore=()=>{if(pitTimer.current)clearTimeout(pitTimer.current);if(old)sessionStorage.setItem('merak-track-preview',old);else sessionStorage.removeItem('merak-track-preview');window.dispatchEvent(new Event('merak-track-preview'));restorePit.current=null};restorePit.current=restore;pitTimer.current=setTimeout(restore,8000)}
 const commands=[
  {label:'Issue Boarding Pass',hint:'领取登机牌 / 围场通行证',run:()=>router.push('/visitors')},
  {label:`View Latest Flight${latestFlight?' · '+latestFlight.number:''}`,hint:'最近一次飞行',run:()=>router.push(latestFlight?`/flights?flight=${latestFlight.id}`:'/flights')},
  {label:'Switch to Dark Mode',hint:'深色模式',run:()=>setTheme('dark')},
  {label:'Switch to Light Mode',hint:'浅色模式',run:()=>setTheme('light')},
  {label:'Enter Cockpit / Flight Deck',hint:'驾驶舱 · 独立导航与仪表布局',run:()=>setFlightDeck(true)},
  {label:'Exit Cockpit / Normal Theme',hint:'退出驾驶舱，恢复之前的深浅模式',run:()=>setFlightDeck(false)},
  {label:'Toggle Telemetry',hint:'工程视图 / T',run:()=>toggleTelemetry(!telemetry)},
  {label:'Trigger Box Box / Pit Stop',hint:'进站 8 秒',run:pitStop},
  {label:'Lights Out',hint:'五红灯反应挑战',run:()=>router.push('/pit-wall#lights-title')},
  {label:'Ping Merak',hint:'复制 QQ 联系方式',run:()=>void copyFrequency()},
 ].filter(c=>`${c.label} ${c.hint}`.toLowerCase().includes(query.toLowerCase()))
 useEffect(()=>{if(open){dialog.current?.showModal();input.current?.focus()}},[open])
 useEffect(()=>{close()},[path])
 useEffect(()=>{
  const key=(e:KeyboardEvent)=>{const el=e.target as HTMLElement,editing=!!el.closest('input,textarea,select,[contenteditable=true]');if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();if(dialog.current?.open)close();else show()}else if(!editing&&!e.metaKey&&!e.ctrlKey&&!e.altKey&&e.key.toLowerCase()==='t'&&!document.querySelector('dialog[open]')){e.preventDefault();toggleTelemetry(document.documentElement.dataset.telemetry!=='true')}}
  const mode=()=>setTelemetry(document.documentElement.dataset.telemetry==='true')
  const notify=(e:Event)=>{setToast(String((e as CustomEvent).detail));if(toastTimer.current)clearTimeout(toastTimer.current);toastTimer.current=setTimeout(()=>setToast(''),3500)}
  mode();window.addEventListener('merak-open-tower',show);window.addEventListener('keydown',key);window.addEventListener('merak-telemetry',mode);window.addEventListener('merak-toast',notify)
  return()=>{window.removeEventListener('merak-open-tower',show);window.removeEventListener('keydown',key);window.removeEventListener('merak-telemetry',mode);window.removeEventListener('merak-toast',notify);if(toastTimer.current)clearTimeout(toastTimer.current);restorePit.current?.()}
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
 return <><button className="tower-launch" onClick={show}>TOWER CONTROL <kbd>⌘ / Ctrl K</kbd></button>{toast&&<div className="cockpit-toast" role="status">{toast}</div>}{telemetry&&<div className="fps-monitor">TELEMETRY <b title="浏览器 requestAnimationFrame 回调频率，不是 GPU 实际帧率">{fps||"—"} Hz / rAF</b><button onClick={()=>toggleTelemetry(false)}>EXIT / T</button></div>}<dialog ref={dialog} className="tower-dialog" onCancel={close} onClose={()=>setOpen(false)} onClick={e=>{if(e.target===e.currentTarget)close()}}><div className="tower-panel"><header><span>TOWER CONTROL / HGH</span><button onClick={close} aria-label="关闭指令窗">ESC</button></header><input ref={input} role="combobox" aria-label="搜索塔台指令" aria-controls="tower-results" aria-expanded="true" aria-activedescendant={commands[picked]?`tower-option-${picked}`:undefined} value={query} placeholder="输入指令…" onChange={e=>{setQuery(e.target.value);setPicked(0)}} onKeyDown={e=>{if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();setPicked(n=>(n+(e.key==='ArrowDown'?1:-1)+commands.length)%Math.max(1,commands.length))}if(e.key==='Enter'&&commands[picked]){e.preventDefault();commands[picked].run();close()}}}/><div id="tower-results" role="listbox" aria-label="可用指令">{commands.map((command,i)=><button role="option" aria-selected={picked===i} id={`tower-option-${i}`} key={command.label} onPointerMove={()=>setPicked(i)} onClick={()=>{command.run();close()}}><b>{command.label}</b><span>{command.hint}</span></button>)}{!commands.length&&<p>未找到指令。</p>}</div><footer>↑ ↓ 选择 · Enter 执行 · Esc 关闭</footer></div></dialog></>
}
