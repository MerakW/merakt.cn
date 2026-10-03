'use client'
import { useEffect, useRef, useState } from 'react'
export default function ThemeControl() {
 const [dark,setDark] = useState(false)
 const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
 useEffect(()=>()=>{if(fadeTimer.current)clearTimeout(fadeTimer.current);document.documentElement.classList.remove('theme-fading')},[])
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
 function toggle(){
  const next=!dark
  const apply=()=>{setDark(next);try{sessionStorage.setItem('merak-visit-theme',next?'dark':'light')}catch{};document.documentElement.dataset.theme=next?'dark':'light'}
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { apply(); return }
  if (document.startViewTransition) document.startViewTransition(apply)
  else {
   if(fadeTimer.current)clearTimeout(fadeTimer.current)
   document.documentElement.classList.add('theme-fading')
   apply()
   fadeTimer.current=setTimeout(()=>document.documentElement.classList.remove('theme-fading'),420)
  }
 }
 return <div className="theme-control"><button type="button" aria-label={dark?'切换为浅色模式':'切换为深色模式'} title={dark?'切换为浅色模式':'切换为深色模式'} onClick={toggle}><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{dark?<><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></>:<path d="M20.5 14A8.5 8.5 0 0 1 10 3.5 8.5 8.5 0 1 0 20.5 14Z"/>}</svg></button></div>
}
