'use client'

import { useEffect, useRef, useState, type ReactNode, type MouseEvent } from 'react'
import ArrowIcon from './ArrowIcon'
import AircraftLabel from './AircraftLabel'
import FlightNumber from './FlightNumber'
import FlightDetail from './FlightDetail'
import type { DisplayFlight } from './FlightBoard'
import type { Airport } from '@/lib/flights/types'
import { landingAirport } from '@/lib/flights/souvenirs'
import { flightTime } from '@/lib/flights/display-time'

export default function HomeFlights({ featured, recent, airports, children }: {
  featured: { kind: 'upcoming' | 'latest'; flight: DisplayFlight } | null
  recent: DisplayFlight[]; airports: Airport[]; children: ReactNode
}) {
  const [selected, setSelected] = useState<DisplayFlight | null>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const anchor = useRef(0)
  const airportName = (code: string) => airports.find(a => a.iata === code)?.city || code
  function open(flight: DisplayFlight, event: MouseEvent<HTMLButtonElement>) {
    anchor.current = event.currentTarget.getBoundingClientRect().top
    setSelected(flight)
  }
  useEffect(() => {
    if (!selected || !dialog.current) return
    const modal = dialog.current
    modal.showModal()
    const height = modal.getBoundingClientRect().height
    modal.style.top = `${Math.max(16, Math.min(anchor.current, window.innerHeight - height - 16))}px`
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { modal.close(); document.body.style.overflow = overflow }
  }, [selected])
  const flight = featured?.flight
  const departure = flight && flightTime(flight, 'departure')
  const airportCode = (code: string) => <span className="home-departure-code">{Array.from(code).map((letter,index) => <b key={index} style={{animationDelay:`${index * 60}ms`}}>{letter}</b>)}</span>
  return <>
    {flight && <div className="home-departure-display">
      <div className="home-departure-heading"><h3><span className="signal-dot" />{featured.kind === 'upcoming' ? '下一次出发' : '最近一次抵达'}</h3><span>{featured.kind === 'upcoming' ? 'DEPARTURES' : 'ARRIVALS'} / MERAK</span></div>
      <div className="home-departure-columns" aria-hidden="true"><span>日期 / DATE</span><span>航程 / ROUTE</span><span>航班 / FLIGHT</span><span>机型 / AIRCRAFT</span><span>状态 / STATUS</span></div>
      <button className="home-departure-row" onClick={event => open(flight, event)} aria-haspopup="dialog" aria-label={`查看 ${flight.from} 至 ${landingAirport(flight)} 航班详情`}>
        <span className="home-departure-date"><time>{flight.date.replaceAll('-', '.')}</time><small>{departure?.clock || '时刻未记录'}</small></span>
        <span className="home-departure-route"><strong>{airportCode(flight.from)}<ArrowIcon />{airportCode(landingAirport(flight))}</strong><small>{airportName(flight.from)} · {airportName(landingAirport(flight))}</small></span>
        <FlightNumber flight={flight} /><span className="home-departure-aircraft"><AircraftLabel aircraft={flight.aircraft}/><small>{flight.registration}</small></span>
        <span className="home-departure-status">{flight.state === 'completed' ? '已抵达' : '计划中'}<ArrowIcon direction="up-right" /></span>
      </button>
      <p className="home-departure-note">个人飞行记录 · 机场当地时间<span>点击查看航程详情</span></p>
    </div>}
    {children}
    {recent.length > 0 && <div className="home-recent-flights home-departures-board" aria-label="近期已完成航程">
      <div className="home-recent-heading"><h3><span className="signal-dot" />最近的出发</h3><span>RECENT DEPARTURES</span></div>
      <div className="home-board-columns" aria-hidden="true"><span>日期 / DATE</span><span>航班 / FLIGHT</span><span>航程 / ROUTE</span><span>机型 / AIRCRAFT</span><span>状态 / STATUS</span></div>
      {recent.map((flight, index) => <button className="home-board-row" key={flight.id ?? index} onClick={event => open(flight, event)} aria-haspopup="dialog" aria-label={`查看 ${flight.date} ${flight.from} 至 ${landingAirport(flight)} 航班详情`}>
        <span className="home-board-date"><time dateTime={flight.date}>{flight.date.replaceAll('-', '.')}</time><small>{flightTime(flight, 'departure').clock || '时刻未记录'}</small></span>
        <span className="home-board-flight"><FlightNumber flight={flight}/></span>
        <span className="home-board-route"><strong>{airportCode(flight.from)}<ArrowIcon />{airportCode(landingAirport(flight))}</strong><small>{airportName(flight.from)} · {airportName(landingAirport(flight))}</small></span>
        <span className="home-recent-aircraft"><AircraftLabel aircraft={flight.aircraft}/></span>
        <span className="home-board-state"><span>已抵达</span><small>LANDED <ArrowIcon direction="up-right" /></small></span>
      </button>)}
      <p className="home-board-note">机场当地时间 · 个人飞行记录<span>点击航班查看详情 <ArrowIcon direction="up-right" /></span></p>
    </div>}
    <dialog ref={dialog} className="home-flight-dialog" aria-label="航程详情" onClose={() => setSelected(null)} onClick={event => { if (event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) event.currentTarget.close() } }}>
      <header><span>FLIGHT DETAILS / 航程详情</span><button autoFocus onClick={() => dialog.current?.close()} aria-label="关闭航程详情">关闭 <span aria-hidden="true">×</span></button></header>
      {selected && <FlightDetail flight={selected} airports={airports} airportName={airportName}/>}
      <p className="home-dialog-credit">机型图 Credit：<a href="https://www.norebbo.com/" target="_blank" rel="noreferrer">Norebbo</a></p>
    </dialog>
  </>
}
