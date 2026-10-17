'use client'
import { useEffect, useRef, useState } from 'react'
import ArrowIcon from './ArrowIcon'
import HomeBoardingPass from './HomeBoardingPass'
type Radar = {city:string;airport:string;km:number;minutes:number}
export default function ArrivalRadar() {
 const autoRequest=useRef<AbortController|null>(null)
 const [data,setData]=useState<Radar|null>(null),[manual,setManual]=useState(false),[code,setCode]=useState(''),[message,setMessage]=useState('正在搜寻信号…'),[busy,setBusy]=useState(false)
 useEffect(()=>{
  const controller=new AbortController();autoRequest.current=controller;let active=true
  const timeout=setTimeout(()=>controller.abort(),6000)
  void (async()=>{try {
    try{sessionStorage.removeItem('merak-radar')}catch{}
    const res=await fetch('https://ipwho.is/',{signal:controller.signal,credentials:'omit'}),location=await res.json()
    if(!res.ok||!location.success||!Number.isFinite(location.latitude)||!Number.isFinite(location.longitude))throw new Error()
    const route=await fetch('/api/radar',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({lat:location.latitude,lon:location.longitude}),signal:controller.signal}),result=await route.json();if(!route.ok)throw new Error()
    result.city=typeof location.city==='string'?location.city:result.city
    if(active&&!controller.signal.aborted)setData(result)
  }catch{if(active)setMessage('信号暂未定位，选择你的出发机场。')}finally{clearTimeout(timeout)}})()
  return()=>{active=false;clearTimeout(timeout);controller.abort()}
 },[])
 return <section id="home-content" className="home-pass-invite home-radar-checkin" aria-labelledby="home-pass-heading"><div><h2 id="home-pass-heading"><span>YOU <ArrowIcon /> HGH</span>给你留了一个<br/>靠窗的位置。</h2><div className="arrival-radar"><span className="radar-pulse" aria-hidden="true"/><div><p className="radar-label">RADAR / YOU → HGH</p>{data?<><p className="radar-readout">{data.city.toUpperCase()} · 距杭州约 <b>{data.km.toLocaleString()} KM</b></p><small>{data.km<50?'已进入杭州终端区。':`A350-900 · 预计 ${Math.floor(data.minutes/60)}h ${String(data.minutes%60).padStart(2,'0')}m 后汇合`}</small></>:<p>{message}</p>}<button className="radar-edit" onClick={()=>setManual(!manual)}>{data?'更改出发地':'选择机场'}</button>{manual&&<form onSubmit={async e=>{e.preventDefault();if(busy)return;setBusy(true);autoRequest.current?.abort();try{const res=await fetch(`/api/radar?airport=${encodeURIComponent(code)}`),result=await res.json();if(!res.ok)throw new Error(result.error);setData(result);setManual(false);setMessage('');}catch(error){setMessage(error instanceof Error?error.message:'暂时无法计算。')}finally{setBusy(false)}}}><label>出发机场 <input aria-label="出发机场三字码" value={code} onChange={e=>setCode(e.target.value.toUpperCase())} maxLength={3} placeholder="PEK / HND" required pattern="[A-Za-z]{3}"/></label><button disabled={busy}>计算航路</button><span role="status">{message}</span></form>}<p className="radar-privacy">我们不会保存您的任何定位信息，请放心。</p><details><summary>航路估算</summary><small>IP 城市定位由 IPWHOIS 提供；可手动更改。距离按大圆航线估算，时间按 900 km/h 加 1 小时起降余量计算，不代表实际航班。</small></details></div></div></div><HomeBoardingPass base={data?.airport}/></section>
}
