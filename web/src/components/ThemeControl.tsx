'use client'
import { useEffect, useRef, useState, type MouseEvent } from 'react'
export default function ThemeControl() {
 const [dark,setDark] = useState(false)
 const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
 const transition = useRef<ViewTransition | null>(null)
 useEffect(()=>()=>{if(fadeTimer.current)clearTimeout(fadeTimer.current);transition.current?.skipTransition();document.documentElement.classList.remove('theme-fading');delete document.documentElement.dataset.themeTransition},[])
 useEffect(()=>{
  const media=matchMedia('(prefers-color-scheme: dark)')
  const apply=()=>{
   let choice: string | null = null
   try { choice=sessionStorage.getItem('merak-visit-theme') } catch {}
   const next=choice==='dark'||choice==='light'?choice==='dark':media.matches
   setDark(next);document.documentElement.dataset.theme=next?'dark':'light'
  }
  apply();media.addEventListener('change',apply)
  return ()=>media.removeEventListener('change',apply)
 },[])
 async function toggle(event: MouseEvent<HTMLButtonElement>){
  if(transition.current) return
  const next=!dark
  const apply=()=>{setDark(next);try{sessionStorage.setItem('merak-visit-theme',next?'dark':'light')}catch{};document.documentElement.dataset.theme=next?'dark':'light'}
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { apply(); return }
  if (document.startViewTransition) {
   const rect=event.currentTarget.getBoundingClientRect()
   const x=rect.left+rect.width/2,y=rect.top+rect.height/2
   const radius=Math.hypot(Math.max(x,innerWidth-x),Math.max(y,innerHeight-y))
   document.documentElement.dataset.themeTransition='radial'
   const current=document.startViewTransition(apply)
   transition.current=current
   try {
    await current.ready
    const animation=document.documentElement.animate(
     {clipPath:[`circle(0px at ${x}px ${y}px)`,`circle(${radius}px at ${x}px ${y}px)`]},
     {duration:650,easing:'cubic-bezier(.22,1,.36,1)',fill:'both',pseudoElement:'::view-transition-new(root)'}
    )
    await animation.finished
    await current.finished
   } catch { current.skipTransition() }
   finally { transition.current=null;delete document.documentElement.dataset.themeTransition }
  }
  else {
   if(fadeTimer.current)clearTimeout(fadeTimer.current)
   document.documentElement.classList.add('theme-fading')
   apply()
   fadeTimer.current=setTimeout(()=>document.documentElement.classList.remove('theme-fading'),420)
  }
 }
 return <div className="theme-control"><button type="button" aria-label={dark?'切换为浅色模式':'切换为深色模式'} title={dark?'切换为浅色模式':'切换为深色模式'} onClick={toggle}><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{dark?<><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></>:<path d="M20.5 14A8.5 8.5 0 0 1 10 3.5 8.5 8.5 0 1 0 20.5 14Z"/>}</svg></button></div>
}
