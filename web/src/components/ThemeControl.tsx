'use client'
import Localized from '@/components/Localized'
import { useEffect, useState } from 'react'
import { setTheme, setTelemetry } from '@/lib/cockpit'
export default function ThemeControl() {
 const [dark,setDark]=useState(false),[telemetry,setActive]=useState(false)
 useEffect(()=>{
  const media=matchMedia('(prefers-color-scheme: dark)')
  const update=()=>{setDark(document.documentElement.dataset.theme==='dark');setActive(document.documentElement.dataset.telemetry==='true')}
  const system=()=>{if(document.documentElement.dataset.cockpit==='flight')return;let saved=null;try{saved=sessionStorage.getItem('merak-visit-theme')}catch{};if(saved!=='light'&&saved!=='dark'){document.documentElement.dataset.theme=media.matches?'dark':'light';update()}}
  update();media.addEventListener('change',system);window.addEventListener('merak-theme',update);window.addEventListener('merak-telemetry',update)
  return()=>{media.removeEventListener('change',system);window.removeEventListener('merak-theme',update);window.removeEventListener('merak-telemetry',update)}
 },[])
 return <Localized><div className="theme-control"><button aria-label={dark?"@i18n:ui.switchToLightMode@":"@i18n:ui.switchToDarkMode@"} title={dark?"@i18n:ui.lightMode@":"@i18n:ui.darkMode@"} onClick={()=>setTheme(dark?'light':'dark')}><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{dark?<><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></>:<path d="M20.5 14A8.5 8.5 0 0 1 10 3.5 8.5 8.5 0 1 0 20.5 14Z"/>}</svg></button><button aria-label="@i18n:ui.toggleTelemetryView@" title="@i18n:ui.telemetryT@" aria-pressed={telemetry} onClick={()=>setTelemetry(!telemetry)}><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M3 9h18M9 3v18m6-12v12M9 15h12"/></svg></button></div></Localized>
}
