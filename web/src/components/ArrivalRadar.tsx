'use client'
import { message as i18nMessage } from '@/lib/i18n/core'
import Localized from '@/components/Localized'
import { useEffect, useRef, useState } from 'react'
import ArrowIcon from './ArrowIcon'
import HomeBoardingPass from './HomeBoardingPass'
import type { radarRoute } from '@/lib/radar'
type Radar = NonNullable<ReturnType<typeof radarRoute>>
export function RadarReadout({data}:{data:Radar}) {
 return <Localized><p className="radar-readout"><span data-i18n="off">{data.city.toUpperCase()}</span>{data.local ? <> · {"@i18n:ui.radarNearbyHangzhou@"}</> : <> {"@i18n:ui.distanceToHangzhouApprox@ "}<b>{data.km.toLocaleString()} KM</b></>}</p><small>{data.local ? "@i18n:ui.radarLocalWelcome@" : i18nMessage('ui.a350900MeetingInApproxValue0HValue1',Math.floor(data.minutes/60),String(data.minutes%60).padStart(2,'0'))}</small>{data.automatic && <p className="radar-origin-hint">{i18nMessage('ui.radarSuggestedAirport',data.airport)}{data.airports.length > 1 && <> {i18nMessage('ui.radarAlternativeAirports',data.airports.join(' / '))}</>}</p>}</Localized>
}
export default function ArrivalRadar() {
 const autoRequest=useRef<AbortController|null>(null)
 const [data,setData]=useState<Radar|null>(null),[manual,setManual]=useState(false),[code,setCode]=useState(''),[message,setMessage]=useState("@i18n:ui.searchingForASignal@"),[busy,setBusy]=useState(false)
 useEffect(()=>{
  const controller=new AbortController();autoRequest.current=controller;let active=true
  const timeout=setTimeout(()=>controller.abort(),6000)
  void (async()=>{try {
    try{sessionStorage.removeItem('merak-radar')}catch{}
    const res=await fetch('https://ipwho.is/',{signal:controller.signal,credentials:'omit'}),location=await res.json()
    if(!res.ok||!location.success||!Number.isFinite(location.latitude)||!Number.isFinite(location.longitude))throw new Error()
    const route=await fetch('/api/radar',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({lat:location.latitude,lon:location.longitude,city:typeof location.city==='string'?location.city.slice(0,80):undefined}),signal:controller.signal}),result=await route.json();if(!route.ok)throw new Error()
    result.city=typeof location.city==='string'?location.city:result.city
    if(active&&!controller.signal.aborted)setData(result)
  }catch{if(active)setMessage("@i18n:ui.signalUnavailableChooseYourDepartureAirport@")}finally{clearTimeout(timeout)}})()
  return()=>{active=false;clearTimeout(timeout);controller.abort()}
 },[])
 return <Localized><section id="home-content" className="home-pass-invite home-radar-checkin" aria-labelledby="home-pass-heading"><div><h2 id="home-pass-heading"><span>YOU <ArrowIcon /> HGH</span>{"@i18n:ui.savedYouA@"}<br/>{"@i18n:ui.windowSeat@"}</h2><div className="arrival-radar"><span className="radar-pulse" aria-hidden="true"/><div><p className="radar-label">RADAR / YOU → HGH</p>{data?<RadarReadout data={data}/>:<p>{message}</p>}<button className="radar-edit" onClick={()=>setManual(!manual)}>{data?"@i18n:ui.changeOrigin@":"@i18n:airports.choose@"}</button>{manual&&<form onSubmit={async e=>{e.preventDefault();if(busy)return;setBusy(true);autoRequest.current?.abort();try{const res=await fetch(`/api/radar?airport=${encodeURIComponent(code)}`),result=await res.json();if(!res.ok)throw new Error(result.error);setData(result);setManual(false);setMessage('');}catch(error){setMessage(error instanceof Error?error.message:"@i18n:ui.unableToCalculateRightNow@")}finally{setBusy(false)}}}><label>{"@i18n:ui.departureAirport@ "}<input aria-label="@i18n:ui.departureAirportIataCode@" value={code} onChange={e=>setCode(e.target.value.toUpperCase())} maxLength={3} placeholder="PEK / HND" required pattern="[A-Za-z]{3}"/></label><button disabled={busy}>{"@i18n:ui.calculateRoute@"}</button><span role="status">{message}</span></form>}<p className="radar-privacy">{"@i18n:ui.yourLocationInformationIsNeverStored@"}</p><details><summary>{"@i18n:ui.routeEstimate@"}</summary><small>{"@i18n:ui.cityLocationIsProvidedByIpwhoisAndCan@"}</small></details></div></div></div><HomeBoardingPass base={data?.airport}/></section></Localized>
}
