'use client'

import { message as i18nMessage } from '@/lib/i18n/core'
import Localized from '@/components/Localized'
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
  const airportCode = (code: string) => <Localized><span className="home-departure-code">{Array.from(code).map((letter,index) => <b key={index} style={{animationDelay:`${index * 60}ms`}}>{letter}</b>)}</span></Localized>
  return <Localized><>
    {flight && <div className="home-departure-display">
      <div className="home-departure-heading"><h3><span className="signal-dot" />{featured.kind === 'upcoming' ? "@i18n:ui.nextDeparture@" : "@i18n:ui.latestArrival@"}</h3><span>{featured.kind === 'upcoming' ? 'DEPARTURES' : 'ARRIVALS'} / MERAK</span></div>
      <div className="home-departure-columns" aria-hidden="true"><span>{"@i18n:ui.date@"}</span><span>{"@i18n:ui.route@"}</span><span>{"@i18n:ui.flight@"}</span><span>{"@i18n:ui.aircraft3@"}</span><span>{"@i18n:ui.status@"}</span></div>
      <button className="home-departure-row" onClick={event => open(flight, event)} aria-haspopup="dialog" aria-label={i18nMessage('ui.viewFlightFromValue0ToValue1', flight.from, landingAirport(flight))}>
        <span className="home-departure-date"><time>{flight.date.replaceAll('-', '.')}</time><small>{departure?.clock || "@i18n:ui.timeNotRecorded@"}</small></span>
        <span className="home-departure-route"><strong>{airportCode(flight.from)}<ArrowIcon />{airportCode(landingAirport(flight))}</strong><small>{airportName(flight.from)} · {airportName(landingAirport(flight))}</small></span>
        <FlightNumber flight={flight} /><span className="home-departure-aircraft"><AircraftLabel aircraft={flight.aircraft}/><small>{flight.registration}</small></span>
        <span className="home-departure-status">{flight.state === 'completed' ? "@i18n:ui.arrived@" : "@i18n:flightStatus.planned@"}<ArrowIcon direction="up-right" /></span>
      </button>
      <p className="home-departure-note">{"@i18n:ui.personalFlightLogAirportLocalTimes@"}<span>{"@i18n:ui.selectToViewFlightDetails@"}</span></p>
    </div>}
    {children}
    {recent.length > 0 && <div className="home-recent-flights home-departures-board" aria-label="@i18n:ui.recentlyCompletedFlights@">
      <div className="home-recent-heading"><h3><span className="signal-dot" />{"@i18n:ui.recentDepartures@"}</h3><span>RECENT DEPARTURES</span></div>
      <div className="home-board-columns" aria-hidden="true"><span>{"@i18n:ui.date@"}</span><span>{"@i18n:ui.flight@"}</span><span>{"@i18n:ui.route@"}</span><span>{"@i18n:ui.aircraft3@"}</span><span>{"@i18n:ui.status@"}</span></div>
      {recent.map((flight, index) => <button className="home-board-row" key={flight.id ?? index} onClick={event => open(flight, event)} aria-haspopup="dialog" aria-label={i18nMessage('ui.viewValue0FlightFromValue1ToValue2', flight.date, flight.from, landingAirport(flight))}>
        <span className="home-board-date"><time dateTime={flight.date}>{flight.date.replaceAll('-', '.')}</time><small>{flightTime(flight, 'departure').clock || "@i18n:ui.timeNotRecorded@"}</small></span>
        <span className="home-board-flight"><FlightNumber flight={flight}/></span>
        <span className="home-board-route"><strong>{airportCode(flight.from)}<ArrowIcon />{airportCode(landingAirport(flight))}</strong><small>{airportName(flight.from)} · {airportName(landingAirport(flight))}</small></span>
        <span className="home-recent-aircraft"><AircraftLabel aircraft={flight.aircraft}/></span>
        <span className="home-board-state"><span>{"@i18n:ui.arrived@"}</span><small>LANDED <ArrowIcon direction="up-right" /></small></span>
      </button>)}
      <p className="home-board-note">{"@i18n:ui.airportLocalTimesPersonalFlightLog@"}<span>{"@i18n:ui.selectAFlightForDetails@ "}<ArrowIcon direction="up-right" /></span></p>
    </div>}
    <dialog ref={dialog} className="home-flight-dialog" aria-label="@i18n:ui.flightDetails@" onClose={() => setSelected(null)} onClick={event => { if (event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) event.currentTarget.close() } }}>
      <header><span>{"@i18n:ui.flightDetails2@"}</span><button autoFocus onClick={() => dialog.current?.close()} aria-label="@i18n:ui.closeFlightDetails@">{"@i18n:common.close@ "}<span aria-hidden="true">×</span></button></header>
      {selected && <FlightDetail flight={selected} airports={airports} airportName={airportName}/>}
      <p className="home-dialog-credit">{"@i18n:ui.aircraftIllustrationCredit@"}<a href="https://www.norebbo.com/" target="_blank" rel="noreferrer">Norebbo</a></p>
    </dialog>
  </></Localized>
}
