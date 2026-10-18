'use client'
import Localized from '@/components/Localized'
import Link from 'next/link'
import {usePathname} from 'next/navigation'
import {useEffect,useState} from 'react'
import {setFlightDeck} from '@/lib/cockpit'
const pages=[['/','OVERVIEW',"@i18n:ui.paddockOverview@"],['/flights','FLIGHT LOG',"@i18n:flights.title@"],['/fursuitfriday','PHOTO LAB',"@i18n:ui.fursuitFriday@"],['/blog','LOGBOOK',"@i18n:nav.journal@"],['/visitors','ARRIVALS',"@i18n:nav.lounge@"],['/merak','IDENTITY',"@i18n:nav.about@"],['/pit-wall','PIT WALL',"@i18n:ui.telemetry@"]]
export default function FlightDeck(){
 const path=usePathname(),[enabled,setEnabled]=useState(false),[utc,setUtc]=useState('—')
 useEffect(()=>{const sync=()=>setEnabled(document.documentElement.dataset.cockpit==='flight');sync();window.addEventListener('merak-theme',sync);return()=>window.removeEventListener('merak-theme',sync)},[])
 useEffect(()=>{if(!enabled)return;const tick=()=>setUtc(new Date().toISOString().slice(11,19));tick();const timer=setInterval(tick,1000);return()=>clearInterval(timer)},[enabled])
 if(!enabled)return null
 const active=pages.find(([href])=>href==='/'?path==='/':path.startsWith(href))||pages[0]
 return <Localized><aside className="flight-deck-shell" aria-label="@i18n:ui.cockpitConsole@"><header><div><span>MERAK / 51</span><strong>FLIGHT DECK</strong></div><p>{active[1]}<small>{active[2]}</small></p><time>{utc}<small>UTC / LIVE CLOCK</small></time></header><nav aria-label="@i18n:ui.cockpitNavigation@">{pages.map(([href,title,label],i)=><Link key={href} href={href} aria-current={active[0]===href?'page':undefined}><span>0{i+1}</span><div><b>{title}</b><small>{label}</small></div><i/></Link>)}<div className="deck-station"><span>HOME STATION</span><b>HGH</b><small>30° N / 120° E</small></div><button onClick={()=>window.dispatchEvent(new Event('merak-open-tower'))}>TOWER CONTROL <kbd>⌘ K</kbd></button><button onClick={()=>setFlightDeck(false)}>EXIT FLIGHT DECK</button></nav><div className="deck-display-label"><span>DISPLAY / {active[1]}</span><span>MERAK DIGITAL PADDOCK</span></div></aside></Localized>
}
